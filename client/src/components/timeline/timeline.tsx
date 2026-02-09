import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus, 
  Calendar, 
  Filter, 
  MoreHorizontal, 
  AlertCircle,
  Clock,
  User
} from "lucide-react";
import { useProgram } from "@/contexts/ProgramContext";
import type { Task } from "@shared/schema";

export function Timeline() {
  const { selectedProgramId } = useProgram();
  
  const { data: tasks, isLoading, error } = useQuery<Task[]>({
    queryKey: ['/api/tasks', selectedProgramId],
    queryFn: async () => {
      if (!selectedProgramId) return [];
      const res = await fetch(`/api/tasks?programId=${selectedProgramId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    enabled: !!selectedProgramId,
  });

  if (!selectedProgramId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please select a program from the dropdown above to view timeline and tasks.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>
        <Card>
          <CardContent className="p-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 mb-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load timeline data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'At Risk':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Delayed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'On Hold':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString();
  };

  const getGanttData = () => {
    if (!tasks || tasks.length === 0) return null;
    
    const tasksWithDates = tasks.filter(t => t.startDate && t.endDate);
    if (tasksWithDates.length === 0) return null;
    
    const dates = tasksWithDates.flatMap(t => [
      new Date(t.startDate!).getTime(),
      new Date(t.endDate!).getTime()
    ]);
    
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const totalMs = Math.max(maxDate.getTime() - minDate.getTime(), 1);
    
    return { minDate, maxDate, totalMs, tasksWithDates };
  };

  const calculateBarPosition = (task: Task, minDate: Date, totalMs: number) => {
    const startTime = new Date(task.startDate!).getTime();
    const endTime = new Date(task.endDate!).getTime();
    const minTime = minDate.getTime();
    
    const startOffsetMs = startTime - minTime;
    const durationMs = endTime - startTime;
    
    const left = (startOffsetMs / totalMs) * 100;
    const width = Math.max((durationMs / totalMs) * 100, 2);
    
    return { left: `${Math.max(left, 0)}%`, width: `${width}%` };
  };

  const getBarColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-500';
      case 'In Progress':
        return 'bg-blue-500';
      case 'At Risk':
        return 'bg-yellow-500';
      case 'Delayed':
        return 'bg-red-500';
      case 'On Hold':
        return 'bg-gray-400';
      default:
        return 'bg-gray-300';
    }
  };

  const ganttData = getGanttData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" data-testid="button-filter">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
        <Button data-testid="button-add-task">
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Gantt Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Timeline View</span>
          </CardTitle>
          <CardDescription>Gantt chart visualization of project tasks</CardDescription>
        </CardHeader>
        <CardContent>
          {!ganttData ? (
            <div className="min-h-[300px] flex items-center justify-center border-2 border-dashed border-border rounded-lg">
              <div className="text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Timeline Data</h3>
                <p className="text-muted-foreground">
                  Tasks need start and end dates to appear on the Gantt chart
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4" data-testid="gantt-chart">
              {/* Timeline header */}
              <div className="flex items-center justify-between text-sm text-muted-foreground border-b pb-2">
                <span data-testid="gantt-start-date">{formatDate(ganttData.minDate)}</span>
                <span data-testid="gantt-end-date">{formatDate(ganttData.maxDate)}</span>
              </div>
              
              {/* Gantt bars */}
              <div className="space-y-3">
                {ganttData.tasksWithDates.map((task) => {
                  const position = calculateBarPosition(task, ganttData.minDate, ganttData.totalMs);
                  return (
                    <div key={task.id} className="space-y-1" data-testid={`gantt-task-${task.id}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate max-w-[200px]" data-testid={`gantt-task-name-${task.id}`}>
                          {task.name}
                        </span>
                        <Badge className={getStatusColor(task.status)} variant="outline">
                          {task.status}
                        </Badge>
                      </div>
                      <div className="relative h-8 bg-muted rounded">
                        <div
                          className={`absolute h-full rounded ${getBarColor(task.status)} opacity-80 hover:opacity-100 transition-opacity flex items-center px-2`}
                          style={position}
                          data-testid={`gantt-bar-${task.id}`}
                        >
                          <span className="text-xs text-white font-medium truncate">
                            {task.progress}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle>Task List</CardTitle>
          <CardDescription>All program tasks and their current status</CardDescription>
        </CardHeader>
        <CardContent>
          {!tasks || tasks.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No tasks found</h3>
              <p className="text-muted-foreground mb-4">
                Start by creating your first task to begin tracking progress
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create First Task
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => (
                <div key={task.id} className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-foreground">{task.name}</h4>
                        <Badge className={getStatusColor(task.status)}>
                          {task.status}
                        </Badge>
                      </div>
                      
                      {task.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {task.description}
                        </p>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {formatDate(task.startDate)} - {formatDate(task.endDate)}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {task.ownerId || 'Unassigned'}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className="text-muted-foreground">Priority:</span>
                          <Badge variant="outline">{task.priority}</Badge>
                        </div>
                      </div>
                      
                      {task.progress !== null && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-muted-foreground">Progress</span>
                            <span className="text-sm font-medium">{task.progress}%</span>
                          </div>
                          <Progress value={task.progress} className="h-2" />
                        </div>
                      )}
                    </div>
                    
                    <Button variant="ghost" size="icon" data-testid={`task-menu-${task.id}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dependencies */}
      {tasks && tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Task Dependencies</CardTitle>
            <CardDescription>Critical path and task relationships</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                Task dependency visualization will be implemented here
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
