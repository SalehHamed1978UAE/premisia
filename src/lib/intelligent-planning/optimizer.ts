/**
 * @module planning/optimizers/ai-optimizer
 * AI-powered schedule optimization
 */

import { Schedule, Constraint, ValidationResult } from './types';
import { IValidator, IOptimizer, OptimizedSchedule, Adjustment, LLMProvider } from './interfaces';

export interface OptimizerConfig {
  maxIterations: number;
  targetScore: number;
  improvementThreshold: number;
}

export class AIOptimizer implements IOptimizer {
  constructor(
    private llm: LLMProvider,
    private validator: IValidator,
    private config: OptimizerConfig
  ) {}
  
  async optimize(
    schedule: Schedule,
    constraints: Constraint[]
  ): Promise<OptimizedSchedule> {
    let currentSchedule = schedule;
    let bestSchedule = schedule;
    let bestScore = 0;
    const adjustments: Adjustment[] = [];
    
    for (let iteration = 0; iteration < this.config.maxIterations; iteration++) {
      // Validate current schedule
      const validation = await this.validator.validate(currentSchedule);
      
      if (validation.score.overall > bestScore) {
        bestScore = validation.score.overall;
        bestSchedule = currentSchedule;
      }
      
      // Check if we've reached target
      if (bestScore >= this.config.targetScore) {
        console.log(`Optimization complete after ${iteration + 1} iterations`);
        break;
      }
      
      // Generate improvements
      const improvements = await this.generateImprovements(
        currentSchedule,
        validation,
        constraints
      );
      
      // Apply improvements
      currentSchedule = await this.applyImprovements(
        currentSchedule,
        improvements
      );
      
      adjustments.push(...improvements);
      
      // Check for convergence
      if (this.hasConverged(validation.score.overall, bestScore)) {
        console.log(`Converged after ${iteration + 1} iterations`);
        break;
      }
    }
    
    return {
      ...bestSchedule,
      optimizationScore: bestScore,
      iterations: adjustments.length,
      adjustments
    };
  }
  
  private async generateImprovements(
    schedule: Schedule,
    validation: ValidationResult,
    constraints: Constraint[]
  ): Promise<Adjustment[]> {
    const prompt = this.buildOptimizationPrompt(
      schedule,
      validation,
      constraints
    );
    
    const response = await this.llm.generateStructured<{
      improvements: Adjustment[];
      reasoning: string;
    }>({
      prompt,
      schema: {
        type: 'object',
        properties: {
          improvements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { enum: ['move', 'extend', 'compress', 'parallelize', 'serialize'] },
                taskId: { type: 'string' },
                from: { type: 'object' },
                to: { type: 'object' },
                reason: { type: 'string' }
              }
            }
          },
          reasoning: { type: 'string' }
        }
      }
    });
    
    return response.improvements;
  }
  
  private buildOptimizationPrompt(
    schedule: Schedule,
    validation: ValidationResult,
    constraints: Constraint[]
  ): string {
    return `
      Analyze this project schedule and suggest specific improvements.
      
      Current Schedule:
      - Total Duration: ${schedule.totalDuration} months
      - Critical Path: ${schedule.criticalPath.length} tasks
      - Score: ${JSON.stringify(validation.score)}
      
      Issues Found:
      ${validation.issues.map(i => `- ${i.severity}: ${i.message}`).join('\n')}
      
      Constraints:
      ${constraints.map(c => `- ${c.type}: ${c.description}`).join('\n')}
      
      Optimization Goals:
      1. Minimize total duration
      2. Balance resource utilization
      3. Reduce risk concentration
      4. Maintain logical dependencies
      5. Respect hard constraints
      
      Suggest specific task adjustments that will improve the schedule.
      Focus on:
      - Moving non-critical tasks to reduce resource conflicts
      - Parallelizing independent work
      - Compressing durations where possible
      - Adjusting start dates to smooth resource usage
      
      Return specific, actionable adjustments.
    `;
  }
  
  private async applyImprovements(
    schedule: Schedule,
    improvements: Adjustment[]
  ): Promise<Schedule> {
    const improvedSchedule = { ...schedule };
    const tasks = [...schedule.tasks];
    
    for (const improvement of improvements) {
      const taskIndex = tasks.findIndex(t => t.id === improvement.taskId);
      if (taskIndex === -1) continue;
      
      const task = { ...tasks[taskIndex] };
      
      switch (improvement.type) {
        case 'move':
          task.startDate = new Date(improvement.to.startDate);
          task.endDate = new Date(improvement.to.endDate);
          break;
          
        case 'compress':
          const newDuration = improvement.to.duration;
          task.endDate = new Date(
            task.startDate.getTime() + newDuration * 24 * 60 * 60 * 1000
          );
          break;
          
        case 'parallelize':
          // Adjust dependencies to allow parallel execution
          task.dependencies = task.dependencies.filter(
            d => !improvement.to.removeDependencies?.includes(d)
          );
          break;
          
        case 'extend':
          task.endDate = new Date(improvement.to.endDate);
          break;
          
        case 'serialize':
          // Add dependencies to serialize execution
          task.dependencies.push(...(improvement.to.addDependencies || []));
          break;
      }
      
      tasks[taskIndex] = task;
    }
    
    improvedSchedule.tasks = tasks;
    return improvedSchedule;
  }
  
  private hasConverged(currentScore: number, bestScore: number): boolean {
    const improvement = currentScore - bestScore;
    return Math.abs(improvement) < this.config.improvementThreshold;
  }
}

export function createAIOptimizer(
  llm: LLMProvider,
  validator: IValidator,
  config?: Partial<OptimizerConfig>
): IOptimizer {
  const defaultConfig: OptimizerConfig = {
    maxIterations: 10,
    targetScore: 85,
    improvementThreshold: 0.01,
    ...config
  };
  
  return new AIOptimizer(llm, validator, defaultConfig);
}
