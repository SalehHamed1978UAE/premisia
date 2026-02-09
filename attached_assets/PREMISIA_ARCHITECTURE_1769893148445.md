# Premisia Architecture Specification

**Version:** 4.0 (Unified)  
**Date:** January 31, 2026  
**Status:** Single Source of Truth  
**Supersedes:** PREMISIA_CANONICAL_ARCHITECTURE_FINAL.md, PREMISIA_ARCHITECTURE_FINAL.md, PREMISIA_BRIDGE_SPEC.md

---

# PART 1: CONCEPTUAL ARCHITECTURE

---

## 1. Executive Summary

Premisia is an AI-powered strategic consulting platform that guides users through **strategic analysis journeys** culminating in **Enterprise Program Management (EPM)** execution plans.

**Core Architecture Principle:** Hub-and-spoke with a central **Orchestrator**. Modules are stateless workers that know nothing about each other. The Orchestrator handles all sequencing, context transformation, and bridging.

---

## 2. System Architecture

### 2.1 Complete System Flow

```
User Input ("open cafe in Dubai")
         │
         ▼
┌─────────────────────────────────────┐
│     1. STRATEGIC UNDERSTANDING      │
│      (clarifying questions)         │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     2. AMBIGUITY RESOLVER           │
│      (scope clarification)          │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     3. BUSINESS TYPE CHOICE         │
│   (new venture / existing business) │
└─────────────────────────────────────┘
         │
         ├──────────────────────────────────────────────────────────┐
         │                                                          │
         │         CONTEXT OBJECT CREATED HERE                      │
         │         (businessType, industry, region)                 │
         │         Passed through ENTIRE pipeline                   │
         │                                                          │
         ├──────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     4. JOURNEY SELECTION            │
│  (Market Entry, BMI, Growth, etc.)  │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│                                     │
│          5. ORCHESTRATOR            │
│                                     │
│   Executes journey step-by-step:    │
│   • Prepares context for module     │
│   • Calls module (dumb worker)      │
│   • Receives StandardModuleOutput   │
│   • Applies Cognitive Bridge        │
│   • Prepares context for next       │
│                                     │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   6. FRAMEWORK → DECISIONS BRIDGE   │
│   (See Part 2, Sections 5-9)        │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     7. STRATEGIC DECISIONS          │
│      (user makes choices)           │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     8. STRATEGIC PRIORITIES         │
│      (user ranks decisions)         │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     9. EPM SYNTHESIS                │
│   (See Part 3, Sections 14-20)      │
│                                     │
│   context-builder → workstreams     │
│   → resources → risks → benefits    │
│   → assignments → validation        │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     10. EXPORT                      │
│   (PDF, DOCX, CSV, XLSX, JSON)      │
└─────────────────────────────────────┘
```

### 2.2 Orchestrator-Centric Model (Hub-and-Spoke)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│                              ┌─────────────────────────────────┐                        │
│                              │         ORCHESTRATOR            │                        │
│                              │                                 │                        │
│                              │  • Knows journey sequence       │                        │
│                              │  • Receives ALL module outputs  │                        │
│                              │  • Applies Cognitive Bridges    │                        │
│                              │  • Prepares GENERIC context     │                        │
│                              │  • Maintains StrategyContext    │                        │
│                              │  • THE ONLY SMART THING         │                        │
│                              └───────────────┬─────────────────┘                        │
│                                              │                                          │
│          ┌──────────┬──────────┬─────────────┼─────────────┬──────────┬──────────┐     │
│          │          │          │             │             │          │          │     │
│          ▼          ▼          ▼             ▼             ▼          ▼          ▼     │
│      ┌───────┐  ┌───────┐  ┌───────┐    ┌───────┐    ┌───────┐  ┌───────┐  ┌───────┐ │
│      │PESTLE │  │Porter │  │ SWOT  │    │  BMC  │    │5 Whys │  │Ansoff │  │  ...  │ │
│      │       │  │       │  │       │    │       │    │       │  │       │  │       │ │
│      │ DUMB  │  │ DUMB  │  │ DUMB  │    │ DUMB  │    │ DUMB  │  │ DUMB  │  │ DUMB  │ │
│      │WORKER │  │WORKER │  │WORKER │    │WORKER │    │WORKER │  │WORKER │  │WORKER │ │
│      └───┬───┘  └───┬───┘  └───┬───┘    └───┬───┘    └───┬───┘  └───┬───┘  └───┬───┘ │
│          │          │          │             │             │          │          │     │
│          └──────────┴──────────┴─────────────┴─────────────┴──────────┴──────────┘     │
│                                              │                                          │
│                                   Returns to ORCHESTRATOR                               │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Key Principles

| Principle | Description |
|-----------|-------------|
| **Modules are DUMB workers** | They receive context, do ONE job, return standardized output |
| **Modules know NOTHING** | No imports of other modules, no awareness of journey sequence |
| **Orchestrator is SMART** | Knows sequence, does all transformation, applies bridges, maintains context |
| **Context is GENERIC** | Modules receive `priorAnalysis`, NOT `pestleOutput` or `portersOutput` |
| **Context flows through** | StrategyContext created early, passed to ALL downstream components |
| **Two bridge types** | Cognitive Bridges (between modules) + Framework→Decisions Bridges |

---

## 3. Journey Definitions

### 3.1 Universal Journey Structure

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              UNIVERSAL START (All Journeys)                              │
│                                                                                          │
│   Strategic Input → Ambiguity Resolver → Business Type Choice → Journey Selection       │
│                                              │                                           │
│                                   ┌──────────┴──────────┐                               │
│                                   │  CONTEXT CREATED    │                               │
│                                   │  businessType       │                               │
│                                   │  industry           │                               │
│                                   │  region             │                               │
│                                   └──────────┬──────────┘                               │
└──────────────────────────────────────────────┼──────────────────────────────────────────┘
                                               │
                            ┌──────────────────┴──────────────────┐
                            │     JOURNEY-SPECIFIC FRAMEWORKS     │
                            │                                     │
                            │   Module 1                          │
                            │      │                              │
                            │      ▼ (Cognitive Bridge)           │
                            │   Module 2                          │
                            │      │                              │
                            │      ▼ (Cognitive Bridge)           │
                            │   Module N                          │
                            │                                     │
                            └──────────────────┬──────────────────┘
                                               │
┌──────────────────────────────────────────────┴──────────────────────────────────────────┐
│                              UNIVERSAL END (All Journeys)                                │
│                                                                                          │
│   Framework→Decisions Bridge → Strategic Decisions → Strategic Priorities               │
│                                               │                                          │
│                                    ┌──────────┴──────────┐                              │
│                                    │  CONTEXT STILL      │                              │
│                                    │  AVAILABLE HERE     │                              │
│                                    └──────────┬──────────┘                              │
│                                               │                                          │
│   EPM Synthesis (context-aware) → Validation → Export                                   │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 The 8 Journeys

| # | Journey | Framework Sequence | Status | Use Case |
|---|---------|-------------------|--------|----------|
| 1 | **Market Entry** | pestle → porters → swot | ⚠️ Partial | Entering new markets/geographies |
| 2 | **Business Model Innovation** | five_whys → bmc | ✅ Working | Rethinking business models |
| 3 | **Competitive Strategy** | porters → bmc → blue_ocean | ❌ Stub | Competitive positioning |
| 4 | **Digital Transformation** | pestle → bmc → ansoff | ❌ Stub | Tech-driven change |
| 5 | **Crisis Recovery** | five_whys → swot → bmc | ❌ Stub | Turnaround situations |
| 6 | **Growth Strategy** | pestle → ansoff → bmc | ❌ Stub | Expansion/scaling |
| 7 | **Market Segmentation** | segment_discovery | ✅ Working | Customer segments |
| 8 | **Custom** | user-defined | ✅ Working | Wizard-created |

### 3.3 Journey Details with Bridge Logic

#### Market Entry
```
pestle → [Bridge: Macro→Forces] → porters → [Bridge: Forces→O/T] → swot
```
**Bridge Logic:**
- PESTLE Legal (high restrictions) → Porter's Entry Barriers (high)
- PESTLE Economic (low income) → Porter's Buyer Power (high)
- PESTLE Technology (disruption) → Porter's Substitutes (high)
- Porter's Low Force → SWOT Opportunity
- Porter's High Force → SWOT Threat

#### Business Model Innovation
```
five_whys → [Bridge: Causes→Constraints] → bmc
```
**Bridge Logic:**
- Root causes from Five Whys → "must solve" constraints for BMC blocks
- Critical assumptions → BMC items must address or validate

#### Competitive Strategy
```
porters → [Bridge: Forces→Canvas] → bmc → [Bridge: Canvas→Innovation] → blue_ocean
```
**Bridge Logic:**
- Weak forces → BMC blocks to exploit
- Strong forces → BMC blocks to strengthen
- BMC gaps → Blue Ocean "Create" opportunities

#### Digital Transformation
```
pestle → [Bridge: Tech→Operating] → bmc → [Bridge: Canvas→Growth] → ansoff
```
**Bridge Logic:**
- Technology factors → Digital capabilities in BMC
- BMC current state → Ansoff quadrant viability

#### Crisis Recovery
```
five_whys → [Bridge: Causes→S/W] → swot → [Bridge: Position→Rebuild] → bmc
```
**Bridge Logic:**
- Root causes → SWOT Weaknesses
- Crisis impacts → SWOT Threats
- Recovery opportunities → BMC redesign priorities

#### Growth Strategy
```
pestle → [Bridge: Market→Options] → ansoff → [Bridge: Direction→Model] → bmc
```
**Bridge Logic:**
- Market growth → Ansoff Market Penetration viability
- New markets identified → Ansoff Market Development
- BMC reflects chosen growth direction

---

## 4. Module Specification

### 4.1 What Modules DO and DON'T Know

| Modules DO | Modules DON'T |
|------------|---------------|
| ✅ Receive generic context from orchestrator | ❌ Know what journey they're part of |
| ✅ Do their ONE analysis job | ❌ Know what module ran before them |
| ✅ Return standardized output | ❌ Know what module runs after them |
| ✅ Use `priorAnalysis` for context | ❌ Know the SOURCE of `priorAnalysis` |
| ✅ Use `hints` if provided | ❌ Know WHERE hints came from |

### 4.2 Module Contract

```typescript
interface FrameworkExecutor {
  name: FrameworkName;
  validate(context: ModuleInput): Promise<ValidationResult>;
  execute(context: ModuleInput): Promise<StandardModuleOutput>;
}
```

### 4.3 Module Input (What Orchestrator Provides)

```typescript
interface ModuleInput {
  // Business context (from user)
  businessDescription: string;
  industry: string;
  geography: string;
  businessType: 'new_venture' | 'existing_business';
  strategicQuestion: string;

  // GENERIC prior analysis - module doesn't know source!
  priorAnalysis: PriorAnalysisSummary[];

  // Accumulated findings (merged from all prior)
  keyFindings: Finding[];
  opportunities: Opportunity[];
  threats: Threat[];
  constraints: string[];
  assumptions: string[];

  // MODULE-SPECIFIC HINTS (orchestrator provides, module doesn't know source)
  hints?: ModuleHints;

  // Session info
  sessionId: string;
  journeyId: string;
  // NOTE: Module does NOT receive journeyType or sequence!
}
```

**CRITICAL:** Module receives `priorAnalysis` — NOT `pestleOutput` or `portersOutput`.

### 4.4 Standard Module Output

```typescript
interface StandardModuleOutput<TNative = unknown> {
  moduleId: FrameworkName;
  executedAt: string;
  duration: number;

  // 1. NATIVE OUTPUT (Module-Specific, for UI)
  native: TNative;

  // 2. STRATEGIC SUMMARY (Universal Shape)
  strategicSummary: StrategicSummary;

  // 3. DECISION SEEDS (Universal Shape)
  decisionSeeds: DecisionSeeds;

  // 4. DOWNSTREAM CONTEXT (Universal Shape)
  downstreamContext: DownstreamContext;

  // 5. QUALITY METRICS
  quality: QualityMetrics;
}
```

**CRITICAL:** All modules return this SAME shape. The `native` field varies by module; everything else is universal.

---

# PART 2: DATA CONTRACTS & BRIDGES

---

## 5. Context Object Contract (🔴 CRITICAL)

### 5.1 The Problem: Context Bleed

Without explicit context propagation, downstream components lose business type information:

```
INPUT:   "Opening Traditional Cafe in Dubai Business District"
SWOT:    ✅ Generated cafe-related strengths/weaknesses (correct)
EPM:     ❌ "Corporate Catering Market", "Catering Operations Manager" (WRONG)
```

### 5.2 StrategyContext Definition

A `StrategyContext` object MUST be created at journey start and passed to ALL downstream components:

```typescript
interface StrategyContext {
  // Identity (immutable after creation)
  sessionId: string;
  journeyType: JourneyType;
  createdAt: string;
  
  // Business Definition (from Ambiguity Resolver)
  businessType: {
    name: string;                    // "Traditional Cafe"
    category: BusinessCategory;      // "food_beverage"
    subcategory?: string;            // "cafe_coffee_shop"
  };
  
  industry: {
    code: string;                    // "NAICS_722515" or similar
    name: string;                    // "Snack and Nonalcoholic Beverage Bars"
    keywords: string[];              // ["cafe", "coffee", "espresso", "pastry"]
  };
  
  region: {
    country: string;                 // "UAE"
    city?: string;                   // "Dubai"
    district?: string;               // "Business District"
    regulations?: string[];          // ["Dubai Municipality food license", etc.]
  };
  
  // Original Input (for reference)
  originalInput: string;             // "Opening Traditional Cafe in Dubai..."
  
  // Strategic Summary (populated by frameworks)
  strategicSummary?: {
    vision?: string;
    primaryObjective?: string;
    keyConstraints?: string[];
  };
}
```

### 5.3 Context Propagation Rules

```typescript
// ✅ CORRECT: Context passed explicitly
async function generateWorkstreams(
  context: StrategyContext,           // ← REQUIRED first parameter
  priorities: StrategicPriority[],
  decisions: Decision[]
): Promise<Workstream[]>

// ❌ WRONG: Context reconstructed from loose data
async function generateWorkstreams(
  sessionId: string,
  priorities: StrategicPriority[],
  decisions: Decision[]
): Promise<Workstream[]>
```

### 5.4 Context Validation

```typescript
function validateContextForEPM(context: StrategyContext): void {
  const required = [
    'sessionId',
    'journeyType', 
    'businessType.name',
    'businessType.category',
    'industry.name'
  ];
  
  for (const field of required) {
    const value = getNestedValue(context, field);
    if (!value) {
      throw new Error(`EPM Context validation failed: Missing ${field}`);
    }
  }
  
  console.log('[EPM] Context validated:', {
    business: context.businessType.name,
    industry: context.industry.name,
    region: context.region?.city
  });
}
```

---

## 6. Framework → Decisions Bridges

### 6.1 The #1 Bug Pattern

```
Framework Executor returns:  { framework: 'swot', output: {...}, summary: {...} }
                                                     │
Journey extracts:            result.data            │ ← WRONG KEY!
                                                     │
Should extract:              result.output ─────────┘

DecisionGenerator expects:   { strengths[], weaknesses[], opportunities[], threats[] }
DecisionGenerator receives:  { framework, output, summary }

Result: Validation fails → decisions = { decisions: [] } → Empty forms
```

### 6.2 Universal Rule

**ALWAYS extract `.output`, NEVER `.data`**

```typescript
// ❌ WRONG (the bug pattern):
const dataForDecisions = (frameworkResult as any)?.data || frameworkResult;

// ✅ CORRECT:
const frameworkOutput = (frameworkResult as any)?.output;

// Validate before passing:
if (!frameworkOutput || !isValidShape(frameworkOutput)) {
  throw new Error('Bridge failed: Invalid framework output shape');
}
```

---

## 7. SWOT → Decisions Bridge

### 7.1 SWOT Executor Output Shape

```typescript
interface SWOTExecutorResult {
  framework: 'swot';
  
  output: {                          // ← THE ACTUAL SWOT DATA IS HERE
    strengths: SWOTItem[];
    weaknesses: SWOTItem[];
    opportunities: SWOTItem[];
    threats: SWOTItem[];
    
    crossReference?: {
      SO: string[];                  // Strength-Opportunity strategies
      WO: string[];                  // Weakness-Opportunity strategies
      ST: string[];                  // Strength-Threat strategies
      WT: string[];                  // Weakness-Threat strategies
    };
    
    strategicPosition?: string;
  };
  
  summary: {
    totalItems: number;
    criticalIssues: number;
  };
}
```

### 7.2 Correct Bridge Implementation

```typescript
// In Market Entry journey:

// ✅ CORRECT:
const swotOutput = (swotResult as any)?.output;

if (!swotOutput || 
    !Array.isArray(swotOutput.strengths) || 
    !Array.isArray(swotOutput.weaknesses) ||
    !Array.isArray(swotOutput.opportunities) ||
    !Array.isArray(swotOutput.threats)) {
  throw new Error('SWOT bridge failed: Invalid SWOT output shape');
}

const decisions = await generator.generateDecisionsFromSWOT(swotOutput, sessionId);
```

### 7.3 Transformation Logic

| SWOT Cross-Reference | Decision Category | Question Pattern |
|---------------------|-------------------|------------------|
| SO (Strength + Opportunity) | Strategic | "How can we leverage X to capture Y?" |
| WO (Weakness + Opportunity) | Capability | "What capability do we need to capture Y?" |
| ST (Strength + Threat) | Defensive | "How can we use X to defend against Y?" |
| WT (Weakness + Threat) | Risk | "How do we mitigate X exposure to Y?" |

---

## 8. BMC → Decisions Bridge

### 8.1 BMC Executor Output Shape

```typescript
interface BMCExecutorResult {
  framework: 'bmc';
  
  output: {
    canvas: {
      customerSegments: BMCBlock;
      valuePropositions: BMCBlock;
      channels: BMCBlock;
      customerRelationships: BMCBlock;
      revenueStreams: BMCBlock;
      keyResources: BMCBlock;
      keyActivities: BMCBlock;
      keyPartnerships: BMCBlock;
      costStructure: BMCBlock;
    };
    insights: string[];
    gaps: string[];
    recommendations: string[];
  };
  
  summary: {
    completeness: number;
    coherence: number;
  };
}
```

### 8.2 Transformation Logic

| BMC Analysis | Decision Type |
|--------------|---------------|
| Multiple viable customer segments | Segment prioritization |
| Revenue stream alternatives | Revenue model selection |
| Channel conflicts | Distribution strategy |
| Partnership gaps | Build vs. partner |

---

## 9. Bridge Implementation Checklist

### For ANY Bridge Implementation:

```typescript
// 1. ALWAYS extract the right property
const frameworkOutput = (result as any)?.output;  // NOT .data!

// 2. ALWAYS validate shape before use
if (!frameworkOutput || !isValidShape(frameworkOutput)) {
  throw new Error(`Bridge failed: Invalid ${framework} output shape`);
}

// 3. ALWAYS log what you receive (for debugging)
console.log(`[Bridge] ${source} → ${target}:`, JSON.stringify(frameworkOutput, null, 2));

// 4. ALWAYS transform, don't just pass through
const transformedInput = transformForTarget(frameworkOutput);

// 5. ALWAYS validate output shape
if (!isValidTargetInput(transformedInput)) {
  throw new Error(`Bridge failed: Transformation produced invalid shape`);
}
```

### Shape Validation Functions

```typescript
function isValidSWOTOutput(output: any): output is SWOTOutput {
  return output &&
    Array.isArray(output.strengths) &&
    Array.isArray(output.weaknesses) &&
    Array.isArray(output.opportunities) &&
    Array.isArray(output.threats);
}

function isValidBMCOutput(output: any): output is BMCOutput {
  return output &&
    output.canvas &&
    output.canvas.customerSegments &&
    output.canvas.valuePropositions;
}
```

---

## 10. Inter-Framework Bridges

### 10.1 PESTLE → Porter's Bridge

| PESTLE Factor | Porter's Force | Transformation |
|---------------|----------------|----------------|
| Legal (regulations) | Threat of New Entrants | High regulation → Higher entry barrier |
| Legal (IP protection) | Competitive Rivalry | Strong IP → Lower rivalry |
| Economic (growth) | Threat of New Entrants | High growth → More entrants |
| Economic (income) | Buyer Power | Low income → Higher buyer power |
| Technological (platforms) | Threat of Substitutes | New tech → More substitutes |
| Political (trade) | Supplier Power | Restrictions → Higher supplier power |

### 10.2 Porter's → SWOT Bridge

| Porter's Force Level | SWOT Category | Transformation |
|---------------------|---------------|----------------|
| Low force (exploitable) | Opportunity | "Low X creates opportunity to..." |
| High force (threatening) | Threat | "High X threatens..." |
| Competitor weakness | Opportunity | "Competitor gap in X..." |
| Competitor strength | Threat | "Competitor dominance in X..." |

### 10.3 Five Whys → BMC Bridge

| Five Whys Element | BMC Block | Transformation |
|-------------------|-----------|----------------|
| Critical assumption (customer) | Customer Segments | Block must validate assumption |
| Critical assumption (value) | Value Propositions | Block must address assumption |
| Critical assumption (revenue) | Revenue Streams | Block must justify assumption |
| Root cause | Key Activities | Block must include validation |

---

## 11. Native Output Types

### 11.1 PESTLE Native
```typescript
interface PESTLENative {
  factors: {
    political: PESTLEFactor[];
    economic: PESTLEFactor[];
    social: PESTLEFactor[];
    technological: PESTLEFactor[];
    legal: PESTLEFactor[];
    environmental: PESTLEFactor[];
  };
  prioritizedFactors: PESTLEFactor[];
}
```

### 11.2 Porter's Native
```typescript
interface PortersNative {
  forces: {
    threatOfNewEntrants: ForceAnalysis;
    supplierPower: ForceAnalysis;
    buyerPower: ForceAnalysis;
    threatOfSubstitutes: ForceAnalysis;
    competitiveRivalry: ForceAnalysis;
  };
  overallAttractiveness: 'high' | 'medium' | 'low';
}
```

### 11.3 SWOT Native
```typescript
interface SWOTNative {
  strengths: SWOTItem[];
  weaknesses: SWOTItem[];
  opportunities: SWOTItem[];
  threats: SWOTItem[];
  crossReference: { SO: string[]; WO: string[]; ST: string[]; WT: string[]; };
  strategicPosition: string;
}
```

### 11.4 BMC Native
```typescript
interface BMCNative {
  canvas: {
    customerSegments: BMCBlock;
    valuePropositions: BMCBlock;
    channels: BMCBlock;
    customerRelationships: BMCBlock;
    revenueStreams: BMCBlock;
    keyResources: BMCBlock;
    keyActivities: BMCBlock;
    keyPartnerships: BMCBlock;
    costStructure: BMCBlock;
  };
  insights: string[];
  gaps: string[];
}
```

### 11.5 Five Whys Native
```typescript
interface FiveWhysNative {
  successHypothesis: string;
  whyChains: WhyChain[];
  rootCauses: string[];
  assumptions: Assumption[];
  validationPriorities: ValidationPriority[];
}
```

### 11.6 Ansoff Native
```typescript
interface AnsoffNative {
  currentPosition: { products: string[]; markets: string[]; };
  growthOptions: {
    marketPenetration: GrowthQuadrant;
    marketDevelopment: GrowthQuadrant;
    productDevelopment: GrowthQuadrant;
    diversification: GrowthQuadrant;
  };
  recommendedDirection: string;
}
```

### 11.7 Blue Ocean Native
```typescript
interface BlueOceanNative {
  strategyCanvas: { factors: string[]; ourCurve: number[]; competitorCurves: {}[]; };
  fourActions: { eliminate: string[]; reduce: string[]; raise: string[]; create: string[]; };
  valueInnovation: { description: string; differentiation: string[]; costReduction: string[]; };
}
```

---

## 12. Orchestrator Implementation

```typescript
class JourneyOrchestrator {
  async executeJourney(
    journeyType: JourneyType,
    initialContext: JourneyContext
  ): Promise<JourneyResult> {

    // CREATE STRATEGY CONTEXT EARLY
    const strategyContext = this.buildStrategyContext(initialContext);
    validateContextForEPM(strategyContext);

    const journey = getJourney(journeyType);
    const modules = journey.frameworks;
    const outputs: StandardModuleOutput[] = [];
    let currentContext = this.buildInitialModuleInput(initialContext);

    // Execute each module in sequence
    for (let i = 0; i < modules.length; i++) {
      const moduleId = modules[i];
      const nextModuleId = modules[i + 1];

      // ORCHESTRATOR prepares GENERIC context
      const moduleInput = this.prepareModuleInput(currentContext, outputs);

      // Execute module (module is DUMB)
      const executor = this.getExecutor(moduleId);
      const output = await executor.execute(moduleInput);

      // Validate and store
      this.validateOutput(output, moduleId);
      outputs.push(output);

      // Apply Cognitive Bridge if needed
      if (nextModuleId && this.needsBridge(moduleId, nextModuleId)) {
        currentContext = await this.applyCognitiveBridge(
          moduleId, nextModuleId, output, currentContext
        );
      }
    }

    // Apply Framework → Decisions Bridge
    const decisionsInput = this.frameworkToDecisionsBridge(outputs);

    // PASS CONTEXT TO EPM
    return { 
      journeyType, 
      outputs, 
      decisionsInput,
      strategyContext  // ← CONTEXT FLOWS TO EPM
    };
  }
}
```

---

## 13. Error Handling for Bridges

```typescript
async function executeBridgeWithRecovery(
  source: string,
  target: string,
  sourceOutput: any,
  transformFn: (input: any) => any
): Promise<any> {
  try {
    // Extract correct property
    const data = sourceOutput?.output || sourceOutput;
    
    if (!data) {
      throw new Error(`No data from ${source}`);
    }
    
    const transformed = transformFn(data);
    
    if (!transformed) {
      throw new Error(`Transformation failed`);
    }
    
    return transformed;
    
  } catch (error) {
    console.error(`[Bridge] ${source} → ${target} FAILED:`, error);
    
    // Return minimal valid structure to prevent crash
    return getMinimalValidStructure(target);
  }
}

function getMinimalValidStructure(target: string): any {
  switch (target) {
    case 'decisions':
      return { decisions: [] };
    case 'swot':
      return { strengths: [], weaknesses: [], opportunities: [], threats: [] };
    case 'bmc':
      return { canvas: {} };
    default:
      return {};
  }
}
```

---

# PART 3: EPM SYNTHESIS

---

## 14. EPM Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                               EPM SYNTHESIS PIPELINE                                     │
│                                                                                          │
│   StrategyContext + Decisions + Priorities                                              │
│          │                                                                               │
│          ▼                                                                               │
│   ┌─────────────────┐                                                                   │
│   │ context-builder │ ← Validates context, builds EPM context                           │
│   └────────┬────────┘                                                                   │
│            │                                                                             │
│            ▼                                                                             │
│   ┌─────────────────┐                                                                   │
│   │   workstream-   │ ← Context-aware names, scope de-duplication                       │
│   │   generator     │                                                                   │
│   └────────┬────────┘                                                                   │
│            │                                                                             │
│            ▼                                                                             │
│   ┌─────────────────┐                                                                   │
│   │   resource-     │ ← Context-aware role selection                                    │
│   │   allocator     │                                                                   │
│   └────────┬────────┘                                                                   │
│            │                                                                             │
│            ▼                                                                             │
│   ┌─────────────────┐                                                                   │
│   │ risk-generator  │ ← Owner assignment, severity normalization                        │
│   └────────┬────────┘                                                                   │
│            │                                                                             │
│            ▼                                                                             │
│   ┌─────────────────┐                                                                   │
│   │   benefits-     │ ← Context-aware benefit templates                                 │
│   │   generator     │                                                                   │
│   └────────┬────────┘                                                                   │
│            │                                                                             │
│            ▼                                                                             │
│   ┌─────────────────┐                                                                   │
│   │  assignment-    │ ← Enum normalization for DB                                       │
│   │  creator        │                                                                   │
│   └────────┬────────┘                                                                   │
│            │                                                                             │
│            ▼                                                                             │
│   ┌─────────────────┐                                                                   │
│   │   validator     │ ← Pre-export quality check                                        │
│   └────────┬────────┘                                                                   │
│            │                                                                             │
│            ▼                                                                             │
│        EXPORT                                                                            │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Workstream Generator Contract

### 15.1 The Problem: Scope Overlap

```
WS001 "Cafe Infrastructure Development & Setup" - includes POS systems
WS002 "Cafe Technology Systems Setup" - also includes POS systems

Result: Redundant scope, unclear ownership
```

### 15.2 Workstream Output Contract

```typescript
interface Workstream {
  id: string;                                  // "WS001"
  name: string;                                // Context-appropriate name
  description: string;
  
  owner: {
    role: string;                              // Must match resource roles
    name?: string;
  };
  
  startDate: string;
  endDate: string;
  phase: number;
  
  // Scope Definition (prevents overlap)
  scope: {
    includes: string[];
    excludes: string[];
    dependencies: string[];
  };
  
  deliverables: {
    id: string;
    name: string;
    description: string;
    dueDate: string;
  }[];
  
  status: 'pending' | 'in_progress' | 'complete';
}
```

### 15.3 Scope De-duplication

```typescript
const SCOPE_DOMAINS = {
  infrastructure: ['construction', 'renovation', 'physical space', 'furniture', 'fixtures'],
  technology: ['software', 'POS', 'systems', 'digital', 'IT', 'hardware'],
  operations: ['processes', 'procedures', 'SOPs', 'workflows'],
  talent: ['hiring', 'recruitment', 'training', 'onboarding', 'HR'],
  marketing: ['branding', 'advertising', 'promotion', 'PR', 'social media'],
  compliance: ['licensing', 'permits', 'regulations', 'legal', 'certifications'],
  finance: ['budget', 'funding', 'accounting', 'cash flow']
};

function validateNoScopeOverlap(workstreams: Workstream[]): void {
  const domainAssignments = new Map<string, string>();
  
  for (const ws of workstreams) {
    const domain = assignScopeDomain(ws.name, ws.deliverables.map(d => d.name));
    
    if (domainAssignments.has(domain)) {
      throw new Error(
        `Scope overlap detected: "${ws.name}" and "${domainAssignments.get(domain)}" ` +
        `both claim ${domain} domain. Merge or clarify scope boundaries.`
      );
    }
    
    domainAssignments.set(domain, ws.name);
  }
}
```

### 15.4 Context-Aware Workstream Naming

```typescript
const WORKSTREAM_TEMPLATES: Record<BusinessCategory, string[]> = {
  food_beverage: [
    '{Business} Location Setup & Build-out',
    '{Business} Kitchen & Equipment Installation',
    '{Business} Staff Recruitment & Training',
    '{Business} Menu Development & Supplier Setup',
    '{Business} Technology & POS Implementation',
    '{Business} Marketing & Pre-Launch Campaign',
    '{Business} Licensing & Compliance',
    '{Business} Soft Launch & Operations Refinement'
  ],
  // ... other categories
};
```

---

## 16. Resource Allocator Contract

### 16.1 The Problem: Wrong Roles

```
INPUT:   "Traditional Cafe"
ROLES:   "Catering Operations Manager", "Corporate Sales Manager"
EXPECTED: "Cafe Manager", "Barista Lead", "Head Baker"
```

### 16.2 Resource Output Contract

```typescript
interface Resource {
  id: string;
  
  role: string;                                // Context-appropriate title
  type: ResourceType;                          // 'internal' | 'external' | 'contractor'
  
  fte: number;                                 // 0.1 to 1.0, NOT always 1.0
  
  skills: string[];
  responsibilities: string[];
  
  assignedWorkstreams: string[];
  
  source: 'internal_team' | 'new_hire' | 'contractor' | 'vendor';
}

// CRITICAL: Type must match database enum exactly
type ResourceType = 'internal' | 'external' | 'contractor';  // NOT "Internal"
```

### 16.3 Context-Aware Role Mapping

```typescript
const ROLE_TEMPLATES: Record<BusinessCategory, Record<string, RoleTemplate[]>> = {
  food_beverage: {
    cafe_coffee_shop: [
      { role: 'Cafe Manager', fte: 1.0, skills: ['cafe operations', 'staff management'] },
      { role: 'Head Barista', fte: 1.0, skills: ['espresso preparation', 'latte art'] },
      { role: 'Shift Supervisor', fte: 0.8, skills: ['team coordination', 'cash handling'] },
      { role: 'Barista', fte: 0.6, skills: ['beverage preparation', 'customer interaction'] },
      { role: 'Kitchen Staff', fte: 0.5, skills: ['food prep', 'food safety'] },
    ],
    catering: [
      { role: 'Catering Operations Manager', fte: 1.0, skills: ['event coordination'] },
      { role: 'Corporate Sales Manager', fte: 1.0, skills: ['B2B sales'] },
      // These are ONLY valid for catering businesses!
    ]
  }
};

function selectRoles(context: StrategyContext): RoleTemplate[] {
  const category = context.businessType.category;
  const subcategory = context.businessType.subcategory;
  
  // First try exact subcategory match
  if (ROLE_TEMPLATES[category]?.[subcategory]) {
    return ROLE_TEMPLATES[category][subcategory];
  }
  
  // Fall back to category default
  return ROLE_TEMPLATES[category]?.default || ROLE_TEMPLATES.generic;
}
```

---

## 17. Risk Generator Contract

### 17.1 The Problem: Missing Owner & Severity

```csv
Risk ID,Description,Probability,Impact,Severity,Owner
RISK-1,Limited Brand Recognition,15,Low,-,-
```

Missing: Severity calculation, Owner assignment

### 17.2 Risk Output Contract

```typescript
interface Risk {
  id: string;
  
  description: string;
  category: RiskCategory;
  
  // Assessment (ALL REQUIRED)
  probability: number;                         // 1-5 scale (not percentage!)
  impact: number;                              // 1-5 scale (not "Low"/"High"!)
  severity: number;                            // probability × impact (calculated)
  
  // Ownership (REQUIRED)
  owner: string;                               // Must match a Resource.role
  
  mitigationStrategy: string;
  contingencyPlan?: string;
  
  status: 'identified' | 'mitigating' | 'resolved' | 'accepted';
}

type RiskCategory = 'strategic' | 'operational' | 'financial' | 'compliance' | 'reputational' | 'execution';
```

### 17.3 Risk Assessment Normalization

```typescript
function normalizeToScale(value: any): 1 | 2 | 3 | 4 | 5 {
  // Handle percentage (0-100)
  if (typeof value === 'number' && value > 5) {
    if (value <= 20) return 1;
    if (value <= 40) return 2;
    if (value <= 60) return 3;
    if (value <= 80) return 4;
    return 5;
  }
  
  // Handle text
  if (typeof value === 'string') {
    const map: Record<string, 1 | 2 | 3 | 4 | 5> = {
      'very low': 1, 'low': 2, 'medium': 3, 'moderate': 3,
      'high': 4, 'very high': 5, 'critical': 5
    };
    return map[value.toLowerCase()] || 3;
  }
  
  return Math.round(value) as 1 | 2 | 3 | 4 | 5;
}

function calculateSeverity(probability: number, impact: number): number {
  return probability * impact;  // 1-25 scale
}
```

### 17.4 Risk Owner Assignment

```typescript
function assignRiskOwner(risk: Risk, resources: Resource[], workstreams: Workstream[]): string {
  const categoryOwnerMap: Record<RiskCategory, string[]> = {
    strategic: ['General Manager', 'CEO', 'Managing Director', 'Cafe Manager'],
    operational: ['Operations Manager', 'Cafe Manager', 'Store Manager'],
    financial: ['Finance Manager', 'CFO', 'Controller', 'General Manager'],
    compliance: ['Compliance Officer', 'Legal', 'Operations Manager'],
    reputational: ['Marketing Manager', 'PR Manager', 'General Manager'],
    execution: ['Project Manager', 'Program Manager', 'Operations Manager']
  };
  
  const candidateRoles = categoryOwnerMap[risk.category] || [];
  const availableRoles = resources.map(r => r.role);
  
  for (const candidate of candidateRoles) {
    const match = availableRoles.find(r => 
      r.toLowerCase().includes(candidate.toLowerCase())
    );
    if (match) return match;
  }
  
  return resources[0]?.role || 'Project Lead';
}
```

---

## 18. Benefits Generator Contract

### 18.1 The Problem: Context Bleed

```csv
BEN-3,Market Position,Corporate Catering Market,Strategic,...
```

"Corporate Catering Market" for a Traditional Cafe is wrong.

### 18.2 Benefits Output Contract

```typescript
interface Benefit {
  id: string;
  
  name: string;                                // Context-appropriate
  description: string;
  
  category: BenefitCategory;                   // Mix required
  
  metric: string;
  target: string;
  baseline?: string;
  
  timeframe: string;
  
  responsibleParty: string;                    // Must match Resource.role
}

type BenefitCategory = 'strategic' | 'financial' | 'customer' | 'operational' | 'employee';

// REQUIRED: Mix of categories
function validateBenefitMix(benefits: Benefit[]): void {
  const categories = new Set(benefits.map(b => b.category));
  
  const required: BenefitCategory[] = ['strategic', 'financial', 'customer'];
  const missing = required.filter(c => !categories.has(c));
  
  if (missing.length > 0) {
    console.warn(`[Benefits] Missing categories: ${missing.join(', ')}`);
  }
}
```

### 18.3 Context-Aware Benefit Templates

```typescript
const BENEFIT_TEMPLATES: Record<string, BenefitTemplate[]> = {
  cafe_coffee_shop: [
    {
      category: 'strategic',
      nameTemplate: 'Established Local Brand Presence',
      descriptionTemplate: 'Position {businessName} as the preferred cafe in {district}',
      metricTemplate: 'Brand awareness survey (quarterly)',
      targetTemplate: '+30% aided awareness by Month 6'
    },
    {
      category: 'customer',
      nameTemplate: 'Customer Loyalty Program Adoption',
      descriptionTemplate: 'Build repeat customer base through loyalty program',
      metricTemplate: 'Loyalty program sign-ups',
      targetTemplate: '500 members by Month 4'
    },
    // ... more templates
  ]
};
```

---

## 19. Assignment Persistence Contract

### 19.1 The Problem: Database Enum Mismatch

```
Error: invalid input value for enum assignment_resource_type: "internal"
```

### 19.2 Type Normalization

```typescript
// Canonical enum values (match database)
const VALID_RESOURCE_TYPES = ['INTERNAL', 'EXTERNAL', 'CONTRACTOR'] as const;
type ValidResourceType = typeof VALID_RESOURCE_TYPES[number];

function normalizeResourceType(input: string): ValidResourceType {
  const upper = input.toUpperCase();
  
  if (VALID_RESOURCE_TYPES.includes(upper as any)) {
    return upper as ValidResourceType;
  }
  
  const mapping: Record<string, ValidResourceType> = {
    'internal': 'INTERNAL',
    'internal team': 'INTERNAL',
    'employee': 'INTERNAL',
    'external': 'EXTERNAL',
    'vendor': 'EXTERNAL',
    'consultant': 'EXTERNAL',
    'contractor': 'CONTRACTOR',
    'freelance': 'CONTRACTOR',
  };
  
  return mapping[input.toLowerCase()] || 'INTERNAL';
}

// Use before any database operation
function prepareAssignmentForSave(assignment: any): Assignment {
  return {
    ...assignment,
    resourceType: normalizeResourceType(assignment.resourceType)
  };
}
```

---

## 20. EPM Pre-Export Validation

### 20.1 Complete Validation Checklist

```typescript
async function validateEPMBeforeExport(
  context: StrategyContext,
  epm: EPMData
): Promise<EPMValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // 1. Decisions present
  if (!epm.decisions || epm.decisions.length === 0) {
    errors.push({
      code: 'DECISIONS_MISSING',
      message: 'No decisions found. Check Framework → Decisions bridge.',
      fix: 'See Part 2, Section 6-7'
    });
  }
  
  // 2. Assignments present
  if (!epm.assignments || epm.assignments.length === 0) {
    errors.push({
      code: 'ASSIGNMENTS_MISSING', 
      message: 'No assignments found. Check assignment persistence.',
      fix: 'See Part 3, Section 19'
    });
  }
  
  // 3. Workstream count (5-8)
  if (epm.workstreams?.length < 5 || epm.workstreams?.length > 8) {
    warnings.push({
      code: 'WORKSTREAM_COUNT',
      message: `${epm.workstreams?.length || 0} workstreams (expected 5-8)`
    });
  }
  
  // 4. No scope overlap
  try {
    validateNoScopeOverlap(epm.workstreams);
  } catch (e) {
    errors.push({
      code: 'WORKSTREAM_OVERLAP',
      message: e.message,
      fix: 'See Part 3, Section 15.3'
    });
  }
  
  // 5. Resources match context
  const contextMismatch = checkResourceContextMatch(context, epm.resources);
  if (contextMismatch.length > 0) {
    warnings.push({
      code: 'RESOURCE_CONTEXT_MISMATCH',
      message: `Roles don't match ${context.businessType.name}: ${contextMismatch.join(', ')}`
    });
  }
  
  // 6. Risks complete
  const incompleteRisks = epm.risks?.filter(r => 
    !r.owner || r.owner === '-' || 
    !r.severity || r.severity === '-'
  );
  if (incompleteRisks?.length > 0) {
    errors.push({
      code: 'RISKS_INCOMPLETE',
      message: `${incompleteRisks.length} risks missing owner/severity`,
      fix: 'See Part 3, Section 17'
    });
  }
  
  // 7. Benefits mix
  const benefitCategories = new Set(epm.benefits?.map(b => b.category) || []);
  if (!benefitCategories.has('strategic') || 
      !benefitCategories.has('financial') ||
      !benefitCategories.has('customer')) {
    warnings.push({
      code: 'BENEFITS_MIX_INCOMPLETE',
      message: 'Missing required benefit categories'
    });
  }
  
  // 8. Benefits match context
  const mismatchedBenefits = checkBenefitContextMatch(context, epm.benefits);
  if (mismatchedBenefits.length > 0) {
    errors.push({
      code: 'BENEFITS_CONTEXT_BLEED',
      message: `Benefits don't match ${context.businessType.name}`
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
```

---

# PART 4: REFERENCE

---

## 21. Quick Reference Tables

### 21.1 Framework → Decisions Bridge

| Journey | Final Framework | Extract Property | Validation Function | Decision Method |
|---------|-----------------|------------------|---------------------|-----------------|
| Market Entry | SWOT | `.output` | `isValidSWOTOutput()` | `generateDecisionsFromSWOT()` |
| BMI | BMC | `.output` | `isValidBMCOutput()` | `generateDecisionsFromBMC()` |
| Competitive | Blue Ocean | `.output` | `isValidBlueOceanOutput()` | `generateDecisionsFromBlueOcean()` |
| Digital Transform | Ansoff | `.output` | `isValidAnsoffOutput()` | `generateDecisionsFromAnsoff()` |
| Crisis Recovery | BMC | `.output` | `isValidBMCOutput()` | `generateDecisionsFromBMC()` |
| Growth Strategy | BMC | `.output` | `isValidBMCOutput()` | `generateDecisionsFromBMC()` |

### 21.2 EPM Pipeline

| Stage | Module | Context Fields Used | Output Validation |
|-------|--------|---------------------|-------------------|
| Context Build | `context-builder.ts` | Creates context | `validateContextForEPM()` |
| Workstreams | `workstream-generator.ts` | `businessType`, `industry.keywords` | `validateNoScopeOverlap()` |
| Resources | `resource-allocator.ts` | `businessType`, `industry` | `checkResourceContextMatch()` |
| Risks | `risk-generator.ts` | `businessType`, `region.regulations` | `normalizeRiskAssessment()` |
| Benefits | `benefits-generator.ts` | `businessType`, `industry` | `validateBenefitMix()` |
| Assignments | `assignment-creator.ts` | `businessType` | `normalizeResourceType()` |
| Export | `validator.ts` | ALL | `validateEPMBeforeExport()` |

### 21.3 Architecture Violations

| ❌ WRONG | ✅ RIGHT |
|----------|----------|
| Module imports another module | Modules know nothing about each other |
| Module receives `pestleOutput` | Module receives generic `priorAnalysis` |
| Extract `.data` from framework result | Extract `.output` from framework result |
| EPM generator doesn't receive context | Context passed explicitly to all generators |
| Resource type as "internal" | Resource type as "INTERNAL" (match DB enum) |
| Roles don't match business type | Context-aware role templates |

---

## 22. File Reference

```
server/
├── journey/
│   ├── journey-orchestrator.ts       # CENTRAL ORCHESTRATOR
│   ├── journey-registry.ts           # Journey definitions
│   ├── framework-executor-registry.ts
│   ├── executors/
│   │   ├── pestle-executor.ts
│   │   ├── porters-executor.ts
│   │   ├── swot-executor.ts
│   │   ├── five-whys-executor.ts
│   │   ├── bmc-executor.ts
│   │   └── ...
│   └── bridges/
│       ├── pestle-to-porters-bridge.ts
│       ├── porters-to-swot-bridge.ts
│       ├── whys-to-bmc-bridge.ts
│       ├── swot-to-decisions-bridge.ts    # 🔴 CRITICAL
│       └── ...
├── intelligence/
│   └── epm/
│       ├── context-builder.ts
│       ├── workstream-generator.ts
│       ├── resource-allocator.ts
│       ├── risk-generator.ts
│       ├── benefits-generator.ts
│       ├── assignment-creator.ts
│       └── validator.ts
└── services/
    └── export/

shared/
├── journey-types.ts
├── module-contracts.ts
├── strategy-context.ts              # StrategyContext interface
└── schema.ts
```

---

## 23. Glossary

| Term | Definition |
|------|------------|
| **Orchestrator** | Central coordinator - knows sequence, transforms context, maintains StrategyContext |
| **Module** | Dumb worker - does one job, knows nothing about others |
| **Cognitive Bridge** | Intelligent transformation between specific modules |
| **Framework→Decisions Bridge** | Bridge from final framework to DecisionGenerator |
| **StrategyContext** | Business context object that flows through entire pipeline |
| **Native Output** | Module-specific format (for UI) |
| **Standard Output** | Universal format all modules produce |
| **Decision Seeds** | Strategic choices, tradeoffs, priorities from a module |
| **Context Bleed** | When wrong business context contaminates downstream outputs |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-31 | v4.0 - Unified from three separate documents |
| 2026-01-31 | Added StrategyContext propagation (Section 5) |
| 2026-01-31 | Added EPM synthesis contracts (Sections 14-20) |
| 2026-01-31 | Documented SWOT → Decisions bug (`.data` vs `.output`) |
| 2026-01-31 | Added context-aware role and benefit templates |
| 2026-01-31 | Added pre-export validation checklist |

---

*This is the canonical reference. When code disagrees with this spec, the code has a bug.*

*Supersedes: PREMISIA_CANONICAL_ARCHITECTURE_FINAL.md, PREMISIA_ARCHITECTURE_FINAL.md, PREMISIA_BRIDGE_SPEC.md*
