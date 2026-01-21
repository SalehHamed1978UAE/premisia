# ⚠️ CRITICAL: MODULAR JOURNEY ARCHITECTURE ⚠️

**BEFORE MODIFYING ANY JOURNEY, RESEARCH, OR FRAMEWORK CODE, READ `/docs/JOURNEY_ARCHITECTURE.md`**

## Quick Rules (Violations Break the App)

### Source of Truth
| What | File |
|------|------|
| Journey Definitions | `server/journey/journey-registry.ts` |
| Module Execution | `server/journey/journey-orchestrator.ts` |
| Context Flow | `server/journey/strategic-context-accumulator.ts` |

### NEVER DO THIS
```typescript
// ❌ Hardcoded categories - BREAKS BMC JOURNEY
const categories = ["market_dynamics", "competitive_landscape", ...];

// ❌ Hardcoded URLs - BREAKS ROUTING
nextUrl: `/strategy-workspace/decisions/${sessionId}`;
```

### ALWAYS DO THIS
```typescript
// ✅ Query the journey system
const journey = getJourneyByType(journeyType);
const nextUrl = getNextPage(journey, currentPage, params);
```

### Separate UI Components Per Framework
- BMC (9 blocks) → BMCResearchExperience.tsx
- Porter's (5 forces) → PortersResearchExperience.tsx
- DO NOT make one component handle multiple frameworks

### Before Merging Journey Changes
```bash
npm run test:journeys
```

### Run Journey Tests Manually
```bash
npx jest tests/journeys/ --passWithNoTests
```

---

# Overview
Premisia is an AI-enhanced, full-stack web application for comprehensive enterprise program management. It supports the entire program lifecycle, from program and task management to tracking resources, risks, benefits, KPIs, and financials via an intuitive dashboard. The project aims to provide a holistic solution for strategic decision-making and EPM integration, featuring real-time AI intelligence, a multi-agent architecture, and a formal ontology for expert guidance. Key capabilities include multi-modal input analysis, anti-bias research, document intelligence enrichment, and the conversion of strategic decisions into actionable EPM program structures.

# User Preferences
Preferred communication style: Simple, everyday language.

**Development Philosophy:**
- No band-aid fixes or workarounds (e.g., making fields nullable to bypass foreign key constraints)
- Always fix root architectural issues properly the first time
- Take time to understand the proper data flow before implementing fixes
- Clean separation of concerns - don't mix old and new system architectures

# System Architecture

## UI/UX Decisions
The frontend uses React, TypeScript, and Vite, with Shadcn/ui (Radix UI and Tailwind CSS) for a themeable "New York" style UI. It features a single-page application with mobile-first responsive design, including a breakpoint system, adaptive layouts, responsive typography, skeleton loading, and toast notifications. The "Five Whys" page is interactive and responsive, featuring a progressive breadcrumb, carousel wheel picker for mobile, and a 2x2 grid for desktop. The sidebar uses a compact, three-zone layout optimized for visibility on all devices.

## Technical Implementations
- **Frontend**: React, TypeScript, Vite, TanStack Query, Wouter.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication, Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver and Drizzle ORM for type-safe schema and Zod validation. `DBConnectionManager` handles database connections.
- **Authentication/Authorization**: Session-based authentication via Passport.js with Replit OIDC, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer). Includes a two-phase auth initialization for robust deployment health checks and lazy route loading to prevent module-load crashes when production secrets are missing.
  - **Instant Health Check Response (November 2025)**: Root endpoint (`/`) provides unconditional instant JSON responses for Replit autoscale health probes (~3-5ms). Readiness gate middleware (registered synchronously before server.listen) shows loading page to browsers during initialization while allowing assets and API requests through. All heavy tasks (route registration, auth, DB verification) deferred inside setImmediate to ensure server binds immediately, preventing deployment timeouts.
  - **Process Keep-Alive (November 2025)**: Multi-handle strategy prevents premature process exit during autoscale deployment: (1) process.stdin.resume() keeps stdin active, (2) referenced setInterval (10s) provides watchdog logging, (3) beforeExit handler creates fresh referenced timeout for recovery. All process.exit() calls removed from server startup code (server/index.ts, server/db-init.ts) to keep process alive for health checks even if initialization steps fail.
- **Background Jobs**: A hybrid system with database persistence and real-time tracking, dispatching jobs every 15 seconds. A `Modular Framework Executor Registry` supports a plugin system for strategic analysis frameworks.
- **Enterprise Data Encryption**: AWS KMS envelope encryption with AES-256-GCM for sensitive business data at rest, covering all sensitive fields in `strategy_versions`, `strategic_understanding`, `journey_sessions`, and `epm_programs` tables.
- **Journey Navigation Architecture**: Uses two orchestrator-driven entry points ("Strategic Consultant Journey" and "Strategies Hub Run Now") with a `pageSequence` array for navigation. Follow-on journeys create new, isolated journey sessions.
- **BMI Workflow Resilience (November 2025)**: BMC SSE stream handler uses resilient version creation with 'system' user fallback when auth context is missing, ensuring AI-generated strategic decisions are always persisted to `strategy_versions` table. Comprehensive warning/error logging prevents silent failures and improves diagnostics for missing decision data.
- **BMC Knowledge Security Tests (November 2025)**: Comprehensive automated test suite (`tests/bmc-knowledge-security.spec.ts`) with 11 tests validates cross-user data isolation, authorization, and decryption for the `/bmc-knowledge/:programId` endpoint. Tests expose and prevent regression of critical security vulnerabilities, including multi-program ownership edge cases. Fixed production bug where contradiction evidence fields were encrypted but not decrypted.
- **Context Foundry Integration (December 2025)**: Grounded analysis capability that queries verified organizational facts from Context Foundry before AI analysis. Constrains LLM responses to use verified data with proper source citations. Integrated into StrategyAnalyzer for Five Whys and Porter's analysis. Status endpoint at `/api/strategic-consultant/context-foundry/status`.
  - **Configuration (December 15, 2025)**: Connected to live Context Foundry instance at `https://1ccacfa5-76d6-4bc8-b11c-e8a59e39c1f1-00-i16a1ywb4a3m.riker.replit.dev`. Uses `X-CF-API-Key` header for authentication with key stored in `CONTEXT_FOUNDRY_API_KEY` secret. V1 API endpoint `/api/v1/query` handles entity resolution internally—Premisia sends raw user text, CF extracts and resolves entities from its knowledge graph.
  - **Future Integration Points (January 2026)**:
    - **BMC (Business Model Canvas) 9-Block Analysis**: Each block should query CF for organizational grounding:
      1. Customer Segments: Query customer/market entities from CF knowledge graph
      2. Value Propositions: Ground in verified product/service offerings
      3. Channels: Validate against known distribution channels
      4. Customer Relationships: Check CRM/engagement patterns
      5. Revenue Streams: Ground in financial/pricing entities
      6. Key Resources: Query infrastructure/asset entities
      7. Key Activities: Validate against operational processes
      8. Key Partnerships: Ground in verified partner/vendor relationships
      9. Cost Structure: Check financial/cost center entities
      - Integration point: `server/strategic-consultant/bmc-analyzer.ts` - wrap each block's analysis with `queryContext()` before LLM generation
    - **Segment Discovery Synthesis Phase**: The beachhead recommendation synthesis should query CF for:
      - Customer entity verification: Check if target segments exist in CF knowledge graph
      - Market position grounding: Validate competitive positioning claims against CF data
      - Resource capability validation: Ground capability scores in verified organizational assets
      - Integration point: `server/services/segment-discovery-engine.ts` in `synthesizeResults()` method - query CF before generating final beachhead recommendations

## Feature Specifications
- **AI Multi-Agent System**: Ontology-based architecture with Executive, Builder, QA Specialist Agents, and a Multi-Agent Orchestrator.
- **Strategic Consultant & EPM Integration**: Converts executive input into AI-analyzed strategic decisions and EPM program structures, including Five Whys AI-coaching, Anti-Confirmation Bias Research, Version Management, and Intelligent Framework Selection.
- **Business Model Canvas (BMC) Analysis**: Full 9-block implementation with query generation, parallel research, and cross-block consistency validation.
- **Strategic Understanding Service**: Uses PostgreSQL with `pgvector` for entity categorization, relationship mapping, semantic search, and contradiction validation.
- **Robustness**: Multi-provider AI fallback, extended socket timeouts, and request throttling.
- **Trend Analysis Agent**: Provides PESTLE analysis with an evidence-first architecture.
- **Journey-Based Strategic Analysis**: Guides users through interactive sequences for strategic frameworks with backend-controlled orchestration.
- **Modular Framework Renderer Architecture**: Extensible system for displaying analysis results.
- **Strategy Intelligence Layer**: Core AI engine for converting strategic frameworks into executable EPM programs.
- **Strategy Workspace**: Bridges AI analysis and EPM programs through a 4-page wizard and EPM Program View.
- **EPM Display Formatters**: Enterprise-grade visual components for EPM data across 7 tabs with 14 specialized formatters.
- **Intelligent Planning System**: AI-powered project planning library for schedule optimization, resource allocation, and validation.
- **Multi-Agent EPM Generation System (January 2026)**: CrewAI-based Python service for generating EPM programs using 7 specialized agents working through 7 rounds of progressive elaboration.
  - **Architecture**: TypeScript router (`server/services/epm-generator/`) with feature-flag controlled switching between legacy and multi-agent generators, automatic fallback on error.
  - **Agents**: Program Coordinator, Tech Architecture Lead, Platform Delivery Manager, Go-to-Market Strategist, Customer Success Lead, Risk & Compliance Officer, Finance & Resource Manager.
  - **Rounds**: Framing → Dependency Discovery → Negotiation → Resource & Timeline → Risk Assessment → Reconciliation → Sign-off.
  - **Knowledge Curator**: Post-generation extraction of 10-30 knowledge emissions per program with confidence scores, supporting evidence, and contradiction tracking.
  - **Feature Flags**: `USE_MULTI_AGENT_EPM` (default: false), `EPM_FALLBACK_ON_ERROR` (default: true), `CREWAI_SERVICE_URL`, `CF_INTEGRATION_ENABLED`, `CF_INTEGRATION_MODE`.
  - **Python Service**: FastAPI at `services/agent-planner/` with `/health` and `/generate-program` endpoints.
- **Journey Builder System**: Allows users to choose from 6 pre-defined journeys or create custom ones with AI validation.
- **Universal Background Jobs System**: Hybrid system for tracking long-running operations with database persistence and real-time SSE streaming.
- **Non-Blocking Progress UX**: Uses a fixed-position progress card (`MinimizedJobTracker`) and polling.
- **Full-Pass Export System**: Generates ZIP bundles with strategic analysis and EPM program data in multiple formats.
- **Document Intelligence Enrichment**: Background job pipeline for asynchronously extracting knowledge from uploaded documents (PDF, DOCX, Excel, images), populating the encrypted knowledge graph.
- **Strategies Hub**: Unified view for all strategic initiatives, providing artifact hierarchy and research provenance.
- **Journey Launcher Modal**: Intelligent modal for initiating additional strategic analysis, with two modes (Full Journey, Single Framework) and journey-aware readiness checks.
- **Ambiguity Resolution & Clarifications**: AI-powered clarification workflows for strategic inputs.
- **Geographic Disambiguation**: Location-aware journey intake with OpenStreetMap/Nominatim integration for automatic detection and clarification of place names.
- **Journey Registry V2**: Centralized journey definitions with automatic summary generation, baseline reuse, intelligent readiness thresholds, and comprehensive test coverage. Includes an EPM Completion Hook to bridge old and new flows.
- **Golden Records Automation System**: Baseline regression testing for journey executions with versioned snapshots, CLI tools, and auto-capture hooks.
- **BMC SSE Regression Test Suite**: Comprehensive test coverage for Business Model Canvas SSE streaming contract, validating all event types and payload structures.

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
- **Encryption**: AWS KMS (for AES-256-GCM)
- **Geographic Data**: OpenStreetMap/Nominatim
- **Knowledge Graph**: Context Foundry (for grounded organizational facts)