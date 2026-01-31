/**
 * AssignmentGenerator - Generates task assignments from EPM program data
 *
 * ARCHITECTURE SPEC: Section 20 - Assignment Persistence Contract
 * - Creates task assignments by matching resources to deliverables
 * - Populates ALL required fields: taskName, resourceName, allocation, dates
 * - Uses valid status enum values
 */

import type { EPMProgram } from '../types';

export interface TaskAssignment {
  epmProgramId: string;
  taskId: string;
  taskName: string;           // REQUIRED: Actual deliverable name
  resourceId: string;
  resourceName: string;       // REQUIRED: Resource display name
  resourceRole: string;       // REQUIRED: Role title
  resourceType: 'internal_team' | 'external_resource';
  estimatedHours: number;
  status: 'pending' | 'assigned' | 'active' | 'completed';  // Valid DB enum values
  allocationPercent: number;  // REQUIRED: 0-100, varies by workload
  assignedFrom: string;       // REQUIRED: Start date (Month X or ISO date)
  assignedTo: string;         // REQUIRED: End date (Month X or ISO date)
  assignmentSource: 'ai_generated' | 'user_assigned' | 'auto_suggested';
  notes?: string;
}

interface Workstream {
  id: string;
  name: string;
  owner?: string;
  startMonth?: number;
  endMonth?: number;
  deliverables?: any[];
}

interface Resource {
  id?: string;
  role: string;
  allocation?: number;
  fte?: number;
  skills?: string[];
  type?: string;
}

export class AssignmentGenerator {
  async generate(epmProgram: EPMProgram, programId: string): Promise<TaskAssignment[]> {
    const assignments: TaskAssignment[] = [];

    console.log('[AssignmentGenerator] Starting assignment generation...');
    console.log(`[AssignmentGenerator] Program ID: ${programId}`);

    const workstreams: Workstream[] = epmProgram.workstreams || [];
    const resourcePlan = epmProgram.resourcePlan;

    if (!workstreams.length) {
      console.log('[AssignmentGenerator] No workstreams found, skipping assignments');
      return [];
    }

    const internalTeam: Resource[] = resourcePlan?.internalTeam || [];
    const externalResources: Resource[] = resourcePlan?.externalResources || [];

    // Assign IDs to resources if missing
    const allResources = [
      ...internalTeam.map((r, i) => ({
        ...r,
        id: r.id || `INT-${String(i + 1).padStart(3, '0')}`,
        type: 'internal',
      })),
      ...externalResources.map((r, i) => ({
        ...r,
        id: r.id || `EXT-${String(i + 1).padStart(3, '0')}`,
        type: 'external',
      })),
    ];

    if (!allResources.length) {
      console.log('[AssignmentGenerator] No resources found, skipping assignments');
      return [];
    }

    console.log(`[AssignmentGenerator] Found ${workstreams.length} workstreams and ${allResources.length} resources`);

    // Track resource workload for allocation calculation
    const resourceWorkload: Record<string, number> = {};
    allResources.forEach(r => resourceWorkload[r.id!] = 0);

    for (const workstream of workstreams) {
      const deliverables = workstream.deliverables || [];
      const wsStartMonth = workstream.startMonth ?? 0;
      const wsEndMonth = workstream.endMonth ?? 3;
      const wsDuration = Math.max(1, wsEndMonth - wsStartMonth);

      for (let i = 0; i < deliverables.length; i++) {
        const deliverable = deliverables[i];
        const deliverableName = this.extractDeliverableName(deliverable, i);
        const taskId = `${workstream.id}-D${i + 1}`;

        const matchingResource = this.findMatchingResource(workstream, deliverable, allResources);

        if (matchingResource) {
          const estimatedHours = this.estimateHours(deliverable, wsDuration);
          const allocationPercent = this.calculateAllocation(
            matchingResource,
            estimatedHours,
            wsDuration,
            resourceWorkload
          );

          // Track workload
          resourceWorkload[matchingResource.id!] = (resourceWorkload[matchingResource.id!] || 0) + allocationPercent;

          // Calculate dates based on deliverable position within workstream
          const deliverableStartMonth = wsStartMonth + Math.floor(i * wsDuration / Math.max(deliverables.length, 1));
          const deliverableEndMonth = Math.min(wsStartMonth + Math.ceil((i + 1) * wsDuration / Math.max(deliverables.length, 1)), wsEndMonth);

          assignments.push({
            epmProgramId: programId,
            taskId,
            taskName: deliverableName,
            resourceId: matchingResource.id!,
            resourceName: this.formatResourceName(matchingResource),
            resourceRole: matchingResource.role,
            resourceType: matchingResource.type === 'external' ? 'external_resource' : 'internal_team',
            estimatedHours,
            status: 'assigned',
            allocationPercent,
            assignedFrom: this.formatDate(deliverableStartMonth),
            assignedTo: this.formatDate(deliverableEndMonth),
            assignmentSource: 'ai_generated',
            notes: `Auto-assigned based on ${workstream.name} workstream alignment`,
          });
        }
      }
    }

    console.log(`[AssignmentGenerator] Generated ${assignments.length} task assignments`);
    this.logAllocationSummary(assignments, allResources);

    return assignments;
  }

  /**
   * Extract a meaningful name from deliverable data
   */
  private extractDeliverableName(deliverable: any, index: number): string {
    if (typeof deliverable === 'string') {
      // Deliverable is a string description - extract first sentence or truncate
      const cleaned = deliverable.trim();
      const firstSentence = cleaned.split(/[.;:]/)[0].trim();
      if (firstSentence.length <= 80) return firstSentence;
      // Truncate at word boundary
      const truncated = firstSentence.substring(0, 80);
      const lastSpace = truncated.lastIndexOf(' ');
      return lastSpace > 40 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
    }

    if (typeof deliverable === 'object') {
      return deliverable.name || deliverable.title || deliverable.description?.substring(0, 80) || `Deliverable ${index + 1}`;
    }

    return `Deliverable ${index + 1}`;
  }

  /**
   * Format resource name for display
   */
  private formatResourceName(resource: Resource): string {
    // Use role as the display name, cleaned up
    const role = resource.role || 'Team Member';
    return role.replace(/\s+/g, ' ').trim();
  }

  /**
   * Convert month number to date string
   */
  private formatDate(monthNumber: number): string {
    // Calculate approximate date from project start
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() + monthNumber);
    return startDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  /**
   * Find the best matching resource for a deliverable
   */
  private findMatchingResource(workstream: Workstream, deliverable: any, resources: Resource[]): Resource | null {
    if (!resources.length) return null;

    const workstreamName = (workstream.name || '').toLowerCase();
    const workstreamOwner = (workstream.owner || '').toLowerCase();
    const deliverableName = this.extractDeliverableName(deliverable, 0).toLowerCase();

    // Role keyword matching - extended for retail context
    const roleKeywordMap: Record<string, string[]> = {
      'marketing': ['marketing', 'brand', 'campaign', 'acquisition', 'awareness', 'launch', 'social'],
      'operations': ['operations', 'operational', 'process', 'store', 'retail', 'framework', 'daily'],
      'technology': ['technology', 'tech', 'digital', 'system', 'software', 'infrastructure', 'pos', 'crm'],
      'design': ['design', 'storefront', 'construction', 'layout', 'visual', 'merchandis'],
      'merchandis': ['product', 'inventory', 'merchandise', 'stock', 'catalog', 'supplier', 'vendor'],
      'talent': ['talent', 'hr', 'hiring', 'training', 'onboarding', 'staff', 'recruitment', 'team'],
      'partnership': ['partnership', 'compliance', 'regulatory', 'legal', 'license', 'sponsor', 'corporate'],
      'customer': ['customer', 'experience', 'service', 'satisfaction', 'loyalty'],
      'financial': ['financial', 'budget', 'cost', 'investment', 'revenue', 'pricing'],
    };

    // First priority: Match by workstream owner if specified
    if (workstreamOwner) {
      const ownerMatch = resources.find(r =>
        r.role.toLowerCase() === workstreamOwner ||
        r.role.toLowerCase().includes(workstreamOwner.split(' ')[0])
      );
      if (ownerMatch) return ownerMatch;
    }

    // Second priority: Match by keyword analysis
    const searchText = `${workstreamName} ${deliverableName}`;

    for (const resource of resources) {
      const roleLower = resource.role.toLowerCase();

      for (const [roleKey, keywords] of Object.entries(roleKeywordMap)) {
        if (roleLower.includes(roleKey)) {
          for (const keyword of keywords) {
            if (searchText.includes(keyword)) {
              return resource;
            }
          }
        }
      }
    }

    // Third priority: Match by skills if available
    for (const resource of resources) {
      if (resource.skills?.length) {
        for (const skill of resource.skills) {
          if (searchText.includes(skill.toLowerCase())) {
            return resource;
          }
        }
      }
    }

    // Fallback: Return first available resource (round-robin would be better)
    return resources[0];
  }

  /**
   * Calculate allocation percentage based on workload and FTE
   */
  private calculateAllocation(
    resource: Resource,
    estimatedHours: number,
    durationMonths: number,
    currentWorkload: Record<string, number>
  ): number {
    // Base calculation: hours / (months * 160 hours/month) * 100
    const totalAvailableHours = durationMonths * 160 * (resource.fte || resource.allocation || 1);
    const baseAllocation = Math.round((estimatedHours / totalAvailableHours) * 100);

    // Adjust for existing workload - don't exceed 100%
    const existingWorkload = currentWorkload[resource.id!] || 0;
    const remainingCapacity = 100 - existingWorkload;

    // Clamp to reasonable range (10-80% per deliverable)
    const adjustedAllocation = Math.min(Math.max(baseAllocation, 10), Math.min(80, remainingCapacity));

    return adjustedAllocation;
  }

  /**
   * Estimate hours based on deliverable complexity
   */
  private estimateHours(deliverable: any, durationMonths: number): number {
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

    // Default: Estimate based on duration (20-60 hours per deliverable)
    const baseHours = 30 + (durationMonths * 10);
    return Math.min(baseHours, 80);
  }

  /**
   * Log allocation summary for debugging
   */
  private logAllocationSummary(assignments: TaskAssignment[], resources: Resource[]): void {
    const summary: Record<string, { count: number; totalAllocation: number }> = {};

    for (const assignment of assignments) {
      if (!summary[assignment.resourceRole]) {
        summary[assignment.resourceRole] = { count: 0, totalAllocation: 0 };
      }
      summary[assignment.resourceRole].count++;
      summary[assignment.resourceRole].totalAllocation += assignment.allocationPercent;
    }

    console.log('[AssignmentGenerator] Allocation Summary:');
    for (const [role, data] of Object.entries(summary)) {
      console.log(`  - ${role}: ${data.count} tasks, avg ${Math.round(data.totalAllocation / data.count)}% allocation`);
    }
  }
}

export default AssignmentGenerator;
