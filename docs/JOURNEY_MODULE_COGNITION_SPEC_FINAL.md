# Premisia Journey Builder: Module Cognition Specification (Final)

## Executive Summary

**What We Need:** Complete cognitive specifications for every strategic framework module in Premisia's Journey Builder.

**Why:** Our current modules return `Promise<any>`, have no input/output contracts, use generic prompts, and produce garbage outputs. The frameworks run but don't think.

**Deliverables Required:**
1. Module Specifications for: Positioning, Five Whys, PESTLE, Porter's Five Forces, SWOT, BMC, Strategic Decisions, EPM Generator
2. Bridge Specifications connecting each module pair
3. Journey Template Specifications composing modules into complete journeys
4. TypeScript interfaces for all inputs/outputs
5. Prompt templates encoding domain expertise
6. Validation layer design
7. Test cases for each module and journey

**Success Criteria:** A developer can implement any module by following its spec. Outputs are consistently valuable. Journeys can be composed reliably.

---

## Part 1: The Vision

### What Premisia Does

Premisia makes strategic consulting accessible. Users put in basic information about a business idea, and the system guides them through rigorous strategic analysis to actionable execution plans.

**The value proposition:**
- No $50K consulting engagement
- Do it from your laptop
- Put in basic info, iterate to better plans
- Get the same frameworks consultants use, but automated

### What Users Experience

The user should FEEL after completing a journey:
- **Confident** about whether to proceed
- **Clear** on the 3-5 key decisions they need to make
- **Equipped** with a concrete execution plan

**The frameworks are machinery, not the product. Users don't care about PESTLE or Porter's. They care about answers.**

### User Experience Goals Per Step

| Step | User Should FEEL | User Should KNOW | User Should BE ABLE TO |
|------|------------------|------------------|------------------------|
| **After Positioning** | Clarity about scope | Exactly what we're analyzing | Confirm or refine the focus |
| **After PESTLE** | Informed about external landscape | Key macro factors affecting success | Identify biggest external risks/opportunities |
| **After Porter's** | Clear about competitive dynamics | Who competitors are, power dynamics | Assess whether market is attractive |
| **After SWOT** | Confident in strategic position | Strengths to leverage, gaps to address | Prioritize what matters most |
| **After Decisions** | Committed to a direction | Tradeoffs of chosen path | Defend choices to stakeholders |
| **After EPM** | Ready to execute | What to do, in what order, with what resources | Start implementation |

### What's Currently Broken

1. Modules return `Promise<any>` — no type safety
2. No input contracts — modules don't know what they need
3. No output contracts — modules produce inconsistent shapes
4. Generic prompts — don't encode real strategic thinking
5. Bridges are broken — data passes but isn't transformed meaningfully
6. No validation — garbage in, garbage out
7. No tests — we don't know when things break

---

## Part 2: Architecture Overview

### Journey Builder Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        JOURNEY BUILDER                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐           │
│  │   Journey    │    │  Framework   │    │   Journey    │           │
│  │   Registry   │───▶│   Executor   │───▶│ Orchestrator │           │
│  │              │    │   Registry   │    │              │           │
│  └──────────────┘    └──────────────┘    └──────────────┘           │
│         │                   │                   │                    │
│         ▼                   ▼                   ▼                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐           │
│  │   Journey    │    │   Module     │    │   Context    │           │
│  │  Templates   │    │   Specs      │    │   Builder    │           │
│  └──────────────┘    └──────────────┘    └──────────────┘           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Existing Files (for reference):**

| File | Purpose | Current State |
|------|---------|---------------|
| `server/journey/journey-registry.ts` | Journey definitions | Market Entry missing pageSequence, dependencies |
| `server/journey/framework-executor-registry.ts` | Executor registration | Only FiveWhys and BMC registered |
| `server/journey/journey-orchestrator.ts` | Executes journeys | Doesn't validate prerequisites |
| `server/journey/executors/` | Module implementations | Missing PESTLE, Porter's, SWOT executors |
| `server/journey/bridges/` | Module connections | Only whys-to-bmc bridge exists |
| `server/intelligence/epm/context-builder.ts` | Context extraction | Has bugs with business name extraction |
| `server/intelligence/porters-analyzer.ts` | Porter's logic | 680 lines exist but not connected to journey |
| `shared/journey-types.ts` | Type definitions | Good interfaces, not enforced |
| `shared/framework-types.ts` | Result types | Defined but executors return `any` |

### Cognitive Pipeline Model

A journey is NOT a list of prompts. It's a **cognitive pipeline** where each module's thinking informs the next.

```
[User Input]
     │
     ▼
┌─────────────────┐
│   POSITIONING   │  ← "What exactly are we analyzing?"
│     MODULE      │
└────────┬────────┘
         │ Positioning Context
         ▼
┌─────────────────┐
│    FRAMEWORK    │  ← Thinks using positioning context
│       1         │
└────────┬────────┘
         │ Framework 1 Output
         ▼
┌─────────────────┐
│     BRIDGE      │  ← Interprets F1 output for F2
│    F1 → F2      │
└────────┬────────┘
         │ Enriched Context
         ▼
┌─────────────────┐
│    FRAMEWORK    │  ← Thinks using enriched context
│       2         │
└────────┬────────┘
         │
         ▼
        ...
         │
         ▼
┌─────────────────┐
│   STRATEGIC     │  ← Synthesizes all analysis
│   DECISIONS     │
└────────┬────────┘
         │ User Selections
         ▼
┌─────────────────┐
│      EPM        │  ← Generates execution plan
│   GENERATOR     │
└─────────────────┘
```

---

## Part 3: Context Layer Specification

### Why This Matters

We spent hours debugging why `context.business.name` showed "Unnamed Business" instead of the actual business name. The context layer is critical but was undocumented.

### Context Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INPUT                                    │
│  "Premium basketball sneaker store targeting collectors in Abu Dhabi"│
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   STRATEGIC UNDERSTANDING                            │
│  (Database: strategic_understanding table)                           │
│                                                                      │
│  - id: uuid                                                          │
│  - sessionId: uuid                                                   │
│  - userInput: string (raw user input)                                │
│  - title: string (extracted business name)                           │
│  - businessType: enum (B2B, B2C, B2B2C)                              │
│  - industry: string (detected industry)                              │
│  - geography: string (detected geography)                            │
│  - ambiguities: json (clarifying Q&A)                                │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      CONTEXT BUILDER                                 │
│  (File: server/intelligence/epm/context-builder.ts)                  │
│                                                                      │
│  Extracts from strategic_understanding:                              │
│  - business.name: string (from title or extracted from userInput)    │
│  - business.industry: string                                         │
│  - business.geography: string                                        │
│  - business.type: B2B | B2C | B2B2C                                  │
│  - initiative.description: string                                    │
│  - initiative.type: string                                           │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    STRATEGIC CONTEXT                                 │
│  (Type: StrategicContext from shared/journey-types.ts)               │
│                                                                      │
│  This object flows through ALL modules:                              │
│  - understandingId: string                                           │
│  - sessionId: string                                                 │
│  - userInput: string                                                 │
│  - journeyType: JourneyType                                          │
│  - currentFrameworkIndex: number                                     │
│  - completedFrameworks: string[]                                     │
│  - insights: {                                                       │
│      // Accumulated outputs from each framework                      │
│      positioningOutput?: PositioningOutput                           │
│      pestleFactors?: PESTLEOutput                                    │
│      porterForces?: PortersOutput                                    │
│      swotMatrix?: SWOTOutput                                         │
│      fiveWhysOutput?: FiveWhysOutput                                 │
│      bmcBlocks?: BMCOutput                                           │
│    }                                                                 │
│  - marketResearch?: { sources, findings }                            │
│  - decisions?: { recommended, selected }                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Known Bugs We Fixed

| Bug | Root Cause | Fix |
|-----|------------|-----|
| "Unnamed Business" appearing | Query used `.where(eq(strategicUnderstanding.id, sessionId))` but should use `sessionId` column | Fixed column reference |
| Sneaker store got food service content | Business name extraction regex matched "store" → food service | Fixed regex logic |
| Context falls back silently | Falls back to "Unnamed Business" instead of failing | Should fail loudly |

### Context Validation Contract

```typescript
function validateContextBeforeFramework(
  context: StrategicContext,
  framework: FrameworkName
): ValidationResult {
  const errors: string[] = [];

  // All frameworks require positioning
  if (!context.insights?.positioningOutput) {
    errors.push('Positioning must complete before any framework runs');
  }

  // Framework-specific requirements
  if (framework === 'porters' && !context.insights?.pestleOutput) {
    errors.push('Porter\'s requires PESTLE to run first');
  }
  if (framework === 'swot') {
    if (!context.insights?.pestleOutput) {
      errors.push('SWOT requires PESTLE output');
    }
    if (!context.insights?.portersOutput) {
      errors.push('SWOT requires Porter\'s output');
    }
  }
  if (framework === 'bmc' && !context.insights?.fiveWhysOutput) {
    errors.push('BMC requires Five Whys output');
  }

  return { valid: errors.length === 0, errors };
}
```

---

## Part 4: The Positioning Module (CRITICAL)

### Why Positioning Must Come First

You cannot analyze "the market" — it's infinite. Every framework requires scope:
- PESTLE for "retail" = meaningless
- PESTLE for "premium basketball sneaker store targeting collectors in Abu Dhabi" = useful

The Positioning Module establishes:
- What business are we analyzing?
- What market/geography?
- What customer segment?
- What value proposition hypothesis?
- What strategic question are we trying to answer?

**Without positioning, every downstream framework produces generic garbage.**

### Positioning Module Specification

#### Purpose
Establish the precise scope and context for all downstream analysis. This is the "lens" through which all frameworks view the world.

#### Input Specification
```typescript
interface PositioningInput {
  userInput: string;           // Raw user description
  clarifications?: {           // From ambiguity resolution
    targetMarket?: string;
    customerSegment?: string;
    geographicScope?: string;
    timeHorizon?: string;
  };
}
```

#### Reasoning Steps (Cognition)
1. **Extract Business Concept**: What is the core business idea?
2. **Identify Market**: What market/industry does this operate in?
3. **Define Geography**: What geographic scope? (city, country, region)
4. **Specify Customer Segment**: Who is the target customer?
5. **Articulate Value Proposition Hypothesis**: What value does this deliver?
6. **Frame Strategic Question**: What decision are we trying to inform?
7. **Identify Analysis Constraints**: What's in scope vs out of scope?
8. **Determine Venture Type**: New venture or existing business? (Critical for S/W assessment)

#### Output Specification
```typescript
interface PositioningOutput {
  businessConcept: {
    name: string;                    // "Premium Basketball Sneaker Store"
    description: string;             // One paragraph summary
    category: string;                // "Specialty Retail"
  };
  market: {
    industry: string;                // "Athletic Footwear Retail"
    industryNarrow: string;          // "Premium/Collector Sneakers"
    geography: string;               // "Abu Dhabi, UAE"
    geographyScope: 'city' | 'country' | 'region' | 'global';
  };
  customer: {
    primarySegment: string;          // "Sneaker collectors and enthusiasts"
    secondarySegments?: string[];    // ["Athletes", "Fashion-conscious youth"]
    demographicProfile?: string;     // "Males 18-35, middle-to-high income"
  };
  valueProposition: {
    hypothesis: string;              // "Authentic limited-edition sneakers with verification"
    keyDifferentiators: string[];    // ["Authentication", "Exclusive releases", "Expert curation"]
  };
  strategicQuestion: string;         // "Should we enter this market and how?"
  analysisScope: {
    inScope: string[];               // ["UAE market", "Physical retail", "E-commerce"]
    outOfScope: string[];            // ["Wholesale", "Manufacturing"]
    timeHorizon: string;             // "12-month launch plan"
  };
  ventureType: 'new_venture' | 'existing_business';
}
```

#### Quality Criteria
| Criterion | Measure | Bad Example | Good Example |
|-----------|---------|-------------|--------------|
| Specificity | Business concept names specific offering | "retail business" | "Premium basketball sneaker store" |
| Geographic anchor | Geography defined to city/country | "somewhere in Middle East" | "Abu Dhabi, UAE" |
| Customer clarity | Segment is identifiable | "people who buy things" | "Sneaker collectors aged 25-45" |
| Testable value prop | Can be validated/invalidated | "we'll be the best" | "Authenticated limited editions with collector community" |

#### Failure Modes
- Too broad: "retail business" (what kind? where? for whom?)
- Too vague: "make money selling things"
- No geographic anchor: can't assess regulations, competition
- No customer clarity: can't assess demand or competition

---

## Part 5: Framework Sequence Logic

### Why Sequence Matters

Frameworks aren't interchangeable. Each one builds on insights from the prior.

### Market Entry Journey Sequence

```
POSITIONING → PESTLE → PORTER'S → SWOT → DECISIONS → EPM
```

**Why this sequence:**

1. **POSITIONING first** — Defines what we're analyzing. Without it, everything is generic.

2. **PESTLE second** — Scans the macro-environment (political, economic, social, technological, legal, environmental) for THIS market. We need to understand the terrain before analyzing competition within it.

3. **PORTER'S third** — Analyzes competitive dynamics within the industry. BUT: Porter's is informed by PESTLE. Example: PESTLE identifies "strict import regulations" (Legal) → Porter's interprets this as "high barrier to entry" (Threat of New Entrants).

4. **SWOT fourth** — Synthesizes everything:
   - Opportunities = favorable PESTLE factors + weak Porter's forces
   - Threats = unfavorable PESTLE factors + strong Porter's forces
   - Strengths = value proposition advantages given the external realities
   - Weaknesses = value proposition gaps given the external realities

5. **DECISIONS fifth** — Converts the SWOT synthesis into concrete choices with options and tradeoffs.

6. **EPM sixth** — Converts decisions into executable workstreams, resources, timeline.

### Business Model Innovation Journey Sequence

```
POSITIONING → FIVE WHYS → BMC → DECISIONS → EPM
```

**Why this sequence:**

1. **POSITIONING first** — Same as above.

2. **FIVE WHYS second** — Surfaces hidden assumptions about why this business would succeed. Challenges conventional thinking. Identifies root causes of potential failure.

3. **BMC third** — Designs the business model across 9 blocks, BUT: constrained by Five Whys insights. If Five Whys identified "assumption: customers will pay premium" then BMC must address this in Revenue Streams and Value Proposition blocks.

4. **DECISIONS fourth** — Converts BMC analysis into choices (which segment to target, which revenue model, etc.)

5. **EPM fifth** — Execution plan.

### The Key Insight

**Each framework's output SHAPES the cognition of the next framework.** This isn't just data passing — it's context that changes how the next framework thinks.

---

## Part 6: Research Integration Specification

### How Modules Get Real Data

Modules don't just reason about inputs — they gather external data through web research. This grounds analysis in reality, not speculation.

### Research Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRAMEWORK EXECUTOR                    │
│                      (e.g., PESTLE)                      │
└─────────────────────────────────────────────────────────┘
                           ↓
                   Generates research queries
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   RESEARCH SERVICE                       │
│  (File: server/services/research-service.ts)             │
│                                                          │
│  1. Takes query + context                                │
│  2. Searches web sources (Tavily, Perplexity, etc.)      │
│  3. Filters for relevance                                │
│  4. Returns structured findings with citations           │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                  RESEARCH FINDINGS                       │
│                                                          │
│  - sources: Array<{ url, title, snippet, relevance }>    │
│  - findings: Array<{ claim, evidence, confidence }>      │
│  - contradictions: Array<{ claim1, claim2, resolution }> │
└─────────────────────────────────────────────────────────┘
                           ↓
                   Fed into LLM prompt
                           ↓
┌─────────────────────────────────────────────────────────┐
│                 FRAMEWORK ANALYSIS                       │
│                                                          │
│  LLM synthesizes research + reasoning into output        │
│  Citations link claims to sources                        │
└─────────────────────────────────────────────────────────┘
```

### Research Queries Per Framework

| Framework | Example Research Queries |
|-----------|--------------------------|
| **PESTLE** | "UAE retail regulations 2024", "Abu Dhabi sneaker market size", "Gulf consumer trends athletic footwear", "UAE import duties footwear", "UAE business licensing requirements retail" |
| **Porter's** | "sneaker retailers Abu Dhabi", "Nike authorized dealers UAE", "sneaker resale market Dubai competitors", "athletic footwear suppliers Middle East" |
| **SWOT** | Minimal new research — synthesizes PESTLE and Porter's findings |
| **BMC** | "sneaker authentication services cost", "collector community platforms", "premium retail customer acquisition cost UAE" |

### Research Quality Requirements

```typescript
interface ResearchRequirements {
  minSources: number;        // Minimum sources per query
  maxAge: string;            // Maximum age of sources
  requiredSourceTypes: string[];
  relevanceThreshold: number;
}

// PESTLE requires authoritative sources
const pestleResearch: ResearchRequirements = {
  minSources: 3,
  maxAge: "2 years",
  requiredSourceTypes: ["government", "industry_report", "news"],
  relevanceThreshold: 0.75
};

// Porter's allows broader competitive intelligence
const portersResearch: ResearchRequirements = {
  minSources: 5,
  maxAge: "1 year",
  requiredSourceTypes: ["news", "company_website", "industry_report"],
  relevanceThreshold: 0.7
};
```

---

## Part 7: Module Specification Template

Every module must have this specification:

### 1. Purpose Statement
- What strategic question does this framework answer?
- What value does it create for the user?

### 2. Input Specification
```typescript
interface [Module]Input {
  // Required fields with types
  // Source annotations (which prior module/context provides this)
}
```

### 3. Reasoning Steps (Cognition)
Numbered list of thinking steps the module must perform.

### 4. Output Specification
```typescript
interface [Module]Output {
  // Required fields with types
  // Annotations for which downstream modules consume each field
}
```

### 5. Research Integration
- What external data sources feed this module?
- What searches should be performed?

### 6. Quality Criteria
- What makes output "good"?
- Measurable where possible

### 7. Failure Modes
- What makes output "bad"?
- How to detect and prevent

### 8. New Venture vs Existing Business
- How does analysis differ?

### 9. Prompt Specification
- System prompt
- User prompt template
- Output format instructions

### 10. Test Cases
- Example inputs
- Expected outputs

---

## Part 8: Framework Specifications

### 8.1 PESTLE Analysis

#### Purpose
Scan macro-environmental factors affecting the specific business in the specific market. Identify external opportunities and threats at the macro level.

#### Input Specification
```typescript
interface PESTLEInput {
  positioning: PositioningOutput;     // From Positioning Module (REQUIRED)
  researchFindings?: ResearchFindings; // From web research
}
```

#### Reasoning Steps
1. **Frame the scope**: Using positioning, define exactly what environment we're scanning (e.g., "UAE retail environment for premium sneakers targeting collectors")

2. **For each PESTLE factor**, answer:
   - What specific conditions exist in THIS market?
   - How does this create opportunities or threats for THIS business?
   - What evidence supports this assessment?

3. **POLITICAL**: Government policies, trade regulations, political stability, taxation
4. **ECONOMIC**: Economic health, consumer spending, currency, inflation, market size
5. **SOCIAL**: Demographics, cultural attitudes, lifestyle trends, consumer behavior
6. **TECHNOLOGICAL**: Tech infrastructure, innovation trends, digital adoption, disruption
7. **LEGAL**: Regulations, licensing, permits, consumer protection, employment law
8. **ENVIRONMENTAL**: Environmental regulations, sustainability expectations, climate factors

9. **Prioritize**: Rank factors by impact on THIS business
10. **Synthesize**: Identify the 3-5 most critical factors

#### Output Specification
```typescript
interface PESTLEOutput {
  scope: string;  // "UAE market for premium sneaker retail targeting collectors"

  factors: {
    political: PESTLEFactor[];
    economic: PESTLEFactor[];
    social: PESTLEFactor[];
    technological: PESTLEFactor[];
    legal: PESTLEFactor[];
    environmental: PESTLEFactor[];
  };

  prioritizedFactors: PESTLEFactor[];  // Top 5-7 most impactful

  opportunities: Opportunity[];  // Derived from favorable factors
  threats: Threat[];             // Derived from unfavorable factors

  researchGaps: string[];        // Where more data is needed
  assumptions: string[];         // What we're assuming vs knowing
  confidenceLevel: 'high' | 'medium' | 'low';
}

interface PESTLEFactor {
  category: 'P' | 'E' | 'S' | 'T' | 'L' | 'E';
  factor: string;
  description: string;
  impact: 'opportunity' | 'threat' | 'neutral';
  magnitude: 'high' | 'medium' | 'low';
  implication: string;           // "For [business name], this means..."
  evidence: string;
  citation?: { url: string; title: string; date: string };
  confidence: 'verified' | 'researched' | 'inferred';
}
```

#### Quality Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Specificity | 100% factors mention business/market | String match for business name |
| Citation rate | 100% factors have sources | Count non-null citations |
| Balance | 2-5 factors per category | Count per category |
| Actionability | 100% factors have implications | Check implication field |

#### Quality Rubric (1-10 Scale)

| Score | Specificity | Evidence Quality | Actionability |
|-------|-------------|------------------|---------------|
| **9-10** | Every factor names the specific business, market, and geography. "For Abu Dhabi Sneaker Collective targeting collectors..." | All factors cite recent (<2yr) sources from government, industry reports, or credible news. Contradictions noted. | Every factor ends with "This means [business] should..." with specific action |
| **7-8** | Most factors specific to industry and geography. Some generic statements. | Most factors have citations. Mix of primary and secondary sources. | Most factors have implications. Some generic "monitor this" type recommendations |
| **5-6** | Industry-level specificity. Could apply to any sneaker retailer in UAE. | Some citations. Heavy reliance on general knowledge. | Implications stated but vague. "This could affect pricing" |
| **3-4** | Sector-level only. Could apply to any retailer in Middle East. | Few or no citations. LLM speculation. | Factors listed without implications |
| **1-2** | Generic. Could apply to any business anywhere. "The economy affects business" | No citations. Obvious/trivial statements. | No actionable content |

#### Failure Modes

| Failure | Symptom | Prevention |
|---------|---------|------------|
| Generic analysis | Output reads like Wikipedia article | Prompt requires business name in every factor |
| Missing research | Claims have no citations | Validate citation count ≥ threshold |
| Factor overload | 20+ factors per category | Limit to 3-5, require prioritization |
| No implications | Lists factors without "so what" | Require implication field |

#### Current Bad Output Example

```
CURRENT (BAD):
- "UAE has a growing economy"
- "Dubai is a tourist destination"
- "The population is diverse"

Not specific to sneaker retail, not actionable, no citations.

SHOULD BE:
- "UAE athletic footwear market reached $890M in 2023 with 8% YoY growth (Euromonitor). For Abu Dhabi Sneaker Collective, this indicates strong demand foundation for premium offerings."
- "UAE requires retail trade license from DED; process takes 2-4 weeks and requires local sponsor or free zone setup. For Abu Dhabi Sneaker Collective, budget AED 15-20K and factor into timeline."
```

#### Production PESTLE Prompt Specification

**System Prompt:**
```
You are a strategic analyst conducting a PESTLE analysis for a specific business entering a specific market. Your analysis must be:

1. SPECIFIC: Every factor must name the business and market. Never use generic statements.
2. EVIDENCED: Every factor must cite a source. If you cannot cite, mark as "inferred" with reasoning.
3. ACTIONABLE: Every factor must end with an implication: "For [business name], this means..."
4. PRIORITIZED: After analysis, rank the top 5-7 factors by impact on THIS business.

You will receive:
- Business positioning (what, where, who, value proposition)
- Research findings with citations (use these as primary evidence)

Output JSON matching the PESTLEOutput schema exactly. Do not add commentary outside the JSON structure.
```

**User Prompt Template:**
```
Conduct a PESTLE analysis for the following business:

## Business Positioning
- Business: {{positioning.businessConcept.name}}
- Description: {{positioning.businessConcept.description}}
- Industry: {{positioning.market.industry}} (specifically: {{positioning.market.industryNarrow}})
- Geography: {{positioning.market.geography}}
- Target Customer: {{positioning.customer.primarySegment}}
- Value Proposition: {{positioning.valueProposition.hypothesis}}

## Research Findings
{{#each researchFindings}}
Source: {{this.title}} ({{this.url}}, {{this.date}})
Key findings:
{{#each this.findings}}
- {{this}}
{{/each}}
{{/each}}

## Analysis Requirements

For EACH of the 6 PESTLE categories:
1. Identify 2-4 specific factors relevant to {{positioning.businessConcept.name}} in {{positioning.market.geography}}
2. For each factor, provide:
   - factor: The specific condition or trend
   - description: 2-3 sentences explaining it
   - impact: "opportunity" | "threat" | "neutral"
   - magnitude: "high" | "medium" | "low"
   - implication: "For {{positioning.businessConcept.name}}, this means..."
   - evidence: Quote or paraphrase from research
   - citation: {url, title, date} if available
   - confidence: "verified" (cited), "researched" (inferred from research), "inferred" (general knowledge)

3. After all categories, identify prioritizedFactors (top 5-7 by strategic impact)
4. Derive opportunities and threats lists from factors
5. Note any researchGaps and assumptions

Return valid JSON matching the PESTLEOutput interface.
```

**Good Output Example:**
```json
{
  "scope": "UAE premium sneaker retail market targeting collectors in Abu Dhabi",
  "factors": {
    "political": [
      {
        "category": "P",
        "factor": "UAE-US trade relations support luxury goods imports",
        "description": "UAE maintains strong trade ties with US, with bilateral trade reaching $28B in 2023. No tariffs on footwear imports. Free Trade Agreement negotiations ongoing may further reduce barriers.",
        "impact": "opportunity",
        "magnitude": "medium",
        "implication": "For Abu Dhabi Sneaker Collective, this means reliable access to US-manufactured limited editions without import cost penalties, enabling competitive pricing vs grey market.",
        "evidence": "UAE-US bilateral trade reached $28 billion in 2023, with consumer goods comprising 18% of imports",
        "citation": {"url": "https://ustr.gov/countries-regions/middle-east/uae", "title": "USTR UAE Trade Facts", "date": "2024-01"},
        "confidence": "verified"
      }
    ],
    "economic": [
      {
        "category": "E",
        "factor": "High disposable income among target demographic",
        "description": "UAE GDP per capita $50,600 (2023). Abu Dhabi specifically has highest per capita in UAE at $63,000. Expat population (88%) includes significant high-income professionals.",
        "impact": "opportunity",
        "magnitude": "high",
        "implication": "For Abu Dhabi Sneaker Collective, this means the target collector segment has purchasing power for $300-$2000+ sneakers without significant price sensitivity.",
        "evidence": "Abu Dhabi GDP per capita $63,000, highest among UAE emirates",
        "citation": {"url": "https://www.scad.gov.ae", "title": "SCAD Abu Dhabi Statistics", "date": "2024-02"},
        "confidence": "verified"
      }
    ]
  }
}
```

**Bad Output Example (What to Avoid):**
```json
{
  "factors": {
    "political": [
      {
        "factor": "Government stability",
        "description": "The UAE has a stable government.",
        "impact": "opportunity",
        "implication": "This is good for business.",
        "evidence": null,
        "confidence": "inferred"
      }
    ]
  }
}
```
Problems: Generic factor not specific to sneaker retail. No citation. Implication doesn't mention business name. No actionable insight.

---

### 8.2 Porter's Five Forces

#### Purpose
Analyze the competitive dynamics within the industry. Understand who has power and how intense competition is.

#### Input Specification
```typescript
interface PortersInput {
  positioning: PositioningOutput;     // Business and industry definition
  pestleOutput: PESTLEOutput;         // REQUIRED - macro context affects forces
  researchFindings?: ResearchFindings;
}
```

#### Reasoning Steps
1. **Define the industry boundary**: Not "retail" but "premium sneaker retail in UAE"

2. **For each force, incorporate PESTLE context**:
   - How do PESTLE factors affect this force?
   - E.g., PESTLE legal factors → entry barriers

3. **THREAT OF NEW ENTRANTS**: Barriers to entry, capital requirements, regulations
4. **SUPPLIER POWER**: Who are suppliers? How concentrated? Switching costs?
5. **BUYER POWER**: Price sensitivity, alternatives, switching costs
6. **THREAT OF SUBSTITUTES**: What else solves the problem? Price-performance?
7. **COMPETITIVE RIVALRY**: Who are competitors? How many? Differentiation?

8. **Name specific entities**: Competitors, suppliers, substitutes by name
9. **Synthesize**: Overall industry attractiveness assessment

#### Output Specification
```typescript
interface PortersOutput {
  industryDefinition: string;

  forces: {
    threatOfNewEntrants: ForceAnalysis;
    supplierPower: ForceAnalysis;
    buyerPower: ForceAnalysis;
    threatOfSubstitutes: ForceAnalysis;
    competitiveRivalry: ForceAnalysis;
  };

  overallAttractiveness: {
    score: number;  // 1-10
    assessment: 'attractive' | 'moderate' | 'unattractive';
    rationale: string;
  };

  strategicImplications: string[];

  pestleConnections: {
    pestleFactor: string;
    affectedForce: string;
    howItAffects: string;
  }[];

  competitorsIdentified: string[];
  suppliersIdentified: string[];
  substitutesIdentified: string[];
}

interface ForceAnalysis {
  force: string;
  score: number;  // 1-10
  level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  drivers: string[];
  evidence: string[];
  pestleReferences: string[];  // Which PESTLE factors inform this
  strategicResponse: string;
}
```

#### Quality Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| PESTLE integration | ≥1 reference per force | Count pestleReferences |
| Named competitors | ≥3 competitors | Count unique names |
| Named suppliers | ≥2 suppliers | Count unique names |
| Quantification | ≥50% drivers have data | Regex for numbers |

#### Quality Rubric (1-10 Scale)

| Score | PESTLE Integration | Competitor Specificity | Strategic Response Quality |
|-------|-------------------|------------------------|---------------------------|
| **9-10** | Every force explicitly cites 2+ PESTLE factors. Transformation logic explained ("PESTLE Legal L-2 creates entry barrier because...") | Names 5+ competitors with specific strengths/weaknesses. Market share data where available. | Each force has specific, actionable response. "To counter high supplier power, establish relationships with 3 alternative distributors" |
| **7-8** | Most forces reference PESTLE. Connection clear but not always explicit. | Names 3-4 competitors. General characterization of competitive landscape. | Strategic responses present but somewhat generic. "Differentiate to reduce rivalry" |
| **5-6** | Some PESTLE references but forces analyzed mostly independently. | 1-2 competitors named. Generic "there are several competitors" | Forces rated but responses vague. "Monitor this force" |
| **3-4** | No explicit PESTLE connection. Forces analyzed in isolation. | No specific competitors. "Competition exists in this market" | No strategic responses. Just force ratings. |
| **1-2** | Generic Five Forces not connected to prior analysis or specific market. | No competitor analysis. Textbook definitions only. | No actionable content. |

#### Failure Modes

| Failure | Symptom | Prevention |
|---------|---------|------------|
| Ignoring PESTLE | No PESTLE references | Validate pestleReferences count |
| Generic analysis | No specific competitors | Require competitor names |
| No strategic response | Forces rated but no "what to do" | Require strategicResponse field |

---

### 8.3 SWOT Analysis

#### Purpose
Synthesize external analysis (PESTLE, Porter's) with internal assessment to define strategic position.

#### Input Specification
```typescript
interface SWOTInput {
  positioning: PositioningOutput;
  pestleOutput: PESTLEOutput;    // REQUIRED
  portersOutput: PortersOutput;   // REQUIRED

  // For existing business only:
  internalData?: {
    capabilities: string[];
    resources: string[];
    performance: string[];
  };
}
```

#### Reasoning Steps (Critical: Different for New Venture vs Existing Business)

**For NEW VENTURE:**

1. **Derive OPPORTUNITIES** from external analysis:
   - Which PESTLE factors create favorable conditions?
   - Which Porter's forces are weak (easier to compete)?
   - What market gaps exist?

2. **Derive THREATS** from external analysis:
   - Which PESTLE factors create unfavorable conditions?
   - Which Porter's forces are strong (harder to compete)?
   - What competitive responses are likely?

3. **Assess STRENGTHS** using 5 Pre-Operational Categories:

| Category | What to Assess | Example |
|----------|----------------|---------|
| **Value Proposition Fit** | How well does the proposed offering match identified market opportunities? | "Authentication service addresses collector trust gap identified in Porter's" |
| **Founder/Team Capabilities** | What relevant expertise, networks, or resources do founders bring? | "Founder has 10 years Nike regional distribution experience" |
| **Business Model Advantages** | What structural advantages does the proposed model have? | "Direct-to-collector model eliminates middleman margins" |
| **Timing/First-Mover** | Is there a window of opportunity being captured? | "Entering before major brands establish direct UAE presence" |
| **Resource Positioning** | What key resources or partnerships are already secured? | "Exclusive supplier relationship with StockX for authentication" |

4. **Assess WEAKNESSES** using 5 Pre-Operational Categories:

| Category | What to Assess | Example |
|----------|----------------|---------|
| **Capability Gaps** | What critical capabilities are missing to execute? | "No local retail real estate experience" |
| **Resource Constraints** | What resource limitations exist? | "Limited capital for inventory ($200K vs recommended $500K)" |
| **Unvalidated Assumptions** | What critical assumptions haven't been tested? | "Assumption: collectors will pay 20% premium for authentication" |
| **Market Access Barriers** | What obstacles exist to reaching customers? | "No existing customer database or community presence in UAE" |
| **Competitive Disadvantages** | Where are we structurally weaker than alternatives? | "Established retailers have brand recognition and supplier terms" |

**For EXISTING BUSINESS:**

3-4. Assess S and W from actual operations data:
   - Financial performance, market share, customer satisfaction
   - Operational efficiency, capability assessments
   - Resource utilization, partnership strength

5. **PRIORITIZE** within each quadrant (not all equal)
6. **CROSS-REFERENCE** for strategic options: SO, WO, ST, WT

#### Output Specification
```typescript
interface SWOTOutput {
  ventureType: 'new_venture' | 'existing_business';

  strengths: SWOTItem[];    // Max 5, prioritized
  weaknesses: SWOTItem[];   // Max 5, prioritized
  opportunities: SWOTItem[]; // Max 5, prioritized
  threats: SWOTItem[];       // Max 5, prioritized

  strategies: {
    SO: Strategy[];  // Use Strengths to capture Opportunities
    ST: Strategy[];  // Use Strengths to mitigate Threats
    WO: Strategy[];  // Address Weaknesses to capture Opportunities
    WT: Strategy[];  // Address Weaknesses to avoid Threats
  };

  priorityActions: string[];  // Top 3-5 immediate actions

  pestleFactorsUsed: string[];
  porterForcesUsed: string[];
}

interface SWOTItem {
  item: string;
  description: string;
  priority: number;  // 1 = highest
  priorityRationale: string;
  sourceAnalysis: 'pestle' | 'porters' | 'internal' | 'combined';
  sourceReference?: string;  // e.g., "PESTLE Economic E-3"
}

interface Strategy {
  strategy: string;
  leverages: string[];  // Which S or W items
  addresses: string[];  // Which O or T items
  actions: string[];
  timeframe: string;
}
```

#### Quality Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| O/T traceability | 100% cite PESTLE/Porter's | Check sourceReference |
| Prioritization | All items have priority rank | Check priority field |
| Strategy coverage | ≥1 per quadrant combo | Count SO/ST/WO/WT |

#### Quality Rubric (1-10 Scale)

| Score | O/T Traceability | S/W Realism (New Venture) | Strategy Actionability |
|-------|-----------------|---------------------------|------------------------|
| **9-10** | Every O/T cites specific PESTLE factor or Porter force by ID. "O-1 derives from PESTLE E-3 (market growth) and Porter low rivalry" | S/W limited to 5 categories: value prop fit, founder capabilities, model advantages, timing, resources. All grounded in positioning. | Each SO/ST/WO/WT strategy has 2-3 specific actions with timeframes. "In Q1, validate authentication demand through 50 customer interviews" |
| **7-8** | Most O/T reference prior analysis. Some generic but most traceable. | S/W mostly grounded in positioning and founder context. Some aspirational items. | Strategies present with actions but timeframes vague. "Conduct customer research" |
| **5-6** | Some O/T traceable. Mix of derived and generic. | S/W includes some operational capabilities new venture doesn't have. "Strong customer service" | Quadrant strategies exist but vague. "Leverage strengths to capture opportunities" |
| **3-4** | O/T appear disconnected from prior analysis. Generic market statements. | Fantasy S/W listing capabilities business doesn't have. "Experienced team" with no team. | Generic strategies. "SO: Grow the business" |
| **1-2** | Generic SWOT not connected to this business or prior analysis. | S/W completely invented. No basis in positioning or reality. | No strategies. Just four lists. |

#### Failure Modes

| Failure | Symptom | Prevention |
|---------|---------|------------|
| S/W fantasy | New venture lists capabilities it doesn't have | For new ventures, S/W must use 5 pre-operational categories only |
| Disconnected O/T | O/T don't trace to prior analysis | Require sourceReference citing PESTLE/Porter's factor ID |
| No prioritization | Laundry list | Limit to 5 per quadrant, require priority rank 1-5 |
| Missing strategies | SWOT items without SO/ST/WO/WT | Each quadrant item must link to at least one strategy |

---

### 8.4 Five Whys Analysis

#### Purpose
Surface hidden assumptions about why this business would succeed. Challenge conventional thinking. Identify root causes of potential failure.

#### Input Specification
```typescript
interface FiveWhysInput {
  positioning: PositioningOutput;
  initialStatement?: string;  // User's belief about success
}
```

#### Reasoning Steps

**Framing for New Ventures:** The "problem" being root-caused is: "Why would this business succeed?"

1. **Start with success hypothesis**: "This business will succeed because [X]"
2. **First Why**: Why is [X] true? What's the underlying assumption?
3. **Second Why**: Why is that assumption valid?
4. **Third Why**: Go deeper.
5. **Fourth Why**: Continue drilling.
6. **Fifth Why**: Reach the root assumption.
7. **Identify parallel chains**: Explore multiple paths from different first-whys.
8. **Surface assumptions**: At each level, what are we ASSUMING?
9. **Categorize**: Validated, Testable, Untestable
10. **Identify risks**: Which assumptions, if wrong, would kill the business?

#### Output Specification
```typescript
interface FiveWhysOutput {
  successHypothesis: string;

  whyChains: WhyChain[];

  assumptions: Assumption[];

  rootCauses: RootCause[];

  criticalAssumptions: Assumption[];  // If wrong, business fails

  validationPriorities: {
    assumption: string;
    testMethod: string;
    priority: 'critical' | 'important' | 'nice-to-have';
  }[];
}

interface WhyChain {
  startingPoint: string;
  whys: {
    level: number;
    question: string;
    answer: string;
    assumptionSurfaced: string;
  }[];
  rootCause: string;
}

interface Assumption {
  assumption: string;
  category: 'validated' | 'testable' | 'untestable';
  evidence?: string;
  riskIfWrong: 'high' | 'medium' | 'low';
}
```

#### Current Bad Output Example

```
CURRENT (BAD):
- Why 1: "Why do you want to open a sneaker store?" → "To make money"
- Why 2: "Why make money?" → "To be financially independent"
- Why 3: "Why be financially independent?" → "To have freedom"
...
Goes off into generic life philosophy, loses business focus.

SHOULD BE:
- Why 1: "Why would collectors buy from your store instead of alternatives?"
  → "Because we offer authenticated limited editions they can't easily find"
- Why 2: "Why can't they easily find authenticated limited editions?"
  → "Because the UAE market lacks trusted authentication and curation"
- Why 3: "Why does the UAE market lack this?"
  → "Because existing retailers focus on volume, not collector needs"
...
Surfaces real market insight: unmet need for authentication/curation.
```

---

### 8.5 Business Model Canvas (BMC)

#### Purpose
Design/analyze the business model across 9 interconnected blocks. Ensure internal consistency.

#### Input Specification
```typescript
interface BMCInput {
  positioning: PositioningOutput;
  fiveWhysOutput: FiveWhysOutput;  // REQUIRED - assumptions constrain BMC
  researchFindings?: ResearchFindings;
}
```

#### Reasoning Steps

**Order matters — some blocks inform others:**

1. **CUSTOMER SEGMENTS**: Who are we creating value for?
   - Constrained by: Five Whys assumptions about customers

2. **VALUE PROPOSITIONS**: What value do we deliver?
   - Must address: Five Whys critical assumptions

3. **CHANNELS**: How do we reach customers?
4. **CUSTOMER RELATIONSHIPS**: How do we maintain relationships?
5. **REVENUE STREAMS**: How do we make money?
   - Must validate: Five Whys assumptions about willingness to pay

6. **KEY RESOURCES**: What do we need to deliver value?
7. **KEY ACTIVITIES**: What must we do well?
8. **KEY PARTNERSHIPS**: Who helps us?
9. **COST STRUCTURE**: What are the major costs?

10. **CHECK CONSISTENCY**: Do blocks align?

#### Output Specification
```typescript
interface BMCOutput {
  canvas: {
    customerSegments: CanvasBlock;
    valuePropositions: CanvasBlock;
    channels: CanvasBlock;
    customerRelationships: CanvasBlock;
    revenueStreams: CanvasBlock;
    keyResources: CanvasBlock;
    keyActivities: CanvasBlock;
    keyPartnerships: CanvasBlock;
    costStructure: CanvasBlock;
  };

  fiveWhysConnections: {
    assumption: string;
    affectedBlock: string;
    howAddressed: string;
  }[];

  consistencyChecks: {
    issue: string;
    blocks: string[];
    severity: 'critical' | 'warning' | 'note';
    recommendation: string;
  }[];
}

interface CanvasBlock {
  block: string;
  items: {
    item: string;
    rationale: string;
    confidence: 'high' | 'medium' | 'low';
  }[];
  keyQuestions: string[];  // What needs validation
}
```

---

## Part 9: Bridge Specifications

Bridges are NOT just data transformation. They're cognitive — interpreting one module's output for the next module's consumption.

### PESTLE → Porter's Bridge

```typescript
const PESTLEtoPortersBridge = {
  from: 'PESTLE',
  to: 'Porters',

  transformations: [
    {
      source: 'factors.legal',
      target: 'forces.threatOfNewEntrants.drivers',
      interpretation: 'Regulatory requirements become barriers to entry. High regulation = lower threat of new entrants.'
    },
    {
      source: 'factors.economic',
      target: 'forces.buyerPower.drivers',
      interpretation: 'Economic conditions affect buyer price sensitivity. Economic downturn = higher buyer power.'
    },
    {
      source: 'factors.technological',
      target: 'forces.threatOfSubstitutes.drivers',
      interpretation: 'Technology trends enable substitutes. Rapid tech change = higher substitute threat.'
    },
    {
      source: 'factors.political',
      target: 'forces.supplierPower.drivers',
      interpretation: 'Trade policies affect supplier landscape. Import restrictions = higher supplier power.'
    }
  ],

  enrichment: 'PESTLE context shapes how Porter forces manifest in THIS specific market',

  validation: 'PESTLE output must have at least one factor per category'
};
```

#### Detailed PESTLE → Porter's Mapping Table

| PESTLE Factor | Porter's Force | Transformation Logic | Example |
|---------------|----------------|---------------------|---------|
| **Legal:** Licensing requirements | **Entry Barriers** | Complex licensing → higher barriers | "UAE retail license requires local sponsor" → Entry barrier for foreign competitors |
| **Legal:** Import regulations | **Supplier Power** | Import restrictions → fewer supplier options → higher power | "Footwear import requires product registration" → Limits supplier alternatives |
| **Economic:** Consumer spending trends | **Buyer Power** | High spending → lower price sensitivity → lower buyer power | "Abu Dhabi high disposable income" → Collectors less price-sensitive |
| **Economic:** Market size/growth | **Rivalry Intensity** | Fast growth → room for all → lower rivalry | "UAE sneaker market +8% YoY" → Expanding pie reduces direct competition |
| **Technological:** E-commerce adoption | **Substitutes** | High digital adoption → online alternatives viable | "UAE 99% internet penetration" → Online resale platforms are strong substitutes |
| **Technological:** Authentication tech | **Entry Barriers** | Authentication tech available → lowers barrier for authenticator entrants | "AI authentication services emerging" → Easier for new authenticators to enter |
| **Social:** Sneaker culture trends | **Buyer Power** | Strong sneaker culture → high demand → lower buyer power | "Sneakerhead community growing in UAE" → Passionate buyers less price-sensitive |
| **Political:** Trade agreements | **Supplier Power** | Favorable trade → more supplier access → lower supplier power | "UAE-US free trade" → Easy access to US sneaker suppliers |
| **Environmental:** Sustainability regulations | **Entry Barriers** | Strict sustainability → compliance cost → higher barriers | "UAE sustainability targets" → New entrants must meet standards |
```

### Porter's → SWOT Bridge

```typescript
const PortersToSWOTBridge = {
  from: 'Porters',
  to: 'SWOT',

  transformations: [
    {
      source: 'forces[level=low]',
      target: 'opportunities',
      interpretation: 'Weak competitive forces = opportunities. Low buyer power means easier pricing.'
    },
    {
      source: 'forces[level=high]',
      target: 'threats',
      interpretation: 'Strong competitive forces = threats. High rivalry means margin pressure.'
    },
    {
      source: 'competitorInsights.weaknesses',
      target: 'opportunities',
      interpretation: 'Competitor weaknesses = market opportunities to exploit.'
    },
    {
      source: 'competitorInsights.strengths',
      target: 'threats',
      interpretation: 'Competitor strengths = threats to our position.'
    }
  ],

  enrichment: 'Industry structure defines the competitive opportunity set. Porter forces become O/T foundation.'
};
```

#### Detailed Porter's → SWOT Mapping Table

| Porter's Force | Level | SWOT Mapping | Logic | Example |
|----------------|-------|--------------|-------|---------|
| **Threat of New Entrants** | Low | **Opportunity** | High barriers protect market position | "Complex licensing" → O: "Protected market position once established" |
| **Threat of New Entrants** | High | **Threat** | Easy entry means more future competitors | "Low capital requirements" → T: "Vulnerable to new competitors" |
| **Supplier Power** | Low | **Opportunity** | Negotiate better terms, multiple options | "Many sneaker distributors" → O: "Favorable supplier negotiations possible" |
| **Supplier Power** | High | **Threat** | Limited options, price pressure | "Nike controls distribution" → T: "Dependent on limited supplier relationships" |
| **Buyer Power** | Low | **Opportunity** | Pricing flexibility, brand premium | "Passionate collectors" → O: "Premium pricing sustainable" |
| **Buyer Power** | High | **Threat** | Price pressure, commoditization | "Price-sensitive market" → T: "Margin compression from buyer demands" |
| **Substitutes** | Low | **Opportunity** | Limited alternatives strengthen value prop | "No local authenticators" → O: "Unique value proposition in market" |
| **Substitutes** | High | **Threat** | Customer alternatives erode position | "Online resale platforms" → T: "StockX/GOAT compete for same customers" |
| **Rivalry** | Low | **Opportunity** | Market share available, less price war | "No premium sneaker specialist in Abu Dhabi" → O: "First-mover advantage" |
| **Rivalry** | High | **Threat** | Price wars, marketing costs, churn | "Multiple sneaker retailers present" → T: "Competitive pressure on margins" |

#### Combined PESTLE + Porter's → SWOT Flow

```
PESTLE Opportunity Factor + Low Porter's Force = STRONG OPPORTUNITY
Example: "Growing sneaker culture" (S-Social) + "Low rivalry" (P-Rivalry)
         → "First-mover opportunity in underserved premium segment"

PESTLE Threat Factor + High Porter's Force = STRONG THREAT
Example: "Import regulations" (L-Legal) + "High supplier power" (P-Supplier)
         → "Supply chain vulnerability with limited alternatives"

PESTLE Opportunity + High Porter's Force = CONDITIONAL OPPORTUNITY
Example: "High disposable income" (E-Economic) + "High rivalry" (P-Rivalry)
         → "Market potential exists but competition limits capture"
```
```

### Five Whys → BMC Bridge

```typescript
const FiveWhysToBMCBridge = {
  from: 'FiveWhys',
  to: 'BMC',

  transformations: [
    {
      source: 'criticalAssumptions',
      target: 'canvas[all].constraints',
      interpretation: 'Critical assumptions become constraints on BMC blocks. If assumption is "customers will pay premium", Revenue Streams must address this.'
    },
    {
      source: 'rootCauses',
      target: 'canvas.valuePropositions.mustAddress',
      interpretation: 'Root causes of potential failure must be addressed by value proposition design.'
    },
    {
      source: 'validationPriorities',
      target: 'canvas[all].keyQuestions',
      interpretation: 'Assumptions needing validation become key questions in relevant BMC blocks.'
    }
  ],

  enrichment: 'BMC is not designed in a vacuum but constrained by validated and unvalidated assumptions.'
};
```

### SWOT → Decisions Bridge

```typescript
const SWOTToDecisionsBridge = {
  from: 'SWOT',
  to: 'Decisions',

  transformations: [
    {
      source: 'strategies.SO',
      target: 'decisions[category=opportunity]',
      interpretation: 'SO strategies become opportunity-capture decisions'
    },
    {
      source: 'strategies.WT',
      target: 'decisions[category=risk]',
      interpretation: 'WT strategies become risk-mitigation decisions'
    },
    {
      source: 'priorityActions',
      target: 'decisions[priority=high]',
      interpretation: 'Priority actions become high-priority decision items'
    }
  ],

  decisionGeneration: {
    rules: [
      'Major weakness + major opportunity = Decision on whether to address weakness or pivot',
      'Major threat + limited strength = Decision on defensive strategy',
      'Multiple strategic paths = Decision on which path to prioritize'
    ]
  }
};
```

### Decisions → EPM Bridge

```typescript
const DecisionsToEPMBridge = {
  from: 'Decisions',
  to: 'EPM',

  transformations: [
    {
      source: 'selectedOptions',
      target: 'workstreamSeeds',
      interpretation: 'Each selected decision option implies workstreams to implement it'
    },
    {
      source: 'decisionTradeoffs',
      target: 'riskSeeds',
      interpretation: 'Decision tradeoffs become risks to monitor'
    },
    {
      source: 'expectedOutcomes',
      target: 'benefitSeeds',
      interpretation: 'Decision expected outcomes become benefit targets'
    }
  ],

  // CRITICAL: This is currently broken
  currentBug: {
    symptom: 'EPM page shows /strategy-workspace/epm/undefined',
    cause: 'Decisions page does not create EPM program record or pass programId',
    fix: 'After decisions complete, create EPM program, store programId, navigate with ID'
  }
};
```

---

## Part 10: User Decision Points

Not everything should be automated. At certain points, the user must make decisions.

### Decision Points in Market Entry Journey

| After | Decision | Options | Can Skip? |
|-------|----------|---------|-----------|
| **Positioning** | "Is this the scope you want?" | Confirm, Refine, Start over | No |
| **PESTLE** | "Given macro factors, proceed?" | Proceed, Flag concerns, Pivot | Yes (default: Proceed) |
| **Porter's** | "Is entry viable?" | Proceed, Differentiate, Abandon | Yes (default: Proceed) |
| **SWOT** | "Which strategies to pursue?" | [Generated options] | No |
| **Decisions** | "Make choices for each card" | [Options per decision] | No |

### Decision Points in BMI Journey

| After | Decision | Options | Can Skip? |
|-------|----------|---------|-----------|
| **Positioning** | "Is this the scope you want?" | Confirm, Refine, Start over | No |
| **Five Whys** | "Are these the right assumptions?" | Confirm, Add more, Challenge | No |
| **BMC** | "Is this model viable?" | Proceed, Refine blocks, Pivot | No |
| **Decisions** | "Make choices for each card" | [Options per decision] | No |

---

## Part 11: Validation Layer Design

### Input Validation (Before Module Runs)

```typescript
async function executeModule(moduleId: string, context: JourneyContext): Promise<ModuleResult> {
  // 1. Get module spec
  const spec = getModuleSpec(moduleId);

  // 2. Validate inputs - FAIL LOUDLY if missing
  const inputValidation = validateInputs(moduleId, context);
  if (!inputValidation.valid) {
    throw new ModuleInputError(moduleId, inputValidation.errors);
  }

  // 3. Execute module
  const result = await moduleExecutor.execute(moduleId, context);

  // 4. Validate outputs - WARN but continue
  const outputValidation = validateOutputs(moduleId, result);
  if (!outputValidation.valid) {
    logger.warn(`Module ${moduleId} quality issues`, outputValidation.errors);
  }

  // 5. Run bridge to next module
  const enrichedContext = await bridge.transform(moduleId, result, context);

  return { result, enrichedContext, validation: outputValidation };
}
```

### Startup Validation

```typescript
// Run at server startup
function validateJourneyIntegrity(): void {
  const availableJourneys = getAvailableJourneys();

  for (const journey of availableJourneys) {
    for (const framework of journey.frameworks) {
      if (!frameworkRegistry.has(framework)) {
        throw new Error(
          `STARTUP ERROR: Journey "${journey.name}" requires "${framework}" but no executor registered`
        );
      }
    }
  }

  console.log(`[Journey Validation] ✓ All ${availableJourneys.length} journeys have executors`);
}
```

---

## Part 12: Testing Strategy

### Unit Tests Per Module

```typescript
describe('PESTLE Module', () => {
  it('requires positioning input', async () => {
    await expect(pestleModule.execute({}))
      .rejects.toThrow('Missing required input: positioning');
  });

  it('produces factors for all 6 categories', async () => {
    const result = await pestleModule.execute(mockPositioning);
    expect(result.factors.political.length).toBeGreaterThan(0);
    expect(result.factors.economic.length).toBeGreaterThan(0);
    // ... all 6
  });

  it('mentions business name in every factor implication', async () => {
    const result = await pestleModule.execute(mockPositioning);
    for (const category of Object.values(result.factors)) {
      for (const factor of category) {
        expect(factor.implication).toContain(mockPositioning.businessConcept.name);
      }
    }
  });
});
```

### Bridge Tests

```typescript
describe('PESTLE → Porter\'s Bridge', () => {
  it('transforms legal factors to entry barriers', () => {
    const pestle = mockPESTLEWithHighRegulation();
    const result = pestleToPortersBridge.transform(pestle);
    expect(result.entryBarrierContext).toContain('regulatory');
  });

  it('requires PESTLE to have all categories', () => {
    const incompletePestle = { factors: { political: [] } };
    expect(() => pestleToPortersBridge.transform(incompletePestle))
      .toThrow('PESTLE output incomplete');
  });
});
```

### Journey Integration Tests

```typescript
describe('Market Entry Journey', () => {
  it('executes PESTLE → Porter\'s → SWOT with data flow', async () => {
    const journey = await startJourney('market_entry', mockInput);

    // PESTLE completed
    expect(journey.insights.pestleOutput).toBeDefined();

    // Porter's has PESTLE references
    expect(journey.insights.portersOutput.pestleConnections.length).toBeGreaterThan(0);

    // SWOT traces to both
    expect(journey.insights.swotOutput.pestleFactorsUsed.length).toBeGreaterThan(0);
    expect(journey.insights.swotOutput.porterForcesUsed.length).toBeGreaterThan(0);
  });
});
```

### E2E Tests

```typescript
describe('Complete Market Entry Flow', () => {
  it('produces actionable EPM from business idea', async () => {
    const understanding = await createStrategicUnderstanding({
      userInput: 'Premium basketball sneaker store targeting collectors in Abu Dhabi'
    });

    const session = await startJourney('market_entry', understanding.id);
    await executeJourney(session.id);
    await submitDecisions(session.id, testDecisions);

    const epm = await getEPM(session.id);

    expect(epm.programId).toBeDefined();  // Not undefined!
    expect(epm.workstreams.length).toBeGreaterThan(0);
    expect(epm.workstreams[0].name).not.toContain('Unnamed');
    expect(epm.workstreams[0].description).toContain('Abu Dhabi');
  });
});
```

---

## Part 13: Deliverables Checklist

### For Each Framework Module

- [ ] Purpose statement
- [ ] Input TypeScript interface
- [ ] Reasoning steps (numbered cognition)
- [ ] Output TypeScript interface
- [ ] Research integration spec
- [ ] Quality criteria (measurable)
- [ ] Failure modes with prevention
- [ ] New venture vs existing business handling
- [ ] System prompt
- [ ] User prompt template
- [ ] Test cases with expected outputs

### For Each Bridge

- [ ] Source → Target mapping
- [ ] Transformation rules with interpretations
- [ ] Enrichment logic
- [ ] Validation checks
- [ ] Test cases

### For Each Journey

- [ ] Module sequence with rationale
- [ ] Data flow diagram
- [ ] User decision points
- [ ] Integration test cases

### For Platform

- [ ] Validation layer implementation
- [ ] Startup validation
- [ ] Error contract specification
- [ ] Quality metrics dashboard

---

## Part 14: Open Questions and Resolved Questions

### Resolved Questions

1. ~~**Framework Sequence**: Is PESTLE → Porter's → SWOT optimal?~~
   **RESOLVED**: Yes, this sequence follows zoom-in logic:
   - PESTLE: Macro environment (widest lens)
   - Porter's: Industry dynamics (medium lens) - informed by PESTLE context
   - SWOT: Business position (narrowest lens) - synthesizes both
   Alternative sequences may suit different journey types but Market Entry benefits from outside-in analysis.

2. ~~**New Venture SWOT**: How should S and W be assessed for a business that doesn't exist?~~
   **RESOLVED**: Use 5 pre-operational categories for Strengths:
   - Value Proposition Fit
   - Founder/Team Capabilities
   - Business Model Advantages
   - Timing/First-Mover
   - Resource Positioning

   And 5 categories for Weaknesses:
   - Capability Gaps
   - Resource Constraints
   - Unvalidated Assumptions
   - Market Access Barriers
   - Competitive Disadvantages

   See SWOT Reasoning Steps section for full specification.

### Open Questions (Need Further Research)

3. **Research Integration**: How much external research is enough? How do we prevent research from overwhelming analysis?
   - Hypothesis: 3-5 sources per PESTLE category, 5-10 competitor profiles for Porter's
   - Need to test: Does more research = better output or just longer prompts?

4. **Decision Generation**: How do we identify the RIGHT decisions from analysis? Not too few, not too many.
   - Hypothesis: 3-7 decisions is optimal. Fewer = incomplete, More = overwhelming
   - Decision should map to: Major S × O combination, Major W requiring action, Major T requiring response

5. **EPM Mapping**: How exactly do strategic decisions translate to workstreams, resources, timelines?
   - Need: Formal mapping rules from decision types to workstream patterns
   - Current state: EPM generator doesn't receive programId from Decisions page (bug documented)

6. **Iteration**: How does system support iteration? If user refines after SWOT, how to re-run upstream?
   - Options: Invalidate downstream (re-run from point of change), Incremental update, Branch versions
   - Need to design: Version control for journey state

7. **Confidence Calibration**: How to represent uncertainty without undermining user confidence?
   - Approach: Use "confidence" field on claims, aggregate to module-level confidence
   - Display: Show confidence with actionable interpretation ("Research more before committing" vs "Proceed with high confidence")

---

## Summary

This specification defines what we need to build a Journey Builder that actually thinks, not just executes prompts.

**The key insight:** Each module's output shapes the cognition of the next module. Bridges aren't data pipes — they're interpreters. The journey is a cognitive pipeline, not a workflow.

**What makes this different from current implementation:**
- Positioning gates everything (no more generic analysis)
- Inputs and outputs are contracted (no more `any`)
- Reasoning steps are explicit (not hidden in prompts)
- Bridges interpret, not just transform
- User decisions gate progression
- Quality is validated, not assumed
- Research grounds analysis in reality

**Success looks like:** A developer can implement any module by following its spec. Journeys produce consistent, valuable, actionable results. New journeys can be composed reliably.

Let's build this right.
