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
| **Export Service** | Generates downloadable program documents |

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

## Challenges Faced & Resolved

| Challenge | Resolution |
|-----------|------------|
| **404 Race Condition** | Frontend now polls for `nextStepRedirectUrl` (~55s) before navigation; backend validation gate ensures `strategy_versions` row exists before URL returned |
| **Session ID Inconsistency** | All `strategy_versions` records now use `understandingId` (not `executionId`) ensuring DecisionPage queries work |
| **Module Load Crashes** | Two-phase auth initialization with lazy route loading prevents crashes when secrets missing |
| **BMC SSE Resilience** | 'system' user fallback when auth context missing for AI-generated decisions |
| **Journey Title vs AI-Generated Names** | EPM programs now use journey titles correctly |

---

## Current Challenges (EPM Quality Issues)

These are the bugs we're about to fix:

| Bug | Current State | Impact |
|-----|---------------|--------|
| **Generic Risk Mitigations** | All say "Monitor and implement controls..." | Useless advice |
| **Unmeasurable KPIs** | Target = "Improvement" | Can't track progress |
| **FTE as Percentages** | Shows `100` instead of `1.0` | Confusing resource allocation |
| **Template Contamination** | Sneaker store gets "Food Safety" workstreams | Wrong industry content |
| **Invalid Dependencies** | WS002 depends on WS001 but both start Month 1 | Illogical schedule |
| **Benefits = SWOT Copy** | Just copies opportunities verbatim | No transformation |

---

## Development Roadmap

### Phase 0: Quick Bug Fixes (Current Priority)
- [ ] Task 0.1: Fix generic risk mitigations → specific keyword-based mitigations
- [ ] Task 0.2: Fix "Improvement" KPIs → measurable numeric targets
- [ ] Task 0.3: Fix FTE 100 → 1.0 normalization
- [ ] Task 0.4: Add dependency timing validation
- [ ] Task 0.5: Add industry contamination detection

### Phase 1: Validation Layer
- Reusable validator modules (Dependency, Industry, Completeness, FTE)
- Quality Gate Runner integrating all validators

### Phase 2: Enhanced Prompts
- Industry-specific workstream prompts
- Concrete risk mitigation prompts
- Measurable KPI prompts

### Phase 3-5: Export Enhancements
- Professional Excel export (8 sheets: Summary, WBS, Schedule, Resources, Budget, RACI, Risks, Assumptions)
- PDF Executive Summary
- Export Controller API

### Future Enhancements
- Real-time collaboration
- Integration with external EPM tools (Jira, MS Project, Monday.com)
- Advanced scenario planning with Monte Carlo simulation
- Portfolio-level program management

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

---

## Key Files Reference

| Purpose | File Path |
|---------|-----------|
| EPM Generation | `server/intelligence/epm/generators.ts` |
| Resource Allocation | `server/intelligence/epm/resource-allocator.ts` |
| Journey Orchestration | `server/journey/journey-orchestrator.ts` |
| Framework Analyzers | `server/intelligence/*.ts` |
| Frontend Pages | `client/src/pages/strategic-consultant/` |
| Schema | `shared/schema.ts` |
| Project Docs | `replit.md` |
