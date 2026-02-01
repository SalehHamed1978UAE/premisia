# Premisia: Journey Builder Implementation Instructions

**Date:** February 1, 2026
**Current State:** 2 journeys live (Market Entry, Business Model Innovation)
**Target:** 6 journeys live (add Crisis Recovery, Competitive Strategy, Digital Transformation, Growth Strategy)
**Principle:** REUSE EXISTING PATTERNS - follow Market Entry architecture exactly

---

## PART 1: THE PATTERN GUARD

### The 5-Question Go/No-Go Checklist (MANDATORY)

**Before implementing ANY journey component, you MUST answer these 5 questions:**

| # | Question | Required Answer |
|---|----------|-----------------|
| 1 | Does this follow the same pattern as Market Entry journey? | **YES** |
| 2 | Am I reusing existing framework executors where available? | **YES** |
| 3 | Does the bridge transform data in the same format as existing bridges? | **YES** |
| 4 | Does the result page follow the same component structure as existing pages? | **YES** |
| 5 | Am I modifying existing working code unnecessarily? | **NO** |

**If ANY answer is wrong → STOP. Rethink the approach.**

---

### The Architecture Pattern (Market Entry Reference)

```
User Input
    ↓
/strategic-consultant/input (InputPage.tsx)
    ↓
Framework 1 Executor (e.g., pestle-executor.ts)
    ↓
/strategic-consultant/[framework]-results/:sessionId/:versionNumber
    ↓
Bridge (e.g., pestle-to-porters-bridge.ts)
    ↓
Framework 2 Executor
    ↓
/strategic-consultant/[framework]-results/:sessionId/:versionNumber
    ↓
Bridge
    ↓
Framework 3 Executor
    ↓
/strategic-consultant/[framework]-results/:sessionId/:versionNumber
    ↓
/strategy-workspace/decisions/:sessionId/:versionNumber
    ↓
/strategy-workspace/prioritization/:sessionId/:versionNumber
    ↓
EPM Generation
```

---

### Existing Components (DO NOT RECREATE)

#### Framework Executors (server/journey/executors/)
| Executor | File | Status |
|----------|------|--------|
| PESTLE | `pestle-executor.ts` | ✅ EXISTS |
| Porter's Five Forces | `porters-executor.ts` | ✅ EXISTS |
| SWOT | `swot-executor.ts` | ✅ EXISTS |
| BMC | `bmc-executor.ts` | ✅ EXISTS |
| Five Whys | `five-whys-executor.ts` | ✅ EXISTS |
| Ansoff Matrix | `ansoff-executor.ts` | ✅ EXISTS |
| Blue Ocean | `blue-ocean-executor.ts` | ✅ EXISTS |
| Value Chain | `value-chain-executor.ts` | ✅ EXISTS |
| VRIO | `vrio-executor.ts` | ✅ EXISTS |

#### Bridges (server/journey/bridges/)
| Bridge | File | Status |
|--------|------|--------|
| PESTLE → Porter's | `pestle-to-porters-bridge.ts` | ✅ EXISTS |
| Porter's → SWOT | `porters-to-swot-bridge.ts` | ✅ EXISTS |
| Five Whys → BMC | `whys-to-bmc-bridge.ts` | ✅ EXISTS |

#### Result Pages (client/src/pages/strategic-consultant/)
| Page | File | Status |
|------|------|--------|
| PESTLE Results | `PestleResultsPage.tsx` | ✅ EXISTS |
| Porter's Results | `PortersResultsPage.tsx` | ✅ EXISTS |
| SWOT Results | `SwotResultsPage.tsx` | ✅ EXISTS |
| BMC Results | `BmcResultsPage.tsx` | ✅ EXISTS |
| Five Whys Results | `WhysTreePage.tsx` | ✅ EXISTS |
| Ansoff Results | `AnsoffResultsPage.tsx` | ⚠️ CHECK |
| Blue Ocean Results | `BlueOceanResultsPage.tsx` | ⚠️ CHECK |

---

## PART 2: TEST PROTOCOL

### Before and After Every Journey Implementation

1. **Start the dev server:**
```bash
npm run dev
```

2. **Test the journey flow manually:**
   - Navigate to `/strategic-consultant`
   - Select the journey being implemented
   - Complete each framework step
   - Verify data flows to decisions page
   - Verify EPM generation works

3. **Check server logs for errors:**
```bash
# Watch for [Journey], [Framework], [Bridge] log entries
```

4. **Verify database records:**
```sql
-- Check journey session was created
SELECT * FROM journey_sessions WHERE journey_type = '[JOURNEY_TYPE]' ORDER BY created_at DESC LIMIT 5;

-- Check framework insights were stored
SELECT * FROM framework_insights WHERE session_id = '[SESSION_ID]';

-- Check EPM was generated
SELECT * FROM epm_programs WHERE session_id = '[SESSION_ID]';
```

### Smoke Test for Each Journey

Before marking a journey complete, test these scenarios:

1. **Happy Path:** Complete full journey with valid input → EPM generated
2. **Navigation:** Can go back and forward between framework steps
3. **Data Persistence:** Refresh page mid-journey → data preserved
4. **Decisions Flow:** Framework insights appear on decisions page
5. **Export:** Can export EPM to Excel/PDF

---

## PART 3: IMPLEMENTATION TASKS

### Task 0: Verify Existing Infrastructure

**Why:** Confirm all required components exist before building journeys.

**Steps:**

1. Verify all framework executors exist:
```bash
ls -la server/journey/executors/
```
Expected: pestle, porters, swot, bmc, five-whys, ansoff, blue-ocean executors

2. Verify existing bridges:
```bash
ls -la server/journey/bridges/
```
Expected: pestle-to-porters, porters-to-swot, whys-to-bmc bridges

3. Verify result pages exist:
```bash
ls -la client/src/pages/strategic-consultant/
```
Expected: PestleResultsPage, PortersResultsPage, SwotResultsPage, BmcResultsPage, WhysTreePage

4. Check journey registry:
```typescript
// server/journey/journey-registry.ts
// Confirm all 6 journeys are defined (even if available: false)
```

**Go/No-Go Check:**
- All executors exist? YES → Continue
- All required bridges exist? YES → Continue (or create missing ones)
- All result pages exist? YES → Continue (or note which need creation)

---

### Task 1: Crisis Recovery Journey

**Frameworks:** Five Whys → SWOT → BMC
**Outcome:** Users can analyze crisis situations by identifying root causes, assessing strengths/weaknesses, and rebuilding business model.

**What Exists:**
- ✅ Five Whys Executor
- ✅ SWOT Executor
- ✅ BMC Executor
- ✅ Five Whys Results Page (WhysTreePage.tsx)
- ✅ SWOT Results Page
- ✅ BMC Results Page
- ⚠️ NEED: Five Whys → SWOT Bridge
- ⚠️ NEED: SWOT → BMC Bridge

**Steps:**

1. **Create Five Whys → SWOT Bridge:**

File: `server/journey/bridges/whys-to-swot-bridge.ts`

```typescript
/**
 * Five Whys to SWOT Bridge
 * Transforms root cause analysis into SWOT inputs
 *
 * Mapping:
 * - Root causes → Weaknesses (internal problems identified)
 * - Counter-measures → Strengths (if already addressing issues)
 * - External root causes → Threats
 * - Opportunities from fixing root causes → Opportunities
 */

import type { FiveWhysOutput } from '../executors/five-whys-executor';
import type { SwotInput } from '../executors/swot-executor';

export function transformWhysToSwot(whysOutput: FiveWhysOutput, context: any): SwotInput {
  // Extract root causes as weaknesses
  const weaknesses = whysOutput.rootCauses?.map(rc => ({
    name: rc.cause,
    description: `Root cause identified: ${rc.explanation}`,
    severity: rc.depth >= 4 ? 'high' : rc.depth >= 2 ? 'medium' : 'low',
  })) || [];

  // Extract counter-measures as potential strengths
  const strengths = whysOutput.counterMeasures?.map(cm => ({
    name: cm.action,
    description: `Proposed solution: ${cm.rationale}`,
  })) || [];

  // Context for SWOT analysis
  return {
    businessContext: context.businessContext,
    previousAnalysis: {
      framework: 'five_whys',
      rootCauses: whysOutput.rootCauses,
      counterMeasures: whysOutput.counterMeasures,
    },
    suggestedWeaknesses: weaknesses,
    suggestedStrengths: strengths,
  };
}
```

2. **Create SWOT → BMC Bridge:**

File: `server/journey/bridges/swot-to-bmc-bridge.ts`

```typescript
/**
 * SWOT to BMC Bridge
 * Transforms SWOT analysis into BMC canvas inputs
 *
 * Mapping:
 * - Strengths → Key Resources, Key Activities
 * - Weaknesses → Gaps in Value Proposition
 * - Opportunities → Customer Segments, Channels, Revenue Streams
 * - Threats → Cost considerations, Risk factors
 */

import type { SwotOutput } from '../executors/swot-executor';
import type { BmcInput } from '../executors/bmc-executor';

export function transformSwotToBmc(swotOutput: SwotOutput, context: any): BmcInput {
  return {
    businessContext: context.businessContext,
    previousAnalysis: {
      framework: 'swot',
      strengths: swotOutput.strengths,
      weaknesses: swotOutput.weaknesses,
      opportunities: swotOutput.opportunities,
      threats: swotOutput.threats,
    },
    // Let BMC executor use SWOT to inform canvas
    strategicInsights: {
      leverageStrengths: swotOutput.strengths?.slice(0, 3),
      addressWeaknesses: swotOutput.weaknesses?.slice(0, 3),
      pursueOpportunities: swotOutput.opportunities?.slice(0, 3),
      mitigateThreats: swotOutput.threats?.slice(0, 3),
    },
  };
}
```

3. **Register bridges in index:**

File: `server/journey/bridges/index.ts`
```typescript
export { transformWhysToSwot } from './whys-to-swot-bridge';
export { transformSwotToBmc } from './swot-to-bmc-bridge';
```

4. **Update Journey Registry:**

File: `server/journey/journey-registry.ts`
```typescript
crisis_recovery: {
  type: 'crisis_recovery',
  name: 'Crisis Recovery',
  description: 'Diagnose root causes of crisis, assess internal strengths/weaknesses, and rebuild business model',
  frameworks: ['five_whys', 'swot', 'bmc'],
  pageSequence: [
    '/strategic-consultant/input',
    '/strategic-consultant/whys-tree/:understandingId',
    '/strategic-consultant/swot-results/:sessionId/:versionNumber',
    '/strategic-consultant/research/:sessionId',
    '/strategy-workspace/decisions/:sessionId/:versionNumber',
    '/strategy-workspace/prioritization/:sessionId/:versionNumber',
  ],
  estimatedDuration: '14-20 minutes',
  available: true,  // ← CHANGE FROM false TO true
  summaryBuilder: 'fiveWhysSwot',
  dependencies: [
    { from: 'five_whys', to: 'swot' },
    { from: 'swot', to: 'bmc' },
  ],
},
```

5. **Update Journey Orchestrator to handle bridges:**

File: `server/journey/journey-orchestrator.ts`

Add bridge handling for crisis_recovery journey (follow pattern of market_entry).

**Go/No-Go Check:**
| Question | Answer |
|----------|--------|
| Reusing existing Five Whys, SWOT, BMC executors? | YES ✓ |
| Bridge follows same pattern as pestle-to-porters? | YES ✓ |
| Page sequence follows Market Entry pattern? | YES ✓ |
| Only creating new bridges, not modifying executors? | YES ✓ |

**Validation:**
1. Start journey from `/strategic-consultant`
2. Select "Crisis Recovery"
3. Complete Five Whys analysis
4. Verify SWOT page receives root causes as suggested weaknesses
5. Complete SWOT analysis
6. Verify BMC page receives SWOT insights
7. Complete BMC and proceed to decisions
8. Generate EPM
9. Export and verify all data flows through

**SQL Check:**
```sql
SELECT journey_type, status, current_step_index
FROM journey_sessions
WHERE journey_type = 'crisis_recovery'
ORDER BY created_at DESC LIMIT 5;
```

**Expected:** Journey completes end-to-end with EPM generation.

---

### Task 2: Competitive Strategy Journey

**Frameworks:** Porter's → BMC → Blue Ocean
**Outcome:** Users analyze competitive forces, design business model, then find uncontested market space.

**What Exists:**
- ✅ Porter's Executor
- ✅ BMC Executor
- ✅ Blue Ocean Executor
- ✅ Porter's Results Page
- ✅ BMC Results Page
- ⚠️ CHECK: Blue Ocean Results Page
- ⚠️ NEED: Porter's → BMC Bridge
- ⚠️ NEED: BMC → Blue Ocean Bridge

**Steps:**

1. **Verify Blue Ocean Results Page exists:**
```bash
ls -la client/src/pages/strategic-consultant/ | grep -i blue
```
If missing, create following the pattern of SwotResultsPage.tsx

2. **Create Porter's → BMC Bridge:**

File: `server/journey/bridges/porters-to-bmc-bridge.ts`

```typescript
/**
 * Porter's Five Forces to BMC Bridge
 *
 * Mapping:
 * - Competitive Rivalry → Value Proposition differentiation needs
 * - Supplier Power → Key Partners, Cost Structure
 * - Buyer Power → Customer Relationships, Channels
 * - Threat of Substitutes → Value Proposition uniqueness
 * - Threat of New Entrants → Key Resources (barriers)
 */

import type { PortersOutput } from '../executors/porters-executor';
import type { BmcInput } from '../executors/bmc-executor';

export function transformPortersToBmc(portersOutput: PortersOutput, context: any): BmcInput {
  return {
    businessContext: context.businessContext,
    previousAnalysis: {
      framework: 'porters',
      forces: portersOutput.forces,
      overallAssessment: portersOutput.overallAssessment,
    },
    competitiveInsights: {
      rivalry: portersOutput.forces?.competitiveRivalry,
      supplierPower: portersOutput.forces?.supplierPower,
      buyerPower: portersOutput.forces?.buyerPower,
      substitutes: portersOutput.forces?.threatOfSubstitutes,
      newEntrants: portersOutput.forces?.threatOfNewEntrants,
    },
  };
}
```

3. **Create BMC → Blue Ocean Bridge:**

File: `server/journey/bridges/bmc-to-blueocean-bridge.ts`

```typescript
/**
 * BMC to Blue Ocean Bridge
 *
 * Mapping:
 * - Value Proposition → Current offering to analyze
 * - Customer Segments → Target markets for value innovation
 * - Key Activities → Factors to Eliminate/Reduce/Raise/Create
 * - Cost Structure → Eliminate/Reduce candidates
 * - Revenue Streams → Raise/Create candidates
 */

import type { BmcOutput } from '../executors/bmc-executor';
import type { BlueOceanInput } from '../executors/blue-ocean-executor';

export function transformBmcToBlueOcean(bmcOutput: BmcOutput, context: any): BlueOceanInput {
  return {
    businessContext: context.businessContext,
    currentBusinessModel: {
      valueProposition: bmcOutput.canvas?.valuePropositions,
      customerSegments: bmcOutput.canvas?.customerSegments,
      keyActivities: bmcOutput.canvas?.keyActivities,
      costStructure: bmcOutput.canvas?.costStructure,
      revenueStreams: bmcOutput.canvas?.revenueStreams,
    },
    previousAnalysis: {
      framework: 'bmc',
      canvas: bmcOutput.canvas,
    },
  };
}
```

4. **Create Blue Ocean Results Page (if missing):**

File: `client/src/pages/strategic-consultant/BlueOceanResultsPage.tsx`

Follow the pattern of SwotResultsPage.tsx:
- Display ERRC Grid (Eliminate, Reduce, Raise, Create)
- Show Strategy Canvas comparison
- Show Value Innovation recommendations
- Navigation to next step

5. **Update Journey Registry:**

```typescript
competitive_strategy: {
  type: 'competitive_strategy',
  name: 'Competitive Strategy',
  description: 'Understand competitive forces, design business model, and find uncontested market space',
  frameworks: ['porters', 'bmc', 'blue_ocean'],
  pageSequence: [
    '/strategic-consultant/input',
    '/strategic-consultant/porters-results/:sessionId/:versionNumber',
    '/strategic-consultant/research/:sessionId',
    '/strategic-consultant/blue-ocean-results/:sessionId/:versionNumber',
    '/strategy-workspace/decisions/:sessionId/:versionNumber',
    '/strategy-workspace/prioritization/:sessionId/:versionNumber',
  ],
  estimatedDuration: '15-22 minutes',
  available: true,  // ← CHANGE FROM false TO true
  summaryBuilder: 'portersBmc',
  dependencies: [
    { from: 'porters', to: 'bmc' },
    { from: 'bmc', to: 'blue_ocean' },
  ],
},
```

**Go/No-Go Check:**
| Question | Answer |
|----------|--------|
| Reusing existing Porter's, BMC, Blue Ocean executors? | YES ✓ |
| Bridges follow existing patterns? | YES ✓ |
| Blue Ocean page follows existing page patterns? | YES ✓ |
| Not modifying executor internals? | YES ✓ |

**Validation:**
1. Start "Competitive Strategy" journey
2. Complete Porter's Five Forces
3. Verify BMC receives competitive insights
4. Complete BMC
5. Verify Blue Ocean receives business model context
6. Complete Blue Ocean ERRC analysis
7. Proceed to decisions and EPM

---

### Task 3: Digital Transformation Journey

**Frameworks:** PESTLE → BMC → Ansoff
**Outcome:** Users analyze macro trends, redesign business model, then plan growth/transformation paths.

**What Exists:**
- ✅ PESTLE Executor
- ✅ BMC Executor
- ✅ Ansoff Executor
- ✅ PESTLE Results Page
- ✅ BMC Results Page
- ⚠️ CHECK: Ansoff Results Page
- ⚠️ NEED: PESTLE → BMC Bridge
- ⚠️ NEED: BMC → Ansoff Bridge

**Steps:**

1. **Create PESTLE → BMC Bridge:**

File: `server/journey/bridges/pestle-to-bmc-bridge.ts`

```typescript
/**
 * PESTLE to BMC Bridge
 *
 * Mapping:
 * - Political/Legal → Regulatory constraints on business model
 * - Economic → Revenue/Cost considerations
 * - Social → Customer Segment insights
 * - Technological → Key Resources, Key Activities
 * - Environmental → Sustainability in Value Proposition
 */

export function transformPestleToBmc(pestleOutput: any, context: any): any {
  return {
    businessContext: context.businessContext,
    previousAnalysis: {
      framework: 'pestle',
      factors: pestleOutput.factors,
    },
    macroEnvironment: {
      political: pestleOutput.factors?.political,
      economic: pestleOutput.factors?.economic,
      social: pestleOutput.factors?.social,
      technological: pestleOutput.factors?.technological,
      legal: pestleOutput.factors?.legal,
      environmental: pestleOutput.factors?.environmental,
    },
  };
}
```

2. **Create BMC → Ansoff Bridge:**

File: `server/journey/bridges/bmc-to-ansoff-bridge.ts`

```typescript
/**
 * BMC to Ansoff Bridge
 *
 * Mapping:
 * - Current Customer Segments → Market Penetration base
 * - Value Propositions → Product Development base
 * - New segment opportunities → Market Development
 * - New value propositions → Diversification options
 */

export function transformBmcToAnsoff(bmcOutput: any, context: any): any {
  return {
    businessContext: context.businessContext,
    currentBusinessModel: {
      products: bmcOutput.canvas?.valuePropositions,
      markets: bmcOutput.canvas?.customerSegments,
      channels: bmcOutput.canvas?.channels,
    },
    previousAnalysis: {
      framework: 'bmc',
      canvas: bmcOutput.canvas,
    },
  };
}
```

3. **Create/Verify Ansoff Results Page:**

File: `client/src/pages/strategic-consultant/AnsoffResultsPage.tsx`

Display:
- 2x2 Ansoff Matrix (Market Penetration, Product Development, Market Development, Diversification)
- Recommended strategies per quadrant
- Risk assessment for each option
- Navigation to next step

4. **Update Journey Registry:**

```typescript
digital_transformation: {
  type: 'digital_transformation',
  name: 'Digital Transformation',
  description: 'Navigate digital disruption by analyzing trends, redesigning operating models, and planning growth',
  frameworks: ['pestle', 'bmc', 'ansoff'],
  pageSequence: [
    '/strategic-consultant/input',
    '/strategic-consultant/pestle-results/:sessionId/:versionNumber',
    '/strategic-consultant/research/:sessionId',
    '/strategic-consultant/ansoff-results/:sessionId/:versionNumber',
    '/strategy-workspace/decisions/:sessionId/:versionNumber',
    '/strategy-workspace/prioritization/:sessionId/:versionNumber',
  ],
  estimatedDuration: '18-25 minutes',
  available: true,  // ← CHANGE FROM false TO true
  summaryBuilder: 'pestleBmc',
  dependencies: [
    { from: 'pestle', to: 'bmc' },
    { from: 'bmc', to: 'ansoff' },
  ],
},
```

**Go/No-Go Check:**
| Question | Answer |
|----------|--------|
| Reusing existing PESTLE, BMC, Ansoff executors? | YES ✓ |
| Bridges follow existing patterns? | YES ✓ |
| Ansoff page follows existing page patterns? | YES ✓ |
| Not modifying executor internals? | YES ✓ |

**Validation:**
1. Start "Digital Transformation" journey
2. Complete PESTLE analysis
3. Verify BMC receives macro environment context
4. Complete BMC
5. Verify Ansoff receives current business model
6. Complete Ansoff matrix analysis
7. Proceed to decisions and EPM

---

### Task 4: Growth Strategy Journey

**Frameworks:** PESTLE → Ansoff → BMC
**Outcome:** Users analyze market trends, identify growth paths, then design business model for chosen strategy.

**What Exists:**
- ✅ PESTLE Executor
- ✅ Ansoff Executor
- ✅ BMC Executor
- ✅ All pages from previous tasks
- ⚠️ NEED: PESTLE → Ansoff Bridge
- ⚠️ NEED: Ansoff → BMC Bridge

**Steps:**

1. **Create PESTLE → Ansoff Bridge:**

File: `server/journey/bridges/pestle-to-ansoff-bridge.ts`

```typescript
/**
 * PESTLE to Ansoff Bridge
 *
 * Mapping:
 * - Economic trends → Market development opportunities
 * - Technological trends → Product development opportunities
 * - Social trends → New market segments
 * - Combined factors → Diversification considerations
 */

export function transformPestleToAnsoff(pestleOutput: any, context: any): any {
  return {
    businessContext: context.businessContext,
    previousAnalysis: {
      framework: 'pestle',
      factors: pestleOutput.factors,
    },
    marketTrends: {
      economic: pestleOutput.factors?.economic,
      technological: pestleOutput.factors?.technological,
      social: pestleOutput.factors?.social,
    },
  };
}
```

2. **Create Ansoff → BMC Bridge:**

File: `server/journey/bridges/ansoff-to-bmc-bridge.ts`

```typescript
/**
 * Ansoff to BMC Bridge
 *
 * Mapping:
 * - Chosen growth strategy → Informs entire BMC design
 * - Market Penetration → Focus on existing segments, optimize channels
 * - Product Development → New value propositions
 * - Market Development → New customer segments, new channels
 * - Diversification → New everything
 */

export function transformAnsoffToBmc(ansoffOutput: any, context: any): any {
  return {
    businessContext: context.businessContext,
    previousAnalysis: {
      framework: 'ansoff',
      recommendations: ansoffOutput.recommendations,
      chosenStrategy: ansoffOutput.primaryStrategy,
    },
    growthDirection: {
      strategy: ansoffOutput.primaryStrategy,
      rationale: ansoffOutput.strategyRationale,
      targetMarkets: ansoffOutput.targetMarkets,
      productInnovations: ansoffOutput.productInnovations,
    },
  };
}
```

3. **Update Journey Registry:**

```typescript
growth_strategy: {
  type: 'growth_strategy',
  name: 'Growth Strategy',
  description: 'Explore growth opportunities through market trends, expansion options, and business model optimization',
  frameworks: ['pestle', 'ansoff', 'bmc'],
  pageSequence: [
    '/strategic-consultant/input',
    '/strategic-consultant/pestle-results/:sessionId/:versionNumber',
    '/strategic-consultant/ansoff-results/:sessionId/:versionNumber',
    '/strategic-consultant/research/:sessionId',
    '/strategy-workspace/decisions/:sessionId/:versionNumber',
    '/strategy-workspace/prioritization/:sessionId/:versionNumber',
  ],
  estimatedDuration: '16-23 minutes',
  available: true,  // ← CHANGE FROM false TO true
  summaryBuilder: 'pestleAnsoff',
  dependencies: [
    { from: 'pestle', to: 'ansoff' },
    { from: 'ansoff', to: 'bmc' },
  ],
},
```

**Go/No-Go Check:**
| Question | Answer |
|----------|--------|
| Reusing existing PESTLE, Ansoff, BMC executors? | YES ✓ |
| Bridges follow existing patterns? | YES ✓ |
| Page sequence follows existing patterns? | YES ✓ |
| Not modifying executor internals? | YES ✓ |

**Validation:**
1. Start "Growth Strategy" journey
2. Complete PESTLE analysis
3. Verify Ansoff receives market trends
4. Complete Ansoff matrix
5. Verify BMC receives growth strategy context
6. Complete BMC for chosen growth path
7. Proceed to decisions and EPM

---

## PART 4: DELIVERABLES

### For Each Journey, Report:

```
JOURNEY: [Journey name]
GO/NO-GO CHECKLIST:
  1. Following Market Entry pattern? [YES/NO]
  2. Reusing existing executors? [YES/NO]
  3. Bridges follow existing format? [YES/NO]
  4. Pages follow existing patterns? [YES/NO]
  5. Not modifying working code unnecessarily? [YES/NO]

FILES CREATED:
  - [File path]: [Brief description]

FILES MODIFIED:
  - [File path]: [What was changed]

MANUAL TEST RESULTS:
  - Input page loads? [PASS/FAIL]
  - Framework 1 completes? [PASS/FAIL]
  - Bridge transforms data? [PASS/FAIL]
  - Framework 2 completes? [PASS/FAIL]
  - Bridge transforms data? [PASS/FAIL]
  - Framework 3 completes? [PASS/FAIL]
  - Decisions page shows insights? [PASS/FAIL]
  - EPM generates successfully? [PASS/FAIL]
  - Export works? [PASS/FAIL]

DATABASE VERIFICATION:
  [SQL query and result showing journey sessions created]

JOURNEY STATUS:
  Before: available: false
  After: available: true
```

---

## PART 5: SUCCESS CRITERIA

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Journeys Available | 2 | 6 | Count `available: true` in journey-registry.ts |
| Crisis Recovery | ❌ | ✅ | Complete end-to-end test |
| Competitive Strategy | ❌ | ✅ | Complete end-to-end test |
| Digital Transformation | ❌ | ✅ | Complete end-to-end test |
| Growth Strategy | ❌ | ✅ | Complete end-to-end test |
| All Bridges Created | 3 | 11 | Count files in bridges/ |
| No Regressions | N/A | 0 | Market Entry & BMI still work |

---

## PART 6: WHAT NOT TO DO

1. **DO NOT** modify existing working executors
2. **DO NOT** change the data format of existing bridges
3. **DO NOT** break Market Entry or Business Model Innovation journeys
4. **DO NOT** create duplicate components (check if exists first)
5. **DO NOT** skip the Go/No-Go checklist
6. **DO NOT** mark journey as available before full end-to-end test
7. **DO NOT** hardcode session IDs, user IDs, or test data
8. **DO NOT** skip database verification

---

## PART 7: PRIORITY ORDER

Execute in this order. Complete and verify each journey before starting the next.

| Priority | Journey | Bridges Needed | Expected Effort |
|----------|---------|----------------|-----------------|
| 1 | Crisis Recovery | whys-to-swot, swot-to-bmc | Low (most components exist) |
| 2 | Competitive Strategy | porters-to-bmc, bmc-to-blueocean | Medium (may need Blue Ocean page) |
| 3 | Digital Transformation | pestle-to-bmc, bmc-to-ansoff | Medium (may need Ansoff page) |
| 4 | Growth Strategy | pestle-to-ansoff, ansoff-to-bmc | Low (all components from earlier tasks) |

**Total Bridges to Create:** 8 new bridges
**Total Pages to Create/Verify:** 2 (Blue Ocean, Ansoff)

---

## PART 8: REFERENCE FILES

### Key Files to Study Before Starting

| Purpose | File Path |
|---------|-----------|
| Journey Registry (modify) | `server/journey/journey-registry.ts` |
| Journey Orchestrator (may modify) | `server/journey/journey-orchestrator.ts` |
| Existing Bridge Example | `server/journey/bridges/pestle-to-porters-bridge.ts` |
| Existing Executor Example | `server/journey/executors/pestle-executor.ts` |
| Existing Results Page Example | `client/src/pages/strategic-consultant/PestleResultsPage.tsx` |
| App Routes (add new pages) | `client/src/App.tsx` |
| Shared Types | `shared/journey-types.ts` |

### Database Schema Reference

```sql
-- Journey sessions table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'journey_sessions';

-- Framework insights table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'framework_insights';
```

---

## CONTACT

If unclear whether an approach follows the pattern:
1. Run the 5-question Go/No-Go checklist
2. Compare with Market Entry implementation
3. If still unsure, **ASK before implementing**

The pattern is the law. Consistency over creativity.
