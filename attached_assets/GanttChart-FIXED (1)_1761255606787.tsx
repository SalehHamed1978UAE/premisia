import React, { useState, useMemo } from 'react';
import { Calendar, GitBranch, AlertTriangle, CheckCircle2, Clock, Users, DollarSign, Target, Milestone, AlertCircle } from 'lucide-react';
import { Workstream, Timeline, StageGates, Deliverable } from '@/types/intelligence';
import { 
  transformToGanttData, 
  calculateCriticalPath, 
  analyzeSchedule,
  GanttTask,
  GanttDependency
} from '@/lib/gantt-utils';

interface GanttChartProps {
  workstreams: Workstream[];
  timeline: Timeline;
  stageGates?: StageGates;
  deliverables?: Deliverable[];
}

export function GanttChart({ 
  workstreams, 
  timeline, 
  stageGates,
  deliverables = []
}: GanttChartProps) {
  const [showDependencies, setShowDependencies] = useState(true);
  const [showPhases, setShowPhases] = useState(true);
  const [showStageGates, setShowStageGates] = useState(true);
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  // Transform data for Gantt visualization
  const ganttData = useMemo(() => 
    transformToGanttData(workstreams, timeline, deliverables),
    [workstreams, timeline, deliverables]
  );

  // Calculate critical path
  const criticalPath = useMemo(() => 
    calculateCriticalPath(ganttData.tasks, ganttData.dependencies),
    [ganttData]
  );

  // Analyze schedule for issues
  const scheduleAnalysis = useMemo(() => 
    analyzeSchedule(ganttData.tasks, ganttData.dependencies),
    [ganttData]
  );

  // Calculate chart dimensions
  const chartStartDate = new Date(Math.min(...ganttData.tasks.map(t => t.startDate.getTime())));
  const chartEndDate = new Date(Math.max(...ganttData.tasks.map(t => t.endDate.getTime())));
  const totalDays = Math.ceil((chartEndDate.getTime() - chartStartDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Chart layout constants - FIXED positioning
  const CHART_PADDING = 20;
  const ROW_HEIGHT = 45;  // Height of each row
  const BAR_HEIGHT = 32;  // Height of the bars
  const LABEL_WIDTH = 200;
  const CHART_WIDTH = Math.max(1200, totalDays * 4);
  const HEADER_HEIGHT = 60;  // Height of the timeline header
  const ROW_PADDING = (ROW_HEIGHT - BAR_HEIGHT) / 2;  // Center bars vertically
  
  // Calculate positions for bars - FIXED calculation
  const getTaskPosition = (task: GanttTask) => {
    const startX = ((task.startDate.getTime() - chartStartDate.getTime()) / (1000 * 60 * 60 * 24)) * ((CHART_WIDTH - LABEL_WIDTH) / totalDays) + LABEL_WIDTH;
    const width = Math.max(20, ((task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24)) * ((CHART_WIDTH - LABEL_WIDTH) / totalDays));
    
    // FIXED: Calculate proper Y position including header height
    const taskIndex = ganttData.tasks.findIndex(t => t.id === task.id);
    const y = HEADER_HEIGHT + (taskIndex * ROW_HEIGHT) + ROW_PADDING;
    
    return { x: startX, y, width };
  };

  // Get color based on confidence/type
  const getTaskColor = (task: GanttTask) => {
    if (criticalPath.includes(task.id)) return '#ef4444'; // Red for critical path
    if (task.type === 'milestone') return '#8b5cf6'; // Purple for milestones
    if (task.confidence >= 80) return '#10b981'; // Green for high confidence
    if (task.confidence >= 60) return '#f59e0b'; // Orange for medium confidence
    return '#f87171'; // Light red for low confidence
  };

  // Generate month labels for timeline header
  const generateMonthLabels = () => {
    const months = [];
    const current = new Date(chartStartDate);
    current.setDate(1);
    
    while (current <= chartEndDate) {
      months.push({
        label: current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        start: new Date(current),
        end: new Date(current.getFullYear(), current.getMonth() + 1, 0)
      });
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  };

  const monthLabels = generateMonthLabels();

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Controls */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showDependencies}
              onChange={(e) => setShowDependencies(e.target.checked)}
              className="rounded text-blue-600"
            />
            <span className="text-sm font-medium">Show Dependencies</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPhases}
              onChange={(e) => setShowPhases(e.target.checked)}
              className="rounded text-blue-600"
            />
            <span className="text-sm font-medium">Show Phases</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showStageGates}
              onChange={(e) => setShowStageGates(e.target.checked)}
              className="rounded text-blue-600"
            />
            <span className="text-sm font-medium">Show Stage Gates</span>
          </label>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-xs">Critical Path</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-xs">High Confidence</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span className="text-xs">Medium Confidence</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 rounded"></div>
            <span className="text-xs">Deliverable</span>
          </div>
        </div>
      </div>

      {/* Schedule Alerts */}
      {scheduleAnalysis.issues.length > 0 && (
        <div className="p-4 bg-yellow-50 border-b border-yellow-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-900">Schedule Issues Detected</h4>
              <ul className="mt-1 space-y-1">
                {scheduleAnalysis.issues.map((issue, index) => (
                  <li key={index} className="text-sm text-yellow-800">• {issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Gantt Chart */}
      <div className="overflow-x-auto">
        <svg width={CHART_WIDTH} height={HEADER_HEIGHT + (ganttData.tasks.length * ROW_HEIGHT) + CHART_PADDING}>
          {/* Background Grid */}
          <defs>
            <pattern id="grid" width="40" height={ROW_HEIGHT} patternUnits="userSpaceOnUse">
              <rect width="40" height={ROW_HEIGHT} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={CHART_WIDTH} height={HEADER_HEIGHT + (ganttData.tasks.length * ROW_HEIGHT)} fill="url(#grid)" />
          
          {/* Month Headers */}
          <g className="timeline-header">
            {monthLabels.map((month, index) => {
              const monthStart = Math.max(0, ((month.start.getTime() - chartStartDate.getTime()) / (1000 * 60 * 60 * 24)));
              const monthEnd = Math.min(totalDays, ((month.end.getTime() - chartStartDate.getTime()) / (1000 * 60 * 60 * 24)));
              const x = (monthStart / totalDays) * (CHART_WIDTH - LABEL_WIDTH) + LABEL_WIDTH;
              const width = ((monthEnd - monthStart) / totalDays) * (CHART_WIDTH - LABEL_WIDTH);
              
              return (
                <g key={index}>
                  <rect
                    x={x}
                    y={0}
                    width={width}
                    height={HEADER_HEIGHT - 5}
                    fill="#f9fafb"
                    stroke="#e5e7eb"
                  />
                  <text
                    x={x + width / 2}
                    y={HEADER_HEIGHT / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-sm font-semibold fill-gray-700"
                  >
                    {month.label}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Task Labels */}
          <g className="task-labels">
            {ganttData.tasks.map((task, index) => (
              <g key={task.id}>
                <rect
                  x={0}
                  y={HEADER_HEIGHT + (index * ROW_HEIGHT)}
                  width={LABEL_WIDTH}
                  height={ROW_HEIGHT}
                  fill="#f9fafb"
                  stroke="#e5e7eb"
                />
                <text
                  x={10}
                  y={HEADER_HEIGHT + (index * ROW_HEIGHT) + (ROW_HEIGHT / 2)}
                  dominantBaseline="middle"
                  className="text-sm font-medium fill-gray-700"
                >
                  {task.name.length > 25 ? task.name.substring(0, 25) + '...' : task.name}
                </text>
              </g>
            ))}
          </g>

          {/* Phase Backgrounds */}
          {showPhases && timeline.phases?.map((phase, index) => {
            const phaseStart = new Date(phase.startDate);
            const phaseEnd = new Date(phase.endDate);
            const x = ((phaseStart.getTime() - chartStartDate.getTime()) / (1000 * 60 * 60 * 24)) * ((CHART_WIDTH - LABEL_WIDTH) / totalDays) + LABEL_WIDTH;
            const width = ((phaseEnd.getTime() - phaseStart.getTime()) / (1000 * 60 * 60 * 24)) * ((CHART_WIDTH - LABEL_WIDTH) / totalDays);
            
            return (
              <rect
                key={index}
                x={x}
                y={HEADER_HEIGHT}
                width={width}
                height={ganttData.tasks.length * ROW_HEIGHT}
                fill={index % 2 === 0 ? 'rgba(59, 130, 246, 0.05)' : 'rgba(139, 92, 246, 0.05)'}
              />
            );
          })}

          {/* Stage Gates */}
          {showStageGates && stageGates?.gates?.map((gate, index) => {
            const gateDate = new Date(gate.date);
            const x = ((gateDate.getTime() - chartStartDate.getTime()) / (1000 * 60 * 60 * 24)) * ((CHART_WIDTH - LABEL_WIDTH) / totalDays) + LABEL_WIDTH;
            
            return (
              <g key={index}>
                <line
                  x1={x}
                  y1={HEADER_HEIGHT}
                  x2={x}
                  y2={HEADER_HEIGHT + (ganttData.tasks.length * ROW_HEIGHT)}
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
                <circle cx={x} cy={HEADER_HEIGHT - 10} r="8" fill="#ef4444" />
                <text
                  x={x}
                  y={HEADER_HEIGHT - 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs font-bold fill-white"
                >
                  {index + 1}
                </text>
              </g>
            );
          })}

          {/* Dependencies */}
          {showDependencies && ganttData.dependencies.map((dep, index) => {
            const fromTask = ganttData.tasks.find(t => t.id === dep.from);
            const toTask = ganttData.tasks.find(t => t.id === dep.to);
            
            if (!fromTask || !toTask) return null;
            
            const fromPos = getTaskPosition(fromTask);
            const toPos = getTaskPosition(toTask);
            
            return (
              <line
                key={index}
                x1={fromPos.x + fromPos.width}
                y1={fromPos.y + BAR_HEIGHT / 2}
                x2={toPos.x}
                y2={toPos.y + BAR_HEIGHT / 2}
                stroke="#6b7280"
                strokeWidth="1.5"
                markerEnd="url(#arrowhead)"
                opacity={hoveredTask === dep.from || hoveredTask === dep.to ? 1 : 0.3}
              />
            );
          })}

          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#6b7280"
              />
            </marker>
          </defs>

          {/* Task Bars */}
          {ganttData.tasks.map((task) => {
            const pos = getTaskPosition(task);
            const color = getTaskColor(task);
            const isSelected = selectedTask === task.id;
            const isHovered = hoveredTask === task.id;
            
            return (
              <g key={task.id}>
                {/* Task bar */}
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={pos.width}
                  height={BAR_HEIGHT}
                  rx="4"
                  fill={color}
                  opacity={isSelected ? 1 : 0.9}
                  stroke={isSelected ? '#1f2937' : 'none'}
                  strokeWidth={isSelected ? 2 : 0}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredTask(task.id)}
                  onMouseLeave={() => setHoveredTask(null)}
                  onClick={() => setSelectedTask(task.id === selectedTask ? null : task.id)}
                />
                
                {/* Task text */}
                {pos.width > 50 && (
                  <text
                    x={pos.x + 8}
                    y={pos.y + BAR_HEIGHT / 2}
                    dominantBaseline="middle"
                    className="text-xs font-medium fill-white pointer-events-none"
                  >
                    {task.confidence}%
                  </text>
                )}
                
                {/* Milestone diamond */}
                {task.type === 'milestone' && (
                  <g transform={`translate(${pos.x + pos.width / 2}, ${pos.y + BAR_HEIGHT / 2})`}>
                    <rect
                      x="-8"
                      y="-8"
                      width="16"
                      height="16"
                      transform="rotate(45)"
                      fill={color}
                      stroke="white"
                      strokeWidth="2"
                    />
                  </g>
                )}

                {/* Hover tooltip */}
                {isHovered && (
                  <g>
                    <rect
                      x={pos.x}
                      y={pos.y - 65}
                      width="250"
                      height="60"
                      rx="4"
                      fill="white"
                      stroke="#e5e7eb"
                      filter="url(#shadow)"
                    />
                    <text x={pos.x + 10} y={pos.y - 45} className="text-xs font-semibold fill-gray-900">
                      {task.name}
                    </text>
                    <text x={pos.x + 10} y={pos.y - 30} className="text-xs fill-gray-600">
                      {task.startDate.toLocaleDateString()} - {task.endDate.toLocaleDateString()}
                    </text>
                    <text x={pos.x + 10} y={pos.y - 15} className="text-xs fill-gray-600">
                      Duration: {Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24))} days
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Shadow filter */}
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
              <feOffset dx="0" dy="2" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.2"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </svg>
      </div>

      {/* Statistics */}
      <div className="p-4 bg-gray-50 border-t">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{ganttData.tasks.length}</div>
            <div className="text-xs text-gray-600">Total Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{criticalPath.length}</div>
            <div className="text-xs text-gray-600">Critical Path Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {Math.ceil((chartEndDate.getTime() - chartStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30))} months
            </div>
            <div className="text-xs text-gray-600">Total Duration</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {ganttData.tasks.filter(t => t.confidence >= 80).length}
            </div>
            <div className="text-xs text-gray-600">High Confidence</div>
          </div>
        </div>
      </div>
    </div>
  );
}
