/**
 * @module planning/interfaces
 * All interface definitions for the planning system
 */

import { 
  Task, 
  Schedule, 
  Resource, 
  Constraint, 
  ValidationResult 
} from './types';

// ============================================
// SCHEDULER INTERFACES
// ============================================

export interface IScheduler {
  schedule(tasks: Task[]): Schedule;
}

// ============================================
// EXTRACTOR INTERFACES
// ============================================

export interface ITaskExtractor {
  extract(strategy: any): Promise<Task[]>;
  decompose(workstream: any): Promise<Task[]>;
  inferDependencies(tasks: Task[]): Promise<Task[]>;
}

// ============================================
// RESOURCE INTERFACES
// ============================================

export interface IResourceManager {
  allocate(schedule: Schedule, resources: Resource[]): ResourceAllocation;
  level(allocation: ResourceAllocation): LeveledSchedule;
  detectConflicts(schedule: Schedule, resources: Resource[]): ResourceConflict[];
}

export interface ResourceAllocation {
  schedule: Schedule;
  assignments: Map<string, string[]>;
  utilization: ResourceUtilization[];
  conflicts: ResourceConflict[];
}

export interface ResourceConflict {
  period: { start: Date; end: Date };
  required: number;
  available: number;
  overallocation: number;
  affectedTasks: string[];
}

export interface ResourceUtilization {
  resourceId: string;
  periods: UtilizationPeriod[];
  averageUtilization: number;
  peakUtilization: number;
}

export interface UtilizationPeriod {
  start: Date;
  end: Date;
  utilization: number;
  assignedTasks: string[];
}

export interface LeveledSchedule extends Schedule {
  levelingAdjustments: LevelingAdjustment[];
  newConflicts: ResourceConflict[];
}

export interface LevelingAdjustment {
  taskId: string;
  originalStart: Date;
  newStart: Date;
  reason: string;
}

// ============================================
// OPTIMIZER INTERFACES
// ============================================

export interface IOptimizer {
  optimize(
    schedule: Schedule,
    constraints: Constraint[]
  ): Promise<OptimizedSchedule>;
}

export interface OptimizedSchedule extends Schedule {
  optimizationScore: number;
  iterations: number;
  adjustments: Adjustment[];
}

export interface Adjustment {
  type: 'move' | 'extend' | 'compress' | 'parallelize' | 'serialize';
  taskId: string;
  from: any;
  to: any;
  reason: string;
}

// ============================================
// VALIDATOR INTERFACES
// ============================================

export interface IValidator {
  validate(schedule: Schedule): Promise<ValidationResult>;
  rationalize(schedule: Schedule): Promise<RationalizationReport>;
}

export interface RationalizationReport {
  logicalCoherence: number;
  reasoning: string[];
  assumptions: string[];
  risks: RiskAssessment[];
  opportunities: Opportunity[];
  criticalInsights: string[];
}

export interface RiskAssessment {
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface Opportunity {
  description: string;
  benefit: string;
  effort: 'low' | 'medium' | 'high';
  recommendation: string;
}

// ============================================
// LLM PROVIDER INTERFACES
// ============================================

export interface LLMProvider {
  generate(prompt: string): Promise<string>;
  generateStructured<T>(config: {
    prompt: string;
    schema: any;
  }): Promise<T>;
}

export interface LLMConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}
