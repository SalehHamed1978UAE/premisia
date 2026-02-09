import { db } from './db.js';
import { strategicEntities } from '@shared/schema.js';
import { eq } from 'drizzle-orm';
import { aiClients } from './ai-clients.js';
/**
 * Service for comparing PESTLE claims with user assumptions
 * Identifies which trends validate or contradict strategic assumptions
 */
export class AssumptionComparisonService {
    /**
     * Compare PESTLE claims with assumptions from strategic understanding
     * Returns comparisons and provider info for telemetry
     */
    async compareWithAssumptions(understandingId, claims) {
        // Load assumptions from strategic_entities
        const assumptions = await this.loadAssumptions(understandingId);
        if (assumptions.length === 0) {
            console.log('[AssumptionComparison] No assumptions found for understanding', understandingId);
            return { comparisons: [], providers: [] };
        }
        // Compare each assumption with all claims
        const comparisons = [];
        const providers = [];
        for (const assumption of assumptions) {
            const result = await this.compareAssumptionWithClaims(assumption, claims);
            comparisons.push(result.comparison);
            providers.push(result.provider);
        }
        return { comparisons, providers };
    }
    /**
     * Load assumptions from strategic_entities
     */
    async loadAssumptions(understandingId) {
        const entities = await db
            .select()
            .from(strategicEntities)
            .where(eq(strategicEntities.understandingId, understandingId));
        return entities
            .filter(e => e.type === 'explicit_assumption' || e.type === 'implicit_implication')
            .map(e => ({
            id: e.id,
            claim: e.claim,
            type: e.type,
            metadata: e.metadata
        }));
    }
    /**
     * Compare a single assumption with all PESTLE claims
     * Returns comparison and provider for telemetry
     */
    async compareAssumptionWithClaims(assumption, claims) {
        // Use LLM to identify relationships
        const systemPrompt = `You are an expert at analyzing strategic assumptions and trend data. Your task is to compare a business assumption with macro-environmental trends and identify relationships.

For each trend claim, determine if it:
- VALIDATES the assumption (supports or strengthens it)
- CONTRADICTS the assumption (opposes or weakens it)
- Is NEUTRAL (unrelated or no clear relationship)

Provide evidence explaining the relationship and a confidence score (0-1).

Output must be valid JSON only. No markdown, no code blocks.

Output format:
{
  "relationship": "validates|contradicts|neutral",
  "relatedClaims": [
    {
      "claimIndex": 0,
      "relationship": "validates|contradicts|neutral",
      "evidence": "Explanation of why this claim validates/contradicts/is neutral to the assumption",
      "confidence": 0.85
    }
  ]
}

Only include claims with "validates" or "contradicts" relationship. Skip neutral claims.`;
        const userMessage = `Assumption: ${assumption.claim}

PESTLE Trend Claims:
${claims.map((c, i) => `${i}. [${c.domain}] ${c.claim} (${c.timeHorizon})`).join('\n')}

Compare the assumption with each trend claim and identify relationships.`;
        try {
            const response = await aiClients.callWithFallback({
                systemPrompt,
                userMessage,
                maxTokens: 2048
            });
            const parsed = this.parseComparisonResponse(response.content, claims);
            // Determine overall relationship
            const validates = parsed.relatedClaims.filter((c) => c.relationship === 'validates').length;
            const contradicts = parsed.relatedClaims.filter((c) => c.relationship === 'contradicts').length;
            let relationship = 'neutral';
            if (validates > contradicts) {
                relationship = 'validates';
            }
            else if (contradicts > validates) {
                relationship = 'contradicts';
            }
            else if (validates > 0 && contradicts > 0) {
                // Mixed signals - use confidence to determine
                const validateConfidence = parsed.relatedClaims
                    .filter((c) => c.relationship === 'validates')
                    .reduce((sum, c) => sum + c.confidence, 0) / validates;
                const contradictConfidence = parsed.relatedClaims
                    .filter((c) => c.relationship === 'contradicts')
                    .reduce((sum, c) => sum + c.confidence, 0) / contradicts;
                relationship = validateConfidence >= contradictConfidence ? 'validates' : 'contradicts';
            }
            return {
                comparison: {
                    assumptionId: assumption.id,
                    assumption: assumption.claim,
                    relationship,
                    relatedClaims: parsed.relatedClaims.map((rc) => ({
                        claim: rc.claim,
                        evidence: rc.evidence,
                        confidence: rc.confidence
                    }))
                },
                provider: response.provider
            };
        }
        catch (error) {
            console.error('[AssumptionComparison] Error comparing assumption:', error);
            // Return neutral comparison on error
            return {
                comparison: {
                    assumptionId: assumption.id,
                    assumption: assumption.claim,
                    relationship: 'neutral',
                    relatedClaims: []
                },
                provider: 'unknown' // Error case
            };
        }
    }
    /**
     * Parse LLM comparison response
     */
    parseComparisonResponse(text, claims) {
        try {
            // Remove markdown code blocks if present
            let cleanedText = text.trim();
            if (cleanedText.startsWith('```json')) {
                cleanedText = cleanedText.replace(/^```json\n/, '').replace(/\n```$/, '');
            }
            else if (cleanedText.startsWith('```')) {
                cleanedText = cleanedText.replace(/^```\n/, '').replace(/\n```$/, '');
            }
            const parsed = JSON.parse(cleanedText);
            // Map claim indices to actual claims
            const relatedClaims = (parsed.relatedClaims || [])
                .filter((rc) => rc.claimIndex !== undefined &&
                rc.relationship &&
                rc.evidence &&
                claims[rc.claimIndex])
                .map((rc) => ({
                claim: claims[rc.claimIndex],
                relationship: rc.relationship,
                evidence: rc.evidence,
                confidence: rc.confidence || 0.5
            }));
            return { relatedClaims };
        }
        catch (error) {
            console.error('[AssumptionComparison] Error parsing response:', error);
            console.error('Raw text:', text);
            return { relatedClaims: [] };
        }
    }
    /**
     * Filter comparisons to only show significant relationships
     */
    filterSignificantComparisons(comparisons, minConfidence = 0.6) {
        return comparisons
            .map(comp => ({
            ...comp,
            relatedClaims: comp.relatedClaims.filter(rc => rc.confidence >= minConfidence)
        }))
            .filter(comp => comp.relatedClaims.length > 0);
    }
    /**
     * Get summary statistics
     */
    getSummaryStats(comparisons) {
        const total = comparisons.length;
        const validated = comparisons.filter(c => c.relationship === 'validates').length;
        const contradicted = comparisons.filter(c => c.relationship === 'contradicts').length;
        const neutral = comparisons.filter(c => c.relationship === 'neutral').length;
        return {
            total,
            validated,
            contradicted,
            neutral,
            validationRate: total > 0 ? validated / total : 0,
            contradictionRate: total > 0 ? contradicted / total : 0
        };
    }
}
// Export singleton instance
export const assumptionComparisonService = new AssumptionComparisonService();
//# sourceMappingURL=assumption-comparison-service.js.map