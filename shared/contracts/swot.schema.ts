/**
 * SWOT Module Schema
 * Based on JOURNEY_MODULE_COGNITION_SPEC_FINAL.md Part 8.3
 * 
 * Synthesizes external analysis (PESTLE, Porter's) with internal assessment
 * to define strategic position.
 * 
 * CRITICAL: Different logic for New Venture vs Existing Business!
 */

import { z } from 'zod';
import { PositioningOutputSchema } from './positioning.schema';
import { PESTLEOutputSchema } from './pestle.schema';
import { PortersOutputSchema } from './porters.schema';

// =============================================================================
// INPUT SCHEMA
// =============================================================================

export const SWOTInputSchema = z.object({
  positioning: PositioningOutputSchema,
  pestleOutput: PESTLEOutputSchema,  // REQUIRED
  portersOutput: PortersOutputSchema, // REQUIRED
  
  /** For existing business only */
  internalData: z.object({
    capabilities: z.array(z.string()),
    resources: z.array(z.string()),
    performance: z.array(z.string()),
  }).optional(),
});

export type SWOTInput = z.infer<typeof SWOTInputSchema>;

// =============================================================================
// SWOT ITEM SCHEMA
// =============================================================================

export const SWOTItemSchema = z.object({
  item: z.string(),
  description: z.string(),
  priority: z.number().min(1).max(5),
  priorityRationale: z.string(),
  sourceAnalysis: z.enum(['pestle', 'porters', 'internal', 'combined']),
  sourceReference: z.string().optional(), // e.g., "PESTLE Economic E-3"
});

export type SWOTItem = z.infer<typeof SWOTItemSchema>;

// =============================================================================
// STRATEGY SCHEMA
// =============================================================================

export const StrategySchema = z.object({
  strategy: z.string(),
  /** Which S or W items this leverages */
  leverages: z.array(z.string()),
  /** Which O or T items this addresses */
  addresses: z.array(z.string()),
  actions: z.array(z.string()),
  timeframe: z.string(),
});

export type Strategy = z.infer<typeof StrategySchema>;

// =============================================================================
// OUTPUT SCHEMA
// =============================================================================

export const SWOTOutputSchema = z.object({
  ventureType: z.enum(['new_venture', 'existing_business']),
  
  /** Max 5, prioritized */
  strengths: z.array(SWOTItemSchema),
  weaknesses: z.array(SWOTItemSchema),
  opportunities: z.array(SWOTItemSchema),
  threats: z.array(SWOTItemSchema),
  
  strategies: z.object({
    /** Use Strengths to capture Opportunities */
    SO: z.array(StrategySchema),
    /** Use Strengths to mitigate Threats */
    ST: z.array(StrategySchema),
    /** Address Weaknesses to capture Opportunities */
    WO: z.array(StrategySchema),
    /** Address Weaknesses to avoid Threats */
    WT: z.array(StrategySchema),
  }),
  
  /** Top 3-5 immediate actions */
  priorityActions: z.array(z.string()),
  
  /** PESTLE factors used in deriving O/T */
  pestleFactorsUsed: z.array(z.string()),
  
  /** Porter forces used in deriving O/T */
  porterForcesUsed: z.array(z.string()),
});

export type SWOTOutput = z.infer<typeof SWOTOutputSchema>;

// =============================================================================
// NEW VENTURE S/W CATEGORIES (Per Spec)
// =============================================================================

/**
 * For NEW VENTURES, Strengths must use these 5 categories:
 */
export const NEW_VENTURE_STRENGTH_CATEGORIES = {
  valuePropositionFit: {
    name: 'Value Proposition Fit',
    description: 'How well does the proposed offering match identified market opportunities?',
    example: 'Authentication service addresses collector trust gap identified in Porter\'s',
  },
  founderCapabilities: {
    name: 'Founder/Team Capabilities',
    description: 'What relevant expertise, networks, or resources do founders bring?',
    example: 'Founder has 10 years Nike regional distribution experience',
  },
  businessModelAdvantages: {
    name: 'Business Model Advantages',
    description: 'What structural advantages does the proposed model have?',
    example: 'Direct-to-collector model eliminates middleman margins',
  },
  timingFirstMover: {
    name: 'Timing/First-Mover',
    description: 'Is there a window of opportunity being captured?',
    example: 'Entering before major brands establish direct UAE presence',
  },
  resourcePositioning: {
    name: 'Resource Positioning',
    description: 'What key resources or partnerships are already secured?',
    example: 'Exclusive supplier relationship with StockX for authentication',
  },
} as const;

/**
 * For NEW VENTURES, Weaknesses must use these 5 categories:
 */
export const NEW_VENTURE_WEAKNESS_CATEGORIES = {
  capabilityGaps: {
    name: 'Capability Gaps',
    description: 'What critical capabilities are missing to execute?',
    example: 'No local retail real estate experience',
  },
  resourceConstraints: {
    name: 'Resource Constraints',
    description: 'What resource limitations exist?',
    example: 'Limited capital for inventory ($200K vs recommended $500K)',
  },
  unvalidatedAssumptions: {
    name: 'Unvalidated Assumptions',
    description: 'What critical assumptions haven\'t been tested?',
    example: 'Assumption: collectors will pay 20% premium for authentication',
  },
  marketAccessBarriers: {
    name: 'Market Access Barriers',
    description: 'What obstacles exist to reaching customers?',
    example: 'No existing customer database or community presence in UAE',
  },
  competitiveDisadvantages: {
    name: 'Competitive Disadvantages',
    description: 'Where are we structurally weaker than alternatives?',
    example: 'Established retailers have brand recognition and supplier terms',
  },
} as const;

// =============================================================================
// QUALITY RUBRIC (1-10 Scale)
// =============================================================================

export const SWOTQualityRubric = {
  otTraceability: {
    criterion: 'O/T Traceability',
    description: 'Every O/T cites specific PESTLE factor or Porter force',
    target: '100% cite PESTLE/Porter\'s',
    scoring: {
      excellent: 'Every O/T cites specific PESTLE factor or Porter force by ID',
      good: 'Most O/T reference prior analysis',
      average: 'Some O/T traceable, mix of derived and generic',
      poor: 'O/T appear disconnected from prior analysis',
    },
  },
  swRealism: {
    criterion: 'S/W Realism (New Venture)',
    description: 'S/W limited to 5 pre-operational categories',
    target: 'All S/W grounded in positioning/founder context',
    scoring: {
      excellent: 'S/W limited to 5 categories, all grounded in positioning',
      good: 'S/W mostly grounded, some aspirational items',
      average: 'S/W includes some capabilities venture doesn\'t have',
      poor: 'Fantasy S/W listing capabilities business doesn\'t have',
    },
  },
  strategyActionability: {
    criterion: 'Strategy Actionability',
    description: 'Each strategy quadrant has specific actions with timeframes',
    target: '≥1 strategy per quadrant with actions',
    scoring: {
      excellent: 'Each SO/ST/WO/WT has 2-3 specific actions with timeframes',
      good: 'Strategies present with actions but timeframes vague',
      average: 'Quadrant strategies exist but vague',
      poor: 'Generic strategies or missing quadrants',
    },
  },
} as const;

// =============================================================================
// PESTLE + PORTER'S → SWOT TRANSFORMATION
// =============================================================================

export interface SWOTDerivationRule {
  source: 'pestle' | 'porters' | 'combined';
  condition: string;
  target: 'opportunity' | 'threat';
  logic: string;
}

export const SWOT_DERIVATION_RULES: SWOTDerivationRule[] = [
  {
    source: 'combined',
    condition: 'PESTLE opportunity + Low Porter force',
    target: 'opportunity',
    logic: 'STRONG OPPORTUNITY - favorable macro + weak competitive force',
  },
  {
    source: 'combined',
    condition: 'PESTLE threat + High Porter force',
    target: 'threat',
    logic: 'STRONG THREAT - unfavorable macro + strong competitive force',
  },
  {
    source: 'combined',
    condition: 'PESTLE opportunity + High Porter force',
    target: 'opportunity',
    logic: 'CONDITIONAL OPPORTUNITY - potential exists but competition limits capture',
  },
  {
    source: 'porters',
    condition: 'Low threat of new entrants',
    target: 'opportunity',
    logic: 'Protected market position once established',
  },
  {
    source: 'porters',
    condition: 'High supplier power',
    target: 'threat',
    logic: 'Dependent on limited supplier relationships',
  },
  {
    source: 'porters',
    condition: 'Low competitive rivalry',
    target: 'opportunity',
    logic: 'First-mover advantage possible',
  },
  {
    source: 'pestle',
    condition: 'Favorable regulatory environment',
    target: 'opportunity',
    logic: 'Lower barriers to market entry',
  },
  {
    source: 'pestle',
    condition: 'High market growth',
    target: 'opportunity',
    logic: 'Expanding pie reduces zero-sum competition',
  },
];

// =============================================================================
// HELPER: Validate S/W for new ventures
// =============================================================================

export function validateNewVentureStrengthsWeaknesses(
  strengths: SWOTItem[],
  weaknesses: SWOTItem[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const validStrengthCategories = Object.keys(NEW_VENTURE_STRENGTH_CATEGORIES);
  const validWeaknessCategories = Object.keys(NEW_VENTURE_WEAKNESS_CATEGORIES);
  
  // Check for fantasy strengths (operational capabilities a new venture can't have)
  const fantasyKeywords = [
    'strong customer service',
    'established brand',
    'loyal customer base',
    'proven track record',
    'experienced team', // OK if qualified with specifics
    'market share',
    'operational efficiency',
  ];
  
  for (const s of strengths) {
    const lower = s.item.toLowerCase();
    for (const fantasy of fantasyKeywords) {
      if (lower.includes(fantasy)) {
        errors.push(`Strength "${s.item}" appears to be a fantasy strength for a new venture`);
      }
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return { valid: true, errors: [] };
}
