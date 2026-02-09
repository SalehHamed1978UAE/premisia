# Migration Plan: Unified Journey Execution

## Current State Summary

### Three Execution Paths (Problem)

| Path | Bridges | Used By | Status |
|------|---------|---------|--------|
| JourneyOrchestrator.executeJourney() | Yes | Background jobs | Good |
| /market-entry-research/stream | Yes (via FrameworkExecutorRegistry) | Market Entry journey | Good |
| /bmc-research/stream | No (uses legacy BMCResearcher) | BMI, Competitive Strategy, Digital Transform, Growth Strategy | **Needs Migration** |

### The Bug We Hit

ResearchPage.tsx has hardcoded logic:
```javascript
// Only knew about 2 journey types, assumed everything else needs Five Whys
const isBMCJourney = journeyType === 'business_model_innovation';
const isMarketEntryJourney = journeyType === 'market_entry';
const requiresFiveWhys = !isBMCJourney && !isMarketEntryJourney; // WRONG
```

This broke: competitive_strategy, digital_transformation, growth_strategy

### Target State

- ALL journeys use the same executor + bridge pattern
- ResearchPage doesn't decide which endpoint to call
- Single SSE endpoint that handles all journey types
- Bridges applied automatically based on journey definition

---

## Migration Phases

### Phase 1: Create Unified Research Stream Endpoint
**Goal:** Single endpoint that routes to correct executor chain based on journey type

**Changes:**
1. Create `/api/strategic-consultant/journey-research/stream/:sessionId`
2. This endpoint:
   - Reads journey type from journeySession
   - Looks up journey definition from registry
   - Determines which frameworks to execute
   - Uses FrameworkExecutorRegistry for ALL frameworks
   - Applies bridges automatically
   - Streams progress via SSE

**Verification:**
- [ ] New endpoint exists and returns 200
- [ ] Can execute Market Entry journey (PESTLE → Porter's → SWOT)
- [ ] Can execute BMI journey (Five Whys → BMC)
- [ ] Bridges are applied (check logs)
- [ ] Results saved to frameworkInsights table

### Phase 2: Migrate BMC Research to Executor Pattern
**Goal:** BMCExecutor replaces legacy BMCResearcher in the unified endpoint

**Changes:**
1. Verify BMCExecutor (`server/journey/executors/bmc-executor.ts`) is complete
2. Ensure it uses BMCAnalyzer properly
3. Add streaming support or handle via unified endpoint
4. Test BMC execution produces same quality output

**Verification:**
- [ ] BMI journey works end-to-end
- [ ] BMC output quality matches legacy
- [ ] Decision generation still works

### Phase 3: Update ResearchPage to Use Unified Endpoint
**Goal:** Remove hardcoded journey type logic from client

**Changes:**
1. ResearchPage calls single endpoint: `/journey-research/stream/:sessionId`
2. Remove all journey-type-specific if/else logic
3. Endpoint handles routing internally

**Verification:**
- [ ] Market Entry journey works (regression)
- [ ] BMI journey works
- [ ] Competitive Strategy (Blue Ocean) works
- [ ] Digital Transformation works
- [ ] Growth Strategy works
- [ ] Crisis Recovery works

### Phase 4: Deprecate Legacy Endpoints
**Goal:** Remove dead code

**Changes:**
1. Add deprecation warnings to old endpoints
2. Monitor for any remaining usage
3. Remove after confirmation

**Verification:**
- [ ] No 500 errors in production
- [ ] All journeys still work
- [ ] No references to old endpoints in client code

### Phase 5: Align CustomJourneyExecutor
**Goal:** Custom journeys use same executor registry

**Changes:**
1. CustomJourneyExecutor should use FrameworkExecutorRegistry instead of direct analyzer calls
2. This ensures consistent behavior between pre-built and custom journeys

**Verification:**
- [ ] Journey Builder still works
- [ ] Custom journey with PESTLE → Porter's → SWOT produces same results as Market Entry
- [ ] Bridges applied correctly

---

## Rollback Plan

Each phase can be rolled back independently:

- Phase 1: Delete new endpoint, no other changes
- Phase 2: New endpoint falls back to legacy BMCResearcher
- Phase 3: Revert ResearchPage to use old endpoint routing
- Phase 4: Re-enable old endpoints
- Phase 5: Revert CustomJourneyExecutor changes

---

## Files to Modify

### Phase 1
- [ ] `server/routes/strategic-consultant-legacy.ts` - Add new unified endpoint

### Phase 2
- [ ] `server/journey/executors/bmc-executor.ts` - Verify/enhance
- [ ] Unified endpoint - Route BMC through executor

### Phase 3
- [ ] `client/src/pages/strategic-consultant/ResearchPage.tsx` - Simplify to single endpoint

### Phase 4
- [ ] `server/routes/strategic-consultant-legacy.ts` - Mark old endpoints deprecated

### Phase 5
- [ ] `server/services/custom-journey-executor.ts` - Use FrameworkExecutorRegistry

---

## Testing Checklist

Before each phase commit:

1. **Market Entry Journey**
   - [ ] Input → PESTLE results page
   - [ ] PESTLE → Porter's results page
   - [ ] Porter's → SWOT results page
   - [ ] SWOT → Decisions page
   - [ ] Decisions → Prioritization
   - [ ] EPM generation works

2. **Business Model Innovation Journey**
   - [ ] Input → Five Whys tree
   - [ ] Five Whys → Research/BMC page
   - [ ] BMC → Decisions page
   - [ ] Decisions → Prioritization
   - [ ] EPM generation works

3. **Competitive Strategy Journey (Blue Ocean)**
   - [ ] Input → Porter's results
   - [ ] Porter's → BMC/Research page
   - [ ] Research → Blue Ocean/Framework Insight page
   - [ ] Blue Ocean → Decisions
   - [ ] EPM generation works

4. **Journey Builder**
   - [ ] Create custom journey
   - [ ] Run with PESTLE → SWOT
   - [ ] Verify bridges applied
   - [ ] Results saved correctly

---

## Current Status

- [x] Bug identified (ResearchPage hardcoded logic)
- [x] Band-aid fix applied (not ideal)
- [ ] Phase 1: Not started
- [ ] Phase 2: Not started
- [ ] Phase 3: Not started
- [ ] Phase 4: Not started
- [ ] Phase 5: Not started

---

## Decision Point

**Before proceeding, confirm:**

1. Do we start with Phase 1 (create unified endpoint)?
2. Or do we need to address the immediate bug differently first?
3. Timeline constraints?
