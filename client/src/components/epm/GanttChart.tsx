/**
 * GanttChart Component
 * 
 * Interactive SVG-based Gantt chart for EPM programs
 * ULTRA-FIXED version with proper Y-positioning
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Users,
  TrendingUp,
  Flag,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import {
  GanttTask,
  GanttPhase,
  GanttStageGate,
  GanttDependency,
  TaskPosition,
  DependencyPath,
  ScheduleIssue,
  calculateDependencyPaths,
  calculateChartDimensions,
  analyzeSchedule
} from '@/lib/gantt-utils';

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
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Zoom handlers
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3)); // Max 3x zoom
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5)); // Min 0.5x zoom
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanX(0);
    setPanY(0);
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning) return;
    setPanX(e.clientX - panStart.x);
    setPanY(e.clientY - panStart.y);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  // Calculate chart dimensions and positions
  const dimensions = useMemo(() => 
    calculateChartDimensions(tasks.length, maxMonth, containerWidth),
    [tasks.length, maxMonth, containerWidth]
  );

  // ULTRA-FIXED positioning constants
  const ROW_HEIGHT = dimensions.taskHeight + dimensions.taskPadding;  // 70px total
  const BAR_HEIGHT = dimensions.taskHeight;  // 50px
  const ROW_PADDING = dimensions.taskPadding / 2;  // 10px padding to center bars

  // Calculate task positions with FIXED Y-offset using topMargin
  const taskPositions = useMemo(() => {
    const positions: TaskPosition[] = tasks.map((task, taskIndex) => ({
      id: task.id,
      x: dimensions.leftMargin + (task.startMonth * dimensions.monthWidth),
      // FIXED: Use topMargin (150px) not HEADER_HEIGHT (60px)
      y: dimensions.topMargin + (taskIndex * ROW_HEIGHT) + ROW_PADDING,
      width: task.duration * dimensions.monthWidth,
      height: BAR_HEIGHT
    }));
    return new Map(positions.map(p => [p.id, p]));
  }, [tasks, dimensions, ROW_HEIGHT, ROW_PADDING, BAR_HEIGHT]);

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
      const monthX = dimensions.leftMargin + (i * dimensions.monthWidth);
      months.push(
        <g key={`month-${i}`}>
          {/* Vertical grid line - starts at topMargin */}
          <line
            x1={monthX}
            y1={dimensions.topMargin}
            x2={monthX}
            y2={dimensions.height - dimensions.bottomMargin}
            stroke="#e5e7eb"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          {/* Month label */}
          <text
            x={monthX + dimensions.monthWidth / 2}
            y={dimensions.topMargin - 8}
            textAnchor="middle"
            className="fill-gray-600 font-semibold"
            style={{ fontSize: '11px' }}
          >
            M{i}
          </text>
        </g>
      );
    }
    return months;
  };

  // Render task label rows (background rectangles)
  const renderTaskLabelRows = () => {
    return tasks.map((task, index) => (
      <rect
        key={`row-${task.id}`}
        x={0}
        y={dimensions.topMargin + (index * ROW_HEIGHT)}
        width={dimensions.leftMargin}
        height={ROW_HEIGHT}
        fill="#f9fafb"
        stroke="#e5e7eb"
        strokeWidth="0.5"
      />
    ));
  };

  // Render timeline phases background
  const renderPhases = () => {
    if (!showPhases) return null;

    return phases.map((phase, index) => {
      const phaseWidth = (phase.endMonth - phase.startMonth + 1) * dimensions.monthWidth;
      const phaseX = dimensions.leftMargin + (phase.startMonth * dimensions.monthWidth);
      
      // AGGRESSIVE truncation for phase names
      let phaseName = phase.name;
      const maxCharsPerMonth = 4; // Max chars that fit per month width
      const maxChars = Math.floor(phaseWidth / 8); // Estimate based on pixel width
      
      if (phaseName.length > maxChars) {
        phaseName = phaseName.substring(0, maxChars - 3) + '...';
      }
      
      // If still too long, just use phase number
      const displayLabel = phaseWidth < 80 ? `P${phase.phase}` : `Phase ${phase.phase}`;
      const showFullName = phaseWidth > 120;
      
      return (
        <g key={`phase-${phase.phase}`}>
          {/* Phase background */}
          <rect
            x={phaseX}
            y={dimensions.topMargin}
            width={phaseWidth}
            height={dimensions.height - dimensions.topMargin - dimensions.bottomMargin}
            fill={phase.color}
            opacity="0.3"
          />
          
          {/* Phase label - centered, multi-line if needed */}
          <text
            x={phaseX + phaseWidth / 2}
            y={dimensions.topMargin - 100}
            textAnchor="middle"
            className="text-xs fill-gray-700 font-semibold"
            style={{ fontSize: '11px' }}
          >
            {displayLabel}
          </text>
          
          {/* Phase name on second line if there's room */}
          {showFullName && (
            <text
              x={phaseX + phaseWidth / 2}
              y={dimensions.topMargin - 85}
              textAnchor="middle"
              className="text-xs fill-gray-600"
              style={{ fontSize: '10px' }}
            >
              {phaseName}
            </text>
          )}
          
          {/* Phase boundary line (right edge) */}
          {index < phases.length - 1 && (
            <line
              x1={phaseX + phaseWidth}
              y1={dimensions.topMargin - 110}
              x2={phaseX + phaseWidth}
              y2={dimensions.topMargin}
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="3 3"
              opacity="0.4"
            />
          )}
        </g>
      );
    });
  };

  // Render stage gates
  const renderStageGates = () => {
    if (!showGates) return null;

    return stageGates.map(gate => {
      const gateX = dimensions.leftMargin + (gate.month * dimensions.monthWidth);
      
      // VERY aggressive truncation for gate names
      const maxGateNameLength = 12; // Very short to prevent overlap
      let gateName = gate.name;
      if (gateName.length > maxGateNameLength) {
        gateName = gateName.substring(0, maxGateNameLength - 2) + '..';
      }
      
      return (
        <g key={`gate-${gate.gate}`}>
          {/* Gate vertical line */}
          <line
            x1={gateX}
            y1={dimensions.topMargin}
            x2={gateX}
            y2={dimensions.height - dimensions.bottomMargin}
            stroke={gate.color}
            strokeWidth="3"
            opacity="0.6"
          />
          {/* Gate marker circle */}
          <circle
            cx={gateX}
            cy={dimensions.topMargin - 70}
            r="16"
            fill={gate.color}
            stroke="white"
            strokeWidth="2"
          />
          {/* Gate number */}
          <text
            x={gateX}
            y={dimensions.topMargin - 65}
            textAnchor="middle"
            className="fill-white font-bold"
            style={{ fontSize: '13px' }}
          >
            {gate.gate}
          </text>
          {/* Gate name label - split into two lines if needed */}
          <text
            x={gateX}
            y={dimensions.topMargin - 48}
            textAnchor="middle"
            className="fill-gray-700 font-medium"
            style={{ fontSize: '10px' }}
          >
            Gate {gate.gate}
          </text>
          <text
            x={gateX}
            y={dimensions.topMargin - 36}
            textAnchor="middle"
            className="fill-gray-600"
            style={{ fontSize: '9px' }}
          >
            {gateName}
          </text>
        </g>
      );
    });
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
    
    // AGGRESSIVE truncation based on available left margin space
    // Left margin is 350px, need space for critical indicator (10px) and padding (20px)
    // Leaves ~320px for text at ~7px per char = max 45 chars
    const maxNameLength = 45;
    const displayName = task.name.length > maxNameLength 
      ? task.name.substring(0, maxNameLength - 3) + '...'
      : task.name;

    return (
      <g key={task.id}>
        {/* Task label (left side) - positioned further left with more space */}
        <text
          x={dimensions.leftMargin - 20}
          y={position.y + position.height / 2 + 5}
          textAnchor="end"
          className={`font-medium ${isCritical ? 'fill-red-600' : 'fill-gray-700'}`}
          style={{ fontSize: '12px', fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {displayName}
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
        {/* Zoom Controls */}
        <div className="flex items-center gap-2 border-r pr-4">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleZoomOut}
            data-testid="button-zoom-out"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[60px] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleZoomIn}
            data-testid="button-zoom-in"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleResetZoom}
            data-testid="button-reset-zoom"
            title="Reset Zoom & Pan"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

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
          <div className="overflow-hidden border rounded">
            <svg
              ref={svgRef}
              width={dimensions.width}
              height={dimensions.height}
              className={isPanning ? 'cursor-grabbing' : 'cursor-grab'}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              data-testid="gantt-chart-svg"
            >
              {/* Background */}
              <rect
                x="0"
                y="0"
                width={dimensions.width}
                height={dimensions.height}
                fill="white"
              />

              {/* Zoomable/pannable group */}
              <g transform={`translate(${panX}, ${panY}) scale(${zoomLevel})`}>
                {/* Timeline phases */}
                {renderPhases()}

              {/* Task label background rows */}
              {renderTaskLabelRows()}

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
              </g> {/* Close zoomable/pannable group */}
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
