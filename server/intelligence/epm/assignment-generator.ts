/**
 * AssignmentGenerator - Generates task assignments from EPM program data
 * 
 * Creates task assignments by matching resources to deliverables across workstreams.
 */

import type { EPMProgram } from '../types';

export interface TaskAssignment {
  epmProgramId: string;
  taskId: string;
  resourceId: string;
  resourceType: 'internal' | 'external' | 'team';
  estimatedHours: number;
  status: 'assigned' | 'in_progress' | 'completed';
  assignmentSource: 'ai_generated' | 'user_assigned' | 'auto_suggested';
  notes?: string;
}

export class AssignmentGenerator {
  async generate(epmProgram: EPMProgram, programId: string): Promise<TaskAssignment[]> {
    const assignments: TaskAssignment[] = [];
    
    console.log('[AssignmentGenerator] Starting assignment generation...');
    console.log(`[AssignmentGenerator] Program ID: ${programId}`);
    
    const workstreams = epmProgram.workstreams || [];
    const resourcePlan = epmProgram.resourcePlan;
    
    if (!workstreams.length) {
      console.log('[AssignmentGenerator] No workstreams found, skipping assignments');
      return [];
    }
    
    const internalTeam = resourcePlan?.internalTeam || [];
    const externalResources = resourcePlan?.externalResources || [];
    const allResources = [...internalTeam, ...externalResources];
    
    if (!allResources.length) {
      console.log('[AssignmentGenerator] No resources found, skipping assignments');
      return [];
    }
    
    console.log(`[AssignmentGenerator] Found ${workstreams.length} workstreams and ${allResources.length} resources`);
    
    for (const workstream of workstreams) {
      const deliverables = workstream.deliverables || [];
      
      for (let i = 0; i < deliverables.length; i++) {
        const deliverable = deliverables[i] as any;
        const taskId = typeof deliverable === 'string' 
          ? `${workstream.id}-${String(deliverable).substring(0, 20).replace(/\s+/g, '-')}`
          : deliverable?.id || `${workstream.id}-D${i + 1}`;
        
        const matchingResource = this.findMatchingResource(workstream, deliverable, allResources);
        
        if (matchingResource) {
          const estimatedHours = this.estimateHours(deliverable);
          
          assignments.push({
            epmProgramId: programId,
            taskId,
            resourceId: matchingResource.id || matchingResource.role || 'unknown',
            resourceType: this.determineResourceType(matchingResource),
            estimatedHours,
            status: 'assigned',
            assignmentSource: 'ai_generated',
            notes: `Auto-assigned to ${matchingResource.role || 'team member'} based on workstream alignment`,
          });
        }
      }
    }
    
    console.log(`[AssignmentGenerator] Generated ${assignments.length} task assignments`);
    return assignments;
  }
  
  private findMatchingResource(workstream: any, deliverable: any, resources: any[]): any {
    if (!resources.length) return null;
    
    const workstreamName = workstream.name?.toLowerCase() || '';
    const deliverableName = typeof deliverable === 'string' 
      ? deliverable.toLowerCase() 
      : (deliverable.name || '').toLowerCase();
    
    const roleMatches: Record<string, string[]> = {
      'project manager': ['management', 'coordination', 'governance', 'planning'],
      'program manager': ['program', 'strategic', 'executive', 'stakeholder'],
      'business analyst': ['analysis', 'requirements', 'documentation', 'process'],
      'developer': ['development', 'implementation', 'technical', 'software', 'system'],
      'architect': ['architecture', 'design', 'integration', 'infrastructure'],
      'qa': ['testing', 'quality', 'validation', 'verification'],
      'change manager': ['change', 'training', 'adoption', 'communication'],
      'operations': ['operations', 'maintenance', 'support', 'monitoring'],
      'marketing': ['marketing', 'launch', 'acquisition', 'branding', 'customer'],
      'finance': ['financial', 'budget', 'cost', 'investment'],
    };
    
    for (const resource of resources) {
      const role = (resource.role || '').toLowerCase();
      
      for (const [roleKey, keywords] of Object.entries(roleMatches)) {
        if (role.includes(roleKey) || roleKey.includes(role.split(' ')[0])) {
          for (const keyword of keywords) {
            if (workstreamName.includes(keyword) || deliverableName.includes(keyword)) {
              return resource;
            }
          }
        }
      }
    }
    
    return resources[0];
  }
  
  private determineResourceType(resource: any): 'internal' | 'external' | 'team' {
    if (!resource) return 'team';
    
    const role = (resource.role || '').toLowerCase();
    const resourceType = (resource.type || '').toLowerCase();
    
    if (resourceType === 'external' || role.includes('consultant') || role.includes('contractor')) {
      return 'external';
    }
    
    if (role.includes('team') || resourceType === 'team') {
      return 'team';
    }
    
    return 'internal';
  }
  
  private estimateHours(deliverable: any): number {
    if (typeof deliverable === 'object' && deliverable.effort) {
      const effort = deliverable.effort;
      if (typeof effort === 'number') return effort * 8;
      
      const effortStr = String(effort).toLowerCase();
      const match = effortStr.match(/(\d+)/);
      if (match) {
        const value = parseInt(match[1], 10);
        if (effortStr.includes('day')) return value * 8;
        if (effortStr.includes('week')) return value * 40;
        if (effortStr.includes('month')) return value * 160;
        if (effortStr.includes('hour')) return value;
        return value * 8;
      }
    }
    
    return 40;
  }
}

export default AssignmentGenerator;
