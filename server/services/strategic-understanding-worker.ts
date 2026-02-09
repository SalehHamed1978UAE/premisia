import type { SelectBackgroundJob } from "@shared/schema";
import { JourneyOrchestrator } from "../journey/journey-orchestrator";
import { backgroundJobService } from "./background-job-service";
import type { JourneyType } from '@shared/journey-types';

/**
 * Strategic Understanding Worker
 * 
 * Executes journey frameworks in the background to complete strategic analysis
 * without blocking the user interface.
 */

const journeyOrchestrator = new JourneyOrchestrator();

export async function processStrategicUnderstandingJob(job: SelectBackgroundJob): Promise<void> {
  console.log('[StrategicUnderstanding Worker] Processing job:', job.id);
  
  try {
    const { sessionId, understandingId, journeyType, isFollowOn, baseUnderstandingId } = job.inputData as {
      sessionId: string;
      understandingId: string;
      journeyType: JourneyType;
      isFollowOn?: boolean;
      baseUnderstandingId?: string;
    };

    if (!sessionId || !journeyType) {
      throw new Error('Missing required input data: sessionId or journeyType');
    }

    console.log(`[StrategicUnderstanding Worker] Executing ${journeyType} journey for session ${sessionId}${isFollowOn ? ' (follow-on)' : ''}`);

    // Update status to running
    await backgroundJobService.updateJob(job.id, {
      status: 'running',
      progress: 5,
      progressMessage: `Starting ${journeyType} journey...`
    });

    // Execute the journey with progress tracking
    await journeyOrchestrator.executeJourney(
      sessionId,
      // Progress callback to update job status
      async (progress) => {
        const percentComplete = Math.min(95, 10 + Math.round(progress.percentComplete * 0.85));
        await backgroundJobService.updateJob(job.id, {
          progress: percentComplete,
          progressMessage: `${progress.status} (${progress.frameworkIndex + 1}/${progress.totalFrameworks})`
        });
      }
    );

    console.log(`[StrategicUnderstanding Worker] Journey ${journeyType} completed successfully`);

    // Mark job as completed
    await backgroundJobService.updateJob(job.id, {
      status: 'completed',
      progress: 100,
      progressMessage: `${journeyType} journey completed successfully`,
      resultData: {
        understandingId,
        journeyType,
        isFollowOn,
        baseUnderstandingId,
        completedAt: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('[StrategicUnderstanding Worker] Job failed:', error);
    await backgroundJobService.failJob(job.id, error);
    throw error;
  }
}
