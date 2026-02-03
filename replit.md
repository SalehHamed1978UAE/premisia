# Overview
Premisia is an AI-enhanced, full-stack web application for comprehensive enterprise program management. It transforms plain-language business challenges into fully structured EPM programs using AI-driven strategic analysis frameworks (e.g., PESTLE, Porter's, SWOT, Five Whys, BMC). The project aims to provide a holistic solution for strategic decision-making and EPM integration through real-time AI intelligence, a multi-agent architecture, and a formal ontology, generating complete EPM programs including tasks, resources, risks, benefits, KPIs, and financials.

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
- **EPM V2 Engine**: Generates EPM programs with industry-appropriate content, proper FTE decimals, validated dependencies, and context-aware risks/benefits. Features LLM-driven workstream owner assignment using `RoleInferenceService`.
- **Business Model Canvas (BMC) Analysis**: Full 9-block implementation with query generation, parallel research, and cross-block consistency validation.
- **Strategic Understanding Service**: Uses PostgreSQL with `pgvector` for entity categorization, relationship mapping, semantic search, and contradiction validation.
- **Journey-Based Strategic Analysis**: Guides users through interactive sequences for strategic frameworks with backend-controlled orchestration.
- **Modular Framework Renderer Architecture**: An extensible system for displaying analysis results, supported by a `Module Factory System` with 20 registered modules (e.g., SWOT, BMC, Porter's, PESTLE, Five Whys, Ansoff, Blue Ocean, Segment Discovery, EPM Generator).
- **Universal Background Jobs System**: A hybrid system for tracking long-running operations with database persistence and real-time SSE streaming, used for Document Intelligence Enrichment.
- **Full-Pass Export System**: Generates ZIP bundles containing strategic analysis and EPM program data in multiple formats.
- **Robustness**: Features multi-provider AI fallback, extended socket timeouts, and request throttling.
- **Journey Architecture**: All journeys share a common flow: Input → Disambiguation → Business Type → [Frameworks] → Strategic Decisions → Priorities → EPM. Eleven bridges transform output from one framework into context for the next.

# Journey Architecture

All journeys share: **Input → Disambiguation → Business Type → [Frameworks] → Strategic Decisions → Priorities → EPM**

| Journey | Frameworks | Status |
|---------|------------|--------|
| Market Entry Strategy | PESTLE → Porter's → SWOT | ✅ Implemented |
| Business Model Innovation | Five Whys → BMC | ✅ Implemented |
| Market Segmentation Discovery | Segment Discovery | ✅ Implemented |
| Custom Journey | User-selected | ✅ Implemented |
| Crisis Recovery | Five Whys → SWOT → BMC | ✅ Implemented |
| Competitive Strategy | Porter's → BMC → Blue Ocean | ✅ Implemented |
| Digital Transformation | PESTLE → BMC → Ansoff | ✅ Implemented |
| Growth Strategy | PESTLE → Ansoff → BMC | ✅ Implemented |

## Bridge Registry (11 bridges)
- `five_whys_to_bmc`, `pestle_to_porters`, `porters_to_swot`, `five_whys_to_swot`, `swot_to_bmc`, `porters_to_bmc`, `bmc_to_blue_ocean`, `pestle_to_bmc`, `bmc_to_ansoff`, `pestle_to_ansoff`, `ansoff_to_bmc`

# Architecture Guidelines for AI Development

## Session ID Lookup Chain
There are multiple ID formats that must be properly resolved:

1. **URL Session ID** (`session-1234567890-abc`): Used in URLs, stored in `strategicUnderstanding.sessionId`
2. **Understanding UUID** (`a090eba2-...`): Primary key of `strategic_understanding` table
3. **Journey Session UUID** (`bd5468a0-...`): Primary key of `journey_sessions` table

**Important:** Functions may receive ANY of these ID formats. Always check all three paths:

**Lookup Logic (in order):**
```
1. Try URL format: strategicUnderstanding.sessionId = input → get understanding.id
2. Try journeySession.id: journeySessions.id = input → already a journey session UUID
3. Fallback: treat input as understanding.id directly (legacy)
```

The `getAggregatedAnalysis()` function handles all three cases. Don't assume one ID format works everywhere.

## Data Storage Patterns

| Data Type | Table | Column | Notes |
|-----------|-------|--------|-------|
| Framework Analysis Results | `framework_insights` | `insights` (encrypted) | Stored with `journeySession.id` as `sessionId` |
| Journey Analysis Summary | `strategy_versions` | `analysisData` (JSON) | Contains SWOT/PESTLE/Porter's for Market Entry flows |
| Accumulated Bridge Context | `journey_sessions` | `accumulatedContext` (JSON) | Bridge context ONLY (not primary analysis) - contains partial data passed between frameworks |
| Strategic Decisions | `strategy_decisions` | `decisions` (JSON) | Linked via `strategyVersionId` |

## Framework Executor Development

**Location:** `server/journey/executors/`

**Key Requirements:**
1. **Always use null-safety** for optional context: `context.insights?.bmcDesignConstraints`
2. **Log progress clearly** with `[ExecutorName]` prefix
3. **Handle bridge context gracefully** - it may be empty if prior framework didn't populate it

## Caching & Background Patterns

**Acceptable for Replit (single-instance deployment):**
- Module-level in-memory Maps with TTL cleanup
- Fire-and-forget background promises for prefetch
- `console.log` for monitoring

**NOT used in this codebase:** Redis, BullMQ, Winston/Pino, Feature flags

# Recent Bug Fixes

## EPM Initialization Fix for Business Model Innovation (Feb 3, 2026)
- **Problem**: EPM generation showed "Initializing..." at 0% indefinitely
- **Root Cause 1**: BMC executor crashed with `Cannot read properties of undefined (reading 'bmcDesignConstraints')` - missing null-safety
- **Root Cause 2**: `getAggregatedAnalysis()` queried wrong column - URL sessionId vs journeySession.id
- **Fixes**: Added null-safety to BMC executor; Updated analysis-aggregator.ts to resolve full lookup chain
- **Files**: `server/journey/executors/bmc-executor.ts`, `server/intelligence/analysis-aggregator.ts`

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