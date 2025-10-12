import { db } from './db.js';
import { trendAnalysisJobs } from '@shared/schema.js';
import { eq, and } from 'drizzle-orm';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TrendAnalysisJob {
  jobId: string;
  idempotencyKey: string;
  understandingId: string;
  status: JobStatus;
  data?: any;
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

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
  async createJob(
    understandingId: string,
    idempotencyKey: string,
    data?: any
  ): Promise<TrendAnalysisJob> {
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
      return job as TrendAnalysisJob;
    } catch (error: any) {
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
          return existing[0] as TrendAnalysisJob;
        }
      }
      
      // Re-throw if not a unique violation or job not found
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<TrendAnalysisJob | null> {
    const [job] = await db
      .select()
      .from(trendAnalysisJobs)
      .where(eq(trendAnalysisJobs.jobId, jobId))
      .limit(1);

    return job ? (job as TrendAnalysisJob) : null;
  }

  /**
   * Get job by idempotency key
   */
  async getJobByIdempotencyKey(idempotencyKey: string): Promise<TrendAnalysisJob | null> {
    const [job] = await db
      .select()
      .from(trendAnalysisJobs)
      .where(eq(trendAnalysisJobs.idempotencyKey, idempotencyKey))
      .limit(1);

    return job ? (job as TrendAnalysisJob) : null;
  }

  /**
   * Update job status to running
   */
  async markAsRunning(jobId: string): Promise<void> {
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
  async markAsCompleted(jobId: string, result: any): Promise<void> {
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
  async markAsFailed(jobId: string, error: string): Promise<void> {
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
  async getJobsForUnderstanding(understandingId: string): Promise<TrendAnalysisJob[]> {
    const jobs = await db
      .select()
      .from(trendAnalysisJobs)
      .where(eq(trendAnalysisJobs.understandingId, understandingId));

    return jobs as TrendAnalysisJob[];
  }

  /**
   * Check if there's already a completed job for an understanding
   */
  async hasCompletedJob(understandingId: string): Promise<boolean> {
    const [job] = await db
      .select()
      .from(trendAnalysisJobs)
      .where(
        and(
          eq(trendAnalysisJobs.understandingId, understandingId),
          eq(trendAnalysisJobs.status, 'completed')
        )
      )
      .limit(1);

    return !!job;
  }
}
