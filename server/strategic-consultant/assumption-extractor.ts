import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

export interface Assumption {
  claim: string;
  category: 'product' | 'market' | 'customer' | 'competitive' | 'operational';
  confidence: 'explicit' | 'implicit';
  investmentAmount?: string | null;
  source: string; // Where in the input this came from
}

export interface AssumptionExtractionResult {
  assumptions: Assumption[];
}

const assumptionSchema = z.object({
  assumptions: z.array(z.object({
    claim: z.string(),
    category: z.enum(['product', 'market', 'customer', 'competitive', 'operational']),
    confidence: z.enum(['explicit', 'implicit']),
    investmentAmount: z.string().nullable().optional(),
    source: z.string(),
  })),
});

export class AssumptionExtractor {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  async extractAssumptions(userInput: string): Promise<AssumptionExtractionResult> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are an assumption extraction expert. Extract ALL strategic assumptions from the user's input - both explicit and implicit.

USER INPUT:
${userInput}

TYPES OF ASSUMPTIONS TO EXTRACT:

**Explicit Assumptions** (user directly states them):
- "We assume/believe X is critical/essential/important"
- "X is necessary for Y"
- "[Group] prefer/need/want X"
- Investment breakdowns that imply priorities (e.g., "$1.5M for Hindi localization" implies Hindi is critical)
- "Key question: Should we do X?" (implies X is under consideration as important)

**Implicit Assumptions** (implied by the context):
- Market entry strategies that assume certain conditions
- Investment amounts that suggest priorities
- Questions that reveal underlying beliefs

CATEGORIES:
- product: Features, functionality, localization, technical decisions
- market: Market dynamics, entry strategies, expansion assumptions
- customer: Customer preferences, behavior, needs
- competitive: Competitive positioning, vendor preferences
- operational: Business operations, processes, team structure

CRITICAL RULES:
1. Extract the CORE CLAIM without hedging language
2. Include investment amounts if mentioned
3. Quote the exact source text where you found it
4. Be generous - extract anything that could be validated with research

Return ONLY valid JSON (no markdown, no explanation):

{
  "assumptions": [
    {
      "claim": "Hindi localization is critical for enterprise adoption in India",
      "category": "product",
      "confidence": "explicit",
      "investmentAmount": "$1.5M",
      "source": "Strategic assumptions: Hindi localization is critical for enterprise adoption in India"
    }
  ]
}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = assumptionSchema.parse(parsed);

    return validated;
  }
}
