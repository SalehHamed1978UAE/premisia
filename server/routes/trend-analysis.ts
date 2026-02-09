import { Router, Request, Response } from 'express';
import { TrendAnalysisAgent } from '../trend-analysis-agent.js';
import { TrendJobQueueService } from '../trend-job-queue-service.js';
import { db } from '../db.js';
import { frameworkInsights, strategyVersions } from '@shared/schema.js';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();
const trendAgent = new TrendAnalysisAgent();
const jobQueue = new TrendJobQueueService();

/**
 * POST /api/trend-analysis/:understandingId
 * Run trend analysis with SSE progress streaming
 */
router.post('/:understandingId', async (req: Request, res: Response) => {
  const { understandingId } = req.params;
  const { versionNumber, sessionId } = req.body;

  if (!understandingId) {
    return res.status(400).json({ error: 'understandingId is required' });
  }

  // Generate idempotency key
  const idempotencyKey = `trend-${understandingId}-${versionNumber || 'latest'}`;

  try {
    // Create or get existing job (idempotent)
    const job = await jobQueue.createJob(understandingId, idempotencyKey, {
      versionNumber,
      sessionId,
    });

    // If job already completed, return cached result
    if (job.status === 'completed') {
      return res.json({
        success: true,
        cached: true,
        result: job.result,
      });
    }

    // If job is already running, return job ID for polling
    if (job.status === 'running') {
      return res.json({
        success: true,
        jobId: job.jobId,
        status: 'running',
        message: 'Analysis is already in progress',
      });
    }

    // Set up Server-Sent Events for progress streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    console.log('[TrendAnalysis] Starting analysis with SSE streaming:', job.jobId);

    // Mark job as running
    await jobQueue.markAsRunning(job.jobId);

    // Send initial progress
    res.write(
      `data: ${JSON.stringify({
        type: 'progress',
        message: '🔍 Extracting domain context from strategic understanding...',
        phase: 'domain_extraction',
        step: 1,
        totalSteps: 4,
      })}\n\n`
    );

    // Phase 1: Domain extraction (no streaming, happens quickly)
    await new Promise((resolve) => setTimeout(resolve, 500));

    res.write(
      `data: ${JSON.stringify({
        type: 'progress',
        message: '🌍 Analyzing PESTLE factors across geographies...',
        phase: 'pestle_generation',
        step: 2,
        totalSteps: 4,
      })}\n\n`
    );

    // Phase 2: PESTLE generation (can take time)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    res.write(
      `data: ${JSON.stringify({
        type: 'progress',
        message: '🔗 Comparing trends with your strategic assumptions...',
        phase: 'assumption_comparison',
        step: 3,
        totalSteps: 4,
      })}\n\n`
    );

    // Run the actual analysis
    const result = await trendAgent.analyzeTrends(understandingId);

    // Persist references to knowledge graph if present
    if (result.references && result.references.length > 0) {
      try {
        const { referenceService } = await import('../services/reference-service.js');
        console.log(`[TrendAnalysis] Persisting ${result.references.length} references to knowledge graph...`);
        
        const userId = (req.user as any)?.claims?.sub || 'system';
        
        // Normalize references first
        const normalized = result.references.map((ref, idx) => 
          referenceService.normalizeReference(
            ref,
            userId,
            { component: 'pestle_trends', claim: ref.description },
            { understandingId, sessionId }
          )
        );
        
        await referenceService.persistReferences(normalized, {
          understandingId,
          sessionId,
        });
        
        console.log(`[TrendAnalysis] ✓ Persisted ${normalized.length} references and updated metadata cache`);
      } catch (error) {
        console.error('[TrendAnalysis] Failed to persist references:', error);
        // Don't fail the entire request if reference persistence fails
      }
    }

    // Phase 3 & 4 messages
    res.write(
      `data: ${JSON.stringify({
        type: 'progress',
        message: '📊 Synthesizing insights and recommendations...',
        phase: 'synthesis',
        step: 4,
        totalSteps: 4,
      })}\n\n`
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Store in dual storage

    // 1. Store in framework_insights (detailed queryable)
    const [insight] = await db
      .insert(frameworkInsights)
      .values({
        understandingId,
        frameworkName: 'PESTLE',
        frameworkVersion: '1.0',
        insights: {
          pestleFactors: result.pestleFactors,
          comparisons: result.comparisons,
          synthesis: result.synthesis,
        },
        telemetry: result.telemetry,
      })
      .returning();

    console.log('[TrendAnalysis] Stored in framework_insights:', insight.id);

    // 2. Store in strategyVersions if provided
    if (sessionId && versionNumber) {
      const [version] = await db
        .select()
        .from(strategyVersions)
        .where(
          and(
            eq(strategyVersions.sessionId, sessionId),
            eq(strategyVersions.versionNumber, versionNumber)
          )
        )
        .limit(1);

      if (version) {
        await db
          .update(strategyVersions)
          .set({
            analysisData: {
              ...((version.analysisData as any) || {}),
              trendAnalysis: {
                pestleFactors: result.pestleFactors,
                comparisons: result.comparisons,
                synthesis: result.synthesis,
                telemetry: result.telemetry,
              },
            },
          })
          .where(eq(strategyVersions.id, version.id));

        console.log('[TrendAnalysis] Updated strategyVersions:', version.id);
      }
    }

    // Mark job as completed
    await jobQueue.markAsCompleted(job.jobId, {
      insightId: insight.id,
      ...result,
    });

    // Send completion message
    res.write(
      `data: ${JSON.stringify({
        type: 'complete',
        message: '✅ Trend analysis complete!',
        result: {
          insightId: insight.id,
          summary: result.synthesis.executiveSummary,
          telemetry: result.telemetry,
        },
      })}\n\n`
    );

    res.end();
  } catch (error: any) {
    console.error('[TrendAnalysis] Error:', error);

    // Try to mark job as failed
    try {
      const job = await jobQueue.getJobByIdempotencyKey(idempotencyKey);
      if (job) {
        await jobQueue.markAsFailed(job.jobId, error.message);
      }
    } catch (jobError) {
      console.error('[TrendAnalysis] Failed to mark job as failed:', jobError);
    }

    // Send error via SSE if possible
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Trend analysis failed' });
    } else {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          message: error.message || 'Trend analysis failed',
        })}\n\n`
      );
      res.end();
    }
  }
});

/**
 * GET /api/trend-analysis/:understandingId/status
 * Get status of trend analysis job
 */
router.get('/:understandingId/status', async (req: Request, res: Response) => {
  const { understandingId } = req.params;
  const { versionNumber } = req.query;

  const idempotencyKey = `trend-${understandingId}-${versionNumber || 'latest'}`;

  try {
    const job = await jobQueue.getJobByIdempotencyKey(idempotencyKey);

    if (!job) {
      return res.status(404).json({ error: 'No analysis found' });
    }

    res.json({
      jobId: job.jobId,
      status: job.status,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    });
  } catch (error: any) {
    console.error('[TrendAnalysis] Status check error:', error);
    res.status(500).json({ error: error.message || 'Failed to check status' });
  }
});

/**
 * GET /api/trend-analysis/:understandingId/latest
 * Get latest completed trend analysis
 */
router.get('/:understandingId/latest', async (req: Request, res: Response) => {
  const { understandingId } = req.params;

  try {
    const [insight] = await db
      .select()
      .from(frameworkInsights)
      .where(
        and(
          eq(frameworkInsights.understandingId, understandingId),
          eq(frameworkInsights.frameworkName, 'PESTLE')
        )
      )
      .orderBy(desc(frameworkInsights.createdAt))
      .limit(1);

    if (!insight) {
      return res.status(404).json({ error: 'No trend analysis found' });
    }

    res.json({
      id: insight.id,
      data: insight.insights,
      telemetry: insight.telemetry,
      createdAt: insight.createdAt,
    });
  } catch (error: any) {
    console.error('[TrendAnalysis] Latest fetch error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch latest analysis' });
  }
});

export default router;
