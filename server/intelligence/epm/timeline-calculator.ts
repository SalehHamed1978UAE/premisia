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
   * Generate project phases aligned with actual workstream execution windows
   *
   * Phases are divided evenly across the program duration, and workstreams
   * are assigned to phases based on when they EXECUTE (overlap with phase window),
   * not just when they start.
   */
  generatePhases(totalMonths: number, workstreams: Workstream[]): TimelinePhase[] {
    // Determine optimal phase count based on duration
    const phaseCount = totalMonths <= 4 ? 2 : totalMonths <= 8 ? 3 : 4;
    const phaseDuration = Math.ceil(totalMonths / phaseCount);

    const phaseConfigs = [
      { name: 'Planning & Foundation', description: 'Initial setup, team assembly, detailed planning', milestones: ['Project kickoff', 'Team onboarded', 'Detailed plan approved'] },
      { name: 'Development & Execution', description: 'Core workstream execution, deliverable development', milestones: ['Key deliverables completed', 'Progress review', 'Adjustments made'] },
      { name: 'Integration & Testing', description: 'Integration of deliverables, testing, refinement', milestones: ['Integration complete', 'Testing passed', 'Stakeholder approval'] },
      { name: 'Deployment & Stabilization', description: 'Launch, monitoring, optimization', milestones: ['Launch complete', 'Performance validated', 'Benefits tracking'] },
    ];

    const phases: TimelinePhase[] = [];

    for (let i = 0; i < phaseCount; i++) {
      const phaseStart = i * phaseDuration;
      const phaseEnd = Math.min((i + 1) * phaseDuration, totalMonths);
      const config = phaseConfigs[i] || phaseConfigs[phaseConfigs.length - 1];

      // Assign workstreams that EXECUTE during this phase (any overlap counts)
      // A workstream executes during a phase if: ws.startMonth < phaseEnd AND ws.endMonth >= phaseStart
      const phaseWorkstreams = workstreams.filter(w =>
        w.startMonth < phaseEnd && w.endMonth >= phaseStart
      );

      phases.push({
        phase: i + 1,
        name: config.name,
        startMonth: phaseStart,
        endMonth: phaseEnd,
        description: config.description,
        keyMilestones: config.milestones,
        workstreamIds: phaseWorkstreams.map(w => w.id),
      });
    }

    console.log(`[TimelineCalculator] Generated ${phaseCount} phases for ${totalMonths} month program:`);
    phases.forEach(p => {
      console.log(`  Phase ${p.phase} (M${p.startMonth}-M${p.endMonth}): ${p.workstreamIds.length} workstreams`);
    });

    return phases;
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
