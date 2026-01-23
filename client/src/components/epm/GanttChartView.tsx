/**
 * GanttChartView Component
 * 
 * Wrapper component that transforms EPM program data and renders the Gantt chart
 * This is the component that gets added as a tab in EPMProgramView
 */

import { useMemo } from 'react';
import GanttChart from './GanttChart';
import { transformToGanttData } from '@/lib/gantt-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Workstream, Timeline, StageGates } from '@/types/intelligence';

interface GanttChartViewProps {
  workstreams: Workstream[];
  timeline: Timeline;
  stageGates: StageGates;
}

export default function GanttChartView({ workstreams, timeline, stageGates }: GanttChartViewProps) {
  // Transform EPM data to Gantt format with defensive checks
  const ganttData = useMemo(() => {
    try {
      // Defensive checks for required data
      if (!workstreams || !Array.isArray(workstreams) || workstreams.length === 0) {
        console.warn('No workstreams data available for Gantt chart');
        return null;
      }
      if (!timeline || !timeline.phases || !Array.isArray(timeline.phases)) {
        console.warn('No timeline phases data available for Gantt chart');
        return null;
      }
      if (!stageGates || !stageGates.gates || !Array.isArray(stageGates.gates)) {
        console.warn('No stage gates data available for Gantt chart');
        return null;
      }
      
      return transformToGanttData(workstreams, timeline, stageGates);
    } catch (error) {
      console.error('Error transforming data to Gantt format:', error);
      return null;
    }
  }, [workstreams, timeline, stageGates]);

  // Handle export to image
  const handleExportImage = () => {
    // Find the SVG element
    const svg = document.querySelector('svg');
    if (!svg) return;

    // Create a canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get SVG dimensions
    const bbox = svg.getBoundingClientRect();
    canvas.width = bbox.width;
    canvas.height = bbox.height;

    // Convert SVG to data URL
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    // Create image
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      // Download
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'epm-gantt-chart.png';
        a.click();
        URL.revokeObjectURL(url);
      });
    };
    img.src = url;
  };

  if (!ganttData) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to Generate Gantt Chart</AlertTitle>
        <AlertDescription>
          The program data could not be transformed into Gantt chart format. 
          Please ensure workstreams, timeline, and stage gates are properly defined.
        </AlertDescription>
      </Alert>
    );
  }

  if (ganttData.tasks.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No Workstreams Defined</AlertTitle>
        <AlertDescription>
          This program doesn't have any workstreams yet. 
          The Gantt chart will appear once workstreams are added to the program.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div>
              <CardTitle>Program Timeline - Gantt Chart</CardTitle>
              <CardDescription>
                Visual timeline showing workstreams, dependencies, critical path, and milestones
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handleExportImage} size="sm" className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              <span className="sm:inline">Export Image</span>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>How to Use This Chart</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li><strong>Hover</strong> over tasks to see details</li>
            <li><strong>Click</strong> tasks to pin the tooltip</li>
            <li><strong>Red bars</strong> indicate critical path tasks</li>
            <li><strong>Diamond markers</strong> show deliverable milestones</li>
            <li><strong>Arrows</strong> display task dependencies</li>
            <li><strong>Vertical lines</strong> mark stage gates</li>
            <li className="text-orange-600 dark:text-orange-400"><strong>Mobile:</strong> Swipe left/right to scroll timeline</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Gantt Chart - Scrollable Container for Mobile */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 touch-pan-x">
        <div className="min-w-[1200px] px-4 sm:px-0">
          <GanttChart
            tasks={ganttData.tasks}
            phases={ganttData.phases}
            stageGates={ganttData.stageGates}
            dependencies={ganttData.dependencies}
            totalMonths={ganttData.totalMonths}
            maxMonth={ganttData.maxMonth}
            criticalPath={ganttData.criticalPath}
            containerWidth={1200}
          />
        </div>
      </div>

      {/* Critical Path Details */}
      {ganttData.criticalPath.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Critical Path Analysis</CardTitle>
            <CardDescription>
              These tasks directly impact the program completion date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ganttData.tasks
                .filter(t => t.isCriticalPath)
                .map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
                    <div className="flex-1">
                      <div className="font-semibold text-red-900 dark:text-red-100">{task.name}</div>
                      <div className="text-sm text-red-700 dark:text-red-300">
                        Months {task.startMonth}-{task.endMonth} ({task.duration} months)
                        {task.owner && ` • ${task.owner}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-red-900 dark:text-red-100">
                        {Math.round(task.confidence * 100)}% confidence
                      </div>
                      {task.dependencies.length > 0 && (
                        <div className="text-xs text-red-700 dark:text-red-300">
                          {task.dependencies.length} dependencies
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dependencies Matrix */}
      {ganttData.dependencies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dependency Network</CardTitle>
            <CardDescription>
              Task relationships and sequencing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Predecessor</th>
                    <th className="text-left p-2">Successor</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Critical</th>
                  </tr>
                </thead>
                <tbody>
                  {ganttData.dependencies.map((dep, i) => {
                    const fromTask = ganttData.tasks.find(t => t.id === dep.fromId);
                    const toTask = ganttData.tasks.find(t => t.id === dep.toId);
                    return (
                      <tr key={i} className="border-b">
                        <td className="p-2">{fromTask?.name || dep.fromId}</td>
                        <td className="p-2">{toTask?.name || dep.toId}</td>
                        <td className="p-2">
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {dep.type}
                          </span>
                        </td>
                        <td className="p-2">
                          {dep.isCritical ? (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">
                              Yes
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">No</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Milestones Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Key Milestones</CardTitle>
          <CardDescription>
            Important deliverables across all workstreams
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {ganttData.tasks
              .filter(t => t.deliverables && t.deliverables.length > 0)
              .map(task => (
                <div key={task.id}>
                  <div className="font-semibold text-sm mb-2 text-foreground">{task.name}</div>
                  <div className="space-y-1 ml-4">
                    {task.deliverables?.map(deliverable => (
                      <div key={deliverable.id} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded text-sm">
                        <div className="flex items-center gap-2">
                          <svg width="12" height="12">
                            <path d="M 6 2 L 10 6 L 6 10 L 2 6 Z" fill="currentColor" className="text-blue-600 dark:text-blue-400" />
                          </svg>
                          <span className="text-foreground">{deliverable.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Month {deliverable.dueMonth}</span>
                          <span>{deliverable.effort}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
