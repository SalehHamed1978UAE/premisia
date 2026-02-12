/**
 * AssignmentGenerator - Generates task assignments from EPM program data
 *
 * ARCHITECTURE SPEC: Section 20 - Assignment Persistence Contract
 * - Creates task assignments by matching resources to deliverables
 * - Uses AI-based semantic matching (no hardcoded keywords)
 * - Populates ALL required fields: taskName, resourceName, allocation, dates
 * - Uses valid status enum values
 */

import type { EPMProgram } from '../types';
import { getLLMProvider } from '../../lib/llm-provider';

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

interface TaskInfo {
  taskId: string;
  taskName: string;
  workstreamName: string;
  workstreamId: string;
  startMonth: number;
  endMonth: number;
}

interface ResourceMatchResult {
  taskId: string;
  resourceId: string;
  confidence: number;
  reasoning: string;
}

export class AssignmentGenerator {
  private llm = getLLMProvider();

  async generate(epmProgram: EPMProgram, programId: string): Promise<TaskAssignment[]> {
    const assignments: TaskAssignment[] = [];

    console.log('[AssignmentGenerator] Starting AI-based assignment generation...');
    console.log(`[AssignmentGenerator] Program ID: ${programId}`);

    const workstreams: Workstream[] = epmProgram.workstreams || [];
    const resourcePlan = epmProgram.resourcePlan;
    const programContext = {
      name: epmProgram.name || 'Strategic Program',
      description: epmProgram.description || '',
    };

    if (!workstreams.length) {
      console.log('[AssignmentGenerator] No workstreams found, skipping assignments');
      return [];
    }

    const internalTeam: Resource[] = resourcePlan?.internalTeam || [];
    const externalResources: Resource[] = resourcePlan?.externalResources || [];

    // Assign IDs to resources if missing
    // Note: External resources have 'type' (Consultant, Software) not 'role'
    // We map 'type' to 'role' for consistency in assignment matching
    const allResources = [
      ...internalTeam.map((r, i) => ({
        ...r,
        id: r.id || `INT-${String(i + 1).padStart(3, '0')}`,
        type: 'internal',
      })),
      ...externalResources.map((r: any, i) => ({
        ...r,
        id: r.id || `EXT-${String(i + 1).padStart(3, '0')}`,
        role: r.role || r.type || 'External Consultant',  // Map type to role for external resources
        type: 'external',
      })),
    ];

    if (!allResources.length) {
      console.log('[AssignmentGenerator] No resources found, skipping assignments');
      return [];
    }

    console.log(`[AssignmentGenerator] Found ${workstreams.length} workstreams and ${allResources.length} resources`);

    // Extract all tasks from workstreams
    const allTasks: TaskInfo[] = [];
    for (const workstream of workstreams) {
      const deliverables = workstream.deliverables || [];
      const wsStartMonth = workstream.startMonth ?? 0;
      const wsEndMonth = workstream.endMonth ?? 3;
      const wsDuration = Math.max(1, wsEndMonth - wsStartMonth);

      for (let i = 0; i < deliverables.length; i++) {
        const deliverable = deliverables[i];
        const deliverableName = this.extractDeliverableName(deliverable, i);
        const taskId = `${workstream.id}-D${i + 1}`;

        const deliverableStartMonth = wsStartMonth + Math.floor(i * wsDuration / Math.max(deliverables.length, 1));
        const deliverableEndMonth = Math.min(wsStartMonth + Math.ceil((i + 1) * wsDuration / Math.max(deliverables.length, 1)), wsEndMonth);

        allTasks.push({
          taskId,
          taskName: deliverableName,
          workstreamName: workstream.name,
          workstreamId: workstream.id,
          startMonth: deliverableStartMonth,
          endMonth: deliverableEndMonth,
        });
      }
    }

    if (!allTasks.length) {
      console.log('[AssignmentGenerator] No tasks/deliverables found in workstreams');
      return [];
    }

    // Use AI to match resources to tasks
    console.log(`[AssignmentGenerator] Using AI to match ${allTasks.length} tasks to ${allResources.length} resources...`);
    const matches = await this.getAIResourceMatches(allTasks, allResources, programContext);

    // Track resource workload for allocation calculation
    const resourceWorkload: Record<string, number> = {};
    allResources.forEach(r => resourceWorkload[r.id!] = 0);

    // Create assignments from matches
    for (const task of allTasks) {
      const match = matches.find(m => m.taskId === task.taskId);
      const resource = match
        ? allResources.find(r => r.id === match.resourceId)
        : this.getFallbackResource(allResources, resourceWorkload);

      if (resource) {
        const durationMonths = Math.max(1, task.endMonth - task.startMonth);
        const estimatedHours = this.estimateHours(null, durationMonths);
        const allocationPercent = this.calculateAllocation(
          resource,
          estimatedHours,
          durationMonths,
          resourceWorkload
        );

        // Track workload
        resourceWorkload[resource.id!] = (resourceWorkload[resource.id!] || 0) + allocationPercent;

        assignments.push({
          epmProgramId: programId,
          taskId: task.taskId,
          taskName: task.taskName,
          resourceId: resource.id!,
          resourceName: this.formatResourceName(resource),
          resourceRole: resource.role || 'Team Member',  // Ensure never undefined
          resourceType: resource.type === 'external' ? 'external_resource' : 'internal_team',
          estimatedHours,
          status: 'assigned',
          allocationPercent,
          assignedFrom: this.formatDate(task.startMonth),
          assignedTo: this.formatDate(task.endMonth),
          assignmentSource: 'ai_generated',
          notes: match?.reasoning || `Auto-assigned to ${task.workstreamName}`,
        });
      }
    }

    console.log(`[AssignmentGenerator] Generated ${assignments.length} task assignments`);
    this.logAllocationSummary(assignments, allResources);

    // VALIDATE: Cap resource allocation at <=100%
    const validatedAssignments = this.validateAndCapAllocations(assignments, allResources);

    return validatedAssignments;
  }

  /**
   * Use AI to semantically match resources to tasks
   * Makes ONE batch call for efficiency
   */
  private async getAIResourceMatches(
    tasks: TaskInfo[],
    resources: Resource[],
    programContext: { name: string; description: string }
  ): Promise<ResourceMatchResult[]> {
    try {
      // Calculate target assignments per resource for balanced distribution
      const targetPerResource = Math.ceil(tasks.length / resources.length);

      const prompt = `You are a project staffing expert assigning team members to tasks.

PROJECT: "${programContext.name}"
${programContext.description ? `CONTEXT: ${programContext.description}` : ''}

AVAILABLE TEAM (${resources.length} people):
${resources.map(r => `• ${r.id}: ${r.role}${r.skills?.length ? ` — Skills: ${r.skills.join(', ')}` : ''}`).join('\n')}

TASKS TO ASSIGN (${tasks.length} total):
${tasks.map(t => `• ${t.taskId}: "${t.taskName}" [${t.workstreamName}]`).join('\n')}

ASSIGNMENT RULES:
1. Match by EXPERTISE: Assign tasks to the person whose role/skills best fit the work
   - "Menu Development" → Chef/Culinary role
   - "Marketing Campaign" → Marketing role
   - "POS System Setup" → IT/Technology role
   - "Staff Training" → HR/Operations role
   - "Compliance/Licensing" → Compliance/Legal role
   - "Financial Planning" → Finance role

2. DISTRIBUTE EVENLY: Each person should get ~${targetPerResource} tasks. Don't overload one person.

3. When in doubt, consider:
   - Who would naturally own this work based on their job title?
   - What department would handle this in a real organization?

Return ONLY valid JSON (no markdown, no explanation):
{
  "matches": [
    {"taskId": "WS001-D1", "resourceId": "INT-001", "confidence": 0.9, "reasoning": "Brief reason"}
  ]
}

IMPORTANT: Return a match for EVERY task. Use exact taskId and resourceId values from above.`;

      const response = await this.llm.generateStructuredResponse(prompt, { matches: [] });

      if (response?.matches && Array.isArray(response.matches)) {
        console.log(`[AssignmentGenerator] AI matched ${response.matches.length} tasks`);
        return response.matches;
      }

      console.log('[AssignmentGenerator] AI returned no matches, using fallback');
      return [];
    } catch (error) {
      console.error('[AssignmentGenerator] AI matching failed, using fallback:', error);
      return [];
    }
  }

  /**
   * Fallback: Get resource with lowest workload (round-robin effect)
   */
  private getFallbackResource(resources: Resource[], workload: Record<string, number>): Resource {
    const sorted = [...resources].sort((a, b) => {
      const workloadA = workload[a.id!] || 0;
      const workloadB = workload[b.id!] || 0;
      return workloadA - workloadB;
    });
    return sorted[0];
  }

  /**
   * Extract a meaningful name from deliverable data
   */
  private extractDeliverableName(deliverable: any, index: number): string {
    if (typeof deliverable === 'string') {
      const cleaned = deliverable.trim();
      const firstSentence = cleaned.split(/[.;:]/)[0].trim();
      if (firstSentence.length <= 80) return firstSentence;
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
    const role = resource.role || 'Team Member';
    return role.replace(/\s+/g, ' ').trim();
  }

  /**
   * Convert month number to date string
   */
  private formatDate(monthNumber: number): string {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() + monthNumber);
    return startDate.toISOString().split('T')[0];
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
    const totalAvailableHours = durationMonths * 160 * (resource.fte || resource.allocation || 1);
    const baseAllocation = Math.round((estimatedHours / totalAvailableHours) * 100);

    // Clamp to reasonable range (10-80% per deliverable)
    const adjustedAllocation = Math.min(Math.max(baseAllocation, 10), 80);

    return adjustedAllocation;
  }

  /**
   * Estimate hours based on deliverable complexity
   */
  private estimateHours(deliverable: any, durationMonths: number): number {
    if (deliverable && typeof deliverable === 'object' && deliverable.effort) {
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

  /**
   * Validate and cap resource allocations to prevent overallocation (>100%)
   *
   * VALIDATION RULES:
   * 1. Calculate total allocation % per resource across all assignments
   * 2. If any resource exceeds 100%, scale down ALL their assignments proportionally
   * 3. Log warnings for overallocated resources
   *
   * FIXES: Issue #1 from ZIP analysis - Resource overallocation (141%, 125%, 116%)
   */
  private validateAndCapAllocations(
    assignments: TaskAssignment[],
    resources: Resource[]
  ): TaskAssignment[] {
    // Calculate total allocation per resource
    const resourceTotals: Record<string, { total: number; count: number; name: string }> = {};

    for (const assignment of assignments) {
      if (!resourceTotals[assignment.resourceId]) {
        resourceTotals[assignment.resourceId] = {
          total: 0,
          count: 0,
          name: assignment.resourceName
        };
      }
      resourceTotals[assignment.resourceId].total += assignment.allocationPercent;
      resourceTotals[assignment.resourceId].count++;
    }

    // Check for overallocations and scale down if needed
    const adjustedAssignments = [...assignments];
    const overallocatedResources: string[] = [];

    for (const [resourceId, data] of Object.entries(resourceTotals)) {
      if (data.total > 100) {
        overallocatedResources.push(`${data.name} (${data.total}% → capped at 100%)`);

        // Scale down all assignments for this resource proportionally
        const scaleFactor = 100 / data.total;

        for (let i = 0; i < adjustedAssignments.length; i++) {
          if (adjustedAssignments[i].resourceId === resourceId) {
            const originalAllocation = adjustedAssignments[i].allocationPercent;
            adjustedAssignments[i].allocationPercent = Math.round(originalAllocation * scaleFactor);

            // Add note about adjustment
            const note = adjustedAssignments[i].notes || '';
            adjustedAssignments[i].notes = note
              ? `${note} [Allocation adjusted from ${originalAllocation}% to prevent overallocation]`
              : `Allocation adjusted from ${originalAllocation}% to prevent overallocation`;
          }
        }
      }
    }

    // Log results
    if (overallocatedResources.length > 0) {
      console.warn('[AssignmentGenerator] ⚠️  RESOURCE OVERALLOCATION DETECTED AND FIXED:');
      overallocatedResources.forEach(msg => console.warn(`  - ${msg}`));
      console.warn('[AssignmentGenerator] All allocations have been scaled proportionally to cap at 100%');
    } else {
      console.log('[AssignmentGenerator] ✅ All resource allocations within 100% limit');
    }

    // Verify totals after adjustment
    const finalTotals: Record<string, number> = {};
    for (const assignment of adjustedAssignments) {
      finalTotals[assignment.resourceId] = (finalTotals[assignment.resourceId] || 0) + assignment.allocationPercent;
    }

    for (const [resourceId, total] of Object.entries(finalTotals)) {
      const data = resourceTotals[resourceId];
      console.log(`[AssignmentGenerator] ${data.name}: ${data.count} tasks, ${total}% total allocation`);
    }

    return adjustedAssignments;
  }
}

export default AssignmentGenerator;
