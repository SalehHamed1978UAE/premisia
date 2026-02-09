# Strategic Consultant v2 Migration Spec

## Executive Summary

Rebuild Strategic Consultant using Journey Builder as the unified EPM generation engine. This eliminates the dual-codebase problem where fixes must be applied in two places.

---

## Current Architecture (BROKEN)

```
User Input
    │
    ├──► Strategic Consultant ──► EPMConverter ──► Export
    │         (legacy code)        (no validators)
    │
    └──► Journey Builder ──► EPMSynthesizer ──► Export
              (new code)      (validators, normalizers, quality gates)
```

**Problem:** Two completely separate code paths. Fixes to Journey Builder don't apply to Strategic Consultant.

---

## Target Architecture (UNIFIED)

```
User Input
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│              STRATEGIC CONSULTANT V2                         │
│              (Entry Wizard Only)                             │
│                                                              │
│  - Gathers business context                                  │
│  - Runs strategic analysis (Five Whys, SWOT, etc.)          │
│  - Saves StrategicUnderstanding                             │
│  - Selects appropriate Journey Template                      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│              JOURNEY BUILDER ENGINE                          │
│              (ALL EPM Generation)                            │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Workstream  │  │   FTE       │  │  Industry   │         │
│  │ Generator   │  │ Normalizer  │  │  Validator  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Benefits   │  │ Confidence  │  │  Quality    │         │
│  │ Transformer │  │  Calculator │  │   Gates     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  ┌─────────────────────────────────────────────────┐       │
│  │              Export Service                      │       │
│  │   (CSV, Excel, PDF, DOCX - all unified)         │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│              JOURNEY TEMPLATES                               │
│              (Pre-configured Presets)                        │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Standard   │  │   BMC       │  │  Digital    │         │
│  │   EPM       │  │  Journey    │  │ Transform   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Product    │  │   Market    │  │   Custom    │         │
│  │  Launch     │  │  Expansion  │  │  (User-built)│        │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Preparation (Do First)

### Task 1.1: Rename Legacy Strategic Consultant

**Files to rename:**
```
server/strategic-consultant/           → server/strategic-consultant-legacy/
server/routes/strategic-consultant.ts  → server/routes/strategic-consultant-legacy.ts
```

**Update imports in:**
- `server/routes.ts` or `server/index.ts`
- Any files importing from `strategic-consultant/`

**Keep it working** - just renamed. Users can still access it at `/api/strategic-consultant-legacy/`

### Task 1.2: Create V2 Directory Structure

```
server/
├── strategic-consultant-legacy/    # Old code (untouched)
│   ├── epm-converter.ts
│   ├── epm-integrator.ts
│   └── ...
│
├── strategic-consultant-v2/        # NEW - thin wrapper
│   ├── index.ts                    # Main entry point
│   ├── context-gatherer.ts         # Strategic analysis (reuse existing)
│   ├── journey-selector.ts         # Maps context to journey template
│   └── types.ts
│
└── journey/                        # Existing Journey Builder
    ├── journey-executor.ts         # Already exists
    ├── journey-registry.ts         # Already exists
    └── templates/                  # NEW - predefined journeys
        ├── standard-epm.ts
        ├── bmc-journey.ts
        ├── digital-transformation.ts
        ├── product-launch.ts
        └── market-expansion.ts
```

---

## Phase 2: Journey Templates

### Task 2.1: Define Template Interface

**File:** `server/journey/templates/template-types.ts`

```typescript
export interface JourneyTemplate {
  id: string;
  name: string;
  description: string;

  // Which strategic analysis frameworks to run
  analysisFrameworks: ('five_whys' | 'swot' | 'pestle' | 'porters' | 'bmc')[];

  // Which EPM modules to generate
  epmModules: EPMModuleConfig[];

  // Industry-specific settings
  industryHints?: string[];

  // Default timeline range
  defaultTimeline?: { min: number; max: number };

  // Default budget range
  defaultBudget?: { min: number; max: number };
}

export interface EPMModuleConfig {
  moduleId: string;
  required: boolean;
  customPrompt?: string;
}
```

### Task 2.2: Create Standard EPM Template

**File:** `server/journey/templates/standard-epm.ts`

```typescript
import type { JourneyTemplate } from './template-types';

export const standardEPMTemplate: JourneyTemplate = {
  id: 'standard-epm',
  name: 'Standard EPM Journey',
  description: 'Full strategic analysis to EPM program generation',

  analysisFrameworks: ['five_whys', 'swot'],

  epmModules: [
    { moduleId: 'executive-summary', required: true },
    { moduleId: 'workstreams', required: true },
    { moduleId: 'timeline', required: true },
    { moduleId: 'resource-plan', required: true },
    { moduleId: 'financial-plan', required: true },
    { moduleId: 'risk-register', required: true },
    { moduleId: 'benefits-realization', required: true },
    { moduleId: 'kpis', required: true },
    { moduleId: 'stage-gates', required: true },
    { moduleId: 'stakeholder-map', required: true },
    { moduleId: 'governance', required: true },
    { moduleId: 'qa-plan', required: true },
    { moduleId: 'procurement', required: true },
    { moduleId: 'exit-strategy', required: true },
  ],

  defaultTimeline: { min: 6, max: 18 },
  defaultBudget: { min: 100000, max: 2000000 },
};
```

### Task 2.3: Create BMC Journey Template

**File:** `server/journey/templates/bmc-journey.ts`

```typescript
import type { JourneyTemplate } from './template-types';

export const bmcJourneyTemplate: JourneyTemplate = {
  id: 'bmc-journey',
  name: 'Business Model Canvas Journey',
  description: 'BMC-focused analysis leading to strategic execution plan',

  analysisFrameworks: ['bmc', 'swot'],

  epmModules: [
    { moduleId: 'executive-summary', required: true },
    { moduleId: 'workstreams', required: true },
    { moduleId: 'value-proposition', required: true },  // BMC-specific
    { moduleId: 'customer-segments', required: true },  // BMC-specific
    { moduleId: 'channels', required: true },           // BMC-specific
    { moduleId: 'revenue-streams', required: true },    // BMC-specific
    { moduleId: 'timeline', required: true },
    { moduleId: 'resource-plan', required: true },
    { moduleId: 'financial-plan', required: true },
    { moduleId: 'risk-register', required: true },
    { moduleId: 'kpis', required: true },
  ],

  defaultTimeline: { min: 3, max: 12 },
};
```

### Task 2.4: Create Other Templates

Create similar templates for:
- `digital-transformation.ts`
- `product-launch.ts`
- `market-expansion.ts`
- `process-improvement.ts`

Each template specifies which frameworks and modules are relevant.

---

## Phase 3: Strategic Consultant V2 Implementation

### Task 3.1: Main Entry Point

**File:** `server/strategic-consultant-v2/index.ts`

```typescript
import { ContextGatherer } from './context-gatherer';
import { JourneySelector } from './journey-selector';
import { journeyExecutor } from '../journey/journey-executor';
import { templateRegistry } from '../journey/templates';
import type { StrategicContext, EPMProgram } from '../types';

export class StrategicConsultantV2 {
  private contextGatherer: ContextGatherer;
  private journeySelector: JourneySelector;

  constructor() {
    this.contextGatherer = new ContextGatherer();
    this.journeySelector = new JourneySelector();
  }

  /**
   * Phase 1: Gather strategic context
   * This is the "wizard" part - understanding the business
   */
  async gatherContext(userInput: string, sessionId: string): Promise<StrategicContext> {
    // Run clarification questions
    const clarifications = await this.contextGatherer.askClarifications(userInput);

    // Run strategic analysis frameworks
    const analysis = await this.contextGatherer.runAnalysis(userInput, clarifications);

    // Save for potential reuse by other journeys
    await this.contextGatherer.saveContext(sessionId, {
      userInput,
      clarifications,
      analysis,
    });

    return {
      sessionId,
      userInput,
      clarifications,
      analysis,
      industry: analysis.detectedIndustry,
      businessType: analysis.detectedBusinessType,
    };
  }

  /**
   * Phase 2: Select and execute journey
   * This feeds into Journey Builder
   */
  async executeJourney(
    context: StrategicContext,
    templateId?: string
  ): Promise<EPMProgram> {
    // Auto-select template based on context, or use specified one
    const template = templateId
      ? templateRegistry.get(templateId)
      : this.journeySelector.selectBestTemplate(context);

    console.log(`[SC-V2] Using template: ${template.name}`);
    console.log(`[SC-V2] Industry detected: ${context.industry}`);

    // Convert strategic context to journey input format
    const journeyInput = this.convertToJourneyInput(context, template);

    // Execute through Journey Builder (unified pipeline)
    // This automatically runs:
    // - Workstream generation
    // - FTE normalization
    // - Industry validation
    // - Confidence calculation
    // - Benefits transformation
    // - Quality gates
    const epm = await journeyExecutor.execute(journeyInput);

    return epm;
  }

  /**
   * Full flow: Gather context + Execute journey
   */
  async run(userInput: string, sessionId: string, templateId?: string): Promise<EPMProgram> {
    const context = await this.gatherContext(userInput, sessionId);
    return this.executeJourney(context, templateId);
  }

  private convertToJourneyInput(context: StrategicContext, template: JourneyTemplate) {
    return {
      sessionId: context.sessionId,
      templateId: template.id,
      businessContext: {
        description: context.userInput,
        industry: context.industry,
        businessType: context.businessType,
        clarifications: context.clarifications,
      },
      analysisResults: context.analysis,
      modules: template.epmModules,
      settings: {
        timeline: template.defaultTimeline,
        budget: template.defaultBudget,
      },
    };
  }
}

export const strategicConsultantV2 = new StrategicConsultantV2();
```

### Task 3.2: Context Gatherer (Reuse Existing Logic)

**File:** `server/strategic-consultant-v2/context-gatherer.ts`

```typescript
import { FiveWhysAnalyzer } from '../intelligence/five-whys-analyzer';
import { SWOTAnalyzer } from '../intelligence/swot-analyzer';
import { BMCAnalyzer } from '../intelligence/bmc-analyzer';
import { IndustryDetector } from '../intelligence/industry-detector';
import { storage } from '../storage';

export class ContextGatherer {
  private fiveWhys: FiveWhysAnalyzer;
  private swot: SWOTAnalyzer;
  private bmc: BMCAnalyzer;
  private industryDetector: IndustryDetector;

  constructor() {
    this.fiveWhys = new FiveWhysAnalyzer();
    this.swot = new SWOTAnalyzer();
    this.bmc = new BMCAnalyzer();
    this.industryDetector = new IndustryDetector();
  }

  async askClarifications(userInput: string): Promise<ClarificationAnswers> {
    // Reuse existing clarification logic
    // This generates smart questions based on input
    // Returns user's answers
  }

  async runAnalysis(userInput: string, clarifications: ClarificationAnswers): Promise<AnalysisResults> {
    // Detect industry FIRST - critical for avoiding contamination
    const industry = await this.industryDetector.detect(userInput, clarifications);

    console.log(`[ContextGatherer] Detected industry: ${industry.primary}`);
    console.log(`[ContextGatherer] Industry keywords: ${industry.keywords.join(', ')}`);

    // Run frameworks with industry context
    const [fiveWhysResult, swotResult] = await Promise.all([
      this.fiveWhys.analyze(userInput, { industry: industry.primary }),
      this.swot.analyze(userInput, { industry: industry.primary }),
    ]);

    return {
      fiveWhys: fiveWhysResult,
      swot: swotResult,
      detectedIndustry: industry.primary,
      industryKeywords: industry.keywords,
      detectedBusinessType: industry.businessType,
    };
  }

  async saveContext(sessionId: string, context: any): Promise<void> {
    await storage.saveStrategicContext(sessionId, context);
  }
}
```

### Task 3.3: Journey Selector

**File:** `server/strategic-consultant-v2/journey-selector.ts`

```typescript
import { templateRegistry } from '../journey/templates';
import type { StrategicContext, JourneyTemplate } from '../types';

export class JourneySelector {
  /**
   * Auto-select the best journey template based on context
   */
  selectBestTemplate(context: StrategicContext): JourneyTemplate {
    const { industry, businessType, analysis } = context;

    // Business model focused → BMC Journey
    if (this.isBMCFocused(context)) {
      return templateRegistry.get('bmc-journey');
    }

    // Digital/tech focused → Digital Transformation
    if (this.isDigitalFocused(context)) {
      return templateRegistry.get('digital-transformation');
    }

    // New product mentioned → Product Launch
    if (this.isProductLaunch(context)) {
      return templateRegistry.get('product-launch');
    }

    // Geographic expansion → Market Expansion
    if (this.isMarketExpansion(context)) {
      return templateRegistry.get('market-expansion');
    }

    // Default → Standard EPM
    return templateRegistry.get('standard-epm');
  }

  private isBMCFocused(context: StrategicContext): boolean {
    const keywords = ['business model', 'revenue stream', 'value proposition', 'customer segment'];
    return keywords.some(kw => context.userInput.toLowerCase().includes(kw));
  }

  private isDigitalFocused(context: StrategicContext): boolean {
    const keywords = ['digital', 'software', 'app', 'platform', 'automation', 'ai', 'technology'];
    return keywords.some(kw => context.userInput.toLowerCase().includes(kw));
  }

  private isProductLaunch(context: StrategicContext): boolean {
    const keywords = ['launch', 'new product', 'release', 'introduce', 'go to market'];
    return keywords.some(kw => context.userInput.toLowerCase().includes(kw));
  }

  private isMarketExpansion(context: StrategicContext): boolean {
    const keywords = ['expand', 'new market', 'international', 'geographic', 'new region', 'enter'];
    return keywords.some(kw => context.userInput.toLowerCase().includes(kw));
  }
}
```

---

## Phase 4: API Routes

### Task 4.1: Create V2 Routes

**File:** `server/routes/strategic-consultant-v2.ts`

```typescript
import { Router } from 'express';
import { strategicConsultantV2 } from '../strategic-consultant-v2';
import { templateRegistry } from '../journey/templates';

const router = Router();

/**
 * POST /api/strategic-consultant-v2/start
 * Begin a new strategic consultation
 */
router.post('/start', async (req, res) => {
  try {
    const { userInput, sessionId } = req.body;

    // Phase 1: Gather context
    const context = await strategicConsultantV2.gatherContext(userInput, sessionId);

    res.json({
      success: true,
      sessionId: context.sessionId,
      detectedIndustry: context.industry,
      suggestedTemplate: context.suggestedTemplate,
      availableTemplates: templateRegistry.list(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/strategic-consultant-v2/execute
 * Execute journey and generate EPM
 */
router.post('/execute', async (req, res) => {
  try {
    const { sessionId, templateId } = req.body;

    // Load saved context
    const context = await storage.getStrategicContext(sessionId);

    // Execute through Journey Builder
    const epm = await strategicConsultantV2.executeJourney(context, templateId);

    res.json({
      success: true,
      programId: epm.id,
      summary: {
        workstreams: epm.workstreams.length,
        totalBudget: epm.financialPlan.totalBudget,
        timeline: epm.timeline.totalMonths,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/strategic-consultant-v2/run
 * Full flow: context gathering + journey execution in one call
 */
router.post('/run', async (req, res) => {
  try {
    const { userInput, sessionId, templateId } = req.body;

    const epm = await strategicConsultantV2.run(userInput, sessionId, templateId);

    res.json({
      success: true,
      programId: epm.id,
      program: epm,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/strategic-consultant-v2/templates
 * List available journey templates
 */
router.get('/templates', (req, res) => {
  res.json({
    templates: templateRegistry.list().map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
    })),
  });
});

export default router;
```

### Task 4.2: Register V2 Routes

**File:** `server/routes.ts` or `server/index.ts`

```typescript
import strategicConsultantV2Routes from './routes/strategic-consultant-v2';
import strategicConsultantLegacyRoutes from './routes/strategic-consultant-legacy';

// Keep legacy for now (side-by-side)
app.use('/api/strategic-consultant-legacy', strategicConsultantLegacyRoutes);

// New V2 routes
app.use('/api/strategic-consultant-v2', strategicConsultantV2Routes);

// Eventually, point main route to V2:
// app.use('/api/strategic-consultant', strategicConsultantV2Routes);
```

---

## Phase 5: Frontend Updates

### Task 5.1: Create V2 Strategic Consultant Page

Create a new page that uses the V2 API:
- `/strategic-consultant-v2` route
- Shows template selection after context gathering
- Uses same export UI (already unified)

### Task 5.2: Add Navigation Toggle

During transition, allow users to switch between:
- "Strategic Consultant (New)" → V2
- "Strategic Consultant (Legacy)" → Old

This is temporary until V2 is fully validated.

---

## Phase 6: Validation & Cutover

### Task 6.1: Test Cases

Run these test cases through V2 and verify:

| Test Case | Expected Result |
|-----------|-----------------|
| Sneaker store in Abu Dhabi | NO food safety workstreams |
| Restaurant business | HAS food safety workstreams |
| Software startup | HAS technology workstreams, NO manufacturing |
| Manufacturing plant | HAS operations workstreams |

### Task 6.2: Quality Checklist

Before cutover, verify V2 produces:

- [ ] FTE values as decimals (1.0, 0.8, not 100, 80)
- [ ] Benefits with names and measurable targets
- [ ] Workstream confidence that varies (not all 85%)
- [ ] Industry-appropriate workstreams (no contamination)
- [ ] Quality gate logs in console
- [ ] Valid dependency chains
- [ ] Proper risk mitigations (not generic)
- [ ] Measurable KPI targets (not "Improvement")

### Task 6.3: Cutover Steps

Once V2 passes all tests:

1. **Update main route:**
   ```typescript
   app.use('/api/strategic-consultant', strategicConsultantV2Routes);
   ```

2. **Hide legacy in UI:**
   - Remove "Strategic Consultant (Legacy)" from navigation
   - Keep backend routes for any saved sessions

3. **Monitor for 1-2 weeks:**
   - Check error logs
   - Verify export quality
   - Get user feedback

4. **Deprecate legacy code:**
   - Add deprecation warnings
   - Plan removal in next major version

---

## File Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `server/strategic-consultant-v2/index.ts` | Main SC V2 class |
| `server/strategic-consultant-v2/context-gatherer.ts` | Strategic analysis |
| `server/strategic-consultant-v2/journey-selector.ts` | Template auto-selection |
| `server/strategic-consultant-v2/types.ts` | Type definitions |
| `server/journey/templates/template-types.ts` | Template interface |
| `server/journey/templates/standard-epm.ts` | Standard EPM template |
| `server/journey/templates/bmc-journey.ts` | BMC journey template |
| `server/journey/templates/digital-transformation.ts` | Digital transform template |
| `server/journey/templates/product-launch.ts` | Product launch template |
| `server/journey/templates/market-expansion.ts` | Market expansion template |
| `server/journey/templates/index.ts` | Template registry |
| `server/routes/strategic-consultant-v2.ts` | V2 API routes |

### Files to Rename

| From | To |
|------|-----|
| `server/strategic-consultant/` | `server/strategic-consultant-legacy/` |
| `server/routes/strategic-consultant.ts` | `server/routes/strategic-consultant-legacy.ts` |

### Files to Modify

| File | Change |
|------|--------|
| `server/routes.ts` | Add V2 routes, rename legacy routes |
| `server/index.ts` | Register new routes |
| Frontend routing | Add V2 page, navigation toggle |

---

## Timeline Estimate

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: Preparation | Rename legacy, create structure | Day 1 |
| Phase 2: Templates | Define 5-6 journey templates | Day 1-2 |
| Phase 3: V2 Implementation | Core logic, context gatherer, selector | Day 2-3 |
| Phase 4: API Routes | V2 routes, integration | Day 3 |
| Phase 5: Frontend | V2 page, navigation | Day 4 |
| Phase 6: Validation | Testing, cutover | Day 5 |

**Total: ~5 days** for a careful, tested migration.

---

## Success Criteria

V2 is ready for cutover when:

1. **Zero contamination:** Sneaker store has no food safety
2. **All validators running:** Industry, dependency, completeness
3. **All normalizers applied:** FTE decimals, benefit targets
4. **Quality gates pass:** Console shows gate results
5. **Same or better UX:** Users don't notice regression
6. **All templates working:** Standard, BMC, Digital, etc.

---

## Rollback Plan

If V2 has critical issues after cutover:

1. Point `/api/strategic-consultant` back to legacy routes
2. Legacy code is untouched and still works
3. Fix V2 issues
4. Re-cutover when ready

Legacy stays in codebase until V2 is stable for 2+ weeks.
