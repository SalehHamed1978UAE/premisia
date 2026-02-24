import { SourceValidator, type ValidationResult } from './source-validator';
import { aiClients } from '../ai-clients';
import { parseAIJson } from '../utils/parse-ai-json';
import type { RawReference } from '../intelligence/types';
import { researchCaptureWrapper, type CaptureContext } from '../services/research-capture-wrapper.js';
import pLimit from 'p-limit';
import { whysPathToText } from '../utils/whys-path';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

const searchLimit = pLimit(3);
const fetchLimit = pLimit(3);

export interface Finding {
  fact: string;
  citation: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface Source {
  url: string;
  title: string;
  relevance_score: number;
  publication_date?: string | null;
}

export interface ResearchFindings {
  market_dynamics: Finding[];
  competitive_landscape: Finding[];
  language_preferences: Finding[];
  buyer_behavior: Finding[];
  regulatory_factors: Finding[];
  sources: Source[];
  references: RawReference[];
  validation?: ValidationResult[];
  researchQuality?: {
    status: 'sufficient' | 'degraded';
    reason: string;
    metrics: {
      totalQueries: number;
      failedQueries: number;
      emptyQueries: number;
      successfulQueries: number;
      failureRate: number;
      emptyRate: number;
      substantiveResultCount: number;
      findingsCount: number;
    };
  };
}

export interface ResearchQuery {
  query: string;
  purpose: string;
}

interface SearchResultRecord {
  query: string;
  results: any[];
  error?: string;
  statusCode?: number;
}

export class MarketResearcher {
  private validator: SourceValidator;

  constructor() {
    this.validator = new SourceValidator();
  }

  /**
   * Convert sources and findings to normalized references for provenance tracking
   */
  private convertToReferences(sources: Source[], findings: Finding[], category: string): RawReference[] {
    const references: RawReference[] = [];
    
    // Extract topics from findings
    const topics = new Set<string>();
    topics.add(category);
    topics.add('market research');
    
    // Map each source to a reference
    for (const source of sources) {
      const confidenceMap: Record<string, number> = {
        'high': 0.85,
        'medium': 0.65,
        'low': 0.45
      };
      
      // Find findings that cite this source
      const relatedFindings = findings.filter(f => f.citation === source.url);
      const avgConfidence = relatedFindings.length > 0
        ? relatedFindings.reduce((sum, f) => sum + (confidenceMap[f.confidence] || 0.5), 0) / relatedFindings.length
        : source.relevance_score || 0.5;
      
      // Extract topic keywords from findings
      relatedFindings.forEach(f => {
        const keywords = f.fact.toLowerCase();
        if (keywords.includes('market')) topics.add('market analysis');
        if (keywords.includes('competitive')) topics.add('competitive landscape');
        if (keywords.includes('regulatory')) topics.add('regulatory');
        if (keywords.includes('customer') || keywords.includes('buyer')) topics.add('customer behavior');
      });
      
      references.push({
        title: source.title,
        url: source.url,
        sourceType: 'article',
        description: relatedFindings.length > 0 ? relatedFindings[0].fact.substring(0, 200) : undefined,
        topics: Array.from(topics),
        confidence: Math.min(Math.max(avgConfidence, 0), 1),
        origin: 'web_search',
      });
    }
    
    return references;
  }

  async conductResearch(
    sessionId: string,
    rootCause: string,
    input: string,
    whysPath: any[],
    captureContext?: CaptureContext
  ): Promise<ResearchFindings> {
    const whysText = whysPathToText(whysPath);
    const queries = await this.generateResearchQueries(rootCause, input, whysText);
    
    const searchResultsWithStatus = await this.performWebSearch(queries, captureContext);
    const searchResults = searchResultsWithStatus.map((result) => ({
      query: result.query,
      results: result.results,
    }));

    const topSources = this.selectTopSources(searchResults);
    
    const sourceContents = await this.fetchSourceContent(topSources.slice(0, 3), captureContext);
    
    const findings = await this.synthesizeFindings(
      rootCause,
      input,
      whysText,
      searchResults,
      topSources,
      sourceContents
    );

    const allFindings = [
      ...findings.market_dynamics,
      ...findings.competitive_landscape,
      ...findings.language_preferences,
      ...findings.buyer_behavior,
      ...findings.regulatory_factors,
    ];
    const researchQuality = this.assessResearchQuality(searchResultsWithStatus, allFindings.length);
    if (researchQuality.status === 'degraded') {
      console.warn(`[MarketResearcher] ⚠️ Research quality degraded: ${researchQuality.reason}`);
      if (researchQuality.metrics.failureRate > 0.8) {
        throw new Error(`[MarketResearcher] Research ingestion failed: ${researchQuality.reason}`);
      }
    }

    const validation = await this.validator.validateFindings(allFindings, findings.sources);

    return {
      ...findings,
      validation,
      researchQuality,
    };
  }

  async generateResearchQueries(
    rootCause: string,
    input: string,
    whysPath: string[]
  ): Promise<ResearchQuery[]> {
    // Detect language and cultural differentiation keywords
    const mentionsLanguageDiff = /arabic|language|multilingual|localization|translation/i.test(input);
    const mentionsCulturalDiff = /cultural|culture|islamic|traditional|local customs|regional preferences/i.test(input);

    const systemPrompt = `You are a critical market research specialist. Return ONLY valid JSON (no markdown, no explanation).`;
    
    const userMessage = `Create UNBIASED search queries for strategic analysis.

CRITICAL: Avoid confirmation bias. For ANY claim or assumption in the input, generate queries that BOTH validate AND challenge it.

ROOT CAUSE IDENTIFIED:
${rootCause}

ORIGINAL INPUT:
${input.substring(0, 1500)}

ANALYSIS PATH:
${whysPath.map((w, i) => `${i + 1}. ${w}`).join('\n')}

Generate 6-8 targeted research queries following this structure:

1. BASELINE QUERIES (2-3 queries): General market/industry context
2. VALIDATING QUERIES (2 queries): Search for evidence that SUPPORTS any claims in the input
3. CHALLENGING QUERIES (2-3 queries): Search for evidence that CONTRADICTS or questions the input assumptions

For any differentiation claim (e.g., "Arabic language differentiation"):
- Validating query: "Arabic software demand UAE enterprises"
- Challenging query: "English vs Arabic UAE business language statistics"
- Alternative challenge: "successful English-only software UAE market"

Each query should:
- Be specific and actionable for web search
- Include current year (2025) where relevant for recent data
- Be concise (5-10 words)

Return ONLY valid JSON with this structure (no markdown, no explanation):

{
  "queries": [
    {
      "query": "specific search query text",
      "purpose": "what this query aims to discover",
      "type": "baseline|validating|challenging"
    }
  ]
}

Example for "Arabic language differentiates our enterprise software in UAE":
- {"query": "UAE enterprise software market 2025", "purpose": "market size and trends", "type": "baseline"}
- {"query": "Arabic enterprise software UAE demand", "purpose": "validate Arabic demand", "type": "validating"}
- {"query": "English vs Arabic UAE business language statistics", "purpose": "challenge language assumption", "type": "challenging"}
- {"query": "successful English-only enterprise software UAE", "purpose": "test if Arabic is necessary", "type": "challenging"}`;

    const response = await aiClients.callWithFallback({
      systemPrompt,
      userMessage,
      maxTokens: 2000,
    }, "anthropic");

    const textContent = response.content;

    const parsed = parseAIJson(textContent, 'market-researcher query generation');
    const queries = parsed.queries;

    // Add additional challenging queries based on keyword detection
    if (mentionsLanguageDiff) {
      // Extract market/region from input (simple extraction)
      const marketMatch = input.match(/\b(UAE|Saudi|Qatar|Kuwait|Bahrain|MENA|Middle East|GCC)\b/i);
      const market = marketMatch ? marketMatch[0] : 'UAE';
      
      queries.push({
        query: `English vs Arabic ${market} business language statistics`,
        purpose: 'Challenge language differentiation assumption with data',
        type: 'challenging'
      });
      
      queries.push({
        query: `successful English-only software ${market} market`,
        purpose: 'Test if language localization is necessary for success',
        type: 'challenging'
      });
    }

    if (mentionsCulturalDiff) {
      const marketMatch = input.match(/\b(UAE|Saudi|Qatar|Kuwait|Bahrain|MENA|Middle East|GCC)\b/i);
      const market = marketMatch ? marketMatch[0] : 'UAE';
      
      queries.push({
        query: `${market} enterprise software buyer preferences data`,
        purpose: 'Get actual buyer behavior data vs cultural assumptions',
        type: 'challenging'
      });
      
      queries.push({
        query: `multinational company software standards ${market}`,
        purpose: 'Test if global standards override local cultural preferences',
        type: 'challenging'
      });
    }

    return queries;
  }

  async performSingleWebSearch(query: ResearchQuery): Promise<SearchResultRecord> {
    try {
      const response = await fetch(`${API_BASE}/api/web-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.query }),
      });

      if (!response.ok) {
        console.error(`Search failed for query "${query.query}": ${response.status}`);
        return {
          query: query.query,
          results: [],
          error: `Search failed: ${response.status}`,
          statusCode: response.status,
        };
      }

      const data = await response.json();
      
      const results = (data.organic || []).map((result: any) => ({
        url: result.link,
        title: result.title,
        snippet: result.snippet || '',
        relevance: result.position ? 1 / result.position : 0.5,
      }));

      return { query: query.query, results };
    } catch (error) {
      console.error(`Error searching for "${query.query}":`, error);
      return {
        query: query.query,
        results: [],
        error: error instanceof Error ? error.message : 'search_failed',
      };
    }
  }

  private async performWebSearch(queries: ResearchQuery[], captureContext?: CaptureContext): Promise<SearchResultRecord[]> {
    console.log('[MarketResearcher] Starting batched web search with', queries.length, 'queries (limit: 3 concurrent)');
    const searchPromises = queries.map((queryObj) => searchLimit(async () => {
      const searchFn = async () => {
        const response = await fetch(`${API_BASE}/api/web-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: queryObj.query }),
        });

        if (!response.ok) {
          console.error(`Search failed for query "${queryObj.query}": ${response.status}`);
          return {
            organic: [],
            __statusCode: response.status,
          };
        }

        return await response.json();
      };

      // If capture context is provided, wrap with raw capture
      if (captureContext) {
        try {
          const { result: data } = await researchCaptureWrapper.captureWebSearch(
            queryObj.query,
            captureContext,
            searchFn
          );

          const results = (data.organic || []).map((result: any) => ({
            url: result.link,
            title: result.title,
            snippet: result.snippet || '',
            relevance: result.position ? 1 / result.position : 0.5,
          }));

          const statusCode = typeof (data as any).__statusCode === 'number'
            ? (data as any).__statusCode
            : undefined;
          const error = statusCode ? `Search failed: ${statusCode}` : undefined;
          return { query: queryObj.query, results, error, statusCode };
        } catch (error) {
          console.error(`Error searching for "${queryObj.query}":`, error);
          return {
            query: queryObj.query,
            results: [],
            error: error instanceof Error ? error.message : 'search_failed',
          };
        }
      } else {
        // Fallback to direct search without capture
        try {
          const data = await searchFn();
          const results = (data.organic || []).map((result: any) => ({
            url: result.link,
            title: result.title,
            snippet: result.snippet || '',
            relevance: result.position ? 1 / result.position : 0.5,
          }));

          const statusCode = typeof (data as any).__statusCode === 'number'
            ? (data as any).__statusCode
            : undefined;
          const error = statusCode ? `Search failed: ${statusCode}` : undefined;
          return { query: queryObj.query, results, error, statusCode };
        } catch (error) {
          console.error(`Error searching for "${queryObj.query}":`, error);
          return {
            query: queryObj.query,
            results: [],
            error: error instanceof Error ? error.message : 'search_failed',
          };
        }
      }
    }));

    return Promise.all(searchPromises);
  }

  private assessResearchQuality(
    searchResults: SearchResultRecord[],
    findingsCount: number
  ): ResearchFindings['researchQuality'] {
    const totalQueries = searchResults.length;
    const failedQueries = searchResults.filter((result) => !!result.error).length;
    const emptyQueries = searchResults.filter((result) => (result.results || []).length === 0).length;
    const substantiveResultCount = searchResults.reduce(
      (sum, result) => sum + ((result.results || []).length > 0 ? 1 : 0),
      0
    );
    const successfulQueries = Math.max(0, totalQueries - failedQueries);
    const failureRate = totalQueries > 0 ? failedQueries / totalQueries : 0;
    const emptyRate = totalQueries > 0 ? emptyQueries / totalQueries : 0;

    const degraded =
      totalQueries === 0 ||
      failureRate > 0.8 ||
      emptyRate > 0.8 ||
      findingsCount < 5;

    const reasons: string[] = [];
    if (totalQueries === 0) reasons.push('No research queries executed');
    if (failureRate > 0.8) reasons.push(`${failedQueries}/${totalQueries} queries failed`);
    if (emptyRate > 0.8) reasons.push(`${emptyQueries}/${totalQueries} queries returned no results`);
    if (findingsCount < 5) reasons.push(`Only ${findingsCount} findings were synthesized from research`);

    return {
      status: degraded ? 'degraded' : 'sufficient',
      reason: degraded ? reasons.join('; ') : 'Research coverage is sufficient',
      metrics: {
        totalQueries,
        failedQueries,
        emptyQueries,
        successfulQueries,
        failureRate,
        emptyRate,
        substantiveResultCount,
        findingsCount,
      },
    };
  }

  private async fetchSourceContent(sources: Source[], captureContext?: CaptureContext): Promise<Map<string, string>> {
    console.log('[MarketResearcher] Starting batched content fetch for', sources.length, 'sources (limit: 3 concurrent)');
    const contentMap = new Map<string, string>();
    
    const fetchPromises = sources.map((source) => fetchLimit(async () => {
      const fetchFn = async () => {
        const response = await fetch(`${API_BASE}/api/web-fetch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: source.url }),
        });

        if (!response.ok) {
          console.error(`Failed to fetch ${source.url}: ${response.status}`);
          return { content: '' };
        }

        return await response.json();
      };

      try {
        let data;
        
        // If capture context is provided, wrap with raw capture
        if (captureContext) {
          const captured = await researchCaptureWrapper.captureContentFetch(
            source.url,
            captureContext,
            fetchFn
          );
          data = captured.result;
        } else {
          data = await fetchFn();
        }
        
        if (data.metadata?.publicationDate) {
          source.publication_date = data.metadata.publicationDate;
        }
        
        const textContent = (data.content || '')
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 5000);

        contentMap.set(source.url, textContent);
      } catch (error) {
        console.error(`Error fetching content from ${source.url}:`, error);
      }
    }));

    await Promise.all(fetchPromises);
    return contentMap;
  }

  selectTopSourcesPublic(searchResults: any[]): Source[] {
    return this.selectTopSources(searchResults);
  }

  async fetchSourceContentPublic(sources: Source[]): Promise<Map<string, string>> {
    return this.fetchSourceContent(sources);
  }

  async synthesizeFindingsPublic(
    rootCause: string,
    input: string,
    whysPath: any[],
    searchResults: any[],
    topSources: Source[],
    sourceContents: Map<string, string>
  ): Promise<ResearchFindings> {
    return this.synthesizeFindings(rootCause, input, whysPath, searchResults, topSources, sourceContents);
  }

  async validateFindingsPublic(allFindings: Finding[], sources: Source[]): Promise<ValidationResult[]> {
    return await this.validator.validateFindings(allFindings, sources);
  }

  private selectTopSources(searchResults: any[]): Source[] {
    const allResults: Source[] = [];
    
    for (const searchResult of searchResults) {
      if (searchResult.results && Array.isArray(searchResult.results)) {
        for (const result of searchResult.results) {
          allResults.push({
            url: result.url,
            title: result.title,
            relevance_score: result.relevance || 0.5,
          });
        }
      }
    }

    allResults.sort((a, b) => b.relevance_score - a.relevance_score);

    const topSources = allResults.slice(0, 6);
    
    return topSources;
  }

  private async synthesizeFindings(
    rootCause: string,
    input: string,
    whysPath: any[],
    searchResults: any[],
    topSources: Source[],
    sourceContents: Map<string, string>
  ): Promise<ResearchFindings> {
    const whysText = whysPathToText(whysPath);
    const searchSummary = searchResults.map(sr => 
      `Query: ${sr.query}\nResults: ${sr.results?.map((r: any) => `- ${r.title}: ${r.snippet}`).join('\n') || 'No results'}`
    ).join('\n\n');

    const fullContentSummary = Array.from(sourceContents.entries())
      .map(([url, content]) => `URL: ${url}\nContent Excerpt: ${content.substring(0, 2000)}...`)
      .join('\n\n---\n\n');

    const systemPrompt = `You are an OBJECTIVE market research analyst. Return ONLY valid JSON (no markdown, no explanation).`;
    
    const userMessage = `Synthesize findings for a business strategy.

CRITICAL INSTRUCTIONS - ANTI-CONFIRMATION BIAS:
1. Every statement MUST cite a specific research finding from the full article content below
2. DO NOT make assumptions or use general knowledge
3. PRIORITIZE contradictory findings over confirming evidence
4. If research contradicts input assumptions, HIGHLIGHT that contradiction clearly
5. Weight disconfirming evidence HIGHER than confirming evidence
6. Only include facts that are explicitly stated in the source content
7. If sources lack information on a category, return fewer findings for that category

ANTI-BIAS EXAMPLE:
If input claims "Arabic differentiation" but research shows "English dominates UAE business (95% of contracts)", 
you MUST include the English dominance finding and give it HIGH confidence.

ROOT CAUSE:
${rootCause}

ORIGINAL INPUT:
${input.substring(0, 1500)}

ANALYSIS PATH:
${whysText.map((w, i) => `${i + 1}. ${w}`).join('\n')}

SEARCH RESULTS SNIPPETS:
${searchSummary}

FULL ARTICLE CONTENT:
${fullContentSummary}

TOP SOURCES:
${topSources.map(s => `- ${s.title} (${s.url}) - Relevance: ${s.relevance_score}`).join('\n')}

Based on the FULL ARTICLE CONTENT above, generate findings across 5 categories. Each finding must:
- fact: Quote or paraphrase a SPECIFIC statement from the full content. If it CONTRADICTS the input, state that clearly.
- citation: The exact source URL where this fact was found
- confidence: 'high' if from article content, 'medium' if from snippets, 'low' if uncertain

PRIORITIZATION RULE: If research contradicts any claim in the input, include those contradictory findings FIRST and with HIGHEST confidence.

Generate findings ONLY for information explicitly found in sources:
1. Market Dynamics (market size, growth, trends)
2. Competitive Landscape (key players, positioning, market share)
3. Language/Cultural Preferences (business language, localization needs - INCLUDE contradictions to input claims)
4. Buyer Behavior (decision patterns, preferences, pain points)
5. Regulatory/Compliance Factors (regulations, standards, requirements)

Return ONLY valid JSON (no markdown, no explanation):

{
  "market_dynamics": [
    {
      "fact": "Specific market insight from article content",
      "citation": "https://source-url-from-top-sources.com",
      "confidence": "high"
    }
  ],
  "competitive_landscape": [
    {
      "fact": "Specific competitive insight from article content",
      "citation": "https://source-url-from-top-sources.com",
      "confidence": "high"
    }
  ],
  "language_preferences": [
    {
      "fact": "Specific language/cultural insight from article content (include contradictions to input)",
      "citation": "https://source-url-from-top-sources.com",
      "confidence": "high"
    }
  ],
  "buyer_behavior": [
    {
      "fact": "Specific buyer behavior insight from article content",
      "citation": "https://source-url-from-top-sources.com",
      "confidence": "high"
    }
  ],
  "regulatory_factors": [
    {
      "fact": "Specific regulatory insight from article content",
      "citation": "https://source-url-from-top-sources.com",
      "confidence": "high"
    }
  ]
}`;

    const response = await aiClients.callWithFallback({
      systemPrompt,
      userMessage,
      maxTokens: 4000,
    }, "anthropic");

    const textContent = response.content;

    const synthesized = parseAIJson(textContent, 'market-researcher synthesis');

    const allFindings: Finding[] = [
      ...(synthesized.market_dynamics || []),
      ...(synthesized.competitive_landscape || []),
      ...(synthesized.language_preferences || []),
      ...(synthesized.buyer_behavior || []),
      ...(synthesized.regulatory_factors || []),
    ];

    const references = this.convertToReferences(topSources, allFindings, 'strategic research');

    return {
      market_dynamics: synthesized.market_dynamics || [],
      competitive_landscape: synthesized.competitive_landscape || [],
      language_preferences: synthesized.language_preferences || [],
      buyer_behavior: synthesized.buyer_behavior || [],
      regulatory_factors: synthesized.regulatory_factors || [],
      sources: topSources,
      references,
    };
  }
}
