import type { Workstream, Timeline, StageGates } from '../../types';

export interface ValidatorContext {
  workstreams: Workstream[];
  timeline: Timeline;
  stageGates: StageGates;
  businessContext?: string;
  metadata?: Record<string, any>;
}

export interface ValidatorIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  field?: string;
  workstreamId?: string;
  suggestion?: string;
}

export interface ValidatorResult {
  validatorName: string;
  passed: boolean;
  issues: ValidatorIssue[];
  corrections: string[];
  metadata?: Record<string, any>;
}

export abstract class BaseValidator {
  abstract readonly name: string;
  abstract readonly description: string;
  
  abstract validate(context: ValidatorContext): ValidatorResult;
  
  protected createIssue(
    severity: ValidatorIssue['severity'],
    code: string,
    message: string,
    options?: Partial<ValidatorIssue>
  ): ValidatorIssue {
    return {
      severity,
      code,
      message,
      ...options,
    };
  }
  
  protected createResult(
    passed: boolean,
    issues: ValidatorIssue[],
    corrections: string[] = [],
    metadata?: Record<string, any>
  ): ValidatorResult {
    return {
      validatorName: this.name,
      passed,
      issues,
      corrections,
      metadata,
    };
  }
}
