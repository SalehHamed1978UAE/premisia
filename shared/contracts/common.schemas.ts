/**
 * Common Schemas - Shared across all modules
 * Based on JOURNEY_MODULE_COGNITION_SPEC_FINAL.md
 */

import { z } from 'zod';

// =============================================================================
// POSITIONING (required for ALL modules)
// =============================================================================

export const PositioningSchema = z.object({
  businessConcept: z.object({
    name: z.string().min(1, 'Business name required'),
    description: z.string().min(10, 'Description too short'),
    category: z.string().min(1, 'Category required'),
  }),
  market: z.object({
    industry: z.string().min(1, 'Industry required'),
    industryNarrow: z.string().optional(),
    geography: z.string().min(1, 'Geography required'),
    geographyScope: z.enum(['city', 'country', 'region', 'global']),
  }),
  customer: z.object({
    primarySegment: z.string().min(1, 'Customer segment required'),
    secondarySegments: z.array(z.string()).optional(),
    demographicProfile: z.string().optional(),
  }),
  valueProposition: z.object({
    hypothesis: z.string().min(1, 'Value proposition required'),
    keyDifferentiators: z.array(z.string()),
  }),
  strategicQuestion: z.string().min(1, 'Strategic question required'),
  analysisScope: z.object({
    inScope: z.array(z.string()),
    outOfScope: z.array(z.string()),
    timeHorizon: z.string(),
  }).optional(),
  ventureType: z.enum(['new_venture', 'existing_business']),
});

export type Positioning = z.infer<typeof PositioningSchema>;

// =============================================================================
// CITATION (used across all research-backed modules)
// =============================================================================

export const CitationSchema = z.object({
  url: z.string().optional(),
  title: z.string(),
  date: z.string().optional(),
  type: z.string().optional(),
});

export type Citation = z.infer<typeof CitationSchema>;

// =============================================================================
// EXECUTION CONTEXT (passed to every module)
// =============================================================================

export const ExecutionContextSchema = z.object({
  sessionId: z.string(),
  journeyId: z.string().optional(),
  journeyType: z.string(),
  positioning: PositioningSchema.optional(),
  priorOutputs: z.record(z.string(), z.unknown()),
  research: z.object({
    queries: z.array(z.string()),
    findings: z.array(z.unknown()),
    sources: z.array(CitationSchema),
  }).optional(),
});

export type ExecutionContext = z.infer<typeof ExecutionContextSchema>;

// =============================================================================
// BASE OUTPUT (all modules extend this)
// =============================================================================

export const QualityDetailSchema = z.object({
  criterion: z.string(),
  score: z.number().min(0).max(10),
  rationale: z.string(),
});

export const BaseOutputSchema = z.object({
  moduleId: z.string(),
  moduleVersion: z.string(),
  executedAt: z.string(),
  qualityScore: z.number().min(0).max(10),
  qualityDetails: z.array(QualityDetailSchema),
  confidenceScore: z.number().min(0).max(1),
  metadata: z.object({
    executionTimeMs: z.number(),
    sourcesUsed: z.number(),
    limitations: z.array(z.string()),
    assumptions: z.array(z.string()),
  }),
});

export type BaseOutput = z.infer<typeof BaseOutputSchema>;
export type QualityDetail = z.infer<typeof QualityDetailSchema>;

// =============================================================================
// RESEARCH FINDINGS (used by modules that gather external data)
// =============================================================================

export const ResearchFindingSchema = z.object({
  claim: z.string(),
  evidence: z.string(),
  confidence: z.enum(['verified', 'researched', 'inferred']),
  citation: CitationSchema.optional(),
});

export const ResearchFindingsSchema = z.object({
  queries: z.array(z.string()),
  findings: z.array(ResearchFindingSchema),
  sources: z.array(CitationSchema),
  contradictions: z.array(z.object({
    claim1: z.string(),
    claim2: z.string(),
    resolution: z.string().optional(),
  })).optional(),
});

export type ResearchFinding = z.infer<typeof ResearchFindingSchema>;
export type ResearchFindings = z.infer<typeof ResearchFindingsSchema>;

// =============================================================================
// OPPORTUNITY & THREAT (common for PESTLE, SWOT)
// =============================================================================

export const OpportunitySchema = z.object({
  opportunity: z.string(),
  description: z.string(),
  magnitude: z.enum(['high', 'medium', 'low']),
  timeframe: z.string().optional(),
  sourceAnalysis: z.string().optional(),
});

export const ThreatSchema = z.object({
  threat: z.string(),
  description: z.string(),
  magnitude: z.enum(['high', 'medium', 'low']),
  likelihood: z.enum(['high', 'medium', 'low']).optional(),
  sourceAnalysis: z.string().optional(),
});

export type Opportunity = z.infer<typeof OpportunitySchema>;
export type Threat = z.infer<typeof ThreatSchema>;
