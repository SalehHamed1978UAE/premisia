# COMPREHENSIVE AUDIT: Module/Framework Mismatch

**Date:** January 26, 2026
**Severity:** CRITICAL - System is fundamentally broken

---

## Executive Summary

The modularization of the codebase is **half-complete**. There are THREE separate systems that should be synchronized but are not:

1. **Module Manifests** (`server/modules/manifests/`) - 18 modules defined
2. **Framework Registry** (database table `framework_registry`) - 7 entries seeded
3. **Intelligence Implementations** (`server/intelligence/`) - 16+ actual analyzers

These systems are completely out of sync, causing:
- Users can select frameworks that have no executor
- Implemented analyzers aren't available for selection
- Custom journeys generate MOCK DATA instead of real analysis
- Strategic Decisions has no module despite being selectable

---

## ISSUE 1: Framework Registry vs Module Manifests

### Framework Registry Seed Data (7 items)
From `server/journey-builder-seed.ts`:

| frameworkKey | Name | Has Manifest? | Has Implementation? |
|-------------|------|---------------|---------------------|
| `strategic_understanding` | Strategic Understanding | NO | NO |
| `five_whys` | 5 Whys Analysis | YES (`five-whys-analyzer`) | YES |
| `business_model_canvas` | Business Model Canvas | YES (`bmc-analyzer`) | YES |
| `porters_five_forces` | Porter's Five Forces | YES (`porters-analyzer`) | YES |
| `pestle` | PESTLE Analysis | YES (`pestle-analyzer`) | YES |
| `swot` | SWOT Analysis | YES (`swot-analyzer`) | YES |
| `strategic_decisions` | Strategic Decisions | NO | NO (it's a PAGE) |

### Module Manifests (18 items)
From `server/modules/manifests/index.ts`:

| Module ID | Name | In Registry? | Has Implementation? |
|-----------|------|--------------|---------------------|
| `input-processor` | Input Processor | NO | YES |
| `five-whys-analyzer` | Five Whys Analyzer | YES (as `five_whys`) | YES |
| `bmc-analyzer` | BMC Analyzer | YES (as `business_model_canvas`) | YES |
| `porters-analyzer` | Porter's Five Forces | YES (as `porters_five_forces`) | YES |
| `pestle-analyzer` | PESTLE Analyzer | YES (as `pestle`) | YES |
| `swot-analyzer` | SWOT Analyzer | YES (as `swot`) | YES |
| `segment-discovery-analyzer` | Segment Discovery | NO | YES |
| `competitive-positioning-analyzer` | Competitive Positioning | NO | YES |
| `ansoff-analyzer` | Ansoff Matrix | NO | YES |
| `blue-ocean-analyzer` | Blue Ocean Strategy | NO | YES |
| `ocean-strategy-analyzer` | Ocean Strategy | NO | YES |
| `bcg-matrix-analyzer` | BCG Matrix | NO | YES |
| `value-chain-analyzer` | Value Chain | NO | YES |
| `vrio-analyzer` | VRIO Analysis | NO | YES |
| `scenario-planning-analyzer` | Scenario Planning | NO | YES |
| `jobs-to-be-done-analyzer` | Jobs-to-be-Done | NO | YES |
| `okr-generator` | OKR Generator | NO | YES |
| `epm-generator` | EPM Generator | NO | YES |

---

## ISSUE 2: Missing Manifests for User-Selectable Frameworks

### `strategic_understanding` - MISSING MANIFEST
- **In registry:** YES (users can select it)
- **Has manifest:** NO
- **Has implementation:** Partially (handled by InputPage + ClassificationPage)
- **Problem:** CustomJourneyExecutor can't execute it

### `strategic_decisions` - MISSING MANIFEST
- **In registry:** YES (users can select it)
- **Has manifest:** NO
- **Has implementation:** NO - it's a USER PAGE (DecisionPage.tsx)
- **Problem:** This is NOT an AI module. It's where users make selections. The registry incorrectly defines it as a framework.

---

## ISSUE 3: Modules Not Available for Selection

These 13 modules have implementations but aren't in the framework registry, so users CAN'T select them in Journey Builder:

1. `input-processor` (may be intentional - internal use)
2. `segment-discovery-analyzer`
3. `competitive-positioning-analyzer`
4. `ansoff-analyzer`
5. `blue-ocean-analyzer`
6. `ocean-strategy-analyzer`
7. `bcg-matrix-analyzer`
8. `value-chain-analyzer`
9. `vrio-analyzer`
10. `scenario-planning-analyzer`
11. `jobs-to-be-done-analyzer`
12. `okr-generator`
13. `epm-generator` (may be intentional - final step only)

---

## ISSUE 4: Naming Convention Mismatch

The framework registry uses underscores and full names, but manifests use hyphens and abbreviations:

| Registry Key | Manifest ID |
|-------------|-------------|
| `five_whys` | `five-whys-analyzer` |
| `business_model_canvas` | `bmc-analyzer` |
| `porters_five_forces` | `porters-analyzer` |
| `pestle` | `pestle-analyzer` |
| `swot` | `swot-analyzer` |

This means code that looks up modules by registry key WON'T FIND THEM unless there's a mapping layer.

---

## ISSUE 5: CustomJourneyExecutor Returns MOCK DATA

From `server/services/custom-journey-executor.ts` lines 349-359:

```typescript
private async executeImplementedModule(
  module: any,
  inputs: Record<string, any>,
  nodeConfig?: Record<string, any>
): Promise<any> {
  console.log(`[CustomJourneyExecutor] Executing implemented module: ${module.id}`);

  await this.sleep(1500);

  return this.generateMockOutput(module.id, inputs);  // <-- MOCK DATA!
}
```

Even when modules are marked as `status: 'implemented'`, the executor just waits 1.5 seconds and returns mock data. **It never calls the actual analyzers in `/server/intelligence/`.**

---

## ISSUE 6: Module Type Classification Missing

The system doesn't distinguish between:

1. **AI Analysis Modules** - Execute automatically, call AI, return analysis
   - SWOT, BMC, Porter's, PESTLE, Ansoff, etc.

2. **User Input Pages** - Pause execution, redirect user, wait for selection
   - Strategic Decisions (DecisionPage.tsx)
   - Prioritization (PrioritizationPage.tsx)
   - Gap Filler (future)

3. **Internal Processing Modules** - Not user-selectable
   - Input Processor
   - EPM Generator (final step only)

Without this classification, the executor doesn't know when to pause for user input.

---

## ISSUE 7: Results Storage Mismatch

| System | Stores Results In | UI Reads From |
|--------|------------------|---------------|
| JourneyOrchestrator | `frameworkInsights` | `frameworkInsights` - WORKS |
| CustomJourneyExecutor | `customJourneyExecutions.aggregatedOutputs` | `frameworkInsights` - BROKEN |
| Wizard Templates | `user_journeys.stepResults` | `strategy_versions` - BROKEN |

---

## Recommended Fix: Complete Synchronization

### Phase 1: Define Module Types
Add `moduleType` field to manifests:
```typescript
moduleType: 'ai_analysis' | 'user_input' | 'internal'
```

### Phase 2: Create Missing Manifests
1. `strategic-understanding-manifest.ts` (type: `user_input`)
2. `strategic-decisions-manifest.ts` (type: `user_input`)
3. `prioritization-manifest.ts` (type: `user_input`)

### Phase 3: Update Framework Registry Seed
Add all 18 modules to the seed data with correct IDs:
```typescript
const FRAMEWORKS = [
  { frameworkKey: 'swot-analyzer', name: 'SWOT Analysis', ... },
  { frameworkKey: 'ansoff-analyzer', name: 'Ansoff Matrix', ... },
  // ... all 18 modules
];
```

### Phase 4: Fix CustomJourneyExecutor
1. Call actual analyzers instead of generating mock data
2. Detect `user_input` modules and pause execution
3. Save results to `frameworkInsights` table

### Phase 5: Create Module-to-Analyzer Mapping
```typescript
const analyzerMap: Record<string, any> = {
  'swot-analyzer': swotAnalyzer,
  'bmc-analyzer': bmcAnalyzer,
  'porters-analyzer': portersAnalyzer,
  // ... etc
};
```

---

## Files to Modify

1. **`server/modules/manifests/`** - Add 3 missing manifests, add moduleType
2. **`server/journey-builder-seed.ts`** - Add 13 missing frameworks
3. **`server/services/custom-journey-executor.ts`** - Call real analyzers, save to correct tables
4. **`server/modules/registry.ts`** - Add module type handling
5. **`shared/schema.ts`** - May need moduleType enum

---

## Test Cases After Fix

1. Journey Builder shows all 18 modules for selection
2. Custom journey with SWOT produces REAL analysis (not mock)
3. Strategic Decisions pauses and shows DecisionPage
4. Completed frameworks appear in Strategies Hub
5. All existing smoke tests still pass

---

## Appendix: Full Module List

### AI Analysis Modules (should be executable)
1. `five-whys-analyzer`
2. `bmc-analyzer`
3. `porters-analyzer`
4. `pestle-analyzer`
5. `swot-analyzer`
6. `segment-discovery-analyzer`
7. `competitive-positioning-analyzer`
8. `ansoff-analyzer`
9. `blue-ocean-analyzer`
10. `ocean-strategy-analyzer`
11. `bcg-matrix-analyzer`
12. `value-chain-analyzer`
13. `vrio-analyzer`
14. `scenario-planning-analyzer`
15. `jobs-to-be-done-analyzer`
16. `okr-generator`

### User Input Pages (should pause for user)
1. `strategic-understanding` (InputPage + ClassificationPage)
2. `strategic-decisions` (DecisionPage)
3. `prioritization` (PrioritizationPage)

### Internal/Final Modules (not user-selectable)
1. `input-processor`
2. `epm-generator`
