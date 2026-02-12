# REPLIT INSTRUCTIONS – JOURNEY BUILDER PHASE 2 (FEB 2026)

**Date:** February 1, 2026
**Current State:** 2 journeys live (Market Entry, Business Model Innovation)
**Target:** 6 journeys live
**Principle:** REUSE EXISTING PATTERNS - follow Market Entry architecture exactly

---

## MISSION

Finish the remaining strategic journeys (Crisis Recovery, Competitive Strategy, Digital Transformation, Growth Strategy) using the Journey Builder architecture. Each journey must run through the V2 pipeline:

```
Journey Template → Framework Executors → Bridge Contracts → Decisions → Priorities → EPM
```

Deliver production-ready backend + frontend wiring plus validation evidence.

---

## REFERENCES

| Document | Purpose |
|----------|---------|
| `server/journey/journey-registry.ts` | Journey definitions (modify here) |
| `server/journey/journey-orchestrator.ts` | Execution flow |
| `server/journey/bridges/pestle-to-porters-bridge.ts` | Bridge pattern to follow |
| `client/src/pages/strategic-consultant/PestleResultsPage.tsx` | Page pattern to follow |
| Market Entry journey | Reference implementation |

---

## GLOBAL CONSTRAINTS

1. **No feature toggles:** New journeys must be selectable from existing UI immediately.
2. **Reuse executors:** All framework executors exist - do NOT recreate.
3. **Follow bridge pattern:** All bridges must transform data in same format as existing bridges.
4. **Persist correctly:** All insights, decisions, and EPM programs must persist exactly like Market Entry.
5. **Evidence required:** Provide screenshots/logs at each go/no-go gate before proceeding.
6. **Stop on failure:** If any validation fails, STOP, mark "NO GO", fix before moving on.

---

## COMPONENT INVENTORY

### What EXISTS (DO NOT RECREATE)

#### Framework Executors ✅
| Executor | File | Status |
|----------|------|--------|
| PESTLE | `server/journey/executors/pestle-executor.ts` | ✅ Ready |
| Porter's | `server/journey/executors/porters-executor.ts` | ✅ Ready |
| SWOT | `server/journey/executors/swot-executor.ts` | ✅ Ready |
| BMC | `server/journey/executors/bmc-executor.ts` | ✅ Ready |
| Five Whys | `server/journey/executors/five-whys-executor.ts` | ✅ Ready |
| Ansoff | `server/journey/executors/ansoff-executor.ts` | ✅ Ready |
| Blue Ocean | `server/journey/executors/blue-ocean-executor.ts` | ✅ Ready |

#### Existing Bridges ✅
| Bridge | File |
|--------|------|
| PESTLE → Porter's | `server/journey/bridges/pestle-to-porters-bridge.ts` |
| Porter's → SWOT | `server/journey/bridges/porters-to-swot-bridge.ts` |
| Five Whys → BMC | `server/journey/bridges/whys-to-bmc-bridge.ts` |

#### Result Pages ✅
| Page | File |
|------|------|
| PESTLE Results | `PestleResultsPage.tsx` |
| Porter's Results | `PortersResultsPage.tsx` |
| SWOT Results | `SwotResultsPage.tsx` |
| BMC Results | `BmcResultsPage.tsx` / `ResearchPage.tsx` |
| Five Whys Results | `WhysTreePage.tsx` |

### What NEEDS TO BE BUILT

| Journey | Missing Bridges | Missing Pages |
|---------|-----------------|---------------|
| Crisis Recovery | `whys-to-swot`, `swot-to-bmc` | None |
| Competitive Strategy | `porters-to-bmc`, `bmc-to-blueocean` | Blue Ocean (verify) |
| Digital Transformation | `pestle-to-bmc`, `bmc-to-ansoff` | Ansoff (verify) |
| Growth Strategy | `pestle-to-ansoff`, `ansoff-to-bmc` | None (reuses above) |

**Total: 8 new bridges, 0-2 new pages**

---

## GO/NO-GO CHECKLIST (APPLY TO EVERY TASK)

Before implementing ANY component, answer these 5 questions:

| # | Question | Required Answer |
|---|----------|-----------------|
| 1 | Does this follow the same pattern as Market Entry journey? | **YES** |
| 2 | Am I reusing existing framework executors? | **YES** |
| 3 | Does the bridge transform data in the same format as existing bridges? | **YES** |
| 4 | Does the result page follow the same component structure as existing pages? | **YES** |
| 5 | Am I modifying existing working code unnecessarily? | **NO** |

**If ANY answer is wrong → STOP. Rethink the approach.**

---

## PHASE 1: CRISIS RECOVERY JOURNEY

**Framework Chain:** Five Whys → SWOT → BMC
**Estimated Effort:** Low (all components exist, just needs 2 bridges)

### Task 1.1: Create Bridges

**File:** `server/journey/bridges/whys-to-swot-bridge.ts`

```typescript
/**
 * Five Whys to SWOT Bridge
 * Transforms root cause analysis into SWOT inputs
 */

export function transformWhysToSwot(whysOutput: any, context: any): any {
  // Root causes become weaknesses
  const weaknesses = (whysOutput.rootCauses || []).map((rc: any) => ({
    name: rc.cause || rc.title,
    description: `Root cause: ${rc.explanation || rc.description || ''}`,
    severity: rc.depth >= 4 ? 'high' : rc.depth >= 2 ? 'medium' : 'low',
  }));

  // Counter-measures become potential strengths
  const strengths = (whysOutput.counterMeasures || []).map((cm: any) => ({
    name: cm.action || cm.title,
    description: `Proposed solution: ${cm.rationale || cm.description || ''}`,
  }));

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

export default { transformWhysToSwot };
```

**File:** `server/journey/bridges/swot-to-bmc-bridge.ts`

```typescript
/**
 * SWOT to BMC Bridge
 * Transforms SWOT analysis into BMC canvas inputs
 */

export function transformSwotToBmc(swotOutput: any, context: any): any {
  return {
    businessContext: context.businessContext,
    previousAnalysis: {
      framework: 'swot',
      strengths: swotOutput.strengths,
      weaknesses: swotOutput.weaknesses,
      opportunities: swotOutput.opportunities,
      threats: swotOutput.threats,
    },
    strategicInsights: {
      leverageStrengths: (swotOutput.strengths || []).slice(0, 3),
      addressWeaknesses: (swotOutput.weaknesses || []).slice(0, 3),
      pursueOpportunities: (swotOutput.opportunities || []).slice(0, 3),
      mitigateThreats: (swotOutput.threats || []).slice(0, 3),
    },
  };
}

export default { transformSwotToBmc };
```

**Register in:** `server/journey/bridges/index.ts`
```typescript
export { transformWhysToSwot } from './whys-to-swot-bridge';
export { transformSwotToBmc } from './swot-to-bmc-bridge';
```

### Task 1.2: Update Journey Registry

**File:** `server/journey/journey-registry.ts`

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

### Task 1.3: Wire Journey Orchestrator

Ensure `server/journey/journey-orchestrator.ts` handles the crisis_recovery journey type and calls the bridges in sequence.

### Task 1.4: Validation

**Console Logs Check:**
```
[Journey] Starting crisis_recovery journey
[Framework] Executing five_whys...
[Framework] five_whys complete, persisting...
[Bridge] Transforming five_whys → swot
[Framework] Executing swot...
[Framework] swot complete, persisting...
[Bridge] Transforming swot → bmc
[Framework] Executing bmc...
[Framework] bmc complete, persisting...
[Journey] crisis_recovery complete
```

**Database Check:**
```sql
SELECT journey_type, status, current_step_index
FROM journey_sessions
WHERE journey_type = 'crisis_recovery'
ORDER BY created_at DESC LIMIT 5;

SELECT framework_type, session_id
FROM framework_insights
WHERE session_id = '[SESSION_ID]';
```

### Go/No-Go Gate 1

**Provide:**
- [ ] Screenshot of full journey run (input → Five Whys → SWOT → BMC → decisions → EPM)
- [ ] Console log excerpt showing all 3 frameworks executed
- [ ] `framework_insights` table showing 3 rows for session
- [ ] Exported workstreams.csv showing diversified owners

**Status:** ⬜ GO / ⬜ NO GO

**DO NOT proceed to Phase 2 until Phase 1 has GO status.**

---

## PHASE 2: COMPETITIVE STRATEGY JOURNEY

**Framework Chain:** Porter's → BMC → Blue Ocean
**Estimated Effort:** Medium (needs Blue Ocean page verification + 2 bridges)

### Task 2.1: Verify Blue Ocean Page Exists

```bash
ls -la client/src/pages/strategic-consultant/ | grep -i blue
```

If missing, create `BlueOceanResultsPage.tsx` following the pattern of `SwotResultsPage.tsx`:
- Display ERRC Grid (Eliminate, Reduce, Raise, Create)
- Show Strategy Canvas
- Navigation to next step

### Task 2.2: Create Bridges

**File:** `server/journey/bridges/porters-to-bmc-bridge.ts`

```typescript
/**
 * Porter's Five Forces to BMC Bridge
 */

export function transformPortersToBmc(portersOutput: any, context: any): any {
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

export default { transformPortersToBmc };
```

**File:** `server/journey/bridges/bmc-to-blueocean-bridge.ts`

```typescript
/**
 * BMC to Blue Ocean Bridge
 */

export function transformBmcToBlueOcean(bmcOutput: any, context: any): any {
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

export default { transformBmcToBlueOcean };
```

### Task 2.3: Update Journey Registry

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
  available: true,
  summaryBuilder: 'portersBmc',
  dependencies: [
    { from: 'porters', to: 'bmc' },
    { from: 'bmc', to: 'blue_ocean' },
  ],
},
```

### Go/No-Go Gate 2

**Provide:**
- [ ] Screenshot of full Competitive Strategy journey
- [ ] Console logs showing Porter's → BMC → Blue Ocean execution
- [ ] Blue Ocean page screenshot (ERRC grid visible)
- [ ] Exported EPM with decisions

**Status:** ⬜ GO / ⬜ NO GO

---

## PHASE 3: DIGITAL TRANSFORMATION JOURNEY

**Framework Chain:** PESTLE → BMC → Ansoff
**Estimated Effort:** Medium (needs Ansoff page verification + 2 bridges)

### Task 3.1: Verify Ansoff Page Exists

```bash
ls -la client/src/pages/strategic-consultant/ | grep -i ansoff
```

If missing, create `AnsoffResultsPage.tsx`:
- Display 2x2 Ansoff Matrix (Market Penetration, Product Development, Market Development, Diversification)
- Show recommended strategies per quadrant
- Risk assessment
- Navigation to next step

### Task 3.2: Create Bridges

**File:** `server/journey/bridges/pestle-to-bmc-bridge.ts`

```typescript
/**
 * PESTLE to BMC Bridge
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

export default { transformPestleToBmc };
```

**File:** `server/journey/bridges/bmc-to-ansoff-bridge.ts`

```typescript
/**
 * BMC to Ansoff Bridge
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

export default { transformBmcToAnsoff };
```

### Task 3.3: Update Journey Registry

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
  available: true,
  summaryBuilder: 'pestleBmc',
  dependencies: [
    { from: 'pestle', to: 'bmc' },
    { from: 'bmc', to: 'ansoff' },
  ],
},
```

### Go/No-Go Gate 3

**Provide:**
- [ ] Screenshot of full Digital Transformation journey
- [ ] Console logs showing PESTLE → BMC → Ansoff execution
- [ ] Ansoff page screenshot (2x2 matrix visible)
- [ ] Exported EPM

**Status:** ⬜ GO / ⬜ NO GO

---

## PHASE 4: GROWTH STRATEGY JOURNEY

**Framework Chain:** PESTLE → Ansoff → BMC
**Estimated Effort:** Low (reuses bridges from Phase 3)

### Task 4.1: Create Remaining Bridges

**File:** `server/journey/bridges/pestle-to-ansoff-bridge.ts`

```typescript
/**
 * PESTLE to Ansoff Bridge
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

export default { transformPestleToAnsoff };
```

**File:** `server/journey/bridges/ansoff-to-bmc-bridge.ts`

```typescript
/**
 * Ansoff to BMC Bridge
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

export default { transformAnsoffToBmc };
```

### Task 4.2: Update Journey Registry

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
  available: true,
  summaryBuilder: 'pestleAnsoff',
  dependencies: [
    { from: 'pestle', to: 'ansoff' },
    { from: 'ansoff', to: 'bmc' },
  ],
},
```

### Go/No-Go Gate 4

**Provide:**
- [ ] Screenshot of full Growth Strategy journey
- [ ] Console logs showing PESTLE → Ansoff → BMC execution
- [ ] Exported EPM with diversified workstream owners

**Status:** ⬜ GO / ⬜ NO GO

---

## FINAL VALIDATION: ALL JOURNEYS

After all 4 phases complete, run this checklist:

### Regression Test
- [ ] Market Entry still works end-to-end
- [ ] Business Model Innovation still works end-to-end

### New Journey Tests
- [ ] Crisis Recovery: Input → Five Whys → SWOT → BMC → Decisions → EPM
- [ ] Competitive Strategy: Input → Porter's → BMC → Blue Ocean → Decisions → EPM
- [ ] Digital Transformation: Input → PESTLE → BMC → Ansoff → Decisions → EPM
- [ ] Growth Strategy: Input → PESTLE → Ansoff → BMC → Decisions → EPM

### Database Verification
```sql
-- All journey types should have sessions
SELECT journey_type, COUNT(*)
FROM journey_sessions
GROUP BY journey_type;

-- Expected: 6 journey types with at least 1 session each
```

### Export Verification
For each new journey, export EPM and verify:
- [ ] workstreams.csv has diversified owners (not all same role)
- [ ] resources.csv has appropriate team roles
- [ ] benefits.csv has real benefits (not boilerplate)

---

## REPORTING FORMAT

After each phase, post an update:

```
PHASE: [Phase Name]
STATUS: ✅ GO / ❌ NO GO

EVIDENCE:
- Framework logs: [attached/screenshot]
- Decisions persisted: [query result]
- Export ZIP: [path]

FILES CREATED:
- [file path]: [description]

FILES MODIFIED:
- [file path]: [what changed]

BLOCKERS: [None / Description]

SIGN-OFF:
- Go/No-Go checklist passed? [Yes/No]
- Ready for next phase? [Yes/No]
```

---

## SUCCESS CRITERIA

| Metric | Current | Target |
|--------|---------|--------|
| Journeys with `available: true` | 2 | 6 |
| Bridges in `bridges/` folder | 3 | 11 |
| All journeys complete end-to-end | No | Yes |
| No regressions on existing journeys | N/A | Verified |

---

## WHAT NOT TO DO

1. **DO NOT** recreate existing executors - they all exist
2. **DO NOT** modify executor internals - only create bridges
3. **DO NOT** break Market Entry or BMI journeys
4. **DO NOT** skip the Go/No-Go checklist
5. **DO NOT** proceed to next phase without GO status
6. **DO NOT** hardcode session IDs or test data
7. **DO NOT** merge without validation evidence
8. **DO NOT** work on files outside your owned area without an explicit handoff
9. **DO NOT** start work without a task claim in `docs/AGENT_TASKS.md`
8. **DO NOT** introduce helper methods with the same name but different signatures in shared services. Use explicit suffixes like `FromInput` or `FromMap`.

---

## HANDOFF REMINDER

- Execute phases in order: 1 → 2 → 3 → 4
- Complete validation before moving to next phase
- If blocked, STOP and escalate - do not work around
- All bridge code templates are provided above - use them

---

## CONTACT

If unclear on any approach:
1. Check if Market Entry does something similar
2. Run the 5-question Go/No-Go checklist
3. If still unsure, ASK before implementing

**The pattern is the law. Consistency over creativity.**
