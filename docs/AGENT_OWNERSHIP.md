# Agent Ownership Map

This is the single source of truth for file ownership. Do not edit outside your area without handoff.

## Current Owners (Sprint 1)
- Agent-2: Quality gates and validator checks
  Files: `server/intelligence/epm/validators/**`, `scripts/validate-export-package.ts`

- Agent-3: Constraints, strategy version persistence, export schema alignment
  Files: `server/routes/strategy-workspace.ts`, `server/services/export/**`, `server/intelligence/epm/context-builder.ts`

- Agent-4: Clarifications, ambiguity/conflict detection, report surfacing
  Files: `server/services/ambiguity-detector.ts`, `server/routes/strategic-consultant-legacy.ts`, `server/services/export/markdown-exporter.ts`

- Agent-5: Budget/timeline coherence and decision constraint gates
  Files: `server/intelligence/epm-synthesizer.ts`, `server/intelligence/epm/constraint-utils.ts`

- Agent-6: WBS, timeline containment, phase alignment
  Files: `server/intelligence/epm/timeline-calculator.ts`, `server/intelligence/epm/wbs*`, `server/intelligence/epm/validators/*wbs*`

## Coordinator (Agent-1)
- Integration merges
- Conflict resolution
- Final validation sign-off

