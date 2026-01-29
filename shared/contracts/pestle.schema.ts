/**
 * PESTLE Module Schema
 * Based on JOURNEY_MODULE_COGNITION_SPEC_FINAL.md Part 8.1
 * 
 * Scans macro-environmental factors affecting the specific business in the specific market.
 * Identifies external opportunities and threats at the macro level.
 */

import { z } from 'zod';
import { CitationSchema, OpportunitySchema, ThreatSchema } from './common.schemas';
import { PositioningOutputSchema } from './positioning.schema';

// =============================================================================
// INPUT SCHEMA
// =============================================================================

export const PESTLEInputSchema = z.object({
  /** From Positioning Module (REQUIRED) */
  positioning: PositioningOutputSchema,
  
  /** From web research (optional) */
  researchFindings: z.object({
    sources: z.array(CitationSchema),
    findings: z.array(z.object({
      claim: z.string(),
      evidence: z.string(),
      confidence: z.enum(['verified', 'researched', 'inferred']),
    })),
  }).optional(),
});

export type PESTLEInput = z.infer<typeof PESTLEInputSchema>;

// =============================================================================
// PESTLE FACTOR SCHEMA
// =============================================================================

export const PESTLEFactorSchema = z.object({
  category: z.enum(['P', 'E', 'S', 'T', 'L', 'Env']),
  factor: z.string(),
  description: z.string(),
  impact: z.enum(['opportunity', 'threat', 'neutral']),
  magnitude: z.enum(['high', 'medium', 'low']),
  /** "For [business name], this means..." */
  implication: z.string(),
  evidence: z.string(),
  citation: CitationSchema.optional(),
  confidence: z.enum(['verified', 'researched', 'inferred']),
});

export type PESTLEFactor = z.infer<typeof PESTLEFactorSchema>;

// =============================================================================
// OUTPUT SCHEMA
// =============================================================================

export const PESTLEOutputSchema = z.object({
  /** e.g., "UAE market for premium sneaker retail targeting collectors" */
  scope: z.string(),
  
  factors: z.object({
    political: z.array(PESTLEFactorSchema),
    economic: z.array(PESTLEFactorSchema),
    social: z.array(PESTLEFactorSchema),
    technological: z.array(PESTLEFactorSchema),
    legal: z.array(PESTLEFactorSchema),
    environmental: z.array(PESTLEFactorSchema),
  }),
  
  /** Top 5-7 most impactful factors */
  prioritizedFactors: z.array(PESTLEFactorSchema),
  
  /** Derived from favorable factors */
  opportunities: z.array(OpportunitySchema),
  
  /** Derived from unfavorable factors */
  threats: z.array(ThreatSchema),
  
  /** Where more data is needed */
  researchGaps: z.array(z.string()),
  
  /** What we're assuming vs knowing */
  assumptions: z.array(z.string()),
  
  confidenceLevel: z.enum(['high', 'medium', 'low']),
});

export type PESTLEOutput = z.infer<typeof PESTLEOutputSchema>;

// =============================================================================
// QUALITY RUBRIC (1-10 Scale)
// =============================================================================

export const PESTLEQualityRubric = {
  specificity: {
    criterion: 'Specificity',
    description: 'Every factor mentions business name and market',
    target: '100% factors mention business/market',
    scoring: {
      excellent: 'Every factor names the specific business, market, and geography',
      good: 'Most factors specific to industry and geography',
      average: 'Industry-level specificity only',
      poor: 'Generic statements that could apply anywhere',
    },
  },
  citationRate: {
    criterion: 'Citation Rate',
    description: 'All factors have evidence sources',
    target: '100% factors have citations',
    scoring: {
      excellent: 'All factors cite recent (<2yr) credible sources',
      good: 'Most factors have citations',
      average: 'Some citations, heavy reliance on general knowledge',
      poor: 'No citations, LLM speculation',
    },
  },
  balance: {
    criterion: 'Balance',
    description: 'Adequate coverage across all 6 categories',
    target: '2-5 factors per category',
    scoring: {
      excellent: '3-4 substantive factors per category',
      good: '2-5 factors per category',
      average: 'Uneven coverage, some categories thin',
      poor: 'Missing or empty categories',
    },
  },
  actionability: {
    criterion: 'Actionability',
    description: 'All factors have business implications',
    target: '100% factors have implications',
    scoring: {
      excellent: 'Every factor ends with specific action for this business',
      good: 'Most factors have implications',
      average: 'Implications stated but vague',
      poor: 'Factors listed without implications',
    },
  },
} as const;

// =============================================================================
// BRIDGE HINTS (for downstream modules)
// =============================================================================

export interface PESTLEBridgeHints {
  /** Legal factors that create barriers to entry */
  regulatoryBarriers: {
    factor: string;
    severity: 'high' | 'medium' | 'low';
    interpretation: string;
  }[];
  
  /** Economic factors affecting buyer behavior */
  buyerPowerIndicators: {
    factor: string;
    direction: 'increases' | 'decreases';
    interpretation: string;
  }[];
  
  /** Technology factors enabling substitutes */
  substituteEnablers: {
    factor: string;
    substituteType: string;
    interpretation: string;
  }[];
  
  /** Market growth signals affecting rivalry */
  growthSignals: {
    factor: string;
    growthRate: string | null;
    implication: string;
  }[];
}

export function extractBridgeHints(output: PESTLEOutput): PESTLEBridgeHints {
  const hints: PESTLEBridgeHints = {
    regulatoryBarriers: [],
    buyerPowerIndicators: [],
    substituteEnablers: [],
    growthSignals: [],
  };
  
  // Extract regulatory barriers from Legal factors
  for (const factor of output.factors.legal) {
    if (factor.magnitude === 'high' || factor.impact === 'threat') {
      hints.regulatoryBarriers.push({
        factor: factor.factor,
        severity: factor.magnitude,
        interpretation: `PESTLE Legal: "${factor.factor}" creates regulatory barrier`,
      });
    }
  }
  
  // Extract buyer power indicators from Economic factors
  for (const factor of output.factors.economic) {
    const isSpendingRelated = factor.factor.toLowerCase().includes('spending') ||
      factor.factor.toLowerCase().includes('income') ||
      factor.factor.toLowerCase().includes('disposable');
    if (isSpendingRelated) {
      hints.buyerPowerIndicators.push({
        factor: factor.factor,
        direction: factor.impact === 'opportunity' ? 'decreases' : 'increases',
        interpretation: `PESTLE Economic: "${factor.factor}" affects buyer price sensitivity`,
      });
    }
  }
  
  // Extract substitute enablers from Technological factors
  for (const factor of output.factors.technological) {
    const enablesSubstitutes = factor.factor.toLowerCase().includes('platform') ||
      factor.factor.toLowerCase().includes('online') ||
      factor.factor.toLowerCase().includes('digital') ||
      factor.factor.toLowerCase().includes('app');
    if (enablesSubstitutes) {
      hints.substituteEnablers.push({
        factor: factor.factor,
        substituteType: 'digital_channel',
        interpretation: `PESTLE Tech: "${factor.factor}" enables alternative channels`,
      });
    }
  }
  
  // Extract growth signals from Economic factors
  for (const factor of output.factors.economic) {
    const isGrowthRelated = factor.factor.toLowerCase().includes('growth') ||
      factor.factor.toLowerCase().includes('market size') ||
      factor.factor.toLowerCase().includes('expansion');
    if (isGrowthRelated) {
      // Try to extract growth rate from evidence
      const growthMatch = factor.evidence.match(/(\d+(?:\.\d+)?)\s*%/);
      hints.growthSignals.push({
        factor: factor.factor,
        growthRate: growthMatch ? growthMatch[1] + '%' : null,
        implication: factor.impact === 'opportunity' 
          ? 'Growing market attracts new entrants'
          : 'Stagnant market intensifies rivalry',
      });
    }
  }
  
  return hints;
}
