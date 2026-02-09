/**
 * @module planning/types
 * Core types and interfaces for the planning system
 */

export type TaskId = string;
export type ResourceId = string;
export type ConstraintId = string;

export interface Task {
  id: TaskId;
  name: string;
  description?: string;
  duration: Duration;
  dependencies: TaskId[];
  deliverables: Deliverable[];
  requirements: ResourceRequirement[];
  complexity: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
}

export interface Duration {
  optimistic: number;
  likely: number;
  pessimistic: number;
  unit: 'days' | 'weeks' | 'months';
}

export interface ScheduledTask extends Task {
  startDate: Date;
  endDate: Date;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  slack: number;
  isCritical: boolean;
  assignedResources: ResourceId[];
}

export interface Schedule {
  tasks: ScheduledTask[];
  criticalPath: TaskId[];
  totalDuration: number;
  startDate: Date;
  endDate: Date;
  score?: ScheduleScore;
}

export interface ScheduleScore {
  feasibility: number;
  efficiency: number;
  riskLevel: number;
  resourceUtilization: number;
  overall: number;
}

export interface Constraint {
  id: ConstraintId;
  type: 'deadline' | 'budget' | 'resource' | 'dependency' | 'milestone';
  description: string;
  value: any;
  isHard: boolean;
}

export interface Resource {
  id: ResourceId;
  name: string;
  capacity: number;
  skills: string[];
  availability: Availability[];
  costPerUnit: number;
}

export interface Availability {
  startDate: Date;
  endDate: Date;
  percentAvailable: number;
}

export interface ResourceRequirement {
  skill: string;
  quantity: number;
  duration: number;
}

export interface Deliverable {
  id: string;
  name: string;
  description?: string;
  dueDate?: Date;
}

export interface ValidationIssue {
  severity: 'critical' | 'warning' | 'info';
  type: string;
  message: string;
  affectedTasks: TaskId[];
  suggestedFix?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  score: ScheduleScore;
  suggestions: string[];
}
