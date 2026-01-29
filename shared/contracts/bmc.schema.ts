/**
 * Business Model Canvas Module Schema
 * Based on JOURNEY_MODULE_COGNITION_SPEC_FINAL.md Part 8.5
 * 
 * Designs/analyzes the business model across 9 interconnected blocks.
 * Ensures internal consistency. Constrained by Five Whys assumptions.
 */

import { z } from 'zod';
import { PositioningOutputSchema } from './positioning.schema';
import { FiveWhysOutputSchema } from './five-whys.schema';

// =============================================================================
// INPUT SCHEMA
// =============================================================================

export const BMCInputSchema = z.object({
  positioning: PositioningOutputSchema,
  
  /** REQUIRED - assumptions constrain BMC design */
  fiveWhysOutput: FiveWhysOutputSchema,
  
  /** From web research (optional) */
  researchFindings: z.object({
    sources: z.array(z.object({
      url: z.string().optional(),
      title: z.string(),
      date: z.string().optional(),
    })),
    findings: z.array(z.object({
      claim: z.string(),
      evidence: z.string(),
      confidence: z.enum(['verified', 'researched', 'inferred']),
    })),
  }).optional(),
});

export type BMCInput = z.infer<typeof BMCInputSchema>;

// =============================================================================
// CANVAS BLOCK SCHEMA
// =============================================================================

export const CanvasBlockItemSchema = z.object({
  item: z.string(),
  rationale: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  fiveWhysConnection: z.string().optional(), // Which assumption this addresses
});

export const CanvasBlockSchema = z.object({
  block: z.string(),
  items: z.array(CanvasBlockItemSchema),
  /** What needs validation */
  keyQuestions: z.array(z.string()),
});

export type CanvasBlockItem = z.infer<typeof CanvasBlockItemSchema>;
export type CanvasBlock = z.infer<typeof CanvasBlockSchema>;

// =============================================================================
// FIVE WHYS CONNECTION SCHEMA
// =============================================================================

export const FiveWhysConnectionSchema = z.object({
  assumption: z.string(),
  affectedBlock: z.string(),
  howAddressed: z.string(),
});

export type FiveWhysConnection = z.infer<typeof FiveWhysConnectionSchema>;

// =============================================================================
// CONSISTENCY CHECK SCHEMA
// =============================================================================

export const ConsistencyCheckSchema = z.object({
  issue: z.string(),
  blocks: z.array(z.string()),
  severity: z.enum(['critical', 'warning', 'note']),
  recommendation: z.string(),
});

export type ConsistencyCheck = z.infer<typeof ConsistencyCheckSchema>;

// =============================================================================
// OUTPUT SCHEMA
// =============================================================================

export const BMCOutputSchema = z.object({
  canvas: z.object({
    customerSegments: CanvasBlockSchema,
    valuePropositions: CanvasBlockSchema,
    channels: CanvasBlockSchema,
    customerRelationships: CanvasBlockSchema,
    revenueStreams: CanvasBlockSchema,
    keyResources: CanvasBlockSchema,
    keyActivities: CanvasBlockSchema,
    keyPartnerships: CanvasBlockSchema,
    costStructure: CanvasBlockSchema,
  }),
  
  /** How Five Whys assumptions shaped the canvas */
  fiveWhysConnections: z.array(FiveWhysConnectionSchema),
  
  /** Internal consistency issues */
  consistencyChecks: z.array(ConsistencyCheckSchema),
  
  /** Overall model viability assessment */
  viabilityAssessment: z.object({
    score: z.number().min(1).max(10),
    assessment: z.enum(['viable', 'conditional', 'risky', 'not_viable']),
    rationale: z.string(),
    keyRisks: z.array(z.string()),
    keyStrengths: z.array(z.string()),
  }),
});

export type BMCOutput = z.infer<typeof BMCOutputSchema>;

// =============================================================================
// BMC BLOCK ORDER (per spec - order matters)
// =============================================================================

export const BMC_BLOCK_ORDER = [
  'customerSegments',      // 1. Who are we creating value for?
  'valuePropositions',     // 2. What value do we deliver?
  'channels',              // 3. How do we reach customers?
  'customerRelationships', // 4. How do we maintain relationships?
  'revenueStreams',        // 5. How do we make money?
  'keyResources',          // 6. What do we need to deliver value?
  'keyActivities',         // 7. What must we do well?
  'keyPartnerships',       // 8. Who helps us?
  'costStructure',         // 9. What are the major costs?
] as const;

// =============================================================================
// QUALITY RUBRIC
// =============================================================================

export const BMCQualityRubric = {
  fiveWhysIntegration: {
    criterion: 'Five Whys Integration',
    description: 'Critical assumptions from Five Whys are addressed in canvas',
    target: 'Every critical assumption mapped to a block',
    scoring: {
      excellent: 'Every critical assumption explicitly addressed in relevant block',
      good: 'Most critical assumptions addressed',
      average: 'Some assumptions addressed, others ignored',
      poor: 'Canvas designed without considering Five Whys',
    },
  },
  internalConsistency: {
    criterion: 'Internal Consistency',
    description: 'Blocks align and support each other',
    target: 'No critical inconsistencies',
    scoring: {
      excellent: 'All blocks align perfectly, value flows clearly',
      good: 'Minor inconsistencies noted, no critical issues',
      average: 'Some blocks don\'t quite fit together',
      poor: 'Major contradictions between blocks',
    },
  },
  specificity: {
    criterion: 'Specificity',
    description: 'Canvas items are specific to this business',
    target: 'All items name specific entities, channels, partners',
    scoring: {
      excellent: 'Every item names specific entity/partner/channel for this market',
      good: 'Most items specific, some generic',
      average: 'Mix of specific and generic items',
      poor: 'Generic textbook BMC, not specific to business',
    },
  },
  confidenceRealism: {
    criterion: 'Confidence Realism',
    description: 'Confidence levels reflect actual certainty',
    target: 'Confidence correlates with evidence/validation',
    scoring: {
      excellent: 'High confidence only where validated, low where assumptions',
      good: 'Generally appropriate confidence levels',
      average: 'Overconfident in some unvalidated areas',
      poor: 'All high confidence despite no validation',
    },
  },
} as const;

// =============================================================================
// CONSISTENCY CHECK RULES
// =============================================================================

export const CONSISTENCY_CHECK_RULES = [
  {
    id: 'value-segment-match',
    blocks: ['customerSegments', 'valuePropositions'],
    check: 'Each customer segment has a corresponding value proposition',
  },
  {
    id: 'channel-segment-match',
    blocks: ['customerSegments', 'channels'],
    check: 'Channels are appropriate for reaching defined segments',
  },
  {
    id: 'revenue-value-match',
    blocks: ['valuePropositions', 'revenueStreams'],
    check: 'Revenue streams align with value delivered',
  },
  {
    id: 'resource-activity-match',
    blocks: ['keyResources', 'keyActivities'],
    check: 'Resources support key activities',
  },
  {
    id: 'partnership-gap',
    blocks: ['keyPartnerships', 'keyResources'],
    check: 'Partnerships fill resource gaps',
  },
  {
    id: 'cost-activity-match',
    blocks: ['keyActivities', 'costStructure'],
    check: 'Cost structure reflects key activities',
  },
] as const;

// =============================================================================
// HELPER: Check BMC consistency
// =============================================================================

export function checkBMCConsistency(output: BMCOutput): ConsistencyCheck[] {
  const checks: ConsistencyCheck[] = [];
  
  // Check: Every customer segment should have a value proposition
  const segments = output.canvas.customerSegments.items.map(i => i.item);
  const valueProps = output.canvas.valuePropositions.items.map(i => i.item);
  
  if (segments.length > valueProps.length) {
    checks.push({
      issue: 'More customer segments than value propositions',
      blocks: ['customerSegments', 'valuePropositions'],
      severity: 'warning',
      recommendation: 'Ensure each segment has a tailored value proposition',
    });
  }
  
  // Check: Revenue streams should exist
  if (output.canvas.revenueStreams.items.length === 0) {
    checks.push({
      issue: 'No revenue streams defined',
      blocks: ['revenueStreams'],
      severity: 'critical',
      recommendation: 'Define how the business will generate revenue',
    });
  }
  
  // Check: Key activities should exist
  if (output.canvas.keyActivities.items.length === 0) {
    checks.push({
      issue: 'No key activities defined',
      blocks: ['keyActivities'],
      severity: 'critical',
      recommendation: 'Define the critical activities needed to deliver value',
    });
  }
  
  // Check: Cost structure should exist
  if (output.canvas.costStructure.items.length === 0) {
    checks.push({
      issue: 'No cost structure defined',
      blocks: ['costStructure'],
      severity: 'warning',
      recommendation: 'Define major cost drivers',
    });
  }
  
  return checks;
}

// =============================================================================
// BRIDGE HINTS (for Strategic Decisions)
// =============================================================================

export interface BMCBridgeHints {
  /** Key decisions needed based on canvas */
  decisionAreas: {
    area: string;
    options: string[];
    block: string;
  }[];
  
  /** High-risk assumptions needing validation */
  validationNeeded: string[];
  
  /** Key questions from all blocks */
  openQuestions: string[];
}

export function extractBMCBridgeHints(output: BMCOutput): BMCBridgeHints {
  const hints: BMCBridgeHints = {
    decisionAreas: [],
    validationNeeded: [],
    openQuestions: [],
  };
  
  // Extract key questions from all blocks
  for (const [blockName, block] of Object.entries(output.canvas)) {
    hints.openQuestions.push(...block.keyQuestions);
    
    // Low confidence items need validation
    for (const item of block.items) {
      if (item.confidence === 'low') {
        hints.validationNeeded.push(`${blockName}: ${item.item}`);
      }
    }
  }
  
  // Consistency issues become decision areas
  for (const check of output.consistencyChecks) {
    if (check.severity === 'critical' || check.severity === 'warning') {
      hints.decisionAreas.push({
        area: check.issue,
        options: [check.recommendation],
        block: check.blocks.join(', '),
      });
    }
  }
  
  return hints;
}
