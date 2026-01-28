# Premisia - Current Status Report

**Date:** January 28, 2026

---

## What is Premisia?

**Premisia** is an AI-powered enterprise program management (EPM) platform that converts strategic thinking into executable project plans. It bridges the gap between "what we want to achieve" (strategy) and "how we'll get there" (program structure).

**Core value proposition:** A business owner describes their goals → Premisia's AI analyzes the strategy using established frameworks → outputs a complete program plan with workstreams, timelines, resources, budgets, risks, and KPIs.

---

## How It Works

### The Journey Flow

```
User Input (business context, goals)
    ↓
Strategic Analysis Frameworks (SWOT, Porter's, PESTLE, BMC, etc.)
    ↓
Strategic Decisions (AI-synthesized recommendations)
    ↓
EPM Program Structure (workstreams, resources, timeline, risks, KPIs)
    ↓
Exports (Excel, PDF, ZIP bundles)
```

### Key Components

| Component | Purpose |
|-----------|---------|
| **Journey Builder** | User selects/creates analysis journey (7 pre-built + custom) |
| **Framework Analyzers** | 16 AI-powered modules (SWOT, BMC, Porter's, PESTLE, Five Whys, Ansoff, Blue Ocean, BCG Matrix, Value Chain, VRIO, Scenario Planning, JTBD, Competitive Positioning, Segment Discovery, Marketing Consultant, OKR Generator) |
| **Strategic Decisions** | AI synthesizes framework results into actionable decisions |
| **EPM Synthesizer** | Converts decisions into 14-component program structure |
| **Validation System** | Quality gates with modular validators (Dependency, Industry, Completeness) |
| **Export Service** | Generates downloadable program documents (Excel, PDF, ZIP) |

---

## What We've Built

### Completed Features

**Frontend (React/TypeScript/Vite):**
- Strategic Consultant wizard (intake → analysis → decisions → EPM)
- Journey Builder with 7 pre-defined journeys + custom journey creation
- Framework Insight pages for each analyzer
- Strategies Hub for viewing all initiatives
- EPM Program View with 7 tabs (Overview, Schedule, Resources, Budget, Risks, KPIs, Deliverables)
- 14 specialized EPM display formatters
- Dark mode theming with Shadcn/ui
- Non-blocking progress UX (MinimizedJobTracker)

**Backend (Node.js/Express):**
- 20 registered modules in Module Factory System
- Journey Orchestrator for executing custom journeys
- Background Jobs System with SSE streaming
- AWS KMS encryption for sensitive business data
- PostgreSQL with pgvector for semantic search
- Multi-provider AI fallback (OpenAI, Anthropic, Gemini)
- Context Foundry integration for grounded analysis
- Geographic disambiguation via OpenStreetMap
- Document Intelligence (PDF, DOCX, Excel extraction)

**Data & Security:**
- Enterprise-grade encryption (AES-256-GCM)
- Role-based access (Admin/Editor/Viewer)
- Cross-user data isolation
- Automated regression testing (Golden Records)

---

## Recent Enhancements (January 28, 2026)

### Phase 0: EPM Quality Bug Fixes - COMPLETED

| Bug | Fix Applied | File |
|-----|-------------|------|
| **Generic Risk Mitigations** | Keyword-based specific mitigations using `generateMitigation()` method | `generators.ts` |
| **Unmeasurable KPIs** | `generateMeasurableTarget()` produces numeric targets based on benefit type | `generators.ts` |
| **FTE as Percentages** | Converted 100→1.0, 75→0.75, 50→0.5 across all allocations | `resource-allocator.ts` |
| **Template Contamination** | Industry detection with 10 keyword dictionaries (food_service, healthcare, finance, etc.) | `validator.ts` |
| **Invalid Dependencies** | Existing `EPMValidator.validateDependencies()` + new modular DependencyValidator | `validators/` |

### Phase 1: Validation Architecture - COMPLETED

New modular validator system at `server/intelligence/epm/validators/`:

| Component | Purpose |
|-----------|---------|
| `base-validator.ts` | Abstract BaseValidator class with ValidatorContext, ValidatorIssue, ValidatorResult |
| `validator-registry.ts` | ValidatorRegistry for managing validators with runAll/runSelected methods |
| `dependency-validator.ts` | Circular dependency detection, timing validation, auto-correction |
| `industry-validator.ts` | Cross-industry contamination detection (10 industry keyword sets) |
| `completeness-validator.ts` | Required field validation for workstreams, timeline, stage gates |
| `quality-gate-runner.ts` | Orchestrator producing QualityReport with issue counts and corrections |

### Phase 2: Export Services - COMPLETED

**Excel Exporter** (`server/services/export/excel-exporter.ts`):
- 8 professional sheets: Summary, WBS, Schedule, Resources, Budget, RACI, Risks, Assumptions
- Proper JSONB parsing and column width formatting
- Currency formatting and FTE calculations

**Export API Endpoints** (`server/routes/exports.ts`):
- `GET /api/exports/full-pass` - ZIP bundle with all formats
- `GET /api/exports/excel` - Individual Excel workbook download
- `GET /api/exports/pdf` - Individual PDF report download
- Consistent `resolveSessionId()` returning `understanding.id` for understandingId consistency
- Clear 404 error when no EPM program exists

---

## Challenges Faced & Resolved

| Challenge | Resolution |
|-----------|------------|
| **404 Race Condition** | Frontend now polls for `nextStepRedirectUrl` (~55s) before navigation; backend validation gate ensures `strategy_versions` row exists before URL returned |
| **Session ID Inconsistency** | All `strategy_versions` records now use `understandingId` (not `executionId`) ensuring DecisionPage queries work |
| **Module Load Crashes** | Two-phase auth initialization with lazy route loading prevents crashes when secrets missing |
| **BMC SSE Resilience** | 'system' user fallback when auth context missing for AI-generated decisions |
| **Journey Title vs AI-Generated Names** | EPM programs now use journey titles correctly |
| **Generic Risk Mitigations** | Keyword-based specific mitigations replace template strings |
| **Unmeasurable KPIs** | Numeric targets generated based on benefit type patterns |

---

## Technical Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, TanStack Query, Wouter, Shadcn/ui |
| Backend | Node.js, Express.js, Passport.js, Drizzle ORM |
| Database | PostgreSQL (Neon) with pgvector |
| AI | OpenAI, Anthropic, Gemini (multi-provider fallback) |
| Security | AWS KMS, AES-256-GCM, Replit OIDC |
| Build | Vite, esbuild |
| Exports | xlsx (Excel), Puppeteer (PDF), archiver (ZIP) |

---

## Key Files Reference

| Purpose | File Path |
|---------|-----------|
| EPM Generation | `server/intelligence/epm/generators.ts` |
| Resource Allocation | `server/intelligence/epm/resource-allocator.ts` |
| EPM Validation | `server/intelligence/epm/validator.ts` |
| Modular Validators | `server/intelligence/epm/validators/` |
| Excel Export | `server/services/export/excel-exporter.ts` |
| Export Routes | `server/routes/exports.ts` |
| Journey Orchestration | `server/journey/journey-orchestrator.ts` |
| Framework Analyzers | `server/intelligence/*.ts` |
| Frontend Pages | `client/src/pages/strategic-consultant/` |
| Schema | `shared/schema.ts` |
| Project Docs | `replit.md` |

---

## Future Enhancements

- Wire QualityGateRunner into EPM synthesis pipeline
- Real-time collaboration
- Integration with external EPM tools (Jira, MS Project, Monday.com)
- Advanced scenario planning with Monte Carlo simulation
- Portfolio-level program management
