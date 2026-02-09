import { aiClients } from './ai-clients.js';
/**
 * Service for generating synthesis summary of trend analysis
 * Combines PESTLE claims, assumption comparisons, and evidence into actionable insights
 */
export class TrendSynthesisService {
    /**
     * Generate synthesis summary from trend analysis results
     */
    async generateSynthesis(domain, pestleFactors, comparisons, telemetry) {
        const startTime = Date.now();
        const systemPrompt = `You are a strategic consultant synthesizing PESTLE trend analysis into actionable insights. Your role is to provide an executive summary that:

1. Highlights the most significant macro-environmental factors
2. Identifies strategic implications for the business
3. Provides clear, actionable recommendations
4. Flags risks and opportunities

Output must be valid JSON only. No markdown, no code blocks.

Output format:
{
  "executiveSummary": "A concise 2-3 paragraph summary of the key trends and their implications",
  "keyFindings": ["Finding 1", "Finding 2", ...],
  "strategicImplications": ["Implication 1", "Implication 2", ...],
  "recommendedActions": ["Action 1", "Action 2", ...],
  "riskAreas": ["Risk 1", "Risk 2", ...],
  "opportunities": ["Opportunity 1", "Opportunity 2", ...]
}`;
        const userMessage = this.buildSynthesisPrompt(domain, pestleFactors, comparisons);
        try {
            const response = await aiClients.callWithFallback({
                systemPrompt,
                userMessage,
                maxTokens: 3072
            });
            // Track telemetry if provided
            if (telemetry) {
                this.trackLLMCall(telemetry, response.provider);
                const elapsed = Date.now() - startTime;
                telemetry.totalLatencyMs += elapsed;
            }
            const synthesis = this.parseSynthesisResponse(response.content);
            return synthesis;
        }
        catch (error) {
            console.error('[TrendSynthesis] Error generating synthesis:', error);
            // Track retry if telemetry provided
            if (telemetry) {
                this.trackRetry(telemetry);
            }
            throw new Error('Failed to generate synthesis summary');
        }
    }
    /**
     * Build synthesis prompt from analysis results
     */
    buildSynthesisPrompt(domain, pestleFactors, comparisons) {
        let prompt = `# Business Context\n\n`;
        if (domain.industry) {
            prompt += `Industry: ${domain.industry}\n`;
        }
        if (domain.geography) {
            prompt += `Geography: ${domain.geography}\n`;
        }
        if (domain.regulatory && domain.regulatory.length > 0) {
            prompt += `Regulatory Context: ${domain.regulatory.join(', ')}\n`;
        }
        prompt += `\n# PESTLE Trend Analysis\n\n`;
        // Add PESTLE claims by domain
        const allClaims = [
            { domain: 'Political', claims: pestleFactors.political },
            { domain: 'Economic', claims: pestleFactors.economic },
            { domain: 'Social', claims: pestleFactors.social },
            { domain: 'Technological', claims: pestleFactors.technological },
            { domain: 'Legal', claims: pestleFactors.legal },
            { domain: 'Environmental', claims: pestleFactors.environmental }
        ];
        for (const { domain: d, claims } of allClaims) {
            if (claims.length > 0) {
                prompt += `## ${d}\n`;
                for (const claim of claims) {
                    prompt += `- ${claim.claim} (${claim.timeHorizon})`;
                    if (claim.rationale) {
                        prompt += `\n  Rationale: ${claim.rationale}`;
                    }
                    prompt += '\n';
                }
                prompt += '\n';
            }
        }
        // Add assumption comparison results
        if (comparisons.length > 0) {
            prompt += `# Assumption Validation\n\n`;
            const validated = comparisons.filter(c => c.relationship === 'validates');
            const contradicted = comparisons.filter(c => c.relationship === 'contradicts');
            if (validated.length > 0) {
                prompt += `## Validated Assumptions (${validated.length})\n`;
                for (const comp of validated.slice(0, 5)) {
                    prompt += `- "${comp.assumption}"\n`;
                    if (comp.relatedClaims.length > 0) {
                        const topClaim = comp.relatedClaims[0];
                        prompt += `  Supporting Evidence: ${topClaim.evidence}\n`;
                    }
                }
                prompt += '\n';
            }
            if (contradicted.length > 0) {
                prompt += `## Contradicted Assumptions (${contradicted.length})\n`;
                for (const comp of contradicted.slice(0, 5)) {
                    prompt += `- "${comp.assumption}"\n`;
                    if (comp.relatedClaims.length > 0) {
                        const topClaim = comp.relatedClaims[0];
                        prompt += `  Contradicting Evidence: ${topClaim.evidence}\n`;
                    }
                }
                prompt += '\n';
            }
        }
        prompt += `\nBased on this analysis, provide a strategic synthesis with:
1. Executive summary of key macro-environmental factors
2. Key findings from the PESTLE analysis
3. Strategic implications for the business
4. Recommended actions (3-5 specific, actionable items)
5. Risk areas that need attention
6. Opportunities to capitalize on

Focus on actionable insights that can inform strategic planning and decision-making.`;
        return prompt;
    }
    /**
     * Parse synthesis response
     */
    parseSynthesisResponse(text) {
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
            return {
                executiveSummary: parsed.executiveSummary || '',
                keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
                strategicImplications: Array.isArray(parsed.strategicImplications) ? parsed.strategicImplications : [],
                recommendedActions: Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : [],
                riskAreas: Array.isArray(parsed.riskAreas) ? parsed.riskAreas : [],
                opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : []
            };
        }
        catch (error) {
            console.error('[TrendSynthesis] Error parsing synthesis:', error);
            console.error('Raw text:', text);
            throw new Error('Failed to parse synthesis response');
        }
    }
    /**
     * Create initial telemetry object
     */
    createTelemetry() {
        return {
            totalLatencyMs: 0,
            llmCalls: 0,
            totalTokens: 0,
            cacheHits: 0,
            apiCalls: 0,
            retries: 0,
            providerUsage: {
                openai: 0,
                anthropic: 0,
                gemini: 0
            }
        };
    }
    /**
     * Track LLM call in telemetry
     */
    trackLLMCall(telemetry, provider, tokens) {
        telemetry.llmCalls++;
        if (tokens) {
            telemetry.totalTokens += tokens;
        }
        // Validate and track provider usage
        const validProviders = ['openai', 'anthropic', 'gemini'];
        if (validProviders.includes(provider)) {
            telemetry.providerUsage[provider]++;
        }
        else {
            console.warn(`[TrendSynthesis] Unknown provider: ${provider}`);
        }
    }
    /**
     * Track API call in telemetry
     */
    trackAPICall(telemetry) {
        telemetry.apiCalls++;
    }
    /**
     * Track cache hit in telemetry
     */
    trackCacheHit(telemetry) {
        telemetry.cacheHits++;
    }
    /**
     * Track retry in telemetry
     */
    trackRetry(telemetry) {
        telemetry.retries++;
    }
    /**
     * Add latency to total in telemetry (accumulates)
     */
    addLatency(telemetry, latencyMs) {
        telemetry.totalLatencyMs += latencyMs;
    }
}
// Export singleton instance
export const trendSynthesisService = new TrendSynthesisService();
//# sourceMappingURL=trend-synthesis-service.js.map