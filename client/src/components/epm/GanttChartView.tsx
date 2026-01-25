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
  const handleExportImage = async () => {
    console.log('[Export] Starting Gantt chart export...');
    try {
      // Find the specific Gantt chart SVG by ID
      const svg = document.getElementById('epm-gantt-chart') as SVGSVGElement | null;
      if (!svg) {
        console.error('[Export] Gantt chart SVG not found');
        alert('Unable to export: Gantt chart not found');
        return;
      }

      console.log('[Export] Found SVG element');
      
      // Get dimensions from the original SVG with fallback to bounding rect
      let width = parseInt(svg.getAttribute('width') || '0');
      let height = parseInt(svg.getAttribute('height') || '0');
      
      // Fallback to bounding rect if attributes are missing or invalid
      if (!width || !height || width < 100 || height < 100) {
        const bbox = svg.getBoundingClientRect();
        width = Math.max(width, Math.round(bbox.width)) || 1200;
        height = Math.max(height, Math.round(bbox.height)) || 600;
        console.log(`[Export] Using fallback dimensions: ${width}x${height}`);
      }
      
      // First, inline styles on the original (in-DOM) SVG elements
      // Store original styles to restore later
      const styleBackups = new Map<Element, string>();
      inlineStylesOnOriginal(svg, styleBackups);
      
      // Now clone the SVG (styles are already inlined)
      const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
      
      // Restore original SVG to remove inline styles we added
      restoreOriginalStyles(svg, styleBackups);
      
      // Set required SVG attributes for standalone rendering
      clonedSvg.setAttribute('width', String(width));
      clonedSvg.setAttribute('height', String(height));
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clonedSvg.removeAttribute('class'); // Remove cursor classes
      
      console.log('[Export] Creating canvas...');

      // Create a canvas with higher resolution for better quality
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        alert('Unable to export: Canvas context unavailable');
        return;
      }

      // Scale for higher resolution
      ctx.scale(scale, scale);
      
      // Fill background with white
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);

      // Serialize the cloned SVG
      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      
      // Create a data URL with error handling for Unicode content
      let dataUrl: string;
      try {
        const base64Data = btoa(unescape(encodeURIComponent(svgData)));
        dataUrl = `data:image/svg+xml;base64,${base64Data}`;
      } catch (encodeError) {
        console.error('[Export] Base64 encoding failed, using blob fallback:', encodeError);
        // Fallback to blob URL if base64 encoding fails
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        dataUrl = URL.createObjectURL(svgBlob);
      }
      
      console.log('[Export] Loading SVG as image...');

      // Load and draw the image
      const img = new Image();
      img.onload = () => {
        console.log('[Export] Image loaded, drawing to canvas...');
        ctx.drawImage(img, 0, 0, width, height);

        // Download as PNG
        canvas.toBlob((blob) => {
          if (!blob) {
            console.error('[Export] Failed to create blob');
            alert('Unable to export: Failed to generate image');
            return;
          }
          console.log('[Export] Blob created, triggering download...');
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `epm-gantt-chart-${new Date().toISOString().split('T')[0]}.png`;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          
          // Cleanup
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
            console.log('[Export] Download complete');
          }, 100);
        }, 'image/png', 1.0);
      };
      
      img.onerror = (e) => {
        console.error('[Export] Image loading failed:', e);
        alert('Unable to export: Failed to load chart image');
      };
      
      img.src = dataUrl;
    } catch (error) {
      console.error('[Export] Failed to export Gantt chart:', error);
      alert('Export failed. Please try again.');
    }
  };

  // Helper function to inline computed styles on the ORIGINAL (in-DOM) SVG elements
  // Stores original style attribute values for restoration
  function inlineStylesOnOriginal(element: Element, backups: Map<Element, string>) {
    // Backup current style attribute
    backups.set(element, element.getAttribute('style') || '');
    
    const computedStyle = window.getComputedStyle(element);
    
    // Key style properties to inline for SVG export
    const stylesToInline = [
      'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity',
      'font-family', 'font-size', 'font-weight', 'text-anchor'
    ];
    
    let inlineStyle = element.getAttribute('style') || '';
    for (const prop of stylesToInline) {
      const value = computedStyle.getPropertyValue(prop);
      if (value && value !== 'none' && value !== '' && value !== 'rgb(0, 0, 0)') {
        // Only add if not already in the style attribute
        if (!inlineStyle.includes(prop + ':')) {
          inlineStyle += `${prop}: ${value}; `;
        }
      }
    }
    
    // Handle Tailwind fill classes explicitly
    const classList = element.classList;
    if (classList.contains('fill-gray-600')) {
      inlineStyle += 'fill: #4b5563; ';
    } else if (classList.contains('fill-gray-700')) {
      inlineStyle += 'fill: #374151; ';
    } else if (classList.contains('fill-gray-500')) {
      inlineStyle += 'fill: #6b7280; ';
    }
    
    if (inlineStyle) {
      element.setAttribute('style', inlineStyle);
    }
    
    // Recursively process children
    for (const child of Array.from(element.children)) {
      inlineStylesOnOriginal(child, backups);
    }
  }
  
  // Restore original style attributes
  function restoreOriginalStyles(element: Element, backups: Map<Element, string>) {
    const originalStyle = backups.get(element);
    if (originalStyle !== undefined) {
      if (originalStyle) {
        element.setAttribute('style', originalStyle);
      } else {
        element.removeAttribute('style');
      }
    }
    
    for (const child of Array.from(element.children)) {
      restoreOriginalStyles(child, backups);
    }
  }

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
