import type { SelectBackgroundJob } from "@shared/schema";
import { strategicUnderstandingService } from "../services/strategic-understanding-service";
import { backgroundJobService } from "../services/background-job-service";
import { secureDataService } from "../services/secure-data-service";

/**
 * Document Enrichment Worker
 * 
 * Processes uploaded documents in the background to extract knowledge
 * and populate the knowledge graph without blocking the upload flow.
 */

interface ProcessedInput {
  content: string;
  metadata?: {
    fileName?: string;
    pageCount?: number;
    wordCount?: number;
    images?: number;
  };
}

const MIN_CONTENT_LENGTH = 500;

export async function processDocumentEnrichmentJob(job: SelectBackgroundJob): Promise<void> {
  console.log('[DocumentEnrichment] Processing job:', job.id);
  
  try {
    const { processedInput, sessionId, understandingId, fileName } = job.inputData as {
      processedInput: ProcessedInput;
      sessionId: string;
      understandingId?: string;
      fileName?: string;
    };

    if (!processedInput || !sessionId) {
      throw new Error('Missing required input data: processedInput or sessionId');
    }

    // Check if content is substantial enough to warrant enrichment
    if (processedInput.content.length < MIN_CONTENT_LENGTH) {
      console.log(`[DocumentEnrichment] Skipping low-signal document (${processedInput.content.length} chars)`);
      await backgroundJobService.updateJob(job.id, {
        status: 'completed',
        progress: 100,
        resultData: {
          ignored: true,
          reason: 'low_signal',
          contentLength: processedInput.content.length,
          fileName: fileName || 'unknown'
        }
      });
      return;
    }

    // Update status to running
    await backgroundJobService.updateJob(job.id, {
      status: 'running',
      progress: 10,
      progressMessage: 'Analyzing document content...'
    });

    // Extract understanding from the document
    console.log('[DocumentEnrichment] Extracting knowledge from document:', fileName);
    await backgroundJobService.updateJob(job.id, {
      progress: 30,
      progressMessage: 'Extracting entities and relationships...'
    });

    const understanding = await strategicUnderstandingService.extractUnderstanding({
      sessionId,
      userInput: processedInput.content,
      source: fileName || 'uploaded_document',
    });

    console.log('[DocumentEnrichment] Extracted understanding:', understanding.id);

    // Update progress
    await backgroundJobService.updateJob(job.id, {
      progress: 70,
      progressMessage: 'Building knowledge graph...'
    });

    // If there was an existing understanding ID, we've merged with it
    // Otherwise, this is a new understanding
    const finalUnderstandingId = understandingId || understanding.id;

    // Get entity count for notification
    const entityCount = understanding.entities?.length || 0;

    console.log(`[DocumentEnrichment] ✓ Enrichment complete: ${entityCount} entities extracted`);

    // Mark job as completed with results
    await backgroundJobService.updateJob(job.id, {
      status: 'completed',
      progress: 100,
      progressMessage: 'Knowledge extraction complete',
      resultData: {
        understandingId: finalUnderstandingId,
        entityCount,
        fileName: fileName || 'document',
        contentLength: processedInput.content.length,
        metadata: processedInput.metadata
      }
    });

  } catch (error: any) {
    console.error('[DocumentEnrichment] Job failed:', error);
    await backgroundJobService.failJob(job.id, error);
    throw error;
  }
}
