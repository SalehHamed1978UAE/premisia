# Phase 7: Journey Library Expansion

**Date:** January 24, 2026
**Prerequisite:** Phase 6 (Stabilization & QA) complete
**Goal:** Expand the journey library with Marketing Consultant and additional framework executors

---

## Architecture Overview

The codebase uses **TypeScript code as configuration**, not YAML files:

| Component | Location | Purpose |
|-----------|----------|---------|
| Journey Registry | `server/journey/journey-registry.ts` | Journey definitions |
| Framework Registry | `server/journey/framework-executor-registry.ts` | Plugin system for executors |
| Framework Registration | `server/journey/register-frameworks.ts` | Startup initialization |
| Journey Orchestrator | `server/journey/journey-orchestrator.ts` | Main resolver |

**Currently Implemented:**
- ✅ Five Whys Executor
- ✅ BMC Executor
- ⏳ Porter's (analyzer exists, no executor)
- ⏳ PESTLE (analyzer exists, no executor)
- ⏳ SWOT (no implementation)
- ⏳ Marketing Consultant (separate system, not integrated)

---

## Task 7.1: Convert Marketing Consultant to Journey Config

The Marketing Consultant currently lives in `server/services/segment-discovery-engine.ts` as a standalone service. Convert it to the journey/executor pattern.

### 7.1.1 Add Journey Type

**File:** `shared/journey-types.ts`

Add to the `JourneyType` union:

```typescript
export type JourneyType =
  | 'business_model_innovation'
  | 'market_entry'
  | 'competitive_strategy'
  | 'digital_transformation'
  | 'crisis_recovery'
  | 'growth_strategy'
  | 'market_segmentation';  // ADD THIS
```

Add to `FrameworkName`:

```typescript
export type FrameworkName =
  | 'five_whys'
  | 'bmc'
  | 'porters'
  | 'pestle'
  | 'swot'
  | 'ansoff'
  | 'blue_ocean'
  | 'segment_discovery';  // ADD THIS
```

### 7.1.2 Create Marketing Consultant Executor

**File:** `server/journey/executors/segment-discovery-executor.ts`

```typescript
import { FrameworkExecutor, FrameworkName, StrategicContext } from '../../shared/journey-types';
import { segmentDiscoveryEngine, DiscoveryContext } from '../../services/segment-discovery-engine';

export interface SegmentDiscoveryResults {
  geneLibrary: any;
  genomes: any[];
  synthesis: {
    beachhead: {
      genome: any;
      rationale: string;
      validationPlan: string[];
    };
    backupSegments: any[];
    neverList: any[];
    strategicInsights: string[];
  };
  metadata: {
    totalGenomes: number;
    topScore: number;
    businessType: string;
    contextKeywords: string[];
  };
}

export class SegmentDiscoveryExecutor implements FrameworkExecutor {
  name: FrameworkName = 'segment_discovery';

  async validate(context: StrategicContext): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    if (!context.challenge || context.challenge.trim().length < 10) {
      errors.push('Challenge/offering description is required (minimum 10 characters)');
    }

    // Check for classification data
    if (!context.marketingContext?.offeringType) {
      errors.push('Offering type classification is required');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async execute(context: StrategicContext): Promise<SegmentDiscoveryResults> {
    console.log('[SegmentDiscoveryExecutor] Starting segment discovery...');

    // Build discovery context from strategic context
    const discoveryContext: DiscoveryContext = {
      offeringDescription: context.challenge,
      offeringType: context.marketingContext?.offeringType || 'physical_product',
      stage: context.marketingContext?.stage || 'idea_stage',
      gtmConstraint: context.marketingContext?.gtmConstraint || 'small_team',
      salesMotion: context.marketingContext?.salesMotion || 'self_serve',
      existingHypothesis: context.marketingContext?.existingHypothesis,
    };

    // Run discovery with progress callback
    const result = await segmentDiscoveryEngine.runDiscovery(
      discoveryContext,
      (step, progress) => {
        console.log(`[SegmentDiscoveryExecutor] ${step}: ${progress}%`);
        // Could emit SSE events here if context has event emitter
        if (context.onProgress) {
          context.onProgress(step, progress);
        }
      }
    );

    console.log('[SegmentDiscoveryExecutor] Discovery complete');
    console.log(`  Beachhead: ${result.synthesis.beachhead.genome.id}`);
    console.log(`  Total genomes: ${result.genomes.length}`);

    return {
      ...result,
      metadata: {
        totalGenomes: result.genomes.length,
        topScore: result.genomes[0]?.fitness.totalScore || 0,
        businessType: (segmentDiscoveryEngine as any).businessType || 'unknown',
        contextKeywords: discoveryContext.contextKeywords || [],
      },
    };
  }
}

export const segmentDiscoveryExecutor = new SegmentDiscoveryExecutor();
```

### 7.1.3 Register the Executor

**File:** `server/journey/register-frameworks.ts`

Add to imports:

```typescript
import { segmentDiscoveryExecutor } from './executors/segment-discovery-executor';
```

Add to registration:

```typescript
export function registerFrameworks(): void {
  // Existing registrations
  frameworkRegistry.register(fiveWhysExecutor);
  frameworkRegistry.register(bmcExecutor);

  // Add Marketing Consultant
  frameworkRegistry.register(segmentDiscoveryExecutor);

  console.log('[Framework Registry] Registered frameworks:', frameworkRegistry.getRegisteredFrameworks());
}
```

### 7.1.4 Add Journey Definition

**File:** `server/journey/journey-registry.ts`

Add to the `JOURNEY_DEFINITIONS` object:

```typescript
export const JOURNEY_DEFINITIONS: Record<JourneyType, JourneyDefinition> = {
  // ... existing definitions ...

  market_segmentation: {
    type: 'market_segmentation',
    name: 'Market Segmentation Discovery',
    description: 'Discover and validate your ideal customer segments using genetic algorithm-inspired exploration',
    frameworks: ['segment_discovery'],
    pageSequence: ['input', 'classification', 'discovery', 'results'],
    estimatedDuration: '3-5 minutes',
    available: true,  // MARK AS AVAILABLE
    summaryBuilder: 'segmentDiscoverySummary',
    defaultReadiness: {
      minReferences: 0,  // No external research needed
      minEntities: 0,
    },
    insightsConfig: {
      requiresFiveWhys: false,
      requiresBmc: false,
    },
    dependencies: [],  // No dependencies on other frameworks
  },
};
```

### 7.1.5 Update Journey Type Checks

**File:** `server/journey/journey-orchestrator.ts`

Ensure `isJourneyAvailable()` returns true for `market_segmentation`:

```typescript
export function isJourneyAvailable(journeyType: JourneyType): boolean {
  const definition = JOURNEY_DEFINITIONS[journeyType];
  return definition?.available === true;
}
```

---

## Task 7.2: Add Manifests for Remaining Analyzers/Generators

### 7.2.1 Create Porter's Five Forces Executor

The analyzer exists at `server/intelligence/porters-analyzer.ts`. Create an executor.

**File:** `server/journey/executors/porters-executor.ts`

```typescript
import { FrameworkExecutor, FrameworkName, StrategicContext } from '../../shared/journey-types';

export interface PortersResults {
  forces: {
    supplierPower: { score: number; analysis: string; factors: string[] };
    buyerPower: { score: number; analysis: string; factors: string[] };
    competitiveRivalry: { score: number; analysis: string; factors: string[] };
    threatOfSubstitutes: { score: number; analysis: string; factors: string[] };
    threatOfNewEntrants: { score: number; analysis: string; factors: string[] };
  };
  overallAssessment: string;
  strategicImplications: string[];
  confidence: number;
}

export class PortersExecutor implements FrameworkExecutor {
  name: FrameworkName = 'porters';

  async validate(context: StrategicContext): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    if (!context.challenge || context.challenge.trim().length < 10) {
      errors.push('Business challenge is required');
    }

    // Porter's works better with industry context
    if (!context.industryContext) {
      console.warn('[PortersExecutor] No industry context provided, will infer from challenge');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(context: StrategicContext): Promise<PortersResults> {
    console.log('[PortersExecutor] Analyzing competitive forces...');

    // TODO: Implement Porter's analysis using LLM
    // For now, return placeholder that can be filled in
    throw new Error('Porter\'s Five Forces executor not yet implemented');
  }
}

export const portersExecutor = new PortersExecutor();
```

### 7.2.2 Create PESTLE Executor

**File:** `server/journey/executors/pestle-executor.ts`

```typescript
import { FrameworkExecutor, FrameworkName, StrategicContext } from '../../shared/journey-types';

export interface PESTLEResults {
  factors: {
    political: { impact: 'high' | 'medium' | 'low'; factors: string[]; implications: string };
    economic: { impact: 'high' | 'medium' | 'low'; factors: string[]; implications: string };
    social: { impact: 'high' | 'medium' | 'low'; factors: string[]; implications: string };
    technological: { impact: 'high' | 'medium' | 'low'; factors: string[]; implications: string };
    legal: { impact: 'high' | 'medium' | 'low'; factors: string[]; implications: string };
    environmental: { impact: 'high' | 'medium' | 'low'; factors: string[]; implications: string };
  };
  overallRiskLevel: 'high' | 'medium' | 'low';
  opportunities: string[];
  threats: string[];
  confidence: number;
}

export class PESTLEExecutor implements FrameworkExecutor {
  name: FrameworkName = 'pestle';

  async validate(context: StrategicContext): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    if (!context.challenge) {
      errors.push('Business challenge is required');
    }

    // PESTLE benefits from geographic context
    if (!context.geographicContext) {
      console.warn('[PESTLEExecutor] No geographic context, will use general analysis');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(context: StrategicContext): Promise<PESTLEResults> {
    console.log('[PESTLEExecutor] Analyzing macro-environmental factors...');

    // TODO: Implement PESTLE analysis using LLM
    throw new Error('PESTLE executor not yet implemented');
  }
}

export const pestleExecutor = new PESTLEExecutor();
```

### 7.2.3 Create SWOT Executor

**File:** `server/journey/executors/swot-executor.ts`

```typescript
import { FrameworkExecutor, FrameworkName, StrategicContext } from '../../shared/journey-types';

export interface SWOTResults {
  strengths: Array<{ factor: string; importance: 'high' | 'medium' | 'low' }>;
  weaknesses: Array<{ factor: string; importance: 'high' | 'medium' | 'low' }>;
  opportunities: Array<{ factor: string; timeframe: string; potential: 'high' | 'medium' | 'low' }>;
  threats: Array<{ factor: string; likelihood: 'high' | 'medium' | 'low'; impact: 'high' | 'medium' | 'low' }>;
  strategicOptions: {
    soStrategies: string[];  // Strengths + Opportunities
    woStrategies: string[];  // Weaknesses + Opportunities
    stStrategies: string[];  // Strengths + Threats
    wtStrategies: string[];  // Weaknesses + Threats
  };
  priorityActions: string[];
  confidence: number;
}

export class SWOTExecutor implements FrameworkExecutor {
  name: FrameworkName = 'swot';

  async validate(context: StrategicContext): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: !!context.challenge, errors: context.challenge ? undefined : ['Challenge required'] };
  }

  async execute(context: StrategicContext): Promise<SWOTResults> {
    console.log('[SWOTExecutor] Performing SWOT analysis...');

    // TODO: Implement SWOT analysis using LLM
    throw new Error('SWOT executor not yet implemented');
  }
}

export const swotExecutor = new SWOTExecutor();
```

### 7.2.4 Register All New Executors

**File:** `server/journey/register-frameworks.ts`

```typescript
import { frameworkRegistry } from './framework-executor-registry';
import { fiveWhysExecutor } from './executors/five-whys-executor';
import { bmcExecutor } from './executors/bmc-executor';
import { segmentDiscoveryExecutor } from './executors/segment-discovery-executor';
import { portersExecutor } from './executors/porters-executor';
import { pestleExecutor } from './executors/pestle-executor';
import { swotExecutor } from './executors/swot-executor';

export function registerFrameworks(): void {
  // Core frameworks (fully implemented)
  frameworkRegistry.register(fiveWhysExecutor);
  frameworkRegistry.register(bmcExecutor);
  frameworkRegistry.register(segmentDiscoveryExecutor);

  // Additional frameworks (stubs - throw not implemented)
  frameworkRegistry.register(portersExecutor);
  frameworkRegistry.register(pestleExecutor);
  frameworkRegistry.register(swotExecutor);

  const registered = frameworkRegistry.getRegisteredFrameworks();
  console.log(`[Framework Registry] Registered ${registered.length} frameworks:`, registered);
}
```

---

## Task 7.3: Validate Resolver Fallback

### 7.3.1 Add Smoke Test for Journey Resolution

**File:** `tests/smoke/journey-resolver-smoke.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { JOURNEY_DEFINITIONS, isJourneyAvailable } from '../../server/journey/journey-registry';
import { frameworkRegistry } from '../../server/journey/framework-executor-registry';

describe('Journey Resolver Smoke Tests', () => {

  describe('Journey Definitions', () => {
    it('should have all expected journey types defined', () => {
      const expectedTypes = [
        'business_model_innovation',
        'market_entry',
        'competitive_strategy',
        'digital_transformation',
        'crisis_recovery',
        'growth_strategy',
        'market_segmentation',
      ];

      for (const type of expectedTypes) {
        expect(JOURNEY_DEFINITIONS[type]).toBeDefined();
      }
    });

    it('should mark implemented journeys as available', () => {
      // These should be available (fully implemented)
      expect(isJourneyAvailable('business_model_innovation')).toBe(true);
      expect(isJourneyAvailable('market_segmentation')).toBe(true);
    });

    it('should mark placeholder journeys as unavailable', () => {
      // These are placeholders (not yet implemented)
      expect(isJourneyAvailable('market_entry')).toBe(false);
      expect(isJourneyAvailable('competitive_strategy')).toBe(false);
    });
  });

  describe('Framework Registry', () => {
    it('should have core frameworks registered', () => {
      expect(frameworkRegistry.has('five_whys')).toBe(true);
      expect(frameworkRegistry.has('bmc')).toBe(true);
      expect(frameworkRegistry.has('segment_discovery')).toBe(true);
    });

    it('should have additional framework stubs registered', () => {
      expect(frameworkRegistry.has('porters')).toBe(true);
      expect(frameworkRegistry.has('pestle')).toBe(true);
      expect(frameworkRegistry.has('swot')).toBe(true);
    });

    it('should return all registered frameworks', () => {
      const frameworks = frameworkRegistry.getRegisteredFrameworks();
      expect(frameworks.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Fallback Behavior', () => {
    it('should throw clear error for unavailable journey', async () => {
      // Attempting to execute an unavailable journey should fail gracefully
      const { executeJourney } = await import('../../server/journey/journey-orchestrator');

      await expect(executeJourney('market_entry', { challenge: 'test' }))
        .rejects.toThrow(/not yet implemented|unavailable/i);
    });

    it('should throw clear error for unimplemented framework', async () => {
      // Porter's is registered but throws "not implemented"
      await expect(frameworkRegistry.execute('porters', { challenge: 'test' }))
        .rejects.toThrow(/not yet implemented/i);
    });
  });
});
```

### 7.3.2 Add API Test for Journey Listing

**File:** Add to `tests/smoke/module-registry-smoke.spec.ts`

```typescript
describe('Journey API', () => {
  it('should list all journeys with availability status', async () => {
    const response = await fetch(`${API_BASE}/api/journeys`);
    const data = await response.json();

    expect(data.journeys).toBeDefined();

    // Check that available journeys are marked correctly
    const bmcJourney = data.journeys.find(j => j.type === 'business_model_innovation');
    expect(bmcJourney?.available).toBe(true);

    const marketEntryJourney = data.journeys.find(j => j.type === 'market_entry');
    expect(marketEntryJourney?.available).toBe(false);
  });

  it('should return error for unavailable journey details', async () => {
    const response = await fetch(`${API_BASE}/api/journeys/market_entry/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge: 'test' }),
    });

    // Should return 400 or 501 for unavailable journey
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
```

---

## Summary

### Files to Create

| File | Purpose |
|------|---------|
| `server/journey/executors/segment-discovery-executor.ts` | Marketing Consultant executor |
| `server/journey/executors/porters-executor.ts` | Porter's Five Forces stub |
| `server/journey/executors/pestle-executor.ts` | PESTLE stub |
| `server/journey/executors/swot-executor.ts` | SWOT stub |
| `tests/smoke/journey-resolver-smoke.spec.ts` | Resolver fallback tests |

### Files to Modify

| File | Changes |
|------|---------|
| `shared/journey-types.ts` | Add `market_segmentation` and `segment_discovery` |
| `server/journey/journey-registry.ts` | Add `market_segmentation` definition |
| `server/journey/register-frameworks.ts` | Register all new executors |
| `tests/smoke/module-registry-smoke.spec.ts` | Add journey API tests |

### Expected Console Output After Phase 7

```
[Framework Registry] Registered 6 frameworks: five_whys, bmc, segment_discovery, porters, pestle, swot
[Journey Registry] Available journeys: business_model_innovation, market_segmentation
[Journey Registry] Placeholder journeys: market_entry, competitive_strategy, digital_transformation, crisis_recovery, growth_strategy
```

---

## Phase 7 Completion Criteria

- [ ] Marketing Consultant is a registered journey (`market_segmentation`)
- [ ] Segment discovery executor is registered and functional
- [ ] Porter's, PESTLE, SWOT executors exist as stubs
- [ ] `isJourneyAvailable()` correctly identifies implemented vs placeholder
- [ ] Resolver throws clear error for unavailable journeys
- [ ] All smoke tests pass
- [ ] Console shows 6 registered frameworks

---

## Implementation Order

1. **First:** Add types to `shared/journey-types.ts`
2. **Second:** Create `segment-discovery-executor.ts` (working implementation)
3. **Third:** Create stub executors (porters, pestle, swot)
4. **Fourth:** Update `register-frameworks.ts` to register all
5. **Fifth:** Add `market_segmentation` to `journey-registry.ts`
6. **Sixth:** Create/update smoke tests
7. **Finally:** Verify with `npm run test:smoke`
