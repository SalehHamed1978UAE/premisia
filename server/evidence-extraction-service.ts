import { authorityRegistryService } from './authority-registry-service.ts';
import { aiClients } from './ai-clients.ts';

export interface DocumentInput {
  url: string;
  content: string;
  publisher: string;
  title?: string;
  publishDate?: string;
  countryISO?: string;
  industry?: string;
  language?: string;
}

export interface ExtractedEvidence {
  claim: string;
  excerpt: string;
  source: {
    url: string;
    publisher: string;
    title?: string;
    publishDate?: string;
  };
  authorityMatch: {
    authorityId: string;
    name: string;
    tier: number;
    matchScore: number;
    matchType: 'exact' | 'contains' | 'fuzzy' | 'none';
  } | null;
  confidence: number;
  isTranslated: boolean;
  originalLanguage?: string;
  isRTL?: boolean;
}

interface DocumentOverview {
  summary: string;
  keyThemes: string[];
  relevantSections: string[];
}

class EvidenceExtractionService {
  /**
   * Stage 1: Extract overview from document
   */
  private async extractOverview(document: DocumentInput): Promise<DocumentOverview> {
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
    } catch (error) {
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
  private async extractEvidenceClaims(
    document: DocumentInput,
    overview: DocumentOverview
  ): Promise<Array<{ claim: string; excerpt: string }>> {
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
    } catch (error) {
      console.error('Failed to parse evidence claims JSON:', error);
      return [];
    }
  }

  /**
   * Extract evidence from a single document
   */
  async extractFromDocument(document: DocumentInput): Promise<ExtractedEvidence[]> {
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

    // Build evidence objects
    const evidence: ExtractedEvidence[] = claims.map(claim => ({
      claim: claim.claim,
      excerpt: claim.excerpt,
      source: {
        url: document.url,
        publisher: document.publisher,
        title: document.title,
        publishDate: document.publishDate,
      },
      authorityMatch: sourceScore.bestMatch,
      confidence: this.calculateConfidence(sourceScore.bestMatch),
      isTranslated: false, // Will be updated in Phase 3.4.2
      originalLanguage: document.language,
      isRTL: false, // Will be updated in Phase 3.4.2
    }));

    return evidence;
  }

  /**
   * Extract evidence from multiple documents
   */
  async extractFromDocuments(documents: DocumentInput[]): Promise<ExtractedEvidence[]> {
    const allEvidence: ExtractedEvidence[] = [];

    for (const document of documents) {
      try {
        const evidence = await this.extractFromDocument(document);
        allEvidence.push(...evidence);
      } catch (error) {
        console.error(`Failed to extract evidence from ${document.url}:`, error);
      }
    }

    return allEvidence;
  }

  /**
   * Calculate confidence score based on authority match
   */
  private calculateConfidence(authorityMatch: ExtractedEvidence['authorityMatch']): number {
    if (!authorityMatch) return 0.3; // Low confidence for unmatched sources

    // Base confidence from match score
    let confidence = authorityMatch.matchScore * 0.5;

    // Tier bonus (tier 1 = +0.3, tier 2 = +0.2, tier 3 = +0.1)
    if (authorityMatch.tier === 1) {
      confidence += 0.3;
    } else if (authorityMatch.tier === 2) {
      confidence += 0.2;
    } else if (authorityMatch.tier === 3) {
      confidence += 0.1;
    }

    // Match type bonus
    if (authorityMatch.matchType === 'exact') {
      confidence += 0.2;
    } else if (authorityMatch.matchType === 'contains') {
      confidence += 0.1;
    }

    return Math.min(1, confidence);
  }
}

export const evidenceExtractionService = new EvidenceExtractionService();
