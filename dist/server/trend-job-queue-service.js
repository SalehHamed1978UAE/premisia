import { db } from './db.js';
import { trendAnalysisJobs } from '@shared/schema.js';
import { eq, and } from 'drizzle-orm';
/**
 * Service for managing trend analysis jobs with idempotency
 * Ensures job queue integrity and prevents duplicate processing
 */
export class TrendJobQueueService {
    /**
     * Create or retrieve existing job (idempotent)
     * Returns existing job if idempotency key matches
     * Handles concurrent calls safely by catching unique violations
     */
    async createJob(understandingId, idempotencyKey, data) {
        try {
            // Try to create new job
            const [job] = await db
                .insert(trendAnalysisJobs)
                .values({
                idempotencyKey,
                understandingId,
                status: 'pending',
                data: data || null,
            })
                .returning();
            console.log('[TrendJobQueue] Created new job:', job.jobId);
            return job;
        }
        catch (error) {
            // If unique constraint violation, retrieve existing job
            if (error.code === '23505' || error.message?.includes('unique')) {
                console.log('[TrendJobQueue] Unique violation, fetching existing job');
                const existing = await db
                    .select()
                    .from(trendAnalysisJobs)
                    .where(eq(trendAnalysisJobs.idempotencyKey, idempotencyKey))
                    .limit(1);
                if (existing.length > 0) {
                    console.log('[TrendJobQueue] Found existing job:', existing[0].jobId);
                    return existing[0];
                }
            }
            // Re-throw if not a unique violation or job not found
            throw error;
        }
    }
    /**
     * Get job by ID
     */
    async getJob(jobId) {
        const [job] = await db
            .select()
            .from(trendAnalysisJobs)
            .where(eq(trendAnalysisJobs.jobId, jobId))
            .limit(1);
        return job ? job : null;
    }
    /**
     * Get job by idempotency key
     */
    async getJobByIdempotencyKey(idempotencyKey) {
        const [job] = await db
            .select()
            .from(trendAnalysisJobs)
            .where(eq(trendAnalysisJobs.idempotencyKey, idempotencyKey))
            .limit(1);
        return job ? job : null;
    }
    /**
     * Update job status to running
     */
    async markAsRunning(jobId) {
        await db
            .update(trendAnalysisJobs)
            .set({
            status: 'running',
            startedAt: new Date(),
        })
            .where(eq(trendAnalysisJobs.jobId, jobId));
        console.log('[TrendJobQueue] Marked job as running:', jobId);
    }
    /**
     * Update job status to completed with result
     */
    async markAsCompleted(jobId, result) {
        await db
            .update(trendAnalysisJobs)
            .set({
            status: 'completed',
            result,
            completedAt: new Date(),
        })
            .where(eq(trendAnalysisJobs.jobId, jobId));
        console.log('[TrendJobQueue] Marked job as completed:', jobId);
    }
    /**
     * Update job status to failed with error
     */
    async markAsFailed(jobId, error) {
        await db
            .update(trendAnalysisJobs)
            .set({
            status: 'failed',
            error,
            completedAt: new Date(),
        })
            .where(eq(trendAnalysisJobs.jobId, jobId));
        console.log('[TrendJobQueue] Marked job as failed:', jobId);
    }
    /**
     * Get all jobs for an understanding
     */
    async getJobsForUnderstanding(understandingId) {
        const jobs = await db
            .select()
            .from(trendAnalysisJobs)
            .where(eq(trendAnalysisJobs.understandingId, understandingId));
        return jobs;
    }
    /**
     * Check if there's already a completed job for an understanding
     */
    async hasCompletedJob(understandingId) {
        const [job] = await db
            .select()
            .from(trendAnalysisJobs)
            .where(and(eq(trendAnalysisJobs.understandingId, understandingId), eq(trendAnalysisJobs.status, 'completed')))
            .limit(1);
        return !!job;
    }
}
//# sourceMappingURL=trend-job-queue-service.js.map