# Premisia Module Factory Specification

## Executive Summary

**What this is:** A meta-specification that defines how to build ANY strategic framework module in a consistent, testable, reusable way.

**Why we need it:** We have 15+ modules to build. If each one is built differently, we'll spend all our time debugging inconsistencies. We need a factory that guarantees consistency.

**What it produces:** Any team member can build a new module by following this spec. The module will automatically:
- Have correct input/output contracts
- Integrate with bridges properly
- Pass standard validation
- Work with the orchestrator
- Be testable in isolation

**The promise:** Building module #15 takes the same effort as module #2. Bugs fixed in the base affect all modules.

---

## Part 1: System Architecture

### The Module System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           JOURNEY ORCHESTRATOR                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐          │
│   │POSITIONING│────▶│  MODULE  │────▶│  MODULE  │────▶│  MODULE  │          │
│   │          │     │    A     │     │    B     │     │    C     │          │
│   └──────────┘     └──────────┘     └──────────┘     └──────────┘          │
│        │               │  ▲              │  ▲              │                │
│        │               ▼  │              ▼  │              ▼                │
│        │          ┌──────────┐     ┌──────────┐     ┌──────────┐           │
│        │          │  BRIDGE  │     │  BRIDGE  │     │  BRIDGE  │           │
│        │          │  A → B   │     │  B → C   │     │ C → OUT  │           │
│        │          └──────────┘     └──────────┘     └──────────┘           │
│        │                                                                    │
│        ▼                                                                    │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                      MODULE REGISTRY                             │      │
│   │  • Validates all modules at startup                             │      │
│   │  • Ensures dependencies are satisfied                           │      │
│   │  • Ensures bridges exist between modules                        │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Module Lifecycle

Every module goes through this lifecycle:

```
1. REGISTRATION (server startup)
   └─▶ Module registers with registry
   └─▶ Registry validates contracts, dependencies, bridges
   └─▶ Registry rejects invalid modules BEFORE server starts

2. INVOCATION (journey execution)
   └─▶ Orchestrator looks up module in registry
   └─▶ Orchestrator validates input against contract
   └─▶ Orchestrator passes enriched context from bridges

3. EXECUTION (module does work)
   └─▶ Module gathers research (if needed)
   └─▶ Module constructs prompt
   └─▶ Module calls LLM
   └─▶ Module parses and validates output

4. BRIDGING (prepare for next)
   └─▶ Bridge transforms output for next module
   └─▶ Bridge adds interpretations
   └─▶ Bridge validates transformation

5. STORAGE (persist and display)
   └─▶ Output stored in journey context
   └─▶ Output stored in database
   └─▶ Output formatted for UI
```

---

## Part 2: Module Contract

### The Core Interface

Every module MUST implement this interface:

```typescript
// =============================================================================
// FILE: shared/contracts/module.contract.ts
// =============================================================================

import { z } from 'zod';

/**
 * The contract every module must fulfill
 */
export interface ModuleContract<TInput, TOutput> {
  // ─────────────────────────────────────────────────────────────────────────
  // IDENTITY
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Unique identifier (e.g., 'pestle', 'porters', 'swot') */
  id: string;
  
  /** Human-readable name (e.g., 'PESTLE Analysis') */
  name: string;
  
  /** What this module does */
  description: string;
  
  /** Semantic version */
  version: string;
  
  /** Module category */
  category: 'positioning' | 'analysis' | 'synthesis' | 'decision' | 'execution';

  // ─────────────────────────────────────────────────────────────────────────
  // CONTRACTS
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Zod schema for input validation */
  inputSchema: z.ZodSchema<TInput>;
  
  /** Zod schema for output validation */
  outputSchema: z.ZodSchema<TOutput>;

  // ─────────────────────────────────────────────────────────────────────────
  // DEPENDENCIES
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Modules that MUST run before this one */
  requiredDependencies: string[];
  
  /** Modules that CAN enhance this one (but aren't required) */
  optionalDependencies: string[];

  // ─────────────────────────────────────────────────────────────────────────
  // EXECUTION
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Execute the module */
  execute: (input: TInput, context: ExecutionContext) => Promise<TOutput>;

  // ─────────────────────────────────────────────────────────────────────────
  // QUALITY
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Criteria for scoring output quality */
  qualityCriteria: QualityCriterion[];
  
  /** Minimum acceptable quality score (1-10) */
  minimumQualityScore: number;

  // ─────────────────────────────────────────────────────────────────────────
  // PROMPTS
  // ─────────────────────────────────────────────────────────────────────────
  
  /** System prompt for LLM */
  systemPrompt: string;
  
  /** User prompt template with {{variables}} */
  userPromptTemplate: string;

  // ─────────────────────────────────────────────────────────────────────────
  // RESEARCH (optional)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Generate research queries from input */
  generateResearchQueries?: (input: TInput) => ResearchQuery[];
}
```

### Standard Schemas

These schemas are shared across ALL modules:

```typescript
// =============================================================================
// FILE: shared/contracts/common.schemas.ts
// =============================================================================

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// POSITIONING (required for ALL modules)
// ─────────────────────────────────────────────────────────────────────────────

export const PositioningSchema = z.object({
  businessConcept: z.object({
    name: z.string().min(1, 'Business name required'),
    description: z.string().min(10, 'Description too short'),
    category: z.string().min(1, 'Category required')
  }),
  market: z.object({
    industry: z.string().min(1, 'Industry required'),
    industryNarrow: z.string().optional(),
    geography: z.string().min(1, 'Geography required'),
    geographyScope: z.enum(['city', 'country', 'region', 'global'])
  }),
  customer: z.object({
    primarySegment: z.string().min(1, 'Customer segment required'),
    secondarySegments: z.array(z.string()).optional(),
    demographicProfile: z.string().optional()
  }),
  valueProposition: z.object({
    hypothesis: z.string().min(1, 'Value proposition required'),
    keyDifferentiators: z.array(z.string())
  }),
  strategicQuestion: z.string().min(1, 'Strategic question required'),
  ventureType: z.enum(['new_venture', 'existing_business'])
});

export type Positioning = z.infer<typeof PositioningSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION CONTEXT (passed to every module)
// ─────────────────────────────────────────────────────────────────────────────

export const ExecutionContextSchema = z.object({
  // Session info
  sessionId: z.string(),
  journeyId: z.string(),
  journeyType: z.string(),
  
  // Positioning (ALWAYS present)
  positioning: PositioningSchema,
  
  // Prior module outputs (keyed by module ID)
  priorOutputs: z.record(z.string(), z.unknown()),
  
  // Research findings
  research: z.object({
    queries: z.array(z.string()),
    findings: z.array(z.unknown()),
    sources: z.array(z.object({
      url: z.string().optional(),
      title: z.string(),
      date: z.string().optional(),
      type: z.string()
    }))
  }).optional()
});

export type ExecutionContext = z.infer<typeof ExecutionContextSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// BASE OUTPUT (all modules extend this)
// ─────────────────────────────────────────────────────────────────────────────

export const BaseOutputSchema = z.object({
  // Identity
  moduleId: z.string(),
  moduleVersion: z.string(),
  executedAt: z.string().datetime(),
  
  // Quality
  qualityScore: z.number().min(0).max(10),
  qualityDetails: z.array(z.object({
    criterion: z.string(),
    score: z.number().min(0).max(10),
    rationale: z.string()
  })),
  
  // Confidence
  confidenceScore: z.number().min(0).max(1),
  
  // Metadata
  metadata: z.object({
    executionTimeMs: z.number(),
    sourcesUsed: z.number(),
    limitations: z.array(z.string()),
    assumptions: z.array(z.string())
  }),
  
  // Bridge hints for downstream modules
  bridgeHints: z.record(z.string(), z.unknown())
});

export type BaseOutput = z.infer<typeof BaseOutputSchema>;
```

---

## Part 3: Bridge Contract

### The Bridge Interface

Every bridge MUST implement this interface:

```typescript
// =============================================================================
// FILE: shared/contracts/bridge.contract.ts
// =============================================================================

import { z } from 'zod';

/**
 * The contract every bridge must fulfill
 */
export interface BridgeContract<TFrom, TTo> {
  // ─────────────────────────────────────────────────────────────────────────
  // IDENTITY
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Unique identifier (e.g., 'pestle_to_porters') */
  id: string;
  
  /** Source module ID */
  fromModule: string;
  
  /** Target module ID */
  toModule: string;

  // ─────────────────────────────────────────────────────────────────────────
  // CONTRACTS
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Schema for source output */
  fromSchema: z.ZodSchema<TFrom>;
  
  /** Schema for produced input enhancement */
  toSchema: z.ZodSchema<TTo>;

  // ─────────────────────────────────────────────────────────────────────────
  // TRANSFORMATION
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Transform source output to target input enhancement */
  transform: (from: TFrom, context: BridgeContext) => Promise<TTo>;
  
  /** Interpretation rules */
  interpretationRules: InterpretationRule[];

  // ─────────────────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Validate transformation */
  validate: (from: TFrom, to: TTo) => ValidationResult;
}

/**
 * Context available to bridges
 */
export interface BridgeContext {
  positioning: Positioning;
  allPriorOutputs: Record<string, unknown>;
}

/**
 * An interpretation rule defines how to transform one piece of data
 */
export interface InterpretationRule {
  id: string;
  description: string;
  
  // Source
  sourceField: string;
  
  // Target
  targetField: string;
  
  // Transformation
  transform: (value: unknown, context: BridgeContext) => unknown;
  interpretation: string;  // Human-readable explanation
  
  // Example
  example: {
    source: unknown;
    target: unknown;
    explanation: string;
  };
}
```

### Bridge Interpretation Examples

Bridges are NOT just data reformatting. They perform cognitive interpretation:

```typescript
// Example: PESTLE → Porter's interpretation rules

const PESTLEToPortersRules: InterpretationRule[] = [
  {
    id: 'regulatory_barriers',
    description: 'Legal/regulatory factors become entry barriers',
    sourceField: 'factors.legal',
    targetField: 'forceContext.threatOfNewEntrants.regulatoryBarriers',
    
    transform: (legalFactors: PESTLEFactor[], ctx) => {
      return legalFactors
        .filter(f => f.impactScore >= 3)
        .map(f => ({
          barrier: f.factor,
          severity: f.impactScore >= 4 ? 'high' : 'medium',
          interpretation: `PESTLE found "${f.factor}" which creates regulatory barrier to entry`,
          source: `PESTLE Legal factor`
        }));
    },
    
    interpretation: 'High-impact legal requirements become barriers that deter new entrants',
    
    example: {
      source: { factor: 'UAE requires DED retail license', impactScore: 4 },
      target: { barrier: 'DED retail license requirement', severity: 'high' },
      explanation: 'Licensing requirement becomes high-severity entry barrier'
    }
  },
  
  {
    id: 'growth_attracts_entrants',
    description: 'Market growth increases threat of new entrants',
    sourceField: 'factors.economic',
    targetField: 'forceContext.threatOfNewEntrants.growthSignal',
    
    transform: (economicFactors: PESTLEFactor[], ctx) => {
      const growthFactors = economicFactors.filter(f => 
        f.factor.toLowerCase().includes('growth') && f.impact === 'opportunity'
      );
      
      if (growthFactors.length === 0) return null;
      
      return {
        hasGrowth: true,
        growthRate: extractGrowthRate(growthFactors),
        interpretation: 'Growing market attracts new entrants - INCREASES threat',
        sources: growthFactors.map(f => f.factor)
      };
    },
    
    interpretation: 'Market growth signals attract competition, increasing new entrant threat',
    
    example: {
      source: { factor: 'UAE sneaker market grew 8.3% YoY', impact: 'opportunity' },
      target: { hasGrowth: true, interpretation: 'Growing market attracts entrants' },
      explanation: 'PESTLE opportunity becomes Porter threat signal'
    }
  },
  
  {
    id: 'tech_enables_substitutes',
    description: 'Technology trends enable substitute threats',
    sourceField: 'factors.technological',
    targetField: 'forceContext.threatOfSubstitutes.techEnablers',
    
    transform: (techFactors: PESTLEFactor[], ctx) => {
      return techFactors
        .filter(f => f.factor.toLowerCase().includes('platform') || 
                     f.factor.toLowerCase().includes('online') ||
                     f.factor.toLowerCase().includes('digital'))
        .map(f => ({
          enabler: f.factor,
          substituteType: inferSubstituteType(f),
          interpretation: `Technology "${f.factor}" enables alternative channels/substitutes`,
          source: 'PESTLE Technological factor'
        }));
    },
    
    interpretation: 'Digital/platform technologies enable substitute products and channels',
    
    example: {
      source: { factor: 'Online resale platforms growing (StockX, GOAT)' },
      target: { enabler: 'Online resale platforms', substituteType: 'channel' },
      explanation: 'Platform tech becomes substitute threat'
    }
  }
];
```

---

## Part 4: Quality Criteria

### Universal Quality Criteria

These apply to EVERY module:

```typescript
// =============================================================================
// FILE: shared/contracts/quality.criteria.ts
// =============================================================================

export interface QualityCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;  // 0-1, all weights sum to 1
  
  rubric: {
    score1to3: string;
    score4to6: string;
    score7to8: string;
    score9to10: string;
  };
  
  redFlags: string[];
  
  // Automated check (if possible)
  autoCheck?: (output: unknown, input: ExecutionContext) => number;
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL CRITERIA (apply to ALL modules)
// ─────────────────────────────────────────────────────────────────────────────

export const UniversalQualityCriteria: QualityCriterion[] = [
  {
    id: 'specificity',
    name: 'Business Specificity',
    description: 'Output is specific to THIS business, not generic',
    weight: 0.25,
    
    rubric: {
      score1to3: 'Output could apply to any business anywhere',
      score4to6: 'Mentions industry/geography but not specific business',
      score7to8: 'Mentions business name, most findings are tailored',
      score9to10: 'Every finding explicitly connects to exact business positioning'
    },
    
    redFlags: [
      'Could apply to any competitor equally',
      'Says "the business" instead of actual name',
      'No mention of specific geography or customer'
    ],
    
    autoCheck: (output, ctx) => {
      const outputStr = JSON.stringify(output);
      const businessName = ctx.positioning.businessConcept.name;
      const mentions = (outputStr.match(new RegExp(businessName, 'gi')) || []).length;
      
      if (mentions >= 10) return 9;
      if (mentions >= 5) return 7;
      if (mentions >= 2) return 5;
      if (mentions >= 1) return 3;
      return 1;
    }
  },
  
  {
    id: 'evidence',
    name: 'Evidence Grounding',
    description: 'Claims are supported by cited sources',
    weight: 0.25,
    
    rubric: {
      score1to3: 'No sources cited, claims unsupported',
      score4to6: '50% of claims have sources',
      score7to8: '80%+ claims have sources with dates',
      score9to10: 'Every claim cites recent credible source'
    },
    
    redFlags: [
      '"It is well known..."',
      '"Generally speaking..."',
      'Wikipedia as primary source',
      'Sources older than 3 years'
    ],
    
    autoCheck: (output, ctx) => {
      // Count citations
      const outputStr = JSON.stringify(output);
      const citationPatterns = [
        /according to/gi,
        /source:/gi,
        /\d{4}/g,  // Years
        /https?:\/\//gi
      ];
      
      let citationScore = 0;
      for (const pattern of citationPatterns) {
        const matches = outputStr.match(pattern) || [];
        citationScore += matches.length;
      }
      
      if (citationScore >= 20) return 9;
      if (citationScore >= 10) return 7;
      if (citationScore >= 5) return 5;
      if (citationScore >= 2) return 3;
      return 1;
    }
  },
  
  {
    id: 'actionability',
    name: 'Actionability',
    description: 'Output leads to clear actions the business can take',
    weight: 0.25,
    
    rubric: {
      score1to3: 'Academic description, no action implications',
      score4to6: 'General implications stated',
      score7to8: 'Business-specific implications with responses',
      score9to10: 'Every finding has "For [business], this means X, so consider Y"'
    },
    
    redFlags: [
      'Reads like encyclopedia entry',
      'No "what to do about it" guidance',
      'Implications apply to any business'
    ],
    
    autoCheck: (output, ctx) => {
      const outputStr = JSON.stringify(output);
      const actionPatterns = [
        /this means/gi,
        /consider/gi,
        /recommend/gi,
        /should/gi,
        /action/gi,
        /implication/gi
      ];
      
      let actionScore = 0;
      for (const pattern of actionPatterns) {
        const matches = outputStr.match(pattern) || [];
        actionScore += matches.length;
      }
      
      if (actionScore >= 15) return 9;
      if (actionScore >= 10) return 7;
      if (actionScore >= 5) return 5;
      if (actionScore >= 2) return 3;
      return 1;
    }
  },
  
  {
    id: 'consistency',
    name: 'Internal Consistency',
    description: 'Output is logically consistent, no contradictions',
    weight: 0.25,
    
    rubric: {
      score1to3: 'Obvious contradictions in output',
      score4to6: 'Minor inconsistencies',
      score7to8: 'Internally consistent',
      score9to10: 'Clear logical thread throughout'
    },
    
    redFlags: [
      'Opportunity also listed as threat',
      'Strength contradicts identified weakness',
      'Numbers don\'t add up'
    ]
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// QUALITY SCORER
// ─────────────────────────────────────────────────────────────────────────────

export function scoreQuality(
  output: unknown,
  context: ExecutionContext,
  moduleCriteria: QualityCriterion[]
): QualityScore {
  const allCriteria = [...UniversalQualityCriteria, ...moduleCriteria];
  const details: QualityDetail[] = [];
  
  for (const criterion of allCriteria) {
    let score: number;
    
    if (criterion.autoCheck) {
      score = criterion.autoCheck(output, context);
    } else {
      // Default to 5 if no auto-check (needs manual review or LLM-as-judge)
      score = 5;
    }
    
    details.push({
      criterion: criterion.id,
      score,
      rationale: criterion.rubric[getScoreBand(score)]
    });
  }
  
  // Calculate weighted average
  const totalWeight = allCriteria.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = details.reduce((sum, d, i) => {
    return sum + (d.score * allCriteria[i].weight);
  }, 0);
  
  const overallScore = weightedSum / totalWeight;
  
  return {
    overallScore,
    details,
    passedMinimum: overallScore >= 7
  };
}

function getScoreBand(score: number): keyof QualityCriterion['rubric'] {
  if (score <= 3) return 'score1to3';
  if (score <= 6) return 'score4to6';
  if (score <= 8) return 'score7to8';
  return 'score9to10';
}
```

---

## Part 5: Module Template

### Creating a New Module

Copy this template and fill in the blanks:

```typescript
// =============================================================================
// FILE: server/journey/modules/[MODULE_ID]/index.ts
// =============================================================================

import { z } from 'zod';
import { 
  ModuleContract, 
  ExecutionContext, 
  BaseOutputSchema,
  PositioningSchema 
} from '@/shared/contracts';
import { scoreQuality, QualityCriterion } from '@/shared/contracts/quality.criteria';

// ─────────────────────────────────────────────────────────────────────────────
// 1. DEFINE INPUT SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const InputSchema = z.object({
  positioning: PositioningSchema,
  
  // Add prior module outputs this depends on
  // priorPestle: PESTLEOutputSchema.optional(),
  
  // Add any module-specific required inputs
});

type Input = z.infer<typeof InputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 2. DEFINE OUTPUT SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const OutputSchema = BaseOutputSchema.extend({
  // Add module-specific output fields
  // Example:
  // factors: z.object({
  //   political: z.array(FactorSchema),
  //   economic: z.array(FactorSchema),
  // }),
  
  summary: z.object({
    // Key findings summary
  })
});

type Output = z.infer<typeof OutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 3. DEFINE QUALITY CRITERIA (module-specific, adds to universal)
// ─────────────────────────────────────────────────────────────────────────────

const ModuleQualityCriteria: QualityCriterion[] = [
  // Add criteria specific to this module
  // Example for PESTLE:
  // {
  //   id: 'factor_balance',
  //   name: 'Factor Balance',
  //   description: 'Balanced coverage across all 6 PESTLE categories',
  //   weight: 0.2,
  //   rubric: { ... },
  //   redFlags: ['10 economic factors, 0 political'],
  //   autoCheck: (output) => { ... }
  // }
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. DEFINE PROMPTS
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are a strategic analyst conducting [MODULE_NAME] analysis.

## CRITICAL RULES
1. Every finding MUST be specific to {{businessName}}
2. Every claim MUST cite a source
3. Every finding MUST have an implication: "For {{businessName}}, this means..."
4. [Add module-specific rules]

## COGNITIVE PROCESS
Step 1: Define scope - state exactly what you're analyzing
Step 2: [Module-specific step]
Step 3: [Module-specific step]
Step 4: Self-validate before outputting

## OUTPUT FORMAT
Output valid JSON matching this schema:
\`\`\`typescript
${/* OutputSchema definition here */}
\`\`\`
`;

const USER_PROMPT_TEMPLATE = `
## BUSINESS CONTEXT
**Name**: {{positioning.businessConcept.name}}
**Description**: {{positioning.businessConcept.description}}
**Customer**: {{positioning.customer.primarySegment}}
**Geography**: {{positioning.market.geography}}
**Value Proposition**: {{positioning.valueProposition.hypothesis}}

## PRIOR ANALYSIS
{{priorAnalysis}}

## RESEARCH
{{research}}

## TASK
Conduct [MODULE_NAME] analysis for **{{positioning.businessConcept.name}}**.
Output as JSON.
`;

// ─────────────────────────────────────────────────────────────────────────────
// 5. IMPLEMENT EXECUTOR
// ─────────────────────────────────────────────────────────────────────────────

async function execute(input: Input, context: ExecutionContext): Promise<Output> {
  const startTime = Date.now();
  
  // 1. Validate input
  const validated = InputSchema.parse(input);
  
  // 2. Generate research queries
  const queries = generateResearchQueries(validated);
  
  // 3. Gather research (if queries exist)
  const research = queries.length > 0 
    ? await researchService.search(queries)
    : null;
  
  // 4. Build prompts
  const systemPrompt = SYSTEM_PROMPT;
  const userPrompt = renderTemplate(USER_PROMPT_TEMPLATE, {
    positioning: validated.positioning,
    priorAnalysis: formatPriorAnalysis(context.priorOutputs),
    research: formatResearch(research)
  });
  
  // 5. Call LLM
  const rawOutput = await llmService.complete(systemPrompt, userPrompt);
  
  // 6. Parse output
  const parsed = JSON.parse(rawOutput);
  
  // 7. Score quality
  const quality = scoreQuality(parsed, context, ModuleQualityCriteria);
  
  // 8. Package final output
  const output: Output = {
    ...parsed,
    moduleId: MODULE_ID,
    moduleVersion: '1.0.0',
    executedAt: new Date().toISOString(),
    qualityScore: quality.overallScore,
    qualityDetails: quality.details,
    confidenceScore: calculateConfidence(parsed, research),
    metadata: {
      executionTimeMs: Date.now() - startTime,
      sourcesUsed: research?.sources?.length || 0,
      limitations: identifyLimitations(parsed),
      assumptions: identifyAssumptions(parsed)
    },
    bridgeHints: generateBridgeHints(parsed)
  };
  
  // 9. Validate output schema
  return OutputSchema.parse(output);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function generateResearchQueries(input: Input): string[] {
  const { positioning } = input;
  return [
    `${positioning.market.geography} ${positioning.market.industry} regulations`,
    // Add more queries
  ];
}

function calculateConfidence(output: unknown, research: unknown): number {
  // Implement confidence calculation
  return 0.7;
}

function identifyLimitations(output: unknown): string[] {
  // Identify what couldn't be determined
  return [];
}

function identifyAssumptions(output: unknown): string[] {
  // Identify what was assumed
  return [];
}

function generateBridgeHints(output: unknown): Record<string, unknown> {
  // Generate hints for downstream bridges
  return {};
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. EXPORT MODULE
// ─────────────────────────────────────────────────────────────────────────────

const MODULE_ID = '[module_id]';

export const Module: ModuleContract<Input, Output> = {
  id: MODULE_ID,
  name: '[Module Name]',
  description: '[What this module does]',
  version: '1.0.0',
  category: '[category]',
  
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  
  requiredDependencies: ['positioning'],
  optionalDependencies: [],
  
  execute,
  
  qualityCriteria: ModuleQualityCriteria,
  minimumQualityScore: 7,
  
  systemPrompt: SYSTEM_PROMPT,
  userPromptTemplate: USER_PROMPT_TEMPLATE,
  
  generateResearchQueries
};
```

---

## Part 6: Bridge Template

### Creating a New Bridge

```typescript
// =============================================================================
// FILE: server/journey/bridges/[FROM]_to_[TO]/index.ts
// =============================================================================

import { z } from 'zod';
import { BridgeContract, InterpretationRule, BridgeContext } from '@/shared/contracts';
import { FromModuleOutputSchema } from '../modules/[FROM]';
import { ToModuleInputEnhancementSchema } from './schemas';

// ─────────────────────────────────────────────────────────────────────────────
// 1. DEFINE INTERPRETATION RULES
// ─────────────────────────────────────────────────────────────────────────────

const interpretationRules: InterpretationRule[] = [
  {
    id: '[rule_id]',
    description: '[What this rule does]',
    sourceField: '[source.path.to.field]',
    targetField: '[target.path.to.field]',
    
    transform: (value, context) => {
      // Transform source value to target format
      return transformedValue;
    },
    
    interpretation: '[Human-readable explanation]',
    
    example: {
      source: { /* example source data */ },
      target: { /* expected result */ },
      explanation: '[Why this makes sense]'
    }
  },
  // Add more rules...
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. IMPLEMENT TRANSFORM
// ─────────────────────────────────────────────────────────────────────────────

async function transform(
  from: FromOutput,
  context: BridgeContext
): Promise<ToInputEnhancement> {
  const result: Partial<ToInputEnhancement> = {};
  
  // Apply each interpretation rule
  for (const rule of interpretationRules) {
    const sourceValue = getNestedValue(from, rule.sourceField);
    
    if (sourceValue !== undefined) {
      const transformed = rule.transform(sourceValue, context);
      setNestedValue(result, rule.targetField, transformed);
    }
  }
  
  // Include raw source for reference
  result.sourceOutput = from;
  
  return result as ToInputEnhancement;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. IMPLEMENT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

function validate(from: FromOutput, to: ToInputEnhancement): ValidationResult {
  const errors: string[] = [];
  
  // Verify expected transformations occurred
  // Example:
  // if (from.factors?.length > 0 && !to.factorContext) {
  //   errors.push('Source had factors but target has no factor context');
  // }
  
  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. EXPORT BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

export const Bridge: BridgeContract<FromOutput, ToInputEnhancement> = {
  id: '[from]_to_[to]',
  fromModule: '[from_module_id]',
  toModule: '[to_module_id]',
  
  fromSchema: FromModuleOutputSchema,
  toSchema: ToInputEnhancementSchema,
  
  transform,
  interpretationRules,
  validate
};
```

---

## Part 7: Module Registry

### Registration and Validation

```typescript
// =============================================================================
// FILE: server/journey/registry/module.registry.ts
// =============================================================================

import { ModuleContract } from '@/shared/contracts';

class ModuleRegistry {
  private modules: Map<string, ModuleContract<unknown, unknown>> = new Map();
  
  /**
   * Register a module
   */
  register<TInput, TOutput>(module: ModuleContract<TInput, TOutput>): void {
    // Validate module definition
    this.validateDefinition(module);
    
    // Check for duplicates
    if (this.modules.has(module.id)) {
      throw new Error(`Module '${module.id}' is already registered`);
    }
    
    // Verify dependencies exist
    for (const dep of module.requiredDependencies) {
      if (dep !== 'positioning' && !this.modules.has(dep)) {
        throw new Error(
          `Module '${module.id}' requires '${dep}' which is not registered. ` +
          `Register dependencies first.`
        );
      }
    }
    
    // Register
    this.modules.set(module.id, module as ModuleContract<unknown, unknown>);
    console.log(`✓ Registered module: ${module.id} v${module.version}`);
  }
  
  /**
   * Get a module
   */
  get(id: string): ModuleContract<unknown, unknown> | undefined {
    return this.modules.get(id);
  }
  
  /**
   * Check if module exists
   */
  has(id: string): boolean {
    return this.modules.has(id);
  }
  
  /**
   * Get all modules
   */
  getAll(): ModuleContract<unknown, unknown>[] {
    return Array.from(this.modules.values());
  }
  
  /**
   * Validate module definition
   */
  private validateDefinition(module: ModuleContract<unknown, unknown>): void {
    const errors: string[] = [];
    
    if (!module.id) errors.push('Module must have id');
    if (!module.name) errors.push('Module must have name');
    if (!module.inputSchema) errors.push('Module must have inputSchema');
    if (!module.outputSchema) errors.push('Module must have outputSchema');
    if (!module.execute) errors.push('Module must have execute function');
    if (!module.qualityCriteria?.length) errors.push('Module must have quality criteria');
    if (module.minimumQualityScore === undefined) errors.push('Module must have minimumQualityScore');
    
    if (errors.length > 0) {
      throw new Error(`Invalid module definition for '${module.id}': ${errors.join(', ')}`);
    }
  }
}

export const moduleRegistry = new ModuleRegistry();
```

### Bridge Registry

```typescript
// =============================================================================
// FILE: server/journey/registry/bridge.registry.ts
// =============================================================================

import { BridgeContract } from '@/shared/contracts';

class BridgeRegistry {
  private bridges: Map<string, BridgeContract<unknown, unknown>> = new Map();
  
  /**
   * Register a bridge
   */
  register<TFrom, TTo>(bridge: BridgeContract<TFrom, TTo>): void {
    if (this.bridges.has(bridge.id)) {
      throw new Error(`Bridge '${bridge.id}' is already registered`);
    }
    
    this.bridges.set(bridge.id, bridge as BridgeContract<unknown, unknown>);
    console.log(`✓ Registered bridge: ${bridge.fromModule} → ${bridge.toModule}`);
  }
  
  /**
   * Get bridge between two modules
   */
  getBetween(fromModule: string, toModule: string): BridgeContract<unknown, unknown> | undefined {
    return this.bridges.get(`${fromModule}_to_${toModule}`);
  }
  
  /**
   * Check if bridge exists
   */
  hasBetween(fromModule: string, toModule: string): boolean {
    return this.bridges.has(`${fromModule}_to_${toModule}`);
  }
}

export const bridgeRegistry = new BridgeRegistry();
```

### Startup Validation

```typescript
// =============================================================================
// FILE: server/journey/registry/startup.validator.ts
// =============================================================================

import { moduleRegistry } from './module.registry';
import { bridgeRegistry } from './bridge.registry';
import { journeyRegistry } from './journey.registry';

/**
 * Run at server startup - validates entire journey system
 */
export function validateJourneySystem(): void {
  console.log('\n[Startup Validator] Validating journey system...\n');
  
  const errors: string[] = [];
  
  // 1. Check all journeys have their modules
  for (const journey of journeyRegistry.getAll()) {
    for (const moduleId of journey.modules) {
      if (!moduleRegistry.has(moduleId)) {
        errors.push(`Journey '${journey.id}' requires module '${moduleId}' which is not registered`);
      }
    }
  }
  
  // 2. Check bridges exist between sequential modules
  for (const journey of journeyRegistry.getAll()) {
    for (let i = 0; i < journey.modules.length - 1; i++) {
      const from = journey.modules[i];
      const to = journey.modules[i + 1];
      
      if (!bridgeRegistry.hasBetween(from, to)) {
        errors.push(`Journey '${journey.id}' requires bridge ${from} → ${to} which is not registered`);
      }
    }
  }
  
  // 3. Report results
  if (errors.length > 0) {
    console.error('[Startup Validator] ❌ VALIDATION FAILED:\n');
    errors.forEach(e => console.error(`  - ${e}`));
    throw new Error(`Journey system validation failed with ${errors.length} errors`);
  }
  
  console.log('[Startup Validator] ✓ All validations passed');
  console.log(`  - ${moduleRegistry.getAll().length} modules registered`);
  console.log(`  - ${bridgeRegistry.getAll().length} bridges registered`);
  console.log(`  - ${journeyRegistry.getAll().length} journeys available\n`);
}
```

---

## Part 8: Test Templates

### Module Test Template

```typescript
// =============================================================================
// FILE: tests/modules/[MODULE_ID].spec.ts
// =============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { Module } from '@/server/journey/modules/[MODULE_ID]';
import { createMockContext, createMockPositioning } from '@/tests/helpers';

describe('[ModuleName] Module', () => {
  
  describe('Contract Compliance', () => {
    it('has required identity fields', () => {
      expect(Module.id).toBeDefined();
      expect(Module.name).toBeDefined();
      expect(Module.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
    
    it('has required schemas', () => {
      expect(Module.inputSchema).toBeDefined();
      expect(Module.outputSchema).toBeDefined();
    });
    
    it('has quality criteria', () => {
      expect(Module.qualityCriteria.length).toBeGreaterThan(0);
      expect(Module.minimumQualityScore).toBeGreaterThanOrEqual(5);
    });
  });
  
  describe('Input Validation', () => {
    it('rejects missing positioning', () => {
      const input = {};
      expect(() => Module.inputSchema.parse(input)).toThrow();
    });
    
    it('rejects empty business name', () => {
      const input = {
        positioning: createMockPositioning({ 
          businessConcept: { name: '' } 
        })
      };
      expect(() => Module.inputSchema.parse(input)).toThrow();
    });
    
    it('accepts valid input', () => {
      const input = { positioning: createMockPositioning() };
      expect(() => Module.inputSchema.parse(input)).not.toThrow();
    });
  });
  
  describe('Execution', () => {
    it('produces valid output', async () => {
      const input = { positioning: createMockPositioning() };
      const context = createMockContext();
      
      const output = await Module.execute(input, context);
      
      expect(() => Module.outputSchema.parse(output)).not.toThrow();
    });
    
    it('includes business name in output', async () => {
      const businessName = 'Test Sneaker Store';
      const input = { 
        positioning: createMockPositioning({ 
          businessConcept: { name: businessName } 
        }) 
      };
      const context = createMockContext();
      
      const output = await Module.execute(input, context);
      
      const outputStr = JSON.stringify(output);
      expect(outputStr).toContain(businessName);
    });
    
    it('meets minimum quality score', async () => {
      const input = { positioning: createMockPositioning() };
      const context = createMockContext();
      
      const output = await Module.execute(input, context);
      
      expect(output.qualityScore).toBeGreaterThanOrEqual(Module.minimumQualityScore);
    });
  });
});
```

### Bridge Test Template

```typescript
// =============================================================================
// FILE: tests/bridges/[FROM]_to_[TO].spec.ts
// =============================================================================

import { describe, it, expect } from 'vitest';
import { Bridge } from '@/server/journey/bridges/[FROM]_to_[TO]';
import { createMockFromOutput, createMockBridgeContext } from '@/tests/helpers';

describe('[From] → [To] Bridge', () => {
  
  describe('Contract Compliance', () => {
    it('has correct module references', () => {
      expect(Bridge.fromModule).toBe('[from_module_id]');
      expect(Bridge.toModule).toBe('[to_module_id]');
    });
    
    it('has interpretation rules', () => {
      expect(Bridge.interpretationRules.length).toBeGreaterThan(0);
    });
  });
  
  describe('Transformation', () => {
    it('transforms valid input', async () => {
      const from = createMockFromOutput();
      const context = createMockBridgeContext();
      
      const to = await Bridge.transform(from, context);
      
      expect(to).toBeDefined();
    });
    
    it('applies interpretation rules', async () => {
      const from = createMockFromOutput({
        // Set up data that triggers rules
      });
      const context = createMockBridgeContext();
      
      const to = await Bridge.transform(from, context);
      
      // Verify rules were applied
      expect(to.someExpectedField).toBeDefined();
    });
  });
  
  describe('Validation', () => {
    it('passes valid transformation', async () => {
      const from = createMockFromOutput();
      const context = createMockBridgeContext();
      const to = await Bridge.transform(from, context);
      
      const result = Bridge.validate(from, to);
      
      expect(result.valid).toBe(true);
    });
  });
});
```

---

## Part 9: Module Inventory

### Modules to Build

| Module ID | Name | Category | Status | Dependencies |
|-----------|------|----------|--------|--------------|
| `positioning` | Positioning | positioning | 📋 Spec'd | - |
| `pestle` | PESTLE Analysis | analysis | 📋 Spec'd | positioning |
| `porters` | Porter's Five Forces | analysis | 📋 Spec'd | positioning, pestle |
| `swot` | SWOT Analysis | synthesis | 📋 Spec'd | positioning, pestle, porters |
| `five_whys` | Five Whys Analysis | analysis | 🔧 Exists (refactor) | positioning |
| `bmc` | Business Model Canvas | synthesis | 🔧 Exists (refactor) | positioning, five_whys |
| `ansoff` | Ansoff Matrix | analysis | ⏳ Planned | positioning |
| `blue_ocean` | Blue Ocean Strategy | synthesis | ⏳ Planned | positioning |
| `vrio` | VRIO Analysis | analysis | ⏳ Planned | positioning |
| `value_chain` | Value Chain Analysis | analysis | ⏳ Planned | positioning |
| `scenario` | Scenario Planning | synthesis | ⏳ Planned | positioning, pestle |
| `balanced_scorecard` | Balanced Scorecard | execution | ⏳ Planned | positioning |
| `okr` | OKR Framework | execution | ⏳ Planned | positioning |
| `mckinsey_7s` | McKinsey 7S | analysis | ⏳ Planned | positioning |
| `decisions` | Strategic Decisions | decision | 🔧 Exists (refactor) | varies |
| `epm` | EPM Generator | execution | 🔧 Exists (refactor) | decisions |

### Bridges to Build

| Bridge | From → To | Status |
|--------|-----------|--------|
| `positioning_to_pestle` | positioning → pestle | 📋 Spec'd |
| `positioning_to_five_whys` | positioning → five_whys | ⏳ Planned |
| `pestle_to_porters` | pestle → porters | 📋 Spec'd |
| `porters_to_swot` | porters → swot | 📋 Spec'd |
| `pestle_to_swot` | pestle → swot | 📋 Spec'd |
| `swot_to_decisions` | swot → decisions | ⏳ Planned |
| `five_whys_to_bmc` | five_whys → bmc | ⏳ Planned |
| `bmc_to_decisions` | bmc → decisions | ⏳ Planned |
| `decisions_to_epm` | decisions → epm | ⏳ Planned |

---

## Part 10: Building a New Module Checklist

When building ANY new module, follow this checklist:

```markdown
## Checklist: [MODULE_NAME]

### Phase 1: Design
- [ ] Define module purpose and strategic question
- [ ] Identify category (positioning/analysis/synthesis/decision/execution)
- [ ] List required dependencies
- [ ] List modules that will use this output
- [ ] Document cognitive steps

### Phase 2: Contracts
- [ ] Define input schema (Zod)
- [ ] Define output schema (Zod, extends BaseOutput)
- [ ] Define bridge hints structure

### Phase 3: Quality
- [ ] Define module-specific quality criteria
- [ ] Define scoring rubrics
- [ ] Define red flags
- [ ] Implement auto-checks where possible
- [ ] Set minimum quality score

### Phase 4: Implementation
- [ ] Copy module template
- [ ] Implement generateResearchQueries
- [ ] Implement execute function
- [ ] Implement helper functions
- [ ] Write system prompt
- [ ] Write user prompt template

### Phase 5: Bridges
- [ ] Create bridge FROM this module
- [ ] Create bridge TO this module
- [ ] Define interpretation rules
- [ ] Implement transforms

### Phase 6: Tests
- [ ] Contract compliance tests
- [ ] Input validation tests
- [ ] Execution tests
- [ ] Quality score tests
- [ ] Bridge tests

### Phase 7: Registration
- [ ] Register module
- [ ] Register bridges
- [ ] Run startup validation
- [ ] Verify in journey

### Phase 8: Documentation
- [ ] Add to module inventory
- [ ] Document in /docs/modules/
- [ ] Update journey docs
```

---

## Summary

This Module Factory provides:

1. **Module Contract** — Standard interface all modules implement
2. **Bridge Contract** — Standard interface all bridges implement  
3. **Quality Criteria** — Universal + module-specific criteria with auto-checks
4. **Module Template** — Copy, fill in, done
5. **Bridge Template** — Copy, fill in, done
6. **Test Templates** — Standard tests all components must pass
7. **Registry System** — Validates everything at startup
8. **Checklist** — Step-by-step process for any new module

**The Key Insight:**

Building module #15 should take the same effort as module #2. The factory ensures consistency. When we fix a bug in the base, all modules benefit. This is how we stop firefighting and start scaling.
