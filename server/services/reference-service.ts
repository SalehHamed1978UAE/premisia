/**
 * Reference Extraction Service
 * 
 * Provides full research provenance tracking for all strategic analysis.
 * Normalizes, deduplicates, and persists references from all analyzers.
 * 
 * Key capabilities:
 * - Normalize citations from different analyzer formats into standard Reference format
 * - Deduplicate references by URL/title across multiple framework runs
 * - Persist references with component mapping (e.g., "BMC.customerSegments")
 * - Link references to specific claims and extracted quotes
 * - Update strategy metadata cache for readiness checks
 */

import { db } from '../db';
import { references, strategicUnderstanding } from '../../shared/schema';
import type { InsertReference, Reference } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { RawReference as AnalyzerRawReference } from '../intelligence/types';

/**
 * Raw reference data from analyzers before normalization
 * Re-export the shared type for consistency
 */
export type RawReference = AnalyzerRawReference;

export interface NormalizedReference extends InsertReference {
  // Extends InsertReference with required fields populated
}

export interface ReferenceUsage {
  component: string; // e.g., "BMC.customerSegments", "RiskRegister[2]"
  claim?: string;
  snippet?: string;
  page?: number;
}

export class ReferenceService {
  /**
   * Map analyzer sourceType to database enum values
   */
  private mapSourceType(sourceType?: string): 'article' | 'report' | 'document' | 'dataset' | 'manual_entry' {
    const mapping: Record<string, 'article' | 'report' | 'document' | 'dataset' | 'manual_entry'> = {
      'article': 'article',
      'report': 'report',
      'document': 'document',
      'dataset': 'dataset',
      'manual_entry': 'manual_entry',
      // Map analyzer types to closest database types
      'website': 'article',
      'book': 'report',
      'interview': 'document',
      'internal_doc': 'document',
      'other': 'document',
    };
    return mapping[sourceType || 'article'] || 'article';
  }

  /**
   * Map analyzer origin to database enum values
   */
  private mapOrigin(origin?: string): 'web_search' | 'manual_upload' | 'document_extract' | 'manual_entry' {
    const mapping: Record<string, 'web_search' | 'manual_upload' | 'document_extract' | 'manual_entry'> = {
      'web_search': 'web_search',
      'manual_upload': 'manual_upload',
      'document_extract': 'document_extract',
      'manual_entry': 'manual_entry',
      // Map analyzer types to closest database types
      'user_upload': 'manual_upload',
      'llm_generation': 'document_extract', // LLM-generated counts as extracted/synthesized
      'third_party_api': 'web_search',
    };
    return mapping[origin || 'web_search'] || 'web_search';
  }

  /**
   * Normalize a raw reference into the standard format
   */
  normalizeReference(
    raw: RawReference,
    userId: string,
    usage: ReferenceUsage,
    options: {
      understandingId?: string;
      sessionId?: string;
      programId?: string;
    }
  ): NormalizedReference {
    // Validate at least one artifact link
    if (!options.understandingId && !options.sessionId && !options.programId) {
      throw new Error('Reference must be linked to at least one artifact (understanding, session, or program)');
    }

    return {
      understandingId: options.understandingId || null,
      sessionId: options.sessionId || null,
      programId: options.programId || null,
      userId,
      sourceType: this.mapSourceType(raw.sourceType),
      title: raw.title.trim(),
      url: raw.url?.trim() || null,
      description: raw.description?.trim() || null,
      topics: raw.topics || [],
      confidence: (raw.confidence !== null && raw.confidence !== undefined) ? String(Math.min(Math.max(raw.confidence, 0), 1)) as any : null,
      extractedQuotes: raw.snippet ? [{
        snippet: raw.snippet,
        page: raw.page,
        usedIn: usage.component,
        claim: usage.claim
      }] : [],
      usedInComponents: [usage.component],
      origin: this.mapOrigin(raw.origin),
      lastValidated: new Date(),
    };
  }

  /**
   * Deduplicate references by URL (preferred) or title
   * Returns unique references and a map of duplicates
   */
  async deduplicateReferences(
    refs: NormalizedReference[]
  ): Promise<{
    unique: NormalizedReference[];
    duplicates: Map<string, NormalizedReference[]>;
  }> {
    const seen = new Map<string, NormalizedReference>();
    const duplicates = new Map<string, NormalizedReference[]>();

    for (const ref of refs) {
      // Primary key: URL if present, otherwise title
      const key = ref.url ? ref.url.toLowerCase() : ref.title.toLowerCase();

      if (seen.has(key)) {
        // Merge duplicate: combine topics, quotes, components
        const existing = seen.get(key)!;
        
        // Merge topics (unique)
        const mergedTopics = Array.from(new Set([...(existing.topics || []), ...(ref.topics || [])]));
        
        // Merge extracted quotes
        const mergedQuotes = [
          ...(existing.extractedQuotes as any[] || []),
          ...(ref.extractedQuotes as any[] || [])
        ];
        
        // Merge used_in_components (unique)
        const mergedComponents = Array.from(new Set([
          ...(existing.usedInComponents || []),
          ...(ref.usedInComponents || [])
        ]));
        
        // Take highest confidence
        const existingConf = existing.confidence ? parseFloat(existing.confidence as string) : 0;
        const refConf = ref.confidence ? parseFloat(ref.confidence as string) : 0;
        const mergedConfidence = Math.max(existingConf, refConf);

        seen.set(key, {
          ...existing,
          topics: mergedTopics,
          extractedQuotes: mergedQuotes,
          usedInComponents: mergedComponents,
          confidence: mergedConfidence !== null && mergedConfidence !== undefined ? String(mergedConfidence) as any : null,
        });

        // Track duplicates for logging
        if (!duplicates.has(key)) {
          duplicates.set(key, []);
        }
        duplicates.get(key)!.push(ref);
      } else {
        seen.set(key, ref);
      }
    }

    return {
      unique: Array.from(seen.values()),
      duplicates
    };
  }

  /**
   * Persist references to database
   * Handles deduplication against existing references
   */
  async persistReferences(
    refs: NormalizedReference[],
    options: {
      understandingId?: string;
      sessionId?: string;
      programId?: string;
    }
  ): Promise<{
    created: Reference[];
    updated: Reference[];
    skipped: number;
  }> {
    if (refs.length === 0) {
      return { created: [], updated: [], skipped: 0 };
    }

    // Deduplicate input references
    const { unique: uniqueRefs } = await this.deduplicateReferences(refs);

    const created: Reference[] = [];
    const updated: Reference[] = [];
    let skipped = 0;

    for (const ref of uniqueRefs) {
      try {
        // Check if reference already exists (by URL or title)
        const existing = await this.findExisting(ref, options);

        if (existing) {
          // Update existing: merge components, quotes, topics
          const mergedComponents = Array.from(new Set([
            ...(existing.usedInComponents || []),
            ...(ref.usedInComponents || [])
          ]));

          const mergedQuotes = [
            ...(existing.extractedQuotes as any[] || []),
            ...(ref.extractedQuotes as any[] || [])
          ];

          const mergedTopics = Array.from(new Set([
            ...(existing.topics || []),
            ...(ref.topics || [])
          ]));

          const existingConf = existing.confidence ? parseFloat(existing.confidence as string) : 0;
          const refConf = ref.confidence ? parseFloat(ref.confidence as string) : 0;
          const mergedConfidence = Math.max(existingConf, refConf);

          const [updatedRef] = await db.update(references)
            .set({
              usedInComponents: mergedComponents,
              extractedQuotes: mergedQuotes,
              topics: mergedTopics,
              confidence: mergedConfidence !== null && mergedConfidence !== undefined ? mergedConfidence.toString() as any : null,
              lastValidated: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(references.id, existing.id))
            .returning();

          updated.push(updatedRef);
        } else {
          // Create new reference
          const [newRef] = await db.insert(references)
            .values(ref)
            .returning();

          created.push(newRef);
        }
      } catch (error) {
        console.error('Error persisting reference:', error);
        skipped++;
      }
    }

    // Update strategy metadata cache
    if (options.understandingId && (created.length > 0 || updated.length > 0)) {
      await this.updateMetadataCache(options.understandingId);
    }

    return { created, updated, skipped };
  }

  /**
   * Find existing reference by URL or title
   */
  private async findExisting(
    ref: NormalizedReference,
    options: {
      understandingId?: string;
      sessionId?: string;
      programId?: string;
    }
  ): Promise<Reference | null> {
    const conditions = [];

    // Match by URL if present (most reliable)
    if (ref.url) {
      conditions.push(eq(references.url, ref.url));
    } else {
      // Fall back to title matching
      conditions.push(eq(references.title, ref.title));
    }

    // Scope to same artifact context
    if (options.understandingId) {
      conditions.push(eq(references.understandingId, options.understandingId));
    }
    if (options.sessionId) {
      conditions.push(eq(references.sessionId, options.sessionId));
    }
    if (options.programId) {
      conditions.push(eq(references.programId, options.programId));
    }

    const results = await db.select()
      .from(references)
      .where(and(...conditions))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Link a reference to a specific component/claim
   */
  async linkToComponent(
    referenceId: string,
    component: string,
    claim?: string,
    snippet?: string
  ): Promise<void> {
    const [existing] = await db.select()
      .from(references)
      .where(eq(references.id, referenceId))
      .limit(1);

    if (!existing) {
      throw new Error(`Reference not found: ${referenceId}`);
    }

    // Add component to used_in_components if not already present
    const components = new Set(existing.usedInComponents || []);
    components.add(component);

    // Add quote/claim if provided
    const quotes = (existing.extractedQuotes as any[] || []);
    if (snippet || claim) {
      quotes.push({ 
        snippet: snippet || undefined, 
        claim: claim || undefined,
        usedIn: component 
      });
    }

    await db.update(references)
      .set({
        usedInComponents: Array.from(components),
        extractedQuotes: quotes,
        updatedAt: new Date(),
      })
      .where(eq(references.id, referenceId));
  }

  /**
   * Update strategy metadata cache with reference count
   */
  private async updateMetadataCache(understandingId: string): Promise<void> {
    // Count references for this understanding
    const refCount = await db.select({ count: sql<number>`count(*)` })
      .from(references)
      .where(eq(references.understandingId, understandingId));

    const count = Number(refCount[0]?.count || 0);

    // Update metadata
    await db.update(strategicUnderstanding)
      .set({
        strategyMetadata: sql`
          jsonb_set(
            COALESCE(strategy_metadata, '{}'::jsonb),
            '{availableReferences}',
            ${count}::text::jsonb,
            true
          )
        `,
        updatedAt: new Date(),
      })
      .where(eq(strategicUnderstanding.id, understandingId));
  }

  /**
   * Get all references for an understanding
   */
  async getReferencesForUnderstanding(understandingId: string): Promise<Reference[]> {
    return await db.select()
      .from(references)
      .where(eq(references.understandingId, understandingId))
      .orderBy(sql`created_at DESC`);
  }

  /**
   * Get all references for a session
   */
  async getReferencesForSession(sessionId: string): Promise<Reference[]> {
    return await db.select()
      .from(references)
      .where(eq(references.sessionId, sessionId))
      .orderBy(sql`created_at DESC`);
  }

  /**
   * Get all references for a program
   */
  async getReferencesForProgram(programId: string): Promise<Reference[]> {
    return await db.select()
      .from(references)
      .where(eq(references.programId, programId))
      .orderBy(sql`created_at DESC`);
  }
}

export const referenceService = new ReferenceService();
