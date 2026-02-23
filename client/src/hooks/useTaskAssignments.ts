/**
 * React Query hooks for managing task assignments
 * Provides CRUD operations and data fetching for resource-to-task assignments
 */

import { useQuery, useMutation, UseQueryResult } from '@tanstack/react-query';
import { queryClient, apiRequest, authFetch } from '@/lib/queryClient';

// ============================================================================
// Types (matching backend schema)
// ============================================================================

export interface TaskAssignment {
  id: string;
  epmProgramId: string;
  taskId: string;
  resourceId: string;
  resourceType: 'internal_team' | 'external_resource';
  assignedAt: Date;
  estimatedHours?: number;
  actualHours?: number;
  status: 'assigned' | 'in_progress' | 'completed' | 'active';
  assignmentSource: 'ai_generated' | 'manual' | 'bulk_import';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceWorkload {
  resourceId: string;
  resourceName: string;
  resourceType: 'internal_team' | 'external_resource';
  totalAssignedHours: number;
  totalActualHours: number;
  assignmentCount: number;
  utilizationPercentage: number;
  assignments: Array<{
    taskId: string;
    taskName: string;
    estimatedHours: number;
    actualHours: number;
    status: string;
  }>;
}

export interface CreateAssignmentInput {
  epmProgramId: string;
  taskId: string;
  resourceId: string;
  resourceType: 'internal_team' | 'external_resource';
  estimatedHours?: number;
  status?: 'assigned' | 'in_progress' | 'completed' | 'active';
  assignmentSource?: 'ai_generated' | 'manual' | 'bulk_import';
  notes?: string;
}

export interface UpdateAssignmentInput {
  estimatedHours?: number;
  actualHours?: number;
  status?: 'assigned' | 'in_progress' | 'completed';
  notes?: string;
}

// ============================================================================
// Query Keys
// ============================================================================

const assignmentKeys = {
  all: ['task-assignments'] as const,
  byProgram: (programId: string) => ['task-assignments', 'program', programId] as const,
  byTask: (taskId: string) => ['task-assignments', 'task', taskId] as const,
  workload: (programId: string) => ['task-assignments', 'workload', programId] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch all assignments for a specific EPM program
 */
export function useTaskAssignments(programId: string): UseQueryResult<TaskAssignment[]> {
  return useQuery({
    queryKey: assignmentKeys.byProgram(programId),
    queryFn: async () => {
      const response = await authFetch(`/api/task-assignments/program/${programId}`);
      if (!response.ok) throw new Error('Failed to fetch assignments');
      const data = await response.json();
      return data.assignments;
    },
    enabled: !!programId,
  });
}

/**
 * Fetch assignments for a specific task
 */
export function useTaskAssignmentsByTask(taskId: string): UseQueryResult<TaskAssignment[]> {
  return useQuery({
    queryKey: assignmentKeys.byTask(taskId),
    queryFn: async () => {
      const response = await authFetch(`/api/task-assignments/task/${taskId}`);
      if (!response.ok) throw new Error('Failed to fetch task assignments');
      const data = await response.json();
      return data.assignments;
    },
    enabled: !!taskId,
  });
}

/**
 * Fetch resource workload summary for a program
 */
export function useResourceWorkload(programId: string): UseQueryResult<ResourceWorkload[]> {
  return useQuery({
    queryKey: assignmentKeys.workload(programId),
    queryFn: async () => {
      const response = await authFetch(`/api/task-assignments/program/${programId}/workload`);
      if (!response.ok) throw new Error('Failed to fetch workload');
      const data = await response.json();
      return data.workload;
    },
    enabled: !!programId,
  });
}

/**
 * Create a new task assignment
 */
export function useCreateAssignment() {
  return useMutation({
    mutationFn: async (data: CreateAssignmentInput) => {
      return await apiRequest('POST', '/api/task-assignments', data);
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: assignmentKeys.byProgram(variables.epmProgramId) });
      queryClient.invalidateQueries({ queryKey: assignmentKeys.workload(variables.epmProgramId) });
    },
  });
}

/**
 * Update an existing task assignment
 */
export function useUpdateAssignment() {
  return useMutation({
    mutationFn: async ({ id, programId, data }: { id: string; programId: string; data: UpdateAssignmentInput }) => {
      return await apiRequest('PATCH', `/api/task-assignments/${id}`, data);
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ 
        queryKey: assignmentKeys.byProgram(variables.programId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: assignmentKeys.workload(variables.programId) 
      });
    },
  });
}

/**
 * Delete a task assignment
 */
export function useDeleteAssignment() {
  return useMutation({
    mutationFn: async ({ id, programId }: { id: string; programId: string }) => {
      return await apiRequest('DELETE', `/api/task-assignments/${id}`, {});
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: assignmentKeys.byProgram(variables.programId) });
      queryClient.invalidateQueries({ queryKey: assignmentKeys.workload(variables.programId) });
    },
  });
}

/**
 * Bulk delete task assignments
 */
export function useBulkDeleteAssignments() {
  return useMutation({
    mutationFn: async ({ ids, programId }: { ids: string[]; programId: string }) => {
      return await apiRequest('POST', '/api/task-assignments/bulk-delete', { assignmentIds: ids });
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: assignmentKeys.byProgram(variables.programId) });
      queryClient.invalidateQueries({ queryKey: assignmentKeys.workload(variables.programId) });
    },
  });
}
