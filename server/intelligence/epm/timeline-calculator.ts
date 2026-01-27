/**
 * TimelineCalculator - Calculates project timelines
 * 
 * Handles timeline generation, phase creation, and critical path identification.
 */

import type { StrategyInsights, UserContext, Workstream, Timeline, TimelinePhase } from '../types';
import type { ITimelineCalculator } from '../../types/interfaces';

export class TimelineCalculator implements ITimelineCalculator {
  /**
   * Generate timeline from insights and workstreams
   */
  async calculate(
    insights: StrategyInsights,
    workstreams: Workstream[],
    userContext?: UserContext
  ): Promise<Timeline> {
    const timelineInsight = insights.insights.find(i => i.type === 'timeline');
    
    let baseMonths = 12;
    if (insights.marketContext.urgency === 'ASAP') {
      baseMonths = 6;
    } else if (insights.marketContext.urgency === 'Exploratory') {
      baseMonths = 18;
    }
    
    let deadlineMonths = baseMonths;
    if (userContext?.hardDeadlines && userContext.hardDeadlines.length > 0) {
      const earliestDeadline = Math.min(...userContext.hardDeadlines.map(d => 
        Math.ceil((d.date.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000))
      ));
      deadlineMonths = earliestDeadline;
    }

    let maxWorkstreamEnd = 0;
    if (workstreams.length > 0) {
      maxWorkstreamEnd = Math.max(...workstreams.map(w => w.endMonth));
    }

    // Use actual workstream duration if available, otherwise fall back to baseMonths
    // Add buffer for stabilization phase (at least 1 month after last workstream)
    const effectiveDuration = maxWorkstreamEnd > 0 ? maxWorkstreamEnd + 1 : baseMonths;
    const totalMonths = Math.max(effectiveDuration, 3); // Minimum 3 months for meaningful phases
    
    console.log(`[TimelineCalculator] 📊 Timeline calculation:`);
    console.log(`  - Workstream count: ${workstreams.length}`);
    console.log(`  - Max workstream end: M${maxWorkstreamEnd}`);
    console.log(`  - Base months (from urgency): ${baseMonths}`);
    console.log(`  - Effective duration: ${effectiveDuration}`);
    console.log(`  - Total months: ${totalMonths}`);
    
    if (deadlineMonths < totalMonths && userContext?.hardDeadlines) {
      console.warn(
        `[TimelineCalculator] Hard deadline at M${deadlineMonths} exceeded by corrected schedule (M${totalMonths}). ` +
        `Consider resource optimization or deadline renegotiation.`
      );
    }

    const phases = this.generatePhases(totalMonths, workstreams);
    const criticalPath = this.identifyCriticalPath(workstreams);

    return {
      totalMonths,
      phases,
      criticalPath,
      confidence: timelineInsight?.confidence || 0.65,
    };
  }

  /**
   * Generate project phases
   */
  generatePhases(totalMonths: number, workstreams: Workstream[]): TimelinePhase[] {
    const phaseDuration = Math.ceil(totalMonths / 4);
    
    return [
      {
        phase: 1,
        name: 'Planning & Foundation',
        startMonth: 0,
        endMonth: phaseDuration,
        description: 'Initial setup, team assembly, detailed planning',
        keyMilestones: ['Project kickoff', 'Team onboarded', 'Detailed plan approved'],
        workstreamIds: workstreams.filter(w => w.startMonth <= phaseDuration).map(w => w.id),
      },
      {
        phase: 2,
        name: 'Development & Execution',
        startMonth: phaseDuration,
        endMonth: phaseDuration * 2,
        description: 'Core workstream execution, deliverable development',
        keyMilestones: ['Key deliverables completed', 'Progress review', 'Adjustments made'],
        workstreamIds: workstreams.filter(w => w.startMonth > phaseDuration && w.startMonth <= phaseDuration * 2).map(w => w.id),
      },
      {
        phase: 3,
        name: 'Integration & Testing',
        startMonth: phaseDuration * 2,
        endMonth: phaseDuration * 3,
        description: 'Integration of deliverables, testing, refinement',
        keyMilestones: ['Integration complete', 'Testing passed', 'Stakeholder approval'],
        workstreamIds: workstreams.filter(w => w.endMonth > phaseDuration * 2 && w.endMonth <= phaseDuration * 3).map(w => w.id),
      },
      {
        phase: 4,
        name: 'Deployment & Stabilization',
        startMonth: phaseDuration * 3,
        endMonth: totalMonths,
        description: 'Launch, monitoring, optimization',
        keyMilestones: ['Launch complete', 'Performance validated', 'Benefits tracking'],
        workstreamIds: workstreams.filter(w => w.endMonth > phaseDuration * 3).map(w => w.id),
      },
    ];
  }

  /**
   * Identify critical path (longest dependency chain)
   */
  identifyCriticalPath(workstreams: Workstream[]): string[] {
    if (workstreams.length === 0) return [];
    
    const pathLengths = workstreams.map(w => {
      let length = w.endMonth - w.startMonth;
      let current = w;
      
      while (current.dependencies.length > 0) {
        const dep = workstreams.find(ws => ws.id === current.dependencies[0]);
        if (dep) {
          length += dep.endMonth - dep.startMonth;
          current = dep;
        } else {
          break;
        }
      }
      
      return { workstream: w, length };
    });

    const longest = pathLengths.sort((a, b) => b.length - a.length)[0];
    return [longest.workstream.id];
  }
}

export default TimelineCalculator;
