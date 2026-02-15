import { BaseValidator, ValidatorContext, ValidatorIssue, ValidatorResult } from './base-validator';

export class TimelineUtilizationValidator extends BaseValidator {
  readonly name = 'TimelineUtilizationValidator';
  readonly description = 'Validates timeline utilization, phase coverage, and stage gate completeness';

  validate(context: ValidatorContext): ValidatorResult {
    const issues: ValidatorIssue[] = [];
    const { workstreams, timeline, stageGates } = context;

    if (!timeline || !workstreams.length) {
      return this.createResult(true, issues);
    }

    this.validateUtilization(workstreams, timeline, issues);
    this.validatePhaseCoverage(workstreams, timeline, issues);
    this.validateStageGateDeliverables(stageGates, issues);

    return this.createResult(
      issues.filter(i => i.severity === 'error').length === 0,
      issues
    );
  }

  private validateUtilization(workstreams: any[], timeline: any, issues: ValidatorIssue[]): void {
    const totalMonths = timeline.totalMonths || 24;
    const maxEndMonth = Math.max(...workstreams.map(ws => ws.endMonth || 0));
    const utilizationPct = (maxEndMonth / totalMonths) * 100;

    if (utilizationPct < 75) {
      issues.push(this.createIssue(
        'warning',
        'TIMELINE_UNDER_UTILIZATION',
        `Workstreams cover ${utilizationPct.toFixed(1)}% of timeline (${maxEndMonth}/${totalMonths} months)`,
        {
          field: 'timeline.totalMonths',
          suggestion: 'Distribute execution across later phases or add explicit stabilization/scale workstreams to avoid empty tail months.',
        }
      ));
    }
  }

  private validatePhaseCoverage(workstreams: any[], timeline: any, issues: ValidatorIssue[]): void {
    const phases = timeline.phases || [];

    for (const phase of phases) {
      const phaseStart = phase.startMonth ?? 0;
      const phaseEnd = phase.endMonth ?? 0;

      const hasWorkstreams = workstreams.some(ws =>
        (ws.startMonth ?? 0) < phaseEnd && (ws.endMonth ?? 0) > phaseStart
      );

      if (!hasWorkstreams) {
        issues.push(this.createIssue(
          'warning',
          'EMPTY_TIMELINE_PHASE',
          `Phase "${phase.name}" (M${phaseStart}-M${phaseEnd}) has no executing workstreams`,
          {
            field: 'timeline.phases',
            suggestion: `Add execution workstreams or convert "${phase.name}" into an explicit buffer phase with rationale.`,
          }
        ));
      }
    }
  }

  private validateStageGateDeliverables(stageGates: any, issues: ValidatorIssue[]): void {
    const gates = stageGates?.gates || [];

    for (const gate of gates) {
      const deliverables = gate.deliverables || [];
      if (deliverables.length === 0) {
        issues.push(this.createIssue(
          'warning',
          'EMPTY_STAGE_GATE_DELIVERABLES',
          `Stage gate "${gate.name}" at M${gate.month} has no linked deliverables`,
          {
            field: 'stageGates.gates.deliverables',
            suggestion: 'Ensure each gate has at least one deliverable or explicitly mark it as buffer-only.',
          }
        ));
      }
    }
  }
}
