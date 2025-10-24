/**
 * @module planning/react/hooks
 * React hooks for integrating planning system with UI
 */

import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { PlanningRequest, PlanningResult } from '../orchestrator';

// ============================================
// PLANNING HOOK
// ============================================

interface PlanningState {
  status: 'idle' | 'planning' | 'success' | 'error';
  result?: PlanningResult;
  error?: Error;
  progress: PlanningProgress[];
  currentStep?: string;
  iterations: number;
  score: number;
}

interface PlanningProgress {
  name: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
}

type PlanningAction =
  | { type: 'PLANNING_START' }
  | { type: 'PLANNING_PROGRESS'; step: PlanningProgress }
  | { type: 'PLANNING_SUCCESS'; result: PlanningResult }
  | { type: 'PLANNING_ERROR'; error: Error }
  | { type: 'PLANNING_RESET' };

function planningReducer(state: PlanningState, action: PlanningAction): PlanningState {
  switch (action.type) {
    case 'PLANNING_START':
      return {
        ...state,
        status: 'planning',
        progress: [],
        error: undefined,
        result: undefined
      };
      
    case 'PLANNING_PROGRESS':
      const updatedProgress = [...state.progress];
      const existingIndex = updatedProgress.findIndex(p => p.name === action.step.name);
      
      if (existingIndex >= 0) {
        updatedProgress[existingIndex] = action.step;
      } else {
        updatedProgress.push(action.step);
      }
      
      return {
        ...state,
        progress: updatedProgress,
        currentStep: action.step.status === 'running' ? action.step.name : state.currentStep
      };
      
    case 'PLANNING_SUCCESS':
      return {
        ...state,
        status: 'success',
        result: action.result,
        iterations: action.result.metadata.iterations,
        score: action.result.metadata.score
      };
      
    case 'PLANNING_ERROR':
      return {
        ...state,
        status: 'error',
        error: action.error
      };
      
    case 'PLANNING_RESET':
      return {
        status: 'idle',
        progress: [],
        iterations: 0,
        score: 0
      };
      
    default:
      return state;
  }
}

export function useProjectPlanner(config?: {
  apiUrl?: string;
  socketUrl?: string;
  enableRealtime?: boolean;
}) {
  const [state, dispatch] = useReducer(planningReducer, {
    status: 'idle',
    progress: [],
    iterations: 0,
    score: 0
  });
  
  const socketRef = useRef<Socket | null>(null);
  
  // Initialize socket connection for real-time updates
  useEffect(() => {
    if (config?.enableRealtime && config.socketUrl) {
      socketRef.current = io(config.socketUrl);
      
      socketRef.current.on('planning:progress', (data) => {
        dispatch({ type: 'PLANNING_PROGRESS', step: data });
      });
      
      return () => {
        socketRef.current?.disconnect();
      };
    }
  }, [config?.enableRealtime, config?.socketUrl]);
  
  const plan = useCallback(async (request: PlanningRequest) => {
    dispatch({ type: 'PLANNING_START' });
    
    try {
      const response = await fetch(`${config?.apiUrl || '/api'}/planning/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`Planning failed: ${response.statusText}`);
      }
      
      const result: PlanningResult = await response.json();
      dispatch({ type: 'PLANNING_SUCCESS', result });
      
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Planning failed');
      dispatch({ type: 'PLANNING_ERROR', error: err });
      throw err;
    }
  }, [config?.apiUrl]);
  
  const reset = useCallback(() => {
    dispatch({ type: 'PLANNING_RESET' });
  }, []);
  
  return {
    plan,
    reset,
    status: state.status,
    result: state.result,
    error: state.error,
    progress: state.progress,
    currentStep: state.currentStep,
    iterations: state.iterations,
    score: state.score,
    isPlanning: state.status === 'planning',
    isSuccess: state.status === 'success',
    isError: state.status === 'error'
  };
}

// ============================================
// SCHEDULE VISUALIZATION HOOK
// ============================================

interface ScheduleVisualization {
  ganttData: any;
  criticalPath: string[];
  resourceChart: any;
  timelineData: any;
}

export function useScheduleVisualization(schedule?: any) {
  const [visualization, setVisualization] = useState<ScheduleVisualization | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!schedule) {
      setVisualization(null);
      return;
    }
    
    setLoading(true);
    
    // Transform schedule to various visualization formats
    const ganttData = transformToGantt(schedule);
    const criticalPath = extractCriticalPath(schedule);
    const resourceChart = generateResourceChart(schedule);
    const timelineData = generateTimelineData(schedule);
    
    setVisualization({
      ganttData,
      criticalPath,
      resourceChart,
      timelineData
    });
    
    setLoading(false);
  }, [schedule]);
  
  return { visualization, loading };
}

// ============================================
// STRATEGY ADJUSTMENT HOOK
// ============================================

export function useStrategyAdjustments(adjustments?: string[]) {
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  
  const acceptAdjustment = useCallback((index: number) => {
    setAccepted(prev => new Set([...prev, index]));
    setRejected(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);
  
  const rejectAdjustment = useCallback((index: number) => {
    setRejected(prev => new Set([...prev, index]));
    setAccepted(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);
  
  const getAdjustmentStatus = useCallback((index: number) => {
    if (accepted.has(index)) return 'accepted';
    if (rejected.has(index)) return 'rejected';
    return 'pending';
  }, [accepted, rejected]);
  
  const getAcceptedAdjustments = useCallback(() => {
    return adjustments?.filter((_, i) => accepted.has(i)) || [];
  }, [adjustments, accepted]);
  
  return {
    acceptAdjustment,
    rejectAdjustment,
    getAdjustmentStatus,
    getAcceptedAdjustments,
    acceptedCount: accepted.size,
    rejectedCount: rejected.size
  };
}

// ============================================
// PLANNING HISTORY HOOK
// ============================================

interface PlanningHistoryEntry {
  id: string;
  date: Date;
  score: number;
  iterations: number;
  success: boolean;
  adjustments: number;
}

export function usePlanningHistory(epmProgramId: string) {
  const [history, setHistory] = useState<PlanningHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/planning/history/${epmProgramId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch planning history');
      }
      
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [epmProgramId]);
  
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);
  
  return { history, loading, error, refetch: fetchHistory };
}

// ============================================
// RESOURCE CONFLICT RESOLVER HOOK
// ============================================

export function useResourceConflictResolver(conflicts?: any[]) {
  const [resolutions, setResolutions] = useState<Map<string, any>>(new Map());
  const [resolving, setResolving] = useState(false);
  
  const resolveConflict = useCallback(async (conflictId: string, resolution: any) => {
    setResolving(true);
    
    try {
      const response = await fetch('/api/planning/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conflictId, resolution })
      });
      
      if (!response.ok) {
        throw new Error('Failed to resolve conflict');
      }
      
      const result = await response.json();
      setResolutions(prev => new Map([...prev, [conflictId, result]]));
      
      return result;
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      throw error;
    } finally {
      setResolving(false);
    }
  }, []);
  
  const getResolution = useCallback((conflictId: string) => {
    return resolutions.get(conflictId);
  }, [resolutions]);
  
  return {
    resolveConflict,
    getResolution,
    resolutions,
    resolving,
    unresolvedCount: (conflicts?.length || 0) - resolutions.size
  };
}

// ============================================
// OPTIMIZATION TRACKER HOOK
// ============================================

export function useOptimizationTracker() {
  const [iterations, setIterations] = useState<any[]>([]);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  
  const addIteration = useCallback((iteration: any) => {
    setIterations(prev => [...prev, iteration]);
    setCurrentIteration(prev => prev + 1);
    
    if (iteration.score > bestScore) {
      setBestScore(iteration.score);
    }
  }, [bestScore]);
  
  const reset = useCallback(() => {
    setIterations([]);
    setCurrentIteration(0);
    setBestScore(0);
  }, []);
  
  const getImprovement = useCallback(() => {
    if (iterations.length < 2) return 0;
    
    const first = iterations[0].score;
    const last = iterations[iterations.length - 1].score;
    
    return ((last - first) / first) * 100;
  }, [iterations]);
  
  return {
    iterations,
    currentIteration,
    bestScore,
    addIteration,
    reset,
    improvement: getImprovement()
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function transformToGantt(schedule: any): any {
  return {
    tasks: schedule.tasks.map((task: any) => ({
      id: task.id,
      name: task.name,
      start: task.startDate,
      end: task.endDate,
      progress: 0,
      dependencies: task.dependencies,
      type: task.isCritical ? 'critical' : 'normal'
    }))
  };
}

function extractCriticalPath(schedule: any): string[] {
  return schedule.criticalPath || [];
}

function generateResourceChart(schedule: any): any {
  // Generate resource utilization chart data
  return {
    labels: [],
    datasets: []
  };
}

function generateTimelineData(schedule: any): any {
  // Generate timeline visualization data
  return {
    phases: [],
    milestones: []
  };
}

export default {
  useProjectPlanner,
  useScheduleVisualization,
  useStrategyAdjustments,
  usePlanningHistory,
  useResourceConflictResolver,
  useOptimizationTracker
};
