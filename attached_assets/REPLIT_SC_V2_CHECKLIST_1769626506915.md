# Strategic Consultant V2 - Replit Execution Checklist

**Full spec:** `STRATEGIC_CONSULTANT_V2_MIGRATION.md`

---

## Day 1: Preparation

### Task 1.1: Rename Legacy
- [ ] Rename `server/strategic-consultant/` → `server/strategic-consultant-legacy/`
- [ ] Rename `server/routes/strategic-consultant.ts` → `server/routes/strategic-consultant-legacy.ts`
- [ ] Update imports in `server/routes.ts`
- [ ] Verify legacy still works at `/api/strategic-consultant-legacy/`

**Evidence:** App runs, legacy endpoint responds

### Task 1.2: Create V2 Structure
- [ ] Create `server/strategic-consultant-v2/` directory
- [ ] Create `server/journey/templates/` directory
- [ ] Create placeholder files: `index.ts`, `types.ts`

**Evidence:** Directory structure exists

---

## Day 2: Journey Templates

### Task 2.1: Template Types
- [ ] Create `server/journey/templates/template-types.ts`
- [ ] Define `JourneyTemplate` interface
- [ ] Define `EPMModuleConfig` interface

### Task 2.2: Standard EPM Template
- [ ] Create `server/journey/templates/standard-epm.ts`
- [ ] Define analysis frameworks: `['five_whys', 'swot']`
- [ ] Define all 14 EPM modules

### Task 2.3: Other Templates
- [ ] Create `bmc-journey.ts`
- [ ] Create `digital-transformation.ts`
- [ ] Create `product-launch.ts`
- [ ] Create `market-expansion.ts`

### Task 2.4: Template Registry
- [ ] Create `server/journey/templates/index.ts`
- [ ] Export `templateRegistry` with `.get()` and `.list()` methods

**Evidence:** `templateRegistry.list()` returns 5+ templates

---

## Day 3: V2 Core Implementation

### Task 3.1: Context Gatherer
- [ ] Create `server/strategic-consultant-v2/context-gatherer.ts`
- [ ] Implement `askClarifications()`
- [ ] Implement `runAnalysis()` with industry detection
- [ ] Implement `saveContext()`

### Task 3.2: Journey Selector
- [ ] Create `server/strategic-consultant-v2/journey-selector.ts`
- [ ] Implement `selectBestTemplate()` with keyword matching
- [ ] Handle: BMC, Digital, Product Launch, Market Expansion, Default

### Task 3.3: Main Entry Point
- [ ] Create `server/strategic-consultant-v2/index.ts`
- [ ] Implement `gatherContext()` - Phase 1
- [ ] Implement `executeJourney()` - Phase 2 (calls Journey Builder)
- [ ] Implement `run()` - full flow
- [ ] Export `strategicConsultantV2` singleton

**Evidence:** Can call `strategicConsultantV2.run("sneaker store in Abu Dhabi", sessionId)`

---

## Day 4: API Routes + Frontend

### Task 4.1: V2 Routes
- [ ] Create `server/routes/strategic-consultant-v2.ts`
- [ ] `POST /start` - gather context
- [ ] `POST /execute` - run journey
- [ ] `POST /run` - full flow
- [ ] `GET /templates` - list available

### Task 4.2: Register Routes
- [ ] Add to `server/routes.ts`:
  ```typescript
  app.use('/api/strategic-consultant-v2', v2Routes);
  app.use('/api/strategic-consultant-legacy', legacyRoutes);
  ```

### Task 4.3: Frontend Toggle
- [ ] Add "Strategic Consultant (New)" menu item
- [ ] Keep "Strategic Consultant (Legacy)" visible
- [ ] New page uses V2 API endpoints

**Evidence:** Both `/strategic-consultant-v2` and `/strategic-consultant-legacy` accessible in UI

---

## Day 5: Validation & Cutover

### Task 5.1: Test Cases

#### Sneaker Store Test (CRITICAL)
- [ ] Run: "Opening athletic sneaker store in Abu Dhabi"
- [ ] Check `workstreams.csv`:
  - [ ] NO "food safety"
  - [ ] NO "food service"
  - [ ] NO "kitchen"
  - [ ] NO "health inspection" (food context)
- [ ] Check `resources.csv`:
  - [ ] FTE values are decimals (1.0, 0.8, 0.75)
  - [ ] NOT percentages (100, 80, 75)
- [ ] Check `benefits.csv`:
  - [ ] Names ≠ "Unnamed benefit"
  - [ ] Targets ≠ "-"
- [ ] Check `epm.json`:
  - [ ] Workstream confidence varies (not all 0.85)
- [ ] Check console:
  - [ ] Quality gate results logged

#### Restaurant Test (Control)
- [ ] Run: "Opening restaurant in Dubai"
- [ ] Check `workstreams.csv`:
  - [ ] HAS "food safety" or similar
  - [ ] HAS "health inspection" or similar

### Task 5.2: Quality Checklist
- [ ] Industry validator running (no contamination)
- [ ] FTE normalizer running (decimals)
- [ ] Benefits transformer running (names + targets)
- [ ] Confidence calculator running (variance)
- [ ] Quality gates running (console logs)
- [ ] Dependency validator running (valid chains)

### Task 5.3: Cutover (When All Tests Pass)
- [ ] Update main route to point to V2
- [ ] Hide legacy from navigation
- [ ] Monitor for 1-2 weeks
- [ ] Plan legacy code removal

---

## Evidence Artifacts to Attach

| Artifact | Purpose |
|----------|---------|
| `resources.csv` from Sneaker Store V2 | Proves FTE normalization |
| `benefits.csv` from Sneaker Store V2 | Proves benefits transformation |
| `workstreams.csv` from Sneaker Store V2 | Proves NO food safety contamination |
| `epm.json` snippet showing confidence | Proves confidence variance |
| Console log with quality gates | Proves validators running |
| Screenshot of both UIs | Proves side-by-side working |

---

## Pass/Fail Gates

| Gate | Requirement | Blocks |
|------|-------------|--------|
| G1 | Legacy renamed and still works | Day 2 |
| G2 | Templates created and registered | Day 3 |
| G3 | V2 core compiles and runs | Day 4 |
| G4 | V2 API responds correctly | Day 5 |
| G5 | Sneaker Store has ZERO food safety | Cutover |
| G6 | All quality checks pass | Cutover |

---

## Quick Commands

```bash
# Verify legacy still works
curl http://localhost:5000/api/strategic-consultant-legacy/health

# Verify V2 works
curl http://localhost:5000/api/strategic-consultant-v2/templates

# Run sneaker store test
curl -X POST http://localhost:5000/api/strategic-consultant-v2/run \
  -H "Content-Type: application/json" \
  -d '{"userInput": "Opening athletic sneaker store in Abu Dhabi", "sessionId": "test-123"}'

# Check for food safety contamination
grep -i "food" data/workstreams.csv  # Should return nothing for sneaker store
```

---

**Total: 5 days | 6 gates | 1 critical test (Sneaker Store)**
