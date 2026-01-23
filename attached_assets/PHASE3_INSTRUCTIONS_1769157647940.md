# Phase 3: Service Layer Decomposition

**Date:** January 23, 2026
**Prerequisite:** Phase 2 (route splitting) complete and verified

---

## Overview

Split oversized service files into smaller, focused modules while maintaining the working legacy EPM pipeline.

**CRITICAL:** After each extraction, run an EPM generation to verify nothing broke.

---

## Task 1: Split EPM Synthesizer

The file `server/intelligence/epm-synthesizer.ts` is too large. Extract into focused modules:

### Create directory structure:
```
server/intelligence/epm/
├── index.ts                 # Re-exports all modules
├── interfaces.ts            # Interfaces for all EPM components
├── context-builder.ts       # ContextBuilder class (lines ~43-259)
├── workstream-generator.ts  # generateWorkstreams method
├── timeline-calculator.ts   # generateTimeline, validateEPMData, analyzePlanningGrid
├── resource-allocator.ts    # generateResourcePlan, role templates
├── component-generators.ts  # All other generators (financial, risk, KPIs, etc.)
├── program-namer.ts         # generateProgramName, generateFallbackProgramName
├── assignment-generator.ts  # generateAssignments
└── epm-orchestrator.ts      # Main EPMSynthesizer class that wires everything
```

### Step-by-step extraction:

#### 1. Create `server/intelligence/epm/interfaces.ts`
```typescript
export interface IContextBuilder {
  fromJourneyInsights(
    insights: StrategyInsights,
    journeyType: string,
    sessionId?: string
  ): Promise<PlanningContext>;
}

export interface IWorkstreamGenerator {
  generate(
    insights: StrategyInsights,
    userContext?: UserContext,
    onProgress?: (event: any) => void,
    startTime?: number
  ): Promise<Workstream[]>;
}

export interface ITimelineCalculator {
  generate(
    insights: StrategyInsights,
    workstreams: Workstream[],
    userContext?: UserContext
  ): Promise<Timeline>;
  validate(workstreams: Workstream[], timeline: Timeline, stageGates: StageGates): ValidationResult;
  analyzeGrid(workstreams: Workstream[], timeline: Timeline): GridAnalysis;
}

export interface IResourceAllocator {
  generate(
    insights: StrategyInsights,
    workstreams: Workstream[],
    userContext?: UserContext,
    initiativeType?: string
  ): Promise<ResourcePlan>;
}

export interface IComponentGenerator {
  generateExecutiveSummary(insights: StrategyInsights, programName: string): Promise<ExecutiveSummary>;
  generateRiskRegister(insights: StrategyInsights): Promise<RiskRegister>;
  generateStageGates(timeline: Timeline, riskRegister: RiskRegister): Promise<StageGates>;
  generateFinancialPlan(insights: StrategyInsights, resourcePlan: ResourcePlan, userContext?: UserContext): Promise<FinancialPlan>;
  generateBenefitsRealization(insights: StrategyInsights, timeline: Timeline): Promise<BenefitsRealization>;
  generateKPIs(insights: StrategyInsights, benefits: BenefitsRealization): Promise<KPIs>;
  generateStakeholderMap(insights: StrategyInsights): Promise<StakeholderMap>;
  generateGovernance(insights: StrategyInsights, stakeholderMap: StakeholderMap): Promise<Governance>;
  generateQAPlan(insights: StrategyInsights): Promise<QAPlan>;
  generateProcurement(insights: StrategyInsights, financialPlan: FinancialPlan): Promise<Procurement>;
  generateExitStrategy(insights: StrategyInsights, riskRegister: RiskRegister): Promise<ExitStrategy>;
}

export interface IProgramNamer {
  generate(
    insights: StrategyInsights,
    userContext?: UserContext,
    namingContext?: any
  ): Promise<string>;
}

export interface IAssignmentGenerator {
  generate(epmProgram: EPMProgram, programId: string): Promise<Assignment[]>;
}

export interface IEPMSynthesizer {
  synthesize(
    insights: StrategyInsights,
    userContext?: UserContext,
    namingContext?: any,
    options?: SynthesizeOptions
  ): Promise<EPMProgram>;
}
```

#### 2. Extract `context-builder.ts`
- Move the `ContextBuilder` class (currently lines ~43-259)
- Keep all scale inference logic (`inferScale`, `inferTimelineRange`, `inferBudgetRange`)
- Export as named export

#### 3. Extract `workstream-generator.ts`
- Move `generateWorkstreams` method
- Move `generateDeliverables` helper method
- Move `generateDefaultWorkstreams` helper
- Keep the WBS Builder integration (try/catch with fallback)

#### 4. Extract `timeline-calculator.ts`
- Move `generateTimeline` method
- Move `validateEPMData` method
- Move `analyzePlanningGrid` method
- These are tightly coupled, keep together

#### 5. Extract `resource-allocator.ts`
- Move `generateResourcePlan` method
- Move `generateRolesWithLLM` method
- Move all role templates (ROLE_TEMPLATES object)
- Move `estimateEffort` helper

#### 6. Extract `component-generators.ts`
- Move all remaining generators:
  - `generateExecutiveSummary`
  - `generateRiskRegister`
  - `generateStageGates`
  - `generateFinancialPlan`
  - `generateBenefitsRealization`
  - `generateKPIs`
  - `generateStakeholderMap`
  - `generateGovernance`
  - `generateQAPlan`
  - `generateProcurement`
  - `generateExitStrategy`

#### 7. Extract `program-namer.ts`
- Move `generateProgramName` method
- Move `generateFallbackProgramName` method

#### 8. Extract `assignment-generator.ts`
- Move `generateAssignments` method
- Move `synthesizeAssignments` helper

#### 9. Create `epm-orchestrator.ts`
- This is the new main EPMSynthesizer class
- Imports and composes all the extracted modules
- Contains `synthesize()`, `buildWithOldSystem()`, `buildWithIntelligentPlanning()`
- Contains `calculateOverallConfidence()`, `generateExtractionRationale()`

#### 10. Create `index.ts`
```typescript
export * from './interfaces';
export * from './context-builder';
export * from './workstream-generator';
export * from './timeline-calculator';
export * from './resource-allocator';
export * from './component-generators';
export * from './program-namer';
export * from './assignment-generator';
export { EPMSynthesizer } from './epm-orchestrator';
```

---

## Task 2: Split Export Service

The file `server/services/export-service.ts` should be split:

### Create directory structure:
```
server/services/export/
├── index.ts
├── interfaces.ts
├── base-exporter.ts
├── pdf-exporter.ts
├── docx-exporter.ts
├── excel-exporter.ts
├── json-exporter.ts
├── zip-packager.ts
└── export-orchestrator.ts
```

### Extraction steps:

1. **interfaces.ts** - Define `IExporter` interface
2. **base-exporter.ts** - Common functionality (formatting, data preparation)
3. **pdf-exporter.ts** - PDF generation logic
4. **docx-exporter.ts** - Word document generation
5. **excel-exporter.ts** - Excel/CSV generation
6. **json-exporter.ts** - JSON data export
7. **zip-packager.ts** - Bundle multiple exports into ZIP
8. **export-orchestrator.ts** - Main ExportService class that coordinates exporters

---

## Task 3: Register Services in DI Container

Update `server/services/container.ts`:

```typescript
import { EPMSynthesizer } from '../intelligence/epm';
import { ContextBuilder } from '../intelligence/epm/context-builder';
import { WorkstreamGenerator } from '../intelligence/epm/workstream-generator';
import { TimelineCalculator } from '../intelligence/epm/timeline-calculator';
import { ResourceAllocator } from '../intelligence/epm/resource-allocator';
import { ComponentGenerator } from '../intelligence/epm/component-generators';
import { ProgramNamer } from '../intelligence/epm/program-namer';
import { AssignmentGenerator } from '../intelligence/epm/assignment-generator';
import { ExportService } from './export';

export class ServiceContainer {
  private services: Map<string, any> = new Map();

  register<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }

  resolve<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not registered`);
    }
    return service as T;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }
}

export const container = new ServiceContainer();

export function registerServices(llm: any): void {
  // Register EPM services
  container.register('contextBuilder', new ContextBuilder());
  container.register('workstreamGenerator', new WorkstreamGenerator(llm));
  container.register('timelineCalculator', new TimelineCalculator());
  container.register('resourceAllocator', new ResourceAllocator(llm));
  container.register('componentGenerator', new ComponentGenerator(llm));
  container.register('programNamer', new ProgramNamer(llm));
  container.register('assignmentGenerator', new AssignmentGenerator());

  // Register main synthesizer
  container.register('epmSynthesizer', new EPMSynthesizer(
    container.resolve('contextBuilder'),
    container.resolve('workstreamGenerator'),
    container.resolve('timelineCalculator'),
    container.resolve('resourceAllocator'),
    container.resolve('componentGenerator'),
    container.resolve('programNamer'),
    container.resolve('assignmentGenerator'),
    llm
  ));

  // Register export services
  container.register('exportService', new ExportService());
}
```

---

## Task 4: Update Route Imports

Update routes to use the container:

```typescript
// In server/routes/strategy-workspace.ts
import { container } from '../services/container';
import type { IEPMSynthesizer } from '../intelligence/epm';

// Instead of:
// const epmSynthesizer = new EPMSynthesizer(llm);

// Use:
const epmSynthesizer = container.resolve<IEPMSynthesizer>('epmSynthesizer');
```

---

## Verification After Each Step

After extracting each module, run:

1. **Build check:**
   ```bash
   npm run build
   ```

2. **Start server:**
   ```bash
   npm run dev
   ```

3. **Test EPM generation:**
   - Generate an EPM for any business scenario
   - Verify output has:
     - Workstreams with names
     - Timeline with phases
     - Critical path analysis
     - Dependencies

---

## Order of Operations

1. Create `server/intelligence/epm/` directory
2. Create `interfaces.ts` first
3. Extract one module at a time, test after each:
   - context-builder.ts
   - workstream-generator.ts
   - timeline-calculator.ts
   - resource-allocator.ts
   - component-generators.ts
   - program-namer.ts
   - assignment-generator.ts
4. Create epm-orchestrator.ts
5. Create index.ts
6. Update imports in routes
7. Full test
8. Then do export-service split
9. Update DI container
10. Final verification

---

## DO NOT

- Change any business logic during extraction
- Rename methods (yet)
- Add new features
- "Improve" code while extracting

**Goal:** Same output, better organization. Refactor first, enhance later.
