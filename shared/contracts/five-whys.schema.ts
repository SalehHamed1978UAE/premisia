/**
 * Five Whys Module Schema
 * Based on JOURNEY_MODULE_COGNITION_SPEC_FINAL.md Part 8.4
 * 
 * Surfaces hidden assumptions about why this business would succeed.
 * Challenges conventional thinking. Identifies root causes of potential failure.
 */

import { z } from 'zod';
import { PositioningOutputSchema } from './positioning.schema';

// =============================================================================
// INPUT SCHEMA
// =============================================================================

export const FiveWhysInputSchema = z.object({
  positioning: PositioningOutputSchema,
  /** User's belief about success (optional starting point) */
  initialStatement: z.string().optional(),
});

export type FiveWhysInput = z.infer<typeof FiveWhysInputSchema>;

// =============================================================================
// WHY CHAIN SCHEMA
// =============================================================================

export const WhyLevelSchema = z.object({
  level: z.number().min(1).max(5),
  question: z.string(),
  answer: z.string(),
  assumptionSurfaced: z.string(),
});

export const WhyChainSchema = z.object({
  startingPoint: z.string(),
  whys: z.array(WhyLevelSchema),
  rootCause: z.string(),
});

export type WhyLevel = z.infer<typeof WhyLevelSchema>;
export type WhyChain = z.infer<typeof WhyChainSchema>;

// =============================================================================
// ASSUMPTION SCHEMA
// =============================================================================

export const AssumptionSchema = z.object({
  assumption: z.string(),
  category: z.enum(['validated', 'testable', 'untestable']),
  evidence: z.string().optional(),
  riskIfWrong: z.enum(['high', 'medium', 'low']),
});

export type Assumption = z.infer<typeof AssumptionSchema>;

// =============================================================================
// ROOT CAUSE SCHEMA
// =============================================================================

export const RootCauseSchema = z.object({
  cause: z.string(),
  chainId: z.number(),
  implications: z.array(z.string()),
});

export type RootCause = z.infer<typeof RootCauseSchema>;

// =============================================================================
// VALIDATION PRIORITY SCHEMA
// =============================================================================

export const ValidationPrioritySchema = z.object({
  assumption: z.string(),
  testMethod: z.string(),
  priority: z.enum(['critical', 'important', 'nice-to-have']),
  estimatedCost: z.string().optional(),
  estimatedTime: z.string().optional(),
});

export type ValidationPriority = z.infer<typeof ValidationPrioritySchema>;

// =============================================================================
// OUTPUT SCHEMA
// =============================================================================

export const FiveWhysOutputSchema = z.object({
  successHypothesis: z.string(),
  
  whyChains: z.array(WhyChainSchema),
  
  assumptions: z.array(AssumptionSchema),
  
  rootCauses: z.array(RootCauseSchema),
  
  /** If wrong, business fails */
  criticalAssumptions: z.array(AssumptionSchema),
  
  validationPriorities: z.array(ValidationPrioritySchema),
});

export type FiveWhysOutput = z.infer<typeof FiveWhysOutputSchema>;

// =============================================================================
// QUALITY RUBRIC
// =============================================================================

export const FiveWhysQualityRubric = {
  businessFocus: {
    criterion: 'Business Focus',
    description: 'Why chains stay focused on business success factors',
    target: 'All chains relate to competitive advantage or customer value',
    scoring: {
      excellent: 'Every why relates to market opportunity, customer value, or competitive advantage',
      good: 'Most whys business-focused, occasional drift',
      average: 'Mix of business and generic life philosophy',
      poor: 'Goes off into generic life philosophy (e.g., "why make money?")',
    },
    badExample: 'Why 3: "Why be financially independent?" → "To have freedom"',
    goodExample: 'Why 3: "Why can\'t they easily find authenticated limited editions?" → "UAE market lacks trusted authentication"',
  },
  assumptionClarity: {
    criterion: 'Assumption Clarity',
    description: 'Each level surfaces a clear, testable assumption',
    target: 'All assumptions are specific and falsifiable',
    scoring: {
      excellent: 'Every assumption is specific, falsifiable, and business-relevant',
      good: 'Most assumptions clear and testable',
      average: 'Some assumptions vague or untestable',
      poor: 'Assumptions not surfaced or too generic',
    },
  },
  chainDepth: {
    criterion: 'Chain Depth',
    description: 'Chains go deep enough to reach root causes',
    target: 'All chains reach 4-5 levels',
    scoring: {
      excellent: 'All chains reach 5 levels, root causes are actionable insights',
      good: '4-5 levels, root causes identifiable',
      average: '3 levels, surface-level root causes',
      poor: '1-2 levels, doesn\'t dig deep',
    },
  },
  parallelChains: {
    criterion: 'Parallel Chains',
    description: 'Multiple chains explore different success factors',
    target: '2-4 parallel chains exploring different angles',
    scoring: {
      excellent: '3-4 chains covering different success dimensions',
      good: '2-3 chains, good coverage',
      average: '1-2 chains, limited perspective',
      poor: 'Single chain only',
    },
  },
} as const;

// =============================================================================
// BRIDGE HINTS (for BMC)
// =============================================================================

export interface FiveWhysBridgeHints {
  /** Problems BMC must address */
  problemsToSolve: string[];
  
  /** Must-have capabilities */
  mustHaveCapabilities: string[];
  
  /** Design principles from implications */
  designPrinciples: string[];
  
  /** Assumptions BMC revenue streams must validate */
  revenueAssumptions: string[];
  
  /** Assumptions BMC value prop must address */
  valuePropositionConstraints: string[];
}

export function extractFiveWhysBridgeHints(output: FiveWhysOutput): FiveWhysBridgeHints {
  const hints: FiveWhysBridgeHints = {
    problemsToSolve: [],
    mustHaveCapabilities: [],
    designPrinciples: [],
    revenueAssumptions: [],
    valuePropositionConstraints: [],
  };
  
  // Root causes become problems to solve
  hints.problemsToSolve = output.rootCauses.map(rc => rc.cause);
  
  // Critical assumptions become constraints
  for (const assumption of output.criticalAssumptions) {
    const lower = assumption.assumption.toLowerCase();
    
    if (lower.includes('pay') || lower.includes('price') || lower.includes('revenue')) {
      hints.revenueAssumptions.push(assumption.assumption);
    } else if (lower.includes('value') || lower.includes('want') || lower.includes('need')) {
      hints.valuePropositionConstraints.push(assumption.assumption);
    }
  }
  
  // Validation priorities with high priority become must-haves
  for (const vp of output.validationPriorities) {
    if (vp.priority === 'critical') {
      hints.mustHaveCapabilities.push(`Must validate: ${vp.assumption}`);
    }
  }
  
  return hints;
}

// =============================================================================
// PROMPTS
// =============================================================================

export const FIVE_WHYS_SYSTEM_PROMPT = `You are conducting a Five Whys analysis for a NEW VENTURE. Your goal is to surface hidden assumptions about why this business would succeed.

CRITICAL RULES:
1. Stay BUSINESS-FOCUSED. Every "why" should relate to:
   - Customer value
   - Competitive advantage
   - Market opportunity
   - Business viability

2. DO NOT drift into generic life philosophy. Bad example:
   - "Why make money?" → "To be financially independent" → "To have freedom"
   
3. DO stay focused on business success. Good example:
   - "Why would collectors buy from your store?" → "Because we offer authenticated limited editions"
   - "Why can't they find authenticated editions elsewhere?" → "UAE market lacks trusted authentication"

4. Surface SPECIFIC, TESTABLE assumptions at each level.

5. Explore 2-4 PARALLEL chains from different starting points:
   - Chain 1: Why would customers choose us?
   - Chain 2: Why would our business model work?
   - Chain 3: Why would we win against competitors?
   - Chain 4: Why would this timing work?

6. Go DEEP (5 levels) to reach genuine root causes.`;
