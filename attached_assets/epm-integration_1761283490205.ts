/**
 * @module planning/integration/epm-integration
 * Integration layer between planning system and EPM generation
 */

import { createPlanningSystem } from '../index';
import { PlanningRequest, PlanningResult } from '../orchestrator';
import { Constraint, Resource } from '../types';

/**
 * Main integration function to replace current timeline generation
 * Use this in your server/routes/strategy-workspace.ts
 */
export async function replaceTimelineGeneration(
  epmProgram: any,
  businessContext: any,
  config?: {
    maxDuration?: number;
    budget?: number;
    teamSize?: number;
  }
): Promise<{
  success: boolean;
  program: any;
  warnings?: string[];
  adjustments?: string[];
  confidence: number;
}> {
  
  try {
    console.log('Starting intelligent timeline generation...');
    
    // Extract workstreams and objectives from EPM program
    const strategy = {
      workstreams: epmProgram.workstreams || [],
      objectives: epmProgram.executiveSummary?.objectives || [],
      context: businessContext,
      timeline: epmProgram.timeline,
      financialPlan: epmProgram.financialPlan,
      riskRegister: epmProgram.riskRegister
    };
    
    // Build constraints from config and EPM data
    const constraints = buildConstraints(epmProgram, config);
    
    // Build resources from EPM resource plan
    const resources = buildResources(epmProgram.resourcePlan, config);
    
    // Generate intelligent schedule
    const planningResult = await generateIntelligentSchedule(
      strategy,
      constraints,
      resources
    );
    
    if (!planningResult.success) {
      console.warn('Planning failed, returning with adjustments needed');
      
      return {
        success: false,
        program: epmProgram,
        warnings: planningResult.warnings,
        adjustments: planningResult.adjustments,
        confidence: planningResult.metadata.score
      };
    }
    
    // Update EPM program with validated schedule
    const updatedProgram = integrateScheduleIntoEPM(
      epmProgram,
      planningResult.schedule
    );
    
    console.log(`Timeline generated successfully with ${planningResult.metadata.score}% confidence`);
    
    return {
      success: true,
      program: updatedProgram,
      warnings: planningResult.warnings || [],
      confidence: planningResult.metadata.score
    };
    
  } catch (error) {
    console.error('Timeline generation failed:', error);
    
    // Fallback to original timeline if intelligent planning fails
    return {
      success: false,
      program: epmProgram,
      warnings: ['Intelligent planning failed, using basic timeline'],
      adjustments: [],
      confidence: 0
    };
  }
}

/**
 * Generate intelligent schedule using the planning system
 */
async function generateIntelligentSchedule(
  strategy: any,
  constraints: Constraint[],
  resources: Resource[]
): Promise<PlanningResult> {
  
  // Create planning system with configuration
  const planner = createPlanningSystem({
    openaiApiKey: process.env.OPENAI_API_KEY!,
    maxIterations: parseInt(process.env.MAX_PLANNING_ITERATIONS || '10'),
    targetScore: parseInt(process.env.TARGET_PLANNING_SCORE || '85')
  });
  
  // Subscribe to progress events for logging
  planner.on('step-start', (step) => {
    console.log(`Planning step started: ${step.name}`);
  });
  
  planner.on('step-complete', (step) => {
    console.log(`Planning step completed: ${step.name}`);
  });
  
  planner.on('error', (error) => {
    console.error(`Planning error: ${error.message}`);
  });
  
  // Build planning request
  const request: PlanningRequest = {
    strategy,
    constraints,
    resources,
    options: {
      enableOptimization: true,
      enableResourceLeveling: true,
      verboseLogging: process.env.NODE_ENV === 'development'
    }
  };
  
  // Execute planning
  const result = await planner.plan(request);
  
  // Transform result for EPM compatibility
  return {
    success: result.success,
    schedule: result.schedule ? transformScheduleForEPM(result.schedule) : undefined,
    warnings: result.recommendations,
    adjustments: result.strategyAdjustments,
    metadata: result.metadata
  };
}

/**
 * Build constraints from EPM program and config
 */
function buildConstraints(epmProgram: any, config?: any): Constraint[] {
  const constraints: Constraint[] = [];
  
  // Timeline constraint
  const targetDuration = config?.maxDuration || 
    epmProgram.timeline?.totalMonths || 
    12;
    
  constraints.push({
    id: 'timeline',
    type: 'deadline',
    description: `Complete within ${targetDuration} months`,
    value: new Date(Date.now() + targetDuration * 30 * 24 * 60 * 60 * 1000),
    isHard: false
  });
  
  // Budget constraint
  const budget = config?.budget || 
    epmProgram.financialPlan?.totalInvestment || 
    500000;
    
  constraints.push({
    id: 'budget',
    type: 'budget',
    description: `Stay within $${budget} budget`,
    value: budget,
    isHard: true
  });
  
  // Add milestone constraints from stage gates
  if (epmProgram.stageGates?.gates) {
    epmProgram.stageGates.gates.forEach((gate: any, index: number) => {
      constraints.push({
        id: `gate-${index}`,
        type: 'milestone',
        description: gate.name,
        value: {
          date: gate.date || gate.month,
          criteria: gate.criteria
        },
        isHard: true
      });
    });
  }
  
  return constraints;
}

/**
 * Build resources from EPM resource plan
 */
function buildResources(resourcePlan: any, config?: any): Resource[] {
  const resources: Resource[] = [];
  
  // Default team if no resource plan
  if (!resourcePlan?.teamStructure) {
    const teamSize = config?.teamSize || 5;
    
    resources.push({
      id: 'default-team',
      name: 'Development Team',
      capacity: teamSize,
      skills: ['development', 'testing', 'design'],
      availability: [{
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        percentAvailable: 1.0
      }],
      costPerUnit: 150000
    });
    
    return resources;
  }
  
  // Build from resource plan
  if (Array.isArray(resourcePlan.teamStructure)) {
    resourcePlan.teamStructure.forEach((role: any, index: number) => {
      resources.push({
        id: `resource-${index}`,
        name: role.title || role.role,
        capacity: role.quantity || 1,
        skills: role.skills || [role.expertise],
        availability: [{
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          percentAvailable: 1.0
        }],
        costPerUnit: role.cost || 100000
      });
    });
  }
  
  return resources;
}

/**
 * Transform planning system schedule to EPM format
 */
function transformScheduleForEPM(schedule: any): any {
  return {
    tasks: schedule.tasks.map((task: any) => ({
      id: task.id,
      name: task.name,
      startDate: task.startDate,
      endDate: task.endDate,
      startMonth: Math.floor((task.startDate.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)),
      endMonth: Math.floor((task.endDate.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)),
      confidence: task.isCritical ? 70 : 85,
      dependencies: task.dependencies,
      deliverables: task.deliverables || [],
      owner: task.assignedResources?.[0] || 'Unassigned',
      description: task.description
    })),
    totalMonths: schedule.totalDuration,
    criticalPath: schedule.criticalPath,
    phases: generatePhasesFromSchedule(schedule),
    milestones: extractMilestonesFromSchedule(schedule)
  };
}

/**
 * Integrate validated schedule back into EPM program
 */
function integrateScheduleIntoEPM(epmProgram: any, schedule: any): any {
  const updatedProgram = { ...epmProgram };
  
  // Update workstreams with validated timeline data
  if (schedule?.tasks) {
    updatedProgram.workstreams = schedule.tasks.map((task: any, index: number) => {
      const originalWorkstream = epmProgram.workstreams?.[index] || {};
      
      return {
        ...originalWorkstream,
        id: task.id,
        name: task.name,
        startMonth: task.startMonth,
        endMonth: task.endMonth,
        confidence: task.confidence,
        dependencies: task.dependencies,
        deliverables: ensureDeliverablesWithinBounds(
          task.deliverables || originalWorkstream.deliverables || [],
          task.startMonth,
          task.endMonth
        ),
        owner: task.owner || originalWorkstream.owner,
        description: task.description || originalWorkstream.description
      };
    });
  }
  
  // Update timeline
  updatedProgram.timeline = {
    ...epmProgram.timeline,
    totalMonths: schedule.totalMonths,
    phases: schedule.phases,
    criticalPath: schedule.criticalPath,
    milestones: schedule.milestones
  };
  
  // Update stage gates to align with phases
  if (updatedProgram.stageGates?.gates) {
    updatedProgram.stageGates.gates = updatedProgram.stageGates.gates.map((gate: any, index: number) => {
      const phase = schedule.phases?.[index];
      if (phase) {
        return {
          ...gate,
          month: phase.endMonth,
          date: phase.endDate
        };
      }
      return gate;
    });
  }
  
  return updatedProgram;
}

/**
 * Ensure all deliverables fall within workstream bounds
 */
function ensureDeliverablesWithinBounds(
  deliverables: any[],
  startMonth: number,
  endMonth: number
): any[] {
  return deliverables.map(d => ({
    ...d,
    dueMonth: Math.max(startMonth, Math.min(endMonth, d.dueMonth))
  }));
}

/**
 * Generate phases from schedule
 */
function generatePhasesFromSchedule(schedule: any): any[] {
  const totalMonths = schedule.totalDuration;
  const phases = [];
  
  // Divide into 3-4 logical phases
  const phaseCount = totalMonths <= 6 ? 2 : totalMonths <= 12 ? 3 : 4;
  const monthsPerPhase = Math.ceil(totalMonths / phaseCount);
  
  const phaseNames = [
    'Planning & Setup',
    'Development & Execution',
    'Testing & Validation',
    'Deployment & Handover'
  ];
  
  for (let i = 0; i < phaseCount; i++) {
    const startMonth = i * monthsPerPhase;
    const endMonth = Math.min((i + 1) * monthsPerPhase - 1, totalMonths - 1);
    
    phases.push({
      phase: i + 1,
      name: phaseNames[i],
      startMonth,
      endMonth,
      startDate: new Date(Date.now() + startMonth * 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + (endMonth + 1) * 30 * 24 * 60 * 60 * 1000)
    });
  }
  
  return phases;
}

/**
 * Extract milestones from schedule
 */
function extractMilestonesFromSchedule(schedule: any): any[] {
  const milestones = [];
  
  // Extract deliverable milestones
  schedule.tasks.forEach((task: any) => {
    if (task.deliverables?.length > 0) {
      task.deliverables.forEach((deliverable: any) => {
        milestones.push({
          id: deliverable.id,
          name: deliverable.name,
          date: new Date(Date.now() + deliverable.dueMonth * 30 * 24 * 60 * 60 * 1000),
          type: 'deliverable',
          workstreamId: task.id
        });
      });
    }
  });
  
  // Add phase completion milestones
  const phases = generatePhasesFromSchedule(schedule);
  phases.forEach(phase => {
    milestones.push({
      id: `phase-${phase.phase}-complete`,
      name: `${phase.name} Complete`,
      date: phase.endDate,
      type: 'phase',
      phaseId: phase.phase
    });
  });
  
  return milestones;
}
