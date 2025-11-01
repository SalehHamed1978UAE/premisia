# Overview
QGentic Intelligent Strategic EPM is an AI-enhanced, full-stack web application for comprehensive enterprise program management. It supports the entire program lifecycle, from managing programs, workstreams, and tasks to tracking resources, risks, benefits, KPIs, and financials through an intuitive dashboard. The project aims to provide a holistic solution for strategic decision-making and EPM integration, featuring real-time AI intelligence, a multi-agent architecture, and a formal ontology for expert guidance. Key capabilities include multi-modal input analysis, anti-bias research, document intelligence enrichment, and the conversion of strategic decisions into actionable EPM program structures.

# User Preferences
Preferred communication style: Simple, everyday language.

**Development Philosophy:**
- No band-aid fixes or workarounds (e.g., making fields nullable to bypass foreign key constraints)
- Always fix root architectural issues properly the first time
- Take time to understand the proper data flow before implementing fixes
- Clean separation of concerns - don't mix old and new system architectures

# System Architecture

## UI/UX Decisions
The frontend utilizes React, TypeScript, and Vite, enhanced with Shadcn/ui (Radix UI and Tailwind CSS) to deliver a themeable "New York" style UI. It offers a single-page application experience, ensuring mobile responsiveness, skeleton loading, and toast notifications. A mobile-first responsive design strategy is implemented with a breakpoint system, adaptive layout patterns (headers, grids, buttons), responsive typography, and careful spacing adjustments.

**Five Whys Interactive UX Pattern:**
The Five Whys page features a progressive breadcrumb and responsive layout optimized for both mobile and desktop:

**Breadcrumb Design (All Devices):**
- **"Your Path So Far..."** collapsible header showing numbered progression (1st, 2nd, 3rd, 4th, 5th)
- **Current question** displayed prominently in large, bold text
- **Previous whys** collapsed by default, expandable to review the path taken
- **State**: `isBreadcrumbExpanded` controls collapse/expand behavior

**Mobile Experience (<640px):**
- **Layout**: Vertical scroll-snap container with snap-to-center behavior
- **Magnification**: Centered option scales to 1.15x, non-centered options scale to 0.9x with reduced opacity
- **Icon Action Bar**: Three buttons (💡 Consider, ✅ Evidence, ⚠️ Counter) appear on centered option only
- **Evidence Display**: Bottom sheet (Shadcn Sheet) for detailed evidence/counter-arguments
- **Intersection Observer**: Detects centered option with 0.5 threshold
- **Optimized Spacing**: Compact text, reduced padding, 44px+ touch targets
- **State**: `centeredOptionId` tracks magnified option, `sheetContent` controls bottom sheet

**Desktop Experience (≥640px):**
- **Layout**: 2×2 grid displaying all 4 options simultaneously
- **Evidence Display**: Expands inline below selected option
- **Selection Flow**: Click option → highlights → evidence appears → Continue enabled

**Shared Features:**
- **State Management**: `selectedOptionId` tracks selection, `selectedPath` persists navigation history
- **Navigation**: Single "Continue to Next Why" button, disabled until selection made
- **Benefits**: Mobile users get focused, scrollable experience; desktop users compare all options at once

## Technical Implementations
- **Frontend**: React, TypeScript, Vite, TanStack Query, Wouter.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication, Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver and Drizzle ORM for type-safe schema and Zod validation. `DBConnectionManager` handles database connections with pooling and retry mechanisms.
- **Authentication/Authorization**: Session-based authentication via Passport.js with Replit OIDC, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer).

## Background Jobs Architecture
The application employs a hybrid background job system with database persistence and real-time progress tracking. A `Background Job Service` dispatches jobs every 15 seconds to appropriate workers (e.g., `document-enrichment-worker`, `strategic-understanding-worker`). A `Modular Framework Executor Registry` provides a plugin system for strategic analysis frameworks (e.g., Five Whys, BMC), allowing for easy integration of new frameworks without modifying the orchestrator. Journeys are pre-defined sequences of these frameworks.

## Feature Specifications
- **AI Multi-Agent System**: Ontology-based architecture with Executive, Builder, QA Specialist Agents, and a Multi-Agent Orchestrator supporting multiple AI providers.
- **Strategic Consultant & EPM Integration**: Transforms executive input into AI-analyzed strategic decisions and EPM program structures, including Five Whys (AI-coached), Anti-Confirmation Bias Research, Version Management, and Intelligent Framework Selection.
- **Five Whys AI Coaching System**: Validates Five Whys analysis for causality, relevance, specificity, evidence, and logical consistency.
- **Business Model Canvas (BMC) Analysis**: Full 9-block implementation with query generation, parallel research, cross-block consistency validation, and real-time progress streaming.
- **Strategic Understanding Service (Knowledge Graph Architecture)**: Uses PostgreSQL with `pgvector` for entity categorization, relationship mapping, semantic search, and contradiction validation.
- **Robustness and Performance**: Multi-provider AI fallback, extended socket timeouts, and request throttling with exponential backoff.
- **Trend Analysis Agent**: Provides production-ready PESTLE analysis with an evidence-first architecture.
- **Journey-Based Strategic Analysis**: Guides users through interactive sequences for strategic frameworks. Features backend-controlled orchestration with framework-agnostic navigation using `nextUrl` from research endpoints.
- **Modular Framework Renderer Architecture**: Extensible system for displaying analysis results.
- **Strategy Intelligence Layer**: Core AI engine for converting strategic frameworks into executable EPM programs.
- **Strategy Workspace**: Bridges AI analysis and EPM programs through a 4-page wizard and EPM Program View.
- **EPM Display Formatters**: Enterprise-grade visual components for EPM data across 7 tabs, with 14 specialized formatters.
- **Dynamic Home Page**: Adaptive, personalized landing page.
- **Batch Operations & Archive**: Supports batch actions for Analysis Repository and EPM Programs pages.
- **Intelligent Planning System**: AI-powered project planning library for schedule optimization, resource allocation, and validation, including an LLM Task Extractor, CPM Scheduler, Resource Manager, AI Optimizer, and LLM Validator.
- **Journey Builder System**: Allows users to choose from 6 pre-defined journeys or create custom ones with AI validation.
- **Universal Background Jobs System**: Hybrid system for tracking long-running operations with database persistence and real-time SSE streaming.
- **Non-Blocking Progress UX**: Replaces blocking modals with navigable experiences using a fixed-position progress card (`MinimizedJobTracker`) and polling.
- **Enterprise Data Encryption**: AES-256-GCM encryption for sensitive business data at rest.
- **Full-Pass Export System**: Comprehensive export generating ZIP bundles with strategic analysis and EPM program data in multiple formats (Markdown, PDF, DOCX, HTML).
- **Document Intelligence Enrichment**: Background job pipeline for asynchronously extracting knowledge from uploaded documents (PDF, DOCX, Excel, images), populating the encrypted knowledge graph with provenance. Features a notification system.
- **Strategies Hub**: Unified view for all strategic initiatives, providing artifact hierarchy and research provenance, with list and detailed views. Supports context inheritance.
- **Journey Launcher Modal**: Intelligent modal for initiating additional strategic analysis, with two modes (Full Journey, Single Framework). Includes journey-aware readiness checks and uses a `Strategic Summary Builder` for context, implementing a single-snapshot architecture to prevent token limit overruns. Features loading overlay that prevents black screen during journey execution by keeping modal visible with "Starting your journey..." message until navigation completes.
- **Ambiguity Resolution & Clarifications**: AI-powered clarification workflows for strategic inputs, prompting users to resolve unclear inputs, which are then merged and persisted for follow-on analysis.

# Journey Navigation Architecture

## Critical Navigation Patterns
The application has two entry points for strategic journeys, both using orchestrator-driven navigation:

### 1. Strategic Consultant Journey (New Analysis)
**Entry Point:** `/strategic-consultant/input`  
**Flow:**
```
Input Page → Classification → Journey Selection → Execute Journey
  → Framework Pages (e.g., Whys Tree, BMC Research)
  → Strategic Decisions → EPM Conversion
```

**Key Endpoints:**
- `POST /api/strategic-consultant/journeys/execute` - Starts a new journey after classification
- Returns `navigationUrl` pointing to first framework page

### 2. Strategies Hub "Run Now" (Follow-on Analysis)
**Entry Point:** Strategies Hub → Click "Run Now" on existing strategy  
**Flow:**
```
Strategies Hub → Run Now Modal → Journey Selection
  → Framework Pages (e.g., Whys Tree, BMC Research)
  → Strategic Decisions → EPM Conversion
```

**Key Endpoints:**
- `POST /api/strategic-consultant/journeys/run-now` - Starts journey from existing strategy
- Builds strategic summary from previous sessions
- Returns `navigationUrl` pointing to first framework page

## PageSequence Navigation Rules

**CRITICAL:** Both entry points use `journey.pageSequence` array to determine navigation order.

### Array Structure:
```javascript
pageSequence = [
  '/strategic-consultant/input/:understandingId',        // [0] Input page (already completed for Run Now)
  '/strategic-consultant/whys-tree/:sessionId',          // [1] First interactive framework
  '/strategic-consultant/research/:sessionId',           // [2] Research/BMC analysis
  '/strategy-workspace/decisions/:sessionId/:versionNumber' // [3] Strategic decisions
]
```

### Navigation Index Rules:
- **Execute Journey (new analysis):** Uses `pageSequence[1]` - skips input page (just completed)
- **Run Now (follow-on):** Uses `pageSequence[1]` - skips input page (using strategic summary)
- **Backend Research:** Returns `nextUrl` with complete path including all required parameters

**File Locations:**
- `/journeys/execute` endpoint: `server/routes/strategic-consultant.ts` line ~534
- `/journeys/run-now` endpoint: `server/routes/strategic-consultant.ts` line ~2330
- Journey registry: `server/journey/journey-registry.ts`

## BMC Research Endpoint Behavior

### Endpoint:
`GET /api/strategic-consultant/bmc-research/stream/:sessionId`

### Response Format:
```javascript
{
  type: 'complete',
  data: {
    findings: { /* BMC research results */ },
    versionNumber: 3,  // CRITICAL: Must be included
    nextUrl: '/strategy-workspace/decisions/:sessionId/:versionNumber'
  }
}
```

### Frontend Navigation:
`ResearchPage.tsx` (line ~274) uses the `nextUrl` from backend response:
```javascript
const nextUrl = (researchData as any)?.nextUrl || fallbackUrl;
setLocation(nextUrl);
```

**File Locations:**
- BMC research endpoint: `server/routes/strategic-consultant.ts` line ~2027
- Research page navigation: `client/src/pages/strategic-consultant/ResearchPage.tsx` line ~274

## Version Number Requirements

**CRITICAL:** The Strategic Decisions page route requires BOTH `sessionId` AND `versionNumber`:

**Route Definition:**
```javascript
/strategy-workspace/decisions/:sessionId/:versionNumber
```

**Common Pitfalls:**
1. ❌ Missing versionNumber: `/strategy-workspace/decisions/${sessionId}` → 404 error
2. ✅ Correct format: `/strategy-workspace/decisions/${sessionId}/${versionNumber}` → Works

**Fix Pattern:**
Always include versionNumber when constructing nextUrl in research endpoints:
```javascript
const finalVersionNumber = version?.versionNumber || targetVersionNumber;
nextUrl: `/strategy-workspace/decisions/${sessionId}/${finalVersionNumber}`
```

## Troubleshooting Guide

### Issue: Navigation loops back to input page
**Symptom:** After starting journey, user lands on already-completed input page  
**Cause:** Using `pageSequence[0]` instead of `pageSequence[1]`  
**Fix:** Change to `pageSequence[1]` in both `/journeys/execute` and `/journeys/run-now` endpoints

### Issue: 404 error after BMC research completes
**Symptom:** Research finishes successfully but navigates to 404  
**Cause:** Missing versionNumber in nextUrl  
**Fix:** Include versionNumber in nextUrl construction in BMC research endpoint

### Issue: Research endpoint doesn't navigate
**Symptom:** Research completes but stays on research page  
**Cause:** Backend not returning nextUrl in complete event  
**Fix:** Ensure all research endpoints include nextUrl in their completion response

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