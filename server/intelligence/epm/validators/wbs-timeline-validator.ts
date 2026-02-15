/**
 * WBS Timeline Validator
 *
 * Sprint 1 (P2 Scheduling) validator for WBS structural integrity:
 * 1. Parent-child containment: All child tasks/workstreams within parent date ranges
 * 2. Dependency normalization: Validate dependency references exist, detect cycles
 * 3. Phase alignment: Workstreams assigned to correct phase boundaries
 *
 * This validator ensures WBS exports are structurally sound before generation.
 *
 * @author Agent-6
 * @sprint Sprint 1 - Integrity + Coherence
 */

import { BaseValidator, ValidatorContext, ValidatorResult, ValidatorIssue } from './base-validator';
import type { Workstream, Timeline, Phase } from '../../types';

interface DependencyGraph {
  [workstreamId: string]: string[];
}

export class WBSTimelineValidator extends BaseValidator {
  readonly name = 'WBS Timeline Validator';
  readonly description = 'Validates parent-child containment, dependency normalization, and phase alignment';

  validate(context: ValidatorContext): ValidatorResult {
    const issues: ValidatorIssue[] = [];
    const corrections: string[] = [];

    // Validation 1: Parent-child containment
    const containmentIssues = this.validateParentChildContainment(context.workstreams, context.timeline);
    issues.push(...containmentIssues);

    // Validation 2: Dependency normalization and cycle detection
    const dependencyIssues = this.validateDependencyNormalization(context.workstreams);
    issues.push(...dependencyIssues);

    // Validation 3: Phase alignment
    const phaseIssues = this.validatePhaseAlignment(context.workstreams, context.timeline);
    issues.push(...phaseIssues);

    // Determine if validation passed (no errors, warnings are ok)
    const passed = issues.filter(i => i.severity === 'error').length === 0;

    // Generate corrections summary
    if (!passed) {
      corrections.push(
        `WBS timeline validation found ${issues.filter(i => i.severity === 'error').length} errors that must be fixed`
      );
    }

    return this.createResult(passed, issues, corrections, {
      containmentIssuesCount: containmentIssues.length,
      dependencyIssuesCount: dependencyIssues.length,
      phaseIssuesCount: phaseIssues.length,
    });
  }

  /**
   * Validation 1: Parent-child containment
   *
   * Ensures all deliverables fall within their parent workstream date ranges,
   * and all workstreams fall within their parent phase date ranges.
   */
  private validateParentChildContainment(workstreams: Workstream[], timeline: Timeline): ValidatorIssue[] {
    const issues: ValidatorIssue[] = [];

    for (const workstream of workstreams) {
      const wsStart = Number(workstream.startMonth);
      const wsEnd = Number(workstream.endMonth);
      if (!Number.isFinite(wsStart) || !Number.isFinite(wsEnd)) {
        continue;
      }

      if (wsEnd < wsStart) {
        issues.push(
          this.createIssue(
            'error',
            'WBS_DATE_RANGE',
            `Workstream "${workstream.name}" has endMonth before startMonth (${workstream.startMonth} to ${workstream.endMonth})`,
            {
              workstreamId: workstream.id,
              field: 'startMonth,endMonth',
              suggestion: 'Ensure workstream endMonth is not before startMonth',
            }
          )
        );
      }

      // Check if workstream falls within program timeline (totalMonths)
      const totalMonths = Number(timeline.totalMonths);
      if (Number.isFinite(totalMonths) && totalMonths > 0) {
        if (wsStart < 0 || wsEnd > totalMonths) {
          issues.push(
            this.createIssue(
              'error',
              'WBS_CONTAINMENT_PROGRAM',
              `Workstream "${workstream.name}" (${workstream.startMonth} to ${workstream.endMonth}) falls outside program timeline (0 to ${totalMonths})`,
              {
                workstreamId: workstream.id,
                field: 'startMonth,endMonth',
                suggestion: `Adjust workstream dates to fall within 0 to ${totalMonths}`,
              }
            )
          );
        }
      }

      // Check deliverables fall within workstream dates
      if (workstream.deliverables && Array.isArray(workstream.deliverables)) {
        for (const deliverable of workstream.deliverables) {
          if (deliverable.dueMonth !== undefined) {
            const dueMonth = Number(deliverable.dueMonth);
            if (!Number.isFinite(dueMonth)) {
              continue;
            }
            if (dueMonth < wsStart || dueMonth > wsEnd) {
              issues.push(
                this.createIssue(
                  'error',
                  'WBS_CONTAINMENT_DELIVERABLE',
                  `Deliverable "${deliverable.name}" due ${deliverable.dueMonth} falls outside parent workstream "${workstream.name}" (${workstream.startMonth} to ${workstream.endMonth})`,
                  {
                    workstreamId: workstream.id,
                    field: 'deliverables.dueMonth',
                    suggestion: `Adjust deliverable due date to fall within ${workstream.startMonth} to ${workstream.endMonth}`,
                  }
                )
              );
            }
          }
        }
      }
    }

    return issues;
  }

  /**
   * Validation 2: Dependency normalization
   *
   * Ensures all dependency references exist and detects circular dependencies.
   */
  private validateDependencyNormalization(workstreams: Workstream[]): ValidatorIssue[] {
    const issues: ValidatorIssue[] = [];

    // Build workstream ID map for validation
    const workstreamIds = new Set(workstreams.map(ws => ws.id));

    // Build dependency graph for cycle detection
    const dependencyGraph: DependencyGraph = {};

    for (const workstream of workstreams) {
      dependencyGraph[workstream.id] = [];

      // Validate dependency references
      const rawDeps = (workstream as any).dependencies;
      const normalizedDeps = Array.isArray(rawDeps)
        ? rawDeps
        : typeof rawDeps === 'string'
          ? rawDeps.split(/[;,]/).map((d) => d.trim()).filter(Boolean)
          : [];
      if (normalizedDeps.length > 0) {
        (workstream as any).dependencies = normalizedDeps;
        for (const dep of normalizedDeps) {
          const depId = typeof dep === 'string' ? dep.trim() : dep;

          // Check if dependency exists
          if (!workstreamIds.has(depId)) {
            issues.push(
              this.createIssue(
                'error',
                'WBS_DEPENDENCY_MISSING',
                `Workstream "${workstream.name}" has dependency "${depId}" that does not exist`,
                {
                  workstreamId: workstream.id,
                  field: 'dependencies',
                  suggestion: `Remove invalid dependency "${depId}" or ensure the referenced workstream exists`,
                }
              )
            );
          } else {
            // Add to graph for cycle detection
            dependencyGraph[workstream.id].push(depId);
          }
        }
      }
    }

    // Detect circular dependencies
    const cycles = this.detectCycles(dependencyGraph);
    for (const cycle of cycles) {
      issues.push(
        this.createIssue(
          'error',
          'WBS_DEPENDENCY_CYCLE',
          `Circular dependency detected: ${cycle.join(' → ')} → ${cycle[0]}`,
          {
            field: 'dependencies',
            suggestion: `Break the circular dependency by removing one of the dependency links in the cycle`,
          }
        )
      );
    }

    return issues;
  }

  /**
   * Validation 3: Phase alignment
   *
   * Ensures workstreams are assigned to phases that contain their timeline.
   */
  private validatePhaseAlignment(workstreams: Workstream[], timeline: Timeline): ValidatorIssue[] {
    const issues: ValidatorIssue[] = [];

    // Only validate if phases are defined
    if (!timeline.phases || timeline.phases.length === 0) {
      return issues;
    }

    const phases = timeline.phases;
    phases.forEach((phase: any) => {
      const phaseStart = Number(phase.startMonth);
      const phaseEnd = Number(phase.endMonth);
      if (!Number.isFinite(phaseStart) || !Number.isFinite(phaseEnd)) {
        return;
      }
      if (phaseEnd < phaseStart) {
        issues.push(
          this.createIssue(
            'error',
            'WBS_PHASE_RANGE',
            `Phase "${phase.name}" has endMonth before startMonth (${phase.startMonth} to ${phase.endMonth})`,
            {
              field: 'timeline.phases',
              suggestion: 'Ensure phase endMonth is not before startMonth',
            }
          )
        );
      }
    });

    for (const workstream of workstreams) {
      const wsStart = Number(workstream.startMonth);
      const wsEnd = Number(workstream.endMonth);
      if (!Number.isFinite(wsStart) || !Number.isFinite(wsEnd)) {
        continue;
      }

      // A workstream can legitimately span multiple phases. Use overlap-based matching
      // (same boundary model as timeline generation) instead of strict containment.
      const overlappingPhases = phases
        .map((phase: any) => {
          const phaseStart = Number(phase.startMonth);
          const phaseEnd = Number(phase.endMonth);
          if (!Number.isFinite(phaseStart) || !Number.isFinite(phaseEnd)) return null;
          const overlapMonths = this.computeMonthOverlap(wsStart, wsEnd, phaseStart, phaseEnd);
          if (overlapMonths <= 0) return null;
          return { phase, overlapMonths };
        })
        .filter((item): item is { phase: Phase; overlapMonths: number } => item !== null);

      if (!workstream.phase) {
        continue;
      }

      if (overlappingPhases.length === 0) {
        issues.push(
          this.createIssue(
            'warning',
            'WBS_PHASE_ALIGNMENT',
            `Workstream "${workstream.name}" is assigned to phase "${workstream.phase}" but its timeline (${wsStart} to ${wsEnd}) does not overlap any defined phase`,
            {
              workstreamId: workstream.id,
              field: 'phase',
              suggestion: `Review phase assignment or adjust workstream timeline to match phase boundaries`,
            }
          )
        );
        continue;
      }

      const declaredMatchesOverlap = overlappingPhases.some(({ phase }) =>
        this.phaseLabelsMatch(workstream.phase as string, phase)
      );

      if (declaredMatchesOverlap) {
        continue;
      }

      const dominantPhase = overlappingPhases.reduce((best, current) =>
        current.overlapMonths > best.overlapMonths ? current : best
      ).phase;

      issues.push(
        this.createIssue(
          'warning',
          'WBS_PHASE_MISMATCH',
          `Workstream "${workstream.name}" is assigned to phase "${workstream.phase}" but its timeline most strongly aligns with "${dominantPhase.name}"`,
          {
            workstreamId: workstream.id,
            field: 'phase',
            suggestion: `Update phase assignment to "${dominantPhase.name}" or adjust workstream timeline`,
          }
        )
      );
    }

    return issues;
  }

  private computeMonthOverlap(
    wsStart: number,
    wsEnd: number,
    phaseStart: number,
    phaseEnd: number
  ): number {
    if (wsEnd < wsStart || phaseEnd <= phaseStart) {
      return 0;
    }

    // Treat workstreams as inclusive [start, end] and phases as half-open [start, end).
    // This mirrors timeline phase assignment logic: ws.start < phaseEnd && ws.end >= phaseStart.
    const wsEndExclusive = wsEnd + 1;
    const overlapStart = Math.max(wsStart, phaseStart);
    const overlapEnd = Math.min(wsEndExclusive, phaseEnd);
    return Math.max(0, overlapEnd - overlapStart);
  }

  private phaseLabelsMatch(declaredPhase: string, phase: Phase): boolean {
    const declared = declaredPhase.trim().toLowerCase();
    if (!declared) return false;

    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    const declaredNormalized = normalize(declared);
    const phaseName = ((phase as any).name || '').toString();
    const phaseNameNormalized = normalize(phaseName);
    if (declaredNormalized && phaseNameNormalized && declaredNormalized === phaseNameNormalized) {
      return true;
    }

    const phaseNumber = ((phase as any).phase ?? '').toString().trim().toLowerCase();
    if (!phaseNumber) return false;
    return declared === phaseNumber || declared === `phase ${phaseNumber}`;
  }

  /**
   * Detect cycles in dependency graph using DFS
   * Returns array of cycles found (each cycle is an array of workstream IDs)
   */
  private detectCycles(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph[node] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStartIndex = path.indexOf(neighbor);
          const cycle = path.slice(cycleStartIndex);
          cycles.push([...cycle]);
        }
      }

      recursionStack.delete(node);
      path.pop();
    };

    for (const node in graph) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }
}
