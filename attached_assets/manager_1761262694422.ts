/**
 * @module planning/resources/manager
 * Resource allocation and leveling
 */

import { 
  Schedule, 
  Resource, 
  ResourceId, 
  ScheduledTask,
  ResourceRequirement 
} from '../types';

export interface IResourceManager {
  allocate(schedule: Schedule, resources: Resource[]): ResourceAllocation;
  level(allocation: ResourceAllocation): LeveledSchedule;
  detectConflicts(schedule: Schedule, resources: Resource[]): ResourceConflict[];
}

export interface ResourceAllocation {
  schedule: Schedule;
  assignments: Map<TaskId, ResourceId[]>;
  utilization: ResourceUtilization[];
  conflicts: ResourceConflict[];
}

export interface ResourceConflict {
  period: { start: Date; end: Date };
  required: number;
  available: number;
  overallocation: number;
  affectedTasks: string[];
}

export interface ResourceUtilization {
  resourceId: ResourceId;
  periods: UtilizationPeriod[];
  averageUtilization: number;
  peakUtilization: number;
}

export interface UtilizationPeriod {
  start: Date;
  end: Date;
  utilization: number;
  assignedTasks: string[];
}

export interface LeveledSchedule extends Schedule {
  levelingAdjustments: LevelingAdjustment[];
  newConflicts: ResourceConflict[];
}

export interface LevelingAdjustment {
  taskId: string;
  originalStart: Date;
  newStart: Date;
  reason: string;
}

export class ResourceManager implements IResourceManager {
  private resources: Map<ResourceId, Resource> = new Map();
  
  allocate(schedule: Schedule, resources: Resource[]): ResourceAllocation {
    this.buildResourceMap(resources);
    
    const assignments = this.assignResources(schedule.tasks);
    const utilization = this.calculateUtilization(schedule.tasks, resources);
    const conflicts = this.detectConflicts(schedule, resources);
    
    return {
      schedule,
      assignments,
      utilization,
      conflicts
    };
  }
  
  level(allocation: ResourceAllocation): LeveledSchedule {
    if (allocation.conflicts.length === 0) {
      return {
        ...allocation.schedule,
        levelingAdjustments: [],
        newConflicts: []
      };
    }
    
    const adjustments: LevelingAdjustment[] = [];
    const leveledTasks = [...allocation.schedule.tasks];
    
    // Sort conflicts by severity
    const sortedConflicts = [...allocation.conflicts].sort(
      (a, b) => b.overallocation - a.overallocation
    );
    
    for (const conflict of sortedConflicts) {
      const resolved = this.resolveConflict(
        conflict,
        leveledTasks,
        adjustments
      );
      
      if (resolved) {
        leveledTasks.splice(0, leveledTasks.length, ...resolved);
      }
    }
    
    // Recalculate schedule with leveled tasks
    const leveledSchedule: Schedule = {
      ...allocation.schedule,
      tasks: leveledTasks
    };
    
    // Check for remaining conflicts
    const newConflicts = this.detectConflicts(
      leveledSchedule,
      Array.from(this.resources.values())
    );
    
    return {
      ...leveledSchedule,
      levelingAdjustments: adjustments,
      newConflicts
    };
  }
  
  detectConflicts(schedule: Schedule, resources: Resource[]): ResourceConflict[] {
    const conflicts: ResourceConflict[] = [];
    const periods = this.generateAnalysisPeriods(schedule);
    
    for (const period of periods) {
      const tasksInPeriod = this.getTasksInPeriod(schedule.tasks, period);
      const required = this.calculateRequiredResources(tasksInPeriod);
      const available = this.calculateAvailableResources(resources, period);
      
      if (required > available) {
        conflicts.push({
          period,
          required,
          available,
          overallocation: required - available,
          affectedTasks: tasksInPeriod.map(t => t.id)
        });
      }
    }
    
    return conflicts;
  }
  
  private buildResourceMap(resources: Resource[]): void {
    this.resources.clear();
    resources.forEach(r => this.resources.set(r.id, r));
  }
  
  private assignResources(tasks: ScheduledTask[]): Map<string, ResourceId[]> {
    const assignments = new Map<string, ResourceId[]>();
    
    for (const task of tasks) {
      const assigned = this.findBestResources(task);
      assignments.set(task.id, assigned);
      task.assignedResources = assigned;
    }
    
    return assignments;
  }
  
  private findBestResources(task: ScheduledTask): ResourceId[] {
    const assigned: ResourceId[] = [];
    
    for (const requirement of task.requirements) {
      const available = Array.from(this.resources.values())
        .filter(r => r.skills.includes(requirement.skill))
        .sort((a, b) => a.costPerUnit - b.costPerUnit);
      
      if (available.length > 0) {
        assigned.push(available[0].id);
      }
    }
    
    return assigned;
  }
  
  private calculateUtilization(
    tasks: ScheduledTask[],
    resources: Resource[]
  ): ResourceUtilization[] {
    const utilizations: ResourceUtilization[] = [];
    
    for (const resource of resources) {
      const periods = this.calculateResourcePeriods(resource, tasks);
      const avgUtilization = this.calculateAverageUtilization(periods);
      const peakUtilization = Math.max(...periods.map(p => p.utilization));
      
      utilizations.push({
        resourceId: resource.id,
        periods,
        averageUtilization: avgUtilization,
        peakUtilization
      });
    }
    
    return utilizations;
  }
  
  private resolveConflict(
    conflict: ResourceConflict,
    tasks: ScheduledTask[],
    adjustments: LevelingAdjustment[]
  ): ScheduledTask[] | null {
    // Find non-critical tasks in the conflict period
    const movableTasks = tasks.filter(
      t => conflict.affectedTasks.includes(t.id) && !t.isCritical
    );
    
    if (movableTasks.length === 0) {
      return null; // Can't resolve without moving critical tasks
    }
    
    // Sort by slack (most slack first)
    movableTasks.sort((a, b) => b.slack - a.slack);
    
    // Move tasks with available slack
    for (const task of movableTasks) {
      if (task.slack > 0) {
        const adjustment: LevelingAdjustment = {
          taskId: task.id,
          originalStart: task.startDate,
          newStart: new Date(task.startDate.getTime() + (86400000 * 7)), // Move by 1 week
          reason: `Resource conflict resolution in period ${conflict.period.start.toDateString()}`
        };
        
        // Apply adjustment
        task.startDate = adjustment.newStart;
        task.endDate = new Date(task.endDate.getTime() + (86400000 * 7));
        task.slack -= 1;
        
        adjustments.push(adjustment);
        
        // Check if conflict is resolved
        if (this.isConflictResolved(conflict, tasks)) {
          break;
        }
      }
    }
    
    return tasks;
  }
  
  private generateAnalysisPeriods(schedule: Schedule): Array<{ start: Date; end: Date }> {
    const periods: Array<{ start: Date; end: Date }> = [];
    const start = schedule.startDate;
    const end = schedule.endDate;
    const current = new Date(start);
    
    while (current < end) {
      const periodEnd = new Date(current);
      periodEnd.setDate(periodEnd.getDate() + 7); // Weekly periods
      
      periods.push({
        start: new Date(current),
        end: periodEnd > end ? end : periodEnd
      });
      
      current.setDate(current.getDate() + 7);
    }
    
    return periods;
  }
  
  private getTasksInPeriod(
    tasks: ScheduledTask[],
    period: { start: Date; end: Date }
  ): ScheduledTask[] {
    return tasks.filter(
      t => t.startDate <= period.end && t.endDate >= period.start
    );
  }
  
  private calculateRequiredResources(tasks: ScheduledTask[]): number {
    return tasks.reduce((sum, task) => 
      sum + task.requirements.reduce((reqSum, req) => 
        reqSum + req.quantity, 0
      ), 0
    );
  }
  
  private calculateAvailableResources(
    resources: Resource[],
    period: { start: Date; end: Date }
  ): number {
    return resources.reduce((sum, resource) => {
      const availability = this.getResourceAvailability(resource, period);
      return sum + (resource.capacity * availability);
    }, 0);
  }
  
  private getResourceAvailability(
    resource: Resource,
    period: { start: Date; end: Date }
  ): number {
    const relevantAvailability = resource.availability.find(
      a => a.startDate <= period.end && a.endDate >= period.start
    );
    
    return relevantAvailability?.percentAvailable ?? 1;
  }
  
  private calculateResourcePeriods(
    resource: Resource,
    tasks: ScheduledTask[]
  ): UtilizationPeriod[] {
    // Implementation details...
    return [];
  }
  
  private calculateAverageUtilization(periods: UtilizationPeriod[]): number {
    if (periods.length === 0) return 0;
    const sum = periods.reduce((s, p) => s + p.utilization, 0);
    return sum / periods.length;
  }
  
  private isConflictResolved(
    conflict: ResourceConflict,
    tasks: ScheduledTask[]
  ): boolean {
    const tasksInPeriod = this.getTasksInPeriod(tasks, conflict.period);
    const required = this.calculateRequiredResources(tasksInPeriod);
    return required <= conflict.available;
  }
}

export const createResourceManager = (): IResourceManager => new ResourceManager();
