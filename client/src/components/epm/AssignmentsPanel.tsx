/**
 * AssignmentsPanel Component
 * Displays and manages task-to-resource assignments within an EPM program
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Trash2, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { 
  useTaskAssignments, 
  useUpdateAssignment, 
  useDeleteAssignment,
  type TaskAssignment 
} from '@/hooks/useTaskAssignments';
import { useToast } from '@/hooks/use-toast';
import type { Workstream, ResourcePlan } from '@/types/intelligence';

interface AssignmentsPanelProps {
  programId: string;
  workstreams: Workstream[];
  resourcePlan?: ResourcePlan;
  readonly?: boolean;
}

export default function AssignmentsPanel({ 
  programId, 
  workstreams, 
  resourcePlan,
  readonly = false 
}: AssignmentsPanelProps) {
  const { toast } = useToast();
  const { data: assignments, isLoading } = useTaskAssignments(programId);
  const updateMutation = useUpdateAssignment();
  const deleteMutation = useDeleteAssignment();

  const [expandedWorkstream, setExpandedWorkstream] = useState<string | null>(null);

  // Get all resources from resource plan
  // IMPORTANT: ID generation must match backend Assignment Engine (epm-synthesizer.ts)
  // Backend uses: member.id || `internal-${index}` and ext.id || `external-${index}`
  const allResources = [
    ...(resourcePlan?.internalTeam || []).map((r: any, idx) => ({ 
      id: r.id || `internal-${idx}`, // Match backend ID generation
      name: r.role || r.name || `Resource ${idx + 1}`, 
      type: 'internal' as const 
    })),
    ...(resourcePlan?.externalResources || []).map((r: any, idx) => ({ 
      id: r.id || `external-${idx}`, // Match backend ID generation
      name: r.type || r.description || `External Resource ${idx + 1}`, 
      type: 'external' as const 
    }))
  ];

  // Helper to get task/deliverable name
  const getTaskName = (taskId: string): string => {
    // Tasks are stored as deliverables in the workstream structure
    for (const ws of workstreams) {
      const deliverable = ws.deliverables?.find((d: any) => d.id === taskId || d.name === taskId);
      if (deliverable) return deliverable.name || deliverable.description || taskId;
    }
    return taskId;
  };

  // Helper to get resource name
  const getResourceName = (resourceId: string): string => {
    const resource = allResources.find(r => r.id === resourceId);
    return resource?.name || resourceId;
  };

  // Helper to get workstream name
  const getWorkstreamName = (taskId: string): string => {
    for (const ws of workstreams) {
      const deliverable = ws.deliverables?.find((d: any) => d.id === taskId || d.name === taskId);
      if (deliverable) return ws.name;
    }
    return 'Unknown';
  };

  // Group assignments by workstream
  const assignmentsByWorkstream = workstreams.map(ws => {
    const wsAssignments = (assignments || []).filter(a => {
      // Check if this assignment's task is a deliverable in this workstream
      const deliverable = ws.deliverables?.find((d: any) => d.id === a.taskId || d.name === a.taskId);
      return !!deliverable;
    });
    return {
      workstream: ws,
      assignments: wsAssignments
    };
  });

  const handleStatusChange = async (assignment: TaskAssignment, newStatus: 'assigned' | 'in_progress' | 'completed') => {
    try {
      await updateMutation.mutateAsync({
        id: assignment.id,
        programId,
        data: { status: newStatus }
      });
      toast({
        title: "Status Updated",
        description: `Assignment status changed to ${newStatus.replace('_', ' ')}`,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update assignment status",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (assignment: TaskAssignment) => {
    try {
      await deleteMutation.mutateAsync({
        id: assignment.id,
        programId
      });
      toast({
        title: "Assignment Deleted",
        description: "Task assignment has been removed",
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete assignment",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'outline', icon: any }> = {
      assigned: { variant: 'outline', icon: AlertCircle },
      in_progress: { variant: 'secondary', icon: Users },
      completed: { variant: 'default', icon: CheckCircle2 },
    };
    const config = variants[status] || variants.assigned;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Task Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Task Assignments
          </CardTitle>
          <CardDescription>
            No task assignments found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This program doesn't have any task assignments yet. Assignments are automatically 
              generated when creating EPM programs with resource plans.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Task Assignments
        </CardTitle>
        <CardDescription>
          Resource allocations across {workstreams.length} workstreams ({assignments.length} assignments)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {assignmentsByWorkstream.map(({ workstream, assignments: wsAssignments }) => (
          <div key={workstream.id || workstream.name} className="border rounded-lg">
            <button
              onClick={() => setExpandedWorkstream(
                expandedWorkstream === workstream.name ? null : workstream.name
              )}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
              data-testid={`button-toggle-workstream-${workstream.name}`}
            >
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{workstream.name}</h3>
                <Badge variant="secondary">{wsAssignments.length} assignments</Badge>
              </div>
              <span className="text-sm text-muted-foreground">
                {expandedWorkstream === workstream.name ? '▼' : '▶'}
              </span>
            </button>

            {expandedWorkstream === workstream.name && (
              <div className="border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Status</TableHead>
                      {!readonly && <TableHead className="w-[100px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wsAssignments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={readonly ? 5 : 6} className="text-center text-muted-foreground">
                          No assignments in this workstream
                        </TableCell>
                      </TableRow>
                    ) : (
                      wsAssignments.map(assignment => (
                        <TableRow key={assignment.id} data-testid={`row-assignment-${assignment.id}`}>
                          <TableCell className="font-medium">
                            {getTaskName(assignment.taskId)}
                          </TableCell>
                          <TableCell>{getResourceName(assignment.resourceId)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {assignment.resourceType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm">
                                Est: {assignment.estimatedHours || 0}h
                              </div>
                              {assignment.actualHours !== undefined && assignment.actualHours > 0 && (
                                <div className="text-sm text-muted-foreground">
                                  Actual: {assignment.actualHours}h
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {readonly ? (
                              getStatusBadge(assignment.status)
                            ) : (
                              <Select
                                value={assignment.status}
                                onValueChange={(value) => handleStatusChange(assignment, value as any)}
                                disabled={updateMutation.isPending}
                              >
                                <SelectTrigger 
                                  className="w-[140px]"
                                  data-testid={`select-status-${assignment.id}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="assigned">Assigned</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          {!readonly && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(assignment)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-${assignment.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
