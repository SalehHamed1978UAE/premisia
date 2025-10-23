/**
 * Market Research Engine
 * Reusable market research logic extracted from MarketResearcher
 * Framework-agnostic: can be used by any strategic framework in the journey
 */

import { aiClients } from '../ai-clients';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

export interface ResearchContext {
  topic: string;                    // What we're researching
  background: string;               // User input or context
  specificQuestions?: string[];     // Specific questions to answer
  avoidBias?: boolean;              // Whether to generate challenging queries
}

export interface ResearchQuery {
  query: string;
  purpose: string;
  type: 'baseline' | 'validating' | 'challenging';
}

export interface ResearchFinding {
  fact: string;
  citation: string;
  confidence: 'high' | 'medium' | 'low';
  isContradictory?: boolean;
}

export interface ResearchResults {
  findings: ResearchFinding[];
  sources: { url: string; title: string; relevance_score: number }[];
  queries: ResearchQuery[];
}

/**
 * Market Research Engine
 * Provides reusable market research capabilities for journey frameworks
 */
export class MarketResearchEngine {
  /**
   * Conduct comprehensive market research
   */
  async conductResearch(context: ResearchContext): Promise<ResearchResults> {
    const queries = await this.generateQueries(context);
    const searchResults = await this.performSearches(queries);
    const topSources = this.selectTopSources(searchResults);
    const sourceContents = await this.fetchSourceContent(topSources.slice(0, 3));
    const findings = await this.synthesizeFindings(context, searchResults, topSources, sourceContents);

    return {
      findings,
      sources: topSources,
      queries,
    };
  }

  /**
   * Generate research queries based on context
   */
  private async generateQueries(context: ResearchContext): Promise<ResearchQuery[]> {
    const systemPrompt = `You are a critical market research specialist. Return ONLY valid JSON (no markdown, no explanation).`;
    
    const userMessage = `Create UNBIASED search queries for strategic analysis.

${context.avoidBias !== false ? `CRITICAL: Avoid confirmation bias. For ANY claim or assumption in the input, generate queries that BOTH validate AND challenge it.` : ''}

TOPIC:
${context.topic}

BACKGROUND:
${context.background.substring(0, 1500)}

${context.specificQuestions ? `SPECIFIC QUESTIONS TO ANSWER:\n${context.specificQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}` : ''}

Generate 6-8 targeted research queries following this structure:

1. BASELINE QUERIES (2-3 queries): General market/industry context
2. VALIDATING QUERIES (2 queries): Search for evidence that SUPPORTS any claims in the background
${context.avoidBias !== false ? `3. CHALLENGING QUERIES (2-3 queries): Search for evidence that CONTRADICTS or questions the background assumptions` : ''}

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
}`;

    const response = await aiClients.callWithFallback({
      systemPrompt,
      userMessage,
      maxTokens: 1500,
    });

    let queries: ResearchQuery[];
    try {
      const parsed = JSON.parse(response.content);
      queries = parsed.queries || [];
    } catch {
      queries = [];
    }

    return queries;
  }

  /**
   * Perform web searches for all queries
   */
  private async performSearches(queries: ResearchQuery[]): Promise<any[]> {
    const results = await Promise.all(
      queries.map(async (query) => {
        try {
          const response = await fetch(`${API_BASE}/api/web-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query.query }),
          });

          if (!response.ok) {
            console.error(`Search failed for query "${query.query}": ${response.status}`);
            return { query: query.query, results: [] };
          }

          const data = await response.json();
          const searchResults = (data.organic || []).map((result: any) => ({
            url: result.link,
            title: result.title,
            snippet: result.snippet || '',
            relevance: result.position ? 1 / result.position : 0.5,
          }));

          return { query: query.query, results: searchResults };
        } catch (error) {
          console.error(`Error searching for "${query.query}":`, error);
          return { query: query.query, results: [] };
        }
      })
    );

    return results;
  }

  /**
   * Select top sources from search results
   */
  private selectTopSources(searchResults: any[]): { url: string; title: string; relevance_score: number }[] {
    const allResults: { url: string; title: string; relevance_score: number }[] = [];
    
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
    return allResults.slice(0, 6);
  }

  /**
   * Fetch content from source URLs
   */
  private async fetchSourceContent(sources: { url: string }[]): Promise<Map<string, string>> {
    const contentMap = new Map<string, string>();
    
    for (const source of sources) {
      try {
        const response = await fetch(`${API_BASE}/api/web-fetch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: source.url }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.content || '';
          const cleanedContent = content
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          contentMap.set(source.url, cleanedContent);
        }
      } catch (error) {
        console.error(`Error fetching content from ${source.url}:`, error);
      }
    }

    return contentMap;
  }

  /**
   * Synthesize findings from research
   */
  private async synthesizeFindings(
    context: ResearchContext,
    searchResults: any[],
    topSources: { url: string; title: string; relevance_score: number }[],
    sourceContents: Map<string, string>
  ): Promise<ResearchFinding[]> {
    const searchSummary = searchResults.map(sr => 
      `Query: ${sr.query}\nResults: ${sr.results?.map((r: any) => `- ${r.title}: ${r.snippet}`).join('\n') || 'No results'}`
    ).join('\n\n');

    const fullContentSummary = Array.from(sourceContents.entries())
      .map(([url, content]) => `URL: ${url}\nContent Excerpt: ${content.substring(0, 2000)}...`)
      .join('\n\n---\n\n');

    const systemPrompt = `You are an OBJECTIVE market research analyst. Return ONLY valid JSON (no markdown, no explanation).`;
    
    const userMessage = `Synthesize research findings for a business strategy.

CRITICAL INSTRUCTIONS:
1. Every statement MUST cite a specific research finding from the full article content below
2. DO NOT make assumptions or use general knowledge
3. PRIORITIZE contradictory findings over confirming evidence
4. If research contradicts background assumptions, HIGHLIGHT that contradiction clearly
5. Only include facts that are explicitly stated in the source content

TOPIC:
${context.topic}

BACKGROUND:
${context.background.substring(0, 1500)}

SEARCH RESULTS SNIPPETS:
${searchSummary}

FULL ARTICLE CONTENT:
${fullContentSummary}

TOP SOURCES:
${topSources.map(s => `- ${s.title} (${s.url}) - Relevance: ${s.relevance_score}`).join('\n')}

Based on the FULL ARTICLE CONTENT above, generate findings. Each finding must:
- fact: Quote or paraphrase a SPECIFIC statement from the full content. If it CONTRADICTS the background, state that clearly.
- citation: The exact source URL where this fact was found
- confidence: 'high' if from article content, 'medium' if from snippets, 'low' if uncertain
- isContradictory: true if this finding contradicts an assumption in the background

Return ONLY valid JSON with this structure:

{
  "findings": [
    {
      "fact": "specific fact from source",
      "citation": "https://source-url.com",
      "confidence": "high|medium|low",
      "isContradictory": true|false
    }
  ]
}`;

    const response = await aiClients.callWithFallback({
      systemPrompt,
      userMessage,
      maxTokens: 2000,
    });

    let findings: ResearchFinding[];
    try {
      const parsed = JSON.parse(response.content);
      findings = parsed.findings || [];
    } catch {
      findings = [];
    }

    return findings;
  }
}
