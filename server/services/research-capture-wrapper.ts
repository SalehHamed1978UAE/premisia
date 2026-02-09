import { researchBatchService, type RawResearchPayload } from "./research-batch-service.js";

/**
 * Research Capture Wrapper
 * 
 * PURPOSE: Intercept all web search/fetch calls and persist raw payloads
 * 
 * USAGE: Wrap every call to Brave API or web-fetch before streaming to UI
 */

export interface CaptureContext {
  sessionId: string;
  understandingId?: string;
  journeyType?: string;
}

class ResearchCaptureWrapper {
  /**
   * Wrap a web search call with raw capture
   */
  async captureWebSearch(
    query: string,
    context: CaptureContext,
    searchFn: () => Promise<any>
  ): Promise<{ result: any; batchId: string }> {
    const startTime = Date.now();

    try {
      // Execute the search
      const result = await searchFn();

      // Calculate metadata
      const responseTimeMs = Date.now() - startTime;
      const sourcesCount = result.organic?.length || result.results?.length || 0;

      // Create raw payload
      const rawPayload: RawResearchPayload = {
        query,
        timestamp: new Date().toISOString(),
        response: result,
        metadata: {
          sourcesCount,
          responseTimeMs,
        },
      };

      // Persist to storage
      const batch = await researchBatchService.captureRawBatch({
        ...context,
        query,
        rawPayload,
      });

      console.log(`[Capture] Batch ${batch.id}: "${query.substring(0, 40)}..." → ${sourcesCount} sources (${responseTimeMs}ms)`);

      return {
        result,
        batchId: batch.id,
      };
    } catch (error) {
      // Even on error, try to capture what we got
      const rawPayload: RawResearchPayload = {
        query,
        timestamp: new Date().toISOString(),
        response: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      };

      try {
        const batch = await researchBatchService.captureRawBatch({
          ...context,
          query,
          rawPayload,
        });

        await researchBatchService.markFailed(batch.id, `Search failed: ${error instanceof Error ? error.message : String(error)}`);

        console.error(`[Capture] Batch ${batch.id} failed:`, error);

        return {
          result: { organic: [] },
          batchId: batch.id,
        };
      } catch (captureError) {
        console.error(`[Capture] Failed to capture error batch:`, captureError);
        throw error; // Re-throw original error if capture fails
      }
    }
  }

  /**
   * Wrap content fetch with raw capture
   */
  async captureContentFetch(
    url: string,
    context: CaptureContext,
    fetchFn: () => Promise<any>
  ): Promise<{ result: any; batchId: string }> {
    const startTime = Date.now();

    try {
      const result = await fetchFn();

      const responseTimeMs = Date.now() - startTime;

      const rawPayload: RawResearchPayload = {
        query: `[FETCH] ${url}`,
        timestamp: new Date().toISOString(),
        response: result,
        metadata: {
          sourcesCount: 1,
          responseTimeMs,
        },
      };

      const batch = await researchBatchService.captureRawBatch({
        ...context,
        query: `Content: ${url}`,
        rawPayload,
      });

      console.log(`[Capture] Batch ${batch.id}: Fetched ${url.substring(0, 50)}... (${responseTimeMs}ms)`);

      return {
        result,
        batchId: batch.id,
      };
    } catch (error) {
      const rawPayload: RawResearchPayload = {
        query: `[FETCH] ${url}`,
        timestamp: new Date().toISOString(),
        response: {
          error: error instanceof Error ? error.message : String(error),
        },
      };

      try {
        const batch = await researchBatchService.captureRawBatch({
          ...context,
          query: `Content: ${url}`,
          rawPayload,
        });

        await researchBatchService.markFailed(batch.id, `Fetch failed: ${error instanceof Error ? error.message : String(error)}`);

        console.error(`[Capture] Batch ${batch.id} fetch failed:`, error);

        return {
          result: { content: '' },
          batchId: batch.id,
        };
      } catch (captureError) {
        console.error(`[Capture] Failed to capture error batch:`, captureError);
        throw error;
      }
    }
  }
}

export const researchCaptureWrapper = new ResearchCaptureWrapper();
