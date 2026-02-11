# Agent Coordination Protocol

Goal: eliminate duplicate work and merge collisions by assigning exclusive ownership and requiring task claims before edits.

## Core Rules
1. Single-owner per area. Only the owner edits files in that area unless a handoff is approved.
2. Every task must be claimed in the task registry before editing any file.
3. If you need to touch a file outside your area, request a handoff or pair explicitly.
4. No parallel edits to the same file or class without a written handoff.
5. Merges require evidence that no other active task touches the same files.

## Required Artifacts
- Ownership map: `docs/AGENT_OWNERSHIP.md`
- Task registry: `docs/AGENT_TASKS.md`

## Claim Protocol
1. Add a task entry to `docs/AGENT_TASKS.md` with: owner, branch, files, status.
2. Announce the claim in agent comms.
3. Only then begin edits.

## Handoff Protocol
1. Owner acknowledges transfer in comms.
2. Task registry updated with new owner and files.
3. Only then edit files in that area.

## Merge Checklist (must pass)
- Task registry shows no overlapping active tasks on the same files.
- No duplicate helper/method names introduced in shared services.
- Targeted validation run or evidence attached.
- Commit message includes scope and files touched.

