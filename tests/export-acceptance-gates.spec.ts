import { describe, expect, it } from 'vitest';
import { validateExportAcceptance } from '../server/services/export/acceptance-gates';
import { buildStrategyJsonPayload } from '../server/services/export/json-payloads';

function buildValidStrategyJson(): string {
  return JSON.stringify({
    understanding: { id: 'u1', userInput: 'Open a Thai cafe for workers' },
    journeySession: {
      journeyType: 'business_model_innovation',
    },
    frameworks: ['five_whys', 'bmc'],
    whysPath: [
      'Workers lack high-quality meal options near shifts',
      'Remote location reduces quality food access',
      'Existing cafeterias prioritize volume over quality',
      'No focused operator serves this segment with Thai menu fit',
    ],
  });
}

function buildValidEpmJson(overrides: Record<string, any> = {}): string {
  const base = {
    program: {
      timeline: {
        totalMonths: 6,
        phases: [
          { phase: 1, name: 'P1', startMonth: 1, endMonth: 3, keyMilestones: [], workstreamIds: ['WS001', 'WS002'] },
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
        startMonth: 1,
        endMonth: 2,
        dependencies: [],
        deliverables: [{ id: 'D1', name: 'Plan', dueMonth: 2 }],
      },
      {
        id: 'WS002',
        name: 'Build',
        description: 'Build core',
        startMonth: 3,
        endMonth: 4,
        dependencies: ['WS001'],
        deliverables: [{ id: 'D2', name: 'Build Complete', dueMonth: 4 }],
      },
      {
        id: 'WS003',
        name: 'Launch',
        description: 'Go live',
        startMonth: 5,
        endMonth: 6,
        dependencies: ['WS002'],
        deliverables: [{ id: 'D3', name: 'Launch Complete', dueMonth: 6 }],
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

  it('fails when whysPath is incomplete for five-whys journeys', () => {
    const report = validateExportAcceptance({
      strategyJson: JSON.stringify({
        journeySession: { journeyType: 'business_model_innovation' },
        frameworks: ['five_whys', 'bmc'],
        whysPath: ['Why?', 'Why?', 'Why?'],
      }),
      epmJson: buildValidEpmJson(),
      ...validCsvs(),
    });

    expect(report.passed).toBe(false);
    expect(report.criticalIssues.some((i) => i.code === 'WHYS_PATH_INCOMPLETE')).toBe(true);
  });

  it('fails when top-level and nested five-whys paths diverge', () => {
    const report = validateExportAcceptance({
      strategyJson: JSON.stringify({
        journeySession: { journeyType: 'business_model_innovation' },
        frameworks: ['five_whys', 'bmc'],
        whysPath: [
          'canonical step 1',
          'canonical step 2',
          'canonical step 3',
          'canonical step 4',
        ],
        strategyVersion: {
          analysisData: {
            five_whys: {
              whysPath: [
                'drift step 1',
                'drift step 2',
                'drift step 3',
                'drift step 4',
              ],
            },
          },
        },
      }),
      epmJson: buildValidEpmJson(),
      ...validCsvs(),
    });

    expect(report.passed).toBe(false);
    expect(report.criticalIssues.some((i) => i.code === 'WHYS_PATH_SOURCE_MISMATCH')).toBe(true);
  });

  it('auto-heals nested five-whys path to canonical top-level path in strategy payload build', () => {
    const payload = buildStrategyJsonPayload({
      journeySession: { journeyType: 'business_model_innovation' },
      whysPath: ['canon 1', 'canon 2', 'canon 3', 'canon 4'],
      strategyVersion: {
        analysisData: {
          five_whys: {
            whysPath: ['drift 1', 'drift 2', 'drift 3', 'drift 4'],
          },
        },
      },
    } as any);

    expect(payload.whysPath).toEqual(['canon 1', 'canon 2', 'canon 3', 'canon 4']);
    expect(payload.strategyVersion.analysisData.five_whys.whysPath).toEqual([
      'canon 1',
      'canon 2',
      'canon 3',
      'canon 4',
    ]);
  });

  it('fails when report tree chosen path and summary path diverge', () => {
    const report = validateExportAcceptance({
      strategyJson: buildValidStrategyJson(),
      epmJson: buildValidEpmJson(),
      ...validCsvs(),
      reportMarkdown: [
        '## Five Whys - Complete Analysis Tree',
        '1. **tree_step_1** ✓ (Chosen path)',
        '2. **tree_step_2** ✓ (Chosen path)',
        '',
        '## Five Whys - Chosen Path Summary',
        '1. **Why?** Why 1?',
        '   **Answer:** summary_step_1',
        '2. **Why?** Why 2?',
        '   **Answer:** summary_step_2',
      ].join('\n'),
    });

    expect(report.passed).toBe(false);
    expect(report.criticalIssues.some((i) => i.code === 'REPORT_WHYS_PATH_MISMATCH')).toBe(true);
  });

  it('fails when report chosen-path summary diverges from canonical strategy whysPath', () => {
    const report = validateExportAcceptance({
      strategyJson: buildValidStrategyJson(),
      epmJson: buildValidEpmJson(),
      ...validCsvs(),
      reportMarkdown: [
        '## Five Whys - Chosen Path Summary',
        '1. **Why?** Why 1?',
        '   **Answer:** drift_step_1',
        '2. **Why?** Why 2?',
        '   **Answer:** drift_step_2',
        '3. **Why?** Why 3?',
        '   **Answer:** drift_step_3',
        '4. **Why?** Why 4?',
        '   **Answer:** drift_step_4',
      ].join('\n'),
    });

    expect(report.passed).toBe(false);
    expect(report.criticalIssues.some((i) => i.code === 'REPORT_WHYS_CANONICAL_MISMATCH')).toBe(true);
  });

  it('warns (but does not fail) when Five Whys tree has no chosen-path markers', () => {
    const report = validateExportAcceptance({
      strategyJson: buildValidStrategyJson(),
      epmJson: buildValidEpmJson(),
      ...validCsvs(),
      reportMarkdown: [
        '## Five Whys - Complete Analysis Tree',
        '1. **Workers lack high-quality meal options near shifts**',
        '2. **Remote location reduces quality food access**',
        '',
        '## Five Whys - Chosen Path Summary',
        '1. **Why?** Why 1?',
        '   **Answer:** Workers lack high-quality meal options near shifts',
        '2. **Why?** Why 2?',
        '   **Answer:** Remote location reduces quality food access',
        '3. **Why?** Why 3?',
        '   **Answer:** Existing cafeterias prioritize volume over quality',
        '4. **Why?** Why 4?',
        '   **Answer:** No focused operator serves this segment with Thai menu fit',
      ].join('\n'),
    });

    expect(report.passed).toBe(true);
    expect(report.warnings.some((i) => i.code === 'REPORT_WHYS_TREE_MARKERS_MISSING')).toBe(true);
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

  it('fails when dependency timing or critical path is invalid', () => {
    const epm = JSON.parse(buildValidEpmJson());
    epm.workstreams[1].startMonth = 2; // overlaps dependency WS001 ending at M2
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
    epm.program.timeline.totalMonths = 9;
    epm.program.timeline.phases = [
      { phase: 1, name: 'P1', startMonth: 1, endMonth: 4, keyMilestones: [], workstreamIds: ['WS001'] },
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

  it('fails when workstream has zero timeline', () => {
    const epm = JSON.parse(buildValidEpmJson());
    epm.workstreams[0].startMonth = 0;
    epm.workstreams[0].endMonth = 0;

    const report = validateExportAcceptance({
      strategyJson: buildValidStrategyJson(),
      epmJson: JSON.stringify(epm),
      ...validCsvs(),
    });

    expect(report.passed).toBe(false);
    expect(report.criticalIssues.some((i) => i.code === 'ZERO_TIMELINE')).toBe(true);
  });

  it('fails when assignment month falls outside workstream range', () => {
    const report = validateExportAcceptance({
      strategyJson: buildValidStrategyJson(),
      epmJson: buildValidEpmJson(),
      assignmentsCsv: [
        'Task ID,Workstream ID,Start Month,End Month',
        'WS001-D1,WS001,Month 1,Month 5',
        'WS002-D1,WS002,Month 3,Month 4',
      ].join('\n'),
      workstreamsCsv: [
        'Workstream ID,Start Date,End Date',
        'WS001,Month 1,Month 2',
        'WS002,Month 3,Month 4',
        'WS003,Month 5,Month 6',
      ].join('\n'),
      resourcesCsv: 'ID\nR1\n',
      risksCsv: 'ID\nK1\n',
      benefitsCsv: 'ID\nB1\n',
    });

    expect(report.passed).toBe(false);
    expect(report.criticalIssues.some((i) => i.code === 'ASSIGNMENT_RANGE_INVALID')).toBe(true);
  });

  it('fails when dependencies point from earlier-stage work to later-stage prerequisites', () => {
    const epm = JSON.parse(buildValidEpmJson());
    epm.workstreams = [
      { id: 'WS001', name: 'Core Platform Build', startMonth: 1, endMonth: 4, dependencies: [], deliverables: [] },
      { id: 'WS002', name: 'Requirements Discovery and Analysis', startMonth: 1, endMonth: 2, dependencies: ['WS001'], deliverables: [] },
      { id: 'WS003', name: 'Launch Readiness', startMonth: 5, endMonth: 6, dependencies: ['WS001'], deliverables: [] },
    ];
    epm.program.timeline = {
      totalMonths: 6,
      phases: [{ phase: 1, name: 'P1', startMonth: 1, endMonth: 6, keyMilestones: [], workstreamIds: ['WS001', 'WS002', 'WS003'] }],
      criticalPath: ['WS002', 'WS001', 'WS003'],
    };

    const report = validateExportAcceptance({
      strategyJson: JSON.stringify({
        understanding: { userInput: 'Build a new internal SaaS platform' },
        journeySession: { journeyType: 'business_model_innovation' },
        frameworks: ['five_whys', 'bmc'],
        whysPath: ['A', 'B', 'C', 'D'],
      }),
      epmJson: JSON.stringify(epm),
      assignmentsCsv: 'ID\nA1\nA2\n',
      workstreamsCsv: 'ID\nWS001\nWS002\nWS003\n',
      resourcesCsv: 'ID\nR1\n',
      risksCsv: 'ID\nK1\n',
      benefitsCsv: 'ID\nB1\n',
    });

    expect(report.passed).toBe(false);
    expect(report.criticalIssues.some((i) => i.code === 'SEQUENCING_DEPENDENCY_INVERSION')).toBe(true);
  });

  it('fails when placeholder corruption is present in report content', () => {
    const report = validateExportAcceptance({
      strategyJson: buildValidStrategyJson(),
      epmJson: buildValidEpmJson(),
      ...validCsvs(),
      reportMarkdown: 'Owner: undefined',
    });

    expect(report.passed).toBe(false);
    expect(report.criticalIssues.some((i) => i.code === 'PLACEHOLDER_CORRUPTION')).toBe(true);
  });

  it('fails when technology programs include restaurant-only resource skills', () => {
    const epm = JSON.parse(buildValidEpmJson());
    epm.resources = [
      { id: 'R1', role: 'AI Compliance Lead', skills: ['food safety', 'policy controls'] },
    ];

    const report = validateExportAcceptance({
      strategyJson: JSON.stringify({
        understanding: {
          title: 'Launch AI Automation Platform',
          initiativeDescription: 'Build agentic AI platform for enterprise workflows',
          userInput: 'Start AI SaaS for workflow automation',
        },
        journeySession: { journeyType: 'business_model_innovation' },
        frameworks: ['five_whys', 'bmc'],
        whysPath: ['A', 'B', 'C', 'D'],
      }),
      epmJson: JSON.stringify(epm),
      ...validCsvs(),
    });

    expect(report.passed).toBe(false);
    expect(report.criticalIssues.some((i) => i.code === 'DOMAIN_SKILL_LEAKAGE')).toBe(true);
  });

  it('fails when service/generic initiatives drift into software-product build workstreams', () => {
    const epm = JSON.parse(buildValidEpmJson());
    epm.workstreams = [
      { id: 'WS001', name: 'Build SaaS Platform Product Core', startMonth: 1, endMonth: 3, dependencies: [], deliverables: [] },
      { id: 'WS002', name: 'Launch Application Platform to Market', startMonth: 4, endMonth: 6, dependencies: ['WS001'], deliverables: [] },
    ];
    epm.program.timeline = {
      totalMonths: 6,
      phases: [
        { phase: 1, name: 'P1', startMonth: 1, endMonth: 3, keyMilestones: [], workstreamIds: ['WS001'] },
        { phase: 2, name: 'P2', startMonth: 4, endMonth: 6, keyMilestones: [], workstreamIds: ['WS002'] },
      ],
      criticalPath: ['WS001', 'WS002'],
    };

    const report = validateExportAcceptance({
      strategyJson: JSON.stringify({
        understanding: {
          initiativeType: 'service_launch',
          userInput: 'Launch an AI transformation agency for mid-market clients',
        },
        journeySession: { journeyType: 'business_model_innovation' },
        frameworks: ['five_whys', 'bmc'],
        whysPath: ['s1', 's2', 's3', 's4'],
      }),
      epmJson: JSON.stringify(epm),
      ...validCsvs(),
    });

    expect(report.passed).toBe(false);
    expect(report.criticalIssues.some((i) => i.code === 'DOMAIN_WORKSTREAM_DRIFT')).toBe(true);
  });
});
