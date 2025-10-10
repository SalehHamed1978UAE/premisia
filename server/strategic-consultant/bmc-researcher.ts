import Anthropic from '@anthropic-ai/sdk';
import { BMCQueryGenerator, type BMCQuery, type BMCBlockType } from './bmc-query-generator';
import { MarketResearcher, type Finding, type Source } from './market-researcher';
import { AssumptionExtractor, type Assumption } from './assumption-extractor';
import { AssumptionValidator, type Contradiction } from './assumption-validator';

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
  viability: string;
  keyInsights: string[];
  criticalGaps: string[];
  consistencyChecks: any[];
  recommendations: any[];
  assumptions?: Assumption[];
  contradictions?: Contradiction[];
}

export class BMCResearcher {
  private queryGenerator: BMCQueryGenerator;
  private marketResearcher: MarketResearcher;
  private anthropic: Anthropic;
  private assumptionExtractor: AssumptionExtractor;
  private assumptionValidator: AssumptionValidator;

  constructor() {
    this.queryGenerator = new BMCQueryGenerator();
    this.marketResearcher = new MarketResearcher();
    this.assumptionExtractor = new AssumptionExtractor();
    this.assumptionValidator = new AssumptionValidator();
    
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  async conductBMCResearch(input: string): Promise<BMCResearchResult> {
    // Step 1: Extract assumptions from user input
    const { assumptions } = await this.assumptionExtractor.extractAssumptions(input);
    console.log(`Extracted ${assumptions.length} assumptions from input`);

    // Step 2: Generate BMC block queries
    const querySet = await this.queryGenerator.generateQueriesForAllBlocks(input);

    // Step 3: Generate assumption-specific queries
    const assumptionQueries = await this.assumptionValidator.generateAssumptionQueries(assumptions);
    console.log(`Generated ${assumptionQueries.length} assumption validation queries`);

    // Step 4: Combine all queries (BMC blocks + assumption validation)
    const allQueries: BMCQuery[] = [
      ...querySet.customer_segments,
      ...querySet.value_propositions,
      ...querySet.revenue_streams,
      ...assumptionQueries.map(aq => ({ 
        query: aq.query, 
        purpose: `Assumption check: ${aq.assumption}`,
        type: (aq.purpose === 'validate' ? 'validating' : 'challenging') as 'validating' | 'challenging' | 'baseline',
        blockType: 'customer_segments' as BMCBlockType // Assumption queries apply to all blocks
      })),
    ];

    const searchResults = await this.performParallelWebSearch(allQueries);
    
    const allSources = this.extractUniqueSources(searchResults);
    const topSources = allSources.slice(0, 10);
    
    const sourceContents = await this.marketResearcher.fetchSourceContentPublic(
      topSources.slice(0, 3)
    );

    // Step 5: CRITICAL FIX - Detect contradictions BEFORE block synthesis
    // Extract raw findings from search results to identify contradictions early
    const rawFindings = searchResults.flatMap(sr => 
      (sr.results || []).map((r: any) => `${r.title}: ${r.snippet}`)
    );
    const contradictionResult = await this.assumptionValidator.detectContradictions(
      assumptions,
      rawFindings
    );
    console.log(`Detected ${contradictionResult.contradictions.length} contradictions BEFORE block synthesis`);

    // Step 6: Synthesize blocks WITH contradiction awareness
    const [customerBlock, valueBlock, revenueBlock] = await Promise.all([
      this.synthesizeBlock(
        'customer_segments',
        'Customer Segments',
        querySet.customer_segments,
        searchResults.filter(r => 
          querySet.customer_segments.some(q => q.query === r.query)
        ),
        sourceContents,
        input,
        contradictionResult.contradictions
      ),
      this.synthesizeBlock(
        'value_propositions',
        'Value Propositions',
        querySet.value_propositions,
        searchResults.filter(r => 
          querySet.value_propositions.some(q => q.query === r.query)
        ),
        sourceContents,
        input,
        contradictionResult.contradictions
      ),
      this.synthesizeBlock(
        'revenue_streams',
        'Revenue Streams',
        querySet.revenue_streams,
        searchResults.filter(r => 
          querySet.revenue_streams.some(q => q.query === r.query)
        ),
        sourceContents,
        input,
        contradictionResult.contradictions
      ),
    ]);

    const blocks = [customerBlock, valueBlock, revenueBlock];
    const overallConfidence = this.calculateOverallConfidence(blocks);

    // Step 6: Synthesize overall BMC with contradiction awareness
    const synthesis = await this.synthesizeOverallBMC(blocks, input, contradictionResult.contradictions);

    return {
      blocks,
      sources: topSources,
      overallConfidence,
      viability: synthesis.viability,
      keyInsights: synthesis.keyInsights,
      criticalGaps: synthesis.criticalGaps,
      consistencyChecks: synthesis.consistencyChecks,
      recommendations: synthesis.recommendations,
      assumptions,
      contradictions: contradictionResult.contradictions,
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
    originalInput: string,
    contradictions: Contradiction[] = []
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

    // Build contradiction warning section
    const contradictionWarning = contradictions.length > 0
      ? `\n\n🚨 CRITICAL - CONTRADICTED ASSUMPTIONS:
Research has contradicted the following user assumptions. DO NOT validate these in your synthesis:

${contradictions.map(c => 
  `❌ "${c.assumption}" - Research shows: ${c.contradictedBy.slice(0, 2).join('; ')}`
).join('\n')}

IMPORTANT: If your findings relate to these contradicted assumptions, acknowledge the contradiction rather than validating the assumption.`
      : '';

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
${fullContentSummary}${contradictionWarning}

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

  async synthesizeOverallBMC(
    blocks: BMCBlockFindings[],
    originalInput: string,
    contradictions: Contradiction[] = []
  ): Promise<{
    viability: string;
    keyInsights: string[];
    criticalGaps: string[];
    consistencyChecks: any[];
    recommendations: any[];
  }> {
    const customerBlock = blocks.find(b => b.blockType === 'customer_segments');
    const valueBlock = blocks.find(b => b.blockType === 'value_propositions');
    const revenueBlock = blocks.find(b => b.blockType === 'revenue_streams');

    const blockSummary = blocks.map(b => 
      `${b.blockName} (${b.confidence} confidence):\n${b.description}\nGaps: ${b.gaps.join(', ') || 'None identified'}`
    ).join('\n\n');

    const contradictionSummary = contradictions.length > 0
      ? `\n\n🚨 CONTRADICTED ASSUMPTIONS:\n${contradictions.map(c => 
          `- "${c.assumption}" (${c.impact} impact${c.investmentAmount ? `, Investment: ${c.investmentAmount}` : ''})\n  Research found: ${c.contradictedBy.join('; ')}\n  Recommendation: ${c.recommendation}`
        ).join('\n')}`
      : '';

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are a Business Model Canvas expert conducting overall viability analysis.

ORIGINAL INPUT:
${originalInput.substring(0, 1500)}

RESEARCH FINDINGS FOR 3 BMC BLOCKS:
${blockSummary}${contradictionSummary}

Based on these findings, provide comprehensive BMC viability analysis:

1. **Cross-Block Consistency**: Do customer segments align with value propositions? Do value propositions support the revenue model?
2. **Overall Viability**: Can this business model work based on research evidence?
3. **Key Insights**: What are the most important strategic insights across all blocks?
4. **Critical Gaps**: What critical information is missing or uncertain? PRIORITIZE contradicted assumptions!
5. **Recommendations**: What should be prioritized or validated? ALWAYS flag contradicted assumptions as HIGH priority!

Return ONLY valid JSON (no markdown, no explanation):

{
  "viability": "strong|moderate|weak",
  "keyInsights": [
    "Cross-block insight 1 (2-3 sentences)",
    "Cross-block insight 2 (2-3 sentences)",
    "Cross-block insight 3 (2-3 sentences)"
  ],
  "criticalGaps": [
    "Critical gap 1",
    "Critical gap 2"
  ],
  "consistencyChecks": [
    {
      "aspect": "Customer-Value Alignment",
      "status": "aligned|misaligned|uncertain",
      "explanation": "Brief explanation of consistency"
    },
    {
      "aspect": "Value-Revenue Alignment",
      "status": "aligned|misaligned|uncertain",
      "explanation": "Brief explanation of consistency"
    }
  ],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "action": "Specific recommendation",
      "rationale": "Why this matters"
    }
  ]
}

Viability criteria:
- "strong": All blocks have moderate-strong confidence, good alignment, clear path to revenue
- "moderate": Some uncertainty but core model appears viable with validation
- "weak": Significant gaps, misalignment, or fundamental viability concerns`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from overall BMC synthesis');
    }

    const synthesized = JSON.parse(jsonMatch[0]);

    return {
      viability: synthesized.viability || 'weak',
      keyInsights: synthesized.keyInsights || [],
      criticalGaps: synthesized.criticalGaps || [],
      consistencyChecks: synthesized.consistencyChecks || [],
      recommendations: synthesized.recommendations || [],
    };
  }
}
