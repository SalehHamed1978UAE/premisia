# Overview
Premisia is an AI-enhanced, full-stack web application designed for comprehensive enterprise program management. It covers the entire program lifecycle, from program and task management to tracking resources, risks, benefits, KPIs, and financials through an intuitive dashboard. The project's core purpose is to provide a holistic solution for strategic decision-making and EPM integration, leveraging real-time AI intelligence, a multi-agent architecture, and a formal ontology for expert guidance.

The primary value proposition is to transform a user's plain-language business challenge into a fully structured EPM program. This is achieved by sequentially applying AI-driven strategic analysis frameworks (e.g., PESTLE, Porter's, SWOT, Five Whys, BMC), where insights from one framework inform the next. The outcome is a complete EPM program, including tasks, resources, risks, benefits, KPIs, and financials.

# User Preferences
Preferred communication style: Simple, everyday language.

**Development Philosophy:**
- No band-aid fixes or workarounds (e.g., making fields nullable to bypass foreign key constraints)
- Always fix root architectural issues properly the first time
- Take time to understand the proper data flow before implementing fixes
- Clean separation of concerns - don't mix old and new system architectures

**UI Styling Standards:**
- All popups, dropdowns, and overlays MUST have solid opaque backgrounds - never transparent
- Use CSS variables from index.css (e.g., `bg-popover`, `text-popover-foreground`) - never inline hardcoded colors
- Dark mode popover color is `--popover: 222 47% 8%` (solid dark) - defined in `.dark` class in index.css
- When fixing a styling issue, fix it at the root (CSS variables or component defaults) not per-page
- Shadcn component defaults are the source of truth - don't override in individual pages unless necessary

# System Architecture

## UI/UX Decisions
The frontend uses React, TypeScript, and Vite, with Shadcn/ui (Radix UI and Tailwind CSS) for a themeable "New York" style UI. It is a single-page application with a mobile-first responsive design, featuring a breakpoint system, adaptive layouts, responsive typography, skeleton loading, and toast notifications. The sidebar uses a compact, three-zone layout for optimal visibility.

## Technical Implementations
- **Frontend**: React, TypeScript, Vite, TanStack Query, Wouter.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication, Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver and Drizzle ORM for type-safe schema and Zod validation.
- **Authentication/Authorization**: Session-based authentication via Passport.js with Replit OIDC, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer).
- **Background Jobs**: A hybrid system with database persistence and real-time tracking, using a `Modular Framework Executor Registry` for a plugin system for strategic analysis frameworks.
- **Enterprise Data Encryption**: AWS KMS envelope encryption with AES-256-GCM secures sensitive business data at rest.
- **Journey Navigation**: Orchestrator-driven entry points with `pageSequence` define navigation flows.
- **Context Foundry Integration**: Provides grounded analysis by querying verified organizational facts from Context Foundry, constraining LLM responses with verified data and source citations.
- **AI Multi-Agent System**: An ontology-based architecture involving Executive, Builder, QA Specialist Agents, and a Multi-Agent Orchestrator.
- **Strategic Consultant & EPM Integration**: Converts executive input into AI-analyzed strategic decisions and EPM program structures, including Five Whys AI-coaching, Anti-Confirmation Bias Research, Version Management, and Intelligent Framework Selection.
- **EPM V2 Engine**: A backend-only migration using Journey Builder's EPMSynthesizer for generating EPM programs with industry-appropriate content, proper FTE decimals, validated dependencies, and context-aware risks/benefits.
- **Business Model Canvas (BMC) Analysis**: A full 9-block implementation with query generation, parallel research, and cross-block consistency validation.
- **Strategic Understanding Service**: Uses PostgreSQL with `pgvector` for entity categorization, relationship mapping, semantic search, and contradiction validation.
- **Robustness**: Features multi-provider AI fallback, extended socket timeouts, and request throttling.
- **Journey-Based Strategic Analysis**: Guides users through interactive sequences for strategic frameworks with backend-controlled orchestration.
- **Modular Framework Renderer Architecture**: An extensible system for displaying analysis results.
- **Strategy Intelligence Layer**: The core AI engine for converting strategic frameworks into executable EPM programs.
- **Journey Builder System**: Allows users to choose from 7 pre-defined journeys or create custom ones with AI validation.
- **Universal Background Jobs System**: A hybrid system for tracking long-running operations with database persistence and real-time SSE streaming.
- **Full-Pass Export System**: Generates ZIP bundles containing strategic analysis and EPM program data in multiple formats.
- **Document Intelligence Enrichment**: A background job pipeline for asynchronously extracting knowledge from uploaded documents (PDF, DOCX, Excel, images) to populate the encrypted knowledge graph.
- **Strategies Hub**: A unified view for all strategic initiatives, providing artifact hierarchy and research provenance.
- **Journey Registry V2**: Centralized journey definitions with automatic summary generation, baseline reuse, intelligent readiness thresholds, and comprehensive test coverage.
- **Module Catalog & Journey Config System**: Treats analyzers/generators as modules and expresses journeys via YAML configuration for eventual GUI composition.
- **Module Factory System**: A unified module architecture with 20 registered modules (e.g., SWOT, BMC, Porter's, PESTLE, Five Whys, Ansoff, Blue Ocean, Segment Discovery, EPM Generator). It features a type registry, a `BaseModule` class, module validation, and module type classification.

# External Dependencies
- **Database Service**: Neon serverless PostgreSQL
- **Session Store**: `connect-pg-simple`
- **UI Libraries**: Radix UI, Tailwind CSS, Lucide React
- **Form Management/Validation**: `react-hook-form`, Zod
- **Date Utilities**: `date-fns`
- **Build Tools**: Vite, esbuild
- **AI Providers**: OpenAI, Anthropic, Gemini
- **ORM**: Drizzle ORM
- **Authentication**: Passport.js with Replit OIDC
- **Encryption**: AWS KMS
- **Knowledge Graph**: Context Foundry

---

# Current State (Last Updated: January 31, 2026)

## Fully Working Features

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | Working | Replit OIDC + DEV_AUTH_BYPASS for dev |
| Strategic Input Page | Working | Text input + document upload |
| AI Classification | Working | Auto-classifies user input type |
| Journey Selection | Working | Users choose from available journeys |
| Market Entry Journey | Working | PESTLE → Porter's → SWOT → Decisions |
| Business Model Innovation | Working | Five Whys → BMC → Decisions |
| PESTLE Analysis | Working | 30 trends across 6 factors (fixed Jan 31) |
| Porter's Five Forces | Working | Competitive analysis |
| SWOT Analysis | Working | Strengths/Weaknesses/Opportunities/Threats |
| Five Whys Analysis | Working | Root cause analysis with AI coaching |
| Business Model Canvas | Working | Full 9-block implementation |
| Strategic Decisions | Working | Convert analysis to actionable decisions |
| EPM Program Generation | Working | V2 Engine with industry-appropriate content |
| Background Jobs | Working | Real-time SSE streaming + database persistence |
| Document Intelligence | Working | Extract knowledge from uploaded documents |
| Encryption | Working | AWS KMS envelope encryption (AES-256-GCM) |
| Custom Journeys | Working | Users can create custom framework sequences |
| Strategies Hub | Working | Unified view of all strategic initiatives |
| Export System | Working | ZIP bundles with multiple formats |

## Partially Implemented / Placeholders

| Feature | Status | What's Missing |
|---------|--------|----------------|
| Competitive Strategy Journey | Placeholder | Porter's → BMC → Blue Ocean not wired |
| Digital Transformation Journey | Placeholder | PESTLE → BMC → Ansoff not wired |
| Crisis Recovery Journey | Placeholder | Five Whys → SWOT → BMC not wired |
| Growth Strategy Journey | Placeholder | Ansoff → BCG → Scenario Planning not wired |
| Context Foundry | Partial | Needs BMC/Segment Discovery integration |
| Neo4j Knowledge Graph | Disabled | Connection failing (non-blocking) |
| Marketing Consultant | Beta | Segment Discovery works, needs polish |

---

# Recent Bug Fixes

## PESTLE Rendering Bug (Fixed Jan 31, 2026)
- **Problem**: PESTLE results showed "0 trends" despite backend generating valid data
- **Root Cause**: API response nested at `data.data.data.pestleResults` but frontend extracted only to `data.data.data`
- **Fix**: Added robust data extraction in `PESTLEResultsPage.tsx` handling multiple response shapes
- **File**: `client/src/pages/strategic-consultant/PESTLEResultsPage.tsx`

---

# Available Journeys

## Implemented
1. **Business Model Innovation**: Input → Five Whys → BMC → Decisions → EPM (30-35 min)
2. **Market Entry Strategy**: Input → PESTLE → Porter's → SWOT → Decisions → EPM (15-20 min)
3. **Market Segmentation Discovery**: Input → Segment Discovery → Results
4. **Custom Journeys**: User-selected framework combinations

## Placeholders (executors exist, wiring needed)
5. **Competitive Strategy**: Porter's → BMC → Blue Ocean
6. **Digital Transformation**: PESTLE → BMC → Ansoff
7. **Crisis Recovery**: Five Whys → SWOT → BMC
8. **Growth Strategy**: Ansoff → BCG → Scenario Planning

---

# Module Inventory (20 Registered)

- **AI Analyzers (12)**: SWOT, BMC, Porter's, PESTLE, Five Whys, Ansoff, Blue Ocean, BCG Matrix, Value Chain, VRIO, Scenario Planning, Competitive Positioning
- **User Input (1)**: Input Processor
- **Generators (3)**: OKR Generator, EPM Generator, Jobs-to-be-Done
- **Internal (4)**: Strategic Understanding, Strategic Decisions, Segment Discovery, Ocean Strategy

---

# Development Roadmap

## Phase 1: Stabilization (Current)
- [x] Fix PESTLE rendering bug - DONE
- [ ] Verify Porter's/SWOT have robust data extraction
- [ ] Test Market Entry journey end-to-end
- [ ] Test Business Model Innovation journey end-to-end

## Phase 2: Journey Completion
- [ ] Wire Competitive Strategy (Porter's → BMC → Blue Ocean)
- [ ] Wire Digital Transformation (PESTLE → BMC → Ansoff)
- [ ] Wire Crisis Recovery (Five Whys → SWOT → BMC)
- [ ] Wire Growth Strategy (Ansoff → BCG → Scenario Planning)

## Phase 3: Context Foundry Expansion
- [ ] Integrate into BMC 9-Block Analysis
- [ ] Integrate into Segment Discovery

## Phase 4: Knowledge Graph
- [ ] Fix Neo4j or implement alternative
- [ ] Add regulations query

## Phase 5: Marketing Consultant Polish
- [ ] Complete Segment Discovery workflow
- [ ] Add export capabilities

## Phase 6: Enterprise Features
- [ ] RBAC refinement
- [ ] Team collaboration
- [ ] Audit logging

---

# Key Files Reference

| Task | Files |
|------|-------|
| Add journey | `server/journey/journey-registry.ts` |
| Add framework | `server/journey/executors/`, `server/modules/registry.ts` |
| Fix results | `client/src/pages/strategic-consultant/*ResultsPage.tsx` |
| EPM output | `server/intelligence/epm/`, `server/strategic-consultant-v2/epm-adapter.ts` |
| API endpoints | `server/routes/` |
| UI styling | `client/src/index.css` |
| Background jobs | `server/workers/` |

---

# Architecture Diagram

```
FRONTEND (React)
├── /strategic-consultant
│   ├── InputPage.tsx          → User enters challenge
│   ├── ClassificationPage.tsx → AI classifies input
│   ├── JourneySelectionPage   → Pick journey type
│   ├── PESTLEResultsPage.tsx  → PESTLE results
│   ├── PortersResultsPage.tsx → Porter's Five Forces
│   └── SWOTResultsPage.tsx    → SWOT analysis
├── /strategy-workspace
│   ├── DecisionSummaryPage    → Review decisions
│   ├── PrioritizationPage     → Prioritize
│   └── EPMProgramView         → View EPM program
└── /journeys
    ├── JourneyHub.tsx         → Browse journeys
    └── JourneyBuilderWizard   → Create custom

BACKEND (Express)
├── server/journey/
│   ├── journey-orchestrator.ts  → Execute sequences
│   ├── journey-registry.ts      → Define journeys
│   └── executors/               → 17 framework executors
├── server/intelligence/epm/     → EPM generation
├── server/modules/              → 20 registered modules
└── server/services/             → Knowledge graph, export
```

---

# Environment

- **Frontend**: 0.0.0.0:5000 via Vite
- **Database**: Neon PostgreSQL (Drizzle ORM)
- **Auth**: Replit OIDC (DEV_AUTH_BYPASS=true for dev)
- **AI**: OpenAI, Anthropic, Gemini (multi-provider fallback)
- **Encryption**: AWS KMS
- **Session**: connect-pg-simple

---

# How to Pick Up Work

1. Read this file for context
2. Run the app and test current journeys
3. Pick a task from the roadmap
4. Create task list for multi-step work
5. Test with Playwright after changes