# Proposal: Module Factory System

**Purpose:** Prevent architectural drift by enforcing standardization when creating new modules.

---

## The Problem This Solves

Currently, creating a module requires:
1. Creating a manifest file (easy to forget fields)
2. Creating an analyzer implementation (no enforced interface)
3. Adding to manifest index (easy to forget)
4. Adding to framework registry seed (easy to forget)
5. Creating ID mapping (easy to forget)
6. Wiring into executor (easy to do wrong)

**Result:** 7 out of 18 modules are broken because steps were missed.

---

## The Solution: Module Factory

A CLI tool and/or admin interface that:
1. Collects module metadata through a guided process
2. Generates ALL required files from templates
3. Validates inputs/outputs against a type registry
4. Automatically registers everywhere needed
5. Creates test scaffolding
6. Fails if any step is incomplete

---

## 1. Type Registry (Single Source of Truth)

**File:** `shared/module-types.ts`

```typescript
/**
 * ALL valid data types that can flow between modules.
 * Adding a new type requires updating this file ONLY.
 */

export const MODULE_DATA_TYPES = {
  // Input Types
  business_context: {
    description: 'Raw business description and context',
    schema: z.object({
      description: z.string(),
      industry: z.string().optional(),
      goals: z.array(z.string()).optional(),
    }),
  },
  strategic_context: {
    description: 'Processed strategic understanding',
    schema: z.object({
      userInput: z.string(),
      entities: z.array(z.any()),
      classification: z.any(),
    }),
  },

  // Output Types
  swot_output: {
    description: 'SWOT analysis results',
    schema: z.object({
      strengths: z.array(z.any()),
      weaknesses: z.array(z.any()),
      opportunities: z.array(z.any()),
      threats: z.array(z.any()),
      strategicOptions: z.any().optional(),
    }),
  },
  bmc_output: {
    description: 'Business Model Canvas results',
    schema: z.object({
      blocks: z.record(z.any()),
      contradictions: z.array(z.any()).optional(),
    }),
  },
  porters_output: {
    description: "Porter's Five Forces results",
    schema: z.object({
      forces: z.record(z.any()),
      overallAttractiveness: z.string(),
    }),
  },
  // ... all other types
} as const;

export type ModuleDataType = keyof typeof MODULE_DATA_TYPES;
```

---

## 2. Module Contract (Interface Every Module Must Implement)

**File:** `server/modules/base-module.ts`

```typescript
import { z } from 'zod';
import { MODULE_DATA_TYPES, ModuleDataType } from '@shared/module-types';

/**
 * Every module MUST extend this base class.
 * This ensures consistent interface, error handling, logging.
 */
export abstract class BaseModule<TInput, TOutput> {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly inputType: ModuleDataType;
  abstract readonly outputType: ModuleDataType;

  /**
   * Main execution method - must be implemented by each module
   */
  abstract execute(input: TInput): Promise<TOutput>;

  /**
   * Wrapper that handles validation, logging, error handling
   */
  async run(rawInput: unknown): Promise<TOutput> {
    const startTime = Date.now();
    console.log(`[${this.id}] Starting execution...`);

    // Validate input against schema
    const inputSchema = MODULE_DATA_TYPES[this.inputType].schema;
    const validatedInput = inputSchema.parse(rawInput) as TInput;

    try {
      // Execute the actual logic
      const output = await this.execute(validatedInput);

      // Validate output against schema
      const outputSchema = MODULE_DATA_TYPES[this.outputType].schema;
      const validatedOutput = outputSchema.parse(output);

      const duration = Date.now() - startTime;
      console.log(`[${this.id}] Completed in ${duration}ms`);

      return validatedOutput as TOutput;
    } catch (error) {
      console.error(`[${this.id}] Execution failed:`, error);
      throw error;
    }
  }
}
```

---

## 3. Module Factory CLI

**Command:** `npm run create-module`

```
$ npm run create-module

🔧 Module Factory - Create a New Strategic Module
================================================

? Module ID (kebab-case): competitive-landscape-analyzer
? Display Name: Competitive Landscape Analysis
? Description: Analyzes competitive positioning and market dynamics
? Category: Competition
? Estimated Duration (minutes): 10
? Difficulty: (beginner/intermediate/advanced) intermediate

? Select INPUT type(s):
  ◉ business_context
  ◯ strategic_context
  ◉ porters_output
  ◯ swot_output
  ◯ bmc_output

? Select OUTPUT type: competitive_landscape_output

⚠️  Output type 'competitive_landscape_output' doesn't exist.
? Create new output type? (Y/n) Y

? Describe the output schema:
  - competitors: array of competitor objects
  - marketPosition: string
  - opportunities: array of strings
  - threats: array of strings

✅ Creating module files...

Created:
  ✓ shared/module-types.ts (added competitive_landscape_output)
  ✓ server/modules/manifests/competitive-landscape-analyzer.ts
  ✓ server/intelligence/competitive-landscape-analyzer.ts
  ✓ server/modules/manifests/index.ts (updated exports)
  ✓ server/journey-builder-seed.ts (added to FRAMEWORKS)
  ✓ server/modules/id-mapping.ts (added mapping)
  ✓ tests/modules/competitive-landscape-analyzer.test.ts

📋 Next steps:
  1. Implement the execute() method in server/intelligence/competitive-landscape-analyzer.ts
  2. Run tests: npm test -- competitive-landscape-analyzer
  3. The module will automatically be available in Journey Builder

```

---

## 4. Generated Files

### Manifest (auto-generated)

```typescript
// server/modules/manifests/competitive-landscape-analyzer.ts
// AUTO-GENERATED by Module Factory - DO NOT EDIT MANUALLY

import type { ModuleManifest } from '../manifest';

export const competitiveLandscapeAnalyzerManifest: ModuleManifest = {
  id: 'competitive-landscape-analyzer',
  name: 'Competitive Landscape Analysis',
  version: '1.0.0',
  description: 'Analyzes competitive positioning and market dynamics',
  type: 'analyzer',
  category: 'Competition',
  icon: 'users',
  status: 'implemented',
  inputs: [
    {
      id: 'business_context',
      name: 'businessContext',
      type: 'business_context',
      required: true,
      description: 'Raw business description and context',
    },
    {
      id: 'porters_output',
      name: 'portersOutput',
      type: 'porters_output',
      required: false,
      description: "Porter's Five Forces results",
    },
  ],
  outputs: [
    {
      id: 'output',
      name: 'competitiveLandscapeOutput',
      type: 'competitive_landscape_output',
      required: true,
      description: 'Competitive landscape analysis results',
    },
  ],
  requires: [],
  serviceClass: 'CompetitiveLandscapeAnalyzer',
  uiComponent: 'CompetitiveLandscapePage',
  tags: ['competition', 'market-analysis'],
  estimatedDuration: 10,
  isActive: true,
};
```

### Implementation Skeleton (auto-generated)

```typescript
// server/intelligence/competitive-landscape-analyzer.ts
// Generated by Module Factory

import { BaseModule } from '../modules/base-module';
import { aiClients } from '../ai-clients';
import type { BusinessContext } from '@shared/module-types';
import type { CompetitiveLandscapeOutput } from '@shared/module-types';

export class CompetitiveLandscapeAnalyzer extends BaseModule<
  { businessContext: BusinessContext; portersOutput?: any },
  CompetitiveLandscapeOutput
> {
  readonly id = 'competitive-landscape-analyzer';
  readonly name = 'Competitive Landscape Analysis';
  readonly inputType = 'business_context' as const;
  readonly outputType = 'competitive_landscape_output' as const;

  async execute(input: {
    businessContext: BusinessContext;
    portersOutput?: any;
  }): Promise<CompetitiveLandscapeOutput> {
    // TODO: Implement your analysis logic here

    const prompt = `
      Analyze the competitive landscape for this business:
      ${JSON.stringify(input.businessContext)}

      ${input.portersOutput ? `Porter's Analysis: ${JSON.stringify(input.portersOutput)}` : ''}

      Return JSON with: competitors, marketPosition, opportunities, threats
    `;

    const response = await aiClients.callWithFallback({
      systemPrompt: 'You are a competitive analysis expert. Return only valid JSON.',
      userMessage: prompt,
      maxTokens: 4000,
    });

    return JSON.parse(response.content);
  }
}

export const competitiveLandscapeAnalyzer = new CompetitiveLandscapeAnalyzer();
```

---

## 5. Validation at Startup

**File:** `server/modules/validate.ts`

```typescript
/**
 * Run at server startup to catch drift early
 */
export function validateModuleSystem(): void {
  const errors: string[] = [];

  // 1. Every manifest must have an implementation
  for (const manifest of allManifests) {
    const impl = analyzerRegistry[manifest.id];
    if (!impl) {
      errors.push(`Manifest '${manifest.id}' has no implementation`);
    }
  }

  // 2. Every framework registry entry must have a manifest
  const registryEntries = await db.select().from(frameworkRegistry);
  for (const entry of registryEntries) {
    const moduleId = getModuleId(entry.frameworkKey);
    const manifest = allManifests.find(m => m.id === moduleId);
    if (!manifest) {
      errors.push(`Registry '${entry.frameworkKey}' has no manifest`);
    }
  }

  // 3. All input/output types must exist in type registry
  for (const manifest of allManifests) {
    for (const input of manifest.inputs) {
      if (!MODULE_DATA_TYPES[input.type]) {
        errors.push(`Manifest '${manifest.id}' uses unknown input type '${input.type}'`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('❌ Module system validation failed:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);  // Fail fast
  }

  console.log('✅ Module system validation passed');
}
```

---

## 6. Module Types (Classification)

```typescript
export type ModuleType =
  | 'ai_analyzer'      // Runs AI, returns analysis (SWOT, BMC, etc.)
  | 'user_input'       // Pauses for user interaction (Strategic Decisions)
  | 'generator'        // Produces final output (EPM Generator)
  | 'internal';        // Not user-selectable (Input Processor)

// In manifest:
export interface ModuleManifest {
  id: string;
  moduleType: ModuleType;  // REQUIRED
  // ... rest
}
```

The executor uses this:
```typescript
if (manifest.moduleType === 'user_input') {
  // Pause and redirect
} else if (manifest.moduleType === 'ai_analyzer') {
  // Call the analyzer
}
```

---

## 7. Benefits

| Before | After |
|--------|-------|
| 7 steps to create module, easy to miss | 1 command generates everything |
| No validation, drift discovered in production | Validation at startup, fails fast |
| Inconsistent interfaces | BaseModule enforces contract |
| Naming mismatches (swot vs swot-analyzer) | Auto-generated ID mapping |
| No type safety between modules | Zod schemas validate all data |
| Manual documentation | Generated from schema |

---

## 8. Implementation Order

1. **Create type registry** (`shared/module-types.ts`)
2. **Create BaseModule class** (`server/modules/base-module.ts`)
3. **Refactor ONE existing module** to use BaseModule (e.g., SWOT)
4. **Create validation script** (`server/modules/validate.ts`)
5. **Create CLI tool** (`scripts/create-module.ts`)
6. **Migrate remaining modules** one by one
7. **Add startup validation** to server

---

## 9. Future Enhancements

- **Admin UI for module creation** (not just CLI)
- **Visual module graph** showing data flow
- **Auto-generate API docs** from type registry
- **Module versioning** with migration support
- **Module marketplace** for community contributions
