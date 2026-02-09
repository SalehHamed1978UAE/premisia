# EPM Standard Path Fixes - Replit Instructions
## Patch Legacy EPM Converter to Match New Pipeline Quality

**Context:** The new/custom journey pipeline has quality fixes working. The standard Strategic Consultant path (EPM Converter) still outputs raw values. These fixes align both paths.

---

## TASK LIST

| # | Task | File | Test |
|---|------|------|------|
| 1 | Normalize FTE values | epm-converter.ts | resources.csv shows 1.0 not 100 |
| 2 | Transform benefits | epm-converter.ts | benefits.csv has names and targets |
| 3 | Vary confidence | epm-converter.ts | Timeline shows varied % |
| 4 | Run quality gates | epm-converter.ts | Log shows gate results |

---

## FIX 1: Normalize FTE Values

### File
`server/intelligence/epm-converter.ts` (or equivalent for Strategic Consultant path)

### Find
The section that builds `resourcePlan` or writes `resources.csv`

### Add Import
```typescript
import { normalizeResourceFTEs } from './normalizers/fte-normalizer';
```

### Add Code (before serializing resources)
```typescript
// Normalize FTE values before export
if (resourcePlan.internalTeam) {
  const { normalized, fixes } = normalizeResourceFTEs(resourcePlan.internalTeam);
  if (fixes.length) {
    console.log('[EPM Converter] FTE normalization fixes:', fixes);
  }
  resourcePlan.internalTeam = normalized;
}

if (resourcePlan.externalResources) {
  const { normalized: extNormalized, fixes: extFixes } = normalizeResourceFTEs(
    resourcePlan.externalResources.map(r => ({ role: r.type, fteAllocation: r.quantity || 1, ...r }))
  );
  if (extFixes.length) {
    console.log('[EPM Converter] External FTE fixes:', extFixes);
  }
  resourcePlan.externalResources = extNormalized;
}
```

### Test
```bash
# After running standard journey, check:
cat data/resources.csv | grep -E ",[0-9]+$"
# Should see: 1.0, 0.8, 0.75 — NOT 100, 80, 75
```

### Evidence Required
- [ ] Attach `resources.csv` showing decimal FTE values

---

## FIX 2: Transform Benefits (No More "Unnamed" or "-")

### File
`server/intelligence/epm-converter.ts` (benefits section)

### Find
Where `benefitsRealization.benefits` array is built

### Current Problem
```typescript
// Benefits only have description, no name or target:
{
  id: "B001",
  description: "Sneaker Resale Market Growth",
  category: "Strategic",
  // MISSING: name
  // MISSING: target
}
```

### Add Method
```typescript
private transformBenefit(rawBenefit: any, index: number): any {
  const description = rawBenefit.description || rawBenefit.content || '';
  
  // Generate measurable target based on category/description
  let target = '+15% improvement within 12 months';
  const descLower = description.toLowerCase();
  
  if (descLower.includes('revenue') || descLower.includes('sales')) {
    target = '+20% revenue increase by end of Year 1';
  } else if (descLower.includes('market') || descLower.includes('growth')) {
    target = '+5% market share gain within 18 months';
  } else if (descLower.includes('cost') || descLower.includes('efficiency')) {
    target = '15% cost reduction by Month 12';
  } else if (descLower.includes('customer') || descLower.includes('satisfaction')) {
    target = 'NPS score increase to 50+ within 6 months';
  } else if (descLower.includes('partnership') || descLower.includes('integration')) {
    target = '3+ strategic partnerships established by Month 9';
  }

  return {
    ...rawBenefit,
    id: rawBenefit.id || `BEN-${index + 1}`,
    name: description,  // Use description as name
    description: description,
    target: target,
    category: rawBenefit.category || 'Strategic',
    measurement: rawBenefit.measurement || 'Quarterly review',
    realizationMonth: rawBenefit.realizationMonth || 6
  };
}
```

### Apply Transform
```typescript
// Where benefits are generated/assembled:
const transformedBenefits = rawBenefits.map((b, i) => this.transformBenefit(b, i));
benefitsRealization.benefits = transformedBenefits;
```

### Test
```bash
cat data/benefits.csv
# Should see actual names and targets, not "Unnamed benefit" and "-"
```

### Evidence Required
- [ ] Attach `benefits.csv` showing populated names and targets

---

## FIX 3: Remove "85% Everywhere" Fallback

### File
`server/intelligence/epm-converter.ts` (workstream generation)

### Find
Where `workstream.confidence` is set (often hardcoded to 0.85)

### Current Problem
```typescript
confidence: 0.85  // Same for all workstreams
```

### Replace With
```typescript
private calculateWorkstreamConfidence(workstream: any, index: number, total: number): number {
  // Base confidence varies by position in sequence
  const positionFactor = index / total;  // 0.0 to 1.0
  
  // Earlier workstreams (foundation) have higher confidence
  // Later workstreams (dependent on more) have lower confidence
  let baseConfidence = 0.85 - (positionFactor * 0.15);  // 0.85 → 0.70
  
  // Adjust based on dependencies
  const depCount = workstream.dependencies?.length || 0;
  baseConfidence -= depCount * 0.02;  // More deps = slightly lower confidence
  
  // Adjust based on duration
  const duration = (workstream.endMonth || 1) - (workstream.startMonth || 1);
  if (duration > 3) baseConfidence -= 0.05;  // Long workstreams are riskier
  
  // Clamp to reasonable range
  return Math.max(0.60, Math.min(0.90, Math.round(baseConfidence * 100) / 100));
}
```

### Apply
```typescript
// When building each workstream:
workstreams.map((ws, index) => ({
  ...ws,
  confidence: this.calculateWorkstreamConfidence(ws, index, workstreams.length)
}));
```

### Test
```bash
cat data/epm.json | grep '"confidence"' | head -10
# Should see varied values: 0.85, 0.80, 0.75, 0.78, etc.
```

### Evidence Required
- [ ] Screenshot of timeline/gantt showing varied confidence percentages
- [ ] Or JSON snippet showing different confidence values per workstream

---

## FIX 4: Run Quality Gates on Standard Path

### File
`server/intelligence/epm-converter.ts` (after EPM assembly, before export)

### Add Import
```typescript
import { runQualityGates } from './quality-gates';
```

### Add Code (after program is assembled, before export)
```typescript
// Run quality gates before export
const qualityResult = runQualityGates({
  industry: context.industry || 'general',
  workstreams: program.workstreams.map(ws => ({
    id: ws.id,
    name: ws.name,
    description: ws.description || '',
    startMonth: ws.startMonth,
    endMonth: ws.endMonth,
    dependencies: ws.dependencies || [],
    deliverables: ws.deliverables,
    resources: ws.resources
  })),
  riskRegister: program.riskRegister?.risks,
  kpis: program.kpis?.kpis
});

console.log('[EPM Converter] Quality Gate Results:', {
  passed: qualityResult.passed,
  score: qualityResult.score,
  blockers: qualityResult.blockers.length,
  warnings: qualityResult.warnings.length,
  fixes: qualityResult.fixes.length
});

if (qualityResult.blockers.length > 0) {
  console.warn('[EPM Converter] Quality blockers:', qualityResult.blockers);
}

if (qualityResult.warnings.length > 0) {
  console.log('[EPM Converter] Quality warnings:', qualityResult.warnings);
}
```

### Test
Run a standard journey and check console output for quality gate log.

### Evidence Required
- [ ] Log snippet showing quality gate results from standard journey

---

## VERIFICATION CHECKLIST

After all fixes, re-run a standard (Strategic Consultant) journey and verify:

- [ ] **resources.csv** - FTE values are decimals (1.0, 0.8, 0.75)
- [ ] **benefits.csv** - Has names (not "Unnamed") and targets (not "-")
- [ ] **Timeline/JSON** - Confidence varies per workstream (not all 85%)
- [ ] **Console log** - Shows quality gate results
- [ ] **No template contamination** - Industry-appropriate workstreams
- [ ] **No generic mitigations** - Risk mitigations are specific (already fixed)
- [ ] **Measurable KPIs** - KPI targets are quantified (already fixed)

---

## EVIDENCE TO ATTACH

1. `resources.csv` from standard journey (showing 1.0 not 100)
2. `benefits.csv` from standard journey (showing names and targets)
3. Screenshot of varied confidence in timeline
4. Console log showing quality gate output
5. (Optional) Unit test showing normalizer called in converter

---

## QUICK REFERENCE: File Locations

```
server/intelligence/
├── epm-converter.ts          ← MODIFY THIS (standard path)
├── epm-synthesizer.ts        ← Already fixed (new path)
├── normalizers/
│   └── fte-normalizer.ts     ← IMPORT FROM HERE
├── validators/
│   ├── dependency-validator.ts
│   ├── industry-validator.ts
│   └── completeness-validator.ts
└── quality-gates.ts          ← IMPORT FROM HERE
```

---

*4 Fixes | 4 Evidence Items | 30-60 minutes estimated*
