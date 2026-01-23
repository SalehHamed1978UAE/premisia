/**
 * EPMValidator - Validates and auto-corrects EPM data
 * 
 * Handles validation of workstreams, timeline, and stage gates
 * to ensure data consistency and logical correctness.
 */

import type { Workstream, Timeline, StageGates } from '../types';
import type { IEPMValidator, ValidationResult } from '../../types/interfaces';

export class EPMValidator implements IEPMValidator {
  /**
   * Comprehensive data validation and auto-correction
   * Validates all logical constraints: deliverables, dependencies, phases, gates
   */
  validate(
    workstreams: Workstream[],
    timeline: Timeline,
    stageGates: StageGates
  ): ValidationResult {
    const errors: string[] = [];
    const corrections: string[] = [];
    const warnings: string[] = [];

    this.validateDeliverables(workstreams, errors, corrections);
    this.validateDependencies(workstreams, errors, corrections);
    this.revalidateDeliverablesAfterAdjustment(workstreams, corrections);
    this.validatePhases(timeline, errors, corrections);
    this.validateStageGates(stageGates, timeline, errors, corrections);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      corrections
    };
  }

  private validateDeliverables(
    workstreams: Workstream[],
    errors: string[],
    corrections: string[]
  ): void {
    for (const workstream of workstreams) {
      for (const deliverable of workstream.deliverables) {
        if (deliverable.dueMonth < workstream.startMonth || deliverable.dueMonth > workstream.endMonth) {
          const originalDueMonth = deliverable.dueMonth;
          deliverable.dueMonth = Math.max(
            workstream.startMonth,
            Math.min(deliverable.dueMonth, workstream.endMonth)
          );
          
          errors.push(
            `Deliverable "${deliverable.name}" at M${originalDueMonth} outside workstream ` +
            `"${workstream.name}" (M${workstream.startMonth}-M${workstream.endMonth})`
          );
          corrections.push(`Clamped deliverable "${deliverable.name}" to M${deliverable.dueMonth}`);
        }
      }
    }
  }

  private validateDependencies(
    workstreams: Workstream[],
    errors: string[],
    corrections: string[]
  ): void {
    for (const workstream of workstreams) {
      const validDependencies: string[] = [];
      
      for (const depId of workstream.dependencies) {
        const dependency = workstreams.find(w => w.id === depId);
        
        if (!dependency) {
          errors.push(`Workstream "${workstream.name}" depends on non-existent "${depId}"`);
          corrections.push(`Removed invalid dependency "${depId}" from "${workstream.name}"`);
          continue;
        }
        
        if (dependency.endMonth >= workstream.startMonth) {
          errors.push(
            `Invalid dependency: "${workstream.name}" (M${workstream.startMonth}) ` +
            `starts before "${dependency.name}" ends (M${dependency.endMonth})`
          );
          
          const oldStart = workstream.startMonth;
          workstream.startMonth = dependency.endMonth + 1;
          
          const duration = workstream.endMonth - oldStart;
          workstream.endMonth = workstream.startMonth + duration;
          
          corrections.push(
            `Adjusted "${workstream.name}" to M${workstream.startMonth}-M${workstream.endMonth} ` +
            `to respect dependency on "${dependency.name}"`
          );
        }
        
        validDependencies.push(depId);
      }
      
      workstream.dependencies = validDependencies;
    }
  }

  private revalidateDeliverablesAfterAdjustment(
    workstreams: Workstream[],
    corrections: string[]
  ): void {
    for (const workstream of workstreams) {
      for (const deliverable of workstream.deliverables) {
        if (deliverable.dueMonth < workstream.startMonth || deliverable.dueMonth > workstream.endMonth) {
          deliverable.dueMonth = Math.max(
            workstream.startMonth,
            Math.min(deliverable.dueMonth, workstream.endMonth)
          );
          
          corrections.push(
            `Re-clamped deliverable "${deliverable.name}" to M${deliverable.dueMonth} ` +
            `after "${workstream.name}" date adjustment`
          );
        }
      }
    }
  }

  private validatePhases(
    timeline: Timeline,
    errors: string[],
    corrections: string[]
  ): void {
    const sortedPhases = [...timeline.phases].sort((a, b) => a.phase - b.phase);
    for (let i = 1; i < sortedPhases.length; i++) {
      const prevPhase = sortedPhases[i - 1];
      const currPhase = sortedPhases[i];
      
      if (currPhase.startMonth <= prevPhase.endMonth) {
        errors.push(
          `Phase ${currPhase.phase} "${currPhase.name}" overlaps with ` +
          `Phase ${prevPhase.phase} "${prevPhase.name}"`
        );
        
        const oldStart = currPhase.startMonth;
        currPhase.startMonth = prevPhase.endMonth + 1;
        
        corrections.push(
          `Adjusted Phase ${currPhase.phase} start from M${oldStart} to M${currPhase.startMonth}`
        );
      }
    }
  }

  private validateStageGates(
    stageGates: StageGates,
    timeline: Timeline,
    errors: string[],
    corrections: string[]
  ): void {
    for (const gate of stageGates.gates) {
      const phase = timeline.phases.find(p =>
        gate.month >= p.startMonth && gate.month <= p.endMonth
      );
      
      if (!phase) {
        errors.push(`Stage gate ${gate.gate} at M${gate.month} not within any phase`);
        
        const nearestPhase = timeline.phases.reduce((prev, curr) =>
          Math.abs(curr.endMonth - gate.month) < Math.abs(prev.endMonth - gate.month) ? curr : prev
        );
        
        const oldMonth = gate.month;
        gate.month = nearestPhase.endMonth;
        
        corrections.push(
          `Moved gate ${gate.gate} from M${oldMonth} to M${gate.month} (end of Phase ${nearestPhase.phase})`
        );
      }
    }
  }

  /**
   * Planning Grid Analysis
   * Creates month-by-month view to identify resource conflicts
   */
  analyzePlanningGrid(workstreams: Workstream[], timeline: Timeline) {
    interface MonthCell {
      month: number;
      tasks: Array<{ id: string; name: string; confidence: number }>;
      deliverables: Array<{ id: string; name: string; workstreamId: string }>;
      phase: string | null;
      utilization: number;
    }

    const grid: MonthCell[] = [];
    const conflicts: string[] = [];

    for (let m = 0; m <= timeline.totalMonths; m++) {
      const phase = timeline.phases.find(p => m >= p.startMonth && m <= p.endMonth);
      
      grid[m] = {
        month: m,
        tasks: [],
        deliverables: [],
        phase: phase?.name || null,
        utilization: 0
      };
    }

    for (const ws of workstreams) {
      for (let m = ws.startMonth; m <= ws.endMonth; m++) {
        if (grid[m]) {
          grid[m].tasks.push({
            id: ws.id,
            name: ws.name,
            confidence: ws.confidence
          });
          grid[m].utilization += 1;
        }
      }

      for (const deliverable of ws.deliverables) {
        if (grid[deliverable.dueMonth]) {
          grid[deliverable.dueMonth].deliverables.push({
            id: deliverable.id,
            name: deliverable.name,
            workstreamId: ws.id
          });
        }
      }
    }

    for (const month of grid) {
      if (month.utilization > 3) {
        conflicts.push(
          `Month ${month.month} (${month.phase || 'No phase'}): ` +
          `${month.utilization} parallel tasks (max recommended: 3)`
        );
      }

      if (month.deliverables.length > 5) {
        conflicts.push(
          `Month ${month.month}: ${month.deliverables.length} deliverables due ` +
          `(may overwhelm review capacity)`
        );
      }
    }

    return {
      grid,
      conflicts,
      maxUtilization: Math.max(...grid.map(m => m.utilization)),
      totalTasks: workstreams.length
    };
  }
}

export default EPMValidator;
