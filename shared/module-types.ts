/**
 * MODULE TYPE REGISTRY
 * Single source of truth for all data types that flow between modules.
 * Adding a new type requires updating this file ONLY.
 */

import { z } from 'zod';

export const ModuleTypeEnum = z.enum(['ai_analyzer', 'user_input', 'generator', 'internal']);
export type ModuleTypeValue = z.infer<typeof ModuleTypeEnum>;

export const SWOTFactorSchema = z.object({
  factor: z.string(),
  description: z.string(),
  importance: z.enum(['high', 'medium', 'low']),
  evidence: z.string().optional(),
});

export const SWOTOutputSchema = z.object({
  strengths: z.array(SWOTFactorSchema),
  weaknesses: z.array(SWOTFactorSchema),
  opportunities: z.array(SWOTFactorSchema),
  threats: z.array(SWOTFactorSchema),
  strategicOptions: z.object({
    soStrategies: z.array(z.string()),
    woStrategies: z.array(z.string()),
    stStrategies: z.array(z.string()),
    wtStrategies: z.array(z.string()),
  }).optional(),
  priorityActions: z.array(z.string()).optional(),
  confidence: z.number().optional(),
  metadata: z.object({
    inputSources: z.array(z.string()),
    analysisDepth: z.enum(['basic', 'enhanced']),
    generatedAt: z.string(),
  }).optional(),
});

export const BMCBlockSchema = z.object({
  blockName: z.string(),
  description: z.string(),
  items: z.array(z.string()).optional(),
  confidence: z.number().optional(),
});

export const BMCOutputSchema = z.object({
  blocks: z.array(BMCBlockSchema).optional(),
  customerSegments: z.string().optional(),
  valuePropositions: z.string().optional(),
  channels: z.string().optional(),
  customerRelationships: z.string().optional(),
  revenueStreams: z.string().optional(),
  keyActivities: z.string().optional(),
  keyResources: z.string().optional(),
  keyPartnerships: z.string().optional(),
  costStructure: z.string().optional(),
  contradictions: z.array(z.any()).optional(),
  recommendations: z.array(z.string()).optional(),
  executiveSummary: z.string().optional(),
});

export const PortersForceSchema = z.object({
  name: z.string(),
  intensity: z.enum(['low', 'medium', 'high']),
  description: z.string(),
  factors: z.array(z.string()),
  confidence: z.number().optional(),
});

export const PortersOutputSchema = z.object({
  forces: z.record(PortersForceSchema).optional(),
  buyerPower: PortersForceSchema.optional(),
  supplierPower: PortersForceSchema.optional(),
  newEntrantsThreat: PortersForceSchema.optional(),
  substitutesThreat: PortersForceSchema.optional(),
  competitiveRivalry: PortersForceSchema.optional(),
  overallAttractiveness: z.string().optional(),
  strategicImplications: z.array(z.string()).optional(),
  confidence: z.number().optional(),
});

export const PESTLEFactorSchema = z.object({
  category: z.enum(['political', 'economic', 'social', 'technological', 'legal', 'environmental']),
  factor: z.string(),
  description: z.string(),
  impact: z.enum(['positive', 'negative', 'neutral']),
  probability: z.enum(['low', 'medium', 'high']),
  timeframe: z.enum(['short', 'medium', 'long']).optional(),
  sources: z.array(z.string()).optional(),
});

export const PESTLEOutputSchema = z.object({
  factors: z.array(PESTLEFactorSchema),
  summary: z.string().optional(),
  recommendations: z.array(z.string()).optional(),
  confidence: z.number().optional(),
});

export const FiveWhysNodeSchema = z.object({
  id: z.string(),
  level: z.number(),
  content: z.string(),
  evidence: z.string().optional(),
  parentId: z.string().nullable(),
});

export const FiveWhysOutputSchema = z.object({
  problemStatement: z.string(),
  whyNodes: z.array(FiveWhysNodeSchema),
  rootCauses: z.array(z.string()),
  assumptions: z.array(z.string()).optional(),
  confidence: z.number().optional(),
});

export const AnsoffOutputSchema = z.object({
  marketPenetration: z.object({
    strategies: z.array(z.string()),
    risk: z.enum(['low', 'medium', 'high']),
    description: z.string(),
  }),
  marketDevelopment: z.object({
    strategies: z.array(z.string()),
    risk: z.enum(['low', 'medium', 'high']),
    description: z.string(),
  }),
  productDevelopment: z.object({
    strategies: z.array(z.string()),
    risk: z.enum(['low', 'medium', 'high']),
    description: z.string(),
  }),
  diversification: z.object({
    strategies: z.array(z.string()),
    risk: z.enum(['low', 'medium', 'high']),
    description: z.string(),
  }),
  recommendation: z.string(),
  confidence: z.number().optional(),
});

export const BlueOceanOutputSchema = z.object({
  currentState: z.object({
    factors: z.array(z.object({
      name: z.string(),
      currentLevel: z.number(),
      industryAverage: z.number(),
    })),
  }),
  strategyCanvas: z.object({
    eliminate: z.array(z.string()),
    reduce: z.array(z.string()),
    raise: z.array(z.string()),
    create: z.array(z.string()),
  }),
  newValueCurve: z.array(z.object({
    name: z.string(),
    proposedLevel: z.number(),
  })),
  confidence: z.number().optional(),
});

export const BCGMatrixOutputSchema = z.object({
  units: z.array(z.object({
    name: z.string(),
    marketGrowth: z.enum(['low', 'high']),
    marketShare: z.enum(['low', 'high']),
    quadrant: z.enum(['star', 'cash_cow', 'question_mark', 'dog']),
    recommendation: z.string(),
  })),
  portfolioAnalysis: z.string(),
  confidence: z.number().optional(),
});

export const ValueChainOutputSchema = z.object({
  primaryActivities: z.array(z.object({
    name: z.string(),
    description: z.string(),
    valueAdded: z.enum(['low', 'medium', 'high']),
    costDriver: z.boolean(),
  })),
  supportActivities: z.array(z.object({
    name: z.string(),
    description: z.string(),
    valueAdded: z.enum(['low', 'medium', 'high']),
  })),
  competitiveAdvantages: z.array(z.string()),
  improvementOpportunities: z.array(z.string()),
  confidence: z.number().optional(),
});

export const VRIOOutputSchema = z.object({
  resources: z.array(z.object({
    name: z.string(),
    valuable: z.boolean(),
    rare: z.boolean(),
    imitable: z.boolean(),
    organized: z.boolean(),
    competitiveImplication: z.enum(['disadvantage', 'parity', 'temporary_advantage', 'sustained_advantage']),
  })),
  sustainedAdvantages: z.array(z.string()),
  recommendations: z.array(z.string()),
  confidence: z.number().optional(),
});

export const ScenarioPlanningOutputSchema = z.object({
  scenarios: z.array(z.object({
    name: z.string(),
    description: z.string(),
    probability: z.enum(['low', 'medium', 'high']),
    impact: z.enum(['low', 'medium', 'high']),
    keyDrivers: z.array(z.string()),
    strategicResponse: z.string(),
  })),
  robustStrategies: z.array(z.string()),
  earlyWarningSignals: z.array(z.string()),
  confidence: z.number().optional(),
});

export const JobsToBeDoneOutputSchema = z.object({
  jobs: z.array(z.object({
    job: z.string(),
    type: z.enum(['functional', 'emotional', 'social']),
    importance: z.enum(['low', 'medium', 'high']),
    currentSatisfaction: z.enum(['unmet', 'partially_met', 'met', 'overserved']),
    opportunities: z.array(z.string()),
  })),
  prioritizedJobs: z.array(z.string()),
  recommendations: z.array(z.string()),
  confidence: z.number().optional(),
});

export const OKROutputSchema = z.object({
  objectives: z.array(z.object({
    objective: z.string(),
    timeframe: z.string(),
    keyResults: z.array(z.object({
      keyResult: z.string(),
      metric: z.string(),
      target: z.string(),
      baseline: z.string().optional(),
    })),
  })),
  alignmentNotes: z.string().optional(),
  confidence: z.number().optional(),
});

export const StrategicContextSchema = z.object({
  userInput: z.string(),
  companyContext: z.string().optional(),
  industry: z.string().optional(),
  goals: z.array(z.string()).optional(),
  entities: z.array(z.any()).optional(),
  classification: z.any().optional(),
});

export const BusinessContextSchema = z.object({
  description: z.string(),
  industry: z.string().optional(),
  location: z.string().optional(),
  goals: z.array(z.string()).optional(),
  challenges: z.array(z.string()).optional(),
});

export const StrategicDecisionsOutputSchema = z.object({
  decisions: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    rationale: z.string(),
    risks: z.array(z.string()).optional(),
  })),
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  goDecision: z.enum(['go', 'no_go', 'conditional']).optional(),
  priorities: z.array(z.string()).optional(),
});

export const EPMProgramSchema = z.object({
  programName: z.string(),
  executiveSummary: z.any(),
  workstreams: z.array(z.any()),
  timeline: z.any(),
  resourcePlan: z.any(),
  financialPlan: z.any(),
  benefitsRealization: z.any(),
  riskRegister: z.any(),
  stageGates: z.any(),
  kpis: z.any(),
  stakeholderMap: z.any(),
  governance: z.any(),
  qaPlan: z.any(),
  procurement: z.any(),
  exitStrategy: z.any(),
});

export const MODULE_DATA_TYPES = {
  business_context: {
    description: 'Raw business description and context',
    schema: BusinessContextSchema,
  },
  strategic_context: {
    description: 'Processed strategic understanding with entities and classification',
    schema: StrategicContextSchema,
  },
  swot_output: {
    description: 'SWOT analysis results',
    schema: SWOTOutputSchema,
  },
  bmc_output: {
    description: 'Business Model Canvas results',
    schema: BMCOutputSchema,
  },
  porters_output: {
    description: "Porter's Five Forces results",
    schema: PortersOutputSchema,
  },
  pestle_output: {
    description: 'PESTLE analysis results',
    schema: PESTLEOutputSchema,
  },
  five_whys_output: {
    description: 'Five Whys root cause analysis results',
    schema: FiveWhysOutputSchema,
  },
  ansoff_output: {
    description: 'Ansoff Matrix growth strategy results',
    schema: AnsoffOutputSchema,
  },
  blue_ocean_output: {
    description: 'Blue Ocean Strategy results',
    schema: BlueOceanOutputSchema,
  },
  bcg_matrix_output: {
    description: 'BCG Matrix portfolio analysis results',
    schema: BCGMatrixOutputSchema,
  },
  value_chain_output: {
    description: 'Value Chain analysis results',
    schema: ValueChainOutputSchema,
  },
  vrio_output: {
    description: 'VRIO resource analysis results',
    schema: VRIOOutputSchema,
  },
  scenario_planning_output: {
    description: 'Scenario Planning results',
    schema: ScenarioPlanningOutputSchema,
  },
  jobs_to_be_done_output: {
    description: 'Jobs-to-be-Done analysis results',
    schema: JobsToBeDoneOutputSchema,
  },
  okr_output: {
    description: 'OKR generation results',
    schema: OKROutputSchema,
  },
  strategic_decisions_output: {
    description: 'Strategic decisions from user',
    schema: StrategicDecisionsOutputSchema,
  },
  epm_program: {
    description: 'Complete EPM program output',
    schema: EPMProgramSchema,
  },
} as const;

export type ModuleDataType = keyof typeof MODULE_DATA_TYPES;

export type SWOTOutput = z.infer<typeof SWOTOutputSchema>;
export type BMCOutput = z.infer<typeof BMCOutputSchema>;
export type PortersOutput = z.infer<typeof PortersOutputSchema>;
export type PESTLEOutput = z.infer<typeof PESTLEOutputSchema>;
export type FiveWhysOutput = z.infer<typeof FiveWhysOutputSchema>;
export type AnsoffOutput = z.infer<typeof AnsoffOutputSchema>;
export type BlueOceanOutput = z.infer<typeof BlueOceanOutputSchema>;
export type BCGMatrixOutput = z.infer<typeof BCGMatrixOutputSchema>;
export type ValueChainOutput = z.infer<typeof ValueChainOutputSchema>;
export type VRIOOutput = z.infer<typeof VRIOOutputSchema>;
export type ScenarioPlanningOutput = z.infer<typeof ScenarioPlanningOutputSchema>;
export type JobsToBeDoneOutput = z.infer<typeof JobsToBeDoneOutputSchema>;
export type OKROutput = z.infer<typeof OKROutputSchema>;
export type StrategicContext = z.infer<typeof StrategicContextSchema>;
export type BusinessContext = z.infer<typeof BusinessContextSchema>;
export type StrategicDecisionsOutput = z.infer<typeof StrategicDecisionsOutputSchema>;
export type EPMProgram = z.infer<typeof EPMProgramSchema>;
