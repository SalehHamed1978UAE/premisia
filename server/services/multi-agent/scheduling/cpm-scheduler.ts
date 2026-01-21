export interface WorkstreamScheduleInput {
  id: string;
  name: string;
  estimatedDurationMonths: number;
  dependencies: string[];
  deliverables: { id: string; name: string; relativeMonth: number }[];
}

export interface ScheduledDeliverable {
  id: string;
  name: string;
  relativeMonth: number;
  dueMonth: number;
  dueDate: Date;
}

export interface ScheduledWorkstream {
  id: string;
  name: string;
  startMonth: number;
  endMonth: number;
  startDate: Date;
  endDate: Date;
  isOnCriticalPath: boolean;
  floatMonths: number;
  dependencies: string[];
  deliverables: ScheduledDeliverable[];
}

export interface Phase {
  name: string;
  phase: number;
  startMonth: number;
  endMonth: number;
  startDate: Date;
  endDate: Date;
  workstreamIds: string[];
}

export interface Milestone {
  id: string;
  name: string;
  month: number;
  date: Date;
  workstreamId: string;
}

export interface GanttRow {
  id: string;
  name: string;
  startMonth: number;
  endMonth: number;
  duration: number;
  dependencies: string[];
  isOnCriticalPath: boolean;
  startPercent: number;
  widthPercent: number;
  milestones: {
    id: string;
    name: string;
    monthPercent: number;
  }[];
}

export interface Timeline {
  phases: Phase[];
  milestones: Milestone[];
  totalMonths: number;
  criticalPath: string[];
  ganttData: GanttRow[];
}

export class CPMScheduler {
  schedule(
    workstreams: WorkstreamScheduleInput[],
    programStartDate: Date
  ): { scheduled: ScheduledWorkstream[]; timeline: Timeline } {
    if (workstreams.length === 0) {
      return {
        scheduled: [],
        timeline: {
          phases: [],
          milestones: [],
          totalMonths: 0,
          criticalPath: [],
          ganttData: [],
        },
      };
    }

    const graph = this.buildDependencyGraph(workstreams);
    const earliestStart = this.forwardPass(workstreams, graph);
    
    const earliestFinish = new Map<string, number>();
    for (const ws of workstreams) {
      earliestFinish.set(ws.id, (earliestStart.get(ws.id) || 0) + ws.estimatedDurationMonths);
    }

    const projectEndMonth = Math.max(...Array.from(earliestFinish.values()));
    const latestFinish = this.backwardPass(workstreams, graph, projectEndMonth);
    
    const latestStart = new Map<string, number>();
    for (const ws of workstreams) {
      latestStart.set(ws.id, (latestFinish.get(ws.id) || projectEndMonth) - ws.estimatedDurationMonths);
    }

    const criticalPath: string[] = [];
    const scheduled: ScheduledWorkstream[] = workstreams.map(ws => {
      const esMonth = earliestStart.get(ws.id) || 0;
      const efMonth = earliestFinish.get(ws.id) || ws.estimatedDurationMonths;
      const lsMonth = latestStart.get(ws.id) || 0;
      const float = lsMonth - esMonth;

      const isOnCriticalPath = float === 0;
      if (isOnCriticalPath) {
        criticalPath.push(ws.id);
      }

      return {
        id: ws.id,
        name: ws.name,
        startMonth: esMonth,
        endMonth: efMonth,
        startDate: this.addMonths(programStartDate, esMonth),
        endDate: this.addMonths(programStartDate, efMonth),
        isOnCriticalPath,
        floatMonths: float,
        dependencies: ws.dependencies,
        deliverables: ws.deliverables.map(d => ({
          ...d,
          dueMonth: esMonth + d.relativeMonth,
          dueDate: this.addMonths(programStartDate, esMonth + d.relativeMonth),
        })),
      };
    });

    criticalPath.sort((a, b) =>
      (earliestStart.get(a) || 0) - (earliestStart.get(b) || 0)
    );

    const phases = this.generatePhases(scheduled, projectEndMonth, programStartDate);
    const milestones = this.generateMilestones(scheduled);
    const ganttData = this.generateGanttData(scheduled, projectEndMonth);

    return {
      scheduled,
      timeline: {
        phases,
        milestones,
        totalMonths: projectEndMonth,
        criticalPath,
        ganttData,
      },
    };
  }

  private forwardPass(
    workstreams: WorkstreamScheduleInput[],
    graph: Map<string, string[]>
  ): Map<string, number> {
    const earliestStart = new Map<string, number>();
    const sorted = this.topologicalSort(workstreams, graph);

    for (const ws of sorted) {
      if (ws.dependencies.length === 0) {
        earliestStart.set(ws.id, 0);
      } else {
        const maxDependencyEnd = Math.max(
          ...ws.dependencies.map(depId => {
            const dep = workstreams.find(w => w.id === depId);
            if (!dep) return 0;
            return (earliestStart.get(depId) || 0) + dep.estimatedDurationMonths;
          })
        );
        earliestStart.set(ws.id, maxDependencyEnd);
      }
    }

    return earliestStart;
  }

  private backwardPass(
    workstreams: WorkstreamScheduleInput[],
    graph: Map<string, string[]>,
    projectEndMonth: number
  ): Map<string, number> {
    const latestFinish = new Map<string, number>();
    const sorted = this.topologicalSort(workstreams, graph).reverse();

    const dependents = new Map<string, string[]>();
    for (const ws of workstreams) {
      dependents.set(ws.id, []);
    }
    for (const ws of workstreams) {
      for (const depId of ws.dependencies) {
        const deps = dependents.get(depId);
        if (deps) deps.push(ws.id);
      }
    }

    for (const ws of sorted) {
      const myDependents = dependents.get(ws.id) || [];
      if (myDependents.length === 0) {
        latestFinish.set(ws.id, projectEndMonth);
      } else {
        const minDependentStart = Math.min(
          ...myDependents.map(depId => {
            const dep = workstreams.find(w => w.id === depId);
            if (!dep) return projectEndMonth;
            return (latestFinish.get(depId) || projectEndMonth) - dep.estimatedDurationMonths;
          })
        );
        latestFinish.set(ws.id, minDependentStart);
      }
    }

    return latestFinish;
  }

  private generatePhases(
    scheduled: ScheduledWorkstream[],
    totalMonths: number,
    programStartDate: Date
  ): Phase[] {
    if (totalMonths === 0) return [];
    
    const phaseLength = Math.ceil(totalMonths / 3);

    return [
      {
        name: 'Planning & Setup',
        phase: 1,
        startMonth: 0,
        endMonth: phaseLength,
        startDate: programStartDate,
        endDate: this.addMonths(programStartDate, phaseLength),
        workstreamIds: scheduled.filter(ws => ws.startMonth < phaseLength).map(ws => ws.id),
      },
      {
        name: 'Development & Execution',
        phase: 2,
        startMonth: phaseLength,
        endMonth: phaseLength * 2,
        startDate: this.addMonths(programStartDate, phaseLength),
        endDate: this.addMonths(programStartDate, phaseLength * 2),
        workstreamIds: scheduled.filter(ws =>
          ws.startMonth >= phaseLength && ws.startMonth < phaseLength * 2
        ).map(ws => ws.id),
      },
      {
        name: 'Testing & Validation',
        phase: 3,
        startMonth: phaseLength * 2,
        endMonth: totalMonths,
        startDate: this.addMonths(programStartDate, phaseLength * 2),
        endDate: this.addMonths(programStartDate, totalMonths),
        workstreamIds: scheduled.filter(ws => ws.startMonth >= phaseLength * 2).map(ws => ws.id),
      },
    ];
  }

  private generateMilestones(scheduled: ScheduledWorkstream[]): Milestone[] {
    const milestones: Milestone[] = [];
    
    for (const ws of scheduled) {
      for (const d of ws.deliverables) {
        milestones.push({
          id: d.id,
          name: d.name,
          month: d.dueMonth,
          date: d.dueDate,
          workstreamId: ws.id,
        });
      }
    }
    
    return milestones.sort((a, b) => a.month - b.month);
  }

  private generateGanttData(scheduled: ScheduledWorkstream[], totalMonths: number): GanttRow[] {
    if (totalMonths === 0) return [];
    
    return scheduled.map(ws => ({
      id: ws.id,
      name: ws.name,
      startMonth: ws.startMonth,
      endMonth: ws.endMonth,
      duration: ws.endMonth - ws.startMonth,
      dependencies: ws.dependencies,
      isOnCriticalPath: ws.isOnCriticalPath,
      startPercent: (ws.startMonth / totalMonths) * 100,
      widthPercent: ((ws.endMonth - ws.startMonth) / totalMonths) * 100,
      milestones: ws.deliverables.map(d => ({
        id: d.id,
        name: d.name,
        monthPercent: (d.dueMonth / totalMonths) * 100,
      })),
    }));
  }

  private topologicalSort(
    workstreams: WorkstreamScheduleInput[],
    graph: Map<string, string[]>
  ): WorkstreamScheduleInput[] {
    const visited = new Set<string>();
    const result: WorkstreamScheduleInput[] = [];

    const visit = (ws: WorkstreamScheduleInput) => {
      if (visited.has(ws.id)) return;
      visited.add(ws.id);

      for (const depId of ws.dependencies) {
        const dep = workstreams.find(w => w.id === depId);
        if (dep) visit(dep);
      }

      result.push(ws);
    };

    for (const ws of workstreams) {
      visit(ws);
    }

    return result;
  }

  private buildDependencyGraph(workstreams: WorkstreamScheduleInput[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    for (const ws of workstreams) {
      graph.set(ws.id, ws.dependencies);
    }
    return graph;
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }
}

export const cpmScheduler = new CPMScheduler();
