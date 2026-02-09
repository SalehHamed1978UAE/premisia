# Premisia Codebase Overview

## 1. Architecture & Structure

### Directory Tree

```
/home/runner/workspace/
├── client/                          # React frontend (Vite + TypeScript)
│   └── src/
│       ├── components/              # Reusable UI components
│       │   ├── benefits/            # Benefits management UI
│       │   ├── dashboard/           # Dashboard view
│       │   ├── epm/                 # EPM program display components
│       │   ├── five-whys/           # Five Whys tree interactive components
│       │   ├── five-whys-animation/ # Animated Five Whys visualization
│       │   ├── frameworks/          # Framework result renderers
│       │   ├── funding/             # Funding/financial views
│       │   ├── intelligent-planning/# Planning progress UI
│       │   ├── journey/             # Journey flow components
│       │   ├── knowledge/           # Knowledge graph display
│       │   ├── kpis/                # KPI tracking
│       │   ├── layout/              # AppLayout, sidebar, top-bar
│       │   ├── loaders/             # Loading/skeleton components
│       │   ├── onboarding/          # Welcome modal
│       │   ├── orchestrator/        # AI orchestrator UI
│       │   ├── research-experience/ # Research progress display
│       │   ├── resources/           # Resource management
│       │   ├── risks/               # Risk registry
│       │   ├── stagegates/          # Stage gate reviews
│       │   ├── strategic-consultant/# BMC, Five Whys, PESTLE, Porter's results
│       │   ├── strategies/          # Strategy list/detail
│       │   ├── timeline/            # Gantt chart / timeline
│       │   ├── trend-analysis/      # Trend analysis display
│       │   └── ui/                  # Shadcn/Radix primitives (button, card, dialog, etc.)
│       ├── contexts/                # React contexts (ProgramContext, JobContext, DocumentInsightsContext)
│       ├── hooks/                   # Custom hooks (useAuth, useJobNotifications, useJourneyNavigation)
│       ├── lib/                     # Utilities (queryClient, protected-route)
│       ├── pages/                   # Route-level page components
│       │   ├── admin/               # Golden record admin pages
│       │   ├── journey-builder/     # Visual journey builder
│       │   ├── journeys/            # Journey hub & wizard
│       │   ├── marketing-consultant/# Marketing consultant flow pages
│       │   ├── strategic-consultant/# Main strategic analysis pages (Input, Classification, Research, WhysTree, Decisions, EPM)
│       │   └── strategy-workspace/  # Decision summary, prioritization, EPM program view
│       └── types/                   # TypeScript types
├── server/                          # Express.js backend (TypeScript)
│   ├── config/                      # Neo4j config, AI client config
│   ├── export/templates/            # HTML templates for PDF/DOCX export
│   ├── intelligence/epm/            # EPM generation engine (workstreams, timeline, resources, validators)
│   │   └── validators/              # EPM validation pipeline
│   ├── journey/                     # Journey orchestration system
│   │   ├── bridges/                 # Framework-to-framework data transformers (11 bridges)
│   │   ├── context/                 # Journey context management
│   │   ├── epm-readiness/           # EPM readiness scoring
│   │   ├── executors/               # 17 framework executors (Five Whys, BMC, Porter's, PESTLE, SWOT, Ansoff, Blue Ocean, etc.)
│   │   ├── schemas/                 # Journey validation schemas
│   │   ├── services/                # Journey orchestrator, WhysTreeGenerator, quality control
│   │   ├── templates/               # Journey config YAML templates
│   │   ├── transformers/            # Data transformation utilities
│   │   └── types/                   # Journey type definitions
│   ├── lib/                         # AI client library (multi-provider: Anthropic, OpenAI, Gemini)
│   ├── modules/                     # Module catalog system (20 registered modules)
│   │   ├── journeys/                # Journey YAML config files
│   │   └── manifests/               # Module manifest definitions
│   ├── ontology/                    # Strategy ontology service
│   ├── repositories/                # Data access layer
│   ├── routes/                      # Express route handlers (16 route files)
│   ├── services/                    # Business logic services
│   │   └── export/                  # Export pipeline (Markdown, PDF, DOCX, Excel, CSV, JSON, HTML)
│   ├── strategic-consultant-legacy/ # Legacy consultant code
│   ├── strategic-consultant-v2/     # V2 consultant with journey support
│   ├── types/                       # Server TypeScript types
│   ├── utils/                       # Encryption, JSON parsing, request throttling, KMS
│   └── workers/                     # Background workers
├── shared/                          # Shared between client and server
│   ├── contracts/                   # Zod schemas for frameworks (BMC, Five Whys, PESTLE, Porter's, SWOT, positioning)
│   ├── schema.ts                    # Drizzle ORM database schema (THE source of truth - 2067 lines)
│   ├── framework-types.ts           # Framework type definitions
│   ├── journey-types.ts             # Journey type definitions
│   └── module-types.ts              # Module system types
├── migrations/                      # SQL migration files
├── scripts/                         # Utility scripts (golden records, etc.)
├── tests/                           # Test files
├── public/                          # Static assets
├── dist/                            # Build output
├── package.json                     # Dependencies & scripts
├── vite.config.ts                   # Vite config
├── tsconfig.json                    # TypeScript config
├── drizzle.config.ts                # Drizzle ORM config
├── tailwind.config.ts               # Tailwind CSS config
├── postcss.config.js                # PostCSS config
├── replit.md                        # Project documentation
└── .env.example / .env.local        # Environment variables
```

### Framework & Language

**React + TypeScript (Vite)** frontend, **Node.js + Express.js + TypeScript** backend, built with ES modules.

**Key dependencies:**
- **Frontend:** React 18, Wouter (routing), TanStack Query (data fetching), Shadcn/ui (Radix + Tailwind CSS), Recharts, ReactFlow, Framer Motion
- **Backend:** Express.js, Passport.js + openid-client (Replit OIDC auth), Drizzle ORM + @neondatabase/serverless (Postgres), express-session + connect-pg-simple
- **AI:** @anthropic-ai/sdk, openai, @google/genai (multi-provider with fallback)
- **Export:** archiver (ZIP), docx (DOCX generation), puppeteer/playwright (PDF), xlsx (Excel), marked (Markdown to HTML)
- **Other:** neo4j-driver (knowledge graph, optional), zod (validation), ws (WebSocket), js-yaml (journey configs)

### Entry Point & Startup Flow

1. `npm run dev` runs `dotenv -e .env.local -- tsx server/index.ts`
2. **`server/index.ts`** (the entry point):
   - Intercepts `process.exit(1)` to prevent Vite crashes from killing the server
   - Registers global error handlers (`unhandledRejection`, `uncaughtException`)
   - Creates Express app, registers DI container (`registerServices()`)
   - Validates encryption key, registers 16 framework executors
   - Creates HTTP server and **listens immediately** on port 5000
   - Then **in background** (`setImmediate`): lazily imports `server/routes.ts` -> calls `registerRoutes(app)` which sets up auth middleware, OIDC, and all API routes -> then sets up Vite dev server -> marks `appReady = true`
   - Also starts: background job dispatcher (15s polling), database extension verification, Neo4j connection check

3. **When a user loads the app:** Browser hits port 5000 -> Vite dev server serves `index.html` -> `client/src/main.tsx` renders `<App />` -> `App.tsx` wraps everything in `QueryClientProvider` -> `AuthProvider` -> checks auth state -> `Router` renders the appropriate page based on URL (Wouter). Unauthenticated users see `HomePage` (landing) or `AuthPage`.

---

## 2. Data Flow

### Database

**PostgreSQL (Neon serverless)** - schema defined entirely in `shared/schema.ts` using Drizzle ORM. No traditional migration files (uses `drizzle-kit push` for schema sync).

### All Tables

| Table | Purpose |
|-------|---------|
| `sessions` | Express session storage (sid, sess JSONB, expire) |
| `users` | User accounts (id, email, role, firstName, lastName, profileImageUrl) |
| `locations` | Geographic disambiguation (rawQuery, displayName, lat/lon, countryCode, adminLevels) |
| `programs` | EPM programs from legacy system (name, description, ownerId, dates, status) |
| `workstreams` | Program workstreams (programId, name, description, leadId) |
| `resources` | Team resources (name, role, department, email, userId, programId) |
| `stage_gates` | Project stage gates (code, name, description, successCriteria, programId) |
| `stage_gate_reviews` | Gate review records (stageGateId, reviewDate, status, notes) |
| `tasks` | Project tasks (name, workstreamId, ownerId, stageGateId, dates, status, progress) |
| `task_dependencies` | Task dependency links (taskId, dependsOnTaskId) |
| `kpis` | Key performance indicators (programId, name, targetValue, currentValue, unit) |
| `kpi_measurements` | KPI measurement history (kpiId, value, measurementDate) |
| `risks` | Risk register (programId, riskId, description, likelihood, impact, priority, mitigationPlan) |
| `risk_mitigations` | Risk mitigation actions (riskId, action, actionDate, result) |
| `benefits` | Benefits tracking (programId, name, targetValue, realizedValue, status) |
| `funding_sources` | Funding tracking (programId, sourceName, allocatedAmount) |
| `expenses` | Expense tracking (programId, description, amount, category, vendor) |
| `ontology_entities` | AI ontology knowledge base entities |
| `ontology_relationships` | Ontology entity relationships |
| `ontology_validation_rules` | Ontology validation rules |
| `ontology_completeness_checks` | Ontology completeness checks |
| `ontology_cascade_impacts` | Ontology cascade impact definitions |
| `ontology_domain_terms` | Ontology domain terminology |
| `ontology_framework_mappings` | Framework to EPM entity mappings |
| `session_context` | Goal/session tracking (goal, successCriteria, decisionsLog) |
| `strategy_versions` | Strategy analysis versions (userId, sessionId, versionNumber, analysisData, decisionsData, status) |
| `strategic_decisions` | Individual strategic decisions within a version |
| `strategy_insights` | Strategy insights records |
| `framework_selections` | Which frameworks were selected for analysis |
| `bmc_analyses` | Business Model Canvas analysis records |
| `bmc_blocks` | Individual BMC blocks (9 blocks per analysis) |
| `bmc_findings` | Research findings per BMC block |
| `strategic_understanding` | User input understanding with entity extraction (userInput, title, entities - encrypted) |
| `strategic_entities` | Knowledge graph entities (pgvector embeddings, type, content, confidence) |
| `strategic_relationships` | Entity relationships (fromEntityId, toEntityId, type, evidence) |
| `journey_sessions` | Journey execution sessions (understandingId, journeyType, status, findings, versionNumber - encrypted) |
| `strategy_decisions` | Strategy workspace decisions (journeySessionId, decisionsData - encrypted) |
| `epm_programs` | Generated EPM programs (journeySessionId, programData - large JSONB, encrypted) |
| `references` | Research provenance (sourceType, title, url, publisher, citation) |
| `framework_insights` | Per-framework analysis results stored as JSONB (five_whys tree, bmc blocks, etc.) |
| `background_jobs` | Background job queue (type, status, progress, input/output JSONB) |
| `research_batches` | Research data capture batches |
| `task_assignments` | EPM task assignments with resource allocation |
| `authority_sources` | Trend analysis authority sources |
| `authority_source_industries/countries/languages` | Authority source metadata junction tables |
| `trend_claims_cache` | Cached trend analysis claims |
| `trend_analysis_jobs` | Trend analysis job queue |
| `segment_discovery_results` | Marketing consultant segment discovery results |
| `beta_usage_counters` | Beta feature usage tracking |

### Data Flow Example (End-to-End)

**User starts a new strategic analysis:**

1. **User types business idea** on `InputPage.tsx` -> clicks submit
2. **Frontend** calls `POST /api/strategic-consultant/understanding` with the text input
3. **Backend route** (`server/routes/strategic-consultant-v2.ts`) receives it -> calls `StrategicUnderstandingWorker`
4. Worker uses AI (Anthropic Claude) to classify the initiative type, extract entities
5. **Database writes:**
   - Inserts into `strategic_understanding` table (user input, title, encrypted)
   - Inserts into `strategic_entities` table (extracted entities with pgvector embeddings)
   - Returns `understandingId` to frontend
6. **Frontend navigates** to `/strategic-consultant/classification/:understandingId`
7. User confirms classification -> `PATCH /api/strategic-consultant/classification`
8. User selects journey -> `POST /api/strategic-consultant/journeys/execute`
9. **Journey orchestrator** runs frameworks sequentially (Five Whys -> BMC for business_model_innovation)
10. Framework results are saved to `framework_insights` table and `journey_sessions` table
11. Strategic decisions generated -> saved to `strategy_decisions` table
12. User makes decisions -> EPM program generated -> saved to `epm_programs` table

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session encryption |
| `REPL_ID` | Replit app identifier |
| `ISSUER_URL` | OIDC issuer (https://replit.com/oidc) |
| `REPLIT_DOMAINS` | Allowed domains for auth |
| `ANTHROPIC_API_KEY` | Claude AI provider |
| `OPENAI_API_KEY` | OpenAI provider |
| `GEMINI_API_KEY` | Google Gemini provider |
| `PORT` | Server port (5000) |
| `NODE_ENV` | Environment (development/production) |
| `DEV_AUTH_BYPASS` | Skip OIDC in dev mode |
| `ENCRYPTION_KEY` | Data-at-rest encryption key |
| `AWS_ACCESS_KEY_ID` | AWS credentials for KMS |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials for KMS |
| `AWS_REGION` | AWS region |
| `AWS_KMS_KEY_ID` | AWS KMS key ID |
| `PREMISIA_KMS_KEY_ID` | Premisia-specific KMS key |
| `NEO4J_URI` | Neo4j knowledge graph URI (optional) |
| `NEO4J_USERNAME` | Neo4j username |
| `NEO4J_PASSWORD` | Neo4j password |
| `NEO4J_DATABASE` | Neo4j database name |
| `CONTEXT_FOUNDRY_API_URL` | Context Foundry integration URL |
| `CONTEXT_FOUNDRY_API_KEY` | Context Foundry API key |
| `BRAVE_SEARCH_API_KEY` | Web search for trend analysis |
| `AZURE_TRANSLATOR_KEY` | Azure translation service |
| `AZURE_TRANSLATOR_REGION` | Azure translator region |
| `GEONAMES_USERNAME` | GeoNames geocoding |
| `INTELLIGENT_PLANNING_ENABLED` | Feature flag for intelligent planning |
| `USE_EPM_V2_ENGINE` | EPM V2 engine feature flag |
| `USE_MULTI_AGENT_EPM` | Multi-agent EPM feature flag |
| `FEATURE_JOURNEY_REGISTRY_V2` | Journey registry V2 feature flag |
| `FEATURE_KNOWLEDGE_GRAPH` | Knowledge graph feature flag |
| `API_BASE_URL` | API base URL |
| `API_RETRIES` | API retry count |
| `API_TIMEOUT` | API timeout |
| `DB_POOL_SIZE` | Database pool size |
| `SKIP_ENCRYPTION` | Skip encryption (dev only) |
| `ENCRYPTION_MIGRATION_PASSPHRASE` | Encryption migration passphrase |
| `AUTO_CAPTURE_GOLDEN` | Auto-capture golden records |
| `GOLDEN_RECORD_SCREENSHOT_DIR` | Golden record screenshot directory |
| `SCREENSHOT_BASE_URL` | Screenshot capture service URL |
| `OLLAMA_BASE_URL` | Ollama local model URL |
| `OLLAMA_MODEL` | Ollama model name |
| `OPENAI_MODEL` | OpenAI model override |
| `MAX_PLANNING_ITERATIONS` | Max EPM planning iterations |
| `TARGET_PLANNING_SCORE` | Target planning quality score |
| `EPM_FALLBACK_ON_ERROR` | EPM error fallback behavior |
| `CREWAI_SERVICE_URL` | CrewAI integration URL |
| `CREWAI_TIMEOUT` | CrewAI timeout |
| `CREWAI_HEALTH_INTERVAL` | CrewAI health check interval |
| `HOST` | Server bind host |

---

## 3. Program/Project Output

### Where Output Is Generated

The final EPM program is generated in `server/intelligence/epm/` - specifically the synthesis is orchestrated by the EPM generator service which calls each sub-generator:

- `workstream-generator.ts` - creates workstreams from analysis insights
- `timeline-calculator.ts` - calculates phases and milestones
- `resource-allocator.ts` - plans resource allocation
- `generators.ts` - generates executive summary, financial plan, benefits, risks, KPIs, stage gates, stakeholder map, governance, QA plan, procurement, exit strategy, program name

The final EPM program object is saved to the `epm_programs` table as a large encrypted JSONB blob in the `programData` column.

### Output Format

The completed program is a JSONB object stored in `epm_programs.programData` containing all these components (14 total):
- Executive summary
- Workstreams with tasks and deliverables
- Timeline with phases
- Resource plan
- Financial plan
- Risk register
- Benefits realization
- KPIs
- Stage gates
- Stakeholder map
- Governance structure
- QA plan
- Procurement plan
- Exit strategy

### Export Insertion Point

To add a new export format:

- **Route file:** `server/routes/exports.ts` - `GET /api/exports/full-pass` is the main export endpoint
- **Export service:** `server/services/export/` directory - each format has its own exporter:
  - `markdown-exporter.ts`, `pdf-exporter.ts`, `docx-exporter.ts`, `excel-exporter.ts`, `csv-exporter.ts`, `html-exporter.ts`, `json-payloads.ts`
- **Base class:** `server/services/export/base-exporter.ts` - extend this for a new format
- **Assembly:** `server/services/export/index.ts` - `generateFullPassExport()` function assembles all formats into a ZIP archive. Add your new exporter call here and add the result to the archive.

---

## 4. State Management & User Flow

### Full User Journey

1. **Landing page** (`/`) -> `HomePage`
2. **Auth** (`/auth`) -> Login via Replit OIDC
3. **Dashboard** (`/`) when authenticated -> shows analysis count, recent programs
4. **New Analysis** (`/strategic-consultant/input`) -> user types business idea
5. **Disambiguation** -> system checks for ambiguities, asks clarifying questions
6. **Classification** (`/strategic-consultant/classification/:understandingId`) -> confirms business type
7. **Journey Selection** (`/strategic-consultant/journey-selection/:understandingId`) -> picks analysis journey (e.g., Business Model Innovation)
8. **Five Whys Tree** (`/strategic-consultant/whys-tree/:understandingId`) -> interactive root cause analysis
9. **Research** (`/strategic-consultant/research/:sessionId`) -> SSE-streamed AI analysis (Five Whys -> BMC, etc.)
10. **Decisions** (`/strategy-workspace/decisions/:sessionId/:versionNumber`) -> AI-generated strategic decisions
11. **Prioritization** (`/strategy-workspace/prioritization/:sessionId/:versionNumber`) -> user prioritizes decisions
12. **EPM Program** (`/strategy-workspace/epm/:id`) -> generated program with Gantt chart, workstreams, resources, risks, etc.
13. **Export** -> download ZIP bundle (Markdown, PDF, DOCX, Excel, CSV, JSON)

### All Routes

```
/                                                    -> HomePage (landing/dashboard)
/auth                                                -> AuthPage (login)
/programs                                            -> ProgramsPage (legacy programs)
/strategic-consultant                                -> InputPage (new analysis)
/strategic-consultant/input                          -> InputPage
/strategic-consultant/classification/:understandingId -> ClassificationPage
/strategic-consultant/journey-selection/:understandingId -> JourneySelectionPage
/strategic-consultant/whys-tree/:understandingId     -> WhysTreePage
/strategic-consultant/research/:sessionId            -> ResearchPage (SSE streaming)
/strategic-consultant/journey-results/:sessionId     -> JourneyResultsPage
/strategic-consultant/market-entry-results/:sessionId/:versionNumber -> MarketEntryResultsPage
/strategic-consultant/pestle-results/:sessionId/:versionNumber -> PESTLEResultsPage
/strategic-consultant/porters-results/:sessionId/:versionNumber -> PortersResultsPage
/strategic-consultant/swot-results/:sessionId/:versionNumber -> SWOTResultsPage
/strategic-consultant/results/:sessionId/:versionNumber -> StrategyResultsPage
/strategic-consultant/analysis/:sessionId            -> AnalysisPage
/strategic-consultant/framework-insight/:sessionId   -> FrameworkInsightPage
/strategic-consultant/trend-analysis/:sessionId/:versionNumber -> TrendAnalysisPage
/strategic-consultant/decisions/:sessionId/:versionNumber -> DecisionPage
/strategic-consultant/epm/:sessionId/:versionNumber  -> EPMPage
/strategic-consultant/versions/:sessionId            -> VersionsPage
/strategy-workspace/programs                         -> ProgramsListPage
/strategy-workspace/decisions/:sessionId/:versionNumber -> DecisionSummaryPage
/strategy-workspace/prioritization/:sessionId/:versionNumber -> PrioritizationPage
/strategy-workspace/epm/:id                          -> EPMProgramView
/marketing-consultant                                -> MarketingInputPage
/marketing-consultant/input                          -> MarketingInputPage
/marketing-consultant/discoveries                    -> MyDiscoveriesPage
/marketing-consultant/classification/:understandingId -> MarketingClassificationPage
/marketing-consultant/journey-selection/:understandingId -> MarketingJourneySelectionPage
/marketing-consultant/segment-discovery/:understandingId -> SegmentDiscoveryPage
/marketing-consultant/results/:understandingId       -> SegmentDiscoveryPage
/journeys                                            -> JourneyHub
/journey-builder                                     -> JourneyBuilderPage
/strategies                                          -> StrategiesListPage
/strategies/:id                                      -> StrategyDetailPage
/repository                                          -> RepositoryBrowser
/repository/:understandingId                         -> StatementDetailView
/admin/golden-records                                -> GoldenRecordsListPage
/admin/golden-records/:journeyType                   -> GoldenRecordTimelinePage
/admin/golden-records/:journeyType/:version          -> GoldenRecordDetailPage
/admin/golden-records/:journeyType/:version/compare  -> GoldenRecordComparePage
```

### State Management

- **Global:** TanStack Query (server state cache), React Contexts (`ProgramContext`, `JobContext`, `DocumentInsightsContext`), `AuthProvider` (user session)
- **Component-level:** React `useState`/`useReducer` for UI state
- **Framework outputs during a session:** Stored server-side in the database. During SSE streaming, progress events are sent to the frontend. When analysis completes, results are saved to `framework_insights` table and `journey_sessions.findings` JSONB column. The frontend receives the complete data in the SSE `complete` event.
- **No client-side persistence** of analysis data - everything lives in PostgreSQL on the server.

### Where Final Output Lives Before Display

The completed EPM program object is fetched from `epm_programs` table via `GET /api/strategy-workspace/epm/:id`. The `EPMProgramView.tsx` page component fetches this and renders all program components (Gantt, resources, risks, etc.).

---

## 5. Existing Integrations & Auth

### Export Functionality

Comprehensive export exists in `server/services/export/` and `server/routes/exports.ts`:

- **ZIP bundle** containing: Markdown report, plain PDF, UI-styled PDF, DOCX, Excel workbook (8 sheets), CSV files, JSON data, UI-styled HTML
- **Gantt chart SVG export** (client-side canvas to PNG download)
- **Endpoint:** `GET /api/exports/full-pass?programId=xxx`
- Additional endpoints: `GET /api/exports/excel`, `GET /api/exports/pdf`

### Authentication

- **Provider:** Replit OIDC (OpenID Connect) via `openid-client` library
- **Configured in:** `server/replitAuth.ts` - fetches OIDC config from Replit, registers Passport strategy
- **Session:** `express-session` with `connect-pg-simple` (sessions stored in PostgreSQL `sessions` table)
- **Dev mode:** `DEV_AUTH_BYPASS=true` injects a synthetic user, skips OIDC entirely
- **Middleware:** `isAuthenticated` middleware on all `/api/*` routes checks for valid session

### API Endpoints That Return Program Data as JSON

- `GET /api/strategy-workspace/epm/:id` - returns full EPM program JSONB
- `GET /api/strategy-workspace/epm` - lists all user's EPM programs
- `GET /api/strategic-consultant/versions/:sessionId/:versionNumber` - returns strategy version with analysis/decisions data
- `GET /api/strategic-consultant/journey-sessions/:sessionId` - returns journey session with framework findings
- `GET /api/strategic-consultant/understanding/:understandingId` - returns strategic understanding with entities
- `GET /api/exports/full-pass` - includes JSON payloads in the ZIP bundle
