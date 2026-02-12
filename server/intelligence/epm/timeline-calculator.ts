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
    const effectiveDuration = maxWorkstreamEnd > 0 ? maxWorkstreamEnd + 1 : baseMonths;
    const constraintMax = userContext?.timelineRange?.max;

    let totalMonths: number;
    let timelineViolation: boolean;
    let phases: TimelinePhase[];

    if (constraintMax) {
      console.log(`[Timeline] Effective: ${effectiveDuration}mo, Constraint: ${constraintMax}mo`);

      if (effectiveDuration < constraintMax) {
        // CASE A: Constraint exceeds effective duration - add stabilization phase
        const workPhases = this.generatePhases(effectiveDuration, workstreams);
        const stabilizationPhase: TimelinePhase = {
          phase: workPhases.length + 1,
          name: 'Stabilization & Buffer',
          startMonth: effectiveDuration,
          endMonth: constraintMax,
          description: 'Testing, stabilization, risk mitigation, and buffer period',
          keyMilestones: [
            'Production readiness validation',
            'Stakeholder acceptance',
            'Program completion',
          ],
          workstreamIds: [],
        };

        phases = [...workPhases, stabilizationPhase];
        totalMonths = constraintMax;
        timelineViolation = false;

        console.log(`[Timeline] Extended to ${constraintMax}mo with stabilization phase (months ${effectiveDuration}-${constraintMax})`);
      } else if (effectiveDuration > constraintMax) {
        // CASE B: Violation - workstreams need more time than constraint allows
        phases = this.generatePhases(effectiveDuration, workstreams);
        totalMonths = constraintMax; // Cap at constraint
        timelineViolation = true;

        console.log(`[Timeline] Violation: Workstreams need ${effectiveDuration}mo but constraint is ${constraintMax}mo`);
      } else {
        // CASE C: Exact match - no buffer needed
        phases = this.generatePhases(effectiveDuration, workstreams);
        totalMonths = constraintMax;
        timelineViolation = false;

        console.log(`[Timeline] Exact match at ${constraintMax}mo`);
      }

      console.log(`[Timeline] Final: ${totalMonths}mo`);
    } else {
      // No constraint - use effective duration (preserve existing behavior)
      totalMonths = Math.max(effectiveDuration, 3); // Minimum 3 months for meaningful phases
      phases = this.generatePhases(totalMonths, workstreams);
      timelineViolation = false;
    }

    console.log(`[TimelineCalculator] 📊 Timeline calculation:`);
    console.log(`  - Workstream count: ${workstreams.length}`);
    console.log(`  - Max workstream end: M${maxWorkstreamEnd}`);
    console.log(`  - Base months (from urgency): ${baseMonths}`);
    console.log(`  - Effective duration: ${effectiveDuration}`);
    console.log(`  - Constraint: ${constraintMax || 'none'}`);
    console.log(`  - Total months: ${totalMonths}`);
    console.log(`  - Timeline violation: ${timelineViolation}`);

    if (deadlineMonths < totalMonths && userContext?.hardDeadlines) {
      console.warn(
        `[TimelineCalculator] Hard deadline at M${deadlineMonths} exceeded by corrected schedule (M${totalMonths}). ` +
        `Consider resource optimization or deadline renegotiation.`
      );
    }

    const criticalPath = this.identifyCriticalPath(workstreams);

    return {
      totalMonths,
      phases,
      criticalPath,
      confidence: timelineInsight?.confidence || 0.65,
      timelineViolation,
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

      if (phaseStart > phaseEnd) {
        continue;
      }

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

    const computeLongestPath = (streams: Workstream[]): string[] => {
      if (streams.length === 0) return [];

      const byId = new Map(streams.map((ws) => [ws.id, ws]));
      const inDegree = new Map<string, number>();
      const dependents = new Map<string, string[]>();

      for (const ws of streams) {
        inDegree.set(ws.id, 0);
        dependents.set(ws.id, []);
      }

      for (const ws of streams) {
        for (const depId of ws.dependencies || []) {
          if (!byId.has(depId)) continue;
          inDegree.set(ws.id, (inDegree.get(ws.id) || 0) + 1);
          dependents.get(depId)?.push(ws.id);
        }
      }

      const queue: string[] = streams
        .filter((ws) => (inDegree.get(ws.id) || 0) === 0)
        .map((ws) => ws.id);
      const topo: string[] = [];

      while (queue.length > 0) {
        const id = queue.shift() as string;
        topo.push(id);

        for (const dependentId of dependents.get(id) || []) {
          const nextDegree = (inDegree.get(dependentId) || 0) - 1;
          inDegree.set(dependentId, nextDegree);
          if (nextDegree === 0) queue.push(dependentId);
        }
      }

      // Cyclic dependencies should already be handled upstream; degrade gracefully here.
      if (topo.length !== streams.length) {
        const longest = [...streams].sort(
          (a, b) => (b.endMonth - b.startMonth) - (a.endMonth - a.startMonth)
        )[0];
        return longest ? [longest.id] : [];
      }

      const scoreById = new Map<string, number>();
      const predecessorById = new Map<string, string | null>();

      for (const id of topo) {
        const ws = byId.get(id)!;
        const duration = Math.max(1, ws.endMonth - ws.startMonth + 1);

        let bestPredecessor: string | null = null;
        let bestPredecessorScore = 0;

        for (const depId of ws.dependencies || []) {
          const depScore = scoreById.get(depId);
          if (depScore === undefined) continue;
          if (depScore > bestPredecessorScore) {
            bestPredecessorScore = depScore;
            bestPredecessor = depId;
          }
        }

        scoreById.set(id, duration + bestPredecessorScore);
        predecessorById.set(id, bestPredecessor);
      }

      let criticalEndId: string | null = null;
      let maxScore = -1;
      scoreById.forEach((score, id) => {
        if (score > maxScore) {
          maxScore = score;
          criticalEndId = id;
        }
      });

      if (!criticalEndId) return [];

      const path: string[] = [];
      let cursor: string | null = criticalEndId;
      while (cursor) {
        path.push(cursor);
        cursor = predecessorById.get(cursor) || null;
      }

      return path.reverse();
    };

    const isDecisionWorkstream = (ws?: Workstream): boolean => {
      if (!ws) return false;
      const name = ws.name?.toLowerCase() || '';
      const id = ws.id?.toLowerCase() || '';
      return id.startsWith('decision_') || name.includes('decision implementation');
    };

    const primaryPath = computeLongestPath(workstreams);
    if (primaryPath.length === 0) return [];

    const byId = new Map(workstreams.map((ws) => [ws.id, ws]));
    const isDecisionOnly = primaryPath.every((id) => isDecisionWorkstream(byId.get(id)));

    if (isDecisionOnly) {
      const nonDecision = workstreams.filter((ws) => !isDecisionWorkstream(ws));
      const alternativePath = computeLongestPath(nonDecision);
      return alternativePath.length > 0 ? alternativePath : primaryPath;
    }

    return primaryPath;
  }
}

export default TimelineCalculator;
