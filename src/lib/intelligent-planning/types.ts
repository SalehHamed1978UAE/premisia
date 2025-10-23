/**
 * @module planning/types
 * Core type definitions for the planning system
 */

export type TaskId = string;
export type ResourceId = string;

export interface Duration {
  optimistic: number;
  likely: number;
  pessimistic: number;
  unit: 'days' | 'weeks' | 'months';
}

export interface Deliverable {
  id: string;
  name: string;
  description?: string;
  dueMonth?: number;
}

export interface ResourceRequirement {
  skill: string;
  quantity: number;
  duration: number;
}

export interface Task {
  id: TaskId;
  name: string;
  description?: string;
  duration: Duration;
  dependencies: TaskId[];
  deliverables?: Deliverable[];
  requirements: ResourceRequirement[];
  complexity?: 'low' | 'medium' | 'high';
  risk?: 'low' | 'medium' | 'high';
}

export interface ScheduledTask extends Task {
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  slack: number;
  startDate: Date;
  endDate: Date;
  isCritical: boolean;
  assignedResources: ResourceId[];
}

export interface Schedule {
  tasks: ScheduledTask[];
  criticalPath: TaskId[];
  totalDuration: number;
  startDate: Date;
  endDate: Date;
  totalCost?: number;
}

export interface Resource {
  id: ResourceId;
  name: string;
  type?: string;
  capacity: number;
  skills: string[];
  availability: ResourceAvailability[];
  costPerUnit: number;
}

export interface ResourceAvailability {
  startDate: Date;
  endDate: Date;
  percentAvailable: number;
}

export interface Constraint {
  id: string;
  type: 'deadline' | 'budget' | 'milestone' | 'resource';
  description: string;
  value: any;
  isHard: boolean;
}

export interface ValidationIssue {
  severity: 'critical' | 'warning' | 'info';
  type: string;
  message: string;
  affectedTasks: string[];
  suggestedFix?: string;
}

export interface ScheduleScore {
  feasibility: number;
  efficiency: number;
  riskLevel: number;
  resourceUtilization: number;
  overall: number;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  score: ScheduleScore;
  suggestions: string[];
}
