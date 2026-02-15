import { BaseValidator, ValidatorContext, ValidatorIssue, ValidatorResult } from './base-validator';

export class TimelineUtilizationValidator extends BaseValidator {
  readonly name = 'TimelineUtilizationValidator';
  readonly description = 'Validates timeline utilization, internal month gaps, and stage gate linkage quality';

  private readonly minCoverageThreshold = 0.65;
  private readonly criticalCoverageThreshold = 0.5;
  private readonly internalGapWarningMonths = 3;
  private readonly internalGapErrorMonths = 6;

  validate(context: ValidatorContext): ValidatorResult {
    const issues: ValidatorIssue[] = [];
    const { workstreams, timeline, stageGates } = context;

    if (!timeline || !Array.isArray(workstreams) || workstreams.length === 0) {
      return this.createResult(true, [], [], { skipped: true, reason: 'Missing timeline or workstreams' });
    }

    const totalMonths = Math.max(1, Number(timeline.totalMonths || 0));
    const maxWorkstreamEnd = Math.max(...workstreams.map((ws) => Number(ws.endMonth || 0)));
    const coverageRatio = (maxWorkstreamEnd + 1) / totalMonths;

    this.validateUtilization(totalMonths, maxWorkstreamEnd, coverageRatio, issues);

    const phases = timeline.phases || [];
    const emptyPhases = this.validatePhaseCoverage(workstreams, phases, issues);

    const gapStats = this.validateInternalGaps(workstreams, totalMonths, issues);

    const gateStats = this.validateStageGateDeliverables(stageGates, workstreams, issues);

    const passed = issues.every((issue) => issue.severity !== 'error');
    return this.createResult(passed, issues, [], {
      totalMonths,
      maxWorkstreamEnd,
      coverageRatio,
      phasesChecked: phases.length,
      emptyPhases,
      gatesChecked: gateStats.gatesChecked,
      emptyGates: gateStats.emptyGates,
      misalignedGates: gateStats.misalignedGates,
      maxConsecutiveInternalGap: gapStats.maxGap,
      internalGapSegments: gapStats.gapSegments,
    });
  }

  private validateUtilization(
    totalMonths: number,
    maxWorkstreamEnd: number,
    coverageRatio: number,
    issues: ValidatorIssue[]
  ): void {
    if (coverageRatio >= this.minCoverageThreshold) return;

    const severity: ValidatorIssue['severity'] =
      coverageRatio < this.criticalCoverageThreshold ? 'error' : 'warning';

    issues.push(
      this.createIssue(
        severity,
        'TIMELINE_UNDER_UTILIZATION',
        `Workstreams cover ${(coverageRatio * 100).toFixed(1)}% of timeline (${maxWorkstreamEnd + 1}/${totalMonths} months)`,
        {
          field: 'timeline.totalMonths',
          suggestion: 'Distribute execution across later phases or add explicit stabilization/scale workstreams to avoid empty tail months.',
        }
      )
    );
  }

  private validatePhaseCoverage(
    workstreams: any[],
    phases: any[],
    issues: ValidatorIssue[]
  ): number {
    let emptyPhases = 0;
    for (const phase of phases) {
      const phaseStart = Number(phase.startMonth || 0);
      const phaseEnd = Number(phase.endMonth || 0);

      const overlappingWorkstreams = workstreams.filter(
        (ws) => Number(ws.startMonth) <= phaseEnd && Number(ws.endMonth) >= phaseStart
      );

      if (overlappingWorkstreams.length === 0) {
        emptyPhases += 1;
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
    return emptyPhases;
  }

  private validateInternalGaps(
    workstreams: any[],
    totalMonths: number,
    issues: ValidatorIssue[]
  ): { maxGap: number; gapSegments: Array<{ start: number; end: number; months: number }> } {
    const activeByMonth = Array(totalMonths).fill(false);

    for (const ws of workstreams) {
      const start = Math.max(0, Number(ws.startMonth || 0));
      const end = Math.min(totalMonths - 1, Number(ws.endMonth || 0));
      for (let m = start; m <= end; m += 1) {
        activeByMonth[m] = true;
      }
    }

    const gapSegments: Array<{ start: number; end: number; months: number }> = [];
    let currentStart: number | null = null;

    for (let month = 0; month < totalMonths; month += 1) {
      if (!activeByMonth[month]) {
        if (currentStart === null) currentStart = month;
      } else if (currentStart !== null) {
        gapSegments.push({ start: currentStart, end: month - 1, months: month - currentStart });
        currentStart = null;
      }
    }

    if (currentStart !== null) {
      gapSegments.push({ start: currentStart, end: totalMonths - 1, months: totalMonths - currentStart });
    }

    // Ignore trailing single-month tails; focus on significant internal continuity breaks.
    const significantGaps = gapSegments.filter((gap) => gap.months >= this.internalGapWarningMonths);
    if (significantGaps.length > 0) {
      const maxGap = Math.max(...significantGaps.map((gap) => gap.months));
      const worstGap = significantGaps[0];
      const severity: ValidatorIssue['severity'] =
        maxGap >= this.internalGapErrorMonths ? 'error' : 'warning';

      issues.push(
        this.createIssue(
          severity,
          'TIMELINE_INTERNAL_GAP',
          `Detected ${significantGaps.length} internal idle gap(s); longest gap is ${maxGap} months (M${worstGap.start}-M${worstGap.end})`,
          {
            field: 'workstreams.startMonth/endMonth',
            suggestion: 'Add bridging workstreams in idle spans or resequence dependencies to keep execution continuity.',
          }
        )
      );
      return { maxGap, gapSegments: significantGaps };
    }

    return { maxGap: 0, gapSegments: [] };
  }

  private validateStageGateDeliverables(
    stageGates: any,
    workstreams: any[],
    issues: ValidatorIssue[]
  ): { gatesChecked: number; emptyGates: number; misalignedGates: number } {
    const gates = stageGates?.gates || [];
    const workstreamById = new Map(workstreams.map((ws) => [ws.id, ws]));

    let emptyGates = 0;
    let misalignedGates = 0;

    for (const gate of gates) {
      const deliverables = Array.isArray(gate.deliverables) ? gate.deliverables : [];
      if (deliverables.length === 0) {
        emptyGates += 1;
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
        continue;
      }

      const referencedWorkstreams = deliverables
        .map((value: string) => workstreamById.get(value))
        .filter((ws: any) => Boolean(ws));

      if (referencedWorkstreams.length === 0) {
        continue;
      }

      const gateMonth = Number(gate.month || 0);
      const hasAlignedWorkstream = referencedWorkstreams.some(
        (ws: any) => Number(ws.startMonth) <= gateMonth && Number(ws.endMonth) >= gateMonth
      );

      if (!hasAlignedWorkstream) {
        misalignedGates += 1;
        issues.push(
          this.createIssue(
            'warning',
            'STAGE_GATE_DELIVERABLE_MISALIGNED',
            `Stage gate "${gate.name}" at M${gateMonth} links deliverables/workstreams outside gate window`,
            {
              field: 'stageGates.gates.deliverables',
              suggestion: 'Link each gate to workstreams active at that gate month.',
            }
          )
        );
      }
    }

    return { gatesChecked: gates.length, emptyGates, misalignedGates };
  }
}
