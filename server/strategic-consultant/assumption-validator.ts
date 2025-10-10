import { z } from 'zod';
import { aiClients } from '../ai-clients';
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
    matchedAssumptionClaim: z.string(), // EXACT quote from assumptions list
    contradictedBy: z.array(z.string()),
    validationStrength: z.enum(['STRONG', 'MODERATE', 'WEAK']),
    impact: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    recommendation: z.string(),
  })),
  validations: z.array(z.object({
    assumption: z.string(),
    matchedAssumptionClaim: z.string(), // EXACT quote from assumptions list
    supportedBy: z.array(z.string()),
    validationStrength: z.enum(['STRONG', 'MODERATE', 'WEAK']),
  })),
  insufficient: z.array(z.string()),
});

export class AssumptionValidator {
  constructor() {
    // No initialization needed - using shared AIClients
  }

  async generateAssumptionQueries(assumptions: Assumption[]): Promise<AssumptionQuery[]> {
    if (assumptions.length === 0) {
      return [];
    }

    const systemPrompt = `You are a research query generator. Return ONLY valid JSON (no markdown, no explanation).`;
    
    const userMessage = `For each assumption, generate 2-3 targeted web search queries designed to validate OR contradict it.

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
}`;

    const response = await aiClients.callWithFallback({
      systemPrompt,
      userMessage,
      maxTokens: 2000,
    }, "anthropic");

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
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

    const systemPrompt = `You are a contradiction detection expert. Return ONLY valid JSON (no markdown, no explanation).`;
    
    const userMessage = `Compare user assumptions to research findings and identify contradictions, validations, and data gaps.

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

**CRITICAL: Exact Assumption Matching**
- For "assumption" field: You may rephrase/summarize for clarity
- For "matchedAssumptionClaim" field: MUST be an EXACT copy-paste from the assumptions list above
- This ensures investment amounts transfer correctly

Return ONLY valid JSON (no markdown, no explanation):

{
  "contradictions": [
    {
      "assumption": "Hindi localization is critical for enterprise adoption in India",
      "matchedAssumptionClaim": "Hindi localization is critical for enterprise adoption in India",
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
      "matchedAssumptionClaim": "Indian market has high growth potential",
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
}`;

    const response = await aiClients.callWithFallback({
      systemPrompt,
      userMessage,
      maxTokens: 3000,
    }, "anthropic");

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = contradictionSchema.parse(parsed);

    // Add investment amounts and categories from original assumptions
    // Primary: exact matching on matchedAssumptionClaim (Claude provides exact quote)
    // Fallback: fuzzy matching if exact match fails
    const result: ContradictionResult = {
      contradictions: validated.contradictions.map(c => {
        // Try exact match first (should work when Claude follows instructions)
        // Normalize whitespace to tolerate formatting artifacts
        const normalizedMatch = c.matchedAssumptionClaim?.trim();
        let original = assumptions.find(a => a.claim.trim() === normalizedMatch);
        
        // Fallback to fuzzy matching if exact match fails
        if (!original) {
          console.warn(`[AssumptionValidator] Exact match failed for "${c.matchedAssumptionClaim}", falling back to fuzzy matching`);
          original = this.findBestAssumptionMatch(c.assumption, assumptions);
          
          if (original) {
            console.log(`[AssumptionValidator] Fuzzy match found: "${original.claim}"`);
          } else {
            console.error(`[AssumptionValidator] No match found for contradiction: "${c.assumption}"`);
          }
        }
        
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

  // Helper: Fuzzy match to handle LLM wording variations
  private findBestAssumptionMatch(
    contradictionText: string,
    assumptions: Assumption[]
  ): Assumption | undefined {
    if (assumptions.length === 0) return undefined;

    // First try exact match
    const exactMatch = assumptions.find(a => a.claim === contradictionText);
    if (exactMatch) return exactMatch;

    // Normalize text for fuzzy matching
    const normalize = (text: string) => 
      text.toLowerCase()
        .replace(/[^\w\s$]/g, ' ') // Keep $ for amounts, replace other punctuation with space
        .replace(/\s+/g, ' ')       // Normalize whitespace
        .trim();

    // Extract key entities (dollar amounts, countries, specific terms)
    const extractEntities = (text: string) => {
      const entities: Set<string> = new Set();
      
      // Money amounts: $500K, $1.5M, etc.
      const moneyMatches = text.match(/\$[\d.,]+[KMB]?/gi);
      if (moneyMatches) moneyMatches.forEach(m => entities.add(m.toLowerCase()));
      
      // Countries/regions
      const geoTerms = ['india', 'indian', 'china', 'chinese', 'usa', 'american', 'europe', 'european'];
      geoTerms.forEach(term => {
        if (text.toLowerCase().includes(term)) entities.add(term);
      });
      
      // Product/tech terms (generalized for reuse)
      const techTerms = ['hindi', 'english', 'localization', 'enterprise', 'sme', 'saas', 'crm'];
      techTerms.forEach(term => {
        if (text.toLowerCase().includes(term)) entities.add(term);
      });
      
      return entities;
    };

    const normalizedTarget = normalize(contradictionText);
    const targetEntities = extractEntities(contradictionText);

    // Find best match using multi-factor scoring
    let bestMatch: Assumption | undefined;
    let highestScore = 0;

    for (const assumption of assumptions) {
      const normalizedClaim = normalize(assumption.claim);
      const claimEntities = extractEntities(assumption.claim);
      
      // Calculate base similarity score
      let score = 0;
      
      // Exact normalized match = 1.0
      if (normalizedClaim === normalizedTarget) {
        score = 1.0;
      }
      // Substring match = 0.8
      else if (normalizedClaim.includes(normalizedTarget) || normalizedTarget.includes(normalizedClaim)) {
        score = 0.8;
      }
      // Word overlap using Jaccard similarity
      else {
        const targetWords = normalizedTarget.split(' ').filter(w => w.length > 2); // Filter short words
        const claimWords = normalizedClaim.split(' ').filter(w => w.length > 2);
        const claimWordsSet = new Set(claimWords);
        
        // Calculate Jaccard similarity: intersection / union
        const intersection = targetWords.filter(w => claimWordsSet.has(w));
        const union = Array.from(new Set([...targetWords, ...claimWords]));
        
        if (union.length > 0) {
          score = intersection.length / union.length;
        }
      }

      // Entity-based boosting: if key entities match, boost score significantly
      if (targetEntities.size > 0 && claimEntities.size > 0) {
        const targetEntitiesArr = Array.from(targetEntities);
        const entityIntersection = new Set(targetEntitiesArr.filter(e => claimEntities.has(e)));
        const entityUnion = new Set([...targetEntitiesArr, ...Array.from(claimEntities)]);
        
        if (entityUnion.size > 0) {
          const entityScore = entityIntersection.size / entityUnion.size;
          // Boost the score if entities match well (weight entity matching at 40%)
          score = (score * 0.6) + (entityScore * 0.4);
        }
      }

      // Lowered threshold to 0.25 + entity boosting handles morphological variants
      if (score > highestScore && score >= 0.25) {
        highestScore = score;
        bestMatch = assumption;
      }
    }

    return bestMatch;
  }
}
