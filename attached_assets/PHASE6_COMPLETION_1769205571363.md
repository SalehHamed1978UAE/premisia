# Phase 6: Stabilization & QA - Completion Instructions

**Date:** January 24, 2026
**Status:** In Progress
**Goal:** Ensure platform stability and catch regressions early

---

## Completed ✅

- [x] 6.1 Marketing Consultant B2C segmentation fix
- [x] 6.2 Marketing Consultant SSE connection stabilization

---

## Task 6.3: Daily Journey Smoke Tests

Create automated smoke tests that verify the core journeys work end-to-end.

### 6.3.1 Create Smoke Test File

**File:** `server/tests/smoke/journey-smoke.test.ts`

```typescript
/**
 * Journey Smoke Tests
 *
 * These tests verify that core journeys complete successfully.
 * Run daily or on deployment to catch regressions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// Or use Jest if that's the test framework

const API_BASE = process.env.TEST_API_URL || 'http://localhost:5000';
const TIMEOUT_MS = 300000; // 5 minutes for long-running journeys

describe('Journey Smoke Tests', () => {

  describe('Strategic Consultant (EPM Generation)', () => {
    let sessionId: string;

    it('should create a strategy session', async () => {
      const response = await fetch(`${API_BASE}/api/strategy-workspace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge: 'Open a premium coffee shop in downtown Dubai',
          journeyType: 'bmc'
        })
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.sessionId).toBeDefined();
      sessionId = data.sessionId;
    }, TIMEOUT_MS);

    it('should complete BMC research', async () => {
      // Poll for completion
      const maxAttempts = 60; // 5 minutes with 5s intervals
      let completed = false;

      for (let i = 0; i < maxAttempts && !completed; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const response = await fetch(`${API_BASE}/api/strategy-workspace/${sessionId}/status`);
        const data = await response.json();

        if (data.status === 'completed' || data.bmcComplete) {
          completed = true;
        } else if (data.status === 'failed') {
          throw new Error(`BMC research failed: ${data.error}`);
        }
      }

      expect(completed).toBe(true);
    }, TIMEOUT_MS);

    it('should generate EPM with valid workstreams', async () => {
      const response = await fetch(`${API_BASE}/api/strategy-workspace/${sessionId}/generate-epm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      // Validate EPM structure
      expect(data.workstreams).toBeDefined();
      expect(Array.isArray(data.workstreams)).toBe(true);
      expect(data.workstreams.length).toBeGreaterThan(0);

      // Validate workstream has proper structure
      const firstWorkstream = data.workstreams[0];
      expect(firstWorkstream.name).toBeDefined();
      expect(firstWorkstream.deliverables).toBeDefined();

      // Validate deliverables are NOT research text
      if (firstWorkstream.deliverables.length > 0) {
        const deliverable = firstWorkstream.deliverables[0];
        expect(deliverable.name.length).toBeLessThan(100); // Not a paragraph
        expect(deliverable.name).not.toMatch(/research reveals|analysis shows/i);
      }

      console.log(`✓ EPM generated with ${data.workstreams.length} workstreams`);
    }, TIMEOUT_MS);
  });

  describe('Marketing Consultant (Segment Discovery)', () => {
    let understandingId: string;
    let discoveryId: string;

    it('should create understanding and classify as B2C', async () => {
      const response = await fetch(`${API_BASE}/api/marketing-consultant/understanding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: 'Premium artisan bakery specializing in sourdough bread and French pastries'
        })
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.offeringType).toBe('physical_product');
      understandingId = data.id;
    });

    it('should confirm classification', async () => {
      const response = await fetch(`${API_BASE}/api/marketing-consultant/classification/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          understandingId,
          offeringType: 'physical_product',
          stage: 'idea_stage',
          gtmConstraint: 'small_team',
          salesMotion: 'self_serve'
        })
      });

      expect(response.ok).toBe(true);
    });

    it('should start segment discovery', async () => {
      const response = await fetch(`${API_BASE}/api/marketing-consultant/start-discovery/${understandingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.discoveryId).toBeDefined();
      discoveryId = data.discoveryId;
    });

    it('should complete discovery with consumer segments', async () => {
      // Poll for completion
      const maxAttempts = 60; // 5 minutes with 5s intervals
      let result = null;

      for (let i = 0; i < maxAttempts && !result; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const response = await fetch(`${API_BASE}/api/marketing-consultant/discovery-status/${discoveryId}`);
        const data = await response.json();

        if (data.status === 'completed') {
          result = data;
        } else if (data.status === 'failed') {
          throw new Error(`Discovery failed: ${data.error}`);
        }
      }

      expect(result).not.toBeNull();
    }, TIMEOUT_MS);

    it('should have B2C consumer segments (not B2B)', async () => {
      const response = await fetch(`${API_BASE}/api/marketing-consultant/discovery/${discoveryId}`);
      const data = await response.json();

      expect(data.synthesis).toBeDefined();
      expect(data.synthesis.beachhead).toBeDefined();

      const beachhead = data.synthesis.beachhead;
      const genes = beachhead.genome?.genes;

      // Check for B2C gene dimensions (not B2B)
      if (genes) {
        // Should have consumer dimensions
        const hasConsumerDimensions =
          genes.demographic_profile ||
          genes.visit_occasion ||
          genes.dining_occasion;

        // Should NOT have B2B dimensions
        const hasB2BDimensions =
          genes.industry_vertical ||
          genes.company_size ||
          genes.decision_maker;

        // For physical_product, expect consumer segments
        expect(hasConsumerDimensions || !hasB2BDimensions).toBe(true);
      }

      // Validation plan should be consumer-focused
      const validationPlan = beachhead.validationPlan || [];
      const hasB2BValidation = validationPlan.some(step =>
        step.toLowerCase().includes('b2b') ||
        step.toLowerCase().includes('procurement') ||
        step.toLowerCase().includes('distributor')
      );

      expect(hasB2BValidation).toBe(false);

      console.log(`✓ Beachhead: ${JSON.stringify(genes).substring(0, 100)}...`);
    });
  });
});
```

### 6.3.2 Create Test Runner Script

**File:** `scripts/run-smoke-tests.sh`

```bash
#!/bin/bash

echo "=== Premisia Journey Smoke Tests ==="
echo "Date: $(date)"
echo ""

# Set test environment
export TEST_API_URL="${TEST_API_URL:-http://localhost:5000}"
export NODE_ENV=test

# Run smoke tests
npx vitest run server/tests/smoke/journey-smoke.test.ts --reporter=verbose

# Capture exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "✅ All smoke tests passed!"
else
  echo ""
  echo "❌ Smoke tests failed with exit code: $EXIT_CODE"
fi

exit $EXIT_CODE
```

### 6.3.3 Add to package.json

```json
{
  "scripts": {
    "test:smoke": "bash scripts/run-smoke-tests.sh",
    "test:smoke:ci": "vitest run server/tests/smoke/ --reporter=json --outputFile=smoke-results.json"
  }
}
```

---

## Task 6.4: Repository & Module Registry Smoke Tests

### 6.4.1 Repository Smoke Tests

**File:** `server/tests/smoke/repository-smoke.test.ts`

```typescript
/**
 * Repository Smoke Tests
 *
 * Verify that repositories can perform basic CRUD operations.
 */

import { describe, it, expect } from 'vitest';
import { container } from '../../services/container';

describe('Repository Smoke Tests', () => {

  describe('EPM Repository', () => {
    it('should be registered in container', () => {
      expect(container.has('epmRepository')).toBe(true);
    });

    it('should list EPM programs without error', async () => {
      const repo = container.resolve('epmRepository');
      const result = await repo.findAll({ limit: 5 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Strategy Repository', () => {
    it('should be registered in container', () => {
      expect(container.has('strategyRepository')).toBe(true);
    });

    it('should list sessions without error', async () => {
      const repo = container.resolve('strategyRepository');
      const result = await repo.findAll({ limit: 5 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Journey Repository', () => {
    it('should be registered in container', () => {
      expect(container.has('journeyRepository')).toBe(true);
    });

    it('should list journeys without error', async () => {
      const repo = container.resolve('journeyRepository');
      const result = await repo.findAll({ limit: 5 });
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
```

### 6.4.2 Module Registry Smoke Tests

**File:** `server/tests/smoke/module-registry-smoke.test.ts`

```typescript
/**
 * Module Registry Smoke Tests
 *
 * Verify module registry is populated and accessible.
 */

import { describe, it, expect } from 'vitest';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Module Registry Smoke Tests', () => {

  it('should list registered modules', async () => {
    const response = await fetch(`${API_BASE}/api/modules`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.modules).toBeDefined();
    expect(Array.isArray(data.modules)).toBe(true);
    expect(data.modules.length).toBeGreaterThan(0);

    console.log(`✓ Found ${data.modules.length} registered modules`);
  });

  it('should have required module properties', async () => {
    const response = await fetch(`${API_BASE}/api/modules`);
    const data = await response.json();

    const firstModule = data.modules[0];
    expect(firstModule.id).toBeDefined();
    expect(firstModule.name).toBeDefined();
    expect(firstModule.type).toBeDefined();

    console.log(`✓ Module structure valid: ${firstModule.name}`);
  });

  it('should list journey configs', async () => {
    const response = await fetch(`${API_BASE}/api/journeys`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.journeys).toBeDefined();
    expect(Array.isArray(data.journeys)).toBe(true);

    console.log(`✓ Found ${data.journeys.length} journey configs`);
  });

  it('should resolve BMC journey', async () => {
    const response = await fetch(`${API_BASE}/api/journeys/bmc`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.id).toBe('bmc');
    expect(data.steps).toBeDefined();

    console.log(`✓ BMC journey resolved with ${data.steps?.length || 0} steps`);
  });
});
```

---

## Task 6.5: Document Known Working Baselines

### 6.5.1 Create Baseline Document

**File:** `docs/WORKING_BASELINES.md`

```markdown
# Working Baselines

**Last Updated:** January 24, 2026

This document records known working states of the platform for regression reference.

---

## Strategic Consultant (EPM Generation)

### Baseline Test Case
- **Input:** "Open a premium coffee shop in downtown Dubai"
- **Journey Type:** BMC

### Expected Behavior
1. BMC research completes in 3-8 minutes
2. 8 research phases execute (market size, competition, channels, etc.)
3. Knowledge graph populated with findings
4. Contradictions detected and flagged

### EPM Generation
1. Workstreams generated with business-specific names
   - Example: "Location Scouting & Lease Negotiation"
   - NOT: "Strategic Initiative 1"
2. Deliverables are actionable items
   - Example: "Signed commercial lease agreement"
   - NOT: "Research reveals Dubai's coffee market..."
3. Timeline has proper phases and dependencies
4. Critical path analysis works

### Console Logs (Expected)
```
[EPM Synthesis] 🚀 Using intelligent planning system...
[WBS Builder Factory] Creating WBS Builder...
[WBS Builder Factory] Registered 2 patterns
[EPM Synthesis] ✓ WBS Builder Completed Successfully!
  Initiative Type: business_launch
  Coherence Score: XX.X%
```

---

## Marketing Consultant (Segment Discovery)

### Baseline Test Case
- **Input:** "Premium artisan bakery specializing in sourdough bread"
- **Offering Type:** Physical Product
- **Stage:** Idea Stage

### Expected Behavior
1. Classification detects: physical_product → B2C mode
2. Context keywords extracted (bakery, sourdough, bread, artisan, etc.)
3. Gene library uses consumer dimensions (visit_occasion, demographic_profile)
4. 90-100 genomes generated and scored
5. Relevance filter removes off-topic segments
6. Beachhead is a CONSUMER segment

### Expected Segments (CORRECT)
- "Young professionals seeking weekend breakfast spots"
- "Food enthusiasts exploring artisan bakeries"
- "Parents buying bread for family meals"
- "Office workers grabbing lunch nearby"

### NOT Expected (B2B Drift - WRONG)
- "Restaurant purchasing managers"
- "Grocery store buyers"
- "Food service distributors"
- "Shisha lounge owners" (unrelated)

### Console Logs (Expected)
```
[SegmentDiscoveryEngine] Context keywords: bakery, sourdough, bread, artisan, premium
[SegmentDiscoveryEngine] Detected business type: local_business
[SegmentDiscoveryEngine] Mode: B2C (Consumer)
[SegmentDiscoveryEngine] Filtered X genomes for low relevance
```

---

## Module Registry

### Expected State
- 6+ modules registered
- 1+ journeys loaded from YAML config
- Resolver falls back to legacy for non-config journeys

### Console Logs (Expected)
```
[Module Registry] Registered 6 modules
[Journey Loader] Loaded 1 journey config
```

---

## SSE Connection Stability

### Expected Behavior
1. Heartbeat sent every 15 seconds
2. Connection survives 3+ minute operations
3. Auto-reconnect on disconnect (up to 3 attempts)
4. Polling fallback if reconnection fails
5. "Check Results" recovery button available

### NOT Expected
- "Incomplete Analysis Data" when backend completed
- Connection drop with no recovery option

---

## Quick Verification Commands

```bash
# Run smoke tests
npm run test:smoke

# Check module registry
curl http://localhost:5000/api/modules | jq '.modules | length'

# Check journey resolver
curl http://localhost:5000/api/journeys/bmc | jq '.id'

# Check EPM generation endpoint
curl -X POST http://localhost:5000/api/strategy-workspace \
  -H "Content-Type: application/json" \
  -d '{"challenge": "Test coffee shop", "journeyType": "bmc"}'
```

---

## Regression Indicators

If any of these occur, investigate immediately:

1. **EPM deliverables contain research text** → WBS Builder failing, check INTELLIGENT_PLANNING_ENABLED
2. **Marketing segments are B2B for physical_product** → B2C mode not triggering, check detectBusinessType()
3. **"0 potential segments"** → Relevance filter too aggressive or pipeline crashing
4. **"Incomplete Analysis Data" on success** → SSE connection issue, check heartbeat
5. **Module registry returns empty** → Module loading failed, check startup logs

---

## Version History

| Date | Change | Verified By |
|------|--------|-------------|
| Jan 24, 2026 | B2C segmentation fix | Smoke tests |
| Jan 24, 2026 | SSE stabilization | Manual test |
| Jan 23, 2026 | Phase 5 module catalog | Startup logs |
```

---

## Summary

### Files to Create

| File | Purpose |
|------|---------|
| `server/tests/smoke/journey-smoke.test.ts` | End-to-end journey tests |
| `server/tests/smoke/repository-smoke.test.ts` | Repository CRUD tests |
| `server/tests/smoke/module-registry-smoke.test.ts` | Module registry tests |
| `scripts/run-smoke-tests.sh` | Test runner script |
| `docs/WORKING_BASELINES.md` | Baseline documentation |

### Package.json Scripts

```json
{
  "scripts": {
    "test:smoke": "bash scripts/run-smoke-tests.sh",
    "test:smoke:ci": "vitest run server/tests/smoke/ --reporter=json"
  }
}
```

### Verification

After implementation:

1. Run `npm run test:smoke` - all tests should pass
2. Review `docs/WORKING_BASELINES.md` - ensure it matches current behavior
3. Commit with message: "Phase 6: Add smoke tests and baseline documentation"

---

## Phase 6 Completion Criteria

- [ ] All smoke tests pass
- [ ] Baseline document created and accurate
- [ ] `npm run test:smoke` works from clean checkout
- [ ] No known regressions in Strategic or Marketing journeys
