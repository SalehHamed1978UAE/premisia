import Anthropic from '@anthropic-ai/sdk';

export type BMCBlockType = 'customer_segments' | 'value_propositions' | 'revenue_streams';

export interface BMCQuery {
  query: string;
  purpose: string;
  type: 'baseline' | 'validating' | 'challenging';
  blockType: BMCBlockType;
}

export interface BMCQuerySet {
  customer_segments: BMCQuery[];
  value_propositions: BMCQuery[];
  revenue_streams: BMCQuery[];
}

export class BMCQueryGenerator {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  async generateQueriesForAllBlocks(input: string): Promise<BMCQuerySet> {
    const [customerQueries, valueQueries, revenueQueries] = await Promise.all([
      this.generateBlockQueries('customer_segments', input),
      this.generateBlockQueries('value_propositions', input),
      this.generateBlockQueries('revenue_streams', input),
    ]);

    return {
      customer_segments: customerQueries,
      value_propositions: valueQueries,
      revenue_streams: revenueQueries,
    };
  }

  private async generateBlockQueries(
    blockType: BMCBlockType,
    input: string
  ): Promise<BMCQuery[]> {
    const blockPrompts = {
      customer_segments: {
        focus: 'Customer Segments - WHO are the target customers',
        examples: [
          'Market size and demographics for [target market] [industry]',
          '[Industry] customer pain points and needs 2025',
          'Target audience behavior patterns [market/industry]',
        ],
        guidance: `
Generate 5-6 queries to identify:
- WHO the target customers are (demographics, firmographics)
- What PROBLEMS they face (pain points, unmet needs)
- How they currently BEHAVE (buying patterns, decision criteria)
- Market SEGMENTS and their characteristics

Balance:
- 2 baseline queries: General market and customer research
- 2 validating queries: Evidence supporting target customer assumptions in input
- 2 challenging queries: Alternative customer segments or contradictory market data`,
      },
      value_propositions: {
        focus: 'Value Propositions - WHAT value solves customer problems',
        examples: [
          '[Product/service type] benefits and differentiation [industry]',
          'Successful [product category] features and value drivers',
          '[Industry] customer priorities and valued outcomes',
        ],
        guidance: `
Generate 5-6 queries to understand:
- WHAT value customers seek (desired outcomes, benefits)
- Which FEATURES matter most (must-haves vs nice-to-haves)
- How competitors DIFFERENTIATE (unique value props in market)
- What truly DRIVES purchase decisions

Balance:
- 2 baseline queries: General value proposition research for the industry
- 2 validating queries: Evidence supporting claimed differentiation/value
- 2 challenging queries: Counter-evidence showing different value drivers or failed differentiations`,
      },
      revenue_streams: {
        focus: 'Revenue Streams - HOW the business makes money',
        examples: [
          '[Industry] pricing models and revenue strategies 2025',
          'Successful monetization approaches [product/service category]',
          '[Market] customer willingness to pay and pricing sensitivity',
        ],
        guidance: `
Generate 5-6 queries to discover:
- HOW customers prefer to pay (pricing models, payment terms)
- WHAT they're willing to pay (price points, pricing sensitivity)
- Which MONETIZATION models work (subscription, usage-based, one-time, freemium)
- Revenue BENCHMARKS in the industry

Balance:
- 2 baseline queries: General pricing and monetization research
- 2 validating queries: Evidence supporting proposed pricing/revenue model
- 2 challenging queries: Alternative monetization approaches or pricing sensitivity data`,
      },
    };

    const blockConfig = blockPrompts[blockType];

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: `You are a Business Model Canvas research specialist generating search queries for the "${blockConfig.focus}" block.

CRITICAL: Avoid confirmation bias. Generate queries that BOTH validate AND challenge assumptions in the input.

BUSINESS CONTEXT:
${input.substring(0, 1500)}

RESEARCH FOCUS: ${blockConfig.focus}

${blockConfig.guidance}

Example queries for this block:
${blockConfig.examples.map((ex, i) => `${i + 1}. ${ex}`).join('\n')}

Each query should:
- Be specific and actionable for web search
- Include current year (2025) where relevant for recent data
- Be concise (5-10 words)
- Focus on the specific block: ${blockConfig.focus}

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

Generate 5-6 queries following the baseline/validating/challenging balance specified above.`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Failed to extract JSON from ${blockType} query generation`);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const queries: BMCQuery[] = parsed.queries.map((q: any) => ({
      ...q,
      blockType,
    }));

    return queries;
  }

  async generateQueriesForBlock(
    blockType: BMCBlockType,
    input: string
  ): Promise<BMCQuery[]> {
    return this.generateBlockQueries(blockType, input);
  }
}
