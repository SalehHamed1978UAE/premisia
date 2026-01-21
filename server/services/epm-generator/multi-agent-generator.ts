/**
 * Multi-Agent EPM Generator
 * 
 * HTTP client for the CrewAI Python service.
 * Handles communication, timeouts, and health checks.
 * 
 * Includes CPM post-processing to apply Critical Path Method scheduling
 * to the agent-generated workstreams, ensuring mathematical rigor.
 */

import type { IEPMGenerator, EPMGeneratorInput, EPMGeneratorOutput, EPMProgram, Workstream, TimelinePhase } from './types';
import { createCFIntegration } from './cf-integration';
import { CPMScheduler } from '../../../src/lib/intelligent-planning/scheduler';
import type { Task, Schedule } from '../../../src/lib/intelligent-planning/types';

/**
 * Build timeline phases from CPM schedule
 * Uses legacy logic: Planning/Execution/Validation segments
 */
function buildPhasesFromSchedule(schedule: Schedule, workstreams: Workstream[]): TimelinePhase[] {
  const totalMonths = schedule.totalDuration;
  
  // Default phase boundaries based on total duration
  const planningEnd = Math.max(1, Math.floor(totalMonths * 0.25));
  const executionEnd = Math.max(planningEnd + 1, Math.floor(totalMonths * 0.8));
  
  // Assign workstreams to phases based on their start times
  const planningWorkstreams: string[] = [];
  const executionWorkstreams: string[] = [];
  const validationWorkstreams: string[] = [];
  
  for (const ws of workstreams) {
    if (ws.startMonth < planningEnd) {
      planningWorkstreams.push(ws.id);
    } else if (ws.startMonth < executionEnd) {
      executionWorkstreams.push(ws.id);
    } else {
      validationWorkstreams.push(ws.id);
    }
  }
  
  return [
    {
      id: 'phase-1',
      name: 'Planning & Setup',
      startMonth: 0,
      endMonth: planningEnd,
      workstreamIds: planningWorkstreams,
      milestones: [{
        id: 'ms-1',
        name: 'Planning Complete',
        dueMonth: planningEnd,
        deliverableIds: []
      }]
    },
    {
      id: 'phase-2',
      name: 'Development & Execution',
      startMonth: planningEnd,
      endMonth: executionEnd,
      workstreamIds: executionWorkstreams,
      milestones: [{
        id: 'ms-2',
        name: 'Core Execution Complete',
        dueMonth: executionEnd,
        deliverableIds: []
      }]
    },
    {
      id: 'phase-3',
      name: 'Testing & Validation',
      startMonth: executionEnd,
      endMonth: totalMonths,
      workstreamIds: validationWorkstreams,
      milestones: [{
        id: 'ms-3',
        name: 'Program Complete',
        dueMonth: totalMonths,
        deliverableIds: []
      }]
    }
  ];
}

/**
 * Post-process CrewAI output with CPM scheduling
 * 
 * Applies Critical Path Method to agent-generated workstreams:
 * - Calculates proper early/late start times
 * - Identifies critical path
 * - Computes slack for each workstream
 * - Ensures dependency ordering is respected
 */
function postProcessWithCPM(program: EPMProgram): EPMProgram {
  console.log('[CPM] Starting post-processing for', program.workstreams?.length || 0, 'workstreams');
  
  if (!program.workstreams || program.workstreams.length === 0) {
    console.log('[CPM] No workstreams to process');
    return program;
  }
  
  try {
    // Convert agent workstreams to CPM tasks with defensive duration calculation
    const tasks: Task[] = program.workstreams.map((ws: Workstream) => {
      // Defensive duration calculation - handle zero or missing durations
      const proposedDuration = (ws.endMonth || 0) - (ws.startMonth || 0);
      const fallbackDuration = ws.deliverables?.length || 2;
      const baseDuration = proposedDuration > 0 ? proposedDuration : fallbackDuration;
      
      return {
        id: ws.id,
        name: ws.name,
        dependencies: ws.dependencies || [],
        duration: {
          optimistic: Math.max(1, baseDuration * 0.75),
          likely: Math.max(1, baseDuration),
          pessimistic: Math.max(2, baseDuration * 1.5),
          unit: 'months' as const,
        },
        requirements: ws.resourceRequirements?.map(r => ({
          skill: r.role,
          quantity: 1,
          duration: baseDuration
        })) || []
      };
    });
    
    // Run CPM scheduling
    const scheduler = new CPMScheduler();
    const schedule = scheduler.schedule(tasks);
    
    console.log('[CPM] Schedule computed: totalDuration=', schedule.totalDuration, 'criticalPath=', schedule.criticalPath);
    
    // Update workstreams with CPM-calculated values
    for (const scheduled of schedule.tasks) {
      const ws = program.workstreams.find(w => w.id === scheduled.id);
      if (ws) {
        ws.startMonth = scheduled.earlyStart;
        ws.endMonth = scheduled.earlyFinish;
        ws.startDate = scheduled.startDate;
        ws.endDate = scheduled.endDate;
        ws.slack = scheduled.slack;
        ws.isCritical = scheduled.isCritical;
      }
    }
    
    // Build proper timeline object with CPM data
    program.timeline = {
      totalMonths: schedule.totalDuration,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      criticalPath: schedule.criticalPath,
      phases: buildPhasesFromSchedule(schedule, program.workstreams),
      confidence: 0.85,
    };
    
    console.log('[CPM] Post-processing complete. Critical workstreams:', 
      program.workstreams.filter(w => w.isCritical).map(w => w.name).join(', '));
    
    return program;
    
  } catch (error) {
    console.error('[CPM] Post-processing failed:', error);
    // Return original program if CPM fails - don't break the pipeline
    return program;
  }
}

export class MultiAgentEPMGenerator implements IEPMGenerator {
  private serviceUrl: string;
  private timeout: number;

  constructor() {
    const serviceUrl = process.env.CREWAI_SERVICE_URL;
    if (!serviceUrl) {
      console.warn('[MultiAgentGenerator] CREWAI_SERVICE_URL not set - multi-agent generation will not be available');
    }
    this.serviceUrl = serviceUrl || '';
    this.timeout = 600000; // 10 minutes - multi-agent collaboration takes time
  }

  /**
   * Check if the CrewAI service is available
   */
  async isHealthy(): Promise<boolean> {
    if (!this.serviceUrl) {
      console.error('[MultiAgentGenerator] CREWAI_SERVICE_URL not configured');
      return false;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.serviceUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('[MultiAgentGenerator] Health check failed:', error);
      return false;
    }
  }

  /**
   * Generate EPM program using multi-agent collaboration
   */
  async generate(input: EPMGeneratorInput): Promise<EPMGeneratorOutput> {
    const startTime = Date.now();
    console.log('[MultiAgentGenerator] Starting multi-agent collaboration');
    console.log(`[MultiAgentGenerator] Service URL: ${this.serviceUrl}`);
    console.log(`[MultiAgentGenerator] Session: ${input.sessionId}`);

    // Check service health first
    const healthy = await this.isHealthy();
    if (!healthy) {
      throw new Error('CrewAI service is not available. Check if the Python service is running.');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.serviceUrl}/generate-program`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_context: {
            name: input.businessContext.name,
            type: input.businessContext.type,
            scale: input.businessContext.scale,
            description: input.businessContext.description,
            industry: input.businessContext.industry,
            keywords: input.businessContext.keywords,
          },
          bmc_insights: input.bmcInsights,
          strategy_insights: input.strategyInsights,
          constraints: input.constraints ? {
            budget: input.constraints.budget,
            deadline: input.constraints.deadline?.toISOString(),
            regulations: input.constraints.regulations,
            resource_limits: input.constraints.resourceLimits,
          } : null,
          user_id: input.userId,
          session_id: input.sessionId,
          journey_type: input.journeyType,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`CrewAI service error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const generationTime = Date.now() - startTime;

      console.log('[MultiAgentGenerator] Generation complete');
      console.log(`[MultiAgentGenerator] Rounds completed: ${result.metadata?.roundsCompleted || 'unknown'}`);
      console.log(`[MultiAgentGenerator] Agents participated: ${result.metadata?.agentsParticipated || 'unknown'}`);
      console.log(`[MultiAgentGenerator] Generation time: ${(generationTime / 1000).toFixed(1)}s`);

      // Apply CPM post-processing to add mathematical scheduling rigor
      if (result.program) {
        console.log('[MultiAgentGenerator] Applying CPM post-processing...');
        result.program = postProcessWithCPM(result.program);
      }

      // Process knowledge ledger through CF integration
      if (result.knowledgeLedger) {
        const cfHook = createCFIntegration();
        
        // Send individual emissions
        for (const emission of result.knowledgeLedger.emissions || []) {
          await cfHook.onKnowledgeEmission(emission);
        }
        
        // Send complete ledger
        await cfHook.onLedgerComplete(result.knowledgeLedger);
        
        console.log(`[MultiAgentGenerator] Knowledge emissions: ${result.knowledgeLedger.stats?.emitted || 0}`);
      }

      // Ensure metadata includes generation time
      return {
        ...result,
        metadata: {
          ...result.metadata,
          generator: 'multi-agent' as const,
          generationTimeMs: generationTime,
        },
      };

    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Multi-agent generation timed out after 10 minutes');
      }
      throw error;
    }
  }
}
