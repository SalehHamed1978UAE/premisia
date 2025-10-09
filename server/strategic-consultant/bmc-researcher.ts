import Anthropic from '@anthropic-ai/sdk';
import { BMCQueryGenerator, type BMCQuery, type BMCBlockType } from './bmc-query-generator';
import { MarketResearcher, type Finding, type Source } from './market-researcher';

export interface BMCBlockFindings {
  blockType: BMCBlockType;
  blockName: string;
  description: string;
  findings: Finding[];
  confidence: 'weak' | 'moderate' | 'strong';
  strategicImplications: string;
  gaps: string[];
  researchQueries: string[];
}

export interface BMCResearchResult {
  blocks: BMCBlockFindings[];
  sources: Source[];
  overallConfidence: number;
}

export class BMCResearcher {
  private queryGenerator: BMCQueryGenerator;
  private marketResearcher: MarketResearcher;
  private anthropic: Anthropic;

  constructor() {
    this.queryGenerator = new BMCQueryGenerator();
    this.marketResearcher = new MarketResearcher();
    
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  async conductBMCResearch(input: string): Promise<BMCResearchResult> {
    const querySet = await this.queryGenerator.generateQueriesForAllBlocks(input);

    const allQueries = [
      ...querySet.customer_segments,
      ...querySet.value_propositions,
      ...querySet.revenue_streams,
    ];

    const searchResults = await this.performParallelWebSearch(allQueries);
    
    const allSources = this.extractUniqueSources(searchResults);
    const topSources = allSources.slice(0, 10);
    
    const sourceContents = await this.marketResearcher.fetchSourceContentPublic(
      topSources.slice(0, 3)
    );

    const [customerBlock, valueBlock, revenueBlock] = await Promise.all([
      this.synthesizeBlock(
        'customer_segments',
        'Customer Segments',
        querySet.customer_segments,
        searchResults.filter(r => 
          querySet.customer_segments.some(q => q.query === r.query)
        ),
        sourceContents,
        input
      ),
      this.synthesizeBlock(
        'value_propositions',
        'Value Propositions',
        querySet.value_propositions,
        searchResults.filter(r => 
          querySet.value_propositions.some(q => q.query === r.query)
        ),
        sourceContents,
        input
      ),
      this.synthesizeBlock(
        'revenue_streams',
        'Revenue Streams',
        querySet.revenue_streams,
        searchResults.filter(r => 
          querySet.revenue_streams.some(q => q.query === r.query)
        ),
        sourceContents,
        input
      ),
    ]);

    const blocks = [customerBlock, valueBlock, revenueBlock];
    const overallConfidence = this.calculateOverallConfidence(blocks);

    return {
      blocks,
      sources: topSources,
      overallConfidence,
    };
  }

  private async performParallelWebSearch(queries: BMCQuery[]): Promise<any[]> {
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
          return { query: queryObj.query, results: [] };
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

  private extractUniqueSources(searchResults: any[]): Source[] {
    const sourceMap = new Map<string, Source>();
    
    for (const searchResult of searchResults) {
      if (searchResult.results && Array.isArray(searchResult.results)) {
        for (const result of searchResult.results) {
          if (!sourceMap.has(result.url)) {
            sourceMap.set(result.url, {
              url: result.url,
              title: result.title,
              relevance_score: result.relevance || 0.5,
            });
          }
        }
      }
    }

    const sources = Array.from(sourceMap.values());
    sources.sort((a, b) => b.relevance_score - a.relevance_score);
    
    return sources;
  }

  private async synthesizeBlock(
    blockType: BMCBlockType,
    blockName: string,
    queries: BMCQuery[],
    searchResults: any[],
    sourceContents: Map<string, string>,
    originalInput: string
  ): Promise<BMCBlockFindings> {
    const searchSummary = searchResults.map(sr => 
      `Query: ${sr.query}\nResults: ${sr.results?.map((r: any) => `- ${r.title}: ${r.snippet}`).join('\n') || 'No results'}`
    ).join('\n\n');

    const fullContentSummary = Array.from(sourceContents.entries())
      .map(([url, content]) => `URL: ${url}\nContent: ${content.substring(0, 1500)}...`)
      .join('\n\n---\n\n');

    const blockContext = {
      customer_segments: {
        focus: 'WHO the target customers are, their characteristics, needs, and pain points',
        outputGuidance: 'Describe the target customer segments based on research evidence',
      },
      value_propositions: {
        focus: 'WHAT value solves customer problems and how it differentiates from alternatives',
        outputGuidance: 'Describe the key value propositions based on market research',
      },
      revenue_streams: {
        focus: 'HOW the business generates revenue and monetizes value',
        outputGuidance: 'Describe revenue models and pricing strategies based on research',
      },
    };

    const context = blockContext[blockType];

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are a Business Model Canvas analyst synthesizing research for the "${blockName}" block.

BLOCK FOCUS: ${context.focus}

ORIGINAL INPUT:
${originalInput.substring(0, 1500)}

RESEARCH QUERIES USED:
${queries.map(q => `- ${q.query} (${q.type})`).join('\n')}

SEARCH RESULTS:
${searchSummary}

FULL CONTENT FROM TOP SOURCES:
${fullContentSummary}

Based on the research above, synthesize findings for the ${blockName} block.

${context.outputGuidance}

Return ONLY valid JSON (no markdown, no explanation):

{
  "description": "2-3 sentence summary of this BMC block based on research evidence",
  "findings": [
    {
      "fact": "Specific insight from research about ${context.focus}",
      "citation": "https://source-url.com",
      "confidence": "high|medium|low"
    }
  ],
  "confidence": "weak|moderate|strong",
  "strategicImplications": "1-2 sentences on strategic implications for this block",
  "gaps": ["identified gap 1", "identified gap 2"],
  "researchQueries": ${JSON.stringify(queries.map(q => q.query))}
}

Include 3-6 findings. Set confidence to:
- "strong" if multiple high-quality sources confirm insights
- "moderate" if some sources support insights
- "weak" if limited or uncertain evidence`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Failed to extract JSON from ${blockType} synthesis`);
    }

    const synthesized = JSON.parse(jsonMatch[0]);

    return {
      blockType,
      blockName,
      description: synthesized.description || '',
      findings: synthesized.findings || [],
      confidence: synthesized.confidence || 'weak',
      strategicImplications: synthesized.strategicImplications || '',
      gaps: synthesized.gaps || [],
      researchQueries: synthesized.researchQueries || [],
    };
  }

  private calculateOverallConfidence(blocks: BMCBlockFindings[]): number {
    const confidenceMap = { weak: 0.3, moderate: 0.6, strong: 0.9 };
    const scores = blocks.map(b => confidenceMap[b.confidence]);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return Math.round(average * 100) / 100;
  }
}
