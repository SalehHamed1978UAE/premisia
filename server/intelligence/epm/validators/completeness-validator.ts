import { BaseValidator, ValidatorContext, ValidatorIssue, ValidatorResult } from './base-validator';
import type { Workstream } from '../../types';

export class CompletenessValidator extends BaseValidator {
  readonly name = 'CompletenessValidator';
  readonly description = 'Ensures all required EPM fields are populated with meaningful values';
  
  validate(context: ValidatorContext): ValidatorResult {
    const issues: ValidatorIssue[] = [];
    const { workstreams, timeline, stageGates } = context;
    
    this.validateWorkstreams(workstreams, issues);
    this.validateTimeline(timeline, issues);
    this.validateStageGates(stageGates, issues);
    
    return this.createResult(
      issues.filter(i => i.severity === 'error').length === 0,
      issues,
      []
    );
  }
  
  private validateWorkstreams(workstreams: Workstream[], issues: ValidatorIssue[]): void {
    if (workstreams.length === 0) {
      issues.push(this.createIssue(
        'error',
        'NO_WORKSTREAMS',
        'No workstreams defined in the EPM program',
        { suggestion: 'Add at least one workstream to the program' }
      ));
      return;
    }
    
    for (const ws of workstreams) {
      if (!ws.name || ws.name.trim().length === 0) {
        issues.push(this.createIssue(
          'error',
          'MISSING_WS_NAME',
          `Workstream ${ws.id} has no name`,
          { workstreamId: ws.id, field: 'name' }
        ));
      }
      
      if (!ws.description || ws.description.trim().length === 0) {
        issues.push(this.createIssue(
          'warning',
          'MISSING_WS_DESCRIPTION',
          `Workstream "${ws.name}" has no description`,
          { workstreamId: ws.id, field: 'description' }
        ));
      }
      
      if (ws.deliverables.length === 0) {
        issues.push(this.createIssue(
          'warning',
          'NO_DELIVERABLES',
          `Workstream "${ws.name}" has no deliverables`,
          { workstreamId: ws.id, field: 'deliverables', suggestion: 'Add at least one deliverable' }
        ));
      }
      
      if (ws.startMonth < 0) {
        issues.push(this.createIssue(
          'error',
          'INVALID_START_MONTH',
          `Workstream "${ws.name}" has invalid start month: ${ws.startMonth}`,
          { workstreamId: ws.id, field: 'startMonth' }
        ));
      }
      
      if (ws.endMonth < ws.startMonth) {
        issues.push(this.createIssue(
          'error',
          'INVALID_DURATION',
          `Workstream "${ws.name}" ends (M${ws.endMonth}) before it starts (M${ws.startMonth})`,
          { workstreamId: ws.id, field: 'endMonth' }
        ));
      }
      
      for (const del of ws.deliverables) {
        if (!del.name || del.name.trim().length === 0) {
          issues.push(this.createIssue(
            'error',
            'MISSING_DELIVERABLE_NAME',
            `Deliverable ${del.id} in "${ws.name}" has no name`,
            { workstreamId: ws.id, field: `deliverables.${del.id}.name` }
          ));
        }
      }
    }
  }
  
  private validateTimeline(timeline: any, issues: ValidatorIssue[]): void {
    if (!timeline) {
      issues.push(this.createIssue(
        'error',
        'NO_TIMELINE',
        'No timeline defined for the EPM program',
        { suggestion: 'Generate a timeline with phases and milestones' }
      ));
      return;
    }
    
    if (!timeline.phases || timeline.phases.length === 0) {
      issues.push(this.createIssue(
        'warning',
        'NO_PHASES',
        'Timeline has no phases defined',
        { suggestion: 'Add at least one phase to the timeline' }
      ));
    }
    
    if (timeline.totalMonths <= 0) {
      issues.push(this.createIssue(
        'error',
        'INVALID_DURATION',
        `Invalid total program duration: ${timeline.totalMonths} months`,
        { field: 'timeline.totalMonths' }
      ));
    }
  }
  
  private validateStageGates(stageGates: any, issues: ValidatorIssue[]): void {
    if (!stageGates) {
      issues.push(this.createIssue(
        'warning',
        'NO_STAGE_GATES',
        'No stage gates defined for the EPM program',
        { suggestion: 'Add stage gates for phase completion reviews' }
      ));
      return;
    }
    
    if (!stageGates.gates || stageGates.gates.length === 0) {
      issues.push(this.createIssue(
        'warning',
        'EMPTY_STAGE_GATES',
        'Stage gates array is empty',
        { suggestion: 'Add at least one stage gate' }
      ));
    }
    
    for (const gate of stageGates.gates || []) {
      if (!gate.goCriteria || gate.goCriteria.length === 0) {
        issues.push(this.createIssue(
          'warning',
          'NO_GO_CRITERIA',
          `Stage gate ${gate.gate} has no go/no-go criteria`,
          { field: `stageGates.gates[${gate.gate}].goCriteria` }
        ));
      }
    }
  }
}
