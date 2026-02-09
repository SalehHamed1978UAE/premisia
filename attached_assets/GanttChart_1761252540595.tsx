/**
 * GanttChart Component
 * 
 * Interactive SVG-based Gantt chart for EPM programs
 */

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Users,
  TrendingUp,
  Flag
} from 'lucide-react';
import {
  GanttTask,
  GanttPhase,
  GanttStageGate,
  GanttDependency,
  TaskPosition,
  DependencyPath,
  ChartDimensions,
  ScheduleIssue,
  calculateTaskPositions,
  calculateDependencyPaths,
  calculateChartDimensions,
  analyzeSchedule
} from './gantt-utils';

interface GanttChartProps {
  tasks: GanttTask[];
  phases: GanttPhase[];
  stageGates: GanttStageGate[];
  dependencies: GanttDependency[];
  totalMonths: number;
  maxMonth: number;
  criticalPath: string[];
  containerWidth?: number;
}

export default function GanttChart({
  tasks,
  phases,
  stageGates,
  dependencies,
  totalMonths,
  maxMonth,
  criticalPath,
  containerWidth = 1200
}: GanttChartProps) {
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [showDependencies, setShowDependencies] = useState(true);
  const [showPhases, setShowPhases] = useState(true);
  const [showGates, setShowGates] = useState(true);

  // Calculate chart dimensions and positions
  const dimensions = useMemo(() => 
    calculateChartDimensions(tasks.length, maxMonth, containerWidth),
    [tasks.length, maxMonth, containerWidth]
  );

  const taskPositions = useMemo(() => {
    const positions = calculateTaskPositions(
      tasks,
      dimensions.monthWidth,
      dimensions.taskHeight,
      dimensions.taskPadding,
      dimensions.leftMargin
    );
    return new Map(positions.map(p => [p.id, p]));
  }, [tasks, dimensions]);

  const dependencyPaths = useMemo(() =>
    calculateDependencyPaths(dependencies, taskPositions, dimensions.taskHeight),
    [dependencies, taskPositions, dimensions.taskHeight]
  );

  const scheduleIssues = useMemo(() =>
    analyzeSchedule(tasks, dependencies),
    [tasks, dependencies]
  );

  // Get task by ID
  const getTask = (id: string) => tasks.find(t => t.id === id);

  // Render month headers
  const renderMonthHeaders = () => {
    const months = [];
    for (let i = 0; i <= maxMonth; i++) {
      months.push(
        <g key={`month-${i}`}>
          <line
            x1={dimensions.leftMargin + (i * dimensions.monthWidth)}
            y1={dimensions.topMargin - 30}
            x2={dimensions.leftMargin + (i * dimensions.monthWidth)}
            y2={dimensions.height - dimensions.bottomMargin}
            stroke="#e5e7eb"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <text
            x={dimensions.leftMargin + (i * dimensions.monthWidth) + dimensions.monthWidth / 2}
            y={dimensions.topMargin - 10}
            textAnchor="middle"
            className="text-xs fill-gray-600 font-medium"
          >
            M{i}
          </text>
        </g>
      );
    }
    return months;
  };

  // Render timeline phases background
  const renderPhases = () => {
    if (!showPhases) return null;

    return phases.map(phase => (
      <g key={`phase-${phase.phase}`}>
        <rect
          x={dimensions.leftMargin + (phase.startMonth * dimensions.monthWidth)}
          y={dimensions.topMargin}
          width={(phase.endMonth - phase.startMonth + 1) * dimensions.monthWidth}
          height={dimensions.height - dimensions.topMargin - dimensions.bottomMargin}
          fill={phase.color}
          opacity="0.3"
        />
        <text
          x={dimensions.leftMargin + (phase.startMonth * dimensions.monthWidth) + 10}
          y={dimensions.topMargin - 35}
          className="text-xs fill-gray-700 font-semibold"
        >
          Phase {phase.phase}: {phase.name}
        </text>
      </g>
    ));
  };

  // Render stage gates
  const renderStageGates = () => {
    if (!showGates) return null;

    return stageGates.map(gate => (
      <g key={`gate-${gate.gate}`}>
        <line
          x1={dimensions.leftMargin + (gate.month * dimensions.monthWidth)}
          y1={dimensions.topMargin}
          x2={dimensions.leftMargin + (gate.month * dimensions.monthWidth)}
          y2={dimensions.height - dimensions.bottomMargin}
          stroke={gate.color}
          strokeWidth="3"
          opacity="0.6"
        />
        <circle
          cx={dimensions.leftMargin + (gate.month * dimensions.monthWidth)}
          cy={dimensions.topMargin - 50}
          r="12"
          fill={gate.color}
        />
        <text
          x={dimensions.leftMargin + (gate.month * dimensions.monthWidth)}
          y={dimensions.topMargin - 47}
          textAnchor="middle"
          className="text-xs fill-white font-bold"
        >
          {gate.gate}
        </text>
        <text
          x={dimensions.leftMargin + (gate.month * dimensions.monthWidth) + 20}
          y={dimensions.topMargin - 45}
          className="text-xs fill-gray-700 font-medium"
        >
          {gate.name}
        </text>
      </g>
    ));
  };

  // Render task bar
  const renderTask = (task: GanttTask, position: TaskPosition) => {
    const isHovered = hoveredTask === task.id;
    const isSelected = selectedTask === task.id;
    const isCritical = task.isCriticalPath;

    const barColor = isCritical 
      ? '#ef4444'  // red-500 for critical path
      : task.confidence > 0.8 
        ? '#10b981'  // green-500 for high confidence
        : task.confidence > 0.6
          ? '#f59e0b'  // amber-500 for medium confidence
          : '#ef4444';  // red-500 for low confidence

    const opacity = isHovered || isSelected ? 1 : 0.85;

    return (
      <g key={task.id}>
        {/* Task label (left side) */}
        <text
          x={dimensions.leftMargin - 10}
          y={position.y + position.height / 2 + 4}
          textAnchor="end"
          className={`text-sm font-medium ${isCritical ? 'fill-red-600' : 'fill-gray-700'}`}
        >
          {task.name}
        </text>

        {/* Task bar */}
        <rect
          x={position.x}
          y={position.y}
          width={position.width}
          height={position.height}
          fill={barColor}
          opacity={opacity}
          rx="4"
          stroke={isSelected ? '#1e40af' : 'none'}
          strokeWidth={isSelected ? 3 : 0}
          onMouseEnter={() => setHoveredTask(task.id)}
          onMouseLeave={() => setHoveredTask(null)}
          onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
          className="cursor-pointer transition-all"
        />

        {/* Confidence indicator */}
        <text
          x={position.x + position.width / 2}
          y={position.y + position.height / 2 + 4}
          textAnchor="middle"
          className="text-xs fill-white font-semibold pointer-events-none"
        >
          {Math.round(task.confidence * 100)}%
        </text>

        {/* Owner indicator */}
        {task.owner && (
          <text
            x={position.x + position.width + 5}
            y={position.y + position.height / 2 + 4}
            className="text-xs fill-gray-500"
          >
            {task.owner}
          </text>
        )}

        {/* Critical path indicator */}
        {isCritical && (
          <circle
            cx={position.x - 8}
            cy={position.y + position.height / 2}
            r="4"
            fill="#ef4444"
            className="pointer-events-none"
          />
        )}

        {/* Deliverable markers */}
        {task.deliverables?.map((deliverable, i) => {
          const deliverableX = dimensions.leftMargin + (deliverable.dueMonth * dimensions.monthWidth);
          return (
            <g key={`${task.id}-deliverable-${i}`}>
              <path
                d={`M ${deliverableX} ${position.y + 5} 
                    L ${deliverableX + 6} ${position.y + position.height / 2} 
                    L ${deliverableX} ${position.y + position.height - 5} 
                    L ${deliverableX - 6} ${position.y + position.height / 2} Z`}
                fill="#3b82f6"
                stroke="white"
                strokeWidth="1"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredTask(`${task.id}-del-${i}`)}
                onMouseLeave={() => setHoveredTask(null)}
              />
            </g>
          );
        })}
      </g>
    );
  };

  // Render dependencies
  const renderDependencies = () => {
    if (!showDependencies) return null;

    return dependencyPaths.map(dep => (
      <path
        key={dep.id}
        d={dep.path}
        stroke={dep.isCritical ? '#ef4444' : '#94a3b8'}
        strokeWidth={dep.isCritical ? 2.5 : 1.5}
        fill="none"
        opacity="0.6"
        className="pointer-events-none"
      />
    ));
  };

  // Render tooltip for hovered/selected task
  const renderTooltip = () => {
    if (!hoveredTask && !selectedTask) return null;

    const taskId = selectedTask || hoveredTask;
    const task = getTask(taskId || '');
    const position = taskPositions.get(taskId || '');

    if (!task || !position) return null;

    const tooltipX = position.x + position.width + 15;
    const tooltipY = position.y;
    const tooltipWidth = 280;
    const tooltipHeight = 120;

    return (
      <foreignObject
        x={tooltipX}
        y={tooltipY}
        width={tooltipWidth}
        height={tooltipHeight}
      >
        <Card className="shadow-lg border-2 border-blue-500">
          <CardContent className="p-3 text-xs space-y-1">
            <div className="font-bold text-sm">{task.name}</div>
            <div className="text-muted-foreground">{task.description}</div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <span className="font-medium">Duration:</span> {task.duration} months
              </div>
              <div>
                <span className="font-medium">Confidence:</span> {Math.round(task.confidence * 100)}%
              </div>
              {task.owner && (
                <div className="col-span-2">
                  <span className="font-medium">Owner:</span> {task.owner}
                </div>
              )}
              <div className="col-span-2">
                <span className="font-medium">Dependencies:</span> {task.dependencies.length}
              </div>
            </div>
            {task.deliverables && task.deliverables.length > 0 && (
              <div className="pt-2 border-t">
                <span className="font-medium">Deliverables:</span> {task.deliverables.length}
              </div>
            )}
          </CardContent>
        </Card>
      </foreignObject>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="show-deps"
            checked={showDependencies}
            onChange={(e) => setShowDependencies(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="show-deps" className="text-sm">Show Dependencies</label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="show-phases"
            checked={showPhases}
            onChange={(e) => setShowPhases(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="show-phases" className="text-sm">Show Phases</label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="show-gates"
            checked={showGates}
            onChange={(e) => setShowGates(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="show-gates" className="text-sm">Show Stage Gates</label>
        </div>

        {/* Legend */}
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-xs">Critical Path</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-xs">High Confidence</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-amber-500 rounded"></div>
            <span className="text-xs">Medium Confidence</span>
          </div>
          <div className="flex items-center gap-1">
            <svg width="12" height="12">
              <path d="M 6 2 L 10 6 L 6 10 L 2 6 Z" fill="#3b82f6" />
            </svg>
            <span className="text-xs">Deliverable</span>
          </div>
        </div>
      </div>

      {/* Schedule Issues */}
      {scheduleIssues.length > 0 && (
        <Alert variant={scheduleIssues[0].severity === 'high' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-2">
              {scheduleIssues.length} Schedule Issue{scheduleIssues.length > 1 ? 's' : ''} Detected
            </div>
            <ul className="space-y-1 text-sm">
              {scheduleIssues.slice(0, 3).map((issue, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Badge variant={issue.severity === 'high' ? 'destructive' : 'secondary'} className="mt-0.5">
                    {issue.severity}
                  </Badge>
                  <span>{issue.description}</span>
                </li>
              ))}
            </ul>
            {scheduleIssues.length > 3 && (
              <div className="text-xs text-muted-foreground mt-2">
                + {scheduleIssues.length - 3} more issues
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Gantt Chart SVG */}
      <Card>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <svg
              width={dimensions.width}
              height={dimensions.height}
              className="border rounded"
            >
              {/* Background */}
              <rect
                x="0"
                y="0"
                width={dimensions.width}
                height={dimensions.height}
                fill="white"
              />

              {/* Timeline phases */}
              {renderPhases()}

              {/* Month grid and headers */}
              {renderMonthHeaders()}

              {/* Stage gates */}
              {renderStageGates()}

              {/* Dependencies */}
              {renderDependencies()}

              {/* Tasks */}
              {tasks.map(task => {
                const position = taskPositions.get(task.id);
                return position ? renderTask(task, position) : null;
              })}

              {/* Tooltip */}
              {renderTooltip()}

              {/* Legend in chart */}
              <g transform={`translate(${dimensions.leftMargin}, ${dimensions.height - 25})`}>
                <text className="text-xs fill-gray-600">
                  Total Duration: {totalMonths} months | 
                  Critical Path Tasks: {criticalPath.length} | 
                  Total Tasks: {tasks.length}
                </text>
              </g>
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{totalMonths}</div>
                <div className="text-xs text-muted-foreground">Months Total</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-red-500" />
              <div>
                <div className="text-2xl font-bold">{criticalPath.length}</div>
                <div className="text-xs text-muted-foreground">Critical Tasks</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{stageGates.length}</div>
                <div className="text-xs text-muted-foreground">Stage Gates</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{dependencies.length}</div>
                <div className="text-xs text-muted-foreground">Dependencies</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
