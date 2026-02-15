import { z } from 'zod';
import { aiClients } from '../ai-clients';
import { parseAndValidate } from '../utils/parse-ai-json';

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
  constructor() {
    // No initialization needed - using shared AIClients
  }

  async extractAssumptions(userInput: string): Promise<AssumptionExtractionResult> {
    const systemPrompt = `You are an assumption extraction expert. Return ONLY valid JSON (no markdown, no explanation).`;
    
    const userMessage = `Extract ALL strategic assumptions from the user's input - both explicit and implicit. BE THOROUGH - aim for 5-10 assumptions when evidence supports it, but extract only genuine, testable claims.

USER INPUT:
${userInput}

TYPES OF ASSUMPTIONS TO EXTRACT:

**Explicit Assumptions** (user directly states them):
- "We assume/believe X is critical/essential/important"
- "X is necessary for Y"
- "[Group] prefer/need/want X"
- Investment breakdowns that imply priorities (e.g., "$500K for Hindi localization" → Hindi is critical)
- "Key question: Should we do X?" (implies X is under consideration as important)
- Target metrics imply achievability (e.g., "100 enterprise clients in 18 months" assumes this is achievable)

**Implicit Assumptions** (implied by the context):
- Market entry strategies assume certain market conditions
- Investment amounts suggest expected ROI/priorities
- Questions reveal underlying beliefs about what works
- Quantitative targets assume feasibility
- Geographic/demographic focus assumes opportunity
- Competitive positioning assumes market dynamics
- Timing assumptions (e.g., "within 18 months" assumes speed is possible)

**Examples of What to Extract:**

Input: "Expanding to India with Hindi localization ($500K) to target 100 enterprise clients in 18 months. Local vendors preferred."

Extract:
1. "Hindi localization is critical for Indian market success" (product, explicit, $500K)
2. "100 enterprise clients is achievable within 18 months" (market, explicit)
3. "Indian enterprises prefer local vendors over international providers" (competitive, explicit)
4. "Enterprise segment represents the primary opportunity in India" (customer, implicit)
5. "Hindi language support drives purchase decisions" (customer, implicit)
6. "$500K investment in localization will generate sufficient ROI" (operational, implicit)

CATEGORIES:
- product: Features, functionality, localization, technical decisions
- market: Market dynamics, entry strategies, expansion assumptions, growth rates
- customer: Customer preferences, behavior, needs, decision criteria
- competitive: Competitive positioning, vendor preferences, differentiation
- operational: Business operations, processes, team structure, feasibility

CRITICAL RULES:
1. Extract UP TO 10 assumptions - prioritize quality over quantity (5-10 for typical inputs, fewer for brief inputs)
2. Extract the CORE CLAIM without hedging language
3. Include investment amounts if mentioned
4. Quote the exact source text where you found it
5. Only extract claims that can be validated with research - no speculation
6. Don't miss implicit quantitative and temporal assumptions

Return ONLY valid JSON (no markdown, no explanation):

{
  "assumptions": [
    {
      "claim": "Hindi localization is critical for enterprise adoption in India",
      "category": "product",
      "confidence": "explicit",
      "investmentAmount": "$500K",
      "source": "Expanding to India with Hindi localization ($500K)"
    },
    {
      "claim": "100 enterprise clients with 500+ employees is achievable within 18 months",
      "category": "market",
      "confidence": "explicit",
      "investmentAmount": null,
      "source": "target 100 enterprise clients in 18 months"
    }
  ]
}`;

    const response = await aiClients.callWithFallback({
      systemPrompt,
      userMessage,
      maxTokens: 2000,
    });

    const validated = parseAndValidate(
      response.content,
      assumptionSchema,
      'assumption extractor',
    );

    return validated;
  }
}
