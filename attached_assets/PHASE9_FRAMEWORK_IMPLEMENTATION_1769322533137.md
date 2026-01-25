# Phase 9: Framework Implementation & Data Architecture

**Date:** January 25, 2026
**Prerequisite:** Phase 8 (Journey Builder) complete
**Goal:** Build the data flow architecture and implement the 12 stub frameworks

---

## Overview

Currently we have 18 modules registered:
- **6 Implemented:** Input Processor, Five Whys, BMC, Segment Discovery, Porter's Five Forces, EPM Generator
- **12 Stubs:** Return mock data after 2-3 second delay

This phase covers three major areas:
1. **9.0: Data Architecture** - Type registry, transformers, context accumulation
2. **9.1: EPM Readiness Layer** - Gap analysis and smart gap filler before EPM
3. **9.2+: Framework Implementations** - The 12 stub frameworks

---

## 9.0: Data Architecture

### The Problem
Modules produce different output types. When connecting Module A → Module B, we need:
1. A way to know if the connection is valid
2. A way to transform A's output into B's expected input format
3. A central accumulator to build up strategic context across the journey

### 9.0.1: Data Type Registry

**File:** `server/journey/types/type-registry.ts`

```typescript
/**
 * Type Registry - Defines all module input/output schemas
 * Used for validation and transformation between modules
 */

export interface TypeSchema {
  id: string;
  name: string;
  description: string;
  jsonSchema: any;  // JSON Schema for validation
  category: 'input' | 'output' | 'intermediate';
}

// Register all known types
export const TYPE_REGISTRY: Record<string, TypeSchema> = {
  // Input types
  'business_context': {
    id: 'business_context',
    name: 'Business Context',
    description: 'Raw business description and context',
    category: 'input',
    jsonSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        industry: { type: 'string' },
        scale: { type: 'string' },
        geography: { type: 'string' },
      },
      required: ['description'],
    },
  },

  // Output types
  'bmc_output': {
    id: 'bmc_output',
    name: 'Business Model Canvas',
    description: 'Complete BMC with all 9 building blocks',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        valuePropositions: { type: 'array' },
        customerSegments: { type: 'array' },
        channels: { type: 'array' },
        customerRelationships: { type: 'array' },
        revenueStreams: { type: 'array' },
        keyResources: { type: 'array' },
        keyActivities: { type: 'array' },
        keyPartners: { type: 'array' },
        costStructure: { type: 'array' },
      },
    },
  },

  'swot_output': {
    id: 'swot_output',
    name: 'SWOT Analysis',
    description: 'Strengths, Weaknesses, Opportunities, Threats with strategies',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        strengths: { type: 'array' },
        weaknesses: { type: 'array' },
        opportunities: { type: 'array' },
        threats: { type: 'array' },
        strategicOptions: { type: 'object' },
      },
    },
  },

  'pestle_output': {
    id: 'pestle_output',
    name: 'PESTLE Analysis',
    description: 'Macro-environmental analysis',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        political: { type: 'array' },
        economic: { type: 'array' },
        social: { type: 'array' },
        technological: { type: 'array' },
        legal: { type: 'array' },
        environmental: { type: 'array' },
      },
    },
  },

  'segment_output': {
    id: 'segment_output',
    name: 'Segment Discovery Output',
    description: 'Discovered customer segments with profiles',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        segments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              size: { type: 'string' },
              characteristics: { type: 'array' },
            },
          },
        },
        recommendation: { type: 'object' },
      },
    },
  },

  'porters_output': {
    id: 'porters_output',
    name: "Porter's Five Forces",
    description: 'Competitive analysis with force ratings',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        competitiveRivalry: { type: 'object' },
        supplierPower: { type: 'object' },
        buyerPower: { type: 'object' },
        threatOfSubstitution: { type: 'object' },
        threatOfNewEntry: { type: 'object' },
      },
    },
  },

  'ansoff_output': {
    id: 'ansoff_output',
    name: 'Ansoff Matrix',
    description: 'Growth strategy recommendations',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        marketPenetration: { type: 'object' },
        marketDevelopment: { type: 'object' },
        productDevelopment: { type: 'object' },
        diversification: { type: 'object' },
        recommendation: { type: 'object' },
      },
    },
  },

  'jtbd_output': {
    id: 'jtbd_output',
    name: 'Jobs To Be Done',
    description: 'Customer jobs and opportunities',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        coreJobs: { type: 'array' },
        relatedJobs: { type: 'array' },
        opportunities: { type: 'object' },
      },
    },
  },

  'epm_output': {
    id: 'epm_output',
    name: 'Execution Plan',
    description: 'Complete execution plan with workstreams and milestones',
    category: 'output',
    jsonSchema: {
      type: 'object',
      properties: {
        workstreams: { type: 'array' },
        milestones: { type: 'array' },
        timeline: { type: 'object' },
        budget: { type: 'object' },
      },
    },
  },
};

export function getTypeSchema(typeId: string): TypeSchema | null {
  return TYPE_REGISTRY[typeId] || null;
}

export function isValidType(typeId: string): boolean {
  return typeId in TYPE_REGISTRY;
}
```

### 9.0.2: Transformer Registry

**File:** `server/journey/transformers/transformer-registry.ts`

```typescript
/**
 * Transformer Registry - Converts between module output types
 * When Module A outputs type X and Module B expects type Y,
 * find and apply the appropriate transformer
 */

export interface Transformer {
  sourceType: string;
  targetType: string;
  name: string;
  transform: (source: any, context?: any) => any;
}

// BMC to other formats
const bmcToSwotTransformer: Transformer = {
  sourceType: 'bmc_output',
  targetType: 'swot_input',
  name: 'BMC → SWOT Input',
  transform: (bmc: any) => ({
    businessContext: `Value Props: ${bmc.valuePropositions?.join(', ')}. ` +
      `Segments: ${bmc.customerSegments?.join(', ')}. ` +
      `Key Resources: ${bmc.keyResources?.join(', ')}`,
    bmcOutput: bmc,
  }),
};

const bmcToAnsoffTransformer: Transformer = {
  sourceType: 'bmc_output',
  targetType: 'ansoff_input',
  name: 'BMC → Ansoff Input',
  transform: (bmc: any) => ({
    businessContext: `Business with ${bmc.valuePropositions?.length || 0} value propositions`,
    currentProducts: bmc.valuePropositions || [],
    currentMarkets: bmc.customerSegments || [],
  }),
};

const bmcToTextTransformer: Transformer = {
  sourceType: 'bmc_output',
  targetType: 'business_context',
  name: 'BMC → Text Context',
  transform: (bmc: any) => ({
    description: `Value Propositions: ${bmc.valuePropositions?.join(', ')}. ` +
      `Customer Segments: ${bmc.customerSegments?.join(', ')}. ` +
      `Channels: ${bmc.channels?.join(', ')}. ` +
      `Revenue Streams: ${bmc.revenueStreams?.join(', ')}.`,
  }),
};

// SWOT to other formats
const swotToAnsoffTransformer: Transformer = {
  sourceType: 'swot_output',
  targetType: 'ansoff_input',
  name: 'SWOT → Ansoff Input',
  transform: (swot: any) => ({
    businessContext: `Strengths: ${swot.strengths?.map((s: any) => s.factor).join(', ')}. ` +
      `Opportunities: ${swot.opportunities?.map((o: any) => o.factor).join(', ')}`,
    swotOutput: swot,
  }),
};

const swotToStrategyTransformer: Transformer = {
  sourceType: 'swot_output',
  targetType: 'strategy_context',
  name: 'SWOT → Strategy Context',
  transform: (swot: any) => ({
    strengths: swot.strengths?.map((s: any) => s.factor) || [],
    weaknesses: swot.weaknesses?.map((w: any) => w.factor) || [],
    opportunities: swot.opportunities?.map((o: any) => o.factor) || [],
    threats: swot.threats?.map((t: any) => t.factor) || [],
    strategicOptions: swot.strategicOptions || {},
  }),
};

// Segments to other formats
const segmentsToJTBDTransformer: Transformer = {
  sourceType: 'segment_output',
  targetType: 'jtbd_input',
  name: 'Segments → JTBD Input',
  transform: (segments: any) => ({
    businessContext: `Target segments: ${segments.segments?.map((s: any) => s.name).join(', ')}`,
    targetSegments: segments.segments,
  }),
};

// Porter's to other formats
const portersToSwotTransformer: Transformer = {
  sourceType: 'porters_output',
  targetType: 'swot_input',
  name: "Porter's → SWOT Input",
  transform: (porters: any) => ({
    businessContext: `Industry analysis shows competitive rivalry is ${porters.competitiveRivalry?.intensity || 'unknown'}`,
    portersOutput: porters,
  }),
};

// PESTLE to other formats
const pestleToSwotTransformer: Transformer = {
  sourceType: 'pestle_output',
  targetType: 'swot_input',
  name: 'PESTLE → SWOT Input',
  transform: (pestle: any) => ({
    businessContext: `Macro environment: ${pestle.summary?.keyOpportunities?.join(', ')}`,
    pestleOutput: pestle,
  }),
};

// Registry mapping
const TRANSFORMERS: Record<string, Record<string, Transformer>> = {
  'bmc_output': {
    'swot_input': bmcToSwotTransformer,
    'ansoff_input': bmcToAnsoffTransformer,
    'business_context': bmcToTextTransformer,
  },
  'swot_output': {
    'ansoff_input': swotToAnsoffTransformer,
    'strategy_context': swotToStrategyTransformer,
  },
  'segment_output': {
    'jtbd_input': segmentsToJTBDTransformer,
  },
  'porters_output': {
    'swot_input': portersToSwotTransformer,
  },
  'pestle_output': {
    'swot_input': pestleToSwotTransformer,
  },
};

/**
 * Get transformer for source → target type conversion
 * Returns null if types are same (no transform needed)
 * Throws if no transformer exists
 */
export function getTransformer(sourceType: string, targetType: string): Transformer | null {
  // Same type - no transform needed
  if (sourceType === targetType) return null;

  // Direct transformer exists
  if (TRANSFORMERS[sourceType]?.[targetType]) {
    return TRANSFORMERS[sourceType][targetType];
  }

  // Fall back to text context if available
  if (TRANSFORMERS[sourceType]?.['business_context']) {
    console.log(`[Transformer] No direct path ${sourceType} → ${targetType}, using text fallback`);
    return TRANSFORMERS[sourceType]['business_context'];
  }

  throw new Error(`No transformer from ${sourceType} to ${targetType}`);
}

/**
 * Transform data from source type to target type
 */
export function transformData(
  data: any,
  sourceType: string,
  targetType: string,
  context?: any
): any {
  const transformer = getTransformer(sourceType, targetType);

  if (!transformer) {
    return data; // Same type, return as-is
  }

  console.log(`[Transformer] Applying: ${transformer.name}`);
  return transformer.transform(data, context);
}

/**
 * Check if transformation path exists
 */
export function canTransform(sourceType: string, targetType: string): boolean {
  if (sourceType === targetType) return true;
  try {
    getTransformer(sourceType, targetType);
    return true;
  } catch {
    return false;
  }
}
```

### 9.0.3: Strategic Context Accumulator

**File:** `server/journey/context/strategic-accumulator.ts`

```typescript
/**
 * Strategic Context Accumulator
 * Builds up a comprehensive strategic context as journey executes
 * Each module adds its insights to the accumulator
 */

export interface StrategicContext {
  // Core business info
  businessProfile: {
    name: string;
    description: string;
    industry: string;
    scale: string;
    geography: string;
    businessModel?: string;
  };

  // Analysis outputs (keyed by module type)
  analysisOutputs: {
    bmc?: any;
    swot?: any;
    pestle?: any;
    porters?: any;
    segments?: any;
    jtbd?: any;
    ansoff?: any;
    valueChain?: any;
    bcg?: any;
    vrio?: any;
    blueOcean?: any;
    oceanStrategy?: any;
    scenarioPlanning?: any;
    okr?: any;
  };

  // Synthesized insights
  synthesizedInsights: {
    keyStrengths: string[];
    keyWeaknesses: string[];
    opportunities: string[];
    threats: string[];
    targetSegments: string[];
    competitivePosition: string;
    growthStrategy: string;
    priorityActions: string[];
  };

  // User decisions (from gap filler)
  userDecisions: {
    targetMarkets?: string[];       // Multi-select supported
    targetSegments?: string[];      // Multi-select supported
    strategicPriorities?: string[]; // Multi-select supported
    timeline?: string;
    budget?: string;
    riskTolerance?: string;
  };

  // Execution metadata
  metadata: {
    journeyId: string;
    modulesExecuted: string[];
    lastUpdated: string;
    confidence: number;
  };
}

export class StrategicAccumulator {
  private context: StrategicContext;

  constructor(journeyId: string, initialBusinessProfile: any) {
    this.context = {
      businessProfile: {
        name: initialBusinessProfile.name || 'Unknown Business',
        description: initialBusinessProfile.description || '',
        industry: initialBusinessProfile.industry || '',
        scale: initialBusinessProfile.scale || '',
        geography: initialBusinessProfile.geography || '',
      },
      analysisOutputs: {},
      synthesizedInsights: {
        keyStrengths: [],
        keyWeaknesses: [],
        opportunities: [],
        threats: [],
        targetSegments: [],
        competitivePosition: '',
        growthStrategy: '',
        priorityActions: [],
      },
      userDecisions: {},
      metadata: {
        journeyId,
        modulesExecuted: [],
        lastUpdated: new Date().toISOString(),
        confidence: 0.5,
      },
    };
  }

  /**
   * Add module output to accumulator and extract insights
   */
  addModuleOutput(moduleId: string, outputType: string, output: any): void {
    console.log(`[Accumulator] Adding output from ${moduleId} (${outputType})`);

    // Store raw output
    const outputKey = this.getOutputKey(outputType);
    if (outputKey) {
      this.context.analysisOutputs[outputKey] = output;
    }

    // Extract and synthesize insights
    this.extractInsights(outputType, output);

    // Update metadata
    this.context.metadata.modulesExecuted.push(moduleId);
    this.context.metadata.lastUpdated = new Date().toISOString();
    this.context.metadata.confidence = this.calculateConfidence();
  }

  /**
   * Add user decisions (from gap filler)
   */
  addUserDecision(decisionType: string, value: string | string[]): void {
    console.log(`[Accumulator] Adding user decision: ${decisionType}`);
    (this.context.userDecisions as any)[decisionType] = value;
    this.context.metadata.lastUpdated = new Date().toISOString();
  }

  /**
   * Get current accumulated context
   */
  getContext(): StrategicContext {
    return { ...this.context };
  }

  /**
   * Get context formatted for EPM generation
   */
  getEPMContext(): any {
    return {
      business: this.context.businessProfile,
      analyses: this.context.analysisOutputs,
      insights: this.context.synthesizedInsights,
      decisions: this.context.userDecisions,
      confidence: this.context.metadata.confidence,
    };
  }

  private getOutputKey(outputType: string): keyof StrategicContext['analysisOutputs'] | null {
    const mapping: Record<string, keyof StrategicContext['analysisOutputs']> = {
      'bmc_output': 'bmc',
      'swot_output': 'swot',
      'pestle_output': 'pestle',
      'porters_output': 'porters',
      'segment_output': 'segments',
      'jtbd_output': 'jtbd',
      'ansoff_output': 'ansoff',
    };
    return mapping[outputType] || null;
  }

  private extractInsights(outputType: string, output: any): void {
    const insights = this.context.synthesizedInsights;

    switch (outputType) {
      case 'swot_output':
        insights.keyStrengths = output.strengths?.slice(0, 3).map((s: any) => s.factor) || [];
        insights.keyWeaknesses = output.weaknesses?.slice(0, 3).map((w: any) => w.factor) || [];
        insights.opportunities = output.opportunities?.slice(0, 3).map((o: any) => o.factor) || [];
        insights.threats = output.threats?.slice(0, 3).map((t: any) => t.factor) || [];
        insights.priorityActions = output.priorityActions?.slice(0, 5) || [];
        break;

      case 'segment_output':
        insights.targetSegments = output.segments?.map((s: any) => s.name) || [];
        break;

      case 'porters_output':
        insights.competitivePosition = output.overallAssessment || '';
        break;

      case 'ansoff_output':
        insights.growthStrategy = output.recommendation?.primaryStrategy || '';
        break;
    }
  }

  private calculateConfidence(): number {
    const executedCount = this.context.metadata.modulesExecuted.length;
    const hasUserDecisions = Object.keys(this.context.userDecisions).length > 0;

    let confidence = 0.4 + (executedCount * 0.08);
    if (hasUserDecisions) confidence += 0.1;

    return Math.min(0.95, confidence);
  }
}
```

---

## 9.1: EPM Readiness Layer

### The Problem
Every journey ends with EPM generation. But different journeys provide different amounts of information:
- A full journey (BMC → SWOT → Porter's → Segments → EPM) has rich context
- A minimal journey (SWOT → EPM) lacks customer segments, revenue projections, etc.

The EPM Readiness Layer:
1. Checks what EPM needs vs what the journey provided
2. Identifies gaps
3. Generates smart multiple-choice questions to fill gaps
4. Supports **multi-select** (user can choose multiple segments, strategies, etc.)

### 9.1.1: EPM Requirements Definition

**File:** `server/journey/epm-readiness/requirements.ts`

```typescript
/**
 * EPM Requirements - What data does EPM need to generate a quality plan?
 */

export interface EPMRequirement {
  id: string;
  name: string;
  description: string;
  importance: 'critical' | 'important' | 'optional';
  sourcedFrom: string[];  // Which modules provide this
  fallbackQuestion: string;  // Question to ask if missing
  questionType: 'single_select' | 'multi_select' | 'scale' | 'timeline' | 'budget';
  canBeMultiple: boolean;  // Can user select multiple values?
}

export const EPM_REQUIREMENTS: EPMRequirement[] = [
  // Critical requirements
  {
    id: 'target_segments',
    name: 'Target Customer Segments',
    description: 'Who are the primary target customers?',
    importance: 'critical',
    sourcedFrom: ['segment-discovery', 'bmc-generator'],
    fallbackQuestion: 'Which customer segments should we target?',
    questionType: 'multi_select',  // MULTI-SELECT - can target multiple
    canBeMultiple: true,
  },
  {
    id: 'value_proposition',
    name: 'Value Proposition',
    description: 'What unique value does the business offer?',
    importance: 'critical',
    sourcedFrom: ['bmc-generator', 'jtbd-analyzer'],
    fallbackQuestion: 'What is the core value proposition?',
    questionType: 'single_select',
    canBeMultiple: false,
  },
  {
    id: 'competitive_strategy',
    name: 'Competitive Strategy',
    description: 'How will we compete in the market?',
    importance: 'critical',
    sourcedFrom: ['porters-five-forces', 'swot-analyzer', 'competitive-positioning'],
    fallbackQuestion: 'What competitive strategy should we pursue?',
    questionType: 'multi_select',  // MULTI-SELECT - can use multiple strategies
    canBeMultiple: true,
  },

  // Important requirements
  {
    id: 'growth_strategy',
    name: 'Growth Strategy',
    description: 'How will the business grow?',
    importance: 'important',
    sourcedFrom: ['ansoff-analyzer', 'blue-ocean', 'ocean-strategy'],
    fallbackQuestion: 'Which growth strategies should we prioritize?',
    questionType: 'multi_select',  // MULTI-SELECT
    canBeMultiple: true,
  },
  {
    id: 'timeline',
    name: 'Implementation Timeline',
    description: 'Target launch/completion timeframe',
    importance: 'important',
    sourcedFrom: [],  // Always needs user input
    fallbackQuestion: 'What is your target timeline?',
    questionType: 'timeline',
    canBeMultiple: false,
  },
  {
    id: 'budget_range',
    name: 'Budget Range',
    description: 'Available budget for implementation',
    importance: 'important',
    sourcedFrom: [],  // Always needs user input
    fallbackQuestion: 'What is your approximate budget?',
    questionType: 'budget',
    canBeMultiple: false,
  },
  {
    id: 'risk_tolerance',
    name: 'Risk Tolerance',
    description: 'How much risk is acceptable?',
    importance: 'important',
    sourcedFrom: [],  // User preference
    fallbackQuestion: 'What is your risk tolerance?',
    questionType: 'scale',
    canBeMultiple: false,
  },

  // Optional requirements
  {
    id: 'geographic_focus',
    name: 'Geographic Focus',
    description: 'Target markets/regions',
    importance: 'optional',
    sourcedFrom: ['pestle-analyzer', 'ansoff-analyzer'],
    fallbackQuestion: 'Which geographic markets should we target?',
    questionType: 'multi_select',  // MULTI-SELECT
    canBeMultiple: true,
  },
  {
    id: 'key_partnerships',
    name: 'Key Partnerships',
    description: 'Strategic partners to pursue',
    importance: 'optional',
    sourcedFrom: ['bmc-generator', 'value-chain'],
    fallbackQuestion: 'What types of partnerships should we pursue?',
    questionType: 'multi_select',  // MULTI-SELECT
    canBeMultiple: true,
  },
];

/**
 * Get requirements by importance level
 */
export function getRequirementsByImportance(importance: 'critical' | 'important' | 'optional'): EPMRequirement[] {
  return EPM_REQUIREMENTS.filter(r => r.importance === importance);
}

/**
 * Check if a requirement can be sourced from a specific module
 */
export function canModuleProvide(moduleId: string, requirementId: string): boolean {
  const requirement = EPM_REQUIREMENTS.find(r => r.id === requirementId);
  return requirement?.sourcedFrom.includes(moduleId) || false;
}
```

### 9.1.2: Gap Analyzer

**File:** `server/journey/epm-readiness/gap-analyzer.ts`

```typescript
/**
 * Gap Analyzer - Identifies what EPM needs that the journey hasn't provided
 */

import { EPM_REQUIREMENTS, EPMRequirement } from './requirements';
import { StrategicContext } from '../context/strategic-accumulator';

export interface GapAnalysis {
  providedRequirements: string[];
  missingRequirements: EPMRequirement[];
  criticalGaps: EPMRequirement[];
  importantGaps: EPMRequirement[];
  optionalGaps: EPMRequirement[];
  overallReadiness: 'ready' | 'needs_input' | 'insufficient';
  readinessScore: number;  // 0-100
}

export class GapAnalyzer {
  /**
   * Analyze what EPM needs vs what the journey has provided
   */
  analyze(context: StrategicContext): GapAnalysis {
    console.log('[Gap Analyzer] Analyzing EPM readiness...');
    console.log(`  Modules executed: ${context.metadata.modulesExecuted.join(', ')}`);

    const provided: string[] = [];
    const missing: EPMRequirement[] = [];

    for (const req of EPM_REQUIREMENTS) {
      if (this.isRequirementMet(req, context)) {
        provided.push(req.id);
      } else {
        missing.push(req);
      }
    }

    const criticalGaps = missing.filter(r => r.importance === 'critical');
    const importantGaps = missing.filter(r => r.importance === 'important');
    const optionalGaps = missing.filter(r => r.importance === 'optional');

    // Calculate readiness score
    const totalWeight = EPM_REQUIREMENTS.reduce((sum, r) => {
      const weight = r.importance === 'critical' ? 3 : r.importance === 'important' ? 2 : 1;
      return sum + weight;
    }, 0);

    const providedWeight = provided.reduce((sum, id) => {
      const req = EPM_REQUIREMENTS.find(r => r.id === id);
      const weight = req?.importance === 'critical' ? 3 : req?.importance === 'important' ? 2 : 1;
      return sum + weight;
    }, 0);

    const readinessScore = Math.round((providedWeight / totalWeight) * 100);

    // Determine overall readiness
    let overallReadiness: 'ready' | 'needs_input' | 'insufficient';
    if (criticalGaps.length === 0 && importantGaps.length <= 2) {
      overallReadiness = 'ready';
    } else if (criticalGaps.length <= 2) {
      overallReadiness = 'needs_input';
    } else {
      overallReadiness = 'insufficient';
    }

    console.log(`[Gap Analyzer] Readiness: ${overallReadiness} (${readinessScore}%)`);
    console.log(`  Critical gaps: ${criticalGaps.length}`);
    console.log(`  Important gaps: ${importantGaps.length}`);

    return {
      providedRequirements: provided,
      missingRequirements: missing,
      criticalGaps,
      importantGaps,
      optionalGaps,
      overallReadiness,
      readinessScore,
    };
  }

  /**
   * Check if a specific requirement is met by the context
   */
  private isRequirementMet(req: EPMRequirement, context: StrategicContext): boolean {
    // Check if any source module was executed
    const hasSourceModule = req.sourcedFrom.some(
      moduleId => context.metadata.modulesExecuted.includes(moduleId)
    );

    // Check if user has made a decision for this requirement
    const hasUserDecision = (context.userDecisions as any)[req.id] !== undefined;

    // Check synthesized insights for specific requirements
    switch (req.id) {
      case 'target_segments':
        return context.synthesizedInsights.targetSegments.length > 0 || hasUserDecision;
      case 'competitive_strategy':
        return context.synthesizedInsights.competitivePosition !== '' || hasUserDecision;
      case 'growth_strategy':
        return context.synthesizedInsights.growthStrategy !== '' || hasUserDecision;
      default:
        return hasSourceModule || hasUserDecision;
    }
  }
}

export const gapAnalyzer = new GapAnalyzer();
```

### 9.1.3: Smart Option Generator

**File:** `server/journey/epm-readiness/smart-options.ts`

```typescript
/**
 * Smart Option Generator - Creates intelligent multiple choice options
 * based on the journey's analysis context
 */

import { aiClients } from '../../ai-clients';
import { EPMRequirement } from './requirements';
import { StrategicContext } from '../context/strategic-accumulator';

export interface SmartOption {
  id: string;
  label: string;
  sublabel?: string;  // e.g., "From your segment analysis"
  value: any;
  confidence: number;
  recommended: boolean;
  source?: string;  // Which analysis suggested this
}

export interface GapFillerQuestion {
  requirementId: string;
  question: string;
  description?: string;
  type: 'single_select' | 'multi_select' | 'scale' | 'timeline' | 'budget';
  options: SmartOption[];
  allowCustom: boolean;
  validateCustom: boolean;
  minSelections?: number;  // For multi_select
  maxSelections?: number;  // For multi_select
}

export class SmartOptionGenerator {
  /**
   * Generate smart options for a gap requirement
   */
  async generateOptions(
    requirement: EPMRequirement,
    context: StrategicContext
  ): Promise<GapFillerQuestion> {
    console.log(`[Smart Options] Generating options for: ${requirement.id}`);

    // For timeline/budget/scale, use predefined options
    if (['timeline', 'budget', 'scale'].includes(requirement.questionType)) {
      return this.getPredefinedQuestion(requirement);
    }

    // For select types, generate context-aware options
    const options = await this.generateContextAwareOptions(requirement, context);

    return {
      requirementId: requirement.id,
      question: requirement.fallbackQuestion,
      description: requirement.description,
      type: requirement.questionType,
      options,
      allowCustom: true,
      validateCustom: true,
      minSelections: requirement.questionType === 'multi_select' ? 1 : undefined,
      maxSelections: requirement.questionType === 'multi_select' ? 5 : undefined,
    };
  }

  /**
   * Generate options based on analysis context using AI
   */
  private async generateContextAwareOptions(
    requirement: EPMRequirement,
    context: StrategicContext
  ): Promise<SmartOption[]> {
    const prompt = `
Based on this strategic analysis context, generate 3-4 smart multiple choice options for the question:
"${requirement.fallbackQuestion}"

Analysis Context:
- Business: ${context.businessProfile.name} - ${context.businessProfile.description}
- Industry: ${context.businessProfile.industry}
${context.synthesizedInsights.targetSegments.length > 0 ? `- Target Segments: ${context.synthesizedInsights.targetSegments.join(', ')}` : ''}
${context.synthesizedInsights.keyStrengths.length > 0 ? `- Key Strengths: ${context.synthesizedInsights.keyStrengths.join(', ')}` : ''}
${context.synthesizedInsights.opportunities.length > 0 ? `- Opportunities: ${context.synthesizedInsights.opportunities.join(', ')}` : ''}
${context.synthesizedInsights.growthStrategy ? `- Suggested Growth Strategy: ${context.synthesizedInsights.growthStrategy}` : ''}

Generate options that:
1. Are derived from the analysis data (not generic)
2. Are specific to this business
3. Include one recommended option (highest confidence)
4. Each has a clear, concise label (2-5 words)
5. Each has a sublabel explaining why this option fits

Return as JSON array:
[
  {
    "label": "Short option name",
    "sublabel": "Why this fits based on analysis",
    "value": "option_value",
    "confidence": 0.85,
    "recommended": true,
    "source": "Which analysis suggested this"
  }
]
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a strategic advisor. Return only valid JSON array.',
        userMessage: prompt,
        maxTokens: 1000,
      });

      const options = JSON.parse(response.content) as SmartOption[];

      // Add IDs to options
      return options.map((opt, i) => ({
        ...opt,
        id: `${requirement.id}_opt_${i}`,
      }));
    } catch (error) {
      console.error('[Smart Options] AI generation failed, using fallback');
      return this.getFallbackOptions(requirement);
    }
  }

  /**
   * Get predefined options for timeline/budget/scale questions
   */
  private getPredefinedQuestion(requirement: EPMRequirement): GapFillerQuestion {
    let options: SmartOption[] = [];

    switch (requirement.questionType) {
      case 'timeline':
        options = [
          { id: 'timeline_1', label: '0-3 months', sublabel: 'Quick launch', value: '0-3_months', confidence: 0.7, recommended: false },
          { id: 'timeline_2', label: '3-6 months', sublabel: 'Standard timeline', value: '3-6_months', confidence: 0.85, recommended: true },
          { id: 'timeline_3', label: '6-12 months', sublabel: 'Thorough preparation', value: '6-12_months', confidence: 0.75, recommended: false },
          { id: 'timeline_4', label: '12+ months', sublabel: 'Long-term project', value: '12+_months', confidence: 0.6, recommended: false },
        ];
        break;

      case 'budget':
        options = [
          { id: 'budget_1', label: 'Under $10K', sublabel: 'Bootstrap', value: 'under_10k', confidence: 0.6, recommended: false },
          { id: 'budget_2', label: '$10K - $50K', sublabel: 'Small business', value: '10k-50k', confidence: 0.75, recommended: false },
          { id: 'budget_3', label: '$50K - $250K', sublabel: 'Growth stage', value: '50k-250k', confidence: 0.85, recommended: true },
          { id: 'budget_4', label: '$250K+', sublabel: 'Significant investment', value: '250k+', confidence: 0.7, recommended: false },
        ];
        break;

      case 'scale':
        options = [
          { id: 'risk_1', label: 'Conservative', sublabel: 'Minimize risk', value: 'conservative', confidence: 0.7, recommended: false },
          { id: 'risk_2', label: 'Moderate', sublabel: 'Balanced approach', value: 'moderate', confidence: 0.85, recommended: true },
          { id: 'risk_3', label: 'Aggressive', sublabel: 'High risk/reward', value: 'aggressive', confidence: 0.7, recommended: false },
        ];
        break;
    }

    return {
      requirementId: requirement.id,
      question: requirement.fallbackQuestion,
      description: requirement.description,
      type: requirement.questionType,
      options,
      allowCustom: false,
      validateCustom: false,
    };
  }

  /**
   * Fallback options when AI generation fails
   */
  private getFallbackOptions(requirement: EPMRequirement): SmartOption[] {
    return [
      { id: `${requirement.id}_opt_0`, label: 'Option A', sublabel: 'First alternative', value: 'option_a', confidence: 0.6, recommended: false },
      { id: `${requirement.id}_opt_1`, label: 'Option B', sublabel: 'Second alternative', value: 'option_b', confidence: 0.6, recommended: false },
      { id: `${requirement.id}_opt_2`, label: 'Option C', sublabel: 'Third alternative', value: 'option_c', confidence: 0.6, recommended: false },
    ];
  }
}

export const smartOptionGenerator = new SmartOptionGenerator();
```

### 9.1.4: Gap Filler UI Component

**File:** `src/components/journey/GapFiller.tsx`

```tsx
/**
 * Gap Filler Component - Mobile-first UI for filling EPM gaps
 * Supports MULTI-SELECT for questions where users can choose multiple options
 */

import React, { useState } from 'react';
import { Check, ChevronRight, Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SmartOption {
  id: string;
  label: string;
  sublabel?: string;
  value: any;
  confidence: number;
  recommended: boolean;
  source?: string;
}

interface GapQuestion {
  requirementId: string;
  question: string;
  description?: string;
  type: 'single_select' | 'multi_select' | 'scale' | 'timeline' | 'budget';
  options: SmartOption[];
  allowCustom: boolean;
  minSelections?: number;
  maxSelections?: number;
}

interface GapFillerProps {
  questions: GapQuestion[];
  onComplete: (answers: Record<string, string | string[]>) => void;
  onSkip?: () => void;
}

export function GapFiller({ questions, onComplete, onSkip }: GapFillerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const currentQuestion = questions[currentIndex];
  const isMultiSelect = currentQuestion?.type === 'multi_select';
  const currentSelection = answers[currentQuestion?.requirementId];

  // For multi-select, currentSelection is an array
  const selectedIds = isMultiSelect
    ? (currentSelection as string[] || [])
    : currentSelection ? [currentSelection as string] : [];

  const handleOptionSelect = (option: SmartOption) => {
    const reqId = currentQuestion.requirementId;

    if (isMultiSelect) {
      // Toggle selection in array
      const current = (answers[reqId] as string[] || []);
      const isSelected = current.includes(option.id);

      if (isSelected) {
        // Remove from selection
        setAnswers({
          ...answers,
          [reqId]: current.filter(id => id !== option.id),
        });
      } else {
        // Add to selection (check max limit)
        const maxAllowed = currentQuestion.maxSelections || 5;
        if (current.length < maxAllowed) {
          setAnswers({
            ...answers,
            [reqId]: [...current, option.id],
          });
        }
      }
    } else {
      // Single select - replace selection
      setAnswers({
        ...answers,
        [reqId]: option.id,
      });
    }
  };

  const handleCustomSubmit = () => {
    if (customInput.trim()) {
      const reqId = currentQuestion.requirementId;
      const customValue = `custom:${customInput.trim()}`;

      if (isMultiSelect) {
        const current = (answers[reqId] as string[] || []);
        setAnswers({
          ...answers,
          [reqId]: [...current, customValue],
        });
      } else {
        setAnswers({
          ...answers,
          [reqId]: customValue,
        });
      }

      setCustomInput('');
      setShowCustomInput(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowCustomInput(false);
      setCustomInput('');
    } else {
      onComplete(answers);
    }
  };

  const canProceed = () => {
    const selection = answers[currentQuestion?.requirementId];
    if (isMultiSelect) {
      const minRequired = currentQuestion.minSelections || 1;
      return (selection as string[] || []).length >= minRequired;
    }
    return !!selection;
  };

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-6">
        {questions.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i < currentIndex ? 'bg-primary' :
              i === currentIndex ? 'bg-primary/60' : 'bg-muted'
            )}
          />
        ))}
      </div>

      {/* Question */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">{currentQuestion.question}</h2>
        {currentQuestion.description && (
          <p className="text-muted-foreground text-sm">{currentQuestion.description}</p>
        )}
        {isMultiSelect && (
          <p className="text-primary text-sm mt-2">
            Select all that apply
            {currentQuestion.maxSelections && ` (max ${currentQuestion.maxSelections})`}
          </p>
        )}
      </div>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option) => {
          const isSelected = selectedIds.includes(option.id);

          return (
            <button
              key={option.id}
              onClick={() => handleOptionSelect(option)}
              className={cn(
                'w-full p-4 rounded-xl border-2 text-left transition-all',
                'hover:border-primary/50 hover:bg-primary/5',
                'active:scale-[0.98]',
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Selection indicator */}
                <div className={cn(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                  isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                )}>
                  {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{option.label}</span>
                    {option.recommended && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Recommended
                      </span>
                    )}
                  </div>
                  {option.sublabel && (
                    <p className="text-sm text-muted-foreground mt-1">{option.sublabel}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {/* Custom option */}
        {currentQuestion.allowCustom && !showCustomInput && (
          <button
            onClick={() => setShowCustomInput(true)}
            className="w-full p-4 rounded-xl border-2 border-dashed border-muted-foreground/30 text-left hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3 text-muted-foreground">
              <Plus className="w-5 h-5" />
              <span>Other (specify)</span>
            </div>
          </button>
        )}

        {/* Custom input */}
        {showCustomInput && (
          <div className="p-4 rounded-xl border-2 border-primary bg-primary/5">
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Enter your answer..."
              className="mb-3"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCustomSubmit} disabled={!customInput.trim()}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                setShowCustomInput(false);
                setCustomInput('');
              }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {onSkip && (
          <Button variant="ghost" onClick={onSkip} className="flex-1">
            Skip
          </Button>
        )}
        <Button
          onClick={handleNext}
          disabled={!canProceed()}
          className="flex-1"
        >
          {currentIndex < questions.length - 1 ? (
            <>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          ) : (
            'Complete'
          )}
        </Button>
      </div>
    </div>
  );
}
```

### 9.1.5: Journey Executor Integration

**File:** `server/journey/executor/pre-epm-handler.ts`

```typescript
/**
 * Pre-EPM Handler - Orchestrates gap analysis and filling before EPM generation
 */

import { gapAnalyzer, GapAnalysis } from '../epm-readiness/gap-analyzer';
import { smartOptionGenerator, GapFillerQuestion } from '../epm-readiness/smart-options';
import { StrategicAccumulator, StrategicContext } from '../context/strategic-accumulator';

export interface PreEPMResult {
  readiness: 'ready' | 'needs_input' | 'insufficient';
  readinessScore: number;
  questions?: GapFillerQuestion[];  // Questions to ask user
  context: StrategicContext;
}

export class PreEPMHandler {
  /**
   * Analyze journey context and determine if EPM is ready or needs input
   */
  async prepareForEPM(accumulator: StrategicAccumulator): Promise<PreEPMResult> {
    const context = accumulator.getContext();

    console.log('[Pre-EPM] Analyzing journey readiness...');

    // Analyze gaps
    const gapAnalysis = gapAnalyzer.analyze(context);

    // If ready, return immediately
    if (gapAnalysis.overallReadiness === 'ready') {
      console.log('[Pre-EPM] Journey is EPM-ready');
      return {
        readiness: 'ready',
        readinessScore: gapAnalysis.readinessScore,
        context,
      };
    }

    // If insufficient, warn but continue
    if (gapAnalysis.overallReadiness === 'insufficient') {
      console.warn('[Pre-EPM] Journey has significant gaps - EPM quality may be limited');
    }

    // Generate questions for gaps (prioritize critical, then important)
    const gapsToFill = [
      ...gapAnalysis.criticalGaps,
      ...gapAnalysis.importantGaps.slice(0, 3),  // Limit to 3 important gaps
    ];

    console.log(`[Pre-EPM] Generating ${gapsToFill.length} gap-filler questions`);

    const questions: GapFillerQuestion[] = [];
    for (const gap of gapsToFill) {
      const question = await smartOptionGenerator.generateOptions(gap, context);
      questions.push(question);
    }

    return {
      readiness: gapAnalysis.overallReadiness,
      readinessScore: gapAnalysis.readinessScore,
      questions,
      context,
    };
  }

  /**
   * Apply user answers to the accumulator
   */
  applyUserAnswers(
    accumulator: StrategicAccumulator,
    answers: Record<string, string | string[]>
  ): void {
    console.log('[Pre-EPM] Applying user answers to context');

    for (const [requirementId, value] of Object.entries(answers)) {
      accumulator.addUserDecision(requirementId, value);
    }
  }
}

export const preEPMHandler = new PreEPMHandler();
```

---

## Framework Implementation Priority

| Priority | Framework | Reason |
|----------|-----------|--------|
| 1 | SWOT Analyzer | Foundational, connects to many frameworks |
| 2 | PESTLE Analyzer | Macro-environmental, feeds into SWOT |
| 3 | Ansoff Matrix | Growth strategy, uses SWOT output |
| 4 | Value Chain Analysis | Internal operations analysis |
| 5 | Competitive Positioning | Uses Porter's output |
| 6 | Jobs To Be Done | Customer motivation analysis |
| 7 | BCG Matrix | Portfolio analysis |
| 8 | VRIO Framework | Resource-based analysis |
| 9 | Blue Ocean Strategy | Market creation |
| 10 | OCEAN Strategy | Multi-color strategic positioning |
| 11 | Scenario Planning | Future scenario modeling |
| 12 | OKR Generator | Execution planning |

---

## 9.2: SWOT Analyzer Implementation

### File: `server/intelligence/swot-analyzer.ts`

```typescript
/**
 * SWOT Analyzer
 * Analyzes Strengths, Weaknesses, Opportunities, and Threats
 * Can use BMC output, Porter's output, or raw business context as input
 */

import { aiClients } from '../ai-clients';

export interface SWOTInput {
  businessContext: string;
  bmcOutput?: any;           // Optional BMC canvas data
  portersOutput?: any;       // Optional Porter's analysis
  pestleOutput?: any;        // Optional PESTLE analysis
}

export interface SWOTFactor {
  factor: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  evidence?: string;
}

export interface SWOTOutput {
  strengths: SWOTFactor[];
  weaknesses: SWOTFactor[];
  opportunities: SWOTFactor[];
  threats: SWOTFactor[];
  strategicOptions: {
    soStrategies: string[];  // Strengths + Opportunities
    woStrategies: string[];  // Weaknesses + Opportunities
    stStrategies: string[];  // Strengths + Threats
    wtStrategies: string[];  // Weaknesses + Threats
  };
  priorityActions: string[];
  confidence: number;
  metadata: {
    inputSources: string[];
    analysisDepth: 'basic' | 'enhanced';
    generatedAt: string;
  };
}

export class SWOTAnalyzer {
  async analyze(input: SWOTInput): Promise<SWOTOutput> {
    console.log('[SWOT Analyzer] Starting analysis...');

    // Build context from available inputs
    const contextParts: string[] = [input.businessContext];
    const inputSources: string[] = ['business_context'];

    if (input.bmcOutput) {
      contextParts.push(`Business Model Canvas: ${JSON.stringify(input.bmcOutput)}`);
      inputSources.push('bmc');
    }

    if (input.portersOutput) {
      contextParts.push(`Porter's Five Forces: ${JSON.stringify(input.portersOutput)}`);
      inputSources.push('porters');
    }

    if (input.pestleOutput) {
      contextParts.push(`PESTLE Analysis: ${JSON.stringify(input.pestleOutput)}`);
      inputSources.push('pestle');
    }

    const analysisDepth = inputSources.length > 1 ? 'enhanced' : 'basic';

    const prompt = `
Perform a comprehensive SWOT analysis for this business:

${contextParts.join('\n\n')}

Analyze and provide:

1. STRENGTHS (internal positive factors)
   - What does this business do well?
   - What unique resources does it have?
   - What advantages does it have over competitors?

2. WEAKNESSES (internal negative factors)
   - What could be improved?
   - What resources are lacking?
   - What are competitors doing better?

3. OPPORTUNITIES (external positive factors)
   - What market trends could benefit the business?
   - What gaps exist in the market?
   - What external changes could be leveraged?

4. THREATS (external negative factors)
   - What obstacles does the business face?
   - What are competitors doing?
   - What external changes could hurt the business?

5. STRATEGIC OPTIONS (TOWS Matrix)
   - SO Strategies: Use strengths to capture opportunities
   - WO Strategies: Overcome weaknesses by exploiting opportunities
   - ST Strategies: Use strengths to avoid threats
   - WT Strategies: Minimize weaknesses and avoid threats

6. PRIORITY ACTIONS: Top 3-5 immediate actions based on the analysis

For each factor, provide:
- A clear, specific factor name
- A detailed description
- Importance rating (high/medium/low)
- Supporting evidence if available

Return as JSON matching this structure:
{
  "strengths": [{"factor": "", "description": "", "importance": "high|medium|low", "evidence": ""}],
  "weaknesses": [{"factor": "", "description": "", "importance": "high|medium|low", "evidence": ""}],
  "opportunities": [{"factor": "", "description": "", "importance": "high|medium|low", "evidence": ""}],
  "threats": [{"factor": "", "description": "", "importance": "high|medium|low", "evidence": ""}],
  "strategicOptions": {
    "soStrategies": [""],
    "woStrategies": [""],
    "stStrategies": [""],
    "wtStrategies": [""]
  },
  "priorityActions": [""]
}
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a strategic analysis expert specializing in SWOT analysis. Return only valid JSON.',
        userMessage: prompt,
        maxTokens: 4000,
      });

      const result = JSON.parse(response.content);

      console.log('[SWOT Analyzer] Analysis complete');
      console.log(`  Strengths: ${result.strengths?.length || 0}`);
      console.log(`  Weaknesses: ${result.weaknesses?.length || 0}`);
      console.log(`  Opportunities: ${result.opportunities?.length || 0}`);
      console.log(`  Threats: ${result.threats?.length || 0}`);

      return {
        ...result,
        confidence: this.calculateConfidence(result, inputSources),
        metadata: {
          inputSources,
          analysisDepth,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[SWOT Analyzer] Analysis failed:', error);
      throw error;
    }
  }

  private calculateConfidence(result: any, inputSources: string[]): number {
    let confidence = 0.6; // Base confidence

    // More input sources = higher confidence
    confidence += inputSources.length * 0.05;

    // More factors = higher confidence (up to a point)
    const totalFactors =
      (result.strengths?.length || 0) +
      (result.weaknesses?.length || 0) +
      (result.opportunities?.length || 0) +
      (result.threats?.length || 0);

    if (totalFactors >= 12) confidence += 0.1;
    else if (totalFactors >= 8) confidence += 0.05;

    // Strategic options present = higher confidence
    if (result.strategicOptions?.soStrategies?.length > 0) confidence += 0.05;

    return Math.min(0.95, confidence);
  }
}

export const swotAnalyzer = new SWOTAnalyzer();
```

### Update Module Manifest

**File:** `server/modules/manifests/swot-analyzer.ts`

```typescript
import { ModuleManifest } from '../types';
import { swotAnalyzer } from '../../intelligence/swot-analyzer';

export const swotAnalyzerManifest: ModuleManifest = {
  id: 'swot-analyzer',
  name: 'SWOT Analyzer',
  version: '1.0.0',
  category: 'analysis',
  description: 'Analyzes Strengths, Weaknesses, Opportunities, and Threats',
  status: 'implemented',  // Change from 'stub' to 'implemented'

  inputs: [
    { id: 'business_context', name: 'Business Context', type: 'string', required: true },
    { id: 'bmc_output', name: 'BMC Output', type: 'bmc_output', required: false },
    { id: 'porters_output', name: "Porter's Output", type: 'porters_output', required: false },
    { id: 'pestle_output', name: 'PESTLE Output', type: 'pestle_output', required: false },
  ],

  outputs: [
    { id: 'swot_output', name: 'SWOT Analysis', type: 'swot_output' },
  ],

  estimatedDuration: '45-90 seconds',

  async execute(input: any): Promise<any> {
    return swotAnalyzer.analyze({
      businessContext: input.business_context,
      bmcOutput: input.bmc_output,
      portersOutput: input.porters_output,
      pestleOutput: input.pestle_output,
    });
  },
};
```

---

## 9.3: PESTLE Analyzer Implementation

### File: `server/intelligence/pestle-analyzer.ts`

```typescript
/**
 * PESTLE Analyzer
 * Analyzes Political, Economic, Social, Technological, Legal, Environmental factors
 */

import { aiClients } from '../ai-clients';

export interface PESTLEInput {
  businessContext: string;
  industry?: string;
  geography?: string;  // Target market/region
}

export interface PESTLEFactor {
  factor: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  trend: 'improving' | 'stable' | 'declining';
  timeframe: 'immediate' | 'short-term' | 'long-term';
  implications: string;
}

export interface PESTLEOutput {
  political: PESTLEFactor[];
  economic: PESTLEFactor[];
  social: PESTLEFactor[];
  technological: PESTLEFactor[];
  legal: PESTLEFactor[];
  environmental: PESTLEFactor[];

  summary: {
    overallRiskLevel: 'high' | 'medium' | 'low';
    keyOpportunities: string[];
    keyThreats: string[];
    recommendedActions: string[];
  };

  confidence: number;
  metadata: {
    geography: string;
    industry: string;
    generatedAt: string;
  };
}

export class PESTLEAnalyzer {
  async analyze(input: PESTLEInput): Promise<PESTLEOutput> {
    console.log('[PESTLE Analyzer] Starting macro-environmental analysis...');
    console.log(`  Geography: ${input.geography || 'Not specified'}`);
    console.log(`  Industry: ${input.industry || 'Not specified'}`);

    const prompt = `
Perform a comprehensive PESTLE analysis for this business:

Business Context: ${input.businessContext}
${input.industry ? `Industry: ${input.industry}` : ''}
${input.geography ? `Target Geography: ${input.geography}` : ''}

Analyze each macro-environmental factor:

1. POLITICAL
   - Government policies affecting the business
   - Political stability
   - Trade regulations, tariffs
   - Tax policies

2. ECONOMIC
   - Economic growth/recession trends
   - Interest rates, inflation
   - Exchange rates (if international)
   - Consumer spending patterns

3. SOCIAL
   - Demographics and population trends
   - Cultural attitudes and lifestyle changes
   - Education levels
   - Health consciousness

4. TECHNOLOGICAL
   - Emerging technologies
   - Digital transformation trends
   - R&D activity
   - Technology adoption rates

5. LEGAL
   - Employment laws
   - Consumer protection
   - Industry-specific regulations
   - Health and safety requirements

6. ENVIRONMENTAL
   - Climate change impacts
   - Sustainability requirements
   - Waste management regulations
   - Carbon footprint considerations

For each factor, provide:
- Factor name
- Detailed description
- Impact level (high/medium/low)
- Trend direction (improving/stable/declining)
- Timeframe (immediate/short-term/long-term)
- Business implications

Also provide a summary with:
- Overall risk level
- Top 3 opportunities from external environment
- Top 3 threats from external environment
- Recommended actions

Return as JSON.
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a macro-environmental analysis expert. Return only valid JSON.',
        userMessage: prompt,
        maxTokens: 4000,
      });

      const result = JSON.parse(response.content);

      console.log('[PESTLE Analyzer] Analysis complete');

      return {
        ...result,
        confidence: this.calculateConfidence(result),
        metadata: {
          geography: input.geography || 'Global',
          industry: input.industry || 'General',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[PESTLE Analyzer] Analysis failed:', error);
      throw error;
    }
  }

  private calculateConfidence(result: any): number {
    let confidence = 0.65;

    // Count total factors
    const totalFactors =
      (result.political?.length || 0) +
      (result.economic?.length || 0) +
      (result.social?.length || 0) +
      (result.technological?.length || 0) +
      (result.legal?.length || 0) +
      (result.environmental?.length || 0);

    if (totalFactors >= 18) confidence += 0.15;
    else if (totalFactors >= 12) confidence += 0.1;
    else if (totalFactors >= 6) confidence += 0.05;

    return Math.min(0.9, confidence);
  }
}

export const pestleAnalyzer = new PESTLEAnalyzer();
```

---

## 9.4: Ansoff Matrix Implementation

### File: `server/intelligence/ansoff-analyzer.ts`

```typescript
/**
 * Ansoff Matrix Analyzer
 * Analyzes growth strategies: Market Penetration, Market Development,
 * Product Development, Diversification
 */

import { aiClients } from '../ai-clients';

export interface AnsoffInput {
  businessContext: string;
  currentProducts?: string[];
  currentMarkets?: string[];
  swotOutput?: any;
  growthObjectives?: string;
}

export interface AnsoffStrategy {
  strategy: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'very-high';
  resourceRequirements: 'low' | 'medium' | 'high';
  timeToImplement: string;
  specificActions: string[];
  potentialOutcomes: string[];
  keyRisks: string[];
}

export interface AnsoffOutput {
  marketPenetration: AnsoffStrategy;    // Existing products, existing markets
  marketDevelopment: AnsoffStrategy;    // Existing products, new markets
  productDevelopment: AnsoffStrategy;   // New products, existing markets
  diversification: AnsoffStrategy;      // New products, new markets

  recommendation: {
    primaryStrategy: 'market_penetration' | 'market_development' | 'product_development' | 'diversification';
    rationale: string;
    sequencing: string[];  // Recommended order of strategies
    investmentPriority: string[];
  };

  confidence: number;
  metadata: {
    hasSwotInput: boolean;
    generatedAt: string;
  };
}

export class AnsoffAnalyzer {
  async analyze(input: AnsoffInput): Promise<AnsoffOutput> {
    console.log('[Ansoff Analyzer] Starting growth strategy analysis...');

    const prompt = `
Analyze growth strategies using the Ansoff Matrix for this business:

Business Context: ${input.businessContext}
${input.currentProducts ? `Current Products/Services: ${input.currentProducts.join(', ')}` : ''}
${input.currentMarkets ? `Current Markets: ${input.currentMarkets.join(', ')}` : ''}
${input.growthObjectives ? `Growth Objectives: ${input.growthObjectives}` : ''}
${input.swotOutput ? `SWOT Analysis Available: Yes` : ''}

Analyze each growth strategy quadrant:

1. MARKET PENETRATION (Low Risk)
   - Existing products in existing markets
   - Increase market share
   - Competitive pricing, promotions, loyalty programs

2. MARKET DEVELOPMENT (Medium Risk)
   - Existing products in new markets
   - Geographic expansion
   - New customer segments
   - New distribution channels

3. PRODUCT DEVELOPMENT (Medium Risk)
   - New products in existing markets
   - Product line extensions
   - New features
   - R&D investments

4. DIVERSIFICATION (High Risk)
   - New products in new markets
   - Related vs unrelated diversification
   - Acquisitions, partnerships

For each strategy, provide:
- Specific strategy description for THIS business
- Risk level
- Resource requirements
- Time to implement
- 3-5 specific actions
- Potential outcomes
- Key risks

Also recommend:
- Primary strategy to pursue first
- Rationale for recommendation
- Sequencing (order to pursue strategies)
- Investment priority

Return as JSON.
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a growth strategy expert. Return only valid JSON.',
        userMessage: prompt,
        maxTokens: 4000,
      });

      const result = JSON.parse(response.content);

      console.log('[Ansoff Analyzer] Analysis complete');
      console.log(`  Recommended primary strategy: ${result.recommendation?.primaryStrategy}`);

      return {
        ...result,
        confidence: 0.75,
        metadata: {
          hasSwotInput: !!input.swotOutput,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[Ansoff Analyzer] Analysis failed:', error);
      throw error;
    }
  }
}

export const ansoffAnalyzer = new AnsoffAnalyzer();
```

---

## 9.5: Jobs To Be Done Implementation

### File: `server/intelligence/jtbd-analyzer.ts`

```typescript
/**
 * Jobs To Be Done Analyzer
 * Analyzes customer motivations and the "jobs" they're trying to accomplish
 */

import { aiClients } from '../ai-clients';

export interface JTBDInput {
  businessContext: string;
  targetSegments?: any;  // From Segment Discovery
  productDescription?: string;
}

export interface Job {
  jobStatement: string;  // "When [situation], I want to [motivation], so I can [outcome]"
  jobType: 'functional' | 'emotional' | 'social';
  importance: 'critical' | 'important' | 'nice-to-have';
  currentSolution: string;
  painPoints: string[];
  desiredOutcomes: string[];
  metrics: string[];  // How customers measure success
}

export interface JTBDOutput {
  coreJobs: Job[];
  relatedJobs: Job[];
  consumptionChainJobs: Job[];  // Jobs around the main job (before, during, after)

  opportunities: {
    underservedJobs: string[];
    overservedJobs: string[];
    innovationOpportunities: string[];
  };

  recommendations: {
    priorityJobs: string[];
    featureSuggestions: string[];
    positioningAdvice: string;
  };

  confidence: number;
  metadata: {
    hasSegmentData: boolean;
    generatedAt: string;
  };
}

export class JTBDAnalyzer {
  async analyze(input: JTBDInput): Promise<JTBDOutput> {
    console.log('[JTBD Analyzer] Starting jobs-to-be-done analysis...');

    const prompt = `
Analyze the Jobs To Be Done for customers of this business:

Business Context: ${input.businessContext}
${input.productDescription ? `Product/Service: ${input.productDescription}` : ''}
${input.targetSegments ? `Target Segments: ${JSON.stringify(input.targetSegments)}` : ''}

Identify and analyze:

1. CORE JOBS (Main jobs customers are trying to accomplish)
   Format: "When [situation], I want to [motivation], so I can [outcome]"
   - Functional jobs (practical tasks)
   - Emotional jobs (how they want to feel)
   - Social jobs (how they want to be perceived)

2. RELATED JOBS (Adjacent jobs that influence the core job)

3. CONSUMPTION CHAIN JOBS
   - Jobs BEFORE using the product (research, purchase)
   - Jobs DURING use
   - Jobs AFTER use (maintenance, disposal, sharing)

4. OPPORTUNITIES
   - Underserved jobs (not well addressed by current solutions)
   - Overserved jobs (solutions are overkill)
   - Innovation opportunities

5. RECOMMENDATIONS
   - Priority jobs to focus on
   - Feature suggestions based on jobs
   - Positioning advice

For each job, include:
- Job statement in proper format
- Job type (functional/emotional/social)
- Importance level
- Current solution customers use
- Pain points with current solutions
- Desired outcomes
- Success metrics

Return as JSON.
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a Jobs To Be Done framework expert. Return only valid JSON.',
        userMessage: prompt,
        maxTokens: 4000,
      });

      const result = JSON.parse(response.content);

      console.log('[JTBD Analyzer] Analysis complete');
      console.log(`  Core jobs identified: ${result.coreJobs?.length || 0}`);

      return {
        ...result,
        confidence: 0.7,
        metadata: {
          hasSegmentData: !!input.targetSegments,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[JTBD Analyzer] Analysis failed:', error);
      throw error;
    }
  }
}

export const jtbdAnalyzer = new JTBDAnalyzer();
```

---

## Implementation Steps for Each Framework

For each framework (SWOT, PESTLE, Ansoff, JTBD, etc.), follow this pattern:

### Step 1: Create Analyzer
```
server/intelligence/{framework}-analyzer.ts
```

### Step 2: Update Manifest
```
server/modules/manifests/{framework}.ts
- Change status from 'stub' to 'implemented'
- Update execute() to call the real analyzer
```

### Step 3: Register in Module Registry
The manifests are auto-loaded, but verify in:
```
server/modules/registry.ts
```

### Step 4: Add Smoke Test
```typescript
// tests/smoke/framework-smoke.spec.ts
describe('{Framework} Analyzer', () => {
  it('should analyze and return valid output', async () => {
    const result = await fetch(`${API_BASE}/api/modules/{framework}/execute`, {
      method: 'POST',
      body: JSON.stringify({ business_context: 'Test business' }),
    });
    expect(result.status).toBe(200);
    const data = await result.json();
    expect(data.confidence).toBeGreaterThan(0);
  });
});
```

### Step 5: Test in Journey Builder
1. Open Journey Builder
2. Add the framework node
3. Connect inputs
4. Run journey
5. Verify output quality

---

## Implementation Order

### Batch 1 (Core Analysis)
1. SWOT Analyzer - Foundation for strategy
2. PESTLE Analyzer - External environment

### Batch 2 (Strategy)
3. Ansoff Matrix - Growth strategy
4. Competitive Positioning - Market position

### Batch 3 (Customer & Internal)
5. Jobs To Be Done - Customer motivation
6. Value Chain Analysis - Internal operations

### Batch 4 (Advanced)
7. BCG Matrix - Portfolio analysis
8. VRIO Framework - Resource analysis

### Batch 5 (Innovation & Planning)
9. Blue Ocean Strategy
10. OCEAN Strategy
11. Scenario Planning

### Batch 6 (Execution)
12. OKR Generator

---

## Success Criteria

- [ ] All 12 frameworks change from 'stub' to 'implemented'
- [ ] Each framework produces meaningful, contextual output
- [ ] All frameworks work in Journey Builder (connect, execute, display results)
- [ ] Smoke tests pass for all frameworks
- [ ] Documentation updated

---

## Estimated Effort

| Batch | Frameworks | Effort |
|-------|------------|--------|
| Batch 1 | SWOT, PESTLE | 1 day |
| Batch 2 | Ansoff, Competitive Positioning | 1 day |
| Batch 3 | JTBD, Value Chain | 1 day |
| Batch 4 | BCG, VRIO | 1 day |
| Batch 5 | Blue Ocean, OCEAN, Scenario | 1-2 days |
| Batch 6 | OKR Generator | 0.5 day |

Total: ~5-6 days for full implementation
