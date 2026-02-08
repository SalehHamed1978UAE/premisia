# Critical Issues Still Not Fixed

## 1. ORCHESTRATOR TIMING PROBLEM ❌

**Current broken flow:**
```
1. Five Whys Executor runs → generates "best guess" path
2. Orchestrator bridges to BMC using that WRONG path
3. BMC researches based on WRONG root cause
4. User selects actual path later via finalize
5. Too late - BMC already ran with wrong context!
```

**What should happen:**
```
1. Five Whys generates tree
2. User selects path
3. THEN BMC runs with user-selected context
```

## 2. NO CANONICAL FIVE WHYS ARTIFACT ❌

**Current reality:**
- Tree stored in: `frameworkInsights` (early, never updated)
- Path stored in: `analysisData.five_whys` (later, after user selection)
- Strategic focus stored in: `analysisData.five_whys.strategicFocus` (our fix)
- BUT: No single canonical object with everything

**What we need:**
```javascript
analysisData.five_whys = {
  problem_statement: string,
  tree: { /* FULL tree with chosen path marked */ },
  chosen_path: string[],
  root_cause: string,
  strategic_implications: string[],
  strategicFocus: { /* our addition */ },
  summary: string  // 1-2 sentence synthesis
}
```

## 3. BMC DOESN'T WAIT FOR USER SELECTION ❌

The orchestrator runs all frameworks sequentially without waiting for user input.
This means BMC runs before the user has selected their Five Whys path.

**Solutions:**
- Option A: Make Five Whys executor read finalized path from DB
- Option B: Split journey into phases with user confirmation between
- Option C: Re-run BMC after Five Whys finalization

## 4. STRATEGIC FOCUS NOT IN BRIDGE ⚠️

Our fix adds strategic focus generation, but:
- It happens in finalization (too late for orchestrator)
- Bridge doesn't use it (uses stale executor data)
- BMC only gets it if explicitly passed (not via bridge)

## What Actually Works Now

✅ Strategic focus IS generated from chosen path
✅ BMC CAN use strategic focus if passed directly
✅ Tree/path reconciliation works for exports
✅ Domain contamination is fixed

## What Still Fails

❌ Orchestrator uses executor path not user path
❌ BMC runs before user selects path
❌ No canonical Five Whys artifact
❌ Bridge uses stale data

## The Real Fix Needed

We need to either:
1. Make the journey pause after Five Whys for user selection
2. OR make the executor read the finalized path from storage
3. AND create a true canonical Five Whys artifact

Without fixing the timing issue, Five Whys will always be disconnected from BMC.