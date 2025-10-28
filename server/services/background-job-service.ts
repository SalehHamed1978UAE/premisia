import { backgroundJobs } from "@shared/schema";
import type { InsertBackgroundJob, SelectBackgroundJob } from "@shared/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { dbConnectionManager } from "../db-connection-manager";

/**
 * Background Job Service
 * 
 * PURPOSE: Track long-running operations for recovery and audit
 * 
 * HYBRID APPROACH:
 * - Operations run immediately (not queued)
 * - Job records enable recovery if user navigates away
 * - Existing SSE/progress UI remains unchanged
 */
export class BackgroundJobService {
  /**
   * Create a new background job record
   * Called at the start of long-running operations
   */
  async createJob(params: {
    userId: string | null;
    jobType: 'epm_generation' | 'bmc_analysis' | 'five_whys_generation' | 'porters_analysis' | 'pestle_analysis' | 'web_research' | 'strategic_understanding' | 'document_enrichment';
    inputData?: Record<string, any>;
    sessionId?: string;
    relatedEntityId?: string;
    relatedEntityType?: string;
  }): Promise<string | null> {
    // Skip job creation if no user (graceful degradation)
    if (!params.userId) {
      console.log('[Background Job] Skipping job creation - no authenticated user');
      return null;
    }

    console.log('[Background Job] Creating job:', params.jobType, 'for user:', params.userId);

    const jobData: InsertBackgroundJob = {
      userId: params.userId,
      jobType: params.jobType,
      status: 'pending',
      progress: 0,
      inputData: params.inputData as any,
      sessionId: params.sessionId,
      relatedEntityId: params.relatedEntityId,
      relatedEntityType: params.relatedEntityType,
    };

    const result = await dbConnectionManager.withFreshConnection(async (db) => {
      const [job] = await db.insert(backgroundJobs).values(jobData).returning();
      return job;
    });

    console.log('[Background Job] ✓ Job created:', result.id);
    return result.id;
  }

  /**
   * Update job status and progress
   * Called during operation execution
   */
  async updateJob(
    jobId: string,
    updates: {
      status?: 'pending' | 'running' | 'completed' | 'failed';
      progress?: number;
      progressMessage?: string;
      resultData?: Record<string, any>;
    }
  ): Promise<void> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (updates.status !== undefined) {
      updateData.status = updates.status;
      
      // Set timestamps based on status transitions
      if (updates.status === 'running') {
        updateData.startedAt = new Date();
      } else if (updates.status === 'completed') {
        updateData.completedAt = new Date();
      } else if (updates.status === 'failed') {
        updateData.failedAt = new Date();
      }
    }

    if (updates.progress !== undefined) {
      updateData.progress = updates.progress;
    }

    if (updates.progressMessage !== undefined) {
      updateData.progressMessage = updates.progressMessage;
    }

    if (updates.resultData !== undefined) {
      updateData.resultData = updates.resultData;
    }

    await dbConnectionManager.retryWithBackoff(async (db) => {
      await db
        .update(backgroundJobs)
        .set(updateData)
        .where(eq(backgroundJobs.id, jobId));
    });
  }

  /**
   * Mark job as failed with error details
   * Called when operation throws an error
   */
  async failJob(jobId: string, error: Error): Promise<void> {
    console.error('[Background Job] Job failed:', jobId, error.message);

    await dbConnectionManager.retryWithBackoff(async (db) => {
      await db
        .update(backgroundJobs)
        .set({
          status: 'failed',
          errorMessage: error.message,
          errorStack: error.stack,
          failedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(backgroundJobs.id, jobId));
    });
  }

  /**
   * Get a specific job by ID
   */
  async getJobById(jobId: string): Promise<SelectBackgroundJob | null> {
    const result = await dbConnectionManager.withFreshConnection(async (db) => {
      const [job] = await db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.id, jobId));
      return job || null;
    });

    return result;
  }

  /**
   * Get all jobs for a specific user
   * Optionally filter by status
   */
  async getJobsByUser(
    userId: string,
    options?: {
      status?: 'pending' | 'running' | 'completed' | 'failed';
      limit?: number;
    }
  ): Promise<SelectBackgroundJob[]> {
    const result = await dbConnectionManager.withFreshConnection(async (db) => {
      let query = db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.userId, userId))
        .orderBy(desc(backgroundJobs.createdAt));

      if (options?.limit) {
        query = query.limit(options.limit) as any;
      }

      const jobs = await query;

      // Filter by status if specified
      if (options?.status) {
        return jobs.filter((job: SelectBackgroundJob) => job.status === options.status);
      }

      return jobs;
    });

    return result;
  }

  /**
   * Get all running jobs for a user
   * Used for reconnection logic
   */
  async getRunningJobs(userId: string): Promise<SelectBackgroundJob[]> {
    const result = await dbConnectionManager.withFreshConnection(async (db) => {
      return await db
        .select()
        .from(backgroundJobs)
        .where(
          and(
            eq(backgroundJobs.userId, userId),
            inArray(backgroundJobs.status, ['pending', 'running'])
          )
        )
        .orderBy(desc(backgroundJobs.createdAt));
    });

    return result;
  }

  /**
   * Get job by session ID
   * Used for reconnecting to jobs when user returns to a page
   */
  async getJobBySession(sessionId: string): Promise<SelectBackgroundJob | null> {
    const result = await dbConnectionManager.withFreshConnection(async (db) => {
      const [job] = await db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.sessionId, sessionId))
        .orderBy(desc(backgroundJobs.createdAt))
        .limit(1);
      return job || null;
    });

    return result;
  }

  /**
   * Get recent jobs (last 24 hours)
   * For showing in jobs dashboard
   */
  async getRecentJobs(userId: string, limit: number = 50): Promise<SelectBackgroundJob[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await dbConnectionManager.withFreshConnection(async (db) => {
      return await db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.userId, userId))
        .orderBy(desc(backgroundJobs.createdAt))
        .limit(limit);
    });

    // Filter to last 24 hours in memory (simple approach)
    return result.filter((job: SelectBackgroundJob) => new Date(job.createdAt) >= oneDayAgo);
  }

  /**
   * Get jobs by related entity
   * Useful for finding all jobs related to a specific program, analysis, etc.
   */
  async getJobsByRelatedEntity(
    relatedEntityId: string,
    relatedEntityType: string
  ): Promise<SelectBackgroundJob[]> {
    const result = await dbConnectionManager.withFreshConnection(async (db) => {
      return await db
        .select()
        .from(backgroundJobs)
        .where(
          and(
            eq(backgroundJobs.relatedEntityId, relatedEntityId),
            eq(backgroundJobs.relatedEntityType, relatedEntityType)
          )
        )
        .orderBy(desc(backgroundJobs.createdAt));
    });

    return result;
  }

  /**
   * Cancel a running job
   * Marks job as failed with cancellation message
   */
  async cancelJob(jobId: string, userId: string): Promise<boolean> {
    console.log('[Background Job] Cancelling job:', jobId, 'for user:', userId);

    const result = await dbConnectionManager.withFreshConnection(async (db) => {
      // First, verify the job exists and belongs to the user
      const [job] = await db
        .select()
        .from(backgroundJobs)
        .where(eq(backgroundJobs.id, jobId));

      if (!job) {
        console.error('[Background Job] Job not found:', jobId);
        return false;
      }

      if (job.userId !== userId) {
        console.error('[Background Job] User does not own job:', userId, 'vs', job.userId);
        return false;
      }

      // Only allow cancelling pending or running jobs
      if (job.status !== 'pending' && job.status !== 'running') {
        console.error('[Background Job] Job is not cancellable (status:', job.status, ')');
        return false;
      }

      // Mark as failed with cancellation message
      await db
        .update(backgroundJobs)
        .set({
          status: 'failed',
          errorMessage: 'Job cancelled by user',
          failedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(backgroundJobs.id, jobId));

      console.log('[Background Job] ✓ Job cancelled:', jobId);
      return true;
    });

    return result;
  }

  /**
   * Delete old completed/failed jobs
   * Cleans up jobs older than specified days
   */
  async cleanupOldJobs(daysOld: number = 7): Promise<number> {
    console.log('[Background Job] Cleaning up jobs older than', daysOld, 'days');

    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await dbConnectionManager.withFreshConnection(async (db) => {
      // First, get the jobs that will be deleted
      const jobsToDelete = await db
        .select({ id: backgroundJobs.id })
        .from(backgroundJobs)
        .where(
          and(
            inArray(backgroundJobs.status, ['completed', 'failed']),
            // Drizzle ORM date comparison using sql template tag from drizzle-orm
            sql`${backgroundJobs.createdAt} < ${cutoffDate}`
          )
        );

      if (jobsToDelete.length === 0) {
        console.log('[Background Job] ✓ No old jobs to delete');
        return 0;
      }

      // Delete the jobs
      const jobIds = jobsToDelete.map(job => job.id);
      await db
        .delete(backgroundJobs)
        .where(inArray(backgroundJobs.id, jobIds));

      console.log('[Background Job] ✓ Deleted', jobsToDelete.length, 'old jobs');
      return jobsToDelete.length;
    });

    return result;
  }

  /**
   * Process pending jobs (dispatcher)
   * Polls for pending jobs and routes them to appropriate workers
   */
  async processPendingJobs(): Promise<void> {
    try {
      const result = await dbConnectionManager.withFreshConnection(async (db) => {
        return await db
          .select()
          .from(backgroundJobs)
          .where(eq(backgroundJobs.status, 'pending'))
          .orderBy(backgroundJobs.createdAt)
          .limit(10);
      });

      if (result.length === 0) {
        return;
      }

      console.log(`[Background Job Dispatcher] Found ${result.length} pending job(s)`);

      // Process each job
      for (const job of result) {
        this.processJob(job).catch((error) => {
          console.error('[Background Job Dispatcher] Error processing job:', job.id, error);
        });
      }
    } catch (error) {
      console.error('[Background Job Dispatcher] Error fetching pending jobs:', error);
    }
  }

  /**
   * Process a single job by routing to appropriate worker
   */
  private async processJob(job: SelectBackgroundJob): Promise<void> {
    console.log(`[Background Job Dispatcher] Processing ${job.jobType} job:`, job.id);

    try {
      // Import worker dynamically to avoid circular dependencies
      if (job.jobType === 'document_enrichment') {
        const { processDocumentEnrichmentJob } = await import('./document-enrichment-worker');
        await processDocumentEnrichmentJob(job);
      }
      // Add other job types here as needed
      else {
        console.log(`[Background Job Dispatcher] No worker for job type: ${job.jobType}`);
      }
    } catch (error: any) {
      console.error(`[Background Job Dispatcher] Job ${job.id} failed:`, error);
      await this.failJob(job.id, error);
    }
  }
}

// Export singleton instance
export const backgroundJobService = new BackgroundJobService();
