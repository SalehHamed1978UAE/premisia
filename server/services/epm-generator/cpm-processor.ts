/**
 * CPM Post-Processor
 * 
 * Shared utility for applying Critical Path Method scheduling
 * to EPM programs from any generator (multi-agent or legacy).
 * 
 * Ensures mathematical rigor in scheduling by calculating:
 * - Early/late start and finish times
 * - Critical path identification
 * - Slack computation for each workstream
 */

import type { EPMProgram, Workstream, TimelinePhase } from './types';
import { CPMScheduler } from '../../../src/lib/intelligent-planning/scheduler';
import type { Task, Schedule } from '../../../src/lib/intelligent-planning/types';

/**
 * Build timeline phases from CPM schedule
 * Uses legacy logic: Planning/Execution/Validation segments
 */
function buildPhasesFromSchedule(schedule: Schedule, workstreams: Workstream[]): TimelinePhase[] {
  const totalMonths = schedule.totalDuration;
  
  const planningEnd = Math.max(1, Math.floor(totalMonths * 0.25));
  const executionEnd = Math.max(planningEnd + 1, Math.floor(totalMonths * 0.8));
  
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
 * Post-process EPM program with CPM scheduling
 * 
 * Applies Critical Path Method to workstreams:
 * - Calculates proper early/late start times
 * - Identifies critical path
 * - Computes slack for each workstream
 * - Ensures dependency ordering is respected
 * 
 * @param program - EPM program to process
 * @returns Updated EPM program with CPM scheduling applied
 */
export function postProcessWithCPM(program: EPMProgram): EPMProgram {
  console.log('[CPM] Starting post-processing for', program.workstreams?.length || 0, 'workstreams');
  
  if (!program.workstreams || program.workstreams.length === 0) {
    console.log('[CPM] No workstreams to process');
    return program;
  }
  
  try {
    const tasks: Task[] = program.workstreams.map((ws: Workstream) => {
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
    
    const scheduler = new CPMScheduler();
    const schedule = scheduler.schedule(tasks);
    
    console.log('[CPM] Schedule computed: totalDuration=', schedule.totalDuration, 'criticalPath=', schedule.criticalPath);
    
    for (const scheduled of schedule.tasks) {
      const ws = program.workstreams.find(w => w.id === scheduled.id);
      if (ws) {
        ws.startMonth = scheduled.earlyStart;
        ws.endMonth = scheduled.earlyFinish;
        ws.startDate = scheduled.startDate;
        ws.endDate = scheduled.endDate;
        ws.earlyStart = scheduled.earlyStart;
        ws.lateStart = scheduled.lateStart;
        ws.earlyFinish = scheduled.earlyFinish;
        ws.lateFinish = scheduled.lateFinish;
        ws.slack = scheduled.slack;
        ws.isCritical = scheduled.isCritical;
      }
    }
    
    program.timeline = {
      ...program.timeline,
      totalMonths: schedule.totalDuration,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      criticalPath: schedule.criticalPath,
      phases: buildPhasesFromSchedule(schedule, program.workstreams),
      confidence: program.timeline?.confidence || 0.85,
    };
    
    console.log('[CPM] Post-processing complete. Critical workstreams:', 
      program.workstreams.filter(w => w.isCritical).map(w => w.name).join(', '));
    
    return program;
    
  } catch (error) {
    console.error('[CPM] Post-processing failed:', error);
    return program;
  }
}
