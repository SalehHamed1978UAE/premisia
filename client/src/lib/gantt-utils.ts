/**
 * Gantt Chart Utilities
 * 
 * Transforms EPM program data into Gantt chart compatible format
 */

import { Workstream, Timeline, StageGates, Deliverable } from "@/types/intelligence";

export interface GanttTask {
  id: string;
  name: string;
  type: 'workstream' | 'deliverable' | 'milestone';
  startMonth: number;
  endMonth: number;
  duration: number;
  dependencies: string[];
  isCriticalPath: boolean;
  confidence: number;
  owner?: string;
  description?: string;
  deliverables?: GanttDeliverable[];
  workstreamId?: string; // For deliverables, which workstream they belong to
  assignedResourceIds?: string[]; // Resource IDs assigned to this task
  assignedResourceNames?: string[]; // Resource names assigned to this task
}

export interface GanttDeliverable {
  id: string;
  name: string;
  dueMonth: number;
  effort: string;
  description: string;
}

export interface GanttPhase {
  phase: number;
  name: string;
  startMonth: number;
  endMonth: number;
  color: string;
}

export interface GanttStageGate {
  gate: number;
  name: string;
  month: number;
  color: string;
}

export interface GanttDependency {
  fromId: string;
  toId: string;
  type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish';
  isCritical: boolean;
}

export interface GanttChartData {
  tasks: GanttTask[];
  phases: GanttPhase[];
  stageGates: GanttStageGate[];
  dependencies: GanttDependency[];
  totalMonths: number;
  criticalPath: string[];
  maxMonth: number;
}

/**
 * Transform EPM program data into Gantt chart format
 */
export function transformToGanttData(
  workstreams: Workstream[],
  timeline: Timeline,
  stageGates: StageGates
): GanttChartData {
  const criticalPathSet = new Set(timeline.criticalPath || []);
  
  // Transform workstreams to tasks
  const tasks: GanttTask[] = workstreams.map(ws => ({
    id: ws.id,
    name: ws.name,
    type: 'workstream' as const,
    startMonth: ws.startMonth,
    endMonth: ws.endMonth,
    duration: ws.endMonth - ws.startMonth + 1,
    dependencies: ws.dependencies || [],
    isCriticalPath: criticalPathSet.has(ws.id) || criticalPathSet.has(ws.name),
    confidence: ws.confidence,
    owner: ws.owner,
    description: ws.description,
    assignedResourceIds: ws.assignedResourceIds || [],
    assignedResourceNames: ws.assignedResourceNames || [],
    deliverables: ws.deliverables?.map(d => {
      // Safety check: Clamp deliverable to workstream timeline
      // This handles legacy programs with invalid data
      let dueMonth = d.dueMonth;
      if (dueMonth < ws.startMonth || dueMonth > ws.endMonth) {
        console.warn(
          `[Gantt] Deliverable "${d.name}" (${d.id}) has dueMonth ${dueMonth} ` +
          `outside workstream "${ws.name}" timeline (M${ws.startMonth}-M${ws.endMonth}). ` +
          `Clamping to M${Math.max(ws.startMonth, Math.min(dueMonth, ws.endMonth))}.`
        );
        dueMonth = Math.max(ws.startMonth, Math.min(dueMonth, ws.endMonth));
      }
      
      return {
        id: d.id,
        name: d.name,
        dueMonth,
        effort: d.effort,
        description: d.description
      };
    }) || []
  }));

  // Transform timeline phases
  const phases: GanttPhase[] = timeline.phases.map(p => ({
    phase: p.phase,
    name: p.name,
    startMonth: p.startMonth,
    endMonth: p.endMonth,
    color: getPhaseColor(p.phase)
  }));

  // Transform stage gates
  const gates: GanttStageGate[] = stageGates.gates.map(g => ({
    gate: g.gate,
    name: g.name,
    month: g.month,
    color: getGateColor(g.gate)
  }));

  // Build dependencies
  const dependencies: GanttDependency[] = [];
  tasks.forEach(task => {
    task.dependencies.forEach(depId => {
      dependencies.push({
        fromId: depId,
        toId: task.id,
        type: 'finish-to-start',
        isCritical: task.isCriticalPath && tasks.find(t => t.id === depId)?.isCriticalPath || false
      });
    });
  });

  // Calculate max month (for chart width)
  const maxMonth = Math.max(
    timeline.totalMonths,
    ...tasks.map(t => t.endMonth),
    ...gates.map(g => g.month)
  );

  return {
    tasks,
    phases,
    stageGates: gates,
    dependencies,
    totalMonths: timeline.totalMonths,
    criticalPath: timeline.criticalPath || [],
    maxMonth
  };
}

/**
 * Calculate task positioning for Gantt chart
 */
export interface TaskPosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculateTaskPositions(
  tasks: GanttTask[],
  monthWidth: number,
  taskHeight: number,
  taskPadding: number,
  leftMargin: number
): TaskPosition[] {
  return tasks.map((task, index) => ({
    id: task.id,
    x: leftMargin + (task.startMonth * monthWidth),
    y: index * (taskHeight + taskPadding),
    width: task.duration * monthWidth,
    height: taskHeight
  }));
}

/**
 * Calculate dependency line paths (SVG paths)
 */
export interface DependencyPath {
  id: string;
  path: string;
  isCritical: boolean;
  fromTask: string;
  toTask: string;
}

export function calculateDependencyPaths(
  dependencies: GanttDependency[],
  taskPositions: Map<string, TaskPosition>,
  taskHeight: number
): DependencyPath[] {
  return dependencies.map((dep, index) => {
    const fromPos = taskPositions.get(dep.fromId);
    const toPos = taskPositions.get(dep.toId);
    
    if (!fromPos || !toPos) {
      return null;
    }

    // Start point: end of from task (middle height)
    const startX = fromPos.x + fromPos.width;
    const startY = fromPos.y + fromPos.height / 2;

    // End point: start of to task (middle height)
    const endX = toPos.x;
    const endY = toPos.y + toPos.height / 2;

    // Calculate path with right angle turns
    const midX = (startX + endX) / 2;
    
    // Path: horizontal -> vertical -> horizontal with arrow
    const path = `
      M ${startX} ${startY}
      L ${midX} ${startY}
      L ${midX} ${endY}
      L ${endX - 8} ${endY}
      M ${endX - 8} ${endY - 4}
      L ${endX} ${endY}
      L ${endX - 8} ${endY + 4}
    `;

    return {
      id: `dep-${index}`,
      path,
      isCritical: dep.isCritical,
      fromTask: dep.fromId,
      toTask: dep.toId
    };
  }).filter(Boolean) as DependencyPath[];
}

/**
 * Get color for timeline phase
 */
function getPhaseColor(phase: number): string {
  const colors = [
    'rgba(59, 130, 246, 0.1)',   // blue-500 alpha 10%
    'rgba(16, 185, 129, 0.1)',   // green-500 alpha 10%
    'rgba(245, 158, 11, 0.1)',   // amber-500 alpha 10%
    'rgba(139, 92, 246, 0.1)',   // violet-500 alpha 10%
    'rgba(236, 72, 153, 0.1)',   // pink-500 alpha 10%
  ];
  return colors[(phase - 1) % colors.length];
}

/**
 * Get color for stage gate
 */
function getGateColor(gate: number): string {
  const colors = [
    '#3b82f6',  // blue-500
    '#10b981',  // green-500
    '#f59e0b',  // amber-500
    '#8b5cf6',  // violet-500
    '#ec4899',  // pink-500
  ];
  return colors[(gate - 1) % colors.length];
}

/**
 * Calculate optimal chart dimensions based on data
 */
export interface ChartDimensions {
  width: number;
  height: number;
  leftMargin: number;
  topMargin: number;
  rightMargin: number;
  bottomMargin: number;
  monthWidth: number;
  taskHeight: number;
  taskPadding: number;
}

export function calculateChartDimensions(
  taskCount: number,
  maxMonth: number,
  containerWidth: number = 1200
): ChartDimensions {
  const leftMargin = 350;  // VERY LARGE - for long task names (was 300)
  const rightMargin = 100;
  const topMargin = 150;   // VERY LARGE - for phase labels (was 120)
  const bottomMargin = 60;
  
  const taskHeight = 50;    // Increased from 40
  const taskPadding = 20;   // Increased from 16
  
  // Calculate month width to fit container
  const availableWidth = containerWidth - leftMargin - rightMargin;
  const monthWidth = Math.max(60, Math.floor(availableWidth / maxMonth));
  
  const height = topMargin + bottomMargin + (taskCount * (taskHeight + taskPadding));
  const width = leftMargin + rightMargin + (maxMonth * monthWidth);
  
  return {
    width,
    height,
    leftMargin,
    topMargin,
    rightMargin,
    bottomMargin,
    monthWidth,
    taskHeight,
    taskPadding
  };
}

/**
 * Group workstreams by phase for better visualization
 */
export function groupTasksByPhase(
  tasks: GanttTask[],
  phases: GanttPhase[]
): Map<number, GanttTask[]> {
  const grouped = new Map<number, GanttTask[]>();
  
  phases.forEach(phase => {
    grouped.set(phase.phase, []);
  });
  
  tasks.forEach(task => {
    // Find which phase this task primarily belongs to
    const primaryPhase = phases.find(p => 
      task.startMonth >= p.startMonth && task.startMonth <= p.endMonth
    );
    
    if (primaryPhase) {
      const phaseGroup = grouped.get(primaryPhase.phase) || [];
      phaseGroup.push(task);
      grouped.set(primaryPhase.phase, phaseGroup);
    }
  });
  
  return grouped;
}

/**
 * Identify bottlenecks and issues in the schedule
 */
export interface ScheduleIssue {
  type: 'bottleneck' | 'overlap' | 'gap' | 'critical-delay';
  severity: 'high' | 'medium' | 'low';
  description: string;
  affectedTasks: string[];
  recommendation: string;
}

export function analyzeSchedule(
  tasks: GanttTask[],
  dependencies: GanttDependency[]
): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  
  // Check for tasks with many dependencies (bottlenecks)
  const dependencyCounts = new Map<string, number>();
  dependencies.forEach(dep => {
    dependencyCounts.set(dep.toId, (dependencyCounts.get(dep.toId) || 0) + 1);
  });
  
  dependencyCounts.forEach((count, taskId) => {
    if (count > 3) {
      const task = tasks.find(t => t.id === taskId);
      issues.push({
        type: 'bottleneck',
        severity: count > 5 ? 'high' : 'medium',
        description: `"${task?.name}" has ${count} dependencies, creating a potential bottleneck`,
        affectedTasks: [taskId],
        recommendation: 'Consider parallelizing some predecessor tasks or breaking this task into smaller components'
      });
    }
  });
  
  // Check for overlapping critical path tasks with same owner
  const criticalTasks = tasks.filter(t => t.isCriticalPath);
  const ownerTasks = new Map<string, GanttTask[]>();
  
  criticalTasks.forEach(task => {
    if (task.owner) {
      const existing = ownerTasks.get(task.owner) || [];
      existing.push(task);
      ownerTasks.set(task.owner, existing);
    }
  });
  
  ownerTasks.forEach((ownerTaskList, owner) => {
    // Check for timing overlaps
    for (let i = 0; i < ownerTaskList.length; i++) {
      for (let j = i + 1; j < ownerTaskList.length; j++) {
        const task1 = ownerTaskList[i];
        const task2 = ownerTaskList[j];
        
        // Check if they overlap
        if (task1.startMonth <= task2.endMonth && task2.startMonth <= task1.endMonth) {
          issues.push({
            type: 'overlap',
            severity: 'high',
            description: `${owner} is assigned to overlapping critical tasks: "${task1.name}" and "${task2.name}"`,
            affectedTasks: [task1.id, task2.id],
            recommendation: 'Assign additional resources or adjust task timelines to prevent resource conflicts'
          });
        }
      }
    }
  });
  
  // Check for low confidence on critical path
  criticalTasks.forEach(task => {
    if (task.confidence < 0.7) {
      issues.push({
        type: 'critical-delay',
        severity: 'high',
        description: `Critical task "${task.name}" has low confidence (${Math.round(task.confidence * 100)}%)`,
        affectedTasks: [task.id],
        recommendation: 'Conduct detailed planning session to increase confidence or add contingency buffer'
      });
    }
  });
  
  return issues.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}
