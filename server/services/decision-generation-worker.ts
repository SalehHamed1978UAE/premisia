import type { SelectBackgroundJob } from "@shared/schema";
import { backgroundJobService } from "./background-job-service";
import { dbConnectionManager } from "../db-connection-manager";
import { strategyVersions } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Decision Generation Worker
 * 
 * Processes decision generation in the background after BMC research completes.
 * This allows the SSE stream to complete quickly while decisions are generated async.
 */

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;

export async function processDecisionGenerationJob(job: SelectBackgroundJob): Promise<void> {
  console.log('[Decisions] Starting job:', job.id);
  
  try {
    const { bmcResult, originalInput, sessionId, versionNumber } = job.inputData as {
      bmcResult: any;
      originalInput: string;
      sessionId: string;
      versionNumber: number;
    };

    if (!bmcResult || !sessionId) {
      throw new Error('Missing required input data: bmcResult or sessionId');
    }

    // Update status to running
    await backgroundJobService.updateJob(job.id, {
      status: 'running',
      progress: 10,
      progressMessage: 'Generating strategic decisions from BMC analysis...'
    });

    console.log('[Decisions] Processing BMC result for session:', sessionId);

    // Import decision generator dynamically to avoid circular deps
    const { DecisionGenerator } = await import('../strategic-consultant/decision-generator');
    const decisionGenerator = new DecisionGenerator();

    let decisions: any = null;
    let lastError: Error | null = null;

    // Retry logic for AI calls
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[Decisions] Retry attempt ${attempt}/${MAX_RETRIES}...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }

        await backgroundJobService.updateJob(job.id, {
          progress: 30 + (attempt * 10),
          progressMessage: attempt > 0 
            ? `Retrying decision generation (attempt ${attempt + 1})...`
            : 'Analyzing BMC blocks for strategic decisions...'
        });

        decisions = await decisionGenerator.generateDecisionsFromBMC(bmcResult, originalInput);
        console.log(`[Decisions] Generated ${decisions.decisions?.length || 0} decisions`);
        break; // Success, exit retry loop
      } catch (error: any) {
        lastError = error;
        console.error(`[Decisions] Attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt === MAX_RETRIES) {
          throw new Error(`Decision generation failed after ${MAX_RETRIES + 1} attempts: ${error.message}`);
        }
      }
    }

    if (!decisions || !decisions.decisions) {
      throw new Error('Decision generation returned invalid result');
    }

    await backgroundJobService.updateJob(job.id, {
      progress: 70,
      progressMessage: 'Saving decisions to strategy version...'
    });

    // Save decisions to the strategy version
    await dbConnectionManager.retryWithBackoff(async (db) => {
      // Find the version by sessionId and versionNumber
      const [existingVersion] = await db
        .select()
        .from(strategyVersions)
        .where(
          and(
            eq(strategyVersions.sessionId, sessionId),
            eq(strategyVersions.versionNumber, versionNumber)
          )
        );

      if (!existingVersion) {
        throw new Error(`Strategy version not found for session ${sessionId} version ${versionNumber}`);
      }

      // Update the version with decisions (must use decisionsData column, not decisions)
      await db
        .update(strategyVersions)
        .set({
          decisionsData: decisions,
          updatedAt: new Date()
        })
        .where(eq(strategyVersions.id, existingVersion.id));

      console.log(`[Decisions] ✓ Saved ${decisions.decisions.length} decisions to version ${versionNumber}`);
    });

    // Mark job as completed
    await backgroundJobService.updateJob(job.id, {
      status: 'completed',
      progress: 100,
      progressMessage: 'Decision generation complete',
      resultData: {
        decisionsCount: decisions.decisions.length,
        sessionId,
        versionNumber
      }
    });

    console.log(`[Decisions] ✓ Job ${job.id} completed successfully with ${decisions.decisions.length} decisions`);

  } catch (error: any) {
    console.error('[Decisions] Job failed:', error);
    
    // Clear decisionsQueued flag so frontend stops polling and shows error
    try {
      const { sessionId, versionNumber } = job.inputData as {
        sessionId: string;
        versionNumber: number;
      };
      
      await dbConnectionManager.retryWithBackoff(async (db) => {
        const [existingVersion] = await db
          .select()
          .from(strategyVersions)
          .where(
            and(
              eq(strategyVersions.sessionId, sessionId),
              eq(strategyVersions.versionNumber, versionNumber)
            )
          );

        if (existingVersion) {
          await db
            .update(strategyVersions)
            .set({
              decisionsData: { 
                decisions: [], 
                decisionsQueued: false,
                decisionError: error.message || 'Decision generation failed'
              },
              updatedAt: new Date()
            })
            .where(eq(strategyVersions.id, existingVersion.id));
          console.log(`[Decisions] Cleared decisionsQueued flag for version ${versionNumber}`);
        }
      });
    } catch (updateError: any) {
      console.error('[Decisions] Failed to clear decisionsQueued flag:', updateError.message);
    }
    
    // Mark job as failed
    await backgroundJobService.failJob(job.id, error);
    
    throw error; // Re-throw so dispatcher knows it failed
  }
}
