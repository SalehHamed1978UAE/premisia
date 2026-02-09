import { db } from "../db.js";
import { researchBatches, type InsertResearchBatch, type SelectResearchBatch } from "@shared/schema.js";
import { eq } from "drizzle-orm";
import { promises as fs } from "fs";
import { join, dirname } from "path";

/**
 * Research Batch Service
 * 
 * PURPOSE: Durable raw research capture for audit and enrichment
 * 
 * APPROACH:
 * - Persist every Brave API call to filesystem before streaming
 * - Track metadata in database for discoverability
 * - Enable background enrichment jobs to process raw data
 */

export interface RawResearchPayload {
  query: string;
  timestamp: string;
  response: any; // Raw Brave API response
  metadata?: {
    sourcesCount?: number;
    responseTimeMs?: number;
  };
}

class ResearchBatchService {
  private readonly STORAGE_ROOT = join(process.cwd(), 'storage', 'research');

  /**
   * Capture raw research batch to filesystem and database
   */
  async captureRawBatch(params: {
    sessionId: string;
    understandingId?: string;
    journeyType?: string;
    query: string;
    rawPayload: RawResearchPayload;
  }): Promise<SelectResearchBatch> {
    const { sessionId, understandingId, journeyType, query, rawPayload } = params;

    // 1. Persist JSON to filesystem
    const timestamp = Date.now();
    const sessionDir = join(this.STORAGE_ROOT, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    const filename = `${timestamp}_${this.sanitizeFilename(query)}.json`;
    const rawDataPath = join(sessionDir, filename);

    const jsonContent = JSON.stringify(rawPayload, null, 2);
    await fs.writeFile(rawDataPath, jsonContent, 'utf8');

    // Calculate size in KB
    const dataSizeKb = Math.ceil(Buffer.byteLength(jsonContent, 'utf8') / 1024);

    // 2. Create database record
    const [batch] = await db.insert(researchBatches).values({
      sessionId,
      understandingId: understandingId || null,
      journeyType: journeyType as any || null,
      query,
      rawDataPath,
      sourcesCount: rawPayload.metadata?.sourcesCount || 0,
      dataSizeKb,
      status: 'captured',
    }).returning();

    console.log(`[ResearchBatch] Captured batch ${batch.id} - Query: "${query.substring(0, 50)}..." (${dataSizeKb} KB, ${batch.sourcesCount} sources)`);

    return batch;
  }

  /**
   * Load raw research payload from filesystem
   */
  async loadRawBatch(batchId: string): Promise<RawResearchPayload | null> {
    const [batch] = await db
      .select()
      .from(researchBatches)
      .where(eq(researchBatches.id, batchId))
      .limit(1);

    if (!batch) {
      console.warn(`[ResearchBatch] Batch ${batchId} not found`);
      return null;
    }

    try {
      const content = await fs.readFile(batch.rawDataPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`[ResearchBatch] Failed to load batch ${batchId}:`, error);
      return null;
    }
  }

  /**
   * Mark batch as enriched
   */
  async markEnriched(batchId: string): Promise<void> {
    await db
      .update(researchBatches)
      .set({
        status: 'enriched',
        enrichedAt: new Date(),
      })
      .where(eq(researchBatches.id, batchId));

    console.log(`[ResearchBatch] Marked batch ${batchId} as enriched`);
  }

  /**
   * Mark batch as failed
   */
  async markFailed(batchId: string, errorMessage: string): Promise<void> {
    await db
      .update(researchBatches)
      .set({
        status: 'failed',
        errorMessage,
      })
      .where(eq(researchBatches.id, batchId));

    console.error(`[ResearchBatch] Marked batch ${batchId} as failed: ${errorMessage}`);
  }

  /**
   * Get batch by ID
   */
  async getBatch(batchId: string): Promise<SelectResearchBatch | null> {
    const [batch] = await db
      .select()
      .from(researchBatches)
      .where(eq(researchBatches.id, batchId))
      .limit(1);

    return batch || null;
  }

  /**
   * Get all batches for a session
   */
  async getBatchesForSession(sessionId: string): Promise<SelectResearchBatch[]> {
    return db
      .select()
      .from(researchBatches)
      .where(eq(researchBatches.sessionId, sessionId))
      .orderBy(researchBatches.requestedAt);
  }

  /**
   * Sanitize filename for safe filesystem storage
   */
  private sanitizeFilename(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .substring(0, 50);
  }
}

export const researchBatchService = new ResearchBatchService();
