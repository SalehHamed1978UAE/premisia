import { db } from "../db.js";
import { storage } from "../storage.js";
import { researchBatchService } from "../services/research-batch-service.js";
import { strategyVersions, references } from "@shared/schema.js";
import { eq } from "drizzle-orm";
export class ResearchEnrichmentWorker {
    /**
     * Main entry point - enrich a research batch
     */
    async enrichBatch(params) {
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Enrichment] Failed to enrich batch ${batchId}:`, error);
            await researchBatchService.markFailed(batchId, errorMessage);
            throw error;
        }
    }
    /**
     * Normalize raw Brave API data into canonical finding structure
     */
    async normalizeRawData(rawPayload) {
        const findings = [];
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
    groupByCategory(findings) {
        const enriched = {
            market_dynamics: [],
            competitive_landscape: [],
            buyer_behavior: [],
            regulatory_factors: [],
            sources: [],
        };
        const seenUrls = new Set();
        for (const finding of findings) {
            // Add to appropriate category (simple keyword-based for now)
            const text = finding.fact.toLowerCase();
            if (text.includes('compet') || text.includes('rival') || text.includes('market share')) {
                enriched.competitive_landscape.push(finding);
            }
            else if (text.includes('customer') || text.includes('buyer') || text.includes('demand')) {
                enriched.buyer_behavior.push(finding);
            }
            else if (text.includes('regul') || text.includes('law') || text.includes('compliance')) {
                enriched.regulatory_factors.push(finding);
            }
            else {
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
    extractReferences(enriched) {
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
            const topics = new Set();
            topics.add('market research');
            relatedFindings.forEach(f => {
                if (enriched.market_dynamics.includes(f))
                    topics.add('market dynamics');
                if (enriched.competitive_landscape.includes(f))
                    topics.add('competitive landscape');
                if (enriched.buyer_behavior.includes(f))
                    topics.add('buyer behavior');
                if (enriched.regulatory_factors.includes(f))
                    topics.add('regulatory');
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
     * Uses storage layer to ensure proper encryption/decryption
     */
    async updateStrategyVersion(understandingId, enriched) {
        try {
            // Find the latest version for this understanding via direct query (just to get ID)
            const versions = await db
                .select({ id: strategyVersions.id, sessionId: strategyVersions.sessionId, versionNumber: strategyVersions.versionNumber })
                .from(strategyVersions)
                .where(eq(strategyVersions.understandingId, understandingId))
                .orderBy(strategyVersions.versionNumber)
                .limit(1);
            if (versions.length === 0) {
                console.warn(`[Enrichment] No strategy version found for understanding ${understandingId}`);
                return;
            }
            const versionRef = versions[0];
            // Get decrypted version via storage layer
            const version = await storage.getStrategyVersion(versionRef.sessionId, versionRef.versionNumber);
            if (!version) {
                console.warn(`[Enrichment] Could not load strategy version ${versionRef.id}`);
                return;
            }
            const analysisData = version.analysisData || {};
            // Merge enriched research into existing analysis data
            analysisData.research = {
                ...(analysisData.research || {}),
                market_dynamics: [...(analysisData.research?.market_dynamics || []), ...enriched.market_dynamics],
                competitive_landscape: [...(analysisData.research?.competitive_landscape || []), ...enriched.competitive_landscape],
                buyer_behavior: [...(analysisData.research?.buyer_behavior || []), ...enriched.buyer_behavior],
                regulatory_factors: [...(analysisData.research?.regulatory_factors || []), ...enriched.regulatory_factors],
                sources: [...(analysisData.research?.sources || []), ...enriched.sources],
            };
            // Update via storage layer (will re-encrypt)
            await storage.updateStrategyVersion(versionRef.id, { analysisData });
            console.log(`[Enrichment] Updated strategy version ${versionRef.id} with enriched research`);
        }
        catch (error) {
            console.error(`[Enrichment] Failed to update strategy version:`, error);
            // Don't throw - enrichment can still succeed without version update
        }
    }
    /**
     * Create reference records in database
     */
    async createReferences(refs, sessionId, understandingId) {
        const referenceInserts = refs.map(ref => ({
            title: ref.title,
            url: ref.url,
            sourceType: ref.sourceType,
            origin: ref.origin,
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
//# sourceMappingURL=research-enrichment-worker.js.map