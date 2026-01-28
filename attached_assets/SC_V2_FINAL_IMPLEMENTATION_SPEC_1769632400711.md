# Strategic Consultant V2 – Final Implementation Spec
## Aligned Across All Models

---

## BLOCKER: Fix StreamOptimizer First

**Before ANY other work, fix this file:**

**File:** `src/lib/intelligent-planning/wbs-builder/optimizers/stream-optimizer.ts`

**Changes:**
1. Add `${context.business.industry}` to the prompt
2. Remove the hardcoded coffee shop example (lines ~116-124)
3. Add instruction: "Do NOT include food safety, health inspections, or restaurant content unless the business is actually in the food industry"

**Test:** Run Sneaker Store → No "food safety" in workstreams

**This unblocks everything else.**

---

## Part I: File Structure

```
server/journey/
├── types.ts                        # Interfaces (JourneyTemplate, JourneyModule, etc.)
├── journey-registry.ts             # Imports templates, exposes getTemplateById()
├── module-registry.ts              # Imports modules, exposes getModuleById()
├── journey-builder.ts              # Executor: executeTemplate(templateId, context)
│
├── templates/
│   ├── bmi.ts                      # BMI journey template definition
│   └── market-entry.ts             # Market Entry journey template definition
│
└── modules/
    ├── shared/                     # Used by multiple journeys
    │   ├── five-whys.ts
    │   ├── strategic-decisions.ts
    │   ├── strategic-priorities.ts
    │   └── epm-generation.ts
    │
    ├── bmi/                        # BMI-specific modules
    │   ├── strategic-research.ts
    │   ├── bmc-9box.ts
    │   └── bmc-detailed.ts
    │
    └── market-entry/               # Market Entry-specific modules
        ├── pestle-analysis.ts
        ├── porters-analysis.ts
        └── swot-summary.ts
```

---

## Part II: Template Definitions

### Template A: Business Model Innovation (BMI)

```typescript
// server/journey/templates/bmi.ts

export const bmiTemplate = {
  id: 'bmi',
  name: 'Business Model Innovation',
  description: 'Analyze and design your business model using the BMC framework',
  
  modules: [
    { moduleId: 'five-whys',            order: 1 },
    { moduleId: 'strategic-research',   order: 2 },
    { moduleId: 'bmc-9box',             order: 3 },  // 9-box grid visualization
    { moduleId: 'bmc-detailed',         order: 4 },
    { moduleId: 'strategic-decisions',  order: 5 },
    { moduleId: 'strategic-priorities', order: 6 },
    { moduleId: 'epm-generation',       order: 7 },
  ]
};
```

**Flow:**
```
Five Whys → Research → 9-Box BMC → Detailed BMC → Decisions → Priorities → EPM
```

---

### Template B: Market Entry Strategy

```typescript
// server/journey/templates/market-entry.ts

export const marketEntryTemplate = {
  id: 'market-entry',
  name: 'Market Entry Strategy',
  description: 'Plan your entry into a new market or geography',
  
  modules: [
    { moduleId: 'strategic-research',   order: 1 },
    { moduleId: 'pestle-analysis',      order: 2 },
    { moduleId: 'porters-analysis',     order: 3 },
    { moduleId: 'swot-summary',         order: 4 },
    { moduleId: 'strategic-decisions',  order: 5 },
    { moduleId: 'strategic-priorities', order: 6 },
    { moduleId: 'epm-generation',       order: 7 },
  ]
};
```

**Flow:**
```
Research → PESTLE → Porters → SWOT → Decisions → Priorities → EPM
```

---

## Part III: Journey Registry

```typescript
// server/journey/journey-registry.ts

import { bmiTemplate } from './templates/bmi';
import { marketEntryTemplate } from './templates/market-entry';

const templates = new Map([
  ['bmi', bmiTemplate],
  ['market-entry', marketEntryTemplate],
]);

export function getTemplateById(id: string) {
  return templates.get(id);
}

export function listTemplates() {
  return Array.from(templates.values());
}
```

---

## Part IV: Journey Builder (Executor)

```typescript
// server/journey/journey-builder.ts

import { getTemplateById } from './journey-registry';
import { getModuleById } from './module-registry';

export async function executeTemplate(templateId: string, context: StrategicContext) {
  
  // 1. Load template
  const template = getTemplateById(templateId);
  if (!template) throw new Error(`Template not found: ${templateId}`);
  
  console.log(`[JourneyBuilder] Executing template: ${template.name}`);
  
  // 2. Execute modules in order
  const results = {};
  let previousOutput = context;
  
  for (const moduleConfig of template.modules.sort((a, b) => a.order - b.order)) {
    
    const module = getModuleById(moduleConfig.moduleId);
    if (!module) throw new Error(`Module not found: ${moduleConfig.moduleId}`);
    
    console.log(`[JourneyBuilder] Running module: ${module.name}`);
    
    const output = await module.execute({
      context,           // Always includes context.business.industry
      previousOutput
    });
    
    results[moduleConfig.moduleId] = output;
    previousOutput = output;
  }
  
  // 3. Return all module outputs
  return results;
}
```

---

## Part V: Strategic Consultant V2 Controller

### What It Does

1. Gathers context (existing flow - DO NOT CHANGE)
2. Recommends a journey template
3. User selects a template
4. Calls `executeTemplate(templateId, context)`

### Controller Code

```typescript
// In strategic consultant route

router.post('/execute-journey', async (req, res) => {
  const { sessionId, templateId } = req.body;
  
  // Load context from session
  const context = await getStrategicContext(sessionId);
  
  // Execute the selected template (BMI, Market Entry, or any future template)
  // DO NOT hardcode 'bmi' here - use whatever templateId was passed
  const results = await executeTemplate(templateId, context);
  
  res.json({
    success: true,
    templateId,
    results
  });
});
```

### Critical Rule

**The controller must NOT mention 'bmi' explicitly.** It receives `templateId` and passes it to the executor. This ensures any future template works without code changes.

---

## Part VI: UI Requirements

### UI Must Stay Identical

The user experience does not change:

1. Strategic Input → User describes business
2. Ambiguity Detection → System asks clarifying questions
3. Business Identification → System identifies type/industry/scale
4. Journey Recommendation → System recommends template, user can override
5. Module Execution → Each module renders its UI in sequence
6. Export → User downloads outputs

### 9-Box BMC Must Appear

**CRITICAL:** The BMC 9-box grid visualization must appear exactly as before when running the BMI journey. This is not optional.

```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ Key         │ Key         │ Value       │ Customer    │ Customer    │
│ Partners    │ Activities  │ Propositions│ Relationships│ Segments   │
├─────────────┼─────────────┼─────────────┼─────────────┼─────────────┤
│             │ Key         │             │ Channels    │             │
│             │ Resources   │             │             │             │
├─────────────┴─────────────┴─────────────┴─────────────┴─────────────┤
│ Cost Structure                    │ Revenue Streams                 │
└───────────────────────────────────┴─────────────────────────────────┘
```

---

## Part VII: Evidence Checkpoints

### Checkpoint 1: Template Registry

**Provide:** `registry.ts` showing both BMI and Market Entry template entries

**Verify:** 
```
getTemplateById('bmi') → returns BMI template
getTemplateById('market-entry') → returns Market Entry template
listTemplates() → returns array with 2 templates
```

---

### Checkpoint 2: Template Executor Logs

**Provide:** Server console log showing:
```
[JourneyBuilder] Executing template: Business Model Innovation
[JourneyBuilder] Running module: Five Whys
[JourneyBuilder] Running module: Strategic Research
[JourneyBuilder] Running module: BMC 9-Box
...

[JourneyBuilder] Executing template: Market Entry Strategy
[JourneyBuilder] Running module: Strategic Research
[JourneyBuilder] Running module: PESTLE Analysis
[JourneyBuilder] Running module: Porters Analysis
...
```

---

### Checkpoint 3: UI Proof

**Provide:** Video or screenshots showing:
- [ ] Strategic input screen
- [ ] Ambiguity detection questions
- [ ] Business identification confirmation
- [ ] Journey recommendation with dropdown showing BMI + Market Entry
- [ ] Five Whys tree rendering
- [ ] **BMC 9-box grid** (critical)
- [ ] BMC detailed view
- [ ] Decisions page
- [ ] Priorities page
- [ ] EPM/Export page

---

### Checkpoint 4: Sneaker Store Journey (BMI)

**Run:** "Open a sneaker store in Abu Dhabi" through BMI journey

**Provide these files:**

| File | Check |
|------|-------|
| `workstreams.csv` | NO "food safety", "food service", "kitchen", "health inspection" |
| `resources.csv` | FTE as decimals: `1.0`, `0.8`, `0.75` (not `100`, `80`, `75`) |
| `benefits.csv` | Benefits have names (not "Unnamed") and targets (not "-") |
| `epm.json` | Confidence varies (not all `0.85`) |
| Console log | Shows `[QualityGate] passed ...` |

---

### Checkpoint 5: Market Entry Journey

**Run:** Any business through Market Entry journey

**Provide:**
- [ ] Screenshot showing PESTLE analysis output
- [ ] Screenshot showing Porters analysis output
- [ ] Screenshot showing SWOT summary
- [ ] Exported files proving the template executed end-to-end

---

## Part VIII: Quality Requirements

All outputs (from both BMI and Market Entry) must:

1. **Industry-appropriate content** — No contamination (sneaker store ≠ food safety)
2. **Decimal FTE values** — `1.0`, `0.8`, not `100`, `80`
3. **Named benefits** — Not "Unnamed benefit"
4. **Measurable targets** — Not "-"
5. **Varied confidence** — Not all `0.85`
6. **Quality gate logs** — Console shows gate results before export

---

## Summary: What Strategic Consultant Does

After this implementation, Strategic Consultant has exactly TWO jobs:

1. **Gather context and recommend a journey**
2. **Dispatch to whatever template was chosen**

Everything else — module execution, validation, exports — happens in the Journey Builder pipeline.

---

## Task Sequence

| Order | Task | Blocker? |
|-------|------|----------|
| 0 | Fix StreamOptimizer prompt | **YES - DO FIRST** |
| 1 | Create `types.ts` | No |
| 2 | Create `journey-registry.ts` | No |
| 3 | Create `module-registry.ts` | No |
| 4 | Create `journey-builder.ts` | No |
| 5 | Create `templates/bmi.ts` | No |
| 6 | Create `templates/market-entry.ts` | No |
| 7 | Wrap existing modules (Five Whys, BMC, etc.) | No |
| 8 | Create Market Entry modules (PESTLE, Porters, SWOT) | Can be stubs |
| 9 | Wire Strategic Consultant to Journey Builder | No |
| 10 | Test BMI journey (Sneaker Store) | No |
| 11 | Test Market Entry journey | No |
| 12 | Provide evidence at all checkpoints | No |

---

*End of Specification*
*All models aligned*
