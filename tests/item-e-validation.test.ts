/**
 * Item E Test Vectors — WBS Validator Accuracy in validation.json
 *
 * Tests that acceptance-gates.ts correctly maps WBSTimelineValidator
 * issues to individual AcceptanceIssues (not just a generic errorCount).
 *
 * @agent Agent-6
 * @sprint Sprint 1 - Item E
 */

import { describe, expect, it } from 'vitest';
import { validateExportAcceptance } from '../server/services/export/acceptance-gates';

function buildStrategyJson(): string {
  return JSON.stringify({
    understanding: { id: 'u1', title: 'Test Program', userInput: 'Test' },
    journeySession: { journeyType: 'business_model_innovation' },
    frameworks: ['five_whys', 'bmc'],
  });
}

function buildCleanEpmJson(): string {
  return JSON.stringify({
    program: {
      timeline: {
        totalMonths: 6,
        phases: [
          { phase: 1, name: 'P1', startMonth: 0, endMonth: 3, keyMilestones: [], workstreamIds: ['WS001', 'WS002'] },
          { phase: 2, name: 'P2', startMonth: 4, endMonth: 6, keyMilestones: [], workstreamIds: ['WS003'] },
        ],
        criticalPath: ['WS001', 'WS002', 'WS003'],
      },
      stageGates: { gates: [] },
    },
    assignments: [{ id: 'A1' }],
    workstreams: [
      { id: 'WS001', name: 'Foundation', description: 'Setup', startMonth: 0, endMonth: 1, phase: 'P1', dependencies: [], deliverables: [{ id: 'D1', name: 'Plan', dueMonth: 1 }] },
      { id: 'WS002', name: 'Build', description: 'Build core', startMonth: 2, endMonth: 3, phase: 'P1', dependencies: ['WS001'], deliverables: [{ id: 'D2', name: 'Build Complete', dueMonth: 3 }] },
      { id: 'WS003', name: 'Launch', description: 'Go live', startMonth: 4, endMonth: 5, phase: 'P2', dependencies: ['WS002'], deliverables: [{ id: 'D3', name: 'Launch Complete', dueMonth: 5 }] },
    ],
    resources: [{ id: 'R1' }],
    risks: [{ id: 'K1' }],
    benefits: [{ id: 'B1' }],
  });
}

function csvs() {
  return {
    assignmentsCsv: 'ID\nA1\n',
    workstreamsCsv: 'ID\nWS001\nWS002\nWS003\n',
    resourcesCsv: 'ID\nR1\n',
    risksCsv: 'ID\nK1\n',
    benefitsCsv: 'ID\nB1\n',
  };
}

describe('Item E — WBS Validator Accuracy in AcceptanceReport', () => {

  // TV1: Clean data — regression test (expect 0 WBS issues, passed: true)
  it('TV1: Clean WBS data produces passed: true with no WBS issues', () => {
    const report = validateExportAcceptance({
      strategyJson: buildStrategyJson(),
      epmJson: buildCleanEpmJson(),
      ...csvs(),
    });

    expect(report.passed).toBe(true);
    expect(report.criticalIssues).toHaveLength(0);
    // No WBS-specific issues should appear
    const wbsIssues = report.criticalIssues.filter(i => i.code.startsWith('WBS_'));
    expect(wbsIssues).toHaveLength(0);
  });

  // TV2: Injected containment violation — workstream exceeds program timeline
  it('TV2: Containment violation produces individual WBS critical issue', () => {
    const epm = JSON.parse(buildCleanEpmJson());
    // WS003 endMonth=10 exceeds totalMonths=6 → containment violation
    epm.workstreams[2].endMonth = 10;

    const report = validateExportAcceptance({
      strategyJson: buildStrategyJson(),
      epmJson: JSON.stringify(epm),
      ...csvs(),
    });

    // Should have WBS containment issue
    const wbsContainment = report.criticalIssues.filter(i => i.code === 'WBS_CONTAINMENT_PROGRAM');
    expect(wbsContainment.length).toBeGreaterThanOrEqual(1);
    // Should include validator name in message
    expect(wbsContainment[0].message).toContain('[WBS Timeline Validator]');
    // Should include workstreamId in details
    expect(wbsContainment[0].details?.workstreamId).toBe('WS003');
    // Gate should fail
    expect(report.passed).toBe(false);
  });

  // TV3: Injected date range error — endMonth before startMonth
  it('TV3: Date range error (endMonth < startMonth) produces WBS_DATE_RANGE issue', () => {
    const epm = JSON.parse(buildCleanEpmJson());
    // WS002 has endMonth before startMonth
    epm.workstreams[1].startMonth = 5;
    epm.workstreams[1].endMonth = 2;

    const report = validateExportAcceptance({
      strategyJson: buildStrategyJson(),
      epmJson: JSON.stringify(epm),
      ...csvs(),
    });

    const dateRangeIssues = report.criticalIssues.filter(i => i.code === 'WBS_DATE_RANGE');
    expect(dateRangeIssues.length).toBeGreaterThanOrEqual(1);
    expect(dateRangeIssues[0].message).toContain('[WBS Timeline Validator]');
    expect(dateRangeIssues[0].details?.validatorName).toBe('WBS Timeline Validator');
    expect(report.passed).toBe(false);
  });

  // TV4: Deliverable outside parent workstream boundaries
  it('TV4: Deliverable containment violation produces WBS_CONTAINMENT_DELIVERABLE issue', () => {
    const epm = JSON.parse(buildCleanEpmJson());
    // Deliverable due month 8 exceeds WS001 endMonth=1
    epm.workstreams[0].deliverables[0].dueMonth = 8;

    const report = validateExportAcceptance({
      strategyJson: buildStrategyJson(),
      epmJson: JSON.stringify(epm),
      ...csvs(),
    });

    const deliverableIssues = report.criticalIssues.filter(i => i.code === 'WBS_CONTAINMENT_DELIVERABLE');
    expect(deliverableIssues.length).toBeGreaterThanOrEqual(1);
    expect(deliverableIssues[0].message).toContain('[WBS Timeline Validator]');
    expect(report.passed).toBe(false);
  });

  // TV5: Multiple simultaneous violations (3+ issues)
  it('TV5: Multiple violations produce individual issues (not one aggregate)', () => {
    const epm = JSON.parse(buildCleanEpmJson());
    // Violation 1: WS001 endMonth before startMonth
    epm.workstreams[0].startMonth = 3;
    epm.workstreams[0].endMonth = 1;
    // Violation 2: WS003 exceeds program timeline
    epm.workstreams[2].endMonth = 10;
    // Violation 3: WS002 depends on non-existent workstream
    epm.workstreams[1].dependencies = ['WS999'];

    const report = validateExportAcceptance({
      strategyJson: buildStrategyJson(),
      epmJson: JSON.stringify(epm),
      ...csvs(),
    });

    // Should have multiple distinct WBS issues
    const wbsIssues = report.criticalIssues.filter(i => i.code.startsWith('WBS_'));
    expect(wbsIssues.length).toBeGreaterThanOrEqual(3);

    // Verify each has different codes
    const codes = wbsIssues.map(i => i.code);
    expect(codes).toContain('WBS_DATE_RANGE');
    expect(codes).toContain('WBS_CONTAINMENT_PROGRAM');
    expect(codes).toContain('WBS_DEPENDENCY_MISSING');

    // Each should have validator name in message
    for (const issue of wbsIssues) {
      expect(issue.message).toContain('[WBS Timeline Validator]');
      expect(issue.details?.validatorName).toBe('WBS Timeline Validator');
    }

    // Gate should fail
    expect(report.passed).toBe(false);
  });

  // TV6: Dependency errors — missing reference
  it('TV6: Dependency reference to non-existent workstream produces WBS_DEPENDENCY_MISSING', () => {
    const epm = JSON.parse(buildCleanEpmJson());
    // WS002 depends on non-existent WS999
    epm.workstreams[1].dependencies = ['WS999'];

    const report = validateExportAcceptance({
      strategyJson: buildStrategyJson(),
      epmJson: JSON.stringify(epm),
      ...csvs(),
    });

    const depMissing = report.criticalIssues.filter(i => i.code === 'WBS_DEPENDENCY_MISSING');
    expect(depMissing.length).toBeGreaterThanOrEqual(1);
    expect(depMissing[0].message).toContain('WS999');
    expect(depMissing[0].details?.validatorName).toBe('WBS Timeline Validator');
    expect(report.passed).toBe(false);
  });

  // Verify warnings/info are in warnings array (not criticalIssues)
  it('Phase alignment warnings appear in warnings array, not criticalIssues', () => {
    const epm = JSON.parse(buildCleanEpmJson());
    // WS001 assigned to phase P1 but timeline (0-1) doesn't fully fit phase P2 (4-6)
    // Force a phase mismatch by changing phase assignment
    epm.workstreams[2].phase = 'P1'; // WS003 (month 4-5) assigned to P1 (month 0-3) — misaligned

    const report = validateExportAcceptance({
      strategyJson: buildStrategyJson(),
      epmJson: JSON.stringify(epm),
      ...csvs(),
    });

    // Phase alignment issues are warnings (not errors), so should be in warnings array
    const phaseWarnings = report.warnings.filter(i =>
      i.code === 'WBS_PHASE_ALIGNMENT' || i.code === 'WBS_PHASE_MISMATCH'
    );
    expect(phaseWarnings.length).toBeGreaterThanOrEqual(1);
    expect(phaseWarnings[0].details?.originalSeverity).toBe('warning');
  });

  // Verify old generic VALIDATOR_CRITICAL_ISSUES code is no longer emitted
  it('No longer emits generic VALIDATOR_CRITICAL_ISSUES code', () => {
    const epm = JSON.parse(buildCleanEpmJson());
    epm.workstreams[2].endMonth = 10; // Trigger a real error

    const report = validateExportAcceptance({
      strategyJson: buildStrategyJson(),
      epmJson: JSON.stringify(epm),
      ...csvs(),
    });

    const genericIssues = report.criticalIssues.filter(i => i.code === 'VALIDATOR_CRITICAL_ISSUES');
    expect(genericIssues).toHaveLength(0);
    // Instead, should have specific WBS codes
    const wbsIssues = report.criticalIssues.filter(i => i.code.startsWith('WBS_'));
    expect(wbsIssues.length).toBeGreaterThan(0);
  });
});
