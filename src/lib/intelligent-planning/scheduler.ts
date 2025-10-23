/**
 * @module planning/schedulers/cpm
 * Critical Path Method scheduler implementation
 */

import { Task, ScheduledTask, Schedule, TaskId, Duration } from './types';

export interface IScheduler {
  schedule(tasks: Task[]): Schedule;
}

export class CPMScheduler implements IScheduler {
  private tasks: Map<TaskId, Task> = new Map();
  private scheduled: Map<TaskId, ScheduledTask> = new Map();
  
  schedule(tasks: Task[]): Schedule {
    this.tasks.clear();
    this.scheduled.clear();
    
    // Build task map
    tasks.forEach(task => this.tasks.set(task.id, task));
    
    // Forward pass
    this.forwardPass();
    
    // Backward pass
    this.backwardPass();
    
    // Calculate slack and critical path
    const criticalPath = this.identifyCriticalPath();
    
    // Convert to schedule
    return this.buildSchedule(criticalPath);
  }
  
  private forwardPass(): void {
    const completed = new Set<TaskId>();
    const queue = Array.from(this.tasks.values());
    
    while (queue.length > 0) {
      const task = queue.shift()!;
      
      // Check if all dependencies are completed
      if (!this.canSchedule(task, completed)) {
        queue.push(task);
        continue;
      }
      
      const earlyStart = this.calculateEarlyStart(task);
      const duration = this.calculateDuration(task.duration);
      const earlyFinish = earlyStart + duration;
      
      this.scheduled.set(task.id, {
        ...task,
        earlyStart,
        earlyFinish,
        lateStart: 0, // Will be calculated in backward pass
        lateFinish: 0,
        slack: 0,
        startDate: this.monthToDate(earlyStart),
        endDate: this.monthToDate(earlyFinish),
        isCritical: false,
        assignedResources: []
      });
      
      completed.add(task.id);
    }
  }
  
  private backwardPass(): void {
    const projectEnd = Math.max(
      ...Array.from(this.scheduled.values()).map(t => t.earlyFinish)
    );
    
    // Process in reverse topological order
    const tasks = Array.from(this.scheduled.values()).reverse();
    
    for (const task of tasks) {
      const successors = this.findSuccessors(task.id);
      
      if (successors.length === 0) {
        // Terminal task
        task.lateFinish = projectEnd;
      } else {
        // Latest finish is earliest of successor late starts
        task.lateFinish = Math.min(
          ...successors.map(s => s.lateStart)
        );
      }
      
      task.lateStart = task.lateFinish - (task.earlyFinish - task.earlyStart);
      task.slack = task.lateStart - task.earlyStart;
      task.isCritical = task.slack === 0;
    }
  }
  
  private canSchedule(task: Task, completed: Set<TaskId>): boolean {
    return task.dependencies.every(dep => completed.has(dep));
  }
  
  private calculateEarlyStart(task: Task): number {
    if (task.dependencies.length === 0) {
      return 0;
    }
    
    const predecessorFinishTimes = task.dependencies
      .map(depId => this.scheduled.get(depId))
      .filter(Boolean)
      .map(t => t!.earlyFinish);
    
    return Math.max(...predecessorFinishTimes);
  }
  
  private calculateDuration(duration: Duration): number {
    // PERT formula: (O + 4M + P) / 6
    const { optimistic, likely, pessimistic } = duration;
    return Math.round((optimistic + 4 * likely + pessimistic) / 6);
  }
  
  private findSuccessors(taskId: TaskId): ScheduledTask[] {
    return Array.from(this.scheduled.values()).filter(
      t => t.dependencies.includes(taskId)
    );
  }
  
  private identifyCriticalPath(): TaskId[] {
    return Array.from(this.scheduled.values())
      .filter(t => t.isCritical)
      .map(t => t.id);
  }
  
  private buildSchedule(criticalPath: TaskId[]): Schedule {
    const tasks = Array.from(this.scheduled.values());
    const startDate = new Date();
    const totalDuration = Math.max(...tasks.map(t => t.earlyFinish));
    
    return {
      tasks,
      criticalPath,
      totalDuration,
      startDate,
      endDate: this.monthToDate(totalDuration)
    };
  }
  
  private monthToDate(months: number): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date;
  }
}

export const createCPMScheduler = (): IScheduler => new CPMScheduler();
