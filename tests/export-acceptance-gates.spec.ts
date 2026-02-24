import { describe, expect, it } from 'vitest';
import { validateExportAcceptance } from '../server/services/export/acceptance-gates';

function buildValidStrategyJson(): string {
  return JSON.stringify({
    understanding: { id: 'u1' },
    journeySession: {
      journeyType: 'business_model_innovation',
    },
    frameworks: ['five_whys', 'bmc'],
  });
}

function buildValidEpmJson(overrides: Record<string, any> = {}): string {
  const base = {
    program: {
      timeline: {
        totalMonths: 6,
        phases: [
          { phase: 1, name: 'P1', startMonth: 0, endMonth: 3, keyMilestones: [], workstreamIds: ['WS001', 'WS002'] },
          { phase: 2, name: 'P2', startMonth: 4, endMonth: 6, keyMilestones: [], workstreamIds: ['WS003'] },
        ],
        criticalPath: ['WS001', 'WS002', 'WS003'],
      },
      stageGates: {
        gates: [
          { gate: 1, name: 'Gate 1', month: 3, goCriteria: ['Scope complete'] },
          { gate: 2, name: 'Gate 2', month: 6, goCriteria: ['Readiness complete'] },
        ],
      },
    },
    assignments: [{ id: 'A1' }, { id: 'A2' }],
    workstreams: [
      {
        id: 'WS001',
        name: 'Foundation',
        description: 'Setup',
        startMonth: 0,
        endMonth: 1,
        dependencies: [],
        deliverables: [{ id: 'D1', name: 'Plan', dueMonth: 1 }],
      },
      {
        id: 'WS002',
        name: 'Build',
        description: 'Build core',
        startMonth: 2,
        endMonth: 3,
        dependencies: ['WS001'],
        deliverables: [{ id: 'D2', name: 'Build Complete', dueMonth: 3 }],
      },
      {
        id: 'WS003',
        name: 'Launch',
        description: 'Go live',
        startMonth: 4,
        endMonth: 5,
        dependencies: ['WS002'],
        deliverables: [{ id: 'D3', name: 'Launch Complete', dueMonth: 5 }],
      },
    ],
    resources: [{ id: 'R1' }],
    risks: [{ id: 'K1' }],
    benefits: [{ id: 'B1' }],
  };

  return JSON.stringify({
    ...base,
    ...overrides,
  });
}

function validCsvs() {
  return {
    assignmentsCsv: 'ID\nA1\nA2\n',
    workstreamsCsv: 'ID\nWS001\nWS002\nWS003\n',
    resourcesCsv: 'ID\nR1\n',
    risksCsv: 'ID\nK1\n',
    benefitsCsv: 'ID\nB1\n',
  };
}

describe('Export acceptance gates', () => {
  it('passes when all gates are satisfied', () => {
    const report = validateExportAcceptance({
      strategyJson: buildValidStrategyJson(),
      epmJson: buildValidEpmJson(),
      ...validCsvs(),
    });

    expect(report.passed).toBe(true);
    expect(report.criticalIssues).toHaveLength(0);
  });

  it('fails when frameworks do not match journey definition exactly', () => {
    const report = validateExportAcceptance({
      strategyJson: JSON.stringify({
        journeySession: { journeyType: 'business_model_innovation' },
        frameworks: ['five_whys', 'bmc', 'porters'],
      }),
      epmJson: buildValidEpmJson(),
      ...validCsvs(),
    });

    expect(report.passed).toBe(false);
    expect(report.criticalIssues.some((i) => i.code === 'FRAMEWORK_MISMATCH')).toBe(true);
  });

  it('fails when csv and epm section counts diverge', () => {
    const report = validateExportAcceptance({
      strategyJson: buildValidStrategyJson(),
      epmJson: buildValidEpmJson(),
      ...validCsvs(),
      assignmentsCsv: 'ID\nA1\n', // mismatch: epm has 2 assignments
    });

    expect(report.passed).toBe(false);
    expect(report.criticalIssues.some((i) => i.code === 'CSV_JSON_COUNT_MISMATCH')).toBe(true);
  });

  it('presave mode defers CSV parity without failing the gate', () => {
    const report = validateExportAcceptance({
      mode: 'presave',
      strategyJson: buildValidStrategyJson(),
      epmJson: buildValidEpmJson(),
    });

    expect(report.criticalIssues.some((i) => i.code === 'CSV_MISSING')).toBe(false);
    expect(report.warnings.some((i) => i.code === 'PRESAVE_CSV_PARITY_DEFERRED')).toBe(true);
  });

  it('presave mode still enforces framework correctness', () => {
    const report = validateExportAcceptance({
      mode: 'presave',
      strategyJson: JSON.stringify({
        journeySession: { journeyType: 'business_model_innovation' },
        frameworks: ['five_whys', 'bmc', 'porters'],
      }),
      epmJson: buildValidEpmJson(),
    });

    expect(report.passed).toBe(false);
    expect(report.criticalIssues.some((i) => i.code === 'FRAMEWORK_MISMATCH')).toBe(true);
  });

  it('fails when dependency timing or critical path is invalid', () => {
    const epm = JSON.parse(buildValidEpmJson());
    epm.workstreams[1].startMonth = 1; // overlaps dependency WS001 ending at M1
    epm.program.timeline.criticalPath = ['WS002']; // incomplete chain

    const report = validateExportAcceptance({
      strategyJson: buildValidStrategyJson(),
      epmJson: JSON.stringify(epm),
      ...validCsvs(),
    });

    expect(report.passed).toBe(false);
    expect(report.criticalIssues.some((i) => i.code === 'INVALID_DEPENDENCY_TIMING')).toBe(true);
    expect(
      report.criticalIssues.some(
        (i) => i.code === 'CRITICAL_PATH_INCOMPLETE' || i.code === 'CRITICAL_PATH_MISMATCH'
      )
    ).toBe(true);
  });

  it('fails when timeline phase coverage does not span all workstreams', () => {
    const epm = JSON.parse(buildValidEpmJson());
    epm.program.timeline.totalMonths = 8;
    epm.program.timeline.phases = [
      { phase: 1, name: 'P1', startMonth: 0, endMonth: 4, keyMilestones: [], workstreamIds: ['WS001'] },
      { phase: 2, name: 'P2', startMonth: 5, endMonth: 8, keyMilestones: [], workstreamIds: ['WS002'] },
    ];
    epm.workstreams[2].endMonth = 13;

    const report = validateExportAcceptance({
      strategyJson: buildValidStrategyJson(),
      epmJson: JSON.stringify(epm),
      ...validCsvs(),
    });

    expect(report.passed).toBe(false);
    expect(report.criticalIssues.some((i) => i.code === 'TIMELINE_PHASE_COVERAGE')).toBe(true);
  });
});
