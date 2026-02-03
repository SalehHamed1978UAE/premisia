# Overview
Premisia is an AI-enhanced, full-stack web application for comprehensive enterprise program management. Its core purpose is to transform plain-language business challenges into fully structured EPM programs, leveraging AI-driven strategic analysis frameworks (e.g., PESTLE, Porter's, SWOT, Five Whys, BMC). The project aims to provide a holistic solution for strategic decision-making and EPM integration through real-time AI intelligence, a multi-agent architecture, and a formal ontology. It generates complete EPM programs including tasks, resources, risks, benefits, KPIs, and financials.

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
The frontend uses React, TypeScript, and Vite, with Shadcn/ui (Radix UI and Tailwind CSS) for a themeable "New York" style UI. It features a mobile-first responsive design, including a breakpoint system, adaptive layouts, responsive typography, skeleton loading, and toast notifications. The sidebar uses a compact, three-zone layout.

## Technical Implementations
- **Frontend**: React, TypeScript, Vite, TanStack Query, Wouter.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication, Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver and Drizzle ORM for type-safe schema and Zod validation.
- **Authentication/Authorization**: Session-based authentication via Passport.js with Replit OIDC, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer).
- **AI Multi-Agent System**: An ontology-based architecture with Executive, Builder, QA Specialist Agents, and a Multi-Agent Orchestrator.
- **Strategic Consultant & EPM Integration**: Converts executive input into AI-analyzed strategic decisions and EPM program structures, supporting Five Whys AI-coaching, Anti-Confirmation Bias Research, Version Management, and Intelligent Framework Selection.
- **EPM V2 Engine**: Generates EPM programs with industry-appropriate content, proper FTE decimals, validated dependencies, and context-aware risks/benefits. Features LLM-driven workstream owner assignment using `RoleInferenceService` (batch inference, caching, deduplication, fallback to keyword-based heuristics).
- **Business Model Canvas (BMC) Analysis**: Full 9-block implementation with query generation, parallel research, and cross-block consistency validation.
- **Strategic Understanding Service**: Uses PostgreSQL with `pgvector` for entity categorization, relationship mapping, semantic search, and contradiction validation.
- **Journey-Based Strategic Analysis**: Guides users through interactive sequences for strategic frameworks with backend-controlled orchestration via an Orchestrator-driven `pageSequence`.
- **Modular Framework Renderer Architecture**: An extensible system for displaying analysis results, supported by a `Module Factory System` with 20 registered modules (e.g., SWOT, BMC, Porter's, PESTLE, Five Whys, Ansoff, Blue Ocean, Segment Discovery, EPM Generator).
- **Universal Background Jobs System**: A hybrid system for tracking long-running operations with database persistence and real-time SSE streaming, used for Document Intelligence Enrichment (extracting knowledge from uploaded documents).
- **Full-Pass Export System**: Generates ZIP bundles containing strategic analysis and EPM program data in multiple formats.
- **Robustness**: Features multi-provider AI fallback, extended socket timeouts, and request throttling.

# Recent Bug Fixes

## EPM Export Quality Fixes (Jan 31, 2026)
- **Problem**: Export package missing decisions, assignments, risk owners, and proper severity calculations
- **Fixes Applied**:
  - Assignment enum mismatch: Changed `'internal'/'external'/'team'` to `'internal_team'/'external_resource'` in `assignment-generator.ts` to match database enum
  - Decisions persistence: Modified `base-exporter.ts` to fetch decisions from `strategy_decisions` table using `strategyVersionId`
  - Risk owners: Added `assignRiskOwners()` method in `generators.ts` and called it in `epm-synthesizer.ts` for both paths
  - Severity calculation: Fixed CSV exporter to properly calculate and label severity from probability × impact
  - Program naming: Added journeyTitle priority check with trimming in `ProgramNameGenerator`
- **Files**: `server/intelligence/epm/assignment-generator.ts`, `server/services/export/base-exporter.ts`, `server/intelligence/epm/generators.ts`, `server/intelligence/epm-synthesizer.ts`, `server/services/export/csv-exporter.ts`

## EPM Generation Fix for Journey Analysis (Jan 31, 2026)
- **Problem**: EPM generation failed with "No strategic analysis available" even though SWOT/PESTLE/Porter's analysis was complete
- **Root Cause**: EPM generator's `getAggregatedAnalysis()` queries `framework_insights` table, but journey executors store analysis in `strategy_versions.analysis_data` instead
- **Fix**: Added fallback in `strategy-workspace.ts` to check for journey-based analysis data (swot, pestle, porters) in `analysisData` when aggregator returns nothing
- **Files**: `server/routes/strategy-workspace.ts`, `server/intelligence/analysis-aggregator.ts`
- **Exported**: `normalizeSWOT` function from analysis-aggregator for journey data normalization

## SWOT → Decisions Bridge Fix (Jan 31, 2026)
- **Problem**: Market Entry journey shows empty "Strategic Choices" form instead of AI-generated decision cards
- **Root Cause**: `frameworkRegistry.execute()` wraps results in `{data: executorOutput}`, but code extracted `swotResult?.output` which doesn't exist. Actual SWOT data is at `swotResult.data.output`
- **Fix**: Updated data extraction in `strategic-consultant-legacy.ts` (lines 2454, 3576) to use `swotResult?.data?.output` first
- **Validation**: Added checks for error-shaped output and array validation before calling DecisionGenerator
- **Files**: `server/routes/strategic-consultant-legacy.ts`

## Porter's & SWOT "Data Error" Bug (Jan 31, 2026)
- **Problem**: Porter's and SWOT results pages showed "Data Error" despite backend completing successfully
- **Root Cause**: Both pages used `apiRequest()` which returns raw Response object without calling `.json()`
- **Fix**: Changed to `fetch().json()` like PESTLE, plus robust data extraction
- **Files**: `client/src/pages/strategic-consultant/PortersResultsPage.tsx`, `client/src/pages/strategic-consultant/SWOTResultsPage.tsx`

## Journey Navigation & Session Lookup Fixes (Feb 3, 2026)
- **Problem 1**: Business Model Innovation showed "Journey session not found" error when transitioning from Five Whys to Research
- **Root Cause**: URL sessionId might be an understanding session ID, not journey session ID
- **Fix**: Added fallback lookup using `getJourneySessionByUnderstandingSessionId()` in `/journey-research/stream/:sessionId` endpoint
- **Problem 2**: Digital Transformation, Competitive Strategy, Growth Strategy had broken pageSequence with invalid intermediate pages
- **Root Cause**: pageSequence referenced `/strategic-consultant/research/:sessionId` and `/strategic-consultant/framework-insight/:sessionId` which don't exist as proper results pages
- **Fix**: Simplified pageSequence to use unified research flow: input → research → decisions → prioritization
- **Problem 3**: Framework insights not persisting due to FK constraint violations
- **Root Cause**: Code used URL `sessionId` instead of `journeySession.id` for frameworkInsights FK
- **Fix**: Changed to use `journeySession.id` for frameworkInsights sessionId field
- **Files**: `server/routes/strategic-consultant-legacy.ts`, `server/journey/journey-registry.ts`

# Journey Architecture

All journeys share: **Input → Disambiguation → Business Type → [Frameworks] → Strategic Decisions → Priorities → EPM**

| Journey | Frameworks | Status |
|---------|------------|--------|
| Market Entry Strategy | PESTLE → Porter's → SWOT | ✅ Implemented |
| Business Model Innovation | Five Whys → BMC | ✅ Implemented |
| Market Segmentation Discovery | Segment Discovery | ✅ Implemented |
| Custom Journey | User-selected | ✅ Implemented |
| Crisis Recovery | Five Whys → SWOT → BMC | ✅ Implemented (Feb 1, 2026) |
| Competitive Strategy | Porter's → BMC → Blue Ocean | ✅ Implemented (Feb 1, 2026) |
| Digital Transformation | PESTLE → BMC → Ansoff | ✅ Implemented (Feb 1, 2026) |
| Growth Strategy | PESTLE → Ansoff → BMC | ✅ Implemented (Feb 1, 2026) |

## Bridge Registry (11 bridges)
Bridges transform output from one framework into context for the next:
- `five_whys_to_bmc`: Root cause analysis → Business Model Canvas
- `pestle_to_porters`: Macro environment → Industry structure  
- `porters_to_swot`: Industry forces → SWOT synthesis
- `five_whys_to_swot`: Root causes → SWOT threats/opportunities (Crisis Recovery)
- `swot_to_bmc`: Strategic insights → Business model adaptation (Crisis Recovery)
- `porters_to_bmc`: Competitive forces → Business model design (Competitive Strategy)
- `bmc_to_blue_ocean`: Business model → Blue Ocean strategy (Competitive Strategy)
- `pestle_to_bmc`: Macro trends → Business model opportunities (Digital Transformation)
- `bmc_to_ansoff`: Business model → Growth strategy matrix (Digital Transformation)
- `pestle_to_ansoff`: Macro trends → Growth opportunities (Growth Strategy)
- `ansoff_to_bmc`: Growth strategy → Business model optimization (Growth Strategy)

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