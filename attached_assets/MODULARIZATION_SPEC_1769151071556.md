# Premisia Modularization Specification

**Version:** 1.0
**Date:** January 21, 2026
**Status:** Approved for Implementation
**Priority:** High

---

## Executive Summary

The Premisia codebase has accumulated significant technical debt that contradicts its intended modular architecture. While the system successfully delivers strategic consulting workflows, the implementation has drifted into a monolithic structure that impedes maintainability, testability, and the ability to add new journey types.

This specification defines a phased refactoring initiative to restore modular boundaries, enforce architectural contracts, and prepare the codebase for a future visual journey builder (N8N-style).

**Current Health Score:** 5.2/10
**Target Health Score:** 8.0/10
**Timeline:** 8 weeks (after current EPM quality fixes)

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Goals and Success Criteria](#2-goals-and-success-criteria)
3. [Immediate Policies](#3-immediate-policies)
4. [Phase 1: Foundation](#4-phase-1-foundation)
5. [Phase 2: Route Layer Decomposition](#5-phase-2-route-layer-decomposition)
6. [Phase 3: Service Layer Decomposition](#6-phase-3-service-layer-decomposition)
7. [Phase 4: Data Access Layer](#7-phase-4-data-access-layer)
8. [Phase 5: Module Catalog Preparation](#8-phase-5-module-catalog-preparation)
9. [Technical Specifications](#9-technical-specifications)
10. [Testing Requirements](#10-testing-requirements)
11. [Risk Mitigation](#11-risk-mitigation)
12. [Acceptance Criteria](#12-acceptance-criteria)
13. [Appendix: File Inventory](#appendix-file-inventory)

---

## 1. Current State Analysis

### 1.1 Critical Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| Monolithic route files | Critical | Untestable, changes risk regressions |
| No data access abstraction | Critical | DB coupling in 50+ files |
| Type safety violations (897 `any` usages) | High | Runtime errors, no compile-time safety |
| Oversized service files (4,192 lines max) | High | Single Responsibility violated |
| Hardcoded configuration values | Medium | Difficult to configure per environment |
| Journey logic leaking into core services | Medium | Cannot reuse core services independently |

### 1.2 Files Requiring Immediate Attention

| File | Lines | Issues |
|------|-------|--------|
| `server/services/export-service.ts` | 4,192 | Multiple export formats mixed |
| `server/routes/strategic-consultant.ts` | 2,790 | 8 services composed inline |
| `server/intelligence/epm-synthesizer.ts` | 2,197 | Context + synthesis + validation mixed |
| `server/routes.ts` | 1,957 | Business logic in route handlers |
| `client/src/pages/home-page.tsx` | 1,652 | Mixed UI concerns |
| `client/src/pages/strategic-consultant/WhysTreePage.tsx` | 1,603 | Complex tree logic inline |

### 1.3 What Works Well

| Component | Location | Status |
|-----------|----------|--------|
| Intelligent Planning subsystem | `src/lib/intelligent-planning/` | Well-structured, use as reference |
| WBS Builder | `src/lib/intelligent-planning/wbs-builder/` | Clean layering |
| Journey Registry (concept) | `server/journey/journey-registry.ts` | Good foundation, needs enforcement |
| Journey Architecture Tests | `tests/journeys/journey-architecture.spec.ts` | Guards against violations |

---

## 2. Goals and Success Criteria

### 2.1 Primary Goals

1. **Restore Modular Architecture**: Each framework (BMC, Porter's, PESTLE) operates as an independent module
2. **Enable Journey Composition**: New journeys can be created by configuring module sequences without code changes
3. **Improve Testability**: Business logic can be unit tested in isolation
4. **Reduce Coupling**: Services communicate through defined interfaces, not direct imports
5. **Prepare for Visual Builder**: Module catalog and journey configs ready for GUI integration

### 2.2 Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Largest file (lines) | 4,192 | <800 | `wc -l` on all .ts files |
| `any` type occurrences | 897 | <100 | `grep -r ": any" --include="*.ts"` |
| Direct db imports | 50+ files | <10 files | Files importing from `db/` |
| Avg dependencies per file | 12-20 | 3-5 | Import statement count |
| Test coverage (new code) | Unknown | >80% | Jest coverage report |
| Time to add new journey | Days | Hours | Measured via journey config |

---

## 3. Immediate Policies

**Effective immediately upon approval of this specification.**

### 3.1 File Freeze Policy

The following files are **FROZEN** for new feature additions:

```
FROZEN FILES - No new logic permitted:
├── server/routes/strategic-consultant.ts
├── server/routes.ts
├── server/services/export-service.ts
├── server/intelligence/epm-synthesizer.ts
└── server/routes/strategy-workspace.ts
```

**Allowed changes to frozen files:**
- Bug fixes
- Extracting code to new modules (reducing file size)
- Adding imports to new modules

**Prohibited changes to frozen files:**
- New endpoints
- New business logic
- New service instantiations

### 3.2 New Code Requirements

All new code MUST:

1. **Live in dedicated module files** (not added to existing large files)
2. **Use TypeScript interfaces** for all function parameters and return types
3. **Access database through repository layer** (once created in Phase 4)
4. **Have accompanying unit tests** with >80% coverage
5. **Pass ESLint with no `any` type warnings**

### 3.3 Code Review Checklist

Every PR must verify:

- [ ] No additions to frozen files (except extractions)
- [ ] No new `any` types without explicit justification
- [ ] No direct database imports outside repository layer
- [ ] New modules have interface definitions
- [ ] Test coverage meets minimum threshold

---

## 4. Phase 1: Foundation

**Duration:** 1-2 weeks
**Dependencies:** EPM quality fixes complete
**Owner:** Replit

### 4.1 Objectives

- Establish type definitions for all data structures
- Create dependency injection infrastructure
- Centralize configuration management

### 4.2 Deliverables

#### 4.2.1 API Response Types

Create `server/types/api-responses.ts`:

```typescript
/**
 * Standard API response envelope
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMetadata {
  requestId: string;
  timestamp: string;
  duration?: number;
}

/**
 * Paginated response for list endpoints
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
```

#### 4.2.2 EPM Data Types

Create `server/types/epm.ts`:

```typescript
export interface EPMProgram {
  id: string;
  strategyVersionId: string;
  userId: string;
  frameworkType: FrameworkType;
  executiveSummary: ExecutiveSummary;
  workstreams: Workstream[];
  timeline: Timeline;
  resourcePlan: ResourcePlan;
  financialPlan: FinancialPlan;
  riskRegister: RiskRegister;
  kpis: KPISet;
  stakeholderMap: StakeholderMap;
  governance: GovernanceStructure;
  status: ProgramStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workstream {
  id: string;
  name: string;
  description: string;
  owner: string;
  startMonth: number;
  endMonth: number;
  confidence: number;
  deliverables: Deliverable[];
  dependencies: string[];
  resourceRequirements: ResourceRequirement[];
  // CPM fields
  earlyStart?: number;
  earlyFinish?: number;
  lateStart?: number;
  lateFinish?: number;
  slack?: number;
  isCritical?: boolean;
}

export interface Deliverable {
  id: string;
  name: string;
  description: string;
  dueMonth: number;
  workstreamId: string;
  status?: DeliverableStatus;
}

export type FrameworkType = 'bmc' | 'porters' | 'pestle' | 'five_whys';
export type ProgramStatus = 'draft' | 'in_progress' | 'finalized' | 'archived';
export type DeliverableStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
```

#### 4.2.3 Journey Types

Create `server/types/journey.ts`:

```typescript
export interface JourneyDefinition {
  id: string;
  name: string;
  description: string;
  frameworks: FrameworkType[];
  pageSequence: PageDefinition[];
  version: string;
  isActive: boolean;
}

export interface PageDefinition {
  id: string;
  path: string;
  component: string;
  requiredData: string[];
  producedData: string[];
}

export interface JourneySession {
  id: string;
  journeyId: string;
  userId: string;
  currentPage: string;
  state: JourneyState;
  createdAt: Date;
  updatedAt: Date;
}

export type JourneyState = 'active' | 'completed' | 'abandoned';
```

#### 4.2.4 Dependency Injection Container

Create `server/services/container.ts`:

```typescript
/**
 * Simple dependency injection container
 * Manages service lifecycle and dependencies
 */
export class ServiceContainer {
  private services: Map<string, any> = new Map();
  private factories: Map<string, () => any> = new Map();

  /**
   * Register a service factory
   */
  register<T>(name: string, factory: () => T): void {
    this.factories.set(name, factory);
  }

  /**
   * Register a singleton instance
   */
  registerInstance<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }

  /**
   * Resolve a service by name
   */
  resolve<T>(name: string): T {
    // Return existing instance if available
    if (this.services.has(name)) {
      return this.services.get(name) as T;
    }

    // Create new instance from factory
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Service '${name}' not registered`);
    }

    const instance = factory();
    this.services.set(name, instance);
    return instance as T;
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name) || this.factories.has(name);
  }

  /**
   * Clear all services (for testing)
   */
  clear(): void {
    this.services.clear();
  }
}

// Global container instance
export const container = new ServiceContainer();

// Service registration helper
export function registerServices(): void {
  // Register all services here
  // Example:
  // container.register('strategyAnalyzer', () => new StrategyAnalyzer());
  // container.register('epmGenerator', () => new EPMGenerator(container.resolve('strategyAnalyzer')));
}
```

#### 4.2.5 Centralized Configuration

Create `server/config/index.ts`:

```typescript
export const config = {
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
    timeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
    retries: parseInt(process.env.API_RETRIES || '3', 10),
  },

  crewai: {
    serviceUrl: process.env.CREWAI_SERVICE_URL || 'http://localhost:8001',
    healthCheckInterval: parseInt(process.env.CREWAI_HEALTH_INTERVAL || '30000', 10),
    generationTimeout: parseInt(process.env.CREWAI_TIMEOUT || '300000', 10),
  },

  database: {
    url: process.env.DATABASE_URL,
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  },

  features: {
    useMultiAgentEPM: process.env.USE_MULTI_AGENT_EPM === 'true',
    intelligentPlanningEnabled: process.env.INTELLIGENT_PLANNING_ENABLED === 'true',
  },

  limits: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxPlanningIterations: parseInt(process.env.MAX_PLANNING_ITERATIONS || '10', 10),
    targetPlanningScore: parseFloat(process.env.TARGET_PLANNING_SCORE || '0.85'),
  },
} as const;

export type Config = typeof config;
```

### 4.3 Acceptance Criteria

- [ ] All type definition files created and exported
- [ ] ServiceContainer class implemented with tests
- [ ] Configuration centralized, no hardcoded values in business logic
- [ ] Existing code updated to import from new type/config files
- [ ] No new `any` types introduced

---

## 5. Phase 2: Route Layer Decomposition

**Duration:** 1-2 weeks
**Dependencies:** Phase 1 complete
**Owner:** Replit

### 5.1 Objectives

- Split monolithic route files into focused modules
- Extract business logic from route handlers
- Establish consistent error handling patterns

### 5.2 Target Structure

```
server/routes/
├── index.ts                    # Route aggregator
├── auth-routes.ts              # Authentication endpoints
├── strategic-consultant/
│   ├── index.ts                # Re-exports all routes
│   ├── input-routes.ts         # Input processing, clarification
│   ├── analysis-routes.ts      # Framework analysis (BMC, Porter's)
│   ├── research-routes.ts      # Market research, references
│   ├── generation-routes.ts    # EPM generation, decisions
│   └── export-routes.ts        # File exports
├── strategy-workspace/
│   ├── index.ts
│   ├── strategy-routes.ts
│   ├── decision-routes.ts
│   └── version-routes.ts
├── journey/
│   ├── index.ts
│   ├── session-routes.ts
│   └── progress-routes.ts
└── knowledge/
    ├── index.ts
    ├── graph-routes.ts
    └── reference-routes.ts
```

### 5.3 Route Handler Pattern

All route handlers MUST follow this pattern:

```typescript
// generation-routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { container } from '../services/container';
import { ApiResponse } from '../types/api-responses';
import { EPMProgram } from '../types/epm';
import { asyncHandler } from '../middleware/async-handler';
import { validateRequest } from '../middleware/validation';
import { GenerateEPMSchema } from '../schemas/epm-schemas';

const router = Router();

/**
 * POST /api/strategic-consultant/generate-epm
 * Generate EPM program from strategy analysis
 */
router.post(
  '/generate-epm',
  validateRequest(GenerateEPMSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { strategyVersionId, options } = req.body;
    const userId = req.user!.id;

    // Resolve service from container (not instantiate inline)
    const epmGenerator = container.resolve<EPMGeneratorService>('epmGenerator');

    // Business logic delegated to service
    const program = await epmGenerator.generate(strategyVersionId, userId, options);

    // Consistent response format
    const response: ApiResponse<EPMProgram> = {
      success: true,
      data: program,
      metadata: {
        requestId: req.id,
        timestamp: new Date().toISOString(),
      },
    };

    res.json(response);
  })
);

export default router;
```

### 5.4 Migration Steps

1. **Create new route file** with focused endpoints
2. **Move route handlers** from monolithic file to new file
3. **Extract inline business logic** to service methods
4. **Update imports** in the original file to use new routes
5. **Add tests** for migrated routes
6. **Remove migrated code** from original file
7. **Repeat** until original file only re-exports sub-routes

### 5.5 Acceptance Criteria

- [ ] `strategic-consultant.ts` reduced to <500 lines (re-exports only)
- [ ] `routes.ts` reduced to <500 lines
- [ ] Each new route file <300 lines
- [ ] All route handlers use asyncHandler wrapper
- [ ] All route handlers use consistent response format
- [ ] Business logic moved to services, not inline in handlers
- [ ] Integration tests passing for all migrated routes

---

## 6. Phase 3: Service Layer Decomposition

**Duration:** 2 weeks
**Dependencies:** Phase 2 complete
**Owner:** Replit

### 6.1 Objectives

- Split oversized service files into focused modules
- Establish service interfaces for dependency injection
- Create framework-agnostic base classes

### 6.2 Export Service Decomposition

Split `server/services/export-service.ts` (4,192 lines) into:

```
server/services/export/
├── index.ts                    # Public API
├── interfaces.ts               # Export service interfaces
├── base-exporter.ts            # Abstract base class
├── pdf-exporter.ts             # PDF generation
├── docx-exporter.ts            # Word document generation
├── excel-exporter.ts           # Excel spreadsheet generation
├── csv-exporter.ts             # CSV data export
├── zip-packager.ts             # Multi-file packaging
└── export-orchestrator.ts      # Coordinates multiple exports
```

#### Interface Definition

```typescript
// interfaces.ts
export interface IExporter<TInput, TOutput> {
  export(data: TInput, options?: ExportOptions): Promise<TOutput>;
  getContentType(): string;
  getFileExtension(): string;
}

export interface ExportOptions {
  includeImages?: boolean;
  pageSize?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  watermark?: string;
}

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
  size: number;
}
```

#### Base Exporter

```typescript
// base-exporter.ts
export abstract class BaseExporter<TInput> implements IExporter<TInput, ExportResult> {
  protected options: ExportOptions;

  constructor(options: ExportOptions = {}) {
    this.options = options;
  }

  abstract export(data: TInput, options?: ExportOptions): Promise<ExportResult>;
  abstract getContentType(): string;
  abstract getFileExtension(): string;

  protected generateFilename(baseName: string): string {
    const timestamp = new Date().toISOString().split('T')[0];
    return `${baseName}-${timestamp}.${this.getFileExtension()}`;
  }
}
```

### 6.3 EPM Synthesizer Decomposition

Split `server/intelligence/epm-synthesizer.ts` (2,197 lines) into:

```
server/intelligence/epm/
├── index.ts                    # Public API
├── interfaces.ts               # EPM generation interfaces
├── context-builder.ts          # Build planning context from insights
├── workstream-generator.ts     # Generate workstreams from WBS
├── timeline-calculator.ts      # CPM scheduling, critical path
├── resource-allocator.ts       # Resource assignment
├── financial-planner.ts        # Budget calculation
├── risk-assessor.ts            # Risk identification and mitigation
├── validator.ts                # EPM validation rules
└── epm-orchestrator.ts         # Coordinates generation pipeline
```

#### Pipeline Pattern

```typescript
// epm-orchestrator.ts
export class EPMOrchestrator {
  constructor(
    private contextBuilder: ContextBuilder,
    private workstreamGenerator: WorkstreamGenerator,
    private timelineCalculator: TimelineCalculator,
    private resourceAllocator: ResourceAllocator,
    private financialPlanner: FinancialPlanner,
    private riskAssessor: RiskAssessor,
    private validator: EPMValidator,
  ) {}

  async generate(
    insights: StrategyInsights,
    options: GenerationOptions,
    onProgress?: ProgressCallback,
  ): Promise<EPMProgram> {
    // Step 1: Build context
    onProgress?.('Building planning context...');
    const context = await this.contextBuilder.build(insights);

    // Step 2: Generate workstreams
    onProgress?.('Generating workstreams...');
    const workstreams = await this.workstreamGenerator.generate(context);

    // Step 3: Calculate timeline (CPM)
    onProgress?.('Calculating timeline...');
    const timeline = await this.timelineCalculator.calculate(workstreams);

    // Step 4: Allocate resources
    onProgress?.('Allocating resources...');
    const resources = await this.resourceAllocator.allocate(workstreams, timeline);

    // Step 5: Plan financials
    onProgress?.('Planning financials...');
    const financials = await this.financialPlanner.plan(workstreams, resources);

    // Step 6: Assess risks
    onProgress?.('Assessing risks...');
    const risks = await this.riskAssessor.assess(workstreams, timeline, financials);

    // Step 7: Assemble and validate
    onProgress?.('Validating program...');
    const program = this.assembleProgram(context, workstreams, timeline, resources, financials, risks);
    await this.validator.validate(program);

    return program;
  }
}
```

### 6.4 Framework Analyzer Base Class

Create shared analyzer infrastructure:

```
server/intelligence/frameworks/
├── index.ts
├── base-analyzer.ts            # Abstract analyzer
├── analyzer-factory.ts         # Factory for framework analyzers
├── bmc/
│   └── bmc-analyzer.ts
├── porters/
│   └── porters-analyzer.ts
└── pestle/
    └── pestle-analyzer.ts
```

```typescript
// base-analyzer.ts
export abstract class BaseFrameworkAnalyzer<TInput, TOutput> {
  protected llm: LLMProvider;
  protected researchService: ResearchService;

  constructor(llm: LLMProvider, researchService: ResearchService) {
    this.llm = llm;
    this.researchService = researchService;
  }

  abstract getFrameworkType(): FrameworkType;
  abstract generateQueries(input: TInput): Promise<ResearchQuery[]>;
  abstract analyzeResults(research: ResearchResult[]): Promise<TOutput>;
  abstract validate(output: TOutput): Promise<ValidationResult>;

  async analyze(input: TInput, onProgress?: ProgressCallback): Promise<TOutput> {
    onProgress?.('Generating research queries...');
    const queries = await this.generateQueries(input);

    onProgress?.('Conducting research...');
    const research = await this.researchService.executeQueries(queries);

    onProgress?.('Analyzing results...');
    const output = await this.analyzeResults(research);

    onProgress?.('Validating...');
    await this.validate(output);

    return output;
  }
}
```

### 6.5 Acceptance Criteria

- [ ] `export-service.ts` split into 8+ focused files, each <400 lines
- [ ] `epm-synthesizer.ts` split into 9+ focused files, each <400 lines
- [ ] Base classes created for exporters and analyzers
- [ ] All services registered in DI container
- [ ] Interfaces defined for all services
- [ ] Unit tests for each extracted service
- [ ] Integration tests for orchestrators

---

## 7. Phase 4: Data Access Layer

**Duration:** 1-2 weeks
**Dependencies:** Phase 3 complete
**Owner:** Replit

### 7.1 Objectives

- Create repository pattern for database access
- Remove direct Drizzle ORM imports from services
- Enable database mocking for tests

### 7.2 Repository Structure

```
server/repositories/
├── index.ts                    # Repository exports
├── base-repository.ts          # Abstract base with common operations
├── journey-repository.ts       # Journey session data access
├── strategy-repository.ts      # Strategy and version data access
├── epm-repository.ts           # EPM program data access
├── user-repository.ts          # User data access
└── knowledge-repository.ts     # Knowledge graph data access
```

### 7.3 Base Repository

```typescript
// base-repository.ts
import { db } from '../db';
import { eq, and, desc, asc } from 'drizzle-orm';

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export abstract class BaseRepository<T, TInsert, TUpdate> {
  protected db = db;
  protected abstract table: any;
  protected abstract idField: any;

  async findById(id: string): Promise<T | null> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.idField, id))
      .limit(1);
    return results[0] || null;
  }

  async findAll(options: QueryOptions = {}): Promise<T[]> {
    let query = this.db.select().from(this.table);

    if (options.orderBy) {
      const orderFn = options.orderDirection === 'desc' ? desc : asc;
      query = query.orderBy(orderFn(this.table[options.orderBy]));
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return query;
  }

  async create(data: TInsert): Promise<T> {
    const results = await this.db
      .insert(this.table)
      .values(data)
      .returning();
    return results[0];
  }

  async update(id: string, data: TUpdate): Promise<T | null> {
    const results = await this.db
      .update(this.table)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(this.idField, id))
      .returning();
    return results[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(this.table)
      .where(eq(this.idField, id));
    return result.rowCount > 0;
  }
}
```

### 7.4 EPM Repository Example

```typescript
// epm-repository.ts
import { BaseRepository } from './base-repository';
import { epmPrograms, workstreams, deliverables } from '../db/schema';
import { EPMProgram, Workstream, Deliverable } from '../types/epm';
import { eq } from 'drizzle-orm';

export class EPMRepository extends BaseRepository<EPMProgram, EPMProgramInsert, EPMProgramUpdate> {
  protected table = epmPrograms;
  protected idField = epmPrograms.id;

  async findByStrategyVersion(strategyVersionId: string): Promise<EPMProgram | null> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.strategyVersionId, strategyVersionId))
      .limit(1);
    return results[0] || null;
  }

  async findByUser(userId: string): Promise<EPMProgram[]> {
    return this.db
      .select()
      .from(this.table)
      .where(eq(this.table.userId, userId))
      .orderBy(desc(this.table.createdAt));
  }

  async getWithWorkstreams(programId: string): Promise<EPMProgramWithWorkstreams | null> {
    const program = await this.findById(programId);
    if (!program) return null;

    const programWorkstreams = await this.db
      .select()
      .from(workstreams)
      .where(eq(workstreams.programId, programId));

    return {
      ...program,
      workstreams: programWorkstreams,
    };
  }

  async createWithWorkstreams(
    program: EPMProgramInsert,
    programWorkstreams: WorkstreamInsert[],
  ): Promise<EPMProgram> {
    return this.db.transaction(async (tx) => {
      const [createdProgram] = await tx
        .insert(this.table)
        .values(program)
        .returning();

      if (programWorkstreams.length > 0) {
        await tx
          .insert(workstreams)
          .values(programWorkstreams.map(ws => ({
            ...ws,
            programId: createdProgram.id,
          })));
      }

      return createdProgram;
    });
  }
}
```

### 7.5 Repository Registration

```typescript
// In container setup
import { EPMRepository } from './repositories/epm-repository';
import { StrategyRepository } from './repositories/strategy-repository';
import { JourneyRepository } from './repositories/journey-repository';

container.registerInstance('epmRepository', new EPMRepository());
container.registerInstance('strategyRepository', new StrategyRepository());
container.registerInstance('journeyRepository', new JourneyRepository());
```

### 7.6 Migration Steps

1. Create repository for each domain entity
2. Update one service at a time to use repository instead of direct db
3. Add unit tests with mocked repository
4. Remove direct db imports from migrated service
5. Repeat for all services

### 7.7 Acceptance Criteria

- [ ] Base repository implemented with common CRUD operations
- [ ] Domain repositories created (EPM, Strategy, Journey, User, Knowledge)
- [ ] All services updated to use repositories
- [ ] Direct `db` imports removed from non-repository files
- [ ] Repository interfaces defined for mocking
- [ ] Unit tests using mocked repositories

---

## 8. Phase 5: Module Catalog Preparation

**Duration:** 1 week
**Dependencies:** Phase 4 complete
**Owner:** Replit

### 8.1 Objectives

- Create module manifest system
- Enable journey definitions via configuration
- Prepare infrastructure for visual builder

### 8.2 Module Manifest

```typescript
// server/modules/manifest.ts
export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  type: 'analyzer' | 'generator' | 'processor' | 'exporter';

  // Module capabilities
  inputs: PortDefinition[];
  outputs: PortDefinition[];

  // Dependencies
  requires: string[];

  // Registration
  serviceClass: string;
  uiComponent?: string;
}

export interface PortDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

// Example module manifest
export const BMC_ANALYZER_MANIFEST: ModuleManifest = {
  id: 'bmc-analyzer',
  name: 'Business Model Canvas Analyzer',
  version: '1.0.0',
  description: 'Analyzes business model using BMC framework',
  type: 'analyzer',
  inputs: [
    { name: 'businessContext', type: 'BusinessContext', required: true, description: 'Business description and context' },
    { name: 'marketData', type: 'MarketResearch', required: false, description: 'Optional market research data' },
  ],
  outputs: [
    { name: 'bmcAnalysis', type: 'BMCAnalysis', required: true, description: 'Complete BMC analysis' },
    { name: 'insights', type: 'StrategicInsights', required: true, description: 'Strategic insights from analysis' },
  ],
  requires: ['llm-provider', 'research-service'],
  serviceClass: 'BMCAnalyzer',
  uiComponent: 'BMCAnalysisView',
};
```

### 8.3 Journey Configuration

```yaml
# journeys/business-model-innovation.yaml
id: business_model_innovation
name: Business Model Innovation Journey
version: "1.0"
description: Comprehensive business model analysis and planning

modules:
  - id: input-processor
    config:
      requireClarification: true
      detectAmbiguity: true

  - id: bmc-analyzer
    config:
      depth: comprehensive
      includeCompetitors: true

  - id: five-whys-executor
    config:
      maxDepth: 5

  - id: epm-generator
    config:
      useMultiAgent: true
      applyCPM: true

pageSequence:
  - path: /strategic-consultant
    module: input-processor

  - path: /strategic-consultant/clarify
    module: input-processor
    condition: needsClarification

  - path: /strategic-consultant/research
    module: bmc-analyzer

  - path: /strategic-consultant/whys-tree
    module: five-whys-executor

  - path: /strategy-workspace
    module: epm-generator

transitions:
  - from: input-processor
    to: bmc-analyzer
    condition: inputComplete

  - from: bmc-analyzer
    to: five-whys-executor
    condition: analysisComplete

  - from: five-whys-executor
    to: epm-generator
    condition: whysComplete
```

### 8.4 Module Registry Service

```typescript
// server/modules/registry.ts
export class ModuleRegistry {
  private modules: Map<string, ModuleManifest> = new Map();
  private journeys: Map<string, JourneyConfig> = new Map();

  registerModule(manifest: ModuleManifest): void {
    this.validateManifest(manifest);
    this.modules.set(manifest.id, manifest);
  }

  loadJourney(config: JourneyConfig): void {
    // Validate all referenced modules exist
    for (const moduleRef of config.modules) {
      if (!this.modules.has(moduleRef.id)) {
        throw new Error(`Journey '${config.id}' references unknown module '${moduleRef.id}'`);
      }
    }
    this.journeys.set(config.id, config);
  }

  getModule(id: string): ModuleManifest | undefined {
    return this.modules.get(id);
  }

  getJourney(id: string): JourneyConfig | undefined {
    return this.journeys.get(id);
  }

  listModules(): ModuleManifest[] {
    return Array.from(this.modules.values());
  }

  listJourneys(): JourneyConfig[] {
    return Array.from(this.journeys.values());
  }
}
```

### 8.5 Acceptance Criteria

- [ ] Module manifest schema defined
- [ ] Existing analyzers/generators have manifests
- [ ] Journey configuration schema defined
- [ ] At least one journey converted to config-based definition
- [ ] Module registry service implemented
- [ ] API endpoints for listing modules and journeys

---

## 9. Technical Specifications

### 9.1 Coding Standards

```typescript
// File naming
- Use kebab-case for files: `epm-generator.ts`
- Use PascalCase for classes: `EPMGenerator`
- Use camelCase for functions/variables: `generateProgram`

// File structure
- Maximum 400 lines per file
- Maximum 50 lines per function
- Maximum 5 parameters per function

// Imports
- Group imports: external, internal, types
- Use barrel exports (index.ts)
- No circular imports

// Types
- No `any` without explicit justification comment
- Use strict null checks
- Define interfaces for all public APIs
```

### 9.2 Error Handling

```typescript
// Custom error classes
export class PremisiaError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PremisiaError';
  }
}

export class ValidationError extends PremisiaError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends PremisiaError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ServiceUnavailableError extends PremisiaError {
  constructor(service: string, reason?: string) {
    super(`Service unavailable: ${service}${reason ? ` - ${reason}` : ''}`, 'SERVICE_UNAVAILABLE', 503);
    this.name = 'ServiceUnavailableError';
  }
}
```

### 9.3 Logging Standards

```typescript
// Use structured logging
import { logger } from '../utils/logger';

// Log levels
logger.debug('Detailed debugging info', { data });
logger.info('Normal operations', { action, result });
logger.warn('Warning conditions', { issue, context });
logger.error('Error conditions', { error, stack, context });

// Required context for all logs
{
  requestId: string;      // Trace ID for request
  userId?: string;        // User if authenticated
  service: string;        // Service name
  action: string;         // What operation
  duration?: number;      // How long it took
}
```

---

## 10. Testing Requirements

### 10.1 Test Coverage Targets

| Layer | Minimum Coverage |
|-------|-----------------|
| Repositories | 90% |
| Services | 80% |
| Route Handlers | 70% |
| Utilities | 90% |

### 10.2 Test Structure

```
tests/
├── unit/
│   ├── services/
│   │   ├── epm-generator.spec.ts
│   │   └── export-service.spec.ts
│   ├── repositories/
│   │   └── epm-repository.spec.ts
│   └── utils/
│       └── validators.spec.ts
├── integration/
│   ├── routes/
│   │   └── strategic-consultant.spec.ts
│   └── journeys/
│       └── bmc-journey.spec.ts
└── e2e/
    └── full-journey.spec.ts
```

### 10.3 Test Patterns

```typescript
// Unit test with mocked dependencies
describe('EPMGenerator', () => {
  let generator: EPMGenerator;
  let mockRepository: jest.Mocked<EPMRepository>;
  let mockWBSBuilder: jest.Mocked<WBSBuilder>;

  beforeEach(() => {
    mockRepository = createMock<EPMRepository>();
    mockWBSBuilder = createMock<WBSBuilder>();
    generator = new EPMGenerator(mockRepository, mockWBSBuilder);
  });

  it('should generate program with workstreams', async () => {
    mockWBSBuilder.buildWBS.mockResolvedValue(mockWBS);
    mockRepository.createWithWorkstreams.mockResolvedValue(mockProgram);

    const result = await generator.generate(mockInsights, mockOptions);

    expect(result).toBeDefined();
    expect(mockWBSBuilder.buildWBS).toHaveBeenCalledWith(mockInsights, expect.any(Object));
    expect(mockRepository.createWithWorkstreams).toHaveBeenCalled();
  });
});
```

---

## 11. Risk Mitigation

### 11.1 Identified Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Regression during refactoring | High | High | Comprehensive tests before each phase |
| Service disruption | Medium | High | Feature flags for gradual rollout |
| Timeline overrun | Medium | Medium | Prioritize critical paths, defer nice-to-haves |
| Team unfamiliarity with patterns | Medium | Medium | Documentation, code reviews, pairing |

### 11.2 Rollback Strategy

Each phase should be independently deployable and rollback-able:

1. **Feature flags** for new module implementations
2. **Database migrations** must be reversible
3. **API versioning** for breaking changes
4. **Blue-green deployment** for zero-downtime updates

---

## 12. Acceptance Criteria

### 12.1 Phase Completion Checklist

#### Phase 1 Complete When:
- [ ] All type definition files exist and are used
- [ ] DI container functional with tests
- [ ] Configuration centralized
- [ ] CI passes with no new `any` types

#### Phase 2 Complete When:
- [ ] Monolithic route files under 500 lines
- [ ] Each new route file under 300 lines
- [ ] All routes use consistent patterns
- [ ] Integration tests pass

#### Phase 3 Complete When:
- [ ] Service files under 400 lines
- [ ] Base classes created and used
- [ ] Services registered in DI container
- [ ] Unit tests for all services

#### Phase 4 Complete When:
- [ ] Repository layer implemented
- [ ] No direct db imports outside repositories
- [ ] Repository tests with mocks
- [ ] Services use repositories

#### Phase 5 Complete When:
- [ ] Module manifest system functional
- [ ] One journey runs from config
- [ ] Module registry API available
- [ ] Documentation complete

### 12.2 Final Acceptance

The modularization initiative is complete when:

1. **Health score improved**: From 5.2/10 to 8.0/10
2. **No file exceeds 800 lines**
3. **`any` types reduced by 90%** (from 897 to <100)
4. **Direct db imports eliminated** from services/routes
5. **Test coverage meets targets**
6. **New journey can be added via config** without code changes
7. **Documentation updated** to reflect new architecture

---

## Appendix: File Inventory

### Files to Split (Priority Order)

1. `server/services/export-service.ts` (4,192 lines) → 8 files
2. `server/routes/strategic-consultant.ts` (2,790 lines) → 5 files
3. `server/intelligence/epm-synthesizer.ts` (2,197 lines) → 9 files
4. `server/routes.ts` (1,957 lines) → 4 files
5. `client/src/pages/home-page.tsx` (1,652 lines) → 4 components
6. `client/src/pages/strategic-consultant/WhysTreePage.tsx` (1,603 lines) → 3 components

### Files to Create

```
server/
├── types/
│   ├── api-responses.ts
│   ├── epm.ts
│   ├── journey.ts
│   └── index.ts
├── config/
│   └── index.ts
├── services/
│   ├── container.ts
│   └── export/
│       ├── index.ts
│       ├── interfaces.ts
│       ├── base-exporter.ts
│       ├── pdf-exporter.ts
│       ├── docx-exporter.ts
│       ├── excel-exporter.ts
│       └── zip-packager.ts
├── intelligence/
│   ├── epm/
│   │   ├── index.ts
│   │   ├── interfaces.ts
│   │   ├── context-builder.ts
│   │   ├── workstream-generator.ts
│   │   ├── timeline-calculator.ts
│   │   ├── resource-allocator.ts
│   │   └── validator.ts
│   └── frameworks/
│       ├── base-analyzer.ts
│       └── analyzer-factory.ts
├── repositories/
│   ├── index.ts
│   ├── base-repository.ts
│   ├── epm-repository.ts
│   ├── strategy-repository.ts
│   └── journey-repository.ts
├── routes/
│   └── strategic-consultant/
│       ├── index.ts
│       ├── input-routes.ts
│       ├── analysis-routes.ts
│       ├── research-routes.ts
│       ├── generation-routes.ts
│       └── export-routes.ts
└── modules/
    ├── manifest.ts
    └── registry.ts
```

---

**Document Version:** 1.0
**Last Updated:** January 21, 2026
**Authors:** Claude (AI Assistant), Codex (AI Assistant)
**Approved By:** [Pending]
