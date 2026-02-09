/**
 * ResourceWorkloadView Component
 * Visualizes resource utilization and workload distribution
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { BarChart, AlertCircle, TrendingUp } from 'lucide-react';
import { useResourceWorkload } from '@/hooks/useTaskAssignments';

interface ResourceWorkloadViewProps {
  programId: string;
}

export default function ResourceWorkloadView({ programId }: ResourceWorkloadViewProps) {
  const { data: workload, isLoading } = useResourceWorkload(programId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Resource Workload
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!workload || workload.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Resource Workload
          </CardTitle>
          <CardDescription>
            No workload data available
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No resource workload data available. Ensure task assignments have been created.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Calculate overall statistics
  const totalHours = workload.reduce((sum, r) => sum + r.totalAssignedHours, 0);
  const avgUtilization = workload.reduce((sum, r) => sum + r.utilizationPercentage, 0) / workload.length;
  const overloadedResources = workload.filter(r => r.utilizationPercentage > 100).length;

  // Helper to get utilization color
  const getUtilizationColor = (percentage: number): string => {
    if (percentage > 100) return 'text-red-600 dark:text-red-400';
    if (percentage > 80) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  // Helper to get utilization badge variant
  const getUtilizationBadge = (percentage: number) => {
    if (percentage > 100) {
      return <Badge variant="destructive">Overloaded ({Math.round(percentage)}%)</Badge>;
    }
    if (percentage > 80) {
      return <Badge variant="secondary">High ({Math.round(percentage)}%)</Badge>;
    }
    if (percentage > 50) {
      return <Badge variant="outline">Moderate ({Math.round(percentage)}%)</Badge>;
    }
    return <Badge variant="outline">Low ({Math.round(percentage)}%)</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart className="h-5 w-5" />
          Resource Workload
        </CardTitle>
        <CardDescription>
          Utilization across {workload.length} resources
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Total Hours</div>
            <div className="text-2xl font-bold" data-testid="text-total-hours">
              {totalHours.toFixed(0)}h
            </div>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Avg Utilization</div>
            <div className={`text-2xl font-bold ${getUtilizationColor(avgUtilization)}`} data-testid="text-avg-utilization">
              {Math.round(avgUtilization)}%
            </div>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Overloaded</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-overloaded-count">
              {overloadedResources}
            </div>
          </div>
        </div>

        {/* Warning for overloaded resources */}
        {overloadedResources > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {overloadedResources} resource{overloadedResources > 1 ? 's are' : ' is'} over-allocated. 
              Consider redistributing tasks or adding more resources.
            </AlertDescription>
          </Alert>
        )}

        {/* Resource List */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground">Resources</h3>
          {workload.map(resource => (
            <div 
              key={resource.resourceId} 
              className="border rounded-lg p-4 space-y-3"
              data-testid={`card-resource-${resource.resourceId}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <h4 className="font-semibold">{resource.resourceName}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {resource.resourceType}
                    </Badge>
                    <span>{resource.assignmentCount} assignments</span>
                  </div>
                </div>
                {getUtilizationBadge(resource.utilizationPercentage)}
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Workload</span>
                  <span className="font-medium">
                    {resource.totalAssignedHours.toFixed(0)}h assigned
                    {resource.totalActualHours > 0 && (
                      <span className="text-muted-foreground ml-2">
                        / {resource.totalActualHours.toFixed(0)}h actual
                      </span>
                    )}
                  </span>
                </div>
                <Progress 
                  value={Math.min(resource.utilizationPercentage, 100)} 
                  className="h-2"
                  data-testid={`progress-${resource.resourceId}`}
                />
              </div>

              {/* Assignment Details */}
              {resource.assignments && resource.assignments.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    View {resource.assignments.length} assignments
                  </summary>
                  <div className="mt-2 space-y-1 pl-4">
                    {resource.assignments.map((assignment, idx) => (
                      <div 
                        key={idx} 
                        className="flex justify-between py-1 border-l-2 pl-2"
                        data-testid={`assignment-detail-${resource.resourceId}-${idx}`}
                      >
                        <span className="text-muted-foreground">{assignment.taskName}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{assignment.estimatedHours}h</span>
                          <Badge variant="outline" className="text-xs">
                            {assignment.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>

        {/* Footer Insight */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground border-t pt-4">
          <TrendingUp className="h-4 w-4" />
          <span>
            Utilization assumes 40-hour work weeks. Adjust assignments as needed for balanced workload.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
