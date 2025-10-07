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
    
    const searchResults = await this.performWebSearch(queries);
    
    const topSources = this.selectTopSources(searchResults);
    
    const sourceContents = await this.fetchSourceContent(topSources.slice(0, 3));
    
    const findings = await this.synthesizeFindings(
      rootCause,
      input,
      whysPath,
      searchResults,
      topSources,
      sourceContents
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

  private async performWebSearch(queries: ResearchQuery[]): Promise<any[]> {
    const searchPromises = queries.map(async (queryObj) => {
      try {
        const response = await fetch('http://localhost:5000/api/web-search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: queryObj.query }),
        });

        if (!response.ok) {
          console.error(`Search failed for query "${queryObj.query}": ${response.status}`);
          return { query: queryObj.query, organic: [] };
        }

        const data = await response.json();
        
        const results = (data.organic || []).map((result: any) => ({
          url: result.link,
          title: result.title,
          snippet: result.snippet || '',
          relevance: result.position ? 1 / result.position : 0.5,
        }));

        return { query: queryObj.query, results };
      } catch (error) {
        console.error(`Error searching for "${queryObj.query}":`, error);
        return { query: queryObj.query, results: [] };
      }
    });

    return Promise.all(searchPromises);
  }

  private async fetchSourceContent(sources: Source[]): Promise<Map<string, string>> {
    const contentMap = new Map<string, string>();
    
    const fetchPromises = sources.map(async (source) => {
      try {
        const response = await fetch('http://localhost:5000/api/web-fetch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: source.url }),
        });

        if (!response.ok) {
          console.error(`Failed to fetch ${source.url}: ${response.status}`);
          return;
        }

        const data = await response.json();
        
        const textContent = data.content
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
    });

    await Promise.all(fetchPromises);
    return contentMap;
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
    topSources: Source[],
    sourceContents: Map<string, string>
  ): Promise<ResearchFindings> {
    const searchSummary = searchResults.map(sr => 
      `Query: ${sr.query}\nResults: ${sr.results?.map((r: any) => `- ${r.title}: ${r.snippet}`).join('\n') || 'No results'}`
    ).join('\n\n');

    const fullContentSummary = Array.from(sourceContents.entries())
      .map(([url, content]) => `URL: ${url}\nContent Excerpt: ${content.substring(0, 2000)}...`)
      .join('\n\n---\n\n');

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are a strategic market research analyst synthesizing findings for a business strategy.

CRITICAL INSTRUCTIONS:
- Every statement MUST cite a specific research finding from the full article content below
- DO NOT make assumptions or use general knowledge
- Only include facts that are explicitly stated in the source content
- If sources lack information on a category, return fewer findings for that category

ROOT CAUSE:
${rootCause}

ORIGINAL INPUT:
${input.substring(0, 1500)}

ANALYSIS PATH:
${whysPath.map((w, i) => `${i + 1}. ${w}`).join('\n')}

SEARCH RESULTS SNIPPETS:
${searchSummary}

FULL ARTICLE CONTENT:
${fullContentSummary}

TOP SOURCES:
${topSources.map(s => `- ${s.title} (${s.url}) - Relevance: ${s.relevance_score}`).join('\n')}

Based on the FULL ARTICLE CONTENT above, generate findings across 5 categories. Each finding must:
- fact: Quote or paraphrase a SPECIFIC statement from the full content
- citation: The exact source URL where this fact was found
- confidence: 'high' if from article content, 'medium' if from snippets, 'low' if uncertain

Generate findings ONLY for information explicitly found in sources:
1. Market Dynamics (market size, growth, trends)
2. Competitive Landscape (key players, positioning, market share)
3. Language/Cultural Preferences (business language, localization needs)
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
      "fact": "Specific language/cultural insight from article content",
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
