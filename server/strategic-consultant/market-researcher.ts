import Anthropic from '@anthropic-ai/sdk';
import { SourceValidator, type ValidationResult } from './source-validator';

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
  validation?: ValidationResult[];
}

export interface ResearchQuery {
  query: string;
  purpose: string;
}

export class MarketResearcher {
  private anthropic: Anthropic;
  private validator: SourceValidator;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
    this.validator = new SourceValidator();
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

    const allFindings = [
      ...findings.market_dynamics,
      ...findings.competitive_landscape,
      ...findings.language_preferences,
      ...findings.buyer_behavior,
      ...findings.regulatory_factors,
    ];

    const validation = await this.validator.validateFindings(allFindings, findings.sources);

    return {
      ...findings,
      validation,
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

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: `You are a critical market research specialist creating UNBIASED search queries for strategic analysis.

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
- {"query": "successful English-only enterprise software UAE", "purpose": "test if Arabic is necessary", "type": "challenging"}`,
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

  async performSingleWebSearch(query: ResearchQuery): Promise<any> {
    try {
      const response = await fetch('http://localhost:5000/api/web-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.query }),
      });

      if (!response.ok) {
        console.error(`Search failed for query "${query.query}": ${response.status}`);
        return { query: query.query, results: [] };
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
      return { query: query.query, results: [] };
    }
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

  selectTopSourcesPublic(searchResults: any[]): Source[] {
    return this.selectTopSources(searchResults);
  }

  async fetchSourceContentPublic(sources: Source[]): Promise<Map<string, string>> {
    return this.fetchSourceContent(sources);
  }

  async synthesizeFindingsPublic(
    rootCause: string,
    input: string,
    whysPath: string[],
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
          content: `You are an OBJECTIVE market research analyst synthesizing findings for a business strategy.

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
${whysPath.map((w, i) => `${i + 1}. ${w}`).join('\n')}

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
