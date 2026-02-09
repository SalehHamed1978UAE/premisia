/**
 * Assignment Engine - Modular service for task-resource assignment management
 *
 * Features:
 * - Synthesize assignments from EPM workstreams and resources
 * - Validate assignments for conflicts and feasibility
 * - Calculate resource workload and utilization
 * - Optimize assignments (future IPS integration)
 */
import { addDays, differenceInDays, isWithinInterval } from 'date-fns';
// ============================================================================
// Assignment Synthesis
// ============================================================================
/**
 * Synthesize task assignments from workstreams and resources
 * Uses role/skill matching to assign the best-fit resource to each task
 */
export function synthesizeAssignments(epmProgramId, workstreams, resourcePlan, options = {}) {
    const { preferredAllocation = 100, skillMatchRequired = true, confidence = 'medium', } = options;
    const assignments = [];
    const resources = resourcePlan.resources;
    // Process each workstream
    for (const workstream of workstreams) {
        for (const task of workstream.tasks) {
            // Find best matching resource
            const matchedResource = findBestMatchingResource(task, resources, skillMatchRequired);
            if (matchedResource) {
                assignments.push({
                    epmProgramId,
                    workstreamId: workstream.id,
                    taskId: task.id,
                    taskName: task.name,
                    resourceId: matchedResource.id,
                    resourceName: matchedResource.name,
                    resourceRole: matchedResource.role,
                    resourceType: matchedResource.type || 'internal_team', // CRITICAL: Must match database enum values
                    allocationPercent: preferredAllocation,
                    status: 'active',
                    source: 'ai_generated',
                    confidence,
                    assignedFrom: new Date(task.startDate),
                    assignedTo: new Date(task.endDate),
                    notes: null,
                    metadata: {
                        matchScore: matchedResource.matchScore,
                        matchedSkills: matchedResource.matchedSkills,
                        synthesizedAt: new Date().toISOString(),
                    },
                });
            }
        }
    }
    return assignments;
}
/**
 * Find the best matching resource for a task based on role and skills
 */
function findBestMatchingResource(task, resources, skillMatchRequired) {
    let bestMatch = null;
    let bestScore = -1;
    for (const resource of resources) {
        let score = 0;
        const matchedSkills = [];
        // Skill matching
        if (task.requiredSkills && task.requiredSkills.length > 0) {
            const resourceSkills = resource.skills || [];
            const matchCount = task.requiredSkills.filter(skill => {
                const hasSkill = resourceSkills.some(rs => rs.toLowerCase().includes(skill.toLowerCase()) ||
                    skill.toLowerCase().includes(rs.toLowerCase()));
                if (hasSkill)
                    matchedSkills.push(skill);
                return hasSkill;
            }).length;
            if (matchCount === 0 && skillMatchRequired) {
                continue; // Skip if no skills match and matching is required
            }
            score += (matchCount / task.requiredSkills.length) * 100;
        }
        // Role matching (bonus points)
        if (task.name.toLowerCase().includes(resource.role.toLowerCase()) ||
            resource.role.toLowerCase().includes('engineer') ||
            resource.role.toLowerCase().includes('developer')) {
            score += 20;
        }
        // Availability bonus
        if (resource.availability && resource.availability > 50) {
            score += 10;
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = { ...resource, matchScore: score, matchedSkills };
        }
    }
    return bestMatch;
}
// ============================================================================
// Assignment Validation
// ============================================================================
/**
 * Validate a single assignment for conflicts and feasibility
 */
export function validateAssignment(assignment, existingAssignments = []) {
    const errors = [];
    const warnings = [];
    // Check date validity
    if (assignment.assignedFrom >= assignment.assignedTo) {
        errors.push('Assignment end date must be after start date');
    }
    // Check allocation percentage
    const allocationPercent = assignment.allocationPercent ?? 100;
    if (allocationPercent < 0 || allocationPercent > 100) {
        errors.push('Allocation percentage must be between 0 and 100');
    }
    // Check for resource overallocation
    const resourceAssignments = existingAssignments.filter(a => a.resourceId === assignment.resourceId &&
        a.status === 'active' &&
        a.id !== assignment.id // Exclude self if editing
    );
    const conflictingAssignments = resourceAssignments.filter(a => {
        const assignmentInterval = {
            start: assignment.assignedFrom,
            end: assignment.assignedTo,
        };
        const existingInterval = {
            start: new Date(a.assignedFrom),
            end: new Date(a.assignedTo),
        };
        return (isWithinInterval(existingInterval.start, assignmentInterval) ||
            isWithinInterval(existingInterval.end, assignmentInterval) ||
            isWithinInterval(assignmentInterval.start, existingInterval) ||
            isWithinInterval(assignmentInterval.end, existingInterval));
    });
    if (conflictingAssignments.length > 0) {
        const totalAllocation = conflictingAssignments.reduce((sum, a) => sum + (a.allocationPercent || 0), assignment.allocationPercent || 0);
        if (totalAllocation > 100) {
            warnings.push(`Resource ${assignment.resourceName} is overallocated (${totalAllocation}%) during this period. ` +
                `Conflicting tasks: ${conflictingAssignments.map(a => a.taskName).join(', ')}`);
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
/**
 * Validate all assignments for a program
 */
export function validateAllAssignments(assignments) {
    const results = new Map();
    let allValid = true;
    for (let i = 0; i < assignments.length; i++) {
        const assignment = assignments[i];
        const key = assignment.id || `temp-${i}`;
        const result = validateAssignment(assignment, assignments.filter(a => a !== assignment));
        results.set(key, result);
        if (!result.valid) {
            allValid = false;
        }
    }
    return { valid: allValid, results };
}
// ============================================================================
// Workload Calculation
// ============================================================================
/**
 * Calculate workload metrics for a specific resource
 */
export function calculateResourceWorkload(resourceId, assignments) {
    const resourceAssignments = assignments.filter(a => a.resourceId === resourceId && a.status === 'active');
    if (resourceAssignments.length === 0) {
        return null;
    }
    const resourceName = resourceAssignments[0].resourceName;
    // Build utilization timeline
    const allDates = [];
    resourceAssignments.forEach(a => {
        const start = new Date(a.assignedFrom);
        const end = new Date(a.assignedTo);
        const days = differenceInDays(end, start) + 1;
        for (let i = 0; i < days; i++) {
            allDates.push(addDays(start, i));
        }
    });
    // Get unique dates
    const uniqueDates = Array.from(new Set(allDates.map(d => d.toISOString().split('T')[0]))).sort();
    // Calculate allocation per day
    const timeline = uniqueDates.map(dateStr => {
        const date = new Date(dateStr);
        const activeAssignments = resourceAssignments.filter(a => {
            const start = new Date(a.assignedFrom);
            const end = new Date(a.assignedTo);
            return date >= start && date <= end;
        });
        const totalAllocation = activeAssignments.reduce((sum, a) => sum + (a.allocationPercent || 0), 0);
        return {
            date: dateStr,
            allocation: totalAllocation,
            assignments: activeAssignments.map(a => a.taskId),
        };
    });
    // Find conflicts (overallocation)
    const conflicts = timeline
        .filter(t => t.allocation > 100)
        .map(t => ({
        date: t.date,
        overallocation: t.allocation - 100,
        conflictingTasks: t.assignments,
    }));
    // Calculate metrics
    const totalDays = uniqueDates.length;
    const averageAllocation = timeline.reduce((sum, t) => sum + t.allocation, 0) / timeline.length;
    const peakAllocation = Math.max(...timeline.map(t => t.allocation));
    return {
        resourceId,
        resourceName,
        totalAssignments: resourceAssignments.length,
        totalDays,
        averageAllocation,
        peakAllocation,
        utilizationTimeline: timeline,
        conflicts,
    };
}
/**
 * Calculate workload metrics for all resources in a program
 */
export function calculateProgramWorkload(assignments) {
    const workloadMap = new Map();
    // Get unique resource IDs
    const resourceIds = Array.from(new Set(assignments.map(a => a.resourceId)));
    for (const resourceId of resourceIds) {
        const workload = calculateResourceWorkload(resourceId, assignments);
        if (workload) {
            workloadMap.set(resourceId, workload);
        }
    }
    return workloadMap;
}
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Get summary statistics for a program's assignments
 */
export function getAssignmentSummary(assignments) {
    const active = assignments.filter(a => a.status === 'active');
    const uniqueResources = Array.from(new Set(assignments.map(a => a.resourceId))).length;
    const uniqueTasks = Array.from(new Set(assignments.map(a => a.taskId))).length;
    // Calculate average confidence
    const confidenceValues = { high: 3, medium: 2, low: 1 };
    const totalConfidence = assignments.reduce((sum, a) => {
        return sum + (a.confidence ? confidenceValues[a.confidence] : 2);
    }, 0);
    const averageConfidence = assignments.length > 0 ? totalConfidence / assignments.length : 0;
    // Count by source
    const assignmentsBySource = {};
    assignments.forEach(a => {
        assignmentsBySource[a.source] = (assignmentsBySource[a.source] || 0) + 1;
    });
    return {
        totalAssignments: assignments.length,
        activeAssignments: active.length,
        uniqueResources,
        uniqueTasks,
        averageConfidence,
        assignmentsBySource,
    };
}
/**
 * Find unassigned tasks in a program
 */
export function findUnassignedTasks(workstreams, assignments) {
    const assignedTaskIds = new Set(assignments.map(a => a.taskId));
    const unassigned = [];
    for (const workstream of workstreams) {
        for (const task of workstream.tasks) {
            if (!assignedTaskIds.has(task.id)) {
                unassigned.push(task);
            }
        }
    }
    return unassigned;
}
//# sourceMappingURL=assignment-engine.js.map