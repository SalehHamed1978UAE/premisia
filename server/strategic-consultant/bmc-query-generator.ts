import { aiClients } from '../ai-clients';

export type BMCBlockType = 
  | 'customer_segments' 
  | 'value_propositions' 
  | 'revenue_streams'
  | 'channels'
  | 'customer_relationships'
  | 'key_resources'
  | 'key_activities'
  | 'key_partnerships'
  | 'cost_structure';

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
  channels: BMCQuery[];
  customer_relationships: BMCQuery[];
  key_resources: BMCQuery[];
  key_activities: BMCQuery[];
  key_partnerships: BMCQuery[];
  cost_structure: BMCQuery[];
}

export class BMCQueryGenerator {
  constructor() {
    // No initialization needed - using shared AIClients
  }

  async generateQueriesForAllBlocks(input: string): Promise<BMCQuerySet> {
    const [
      customerQueries,
      valueQueries,
      revenueQueries,
      channelsQueries,
      relationshipsQueries,
      resourcesQueries,
      activitiesQueries,
      partnersQueries,
      costQueries
    ] = await Promise.all([
      this.generateBlockQueries('customer_segments', input),
      this.generateBlockQueries('value_propositions', input),
      this.generateBlockQueries('revenue_streams', input),
      this.generateBlockQueries('channels', input),
      this.generateBlockQueries('customer_relationships', input),
      this.generateBlockQueries('key_resources', input),
      this.generateBlockQueries('key_activities', input),
      this.generateBlockQueries('key_partnerships', input),
      this.generateBlockQueries('cost_structure', input),
    ]);

    return {
      customer_segments: customerQueries,
      value_propositions: valueQueries,
      revenue_streams: revenueQueries,
      channels: channelsQueries,
      customer_relationships: relationshipsQueries,
      key_resources: resourcesQueries,
      key_activities: activitiesQueries,
      key_partnerships: partnersQueries,
      cost_structure: costQueries,
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
      channels: {
        focus: 'Channels - HOW the company reaches and delivers value to customer segments',
        examples: [
          'Best distribution channels [industry] 2025',
          '[Market] online vs offline sales effectiveness',
          'Successful customer acquisition channels [business type]',
        ],
        guidance: `
Generate 5-6 queries to understand:
- HOW to reach customers (distribution channels, sales channels)
- Which channels are most EFFECTIVE (online/offline mix, channel performance)
- What WORKS in the industry (successful channel strategies)
- Customer PREFERENCES for discovery and purchase

Balance:
- 2 baseline queries: General channel and distribution research
- 2 validating queries: Evidence supporting proposed channel strategy
- 2 challenging queries: Alternative channels or channel effectiveness data`,
      },
      customer_relationships: {
        focus: 'Customer Relationships - TYPE of relationships established with customer segments',
        examples: [
          'Customer retention strategies [industry] 2025',
          'B2B vs B2C support models and engagement',
          '[Industry] community building and self-service trends',
        ],
        guidance: `
Generate 5-6 queries to discover:
- WHAT type of relationships customers expect (personal, automated, community)
- HOW to engage and retain (support levels, engagement models)
- Which MODELS work (self-service, dedicated support, community-driven)
- Retention and loyalty STRATEGIES in the industry

Balance:
- 2 baseline queries: General relationship and engagement research
- 2 validating queries: Evidence supporting proposed relationship strategy
- 2 challenging queries: Alternative engagement models or retention challenges`,
      },
      key_resources: {
        focus: 'Key Resources - CRITICAL assets required to make the business model work',
        examples: [
          'Critical resources [industry] startups need',
          'Technology infrastructure requirements [business type]',
          '[Industry] talent and IP requirements 2025',
        ],
        guidance: `
Generate 5-6 queries to identify:
- WHAT assets are essential (talent, technology, IP, capital)
- Which resources are CRITICAL vs nice-to-have
- Industry-specific REQUIREMENTS (infrastructure, expertise)
- Resource BENCHMARKS and standards

Balance:
- 2 baseline queries: General resource requirements research
- 2 validating queries: Evidence supporting proposed resource needs
- 2 challenging queries: Underestimated resources or resource alternatives`,
      },
      key_activities: {
        focus: 'Key Activities - MOST important actions required to operate successfully',
        examples: [
          'Essential activities [business type] operations',
          'Operational priorities [industry] companies 2025',
          'Core activities successful [product category] businesses',
        ],
        guidance: `
Generate 5-6 queries to understand:
- WHAT activities are must-do for success
- Which operations are CRITICAL vs supporting
- What successful companies PRIORITIZE
- Industry-specific operational REQUIREMENTS

Balance:
- 2 baseline queries: General operational activities research
- 2 validating queries: Evidence supporting proposed key activities
- 2 challenging queries: Overlooked activities or different operational priorities`,
      },
      key_partnerships: {
        focus: 'Key Partners - NETWORK of suppliers and partners',
        examples: [
          'Strategic partnerships [industry] ecosystem',
          'Supplier requirements [business type] 2025',
          '[Industry] partnership models and collaboration',
        ],
        guidance: `
Generate 5-6 queries to discover:
- WHO are critical partners (suppliers, strategic allies, ecosystem players)
- WHAT partnerships are essential vs optional
- How partnerships WORK in the industry
- Partnership MODELS and collaboration patterns

Balance:
- 2 baseline queries: General partnership and supplier research
- 2 validating queries: Evidence supporting proposed partnerships
- 2 challenging queries: Alternative partner strategies or partnership risks`,
      },
      cost_structure: {
        focus: 'Cost Structure - ALL costs incurred to operate the business model',
        examples: [
          'Cost structure [industry] businesses 2025',
          'Operating costs [business type] breakdown',
          '[Industry] fixed vs variable costs and drivers',
        ],
        guidance: `
Generate 5-6 queries to understand:
- WHAT are the major cost drivers (fixed vs variable)
- HOW costs break down in the industry (benchmarks, ratios)
- Which costs are CRITICAL and unavoidable
- Cost OPTIMIZATION opportunities and risks

Balance:
- 2 baseline queries: General cost structure research
- 2 validating queries: Evidence supporting proposed cost assumptions
- 2 challenging queries: Hidden costs or different cost structures`,
      },
    };

    const blockConfig = blockPrompts[blockType];

    const response = await aiClients.callWithFallback({
      systemPrompt: `You are a Business Model Canvas research specialist generating search queries for the "${blockConfig.focus}" block.

CRITICAL: Avoid confirmation bias. Generate queries that BOTH validate AND challenge assumptions in the input.`,
      userMessage: `BUSINESS CONTEXT:
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
      maxTokens: 2000,
    });

    const textContent = response.content;

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
