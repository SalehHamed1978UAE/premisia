/**
 * Task Assignments API Routes
 *
 * Manages the assignment of resources to tasks within EPM programs
 */
import { Router } from 'express';
import { db } from '../db';
import { taskAssignments, epmPrograms, insertTaskAssignmentSchema } from '@shared/schema';
import { eq, and, inArray, ne } from 'drizzle-orm';
import { validateAssignment, validateAllAssignments, calculateResourceWorkload, calculateProgramWorkload, getAssignmentSummary, } from '../services/assignment-engine';
const router = Router();
// ============================================================================
// GET /api/task-assignments/program/:programId
// Get all assignments for an EPM program
// ============================================================================
router.get('/program/:programId', async (req, res) => {
    try {
        const { programId } = req.params;
        // Verify program exists
        const [program] = await db
            .select()
            .from(epmPrograms)
            .where(eq(epmPrograms.id, programId))
            .limit(1);
        if (!program) {
            return res.status(404).json({ error: 'EPM program not found' });
        }
        // Get all assignments
        const assignments = await db
            .select()
            .from(taskAssignments)
            .where(eq(taskAssignments.epmProgramId, programId));
        // Calculate workload metrics
        const workloadMap = calculateProgramWorkload(assignments);
        const summary = getAssignmentSummary(assignments);
        res.json({
            assignments,
            workload: Object.fromEntries(workloadMap),
            summary,
        });
    }
    catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ error: 'Failed to fetch assignments' });
    }
});
// ============================================================================
// GET /api/task-assignments/resource/:resourceId/workload
// Get workload metrics for a specific resource
// ============================================================================
router.get('/resource/:resourceId/workload', async (req, res) => {
    try {
        const { resourceId } = req.params;
        const { programId } = req.query;
        let assignments;
        if (programId) {
            // Get assignments for specific program
            assignments = await db
                .select()
                .from(taskAssignments)
                .where(and(eq(taskAssignments.resourceId, resourceId), eq(taskAssignments.epmProgramId, programId)));
        }
        else {
            // Get all assignments for this resource
            assignments = await db
                .select()
                .from(taskAssignments)
                .where(eq(taskAssignments.resourceId, resourceId));
        }
        const workload = calculateResourceWorkload(resourceId, assignments);
        if (!workload) {
            return res.json({
                message: 'No assignments found for this resource',
                workload: null,
            });
        }
        res.json({ workload });
    }
    catch (error) {
        console.error('Error calculating workload:', error);
        res.status(500).json({ error: 'Failed to calculate workload' });
    }
});
// ============================================================================
// POST /api/task-assignments
// Create a new assignment
// ============================================================================
router.post('/', async (req, res) => {
    try {
        // Validate request body with Zod schema
        const parseResult = insertTaskAssignmentSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'Invalid assignment data',
                errors: parseResult.error.errors.map(e => ({
                    path: e.path.join('.'),
                    message: e.message,
                })),
            });
        }
        const assignmentData = parseResult.data;
        // Validate required fields (redundant but explicit)
        if (!assignmentData.epmProgramId || !assignmentData.taskId || !assignmentData.resourceId) {
            return res.status(400).json({
                error: 'Missing required fields: epmProgramId, taskId, resourceId',
            });
        }
        // Get existing assignments for validation
        const existingAssignments = await db
            .select()
            .from(taskAssignments)
            .where(eq(taskAssignments.epmProgramId, assignmentData.epmProgramId));
        // Validate the assignment logic
        const validation = validateAssignment(assignmentData, existingAssignments);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Invalid assignment',
                errors: validation.errors,
                warnings: validation.warnings,
            });
        }
        // Create assignment
        const [newAssignment] = await db
            .insert(taskAssignments)
            .values(assignmentData)
            .returning();
        res.status(201).json({
            assignment: newAssignment,
            warnings: validation.warnings,
        });
    }
    catch (error) {
        console.error('Error creating assignment:', error);
        res.status(500).json({ error: 'Failed to create assignment' });
    }
});
// ============================================================================
// PATCH /api/task-assignments/:id
// Update an existing assignment
// ============================================================================
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Get existing assignment
        const [existing] = await db
            .select()
            .from(taskAssignments)
            .where(eq(taskAssignments.id, id))
            .limit(1);
        if (!existing) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        // Validate partial update with Zod
        // Create a merged object for validation
        const mergedData = { ...existing, ...req.body };
        const parseResult = insertTaskAssignmentSchema.safeParse(mergedData);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'Invalid assignment update data',
                errors: parseResult.error.errors.map(e => ({
                    path: e.path.join('.'),
                    message: e.message,
                })),
            });
        }
        const updates = req.body;
        // Get other assignments for validation (exclude current assignment)
        const otherAssignments = await db
            .select()
            .from(taskAssignments)
            .where(and(eq(taskAssignments.epmProgramId, existing.epmProgramId), ne(taskAssignments.id, id) // Exclude self
        ));
        // Validate updated assignment logic
        const updatedAssignment = { ...existing, ...updates };
        const validation = validateAssignment(updatedAssignment, otherAssignments);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Invalid assignment update',
                errors: validation.errors,
                warnings: validation.warnings,
            });
        }
        // Update assignment
        const [updated] = await db
            .update(taskAssignments)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(taskAssignments.id, id))
            .returning();
        res.json({
            assignment: updated,
            warnings: validation.warnings,
        });
    }
    catch (error) {
        console.error('Error updating assignment:', error);
        res.status(500).json({ error: 'Failed to update assignment' });
    }
});
// ============================================================================
// DELETE /api/task-assignments/:id
// Delete an assignment
// ============================================================================
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [deleted] = await db
            .delete(taskAssignments)
            .where(eq(taskAssignments.id, id))
            .returning();
        if (!deleted) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        res.json({ success: true, assignment: deleted });
    }
    catch (error) {
        console.error('Error deleting assignment:', error);
        res.status(500).json({ error: 'Failed to delete assignment' });
    }
});
// ============================================================================
// POST /api/task-assignments/bulk
// Bulk create assignments
// ============================================================================
router.post('/bulk', async (req, res) => {
    try {
        const { assignments: assignmentsData } = req.body;
        if (!Array.isArray(assignmentsData) || assignmentsData.length === 0) {
            return res.status(400).json({ error: 'assignments array is required' });
        }
        // Validate all assignments
        const validationResult = validateAllAssignments(assignmentsData);
        if (!validationResult.valid) {
            const errors = Array.from(validationResult.results.entries())
                .filter(([_, result]) => !result.valid)
                .map(([key, result]) => ({
                assignment: key,
                errors: result.errors,
            }));
            return res.status(400).json({
                error: 'Some assignments are invalid',
                invalidAssignments: errors,
            });
        }
        // Insert all assignments
        const created = await db
            .insert(taskAssignments)
            .values(assignmentsData)
            .returning();
        // Collect all warnings
        const warnings = Array.from(validationResult.results.values())
            .flatMap(result => result.warnings);
        res.status(201).json({
            assignments: created,
            count: created.length,
            warnings: warnings.length > 0 ? warnings : undefined,
        });
    }
    catch (error) {
        console.error('Error bulk creating assignments:', error);
        res.status(500).json({ error: 'Failed to create assignments' });
    }
});
// ============================================================================
// DELETE /api/task-assignments/bulk
// Bulk delete assignments
// ============================================================================
router.delete('/bulk', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'ids array is required' });
        }
        const deleted = await db
            .delete(taskAssignments)
            .where(inArray(taskAssignments.id, ids))
            .returning();
        res.json({
            success: true,
            count: deleted.length,
            assignments: deleted,
        });
    }
    catch (error) {
        console.error('Error bulk deleting assignments:', error);
        res.status(500).json({ error: 'Failed to delete assignments' });
    }
});
// ============================================================================
// GET /api/task-assignments/validate/:programId
// Validate all assignments for a program
// ============================================================================
router.get('/validate/:programId', async (req, res) => {
    try {
        const { programId } = req.params;
        const assignments = await db
            .select()
            .from(taskAssignments)
            .where(eq(taskAssignments.epmProgramId, programId));
        const validationResult = validateAllAssignments(assignments);
        const issues = Array.from(validationResult.results.entries()).map(([id, result]) => ({
            assignmentId: id,
            valid: result.valid,
            errors: result.errors,
            warnings: result.warnings,
        }));
        res.json({
            valid: validationResult.valid,
            totalAssignments: assignments.length,
            issues: issues.filter(i => !i.valid || i.warnings.length > 0),
        });
    }
    catch (error) {
        console.error('Error validating assignments:', error);
        res.status(500).json({ error: 'Failed to validate assignments' });
    }
});
export default router;
//# sourceMappingURL=task-assignments.js.map