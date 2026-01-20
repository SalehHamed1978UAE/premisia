# Performance Optimization Plan for Premisia

## Overview

This plan addresses performance issues in both the **Strategic Consultant** (journey execution) and **Marketing Consultant** (segment discovery) flows.

**Guiding Principle:** Instrument first, then optimize with data.

---

## Phase 1: Instrumentation (DO THIS FIRST)

Before making any optimization changes, add timing to measure actual bottlenecks.

### 1.1 Segment Discovery Timing

**File:** `server/services/segment-discovery-engine.ts`

Add timing wrapper to `runDiscovery`:

```typescript
async runDiscovery(context: DiscoveryContext, onProgress?: ProgressCallback): Promise<DiscoveryResult> {
  const timings: Record<string, number> = {};

  const time = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const start = Date.now();
    const result = await fn();
    timings[name] = Date.now() - start;
    console.log(`[SegmentDiscovery Timing] ${name}: ${timings[name]}ms (${(timings[name]/1000).toFixed(1)}s)`);
    return result;
  };

  onProgress?.('Generating gene library...', 5);
  const geneLibrary = await time('generateGeneLibrary', () =>
    this.generateGeneLibrary(context));

  onProgress?.('Generating 100 customer segments...', 20);
  const genomes = await time('generateGenomes', () =>
    this.generateGenomes(geneLibrary, context, 100));

  onProgress?.('Scoring segments...', 50);
  const scored = await time('scoreGenomes', () =>
    this.scoreGenomes(genomes, context));

  onProgress?.('Stress testing top segments...', 70);
  const stressTested = await time('stressTest', () =>
    this.stressTest(scored.slice(0, 20), context));

  onProgress?.('Synthesizing recommendations...', 90);
  const synthesis = await time('synthesize', () =>
    this.synthesize(stressTested, scored, context));

  // Print summary
  console.log('\n[SegmentDiscovery] ═══════════════════════════════════════');
  console.log('[SegmentDiscovery] TIMING SUMMARY');
  console.log('[SegmentDiscovery] ═══════════════════════════════════════');
  Object.entries(timings).forEach(([name, ms]) => {
    console.log(`[SegmentDiscovery] ${name.padEnd(25)} ${(ms/1000).toFixed(1)}s`);
  });
  const total = Object.values(timings).reduce((a, b) => a + b, 0);
  console.log('[SegmentDiscovery] ───────────────────────────────────────');
  console.log(`[SegmentDiscovery] TOTAL: ${(total/1000).toFixed(1)}s`);
  console.log('[SegmentDiscovery] ═══════════════════════════════════════\n');

  return { geneLibrary, genomes: scored, synthesis };
}
```

### 1.2 SSE Timing Events

**File:** `server/routes/marketing-consultant.ts`

Update `runSegmentDiscovery` to emit timing in SSE:

```typescript
const result = await segmentDiscoveryEngine.runDiscovery(
  context,
  (step: string, progress: number, timing?: { elapsed: number }) => {
    discoveryProgress.set(id, {
      step,
      progress,
      message: step,
      elapsedMs: timing?.elapsed
    });
  }
);
```

### 1.3 Run and Capture Output

Run a full segment discovery and capture the timing output. Share the results before proceeding to Phase 2.

---

## Phase 2: Fast Model Routing

### 2.1 Add Quality Flag to AI Clients

**File:** `server/ai-clients.ts`

```typescript
// Add after line 14
const OPENAI_MODEL_FAST = "gpt-4o-mini";
const ANTHROPIC_MODEL_FAST = "claude-3-5-haiku-20241022";
const GEMINI_MODEL_FAST = "gemini-2.0-flash";

type ModelQuality = 'fast' | 'default';

// Update interface (around line 16)
interface AIClientRequest {
  systemPrompt: string;
  userMessage: string;
  responseSchema?: any;
  maxTokens?: number;
  quality?: ModelQuality;  // NEW
}

// Update callAnthropic method
async callAnthropic(request: AIClientRequest): Promise<AIClientResponse> {
  const { systemPrompt, userMessage, maxTokens = 8192, quality = 'default' } = request;
  const anthropic = this.getAnthropic();

  const model = quality === 'fast' ? ANTHROPIC_MODEL_FAST : ANTHROPIC_MODEL;

  const response = await anthropic.messages.create({
    model,
    system: systemPrompt,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: userMessage }],
  });

  // ... rest unchanged
}

// Apply same pattern to callOpenAI and callGemini
```

### 2.2 Update Segment Discovery to Use Fast Models

**File:** `server/services/segment-discovery-engine.ts`

For batch operations, use fast models:

```typescript
// In generateGenomeBatch (around line 400)
const response = await withTimeout(
  this.anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',  // FAST model for batches
    max_tokens: 8000,
    // ...
  }),
  AI_TIMEOUT_MS,
  `generateGenomeBatch-${batchIndex}`
);

// In scoreBatch (around line 520)
const response = await withTimeout(
  this.anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',  // FAST model for scoring
    max_tokens: 8000,
    // ...
  }),
  AI_TIMEOUT_MS,
  'scoreBatch'
);

// In stressTestBatch (around line 640)
const response = await withTimeout(
  this.anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',  // FAST model for stress tests
    max_tokens: 4000,
    // ...
  }),
  AI_TIMEOUT_MS,
  'stressTestBatch'
);
```

**Keep default (sonnet) for:**
- `generateGeneLibrary` - Foundation quality matters
- `synthesize` - Final output quality matters

---

## Phase 3: Caching with User Scoping

### 3.1 Add Cache Service

**File:** `server/services/discovery-cache-service.ts` (NEW)

```typescript
import crypto from 'crypto';

interface CacheEntry {
  result: any;
  timestamp: number;
  userId: string;
}

class DiscoveryCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  generateKey(userId: string, context: any): string {
    const normalized = JSON.stringify({
      description: context.offeringDescription?.toLowerCase().trim(),
      clarifications: context.clarifications,
    });
    return crypto.createHash('sha256')
      .update(`${userId}||${normalized}`)
      .digest('hex');
  }

  get(userId: string, context: any): any | null {
    const key = this.generateKey(userId, context);
    const entry = this.cache.get(key);

    if (!entry) return null;
    if (entry.userId !== userId) return null; // Security check
    if (Date.now() - entry.timestamp > this.TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    console.log(`[DiscoveryCache] HIT for user ${userId.slice(0, 8)}...`);
    return entry.result;
  }

  set(userId: string, context: any, result: any): void {
    const key = this.generateKey(userId, context);
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      userId,
    });
    console.log(`[DiscoveryCache] STORED for user ${userId.slice(0, 8)}...`);
  }
}

export const discoveryCacheService = new DiscoveryCacheService();
```

### 3.2 Use Cache in Discovery Route

**File:** `server/routes/marketing-consultant.ts`

```typescript
import { discoveryCacheService } from '../services/discovery-cache-service';

async function runSegmentDiscovery(id: string, context: any, userId: string) {
  // Check cache first
  const cached = discoveryCacheService.get(userId, context);
  if (cached) {
    console.log(`[Segment Discovery ${id}] Using cached result`);
    await db.update(segmentDiscoveryResults)
      .set({
        geneLibrary: cached.geneLibrary,
        genomes: cached.genomes,
        synthesis: cached.synthesis,
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(segmentDiscoveryResults.id, id));
    discoveryProgress.set(id, { step: 'Complete (cached)', progress: 100 });
    return;
  }

  // ... existing discovery logic ...

  // Cache the result
  discoveryCacheService.set(userId, context, result);
}
```

---

## Phase 4: Intermediate Streaming

### 4.1 Emit Top 20 After Scoring

**File:** `server/services/segment-discovery-engine.ts`

```typescript
async runDiscovery(context: DiscoveryContext, onProgress?: ProgressCallback): Promise<DiscoveryResult> {
  // ... gene library and genome generation ...

  const scored = await this.scoreGenomes(genomes, context);

  // Emit top 20 immediately so UI can show results
  onProgress?.('Top segments identified', 60, {
    type: 'intermediate_results',
    top20: scored.slice(0, 20).map(g => ({
      id: g.id,
      genes: g.genes,
      score: g.fitness.totalScore,
      narrativeReason: g.narrativeReason
    }))
  });

  // Continue with stress testing...
}
```

### 4.2 Update SSE Handler

**File:** `server/routes/marketing-consultant.ts`

```typescript
// In discovery-stream handler
if (progress.top20) {
  res.write(`data: ${JSON.stringify({
    type: 'intermediate_results',
    top20: progress.top20
  })}\n\n`);
}
```

---

## Phase 5: Lightweight Summary Storage

### 5.1 Add Summary Column

**File:** `shared/schema.ts`

Add to `segmentDiscoveryResults` table:

```typescript
summary: text('summary'), // Lightweight JSON for fast loading
```

Run: `npm run db:push`

### 5.2 Store Summary When Saving

**File:** `server/routes/marketing-consultant.ts`

```typescript
// In runSegmentDiscovery, before saving
const summary = JSON.stringify({
  top20: result.genomes.slice(0, 20).map(g => ({
    id: g.id,
    genes: g.genes,
    score: g.fitness.totalScore
  })),
  beachhead: result.synthesis.beachhead?.genome?.id,
  backupCount: result.synthesis.backupSegments?.length || 0,
  neverListCount: result.synthesis.neverList?.length || 0,
  totalGenomes: result.genomes.length
});

await db.update(segmentDiscoveryResults)
  .set({
    summary,  // NEW: Unencrypted summary for fast loading
    geneLibrary: encryptedGeneLibrary,
    genomes: encryptedGenomes,
    synthesis: encryptedSynthesis,
    // ...
  })
```

### 5.3 Return Summary by Default

**File:** `server/routes/marketing-consultant.ts`

```typescript
router.get('/results/:id', async (req, res) => {
  // ... auth checks ...

  const { expand } = req.query;

  // Return summary by default (no decryption needed)
  if (!expand) {
    return res.json({
      id: record.id,
      status: record.status,
      summary: record.summary ? JSON.parse(record.summary) : null,
      createdAt: record.createdAt,
    });
  }

  // Only decrypt full data if explicitly requested
  if (expand === 'full') {
    const decryptedGenomes = await decryptJSONKMS(record.genomes);
    // ... full decryption ...
  }
});
```

---

## Phase 6: Parallel Encryption

**File:** `server/routes/marketing-consultant.ts`

```typescript
// BEFORE (sequential)
const encryptedGeneLibrary = await encryptJSONKMS(result.geneLibrary);
const encryptedGenomes = await encryptJSONKMS(result.genomes);
const encryptedSynthesis = await encryptJSONKMS(result.synthesis);

// AFTER (parallel)
const [encryptedGeneLibrary, encryptedGenomes, encryptedSynthesis] = await Promise.all([
  encryptJSONKMS(result.geneLibrary),
  encryptJSONKMS(result.genomes),
  encryptJSONKMS(result.synthesis),
]);
```

---

## Phase 7: Batched Parallel Web Searches

**File:** `server/routes/strategic-consultant.ts` (lines 1275-1284)

Apply consistent batch pattern to ALL search loops:

```typescript
// Replace sequential loop with batched parallel
const SEARCH_BATCH_SIZE = 3;
const searchResults = [];

for (let i = 0; i < queries.length; i += SEARCH_BATCH_SIZE) {
  const batch = queries.slice(i, i + SEARCH_BATCH_SIZE);

  // Progress update per batch
  res.write(`data: ${JSON.stringify({
    type: 'progress',
    message: `Searching: ${batch.map(q => q.query).join(', ')}`,
    progress: 30 + ((i + SEARCH_BATCH_SIZE) / queries.length) * 30
  })}\n\n`);

  // Run batch in parallel
  const batchResults = await Promise.all(
    batch.map(q => marketResearcher.performSingleWebSearch(q))
  );
  searchResults.push(...batchResults);
}
```

Apply same pattern to any other search loops in the file.

---

## What NOT to Do

| Don't | Why |
|-------|-----|
| Remove the 100ms delay in journey-orchestrator.ts | Prevents Neon serverless connection pool exhaustion |
| Parallelize genome generation further | Already uses 4 parallel batches |
| Parallelize scoring further | Already uses parallel batches of 25 |
| Cache without userId scoping | Security risk - cross-user data leakage |
| Skip instrumentation | Need data to verify optimizations work |

---

## Expected Results

| Optimization | Expected Impact |
|--------------|-----------------|
| Fast models for batches | 30-50% faster per batch |
| Caching with hash check | Skip entire run on retry |
| Lightweight summary | 10x faster page loads |
| Parallel encryption | 3x faster save |
| Batched web searches | 3x faster search phase |
| Intermediate streaming | Better perceived speed |

---

## Implementation Order

1. **Phase 1: Instrumentation** - Add timing, run discovery, share output
2. **Phase 2: Fast Model Routing** - Quick win, low risk
3. **Phase 3: Caching** - Prevents duplicate work
4. **Phase 4: Intermediate Streaming** - Better UX
5. **Phase 5: Summary Storage** - Faster page loads
6. **Phase 6: Parallel Encryption** - Quick win
7. **Phase 7: Batched Searches** - Faster research phase

---

## Verification

After each phase, run a full discovery and compare timing output to baseline.

```bash
# Look for timing summary in logs
grep "TIMING SUMMARY" logs/*.log
```
