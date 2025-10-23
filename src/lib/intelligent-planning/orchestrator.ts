/**
 * @module planning/orchestrator
 * Main orchestrator that coordinates all planning modules
 */

import { EventEmitter } from 'events';
import { Task, Schedule, Constraint, Resource, ValidationResult } from './types';
import { 
  IScheduler, 
  IResourceManager, 
  IOptimizer, 
  IValidator, 
  ITaskExtractor 
} from './interfaces';

export interface PlanningRequest {
  strategy: any;
  constraints: Constraint[];
  resources: Resource[];
  options?: PlanningOptions;
}

export interface PlanningOptions {
  maxDuration?: number;
  enableOptimization?: boolean;
  enableResourceLeveling?: boolean;
  verboseLogging?: boolean;
}

export interface PlanningResult {
  success: boolean;
  schedule?: Schedule;
  issues?: string[];
  recommendations?: string[];
  strategyAdjustments?: string[];
  metadata: {
    duration: number;
    iterations: number;
    score: number;
  };
}

export interface PlanningStep {
  name: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  startTime?: Date;
  endTime?: Date;
  result?: any;
  error?: Error;
}

export class ProjectPlanningOrchestrator extends EventEmitter {
  private steps: PlanningStep[] = [];
  
  constructor(
    private extractor: ITaskExtractor,
    private scheduler: IScheduler,
    private resourceManager: IResourceManager,
    private optimizer: IOptimizer,
    private validator: IValidator
  ) {
    super();
  }
  
  async plan(request: PlanningRequest): Promise<PlanningResult> {
    const startTime = Date.now();
    this.steps = [];
    
    try {
      // Step 1: Extract tasks from strategy
      const tasks = await this.executeStep(
        'extract-tasks',
        () => this.extractor.extract(request.strategy)
      );
      
      // Step 2: Initial scheduling
      const schedule = await this.executeStep(
        'schedule',
        () => this.scheduler.schedule(tasks)
      );
      
      // Step 3: Resource allocation
      const allocation = await this.executeStep(
        'allocate-resources',
        () => this.resourceManager.allocate(schedule, request.resources)
      );
      
      // Step 4: Resource leveling (if needed)
      let leveledSchedule = allocation.schedule;
      if (allocation.conflicts.length > 0 && request.options?.enableResourceLeveling) {
        const leveled = await this.executeStep(
          'level-resources',
          () => this.resourceManager.level(allocation)
        );
        leveledSchedule = leveled;
      }
      
      // Step 5: Optimization (if enabled)
      let optimizedSchedule = leveledSchedule;
      if (request.options?.enableOptimization) {
        optimizedSchedule = await this.executeStep(
          'optimize',
          () => this.optimizer.optimize(leveledSchedule, request.constraints)
        );
      }
      
      // Step 6: Final validation
      const validation = await this.executeStep(
        'validate',
        () => this.validator.validate(optimizedSchedule)
      );
      
      // Prepare result
      const duration = Date.now() - startTime;
      
      if (validation.isValid) {
        return {
          success: true,
          schedule: optimizedSchedule,
          recommendations: validation.suggestions,
          metadata: {
            duration,
            iterations: this.steps.length,
            score: validation.score.overall
          }
        };
      } else {
        // Schedule is not valid - need strategy adjustments
        const adjustments = await this.identifyStrategyAdjustments(
          optimizedSchedule,
          validation,
          request
        );
        
        return {
          success: false,
          schedule: optimizedSchedule,
          issues: validation.issues.map(i => i.message),
          strategyAdjustments: adjustments,
          metadata: {
            duration,
            iterations: this.steps.length,
            score: validation.score.overall
          }
        };
      }
    } catch (error) {
      this.emit('error', error);
      
      return {
        success: false,
        issues: [error instanceof Error ? error.message : 'Unknown error'],
        metadata: {
          duration: Date.now() - startTime,
          iterations: this.steps.length,
          score: 0
        }
      };
    }
  }
  
  private async executeStep<T>(
    name: string,
    executor: () => Promise<T> | T
  ): Promise<T> {
    const step: PlanningStep = {
      name,
      status: 'pending'
    };
    
    this.steps.push(step);
    this.emit('step-start', step);
    
    try {
      step.status = 'running';
      step.startTime = new Date();
      
      const result = await executor();
      
      step.status = 'complete';
      step.endTime = new Date();
      step.result = result;
      
      this.emit('step-complete', step);
      
      return result;
    } catch (error) {
      step.status = 'failed';
      step.endTime = new Date();
      step.error = error instanceof Error ? error : new Error(String(error));
      
      this.emit('step-failed', step);
      
      throw error;
    }
  }
  
  private async identifyStrategyAdjustments(
    schedule: Schedule,
    validation: ValidationResult,
    request: PlanningRequest
  ): Promise<string[]> {
    const adjustments: string[] = [];
    
    // Check timeline constraints
    const deadlineConstraint = request.constraints.find(c => c.type === 'deadline');
    if (deadlineConstraint && schedule.endDate > deadlineConstraint.value) {
      const monthsOver = Math.ceil(
        (schedule.endDate.getTime() - deadlineConstraint.value.getTime()) / 
        (1000 * 60 * 60 * 24 * 30)
      );
      adjustments.push(
        `Timeline adjustment needed: Project requires ${monthsOver} additional months`
      );
    }
    
    // Check budget constraints
    const budgetConstraint = request.constraints.find(c => c.type === 'budget');
    if (budgetConstraint && schedule.totalCost && schedule.totalCost > budgetConstraint.value) {
      const overBudget = schedule.totalCost - budgetConstraint.value;
      adjustments.push(
        `Budget adjustment needed: Additional $${overBudget.toLocaleString()} required`
      );
    }
    
    // Check resource constraints
    const resourceIssues = validation.issues.filter(i => i.type === 'resource');
    if (resourceIssues.length > 0) {
      adjustments.push(
        `Resource adjustment needed: ${resourceIssues[0].message}`
      );
    }
    
    // Add critical issues
    const criticalIssues = validation.issues.filter(i => i.severity === 'critical');
    criticalIssues.forEach(issue => {
      if (issue.suggestedFix) {
        adjustments.push(issue.suggestedFix);
      }
    });
    
    return adjustments;
  }
  
  getSteps(): PlanningStep[] {
    return this.steps;
  }
  
  getLastError(): Error | undefined {
    const failedStep = this.steps.find(s => s.status === 'failed');
    return failedStep?.error;
  }
}

export function createOrchestrator(dependencies: {
  extractor: ITaskExtractor;
  scheduler: IScheduler;
  resourceManager: IResourceManager;
  optimizer: IOptimizer;
  validator: IValidator;
}): ProjectPlanningOrchestrator {
  return new ProjectPlanningOrchestrator(
    dependencies.extractor,
    dependencies.scheduler,
    dependencies.resourceManager,
    dependencies.optimizer,
    dependencies.validator
  );
}
