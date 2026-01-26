# REPLIT: Fix Module/Framework Synchronization

## The Problem (Read This First)

The modularization is half-done. There are THREE systems that should be in sync but aren't:

1. **Module Manifests** (code) - 18 modules defined in `server/modules/manifests/`
2. **Framework Registry** (database) - Only 7 entries seeded
3. **CustomJourneyExecutor** - Returns MOCK DATA, never calls real analyzers

When a user selects "Strategic Decisions" in Journey Builder, nothing executes because:
- There's no manifest for it
- The executor doesn't know what to do with it
- It's actually a USER PAGE, not an AI module

---

## Priority 1: Fix CustomJourneyExecutor to Call Real Analyzers

**File:** `server/services/custom-journey-executor.ts`

**Current Problem (lines 349-359):**
```typescript
private async executeImplementedModule(...) {
  await this.sleep(1500);
  return this.generateMockOutput(module.id, inputs);  // FAKE DATA!
}
```

**Fix:** Import and call the actual analyzers:

```typescript
import { swotAnalyzer } from '../intelligence/swot-analyzer';
import { bmcAnalyzer } from '../intelligence/bmc-analyzer';
import { portersAnalyzer } from '../intelligence/porters-analyzer';
import { pestleAnalyzer } from '../intelligence/pestle-analyzer';
import { ansoffAnalyzer } from '../intelligence/ansoff-analyzer';
import { blueOceanAnalyzer } from '../intelligence/blue-ocean-analyzer';
// ... import all analyzers

private async executeImplementedModule(
  module: any,
  inputs: Record<string, any>,
  nodeConfig?: Record<string, any>
): Promise<any> {
  console.log(`[CustomJourneyExecutor] Executing: ${module.id}`);

  // Map module ID to actual analyzer
  const analyzerMap: Record<string, (input: any) => Promise<any>> = {
    'swot-analyzer': (input) => swotAnalyzer.analyze({
      businessContext: input.businessContext || input.strategic_context || JSON.stringify(input),
      bmcOutput: input.bmc_output,
      portersOutput: input.porters_output,
    }),
    'bmc-analyzer': (input) => bmcAnalyzer.analyze(input),
    'porters-analyzer': (input) => portersAnalyzer.analyze(input),
    'pestle-analyzer': (input) => pestleAnalyzer.analyze(input),
    'ansoff-analyzer': (input) => ansoffAnalyzer.analyze(input),
    'blue-ocean-analyzer': (input) => blueOceanAnalyzer.analyze(input),
    // Add all other analyzers...
  };

  const analyzer = analyzerMap[module.id];
  if (!analyzer) {
    console.warn(`[CustomJourneyExecutor] No analyzer found for ${module.id}, using mock`);
    return this.generateMockOutput(module.id, inputs);
  }

  return await analyzer(inputs);
}
```

---

## Priority 2: Save Results to frameworkInsights Table

**Current Problem:** Results saved to `customJourneyExecutions.aggregatedOutputs`
**UI expects:** Data in `frameworkInsights` table

**File:** `server/services/custom-journey-executor.ts`

After executing a module, also save to frameworkInsights:

```typescript
import { db } from '../db';
import { frameworkInsights } from '@shared/schema';

// After getting module output (around line 181):
aggregatedOutputs[nodeId] = output;

// ADD THIS: Also save to frameworkInsights
await db.insert(frameworkInsights).values({
  understandingId: execution.inputData?.understandingId || executionId,
  sessionId: executionId,
  frameworkName: module.id,
  frameworkVersion: '1.0',
  insights: output,
  telemetry: {
    duration: Date.now() - startTime,
    executedAt: new Date().toISOString(),
  },
}).onConflictDoNothing();
```

---

## Priority 3: Handle User Input Steps (Strategic Decisions)

Strategic Decisions is NOT an AI module. It's a page where users make selections.

**Add module type detection:**

```typescript
// At top of file
const USER_INPUT_MODULES = [
  'strategic-decisions',
  'strategic_decisions',
  'prioritization',
];

// In the execution loop, BEFORE executing the module:
if (USER_INPUT_MODULES.includes(node.moduleId)) {
  // This is a user input step - pause and redirect

  // First, generate decision options based on previous analysis
  if (node.moduleId.includes('strategic') && node.moduleId.includes('decision')) {
    const previousOutput = this.findPreviousAnalysis(aggregatedOutputs);
    if (previousOutput) {
      const decisionGenerator = new DecisionGenerator();
      const decisions = await decisionGenerator.generateDecisionsFromAnalysis(previousOutput);
      aggregatedOutputs['generated_decisions'] = decisions;
    }
  }

  // Send SSE event to redirect user
  this.sendEvent(res, {
    type: 'user_input_required',
    data: {
      stepType: node.moduleId,
      message: 'Please make your strategic selections',
    }
  });

  // Update status and pause
  await db.update(customJourneyExecutions).set({
    status: 'awaiting_user_input',
    currentNodeId: nodeId,
    aggregatedOutputs,
  }).where(eq(customJourneyExecutions.id, executionId));

  return; // Stop execution here
}
```

---

## Priority 4: Update Framework Registry Seed

**File:** `server/journey-builder-seed.ts`

Add the missing 13 modules so users can select them:

```typescript
const FRAMEWORKS = [
  // EXISTING (keep these)
  { frameworkKey: 'strategic_understanding', name: 'Strategic Understanding', ... },
  { frameworkKey: 'five_whys', name: '5 Whys Analysis', ... },
  { frameworkKey: 'business_model_canvas', name: 'Business Model Canvas', ... },
  { frameworkKey: 'porters_five_forces', name: "Porter's Five Forces", ... },
  { frameworkKey: 'pestle', name: 'PESTLE Analysis', ... },
  { frameworkKey: 'swot', name: 'SWOT Analysis', ... },
  { frameworkKey: 'strategic_decisions', name: 'Strategic Decisions', ... },

  // ADD THESE NEW ONES
  {
    frameworkKey: 'ansoff',
    name: 'Ansoff Matrix',
    description: 'Analyze growth strategies across products and markets',
    category: 'Growth Strategy',
    estimatedDuration: 8,
    difficulty: 'intermediate' as const,
    requiredInputs: ['business_context'],
    providedOutputs: ['growth_strategies', 'risk_assessment'],
    processorPath: '/api/strategic-consultant/ansoff',
  },
  {
    frameworkKey: 'blue_ocean',
    name: 'Blue Ocean Strategy',
    description: 'Identify uncontested market space',
    category: 'Innovation',
    estimatedDuration: 10,
    difficulty: 'advanced' as const,
    requiredInputs: ['business_context', 'industry_analysis'],
    providedOutputs: ['value_innovation', 'strategy_canvas'],
    processorPath: '/api/strategic-consultant/blue-ocean',
  },
  {
    frameworkKey: 'bcg_matrix',
    name: 'BCG Matrix',
    description: 'Portfolio analysis of products/business units',
    category: 'Portfolio Management',
    estimatedDuration: 8,
    difficulty: 'intermediate' as const,
    requiredInputs: ['business_context', 'market_data'],
    providedOutputs: ['portfolio_analysis', 'investment_priorities'],
    processorPath: '/api/strategic-consultant/bcg-matrix',
  },
  {
    frameworkKey: 'value_chain',
    name: 'Value Chain Analysis',
    description: 'Analyze activities that create value',
    category: 'Operations',
    estimatedDuration: 10,
    difficulty: 'intermediate' as const,
    requiredInputs: ['business_context'],
    providedOutputs: ['value_activities', 'competitive_advantage'],
    processorPath: '/api/strategic-consultant/value-chain',
  },
  {
    frameworkKey: 'vrio',
    name: 'VRIO Analysis',
    description: 'Assess resources for competitive advantage',
    category: 'Resources',
    estimatedDuration: 8,
    difficulty: 'intermediate' as const,
    requiredInputs: ['business_context'],
    providedOutputs: ['resource_analysis', 'sustainable_advantages'],
    processorPath: '/api/strategic-consultant/vrio',
  },
  {
    frameworkKey: 'scenario_planning',
    name: 'Scenario Planning',
    description: 'Explore multiple future scenarios',
    category: 'Planning',
    estimatedDuration: 12,
    difficulty: 'advanced' as const,
    requiredInputs: ['business_context', 'macro_factors'],
    providedOutputs: ['scenarios', 'strategic_options'],
    processorPath: '/api/strategic-consultant/scenario-planning',
  },
  {
    frameworkKey: 'jobs_to_be_done',
    name: 'Jobs-to-be-Done',
    description: 'Understand customer needs and motivations',
    category: 'Customer',
    estimatedDuration: 10,
    difficulty: 'intermediate' as const,
    requiredInputs: ['business_context', 'target_segments'],
    providedOutputs: ['customer_jobs', 'opportunity_areas'],
    processorPath: '/api/strategic-consultant/jtbd',
  },
  {
    frameworkKey: 'competitive_positioning',
    name: 'Competitive Positioning',
    description: 'Define market position relative to competitors',
    category: 'Competition',
    estimatedDuration: 10,
    difficulty: 'intermediate' as const,
    requiredInputs: ['business_context', 'competitive_forces'],
    providedOutputs: ['positioning_map', 'differentiation_strategy'],
    processorPath: '/api/strategic-consultant/competitive-positioning',
  },
  {
    frameworkKey: 'segment_discovery',
    name: 'Market Segmentation',
    description: 'Discover and validate customer segments',
    category: 'Customer',
    estimatedDuration: 8,
    difficulty: 'beginner' as const,
    requiredInputs: ['offering', 'classification'],
    providedOutputs: ['segments', 'segment_profiles'],
    processorPath: '/api/marketing-consultant/discovery',
  },
  {
    frameworkKey: 'okr',
    name: 'OKR Generator',
    description: 'Generate objectives and key results',
    category: 'Execution',
    estimatedDuration: 8,
    difficulty: 'intermediate' as const,
    requiredInputs: ['strategic_analysis'],
    providedOutputs: ['objectives', 'key_results'],
    processorPath: '/api/strategic-consultant/okr',
  },
  {
    frameworkKey: 'ocean_strategy',
    name: 'Ocean Strategy Analysis',
    description: 'Combine Red and Blue Ocean strategies',
    category: 'Innovation',
    estimatedDuration: 12,
    difficulty: 'advanced' as const,
    requiredInputs: ['business_context', 'industry_analysis'],
    providedOutputs: ['ocean_strategy', 'action_framework'],
    processorPath: '/api/strategic-consultant/ocean-strategy',
  },
];
```

---

## Priority 5: Create Module ID Mapping

The registry uses `swot` but the manifest uses `swot-analyzer`. Create a mapping:

**File:** `server/modules/registry.ts` (or create new file `server/modules/id-mapping.ts`)

```typescript
export const frameworkKeyToModuleId: Record<string, string> = {
  'strategic_understanding': 'input-processor',
  'five_whys': 'five-whys-analyzer',
  'business_model_canvas': 'bmc-analyzer',
  'porters_five_forces': 'porters-analyzer',
  'pestle': 'pestle-analyzer',
  'swot': 'swot-analyzer',
  'ansoff': 'ansoff-analyzer',
  'blue_ocean': 'blue-ocean-analyzer',
  'bcg_matrix': 'bcg-matrix-analyzer',
  'value_chain': 'value-chain-analyzer',
  'vrio': 'vrio-analyzer',
  'scenario_planning': 'scenario-planning-analyzer',
  'jobs_to_be_done': 'jobs-to-be-done-analyzer',
  'competitive_positioning': 'competitive-positioning-analyzer',
  'segment_discovery': 'segment-discovery-analyzer',
  'okr': 'okr-generator',
  'ocean_strategy': 'ocean-strategy-analyzer',
  // User input steps (not AI modules)
  'strategic_decisions': 'strategic-decisions',
  'prioritization': 'prioritization',
};

export function getModuleId(frameworkKey: string): string {
  return frameworkKeyToModuleId[frameworkKey] || frameworkKey;
}
```

Use this in CustomJourneyExecutor:
```typescript
import { getModuleId } from '../modules/id-mapping';

// When looking up the module:
const moduleId = getModuleId(node.moduleId);
const module = moduleRegistry.getModule(moduleId);
```

---

## Order of Implementation

1. **First:** Fix CustomJourneyExecutor to call real analyzers (Priority 1)
2. **Second:** Save results to frameworkInsights table (Priority 2)
3. **Third:** Handle user input steps like Strategic Decisions (Priority 3)
4. **Fourth:** Update seed data with all modules (Priority 4)
5. **Fifth:** Create ID mapping layer (Priority 5)

---

## Test Cases

After implementing, verify:

1. **SWOT in custom journey produces REAL analysis** (not mock data with "Strength 1, Strength 2")
2. **Completed frameworks appear in Strategies Hub** (reading from frameworkInsights)
3. **Strategic Decisions step pauses and shows DecisionPage**
4. **Journey Builder shows all 18 modules** for selection
5. **Existing smoke tests still pass** (43/43)

---

## Files to Modify

1. `server/services/custom-journey-executor.ts` - Main executor fixes
2. `server/journey-builder-seed.ts` - Add missing frameworks
3. `server/modules/id-mapping.ts` - Create new file for ID mapping
4. `server/modules/registry.ts` - Import and use ID mapping

---

## Don't Do These Things

- Don't create a separate executor for wizard journeys (use existing infrastructure)
- Don't add new database tables (use existing `frameworkInsights`)
- Don't skip Strategic Decisions (it needs to show the DecisionPage)
- Don't generate mock data for implemented modules
