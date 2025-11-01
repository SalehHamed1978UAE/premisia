import { db } from "../db.js";
import { researchBatchService } from "../services/research-batch-service.js";
import { strategyVersions, references, type InsertReference } from "@shared/schema.js";
import { eq } from "drizzle-orm";
import { aiClients } from "../ai-clients.js";
import { backgroundJobService } from "../services/background-job-service.js";

/**
 * Research Enrichment Worker
 * 
 * PURPOSE: Process raw research batches into enriched, categorized findings
 * 
 * WORKFLOW:
 * 1. Load raw JSON from filesystem
 * 2. Normalize into canonical structure (title, snippet, date, quote)
 * 3. Group findings by category (market dynamics, buyer behavior, etc.)
 * 4. Extract citations (truncate to 300 chars, include URL)
 * 5. Write to strategy_versions.analysisData.research
 * 6. Create reference records (origin: 'web_search')
 * 7. Mark batch as enriched with summary stats
 */

interface NormalizedFinding {
  fact: string;
  citation: string;
  confidence: 'high' | 'medium' | 'low';
  category: string;
  source: {
    title: string;
    url: string;
    snippet?: string;
    publicationDate?: string;
  };
}

interface EnrichedResearch {
  market_dynamics: NormalizedFinding[];
  competitive_landscape: NormalizedFinding[];
  buyer_behavior: NormalizedFinding[];
  regulatory_factors: NormalizedFinding[];
  sources: Array<{
    url: string;
    title: string;
    relevance_score: number;
    publication_date?: string;
  }>;
}

export class ResearchEnrichmentWorker {
  /**
   * Main entry point - enrich a research batch
   */
  async enrichBatch(params: {
    batchId: string;
    sessionId: string;
    understandingId?: string;
    journeyType?: string;
  }): Promise<void> {
    const { batchId, sessionId, understandingId } = params;

    try {
      console.log(`[Enrichment] Starting enrichment for batch ${batchId}`);

      // 1. Load raw batch
      const rawPayload = await researchBatchService.loadRawBatch(batchId);
      if (!rawPayload) {
        throw new Error(`Batch ${batchId} not found`);
      }

      // 2. Normalize data
      const normalized = await this.normalizeRawData(rawPayload);

      // 3. Group by category
      const enriched = this.groupByCategory(normalized);

      // 4. Extract references
      const refs = this.extractReferences(enriched);

      // 5. Write to strategy versions if understanding exists
      if (understandingId) {
        await this.updateStrategyVersion(understandingId, enriched);
      }

      // 6. Create reference records
      await this.createReferences(refs, sessionId, understandingId);

      // 7. Mark as enriched
      await researchBatchService.markEnriched(batchId);

      console.log(`[Enrichment] ✓ Batch ${batchId} enriched: ${refs.length} references, ${normalized.length} findings`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Enrichment] Failed to enrich batch ${batchId}:`, error);
      await researchBatchService.markFailed(batchId, errorMessage);
      throw error;
    }
  }

  /**
   * Normalize raw Brave API data into canonical finding structure
   */
  private async normalizeRawData(rawPayload: any): Promise<NormalizedFinding[]> {
    const findings: NormalizedFinding[] = [];

    const organicResults = rawPayload.response?.organic || [];

    // Extract basic findings from search results
    for (const result of organicResults.slice(0, 10)) {
      findings.push({
        fact: result.snippet || result.description || result.title,
        citation: result.link,
        confidence: 'medium',
        category: 'market_dynamics', // Will be recategorized by AI
        source: {
          title: result.title,
          url: result.link,
          snippet: result.snippet,
          publicationDate: result.date || undefined,
        },
      });
    }

    return findings;
  }

  /**
   * Group findings into BMC categories
   */
  private groupByCategory(findings: NormalizedFinding[]): EnrichedResearch {
    const enriched: EnrichedResearch = {
      market_dynamics: [],
      competitive_landscape: [],
      buyer_behavior: [],
      regulatory_factors: [],
      sources: [],
    };

    const seenUrls = new Set<string>();

    for (const finding of findings) {
      // Add to appropriate category (simple keyword-based for now)
      const text = finding.fact.toLowerCase();
      
      if (text.includes('compet') || text.includes('rival') || text.includes('market share')) {
        enriched.competitive_landscape.push(finding);
      } else if (text.includes('customer') || text.includes('buyer') || text.includes('demand')) {
        enriched.buyer_behavior.push(finding);
      } else if (text.includes('regul') || text.includes('law') || text.includes('compliance')) {
        enriched.regulatory_factors.push(finding);
      } else {
        enriched.market_dynamics.push(finding);
      }

      // Add unique sources
      if (!seenUrls.has(finding.source.url)) {
        seenUrls.add(finding.source.url);
        enriched.sources.push({
          url: finding.source.url,
          title: finding.source.title,
          relevance_score: finding.confidence === 'high' ? 0.85 : finding.confidence === 'medium' ? 0.65 : 0.45,
          publication_date: finding.source.publicationDate,
        });
      }
    }

    return enriched;
  }

  /**
   * Extract references for provenance tracking
   */
  private extractReferences(enriched: EnrichedResearch): Array<{
    title: string;
    url: string;
    sourceType: string;
    description?: string;
    topics: string[];
    confidence: number;
    origin: string;
  }> {
    const references = [];

    for (const source of enriched.sources) {
      // Find related findings
      const relatedFindings = [
        ...enriched.market_dynamics,
        ...enriched.competitive_landscape,
        ...enriched.buyer_behavior,
        ...enriched.regulatory_factors,
      ].filter(f => f.citation === source.url);

      // Extract key quote (truncated to 300 chars)
      const keyQuote = relatedFindings.length > 0
        ? relatedFindings[0].fact.substring(0, 300)
        : undefined;

      // Determine topics
      const topics = new Set<string>();
      topics.add('market research');
      
      relatedFindings.forEach(f => {
        if (enriched.market_dynamics.includes(f)) topics.add('market dynamics');
        if (enriched.competitive_landscape.includes(f)) topics.add('competitive landscape');
        if (enriched.buyer_behavior.includes(f)) topics.add('buyer behavior');
        if (enriched.regulatory_factors.includes(f)) topics.add('regulatory');
      });

      references.push({
        title: source.title,
        url: source.url,
        sourceType: 'article',
        description: keyQuote,
        topics: Array.from(topics),
        confidence: source.relevance_score,
        origin: 'web_search',
      });
    }

    return references;
  }

  /**
   * Update strategy version with enriched research
   */
  private async updateStrategyVersion(understandingId: string, enriched: EnrichedResearch): Promise<void> {
    try {
      // Find the latest version for this understanding
      const versions = await db
        .select()
        .from(strategyVersions)
        .where(eq(strategyVersions.understandingId, understandingId))
        .orderBy(strategyVersions.versionNumber)
        .limit(1);

      if (versions.length === 0) {
        console.warn(`[Enrichment] No strategy version found for understanding ${understandingId}`);
        return;
      }

      const version = versions[0];
      const analysisData = (version.analysisData as any) || {};

      // Merge enriched research into existing analysis data
      analysisData.research = {
        ...(analysisData.research || {}),
        market_dynamics: [...(analysisData.research?.market_dynamics || []), ...enriched.market_dynamics],
        competitive_landscape: [...(analysisData.research?.competitive_landscape || []), ...enriched.competitive_landscape],
        buyer_behavior: [...(analysisData.research?.buyer_behavior || []), ...enriched.buyer_behavior],
        regulatory_factors: [...(analysisData.research?.regulatory_factors || []), ...enriched.regulatory_factors],
        sources: [...(analysisData.research?.sources || []), ...enriched.sources],
      };

      await db
        .update(strategyVersions)
        .set({ analysisData })
        .where(eq(strategyVersions.id, version.id));

      console.log(`[Enrichment] Updated strategy version ${version.id} with enriched research`);
    } catch (error) {
      console.error(`[Enrichment] Failed to update strategy version:`, error);
      // Don't throw - enrichment can still succeed without version update
    }
  }

  /**
   * Create reference records in database
   */
  private async createReferences(
    refs: Array<{
      title: string;
      url: string;
      sourceType: string;
      description?: string;
      topics: string[];
      confidence: number;
      origin: string;
    }>,
    sessionId: string,
    understandingId?: string
  ): Promise<void> {
    const referenceInserts: InsertReference[] = refs.map(ref => ({
      title: ref.title,
      url: ref.url,
      sourceType: ref.sourceType as any,
      origin: ref.origin as any,
      description: ref.description,
      tags: ref.topics,
      confidence: ref.confidence,
      understandingId: understandingId || null,
      sessionId,
    }));

    if (referenceInserts.length > 0) {
      await db.insert(references).values(referenceInserts);
      console.log(`[Enrichment] Created ${referenceInserts.length} reference records`);
    }
  }
}

export const researchEnrichmentWorker = new ResearchEnrichmentWorker();
