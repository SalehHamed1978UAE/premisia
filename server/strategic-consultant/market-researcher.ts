import Anthropic from '@anthropic-ai/sdk';

export interface Finding {
  fact: string;
  citation: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface Source {
  url: string;
  title: string;
  relevance_score: number;
}

export interface ResearchFindings {
  market_dynamics: Finding[];
  competitive_landscape: Finding[];
  language_preferences: Finding[];
  buyer_behavior: Finding[];
  regulatory_factors: Finding[];
  sources: Source[];
}

export interface ResearchQuery {
  query: string;
  purpose: string;
}

export class MarketResearcher {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  async conductResearch(
    sessionId: string,
    rootCause: string,
    input: string,
    whysPath: string[]
  ): Promise<ResearchFindings> {
    const queries = await this.generateResearchQueries(rootCause, input, whysPath);
    
    const searchResults = await this.simulateWebSearch(queries, input, rootCause, whysPath);
    
    const topSources = this.selectTopSources(searchResults);
    
    const findings = await this.synthesizeFindings(
      rootCause,
      input,
      whysPath,
      searchResults,
      topSources
    );

    return findings;
  }

  async generateResearchQueries(
    rootCause: string,
    input: string,
    whysPath: string[]
  ): Promise<ResearchQuery[]> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: `You are a market research specialist creating search queries for strategic analysis.

ROOT CAUSE IDENTIFIED:
${rootCause}

ORIGINAL INPUT:
${input.substring(0, 1500)}

ANALYSIS PATH:
${whysPath.map((w, i) => `${i + 1}. ${w}`).join('\n')}

Extract key elements from the input (market, industry, product type, competitors) and generate 4-5 targeted research queries. Each query should:
- Be specific and actionable for web search
- Focus on different aspects (market analysis, competition, preferences, strategy)
- Include current year (2025) where relevant for recent data
- Be concise (5-10 words)

Return ONLY valid JSON with this structure (no markdown, no explanation):

{
  "queries": [
    {
      "query": "specific search query text",
      "purpose": "what this query aims to discover"
    }
  ]
}

Example queries:
- "{market} {industry} market analysis 2025"
- "{product_type} competitive landscape {market}"
- "{market} business language preferences enterprise software"
- "{rootCause} strategy examples"
- "top {industry} companies {market} 2025"`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from query generation response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.queries;
  }

  private async simulateWebSearch(
    queries: ResearchQuery[],
    input: string,
    rootCause: string,
    whysPath: string[]
  ): Promise<any[]> {
    const searchPromises = queries.map(async (queryObj) => {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: `You are simulating a web search result for the query: "${queryObj.query}"

Based on your knowledge and the context below, generate realistic search results with:
- 3-5 relevant URLs (use realistic formats like company websites, industry reports, news sites)
- Brief snippets/descriptions for each
- Relevance scores (0.0-1.0)

CONTEXT:
Root Cause: ${rootCause}
Input: ${input.substring(0, 800)}
Analysis Path: ${whysPath.slice(0, 3).join(' → ')}

Return ONLY valid JSON (no markdown, no explanation):

{
  "query": "${queryObj.query}",
  "results": [
    {
      "url": "https://example.com/relevant-page",
      "title": "Page Title",
      "snippet": "Brief description or excerpt",
      "relevance": 0.85
    }
  ]
}`,
          },
        ],
      });

      const textContent = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as Anthropic.TextBlock).text)
        .join('\n');

      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { query: queryObj.query, results: [] };
    });

    return Promise.all(searchPromises);
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
    whysPath: string[],
    searchResults: any[],
    topSources: Source[]
  ): Promise<ResearchFindings> {
    const searchSummary = searchResults.map(sr => 
      `Query: ${sr.query}\nResults: ${sr.results?.map((r: any) => `- ${r.title}: ${r.snippet}`).join('\n') || 'No results'}`
    ).join('\n\n');

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are a strategic market research analyst synthesizing findings for a business strategy.

ROOT CAUSE:
${rootCause}

ORIGINAL INPUT:
${input.substring(0, 1500)}

ANALYSIS PATH:
${whysPath.map((w, i) => `${i + 1}. ${w}`).join('\n')}

RESEARCH DATA:
${searchSummary}

TOP SOURCES:
${topSources.map(s => `- ${s.title} (${s.url}) - Relevance: ${s.relevance_score}`).join('\n')}

Based on this research, generate comprehensive findings across 5 categories. Each finding must include:
- fact: A specific, actionable insight
- citation: The source URL from the top sources list above
- confidence: 'high', 'medium', or 'low' based on source quality

Generate:
1. Market Dynamics (3-5 findings about market size, growth, trends)
2. Competitive Landscape (3-5 findings about key players, positioning, market share)
3. Language/Cultural Preferences (2-4 findings about business language, localization needs)
4. Buyer Behavior (3-5 findings about decision patterns, preferences, pain points)
5. Regulatory/Compliance Factors (2-4 findings about regulations, standards, requirements)

Return ONLY valid JSON (no markdown, no explanation):

{
  "market_dynamics": [
    {
      "fact": "Specific market insight",
      "citation": "https://source-url-from-top-sources.com",
      "confidence": "high"
    }
  ],
  "competitive_landscape": [
    {
      "fact": "Specific competitive insight",
      "citation": "https://source-url-from-top-sources.com",
      "confidence": "medium"
    }
  ],
  "language_preferences": [
    {
      "fact": "Specific language/cultural insight",
      "citation": "https://source-url-from-top-sources.com",
      "confidence": "high"
    }
  ],
  "buyer_behavior": [
    {
      "fact": "Specific buyer behavior insight",
      "citation": "https://source-url-from-top-sources.com",
      "confidence": "medium"
    }
  ],
  "regulatory_factors": [
    {
      "fact": "Specific regulatory insight",
      "citation": "https://source-url-from-top-sources.com",
      "confidence": "high"
    }
  ]
}`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from synthesis response');
    }

    const synthesized = JSON.parse(jsonMatch[0]);

    return {
      market_dynamics: synthesized.market_dynamics || [],
      competitive_landscape: synthesized.competitive_landscape || [],
      language_preferences: synthesized.language_preferences || [],
      buyer_behavior: synthesized.buyer_behavior || [],
      regulatory_factors: synthesized.regulatory_factors || [],
      sources: topSources,
    };
  }
}
