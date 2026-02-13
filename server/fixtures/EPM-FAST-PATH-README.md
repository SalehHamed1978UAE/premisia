# EPM Fast-Path Testing System

**Purpose:** Bypass Five Whys + BMC and jump directly to EPM synthesis for rapid Sprint 6B iteration.

---

## Overview

The fast-path system allows you to:
1. **Capture** framework insights from a completed journey as a reusable fixture
2. **Load** fixtures and run EPM synthesis with custom constraints in seconds
3. **Iterate** rapidly on EPM synthesis layer without waiting for framework generation

**Time savings:** Full journey (5-10 min) → Fixture reload (5-10 sec) → **~60x faster**

---

## Quick Start

### Step 1: Run FinTech Journey Once (Normal Flow)

1. Start server: `npm run dev`
2. Open UI: `http://localhost:3001`
3. Run **FinTech journey** with:
   - Budget: $1.8M
   - Timeline: 24 months
4. Wait for completion (~5-10 minutes)
5. Copy the **framework insights** from the synthesis (see below for how)

### Step 2: Capture Insights as Fixture

The framework insights aren't currently saved to the database, so you need to manually capture them.

**Temporary workaround:** Add logging to `strategy-workspace.ts` line 732:

```typescript
// TEMPORARY: Log insights for fixture capture
console.log('[EPM Direct] Insights object:', JSON.stringify(insights, null, 2));

const epmProgram = await epmSynthesizer.synthesize(
  insights,
  decisionsWithPriority,
  namingContext,
  ...
);
```

Then:
1. Run FinTech journey
2. Copy the logged insights JSON from console
3. Save insights via API:

```bash
curl -X POST http://localhost:3001/api/epm/fixtures/save-insights \
  -H "Content-Type: application/json" \
  -d '{
    "fixtureName": "fintech-baseline",
    "description": "FinTech journey baseline for Sprint 6B testing",
    "insights": <PASTE_INSIGHTS_JSON_HERE>,
    "defaultConstraints": {
      "budgetRange": { "min": 1500000, "max": 1800000 },
      "timelineRange": { "min": 18, "max": 24 }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "fixturePath": "/path/to/server/fixtures/epm/fintech-baseline.json",
  "message": "Fixture 'fintech-baseline' saved successfully"
}
```

### Step 3: Fast-Path Synthesis

Now you can run EPM synthesis in seconds:

```bash
curl -X POST http://localhost:3001/api/epm/fixtures/load \
  -H "Content-Type: application/json" \
  -d '{
    "fixtureName": "fintech-baseline",
    "overrideConstraints": {
      "budgetRange": { "min": 1500000, "max": 1800000 },
      "timelineRange": { "min": 18, "max": 24 }
    },
    "saveToDatabase": false
  }'
```

**Response:**
```json
{
  "success": true,
  "epmProgram": { ... },
  "metadata": {
    "synthesisMode": "fixture",
    "fixtureName": "fintech-baseline",
    "initiativeType": "fintech",
    "constraints": {
      "budget": { "min": 1500000, "max": 1800000 },
      "timeline": { "min": 18, "max": 24 }
    }
  }
}
```

**Console output will show Sprint 6B invariant checks:**
```
[CapacityEnvelope] Total external cost: $0.36M
[ResourceAllocator] ❌ ENVELOPE VIOLATION: Generated 13 FTEs but envelope allows 8.
[ResourceAllocator] ✅ After scaling: 8 FTEs (target: 8)
═══════════════════════════════════════════════════════════
[SPRINT 6B INVARIANT CHECK]
  ✅ Invariant 1 (FTE):     8 <= 8 = true
  ✅ Invariant 2 (Budget):  $1.57M <= $1.80M = true
  ✅ Invariant 3 (Timeline): 24 = 24 = true
[Overall] ✅ ALL INVARIANTS PASS
═══════════════════════════════════════════════════════════
```

---

## API Endpoints

### 1. Direct Synthesis (No Fixture)

**POST /api/epm/synthesize-direct**

Run EPM synthesis with manually provided insights.

```bash
curl -X POST http://localhost:3001/api/epm/synthesize-direct \
  -H "Content-Type: application/json" \
  -d '{
    "insights": { ... },
    "userContext": {
      "budgetRange": { "min": 1500000, "max": 1800000 },
      "timelineRange": { "min": 18, "max": 24 },
      "initiativeType": "fintech"
    },
    "namingContext": {
      "journeyTitle": "FinTech Platform Launch"
    },
    "saveToDatabase": false
  }'
```

### 2. Save Fixture

**POST /api/epm/fixtures/save-insights**

Save framework insights as a reusable fixture.

```bash
curl -X POST http://localhost:3001/api/epm/fixtures/save-insights \
  -H "Content-Type: application/json" \
  -d '{
    "fixtureName": "fintech-baseline",
    "insights": { ... },
    "description": "FinTech journey baseline",
    "defaultConstraints": {
      "budgetRange": { "min": 1500000, "max": 1800000 },
      "timelineRange": { "min": 18, "max": 24 }
    }
  }'
```

### 3. List Fixtures

**GET /api/epm/fixtures/list**

List all available fixtures.

```bash
curl http://localhost:3001/api/epm/fixtures/list
```

**Response:**
```json
{
  "success": true,
  "fixtures": [
    {
      "name": "fintech-baseline",
      "description": "FinTech journey baseline for Sprint 6B testing",
      "defaultConstraints": {
        "budgetRange": { "min": 1500000, "max": 1800000 },
        "timelineRange": { "min": 18, "max": 24 }
      },
      "createdAt": "2026-02-13T..."
    }
  ]
}
```

### 4. Load Fixture and Synthesize

**POST /api/epm/fixtures/load**

Load a fixture and run EPM synthesis with custom constraints.

```bash
curl -X POST http://localhost:3001/api/epm/fixtures/load \
  -H "Content-Type: application/json" \
  -d '{
    "fixtureName": "fintech-baseline",
    "overrideConstraints": {
      "budgetRange": { "min": 500000, "max": 500000 },
      "timelineRange": { "min": 24, "max": 24 }
    },
    "saveToDatabase": false
  }'
```

---

## Use Cases

### Sprint 6B Testing: FinTech Baseline ($1.8M)

**Expected behavior:**
- External cost: $360K (20% of $1.8M)
- maxAffordableFTEs: 8 (formula)
- Roles generated: 13 → scaled to 8
- totalBudget: ~$1.57M (≤ $1.8M)
- All 3 invariants: ✅ PASS

```bash
curl -X POST http://localhost:3001/api/epm/fixtures/load \
  -H "Content-Type: application/json" \
  -d '{
    "fixtureName": "fintech-baseline",
    "overrideConstraints": {
      "budgetRange": { "min": 1500000, "max": 1800000 },
      "timelineRange": { "min": 18, "max": 24 }
    }
  }'
```

### Sprint 6B Testing: Tiny Budget ($500K)

**Expected behavior:**
- External cost: $100K (20% of $500K)
- maxAffordableFTEs: 1-2 (formula)
- Envelope: `infeasible: true` (< 4 FTE minimum)
- Final budget: EXCEEDS $500K (expected, flagged as infeasible)

```bash
curl -X POST http://localhost:3001/api/epm/fixtures/load \
  -H "Content-Type: application/json" \
  -d '{
    "fixtureName": "fintech-baseline",
    "overrideConstraints": {
      "budgetRange": { "min": 500000, "max": 500000 },
      "timelineRange": { "min": 24, "max": 24 }
    }
  }'
```

### Sprint 6B Testing: Large Budget ($10M)

**Expected behavior:**
- External cost: $2M (20% of $10M)
- maxAffordableFTEs: ~40 (formula)
- No absurd staffing explosion
- totalBudget: ≤ $10M
- All 3 invariants: ✅ PASS

```bash
curl -X POST http://localhost:3001/api/epm/fixtures/load \
  -H "Content-Type: application/json" \
  -d '{
    "fixtureName": "fintech-baseline",
    "overrideConstraints": {
      "budgetRange": { "min": 10000000, "max": 10000000 },
      "timelineRange": { "min": 24, "max": 24 }
    }
  }'
```

---

## Fixture File Structure

Fixtures are stored in `server/fixtures/epm/*.json`:

```json
{
  "name": "fintech-baseline",
  "description": "FinTech journey baseline for Sprint 6B testing",
  "createdAt": "2026-02-13T10:30:00.000Z",
  "insights": {
    "frameworkType": "bmc",
    "frameworkRunId": "abc123",
    "insights": [
      {
        "type": "workstream",
        "content": "User authentication and security implementation",
        "confidence": 0.9,
        "source": "Key Activities"
      },
      ...
    ],
    "references": [],
    "marketContext": {
      "industry": "Financial Services",
      "urgency": "Strategic",
      "budgetRange": "$1.5M-$1.8M",
      "riskTolerance": "Moderate"
    },
    "overallConfidence": 0.85,
    "initiativeType": "fintech"
  },
  "defaultConstraints": {
    "budgetRange": { "min": 1500000, "max": 1800000 },
    "timelineRange": { "min": 18, "max": 24 }
  }
}
```

---

## Workflow: Rapid Sprint 6B Iteration

1. **Capture fixture once:**
   ```bash
   # Run FinTech journey → capture insights → save fixture
   curl -X POST .../api/epm/fixtures/save-insights ...
   ```

2. **Iterate on constraints:**
   ```bash
   # Test $1.8M (baseline)
   curl -X POST .../api/epm/fixtures/load -d '{"fixtureName":"fintech-baseline","overrideConstraints":{"budgetRange":{"max":1800000}}}'

   # Test $500K (infeasibility)
   curl -X POST .../api/epm/fixtures/load -d '{"fixtureName":"fintech-baseline","overrideConstraints":{"budgetRange":{"max":500000}}}'

   # Test $10M (large budget)
   curl -X POST .../api/epm/fixtures/load -d '{"fixtureName":"fintech-baseline","overrideConstraints":{"budgetRange":{"max":10000000}}}'
   ```

3. **Verify invariants in console:**
   ```
   [SPRINT 6B INVARIANT CHECK]
     ✅ Invariant 1 (FTE):     8 <= 8 = true
     ✅ Invariant 2 (Budget):  $1.57M <= $1.80M = true
     ✅ Invariant 3 (Timeline): 24 = 24 = true
   [Overall] ✅ ALL INVARIANTS PASS
   ```

**Time per iteration:** 5-10 seconds (vs 5-10 minutes for full journey)

---

## Future Enhancements

1. **Auto-capture:** Automatically save insights when EPM synthesis completes
2. **Fixture library:** Pre-built fixtures for common scenarios (SaaS, E-commerce, Enterprise)
3. **Web UI:** Visual fixture manager with constraint sliders
4. **Diff tool:** Compare EPM outputs across different constraint configurations

---

## Notes

- Fixtures are saved to `server/fixtures/epm/` (created automatically)
- Fixture names must be lowercase alphanumeric with hyphens only
- Use `saveToDatabase: true` to persist EPM results to strategy_versions table
- All endpoints require authentication (same as existing EPM routes)

---

**Ready for Sprint 6B rapid iteration!**
