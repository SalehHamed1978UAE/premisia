/**
 * Positioning Module Schema
 * Based on JOURNEY_MODULE_COGNITION_SPEC_FINAL.md Part 4
 * 
 * The Positioning Module establishes the precise scope and context for all downstream analysis.
 * Without positioning, every downstream framework produces generic garbage.
 */

import { z } from 'zod';

// =============================================================================
// INPUT SCHEMA
// =============================================================================

export const PositioningInputSchema = z.object({
  /** Raw user description of the business */
  userInput: z.string().min(1, 'User input required'),
  
  /** Clarifications from ambiguity resolution */
  clarifications: z.object({
    targetMarket: z.string().optional(),
    customerSegment: z.string().optional(),
    geographicScope: z.string().optional(),
    timeHorizon: z.string().optional(),
  }).optional(),
});

export type PositioningInput = z.infer<typeof PositioningInputSchema>;

// =============================================================================
// OUTPUT SCHEMA
// =============================================================================

export const PositioningOutputSchema = z.object({
  businessConcept: z.object({
    /** e.g., "Premium Basketball Sneaker Store" */
    name: z.string().min(1),
    /** One paragraph summary */
    description: z.string().min(10),
    /** e.g., "Specialty Retail" */
    category: z.string().min(1),
  }),
  
  market: z.object({
    /** e.g., "Athletic Footwear Retail" */
    industry: z.string().min(1),
    /** e.g., "Premium/Collector Sneakers" */
    industryNarrow: z.string().optional(),
    /** e.g., "Abu Dhabi, UAE" */
    geography: z.string().min(1),
    geographyScope: z.enum(['city', 'country', 'region', 'global']),
  }),
  
  customer: z.object({
    /** e.g., "Sneaker collectors and enthusiasts" */
    primarySegment: z.string().min(1),
    /** e.g., ["Athletes", "Fashion-conscious youth"] */
    secondarySegments: z.array(z.string()).optional(),
    /** e.g., "Males 18-35, middle-to-high income" */
    demographicProfile: z.string().optional(),
  }),
  
  valueProposition: z.object({
    /** e.g., "Authentic limited-edition sneakers with verification" */
    hypothesis: z.string().min(1),
    /** e.g., ["Authentication", "Exclusive releases", "Expert curation"] */
    keyDifferentiators: z.array(z.string()),
  }),
  
  /** e.g., "Should we enter this market and how?" */
  strategicQuestion: z.string().min(1),
  
  analysisScope: z.object({
    /** e.g., ["UAE market", "Physical retail", "E-commerce"] */
    inScope: z.array(z.string()),
    /** e.g., ["Wholesale", "Manufacturing"] */
    outOfScope: z.array(z.string()),
    /** e.g., "12-month launch plan" */
    timeHorizon: z.string(),
  }),
  
  /** Critical for S/W assessment in SWOT */
  ventureType: z.enum(['new_venture', 'existing_business']),
});

export type PositioningOutput = z.infer<typeof PositioningOutputSchema>;

// =============================================================================
// QUALITY CRITERIA
// =============================================================================

export const PositioningQualityCriteria = {
  specificity: {
    name: 'Specificity',
    description: 'Business concept names specific offering, not generic',
    measure: 'Business name specificity check',
    badExample: 'retail business',
    goodExample: 'Premium basketball sneaker store',
  },
  geographicAnchor: {
    name: 'Geographic Anchor',
    description: 'Geography defined to city/country level',
    measure: 'Geography field has specific location',
    badExample: 'somewhere in Middle East',
    goodExample: 'Abu Dhabi, UAE',
  },
  customerClarity: {
    name: 'Customer Clarity',
    description: 'Target segment is identifiable and specific',
    measure: 'Primary segment describes specific group',
    badExample: 'people who buy things',
    goodExample: 'Sneaker collectors aged 25-45',
  },
  testableValueProp: {
    name: 'Testable Value Proposition',
    description: 'Value proposition can be validated/invalidated',
    measure: 'Hypothesis is concrete and measurable',
    badExample: "we'll be the best",
    goodExample: 'Authenticated limited editions with collector community',
  },
} as const;

// =============================================================================
// HELPER: Extract positioning from user input
// =============================================================================

export function extractPositioningFromUserInput(userInput: string): Partial<PositioningOutput> {
  // This is a simple extraction helper - the actual extraction happens via LLM
  return {
    businessConcept: {
      name: '',
      description: userInput,
      category: '',
    },
    market: {
      industry: '',
      geography: '',
      geographyScope: 'country',
    },
    customer: {
      primarySegment: '',
    },
    valueProposition: {
      hypothesis: '',
      keyDifferentiators: [],
    },
    strategicQuestion: 'Should we pursue this business opportunity?',
    analysisScope: {
      inScope: [],
      outOfScope: [],
      timeHorizon: '12 months',
    },
    ventureType: 'new_venture',
  };
}
