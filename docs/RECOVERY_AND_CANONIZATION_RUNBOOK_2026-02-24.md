# Recovery And Canonization Runbook (2026-02-24)

## Snapshot

- Recorded at: `2026-02-24` (local work session)
- Current branch: `main`
- Current HEAD: `6e0023fb70f50024806321f4900dce56eff19d89`
  - Message: `Harden EPM content quality gates and validator parity`
- Previous stabilization commit: `88ea9575`
  - Message: `Fix BMI post-research routing and EPM title/label cleanup`

## Known Good Rollback Points

If current fixes do not restore publishable EPM quality, use these rollback anchors:

1. Preferred quality rollback (last known good EPM quality):
   - Commit: `c835243282f39c5809a9850cfa3db6b12e0c754f`
   - Timestamp: `2026-02-17 22:08:08 +0400`
   - Message: `fix(epm): restore constraint-policy and decision-selection support modules`

2. Published-state rollback (last known successful deployment snapshot):
   - Commit: `c8fa4e13c08e6a109ebf84d1baa11b05097e5e02`
   - Timestamp: `2026-02-17 18:21:35 +0000`
   - Message: `Published your App`

Safe rollback workflow (non-destructive first):

1. `git checkout -b recovery/epm-c835 c8352432`
2. Run smoke + validator gates.
3. Only if quality is confirmed, decide whether to fast-forward/cherry-pick into `main`.

## Current Findings (As Of This Snapshot)

Latest validator run against package:

- Package: `json-title-GCC-FinTech-Compliance-Platform-Development-Strategy- v1.zip`
- Result: `FAIL`, score `0/100` (hardened validator)

Primary blockers found:

1. Executive summary title artifact (`json/code-fence` formatting leak).
2. Missing workstream owner.
3. Duplicate workstream names.
4. Risk coverage below required minimum for workstream count.
5. Deliverable-to-assignment ID linkage mismatch.
6. Domain lexicon leakage (`Technology/SaaS` terms in BFS context).
7. Phase alignment warning on late-stage workstream timing.

## What Has Been Implemented Already

1. Shared acceptance gates tightened (`presave` and `export` parity):
   - title artifact/missing title checks
   - summary coverage and placeholder checks
   - missing owner check
   - duplicate workstream name check
   - risk coverage minimum check
2. EPM synthesis auto-repair pass:
   - sanitizes title
   - fills missing owners
   - enforces unique names
   - fills summary coverage floors
   - adds risk coverage floor
3. CLI validator parity:
   - new validator check runs shared export acceptance logic to prevent "CLI pass, export fail".
4. BMI flow stabilization:
   - research now routes correctly to BMC step in sequence.

## Rollback Trigger Criteria

Rollback to `c8352432` should be executed if any of the following remain true after targeted fixes:

1. Two consecutive regeneration attempts for same input still fail acceptance critical gates.
2. Export acceptance still fails on content-critical checks.
3. BMC -> decisions -> EPM flow remains unstable in Replit smoke tests.
4. Output quality remains non-publishable after domain lexical cleanup + ID linkage fixes.

## Immediate Recovery Plan (Before Full Rollback)

1. Fix domain lexical contamination in BFS outputs (remove `Technology/SaaS` label leaks).
2. Fix assignment task IDs to exactly match canonical deliverable IDs.
3. Re-run strict gates:
   - `npx tsx scripts/validate-export-package.ts <epm.json>`
   - export acceptance on `strategy.json + epm.json + csvs`
4. Re-run Replit smoke flow:
   - BMI: research -> BMC 9-block -> strategic decisions -> EPM -> export.

If still failing, execute rollback trigger.

## Journey Canonization Plan (Including Journey Builder Canvas)

Current architectural problem:

- Split-brain journey execution still exists (multiple execution paths, brittle routing workarounds).
- Canvas/wizard definitions are not fully guaranteed to execute through one canonical runtime path.

Target state:

- One source of truth for journey definition.
- One source of truth for journey execution.
- One canonical session identity through the full flow.

### Workstream A: Canonical Definition Model

1. Define canonical journey spec schema (versioned):
   - steps
   - prerequisites
   - policy (`required`, `optional`, `intake_only`, `skip_if`)
   - outputs and handoff contracts
2. Make Journey Builder Canvas publish this spec as immutable versioned artifacts.
3. Keep YAML registry synchronized from the same canonical spec output (not parallel manual edits).

### Workstream B: Single Execution Authority

1. Route **all** journeys (built-in + canvas + wizard) through `JourneyOrchestrator`.
2. Remove/retire alternative executors for step progression.
3. Enforce one canonical `journeySessionId` end-to-end (no compatibility shadow session).

### Workstream C: Explicit Step Policy Engine

1. Replace ad-hoc filtering with explicit policy evaluation.
2. Handle `strategic_understanding` as policy-driven (`intake_only` when already satisfied).
3. Record policy decisions in execution logs for auditability.

### Workstream D: State-Driven Navigation

1. Frontend routes must follow orchestrator-reported `nextStep` and step status.
2. Remove guessed/manual route derivation and brittle route bypasses.
3. Standardize resume behavior from persisted orchestrator state.

### Workstream E: Migration And Backfill

1. Migrate existing `user_journeys` into canonical orchestrator-backed sessions.
2. Add migration script with dry-run report and rollback markers.
3. Preserve historical versions and audit trace.

### Workstream F: Golden Record And Release Gates

1. Add canonical golden-record tests for each journey type (including canvas-created journeys).
2. Mandatory smoke suite before publish:
   - start journey
   - complete each step
   - resume mid-journey
   - generate decisions and EPM
   - export package passes acceptance
3. Block publish when journey canonization or EPM acceptance gates fail.

## Ownership Note

This document is the operational checkpoint to resume from after restart.
Update this file first before changing rollback targets or canonization scope.
