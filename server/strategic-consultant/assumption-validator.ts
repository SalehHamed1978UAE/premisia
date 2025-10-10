import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { Assumption } from './assumption-extractor';

export interface AssumptionQuery {
  assumption: string;
  query: string;
  purpose: 'validate' | 'contradict';
}

export interface Contradiction {
  assumption: string;
  assumptionCategory: string;
  contradictedBy: string[];
  validationStrength: 'STRONG' | 'MODERATE' | 'WEAK';
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
  investmentAmount?: string | null;
}

export interface AssumptionValidation {
  assumption: string;
  supportedBy: string[];
  validationStrength: 'STRONG' | 'MODERATE' | 'WEAK';
}

export interface ContradictionResult {
  contradictions: Contradiction[];
  validations: AssumptionValidation[];
  insufficient: string[]; // Assumptions with insufficient data
}

const querySchema = z.object({
  queries: z.array(z.object({
    assumption: z.string(),
    query: z.string(),
    purpose: z.enum(['validate', 'contradict']),
  })),
});

const contradictionSchema = z.object({
  contradictions: z.array(z.object({
    assumption: z.string(),
    contradictedBy: z.array(z.string()),
    validationStrength: z.enum(['STRONG', 'MODERATE', 'WEAK']),
    impact: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    recommendation: z.string(),
  })),
  validations: z.array(z.object({
    assumption: z.string(),
    supportedBy: z.array(z.string()),
    validationStrength: z.enum(['STRONG', 'MODERATE', 'WEAK']),
  })),
  insufficient: z.array(z.string()),
});

export class AssumptionValidator {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  async generateAssumptionQueries(assumptions: Assumption[]): Promise<AssumptionQuery[]> {
    if (assumptions.length === 0) {
      return [];
    }

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are a research query generator. For each assumption, generate 2-3 targeted web search queries designed to validate OR contradict it.

ASSUMPTIONS TO RESEARCH:
${assumptions.map((a, i) => `${i + 1}. "${a.claim}" (${a.category})`).join('\n')}

QUERY GENERATION RULES:

**For each assumption, generate:**
1. ONE validating query - looks for evidence supporting the assumption
2. TWO contradicting queries - looks for evidence that challenges or disproves it

**Query Best Practices:**
- Be specific and include key terms from the assumption
- Include geographic/market context if relevant
- Add year/recency indicators for time-sensitive claims
- Focus on data, studies, statistics, preferences, behavior
- Avoid generic queries - target the EXACT claim

**Examples:**

Assumption: "Hindi localization is critical for enterprise adoption in India"
Validating: "Hindi language requirement enterprise software India adoption"
Contradicting: "English vs Hindi Indian enterprise software preferences 2024"
Contradicting: "Indian B2B SaaS language statistics English dominance"

Assumption: "Indian enterprises prefer local vendors over Western software"
Validating: "Indian companies prefer domestic software vendors statistics"
Contradicting: "Indian enterprise international SaaS adoption rates"
Contradicting: "Western software market share India B2B 2024"

Return ONLY valid JSON (no markdown, no explanation):

{
  "queries": [
    {
      "assumption": "Hindi localization is critical for enterprise adoption in India",
      "query": "English vs Hindi Indian enterprise software preferences 2024",
      "purpose": "contradict"
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
    const validated = querySchema.parse(parsed);

    return validated.queries;
  }

  async detectContradictions(
    assumptions: Assumption[],
    researchFindings: string[]
  ): Promise<ContradictionResult> {
    if (assumptions.length === 0) {
      return { contradictions: [], validations: [], insufficient: [] };
    }

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `You are a contradiction detection expert. Compare user assumptions to research findings and identify contradictions, validations, and data gaps.

USER ASSUMPTIONS:
${assumptions.map((a, i) => `${i + 1}. "${a.claim}" (${a.category}${a.investmentAmount ? `, Investment: ${a.investmentAmount}` : ''})`).join('\n')}

RESEARCH FINDINGS:
${researchFindings.join('\n')}

YOUR TASK:

For each assumption, determine if research:
1. **CONTRADICTS** it (research shows the opposite or challenges the assumption)
2. **VALIDATES** it (research supports the assumption)
3. **INSUFFICIENT** data (not enough research to determine)

**Contradiction Detection Rules:**
- Look for research that directly challenges the assumption
- Consider statistical evidence (e.g., "75% use English" contradicts "Hindi is critical")
- Consider market data that opposes the claim
- Flag vendor-funded studies as potentially biased

**Validation Strength:**
- STRONG: Multiple independent sources, recent data, clear statistics
- MODERATE: Some sources, partial data, older studies
- WEAK: Limited sources, anecdotal evidence

**Impact Assessment:**
- HIGH: Large investment amounts ($1M+), core strategy decisions
- MEDIUM: Moderate investments ($100K-$1M), tactical decisions
- LOW: Small investments (<$100K), minor decisions

**Recommendation Rules:**
- Be specific about what to do instead
- Reference the research findings
- Consider investment amounts in recommendations

Return ONLY valid JSON (no markdown, no explanation):

{
  "contradictions": [
    {
      "assumption": "Hindi localization is critical for enterprise adoption in India",
      "contradictedBy": [
        "English is the dominant language for enterprise software in India (75% of B2B SaaS)",
        "Indian enterprise decision-makers expect English interfaces as standard"
      ],
      "validationStrength": "STRONG",
      "impact": "HIGH",
      "recommendation": "Reconsider the $1.5M Hindi investment. Research shows English dominates Indian enterprise software. Consider redirecting funds to English product optimization and Indian English localization (local currency, tax, integrations)."
    }
  ],
  "validations": [
    {
      "assumption": "Indian market has high growth potential",
      "supportedBy": [
        "Indian enterprise software market growing at 15% CAGR",
        "Digital transformation accelerating in Indian enterprises"
      ],
      "validationStrength": "STRONG"
    }
  ],
  "insufficient": [
    "Assumption about X - not enough research data found"
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
    const validated = contradictionSchema.parse(parsed);

    // Add investment amounts and categories from original assumptions
    const result: ContradictionResult = {
      contradictions: validated.contradictions.map(c => {
        const original = assumptions.find(a => a.claim === c.assumption);
        return {
          ...c,
          assumptionCategory: original?.category || 'unknown',
          investmentAmount: original?.investmentAmount,
        };
      }),
      validations: validated.validations,
      insufficient: validated.insufficient,
    };

    return result;
  }
}
