/**
 * Porter's Five Forces Module Schema
 * Based on JOURNEY_MODULE_COGNITION_SPEC_FINAL.md Part 8.2
 * 
 * Analyzes competitive dynamics within the industry.
 * Understands who has power and how intense competition is.
 */

import { z } from 'zod';
import { CitationSchema } from './common.schemas';
import { PositioningOutputSchema } from './positioning.schema';
import { PESTLEOutputSchema } from './pestle.schema';

// =============================================================================
// INPUT SCHEMA
// =============================================================================

export const PortersInputSchema = z.object({
  /** Business and industry definition */
  positioning: PositioningOutputSchema,
  
  /** REQUIRED - macro context affects forces */
  pestleOutput: PESTLEOutputSchema,
  
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

export type PortersInput = z.infer<typeof PortersInputSchema>;

// =============================================================================
// FORCE ANALYSIS SCHEMA
// =============================================================================

export const ForceAnalysisSchema = z.object({
  force: z.string(),
  score: z.number().min(1).max(10),
  level: z.enum(['very_low', 'low', 'medium', 'high', 'very_high']),
  drivers: z.array(z.string()),
  evidence: z.array(z.string()),
  /** Which PESTLE factors inform this force */
  pestleReferences: z.array(z.string()),
  /** What to do about this force */
  strategicResponse: z.string(),
});

export type ForceAnalysis = z.infer<typeof ForceAnalysisSchema>;

// =============================================================================
// PESTLE CONNECTION SCHEMA
// =============================================================================

export const PESTLEConnectionSchema = z.object({
  pestleFactor: z.string(),
  pestleCategory: z.enum(['P', 'E', 'S', 'T', 'L', 'Env']),
  affectedForce: z.enum([
    'threatOfNewEntrants',
    'supplierPower', 
    'buyerPower',
    'threatOfSubstitutes',
    'competitiveRivalry',
  ]),
  howItAffects: z.string(),
  direction: z.enum(['increases', 'decreases']),
});

export type PESTLEConnection = z.infer<typeof PESTLEConnectionSchema>;

// =============================================================================
// OUTPUT SCHEMA
// =============================================================================

export const PortersOutputSchema = z.object({
  industryDefinition: z.string(),
  
  forces: z.object({
    threatOfNewEntrants: ForceAnalysisSchema,
    supplierPower: ForceAnalysisSchema,
    buyerPower: ForceAnalysisSchema,
    threatOfSubstitutes: ForceAnalysisSchema,
    competitiveRivalry: ForceAnalysisSchema,
  }),
  
  overallAttractiveness: z.object({
    score: z.number().min(1).max(10),
    assessment: z.enum(['attractive', 'moderate', 'unattractive']),
    rationale: z.string(),
  }),
  
  strategicImplications: z.array(z.string()),
  
  /** How PESTLE factors map to forces */
  pestleConnections: z.array(PESTLEConnectionSchema),
  
  /** Named competitors discovered */
  competitorsIdentified: z.array(z.string()),
  
  /** Named suppliers discovered */
  suppliersIdentified: z.array(z.string()),
  
  /** Named substitutes discovered */
  substitutesIdentified: z.array(z.string()),
});

export type PortersOutput = z.infer<typeof PortersOutputSchema>;

// =============================================================================
// QUALITY RUBRIC (1-10 Scale)
// =============================================================================

export const PortersQualityRubric = {
  pestleIntegration: {
    criterion: 'PESTLE Integration',
    description: 'Each force explicitly references PESTLE factors',
    target: '≥1 PESTLE reference per force',
    scoring: {
      excellent: 'Every force cites 2+ PESTLE factors with transformation logic',
      good: 'Most forces reference PESTLE, connection clear',
      average: 'Some PESTLE references, forces mostly analyzed independently',
      poor: 'No explicit PESTLE connection',
    },
  },
  competitorSpecificity: {
    criterion: 'Competitor Specificity',
    description: 'Names specific competitors with details',
    target: '≥3 competitors named',
    scoring: {
      excellent: 'Names 5+ competitors with specific strengths/weaknesses',
      good: 'Names 3-4 competitors with general characterization',
      average: '1-2 competitors named',
      poor: 'No specific competitors identified',
    },
  },
  strategicResponse: {
    criterion: 'Strategic Response Quality',
    description: 'Each force has actionable strategic response',
    target: 'Specific response per force',
    scoring: {
      excellent: 'Each force has specific, actionable response with timeframe',
      good: 'Strategic responses present but somewhat generic',
      average: 'Forces rated but responses vague',
      poor: 'No strategic responses',
    },
  },
} as const;

// =============================================================================
// PESTLE → PORTER'S TRANSFORMATION RULES
// =============================================================================

export interface PESTLEToPortersTransformation {
  sourceCategory: 'P' | 'E' | 'S' | 'T' | 'L' | 'Env';
  targetForce: keyof PortersOutput['forces'];
  logic: string;
  example: {
    pestleFactor: string;
    porterEffect: string;
  };
}

export const PESTLE_TO_PORTERS_MAPPINGS: PESTLEToPortersTransformation[] = [
  {
    sourceCategory: 'L',
    targetForce: 'threatOfNewEntrants',
    logic: 'Complex licensing/regulatory requirements create barriers to entry',
    example: {
      pestleFactor: 'UAE retail license requires local sponsor',
      porterEffect: 'Entry barrier for foreign competitors',
    },
  },
  {
    sourceCategory: 'L',
    targetForce: 'supplierPower',
    logic: 'Import regulations limit supplier options, increasing their power',
    example: {
      pestleFactor: 'Footwear import requires product registration',
      porterEffect: 'Limits supplier alternatives, increases power',
    },
  },
  {
    sourceCategory: 'E',
    targetForce: 'buyerPower',
    logic: 'High consumer spending reduces price sensitivity (lower buyer power)',
    example: {
      pestleFactor: 'Abu Dhabi high disposable income',
      porterEffect: 'Collectors less price-sensitive, lower buyer power',
    },
  },
  {
    sourceCategory: 'E',
    targetForce: 'competitiveRivalry',
    logic: 'Fast market growth means room for all, reducing rivalry intensity',
    example: {
      pestleFactor: 'UAE sneaker market +8% YoY',
      porterEffect: 'Expanding pie reduces direct competition',
    },
  },
  {
    sourceCategory: 'T',
    targetForce: 'threatOfSubstitutes',
    logic: 'High digital adoption enables online alternatives as substitutes',
    example: {
      pestleFactor: 'UAE 99% internet penetration',
      porterEffect: 'Online resale platforms are strong substitutes',
    },
  },
  {
    sourceCategory: 'T',
    targetForce: 'threatOfNewEntrants',
    logic: 'Available authentication tech lowers barrier for authenticator entrants',
    example: {
      pestleFactor: 'AI authentication services emerging',
      porterEffect: 'Easier for new authenticators to enter',
    },
  },
  {
    sourceCategory: 'S',
    targetForce: 'buyerPower',
    logic: 'Strong sneaker culture creates passionate buyers (lower buyer power)',
    example: {
      pestleFactor: 'Sneakerhead community growing in UAE',
      porterEffect: 'Passionate buyers less price-sensitive',
    },
  },
  {
    sourceCategory: 'P',
    targetForce: 'supplierPower',
    logic: 'Favorable trade agreements give more supplier access (lower power)',
    example: {
      pestleFactor: 'UAE-US free trade',
      porterEffect: 'Easy access to US sneaker suppliers',
    },
  },
  {
    sourceCategory: 'Env',
    targetForce: 'threatOfNewEntrants',
    logic: 'Strict sustainability requirements create compliance cost barriers',
    example: {
      pestleFactor: 'UAE sustainability targets',
      porterEffect: 'New entrants must meet standards, barrier',
    },
  },
];

// =============================================================================
// BRIDGE HINTS (for SWOT)
// =============================================================================

export interface PortersBridgeHints {
  /** Low forces = opportunities */
  opportunityForces: {
    force: string;
    level: string;
    interpretation: string;
  }[];
  
  /** High forces = threats */
  threatForces: {
    force: string;
    level: string;
    interpretation: string;
  }[];
  
  /** Competitor weaknesses = opportunities */
  competitorWeaknesses: string[];
  
  /** Competitor strengths = threats */
  competitorStrengths: string[];
}

export function extractPortersBridgeHints(output: PortersOutput): PortersBridgeHints {
  const hints: PortersBridgeHints = {
    opportunityForces: [],
    threatForces: [],
    competitorWeaknesses: [],
    competitorStrengths: [],
  };
  
  // Map forces to opportunities/threats
  const forceEntries = Object.entries(output.forces) as [string, ForceAnalysis][];
  
  for (const [forceName, forceData] of forceEntries) {
    if (forceData.level === 'very_low' || forceData.level === 'low') {
      hints.opportunityForces.push({
        force: forceName,
        level: forceData.level,
        interpretation: `Low ${forceName.replace(/([A-Z])/g, ' $1').trim()} creates favorable conditions`,
      });
    } else if (forceData.level === 'very_high' || forceData.level === 'high') {
      hints.threatForces.push({
        force: forceName,
        level: forceData.level,
        interpretation: `High ${forceName.replace(/([A-Z])/g, ' $1').trim()} creates competitive pressure`,
      });
    }
  }
  
  return hints;
}
