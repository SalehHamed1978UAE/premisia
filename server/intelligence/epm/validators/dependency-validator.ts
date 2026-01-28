import { BaseValidator, ValidatorContext, ValidatorIssue, ValidatorResult } from './base-validator';
import type { Workstream } from '../../types';

export class DependencyValidator extends BaseValidator {
  readonly name = 'DependencyValidator';
  readonly description = 'Validates workstream dependency timing and logical consistency';
  
  validate(context: ValidatorContext): ValidatorResult {
    const issues: ValidatorIssue[] = [];
    const corrections: string[] = [];
    const { workstreams } = context;
    
    for (const workstream of workstreams) {
      this.validateDependencyExists(workstream, workstreams, issues);
      this.validateDependencyTiming(workstream, workstreams, issues, corrections);
      this.validateCircularDependencies(workstream, workstreams, issues);
    }
    
    return this.createResult(
      issues.filter(i => i.severity === 'error').length === 0,
      issues,
      corrections
    );
  }
  
  private validateDependencyExists(
    workstream: Workstream,
    allWorkstreams: Workstream[],
    issues: ValidatorIssue[]
  ): void {
    for (const depId of workstream.dependencies) {
      const dependency = allWorkstreams.find(w => w.id === depId);
      if (!dependency) {
        issues.push(this.createIssue(
          'error',
          'DEP_NOT_FOUND',
          `Workstream "${workstream.name}" depends on non-existent workstream "${depId}"`,
          {
            workstreamId: workstream.id,
            field: 'dependencies',
            suggestion: `Remove invalid dependency "${depId}" or add the missing workstream`,
          }
        ));
      }
    }
  }
  
  private validateDependencyTiming(
    workstream: Workstream,
    allWorkstreams: Workstream[],
    issues: ValidatorIssue[],
    corrections: string[]
  ): void {
    for (const depId of workstream.dependencies) {
      const dependency = allWorkstreams.find(w => w.id === depId);
      if (!dependency) continue;
      
      if (dependency.endMonth >= workstream.startMonth) {
        issues.push(this.createIssue(
          'warning',
          'DEP_TIMING_INVALID',
          `"${workstream.name}" (M${workstream.startMonth}) starts before/during "${dependency.name}" (ends M${dependency.endMonth})`,
          {
            workstreamId: workstream.id,
            field: 'startMonth',
            suggestion: `Shift "${workstream.name}" to start after M${dependency.endMonth}`,
          }
        ));
        
        const oldStart = workstream.startMonth;
        const duration = workstream.endMonth - oldStart;
        workstream.startMonth = dependency.endMonth + 1;
        workstream.endMonth = workstream.startMonth + duration;
        
        corrections.push(
          `Adjusted "${workstream.name}" from M${oldStart} to M${workstream.startMonth} to respect dependency`
        );
        
        this.adjustDeliverables(workstream, oldStart, corrections);
      }
    }
  }
  
  private adjustDeliverables(
    workstream: Workstream,
    oldStart: number,
    corrections: string[]
  ): void {
    for (const deliverable of workstream.deliverables) {
      if (deliverable.dueMonth < workstream.startMonth || deliverable.dueMonth > workstream.endMonth) {
        const originalDue = deliverable.dueMonth;
        deliverable.dueMonth = Math.max(
          workstream.startMonth,
          Math.min(deliverable.dueMonth, workstream.endMonth)
        );
        corrections.push(
          `Re-clamped deliverable "${deliverable.name}" from M${originalDue} to M${deliverable.dueMonth}`
        );
      }
    }
  }
  
  private validateCircularDependencies(
    workstream: Workstream,
    allWorkstreams: Workstream[],
    issues: ValidatorIssue[]
  ): void {
    const visited = new Set<string>();
    const path: string[] = [];
    
    const hasCycle = (wsId: string): boolean => {
      if (path.includes(wsId)) {
        return true;
      }
      if (visited.has(wsId)) {
        return false;
      }
      
      visited.add(wsId);
      path.push(wsId);
      
      const ws = allWorkstreams.find(w => w.id === wsId);
      if (ws) {
        for (const depId of ws.dependencies) {
          if (hasCycle(depId)) {
            return true;
          }
        }
      }
      
      path.pop();
      return false;
    };
    
    if (hasCycle(workstream.id)) {
      issues.push(this.createIssue(
        'error',
        'CIRCULAR_DEPENDENCY',
        `Circular dependency detected involving workstream "${workstream.name}"`,
        {
          workstreamId: workstream.id,
          field: 'dependencies',
          suggestion: 'Review and break the circular dependency chain',
        }
      ));
    }
  }
}
