/**
 * @module planning-system
 * Intelligent Project Planning System - Main Entry Point
 */

// Import all the modules
import { createTaskExtractor } from './task-extractor';
import { createCPMScheduler } from './scheduler';
import { createResourceManager } from './resource-manager';
import { createAIOptimizer } from './optimizer';
import { createValidator } from './validator';
import { createOrchestrator } from './orchestrator';
import { createOpenAIProvider } from './llm-provider';
import type { PlanningRequest, PlanningResult } from './orchestrator';
import type { Schedule } from './types';

// Export types for external use
export * from './types';
export * from './orchestrator';
export * from './interfaces';

/**
 * Factory function to create a configured planning system
 */
export function createPlanningSystem(config: {
  openaiApiKey: string;
  maxIterations?: number;
  targetScore?: number;
}) {
  // Create LLM provider
  const llm = createOpenAIProvider({
    apiKey: config.openaiApiKey,
    model: 'gpt-4-turbo-preview'
  });
  
  // Create individual modules
  const extractor = createTaskExtractor(llm);
  const scheduler = createCPMScheduler();
  const resourceManager = createResourceManager();
  const validator = createValidator(llm);
  const optimizer = createAIOptimizer(llm, validator, {
    maxIterations: config.maxIterations || 10,
    targetScore: config.targetScore || 85
  });
  
  // Create orchestrator with all dependencies
  const orchestrator = createOrchestrator({
    extractor,
    scheduler,
    resourceManager,
    optimizer,
    validator
  });
  
  // Return planning function
  return {
    async plan(request: PlanningRequest): Promise<PlanningResult> {
      return orchestrator.plan(request);
    },
    
    // Expose individual modules for direct use if needed
    modules: {
      extractor,
      scheduler,
      resourceManager,
      optimizer,
      validator
    },
    
    // Event subscription for progress tracking
    on: orchestrator.on.bind(orchestrator),
    off: orchestrator.off.bind(orchestrator)
  };
}

/**
 * Transform schedule to Gantt chart format
 */
export function transformToGanttFormat(schedule: Schedule): any {
  return {
    tasks: schedule.tasks.map(task => ({
      id: task.id,
      name: task.name,
      startDate: task.startDate,
      endDate: task.endDate,
      startMonth: Math.floor(
        (task.startDate.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)
      ),
      endMonth: Math.floor(
        (task.endDate.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)
      ),
      confidence: task.isCritical ? 60 : 80,
      dependencies: task.dependencies,
      deliverables: task.deliverables,
      type: task.isCritical ? 'critical' : 'normal'
    })),
    totalMonths: Math.ceil(
      (schedule.endDate.getTime() - schedule.startDate.getTime()) / 
      (1000 * 60 * 60 * 24 * 30)
    ),
    criticalPath: schedule.criticalPath,
    phases: generatePhases(schedule),
    stageGates: generateStageGates(schedule)
  };
}

function generatePhases(schedule: Schedule): any[] {
  // Generate logical phases based on task groupings
  const totalMonths = Math.ceil(
    (schedule.endDate.getTime() - schedule.startDate.getTime()) / 
    (1000 * 60 * 60 * 24 * 30)
  );
  
  const phases: any[] = [];
  const phaseDuration = Math.ceil(totalMonths / 3); // 3 phases
  
  phases.push({
    phase: 1,
    name: 'Planning & Setup',
    startMonth: 0,
    endMonth: phaseDuration - 1,
    startDate: schedule.startDate,
    endDate: new Date(schedule.startDate.getTime() + phaseDuration * 30 * 24 * 60 * 60 * 1000)
  });
  
  phases.push({
    phase: 2,
    name: 'Execution & Development',
    startMonth: phaseDuration,
    endMonth: phaseDuration * 2 - 1,
    startDate: phases[0].endDate,
    endDate: new Date(phases[0].endDate.getTime() + phaseDuration * 30 * 24 * 60 * 60 * 1000)
  });
  
  phases.push({
    phase: 3,
    name: 'Testing & Deployment',
    startMonth: phaseDuration * 2,
    endMonth: totalMonths - 1,
    startDate: phases[1].endDate,
    endDate: schedule.endDate
  });
  
  return phases;
}

function generateStageGates(schedule: Schedule): any {
  const gates: any[] = [];
  const phases = generatePhases(schedule);
  
  phases.forEach((phase, index) => {
    if (index < phases.length - 1) {
      gates.push({
        gate: index + 1,
        name: `Phase ${index + 1} Review`,
        month: phase.endMonth,
        date: phase.endDate,
        criteria: []
      });
    }
  });
  
  return { gates };
}
