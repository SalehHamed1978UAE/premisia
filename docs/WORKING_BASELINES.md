# Working Baselines

**Last Updated:** January 24, 2026

This document records known working states of the platform for regression reference.

---

## Quick Verification Commands

### Check Server Health
```bash
curl -s http://localhost:5000/api/health | jq
```

### Check Module Registry
```bash
curl -s http://localhost:5000/api/module-registry/modules | jq '.count, .modules[0].name'
curl -s http://localhost:5000/api/module-registry/stats | jq
```

### Check Journey Configs
```bash
curl -s http://localhost:5000/api/module-registry/journeys | jq '.count'
```

### Run Smoke Tests
```bash
npm run test:smoke
```

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
[BMC] Starting research for session...
[BMC] Phase 1/8: Market Size Analysis
[BMC] Phase 2/8: Competition Research
...
[BMC] Research complete - 8/8 phases done
[EPM Generator] Building context from knowledge graph
[EPM Generator] Generating workstreams...
[EPM Generator] ✓ Generated 5 workstreams with 23 deliverables
```

### Regression Indicators
- ❌ Workstreams named "Strategic Initiative 1, 2, 3..."
- ❌ Deliverables contain research text paragraphs
- ❌ EPM generation fails with "No knowledge graph data"
- ❌ Timeline shows all tasks starting on same day

---

## Marketing Consultant (Segment Discovery)

### Baseline Test Case
- **Input:** "Premium artisan bakery specializing in sourdough bread and French pastries"
- **Classification:** Physical Product (B2C)

### Expected Behavior
1. Classification returns `physical_product`
2. Discovery completes in 2-3 minutes
3. Gene library generated with B2C dimensions
4. 100 genomes scored and ranked
5. Beachhead segment identified with validation plan

### B2C Segmentation Rules
- Segments should be individual consumers:
  - ✅ "Health-conscious millennials seeking artisan breads"
  - ✅ "Busy professionals buying premium breakfast pastries"
  - ✅ "Parents seeking quality baked goods for family"
- Segments should NOT be B2B:
  - ❌ "Restaurant distributors seeking wholesale partners"
  - ❌ "Procurement officers for hotel chains"
  - ❌ "Retail buyers for grocery stores"

### Console Logs (Expected)
```
[Segment Discovery] Starting discovery for understanding: abc123
[Segment Discovery] Classification: physical_product (B2C mode)
[Segment Discovery] Extracting context keywords: ["bakery", "sourdough", "pastries"]
[Segment Discovery] Generating gene library...
[Segment Discovery] ✓ Gene library: 6 dimensions, 42 alleles
[Segment Discovery] Generating 100 genomes...
[Segment Discovery] ✓ Generated 100 genomes
[Segment Discovery] Scoring genomes...
[Segment Discovery] ✓ Top genome fitness: 8.5/10
[Segment Discovery] Synthesizing beachhead recommendation...
[Segment Discovery] ✓ Discovery complete
```

### Regression Indicators
- ❌ Gene dimensions include `industry_vertical`, `company_size`, `decision_maker`
- ❌ Beachhead describes distributors, wholesalers, or B2B buyers
- ❌ Validation plan mentions trade shows, B2B sales, or procurement
- ❌ Discovery fails with "No genomes generated"
- ❌ SSE stream times out before completion

---

## Module Registry

### Expected State
- 6+ modules registered (analyzers and generators)
- 2+ journey configs available
- BMC journey resolves with page sequence

### Quick Check
```bash
# Should return count > 0
curl -s http://localhost:5000/api/module-registry/modules | jq '.count'

# Should return module with name
curl -s http://localhost:5000/api/module-registry/modules | jq '.modules[0].name'

# Should have journeys
curl -s http://localhost:5000/api/module-registry/journeys | jq '.count'
```

### Regression Indicators
- ❌ `/api/module-registry/modules` returns empty array
- ❌ `/api/module-registry/stats` returns 500 error
- ❌ Journey resolution fails with "Journey not found"

---

## Repository & DI Container

### Expected State
All repositories should be registered:
- `repository:epm`
- `repository:journey`
- `repository:strategy`

All EPM components should be registered:
- `epm:synthesizer`
- `epm:workstream-generator`
- `epm:timeline-calculator`
- `epm:resource-allocator`
- `epm:validator`

### Regression Indicators
- ❌ "Service 'repository:epm' not registered" error on startup
- ❌ EPM generation fails with "Cannot resolve service"
- ❌ Container.has() returns false for expected services

---

## SSE Connection Stability

### Expected Behavior
1. SSE stream connects and receives heartbeat every 15s
2. If connection drops, client auto-reconnects (3 attempts)
3. If reconnection fails, falls back to polling
4. Connection status indicator shows correct state

### Console Logs (Expected - Client)
```
[SSE] Connected to discovery stream
[SSE] Heartbeat received
[SSE] Progress: 25% - Generating gene library
...
[SSE] Progress: 100% - Discovery complete
```

### Regression Indicators
- ❌ SSE connection drops without heartbeat
- ❌ Client shows "Connection lost" but no reconnection attempt
- ❌ Polling fallback not triggered after failed reconnects
- ❌ Progress stuck at 0% despite backend completing

---

## Running Smoke Tests

### Full Suite
```bash
# Run all smoke tests
bash scripts/run-smoke-tests.sh

# Or directly with vitest
npx vitest run tests/smoke/ --reporter=verbose
```

### Individual Test Files
```bash
npx vitest run tests/smoke/journey-smoke.spec.ts
npx vitest run tests/smoke/repository-smoke.spec.ts
npx vitest run tests/smoke/module-registry-smoke.spec.ts
```

### CI Mode (JSON output)
```bash
npx vitest run tests/smoke/ --reporter=json --outputFile=smoke-results.json
```

---

## Troubleshooting

### Tests Fail with Connection Refused
```bash
# Start the server first
npm run dev

# Then run tests in another terminal
npm run test:smoke
```

### Tests Timeout
- Marketing discovery can take 2-3 minutes
- Increase timeout if needed: `TIMEOUT_MS=600000`

### B2C Test Fails with B2B Segments
1. Check `segment-discovery-engine.ts` for B2C prompt guidance
2. Verify offering type is classified correctly
3. Check gene library dimensions don't include B2B fields
