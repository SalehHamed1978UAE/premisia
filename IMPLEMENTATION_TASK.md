# Implementation Task: Journey Module Cognition Specification

## Read These First:
1. `docs/JOURNEY_MODULE_COGNITION_SPEC_FINAL.md` - The master specification (~70KB)
2. `docs/MODULE_FACTORY_SPECIFICATION.md` - Module factory patterns (~56KB)
3. `server/journey/` - Current journey implementation
4. `server/intelligence/` - Current analyzers

## What Needs To Be Done

### Phase 1: Audit Current State
1. Check what modules exist in `server/journey/executors/`
2. Check what bridges exist in `server/journey/bridges/`
3. Identify what's returning `Promise<any>` vs typed returns
4. Map current state vs spec requirements

### Phase 2: Add Input/Output Contracts
1. Create Zod schemas for each module's input/output in `shared/contracts/`
2. Update executors to use typed returns (not `Promise<any>`)
3. Add validation at orchestrator level before running modules

### Phase 3: Implement Module Cognition
For each module (PESTLE, Porter's, SWOT, Five Whys, BMC):
1. Add reasoning steps to prompts per spec
2. Add quality criteria checks
3. Add proper TypeScript interfaces

### Phase 4: Implement Bridges
1. Create bridges with cognitive transformation (not just data mapping)
2. PESTLE → Porter's: regulatory factors become entry barriers
3. Porter's + PESTLE → SWOT: derive O/T from external analysis

### Phase 5: Fix Known Bugs
1. Market Entry decision page empty forms - check `.output` vs `.data` property (line 2444 in research stream)
2. Journey selector appearing twice - state management bug
3. EPM `/undefined` - programId not being passed

### Phase 6: Add Startup Validation
Create `server/journey/startup-validator.ts` that:
- Validates all available journeys have their executors registered
- Fails server startup if any framework is missing
- Call after `registerFrameworkExecutors()` in server startup

## After Implementation
- Commit all changes with descriptive message
- Push to origin (GitHub)

## Completion Notification
When completely finished, run:
```bash
clawdbot gateway wake --text "Done: Implemented Journey Module Cognition Spec in Premisia" --mode now
```
