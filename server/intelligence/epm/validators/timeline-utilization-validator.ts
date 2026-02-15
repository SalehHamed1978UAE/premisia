import { BaseValidator, ValidatorContext, ValidatorIssue, ValidatorResult } from './base-validator';

export class TimelineUtilizationValidator extends BaseValidator {
  readonly name = 'TimelineUtilizationValidator';
  readonly description = 'Validates timeline utilization and flags long empty tails across phases/gates';

  private readonly minCoverageThreshold = 0.65;
  private readonly criticalCoverageThreshold = 0.5;

  validate(context: ValidatorContext): ValidatorResult {
    const issues: ValidatorIssue[] = [];
    const { workstreams, timeline, stageGates } = context;

    if (!timeline || !Array.isArray(workstreams) || workstreams.length === 0) {
      return this.createResult(true, [], [], { skipped: true, reason: 'Missing timeline or workstreams' });
    }

    const totalMonths = Math.max(1, Number(timeline.totalMonths || 0));
    const maxWorkstreamEnd = Math.max(...workstreams.map((ws) => Number(ws.endMonth || 0)));
    const coverageRatio = (maxWorkstreamEnd + 1) / totalMonths;

    if (coverageRatio < this.minCoverageThreshold) {
      const severity: ValidatorIssue['severity'] =
        coverageRatio < this.criticalCoverageThreshold ? 'error' : 'warning';

      issues.push(
        this.createIssue(
          severity,
          'TIMELINE_UNDER_UTILIZATION',
          `Workstreams cover ${(coverageRatio * 100).toFixed(1)}% of timeline (${maxWorkstreamEnd + 1}/${totalMonths} months)`,
          {
            field: 'timeline.totalMonths',
            suggestion:
              'Distribute execution across later phases or add explicit stabilization/scale workstreams to avoid empty tail months.',
          }
        )
      );
    }

    const phases = timeline.phases || [];
    for (const phase of phases) {
      const phaseStart = Number(phase.startMonth || 0);
      const phaseEnd = Number(phase.endMonth || 0);

      const overlappingWorkstreams = workstreams.filter(
        (ws) => Number(ws.startMonth) <= phaseEnd && Number(ws.endMonth) >= phaseStart
      );

      if (overlappingWorkstreams.length === 0) {
        issues.push(
          this.createIssue(
            'warning',
            'EMPTY_TIMELINE_PHASE',
            `Phase "${phase.name}" (M${phaseStart}-M${phaseEnd}) has no executing workstreams`,
            {
              field: 'timeline.phases',
              suggestion: `Add execution workstreams or convert "${phase.name}" into an explicit buffer phase with rationale.`,
            }
          )
        );
      }
    }

    const gates = stageGates?.gates || [];
    for (const gate of gates) {
      if (!Array.isArray(gate.deliverables) || gate.deliverables.length > 0) {
        continue;
      }

      issues.push(
        this.createIssue(
          'warning',
          'EMPTY_STAGE_GATE_DELIVERABLES',
          `Stage gate "${gate.name}" at M${gate.month} has no linked deliverables`,
          {
            field: 'stageGates.gates.deliverables',
            suggestion: 'Ensure each gate has at least one deliverable or explicitly mark it as buffer-only.',
          }
        )
      );
    }

    const passed = issues.every((issue) => issue.severity !== 'error');
    return this.createResult(passed, issues, [], {
      totalMonths,
      maxWorkstreamEnd,
      coverageRatio,
      phasesChecked: phases.length,
      gatesChecked: gates.length,
    });
  }
}

