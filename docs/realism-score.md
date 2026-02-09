# Strategic Realism Score

The Strategic Realism Score is a weighted composite that evaluates how
executable a generated EPM program is, before any human review. It looks
across five dimensions that mirror the downstream execution risk profile.

## Why it exists

- **Catch unrealistic programs early** – Highlight timelines, resource plans,
and budgets that diverge from operational reality.
- **Quantify plan quality** – Provide a consistent yardstick for comparing
program versions.
- **Drive explainability** – Every dimension surfaces warnings with the rules
that fired.

---

## Dimensions & Weighting

| Dimension | Weight | What it checks | Primary data sources |
|-----------|--------|----------------|----------------------|
| Timeline Feasibility | 25% | Duration vs. inferred scale, phase balance,
sequencing | `program.timeline`, ContextBuilder heuristics |
| Resource Plausibility | 20% | Headcount, role mix, utilization vs.
initiative type | `program.resourcePlan`, `program.workstreams`, strategic
insights |
| Financial Coherence | 20% | Budget vs. timeline & headcount, cash flow
sanity | `program.financialPlan`, `program.resourcePlan` |
| Governance & Risk Coverage | 20% | Risk mitigations, stage gates, QA/
governance completeness | `program.riskRegister`, `program.stageGates`,
`program.qaPlan`, `program.governance` |
| Execution Alignment | 15% | Workstreams/benefits mapping to strategic
priorities | `program.workstreams`, `program.benefitsRealization`, strategic
insights & decisions |

Total weight = 100%.

---

## Scoring Bands

Each dimension produces a 0–100 score, which is then weighted.

- **90–100 (Green)** – Operationally realistic; only minor fine-tuning
expected.
- **70–89 (Yellow)** – Mostly realistic but with issues flagged for attention.
- **50–69 (Orange)** – Significant gaps; plan should be reviewed before
execution.
- **0–49 (Red)** – Unrealistic; requires rework before any downstream
commitment.

Overall score = Σ(weight × dimension score) ÷ Σ weights (clamped 0–100).

---

## Rule Framework

All checks are deterministic:

### Timeline Feasibility
- Compare total duration against `ContextBuilder.inferTimelineRange(scale,
insights)`; penalize for >25% deviation.
- Ensure phase durations roughly balance (±40%) unless template allows
otherwise.
- Validate critical path length vs. number of major workstreams.

### Resource Plausibility
- Derive expected FTE range by initiative type & scale (ontology-driven
lookup).
- Flag missing mandatory roles (e.g., project manager for enterprise
programs).
- Penalize >80% utilization on average or single resources committed to
conflicting tasks.

### Financial Coherence
- Check that staffing cost + contingency ≈ budget (±30% tolerance).
- Ensure no negative cumulative cash flow beyond documented financing.
- Validate ROI / benefits assumptions against investment band for the scale.

### Governance & Risk Coverage
- Require at least one mitigated risk per critical assumption.
- Confirm stage gates cover key milestones (initiation, build, launch at
minimum).
- Check QA plan & governance sections for mandatory artifacts by template.

### Execution Alignment
- Match workstreams to top strategic priorities (string similarity + ontology
synonyms).
- Ensure benefits realization references customer segments/revenue streams
identified in analysis.
- Penalize if decision priorities are missing from workstreams or KPIs.

---

## Warning Codes

Each dimension emits warnings when rules trip. Example codes:

- `TL-OVERRUN` – Timeline exceeds inferred range.
- `RS-ROLE-GAP` – Critical role missing for initiative type.
- `FI-BUDGET-MISMATCH` – Budget misaligned with derived cost baseline.
- `GV-MISSING-GATE` – Stage gate sequence incomplete.
- `EA-PRIORITY-DROP` – Strategic priority not mapped to any execution item.

Warnings carry human-readable explanations so the UI can show actionable
guidance.

---

## Persistence & API

- Stored with strategy versions and EPM programs (`realismScore` JSON +
`realismOverall` decimal).
- Returned in API responses immediately after synthesis.
- Background jobs log the final score to aid monitoring.

---

## Future Enhancements

- Incorporate historical execution data for calibrated thresholds.
- Add Monte Carlo stress tests to augment the timeline dimension.
- Allow admin-configurable weighting per organization or initiative type.