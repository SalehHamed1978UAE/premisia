import { authorityRegistryService } from './authority-registry-service.ts';
import { aiClients } from './ai-clients.ts';
import { translationService } from './translation-service.ts';
class EvidenceExtractionService {
    /**
     * Stage 1: Extract overview from document
     */
    async extractOverview(document) {
        const prompt = `You are analyzing a document to extract a high-level overview.

Document URL: ${document.url}
Publisher: ${document.publisher}
${document.title ? `Title: ${document.title}` : ''}

Document Content:
${document.content.slice(0, 8000)} ${document.content.length > 8000 ? '...[truncated]' : ''}

Extract:
1. A concise summary (2-3 sentences)
2. Key themes discussed in the document (3-5 themes)
3. Sections that contain factual claims or evidence (quote the section headings or first sentence)

Return your response as a JSON object with this structure:
{
  "summary": "...",
  "keyThemes": ["theme1", "theme2", ...],
  "relevantSections": ["section1", "section2", ...]
}`;
        const response = await aiClients.callWithFallback({
            systemPrompt: 'You are a document analysis expert. Extract structured information as JSON.',
            userMessage: prompt,
            maxTokens: 1000,
        });
        try {
            // Try to extract JSON from response
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            const overview = JSON.parse(jsonMatch[0]);
            return {
                summary: overview.summary || '',
                keyThemes: Array.isArray(overview.keyThemes) ? overview.keyThemes : [],
                relevantSections: Array.isArray(overview.relevantSections) ? overview.relevantSections : [],
            };
        }
        catch (error) {
            console.error('Failed to parse overview JSON:', error);
            return {
                summary: response.content.slice(0, 300),
                keyThemes: [],
                relevantSections: [],
            };
        }
    }
    /**
     * Stage 2: Extract evidence claims from document
     */
    async extractEvidenceClaims(document, overview) {
        const prompt = `You are extracting factual evidence claims from a document. Extract ONLY claims that are explicitly stated in the document - do NOT generate or infer facts.

Document URL: ${document.url}
Publisher: ${document.publisher}
${document.title ? `Title: ${document.title}` : ''}

Document Summary: ${overview.summary}

Key Themes: ${overview.keyThemes.join(', ')}

Relevant Sections:
${overview.relevantSections.join('\n')}

Full Document Content:
${document.content.slice(0, 10000)} ${document.content.length > 10000 ? '...[truncated]' : ''}

Extract factual claims with evidence. For each claim:
1. The claim must be EXPLICITLY stated in the document (no inference)
2. Quote the exact excerpt that supports the claim (20-100 words)
3. Focus on data, statistics, trends, forecasts, or expert statements

Return your response as a JSON array:
[
  {
    "claim": "Specific factual claim from the document",
    "excerpt": "Exact quote from document supporting this claim"
  },
  ...
]

Extract 3-8 claims. Return only the JSON array, no other text.`;
        const response = await aiClients.callWithFallback({
            systemPrompt: 'You are an evidence extraction expert. Extract only explicitly stated facts from documents as JSON.',
            userMessage: prompt,
            maxTokens: 2000,
        });
        try {
            // Try to extract JSON array from response
            const jsonMatch = response.content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found in response');
            }
            const claims = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(claims)) {
                throw new Error('Response is not an array');
            }
            return claims.filter(c => c.claim && c.excerpt).map(c => ({
                claim: c.claim,
                excerpt: c.excerpt,
            }));
        }
        catch (error) {
            console.error('Failed to parse evidence claims JSON:', error);
            return [];
        }
    }
    /**
     * Translate evidence if needed
     */
    async translateEvidence(claim, excerpt, sourceLanguage) {
        // Detect language if not provided
        let language = sourceLanguage;
        if (!language) {
            language = await translationService.detectLanguage(excerpt);
        }
        // If English or unknown, no translation needed
        if (language === 'en' || language === 'unknown') {
            return {
                translatedClaim: claim,
                translatedExcerpt: excerpt,
                isTranslated: false,
                detectedLanguage: language,
                isRTL: false,
            };
        }
        // Translate claim and excerpt to English
        try {
            const [claimResult, excerptResult] = await Promise.all([
                translationService.translate(claim, 'en'),
                translationService.translate(excerpt, 'en'),
            ]);
            return {
                translatedClaim: claimResult.translatedText,
                translatedExcerpt: excerptResult.translatedText,
                isTranslated: claimResult.wasTranslated || excerptResult.wasTranslated,
                detectedLanguage: claimResult.detectedLanguage,
                isRTL: claimResult.isRTL || excerptResult.isRTL,
            };
        }
        catch (error) {
            console.error('Translation failed, using original text:', error);
            return {
                translatedClaim: claim,
                translatedExcerpt: excerpt,
                isTranslated: false,
                detectedLanguage: language,
                isRTL: false,
            };
        }
    }
    /**
     * Extract evidence from a single document
     */
    async extractFromDocument(document) {
        // Stage 1: Extract overview
        const overview = await this.extractOverview(document);
        // Stage 2: Extract evidence claims
        const claims = await this.extractEvidenceClaims(document, overview);
        // Validate source against authority registry
        const sourceScore = await authorityRegistryService.scoreSource({
            publisher: document.publisher,
            countryISO: document.countryISO,
            industry: document.industry,
        });
        // Translate evidence if needed
        const evidence = [];
        for (const claim of claims) {
            const translation = await this.translateEvidence(claim.claim, claim.excerpt, document.language);
            evidence.push({
                claim: translation.translatedClaim,
                excerpt: translation.translatedExcerpt,
                originalExcerpt: translation.isTranslated ? claim.excerpt : undefined,
                source: {
                    url: document.url,
                    publisher: document.publisher,
                    title: document.title,
                    publishDate: document.publishDate,
                },
                authorityMatch: sourceScore.bestMatch,
                confidence: this.calculateConfidence(sourceScore.bestMatch),
                isTranslated: translation.isTranslated,
                originalLanguage: translation.detectedLanguage,
                isRTL: translation.isRTL,
            });
        }
        return evidence;
    }
    /**
     * Extract evidence from multiple documents
     */
    async extractFromDocuments(documents) {
        const allEvidence = [];
        for (const document of documents) {
            try {
                const evidence = await this.extractFromDocument(document);
                allEvidence.push(...evidence);
            }
            catch (error) {
                console.error(`Failed to extract evidence from ${document.url}:`, error);
            }
        }
        return allEvidence;
    }
    /**
     * Calculate confidence score based on authority match
     */
    calculateConfidence(authorityMatch) {
        if (!authorityMatch)
            return 0.3; // Low confidence for unmatched sources
        // Base confidence from match score
        let confidence = authorityMatch.matchScore * 0.5;
        // Tier bonus (tier 1 = +0.3, tier 2 = +0.2, tier 3 = +0.1)
        if (authorityMatch.tier === 1) {
            confidence += 0.3;
        }
        else if (authorityMatch.tier === 2) {
            confidence += 0.2;
        }
        else if (authorityMatch.tier === 3) {
            confidence += 0.1;
        }
        // Match type bonus
        if (authorityMatch.matchType === 'exact') {
            confidence += 0.2;
        }
        else if (authorityMatch.matchType === 'contains') {
            confidence += 0.1;
        }
        return Math.min(1, confidence);
    }
    /**
     * Calculate semantic similarity between two claims (0-1)
     */
    calculateClaimSimilarity(claim1, claim2) {
        const c1 = claim1.toLowerCase().trim();
        const c2 = claim2.toLowerCase().trim();
        // Exact match
        if (c1 === c2)
            return 1;
        // Token-based similarity (Jaccard coefficient)
        const tokens1 = new Set(c1.split(/\s+/));
        const tokens2 = new Set(c2.split(/\s+/));
        const intersection = new Set(Array.from(tokens1).filter(x => tokens2.has(x)));
        const union = new Set([...Array.from(tokens1), ...Array.from(tokens2)]);
        const jaccardSimilarity = intersection.size / union.size;
        // Substring similarity
        const substringScore = c1.includes(c2) || c2.includes(c1) ? 0.3 : 0;
        return Math.min(1, jaccardSimilarity + substringScore);
    }
    /**
     * Corroborate evidence across sources
     * Groups similar claims and identifies which are supported by 2+ sources
     */
    async corroborateEvidence(evidence) {
        const corroborated = [];
        const processed = new Set();
        for (let i = 0; i < evidence.length; i++) {
            if (processed.has(i))
                continue;
            const current = evidence[i];
            const similarClaims = [current];
            processed.add(i);
            // Find similar claims from different sources
            for (let j = i + 1; j < evidence.length; j++) {
                if (processed.has(j))
                    continue;
                const other = evidence[j];
                // Skip if same source
                if (other.source.url === current.source.url)
                    continue;
                // Check if claims are similar (threshold: 0.6)
                const similarity = this.calculateClaimSimilarity(current.claim, other.claim);
                if (similarity >= 0.6) {
                    similarClaims.push(other);
                    processed.add(j);
                }
            }
            // Count unique sources
            const uniqueSources = new Set(similarClaims.map(c => c.source.url));
            const corroborationCount = uniqueSources.size;
            // High authority (Tier 1) sources can stand alone
            const isHighAuthority = current.authorityMatch?.tier === 1;
            const isCorroborated = corroborationCount >= 2 || isHighAuthority;
            // Update confidence based on corroboration
            let finalConfidence = current.confidence;
            if (isCorroborated) {
                // Boost confidence for corroborated claims
                if (corroborationCount >= 3) {
                    finalConfidence = Math.min(1, finalConfidence + 0.2);
                }
                else if (corroborationCount === 2) {
                    finalConfidence = Math.min(1, finalConfidence + 0.1);
                }
            }
            else {
                // Reduce confidence for uncorroborated non-high-authority claims
                if (!isHighAuthority) {
                    finalConfidence = Math.max(0.3, finalConfidence - 0.2);
                }
            }
            // Add all claims with same corroboration metadata and confidence logic
            for (const claim of similarClaims) {
                // Calculate confidence adjustments for each claim
                let adjustedConfidence = claim.confidence;
                if (isCorroborated) {
                    // Boost confidence for corroborated claims
                    if (corroborationCount >= 3) {
                        adjustedConfidence = Math.min(1, adjustedConfidence + 0.2);
                    }
                    else if (corroborationCount === 2) {
                        adjustedConfidence = Math.min(1, adjustedConfidence + 0.1);
                    }
                }
                else {
                    // Reduce confidence for uncorroborated non-high-authority claims
                    const claimIsHighAuthority = claim.authorityMatch?.tier === 1;
                    if (!claimIsHighAuthority) {
                        adjustedConfidence = Math.max(0.3, adjustedConfidence - 0.2);
                    }
                }
                corroborated.push({
                    ...claim,
                    corroborationCount,
                    isCorroborated,
                    confidence: adjustedConfidence,
                });
            }
        }
        return corroborated;
    }
    /**
     * Score evidence confidence based on authority, corroboration, and other factors
     */
    scoreConfidence(evidence, allEvidence) {
        let score = evidence.confidence;
        // Factor in corroboration
        if (evidence.isCorroborated) {
            if (evidence.corroborationCount >= 3) {
                score = Math.min(1, score + 0.15);
            }
            else if (evidence.corroborationCount === 2) {
                score = Math.min(1, score + 0.1);
            }
        }
        // Penalize uncorroborated low-authority claims
        if (!evidence.isCorroborated && evidence.authorityMatch?.tier !== 1) {
            score = Math.max(0.2, score - 0.3);
        }
        // Bonus for translation from reputable source
        if (evidence.isTranslated && evidence.authorityMatch?.tier === 1) {
            score = Math.min(1, score + 0.05);
        }
        return Math.min(1, Math.max(0, score));
    }
}
export const evidenceExtractionService = new EvidenceExtractionService();
//# sourceMappingURL=evidence-extraction-service.js.map