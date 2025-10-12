### Overview

Qgentic Intelligent Strategic EPM is an AI-enhanced, full-stack web application for comprehensive enterprise program management. It provides tools for managing programs, workstreams, tasks, resources, risks, benefits, KPIs, and financial tracking via an intuitive dashboard, supporting the full program lifecycle. Key features include role-based access, real-time AI intelligence through a multi-agent architecture, and a formal ontology for expert guidance and decision-making. The project's ambition is to deliver a holistic solution for strategic decision-making and EPM integration, offering capabilities like multi-modal input analysis, anti-bias research, and conversion of strategic decisions into actionable EPM program structures.

### User Preferences

Preferred communication style: Simple, everyday language.

### System Architecture

#### UI/UX Decisions

The frontend is built with React, TypeScript, and Vite, utilizing Shadcn/ui (Radix UI, Tailwind CSS) to achieve a "New York" style UI with theming. It focuses on a single-page application experience, mobile responsiveness, skeleton loading, and toast notifications.

#### Technical Implementations

- **Frontend**: React, TypeScript, Vite, TanStack Query for state management, Wouter for client-side routing.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication (Local Strategy, scrypt hashing), Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver, Drizzle ORM for type-safe schema and Zod validation. `connect-pg-simple` handles session storage.
- **Authentication/Authorization**: 
  - Session-based authentication using Passport.js with Replit OIDC integration
  - HTTP-only cookies and three-tier role system (Admin, Editor, Viewer)
  - **Development Auth Bypass** (Oct 2025): Secure local development mode that injects synthetic user when:
    - `DEV_AUTH_BYPASS=true` environment variable is explicitly set, AND
    - Request originates from true loopback address (127.0.0.1, ::1, or ::ffff:127.0.0.1)
    - Uses socket remote address (cannot be spoofed via headers)
    - Blocks and alerts if DEV_AUTH_BYPASS is set on non-loopback connections
    - Must remain disabled (`DEV_AUTH_BYPASS=false` or unset) in production

#### Feature Specifications

- **AI Multi-Agent System**: Features an ontology foundation (9 core entities, 19 relationship mappings, 36 validation rules, 13 domain terms) for AI reasoning. Includes an Executive Agent for context management, a Builder Specialist Agent for code generation, a QA Specialist Agent for adversarial reviews, and a Multi-Agent Orchestrator for workflow coordination and multi-provider AI support (OpenAI, Anthropic, Gemini).
- **Strategic Consultant & EPM Integration**:
    - Converts executive input into AI-analyzed strategic decisions and EPM program structures, supporting multi-modal input (text, PDF, DOCX, Excel, image).
    - **Five Whys Carousel Interface**: Interactive root cause analysis with anti-bias mechanisms.
    - **Anti-Confirmation Bias Research**: Generates validating and challenging web search queries, prioritizing contradictory findings.
    - **EPM Conversion**: Transforms decisions into program structures (workstreams, tasks, KPIs) with atomic, concurrency-safe database integration.
    - **Version Management**: Supports unlimited strategy versions with comparison features.
    - **Ontology Validation**: Validates outputs against 35 EPM ontology rules.
    - **Strategic Decisions Module**: Provides persistent access to all strategy versions and integrated programs.
    - **Intelligent Framework Selection**: AI-powered routing between Business Model Canvas and Porter's Five Forces based on input analysis.
    - **Business Model Canvas (BMC) Analysis**: Full 9-block implementation covering all BMC components with block-specific query generation, parallel research, cross-block consistency validation, and a proactive assumption challenge system.
    - **Strategic Understanding Service (Knowledge Graph Architecture)**: Replaces simpler assumption extraction with a knowledge graph using PostgreSQL with `pgvector` for robust, source-validated entity categorization (Explicit, Implicit, Inferred) and relationship mapping. Incorporates embeddings for semantic search and includes semantic validation for contradictions to ensure accuracy and prevent false positives. This service is integrated with BMC research to persist user and agent-discovered entities and contradictions, featuring context-grounded query generation to preserve specific details in research.
    - **Robustness and Performance**: Includes mechanisms for multi-provider AI fallback, extended socket timeouts for long-running research tasks, and request throttling with exponential backoff to manage external API rate limits.
    - **Progress Streaming UX (Oct 2025)**: Real-time BMC research progress via Server-Sent Events (SSE) during ~2-minute analysis. Timer-based approach emits 84 messages across 8 categories every 1.4 seconds (categories: 11-10-11-10-11-10-11-10 messages). Categories span analyzing, breaking down, market research, pricing, partnerships, costs, contradictions, and finalization. Frontend uses rolling buffer to handle partial chunks, error events propagate to user, completion message persists with checkmark. Progress bar shows step counter. Prevents "frozen" appearance during long-running research.
    - **Trend Analysis Agent (Phase 3 - COMPLETED ✅, Oct 2025)**: Production-ready PESTLE analysis with evidence-first architecture:
      - **Phase 3.1 (COMPLETED)**: Database schema with 7 tables (authority_sources with junction tables for industries/countries/languages, trend_claims_cache with 7-day TTL, trend_analysis_jobs for idempotency, framework_insights for generic storage). TypeScript interfaces defined: Geography, Domain, SourceGuidance, Evidence, Claim, PESTLEFactors, TrendResult, TrendTelemetry.
      - **Phase 3.2 (COMPLETED)**: External services with circuit breakers - Azure Translator (language detection, translation, LLM fallback) and GeoNames (geocoding, scope determination, LLM fallback).
      - **Phase 3.3 (COMPLETED)**: Authority Registry with auto-seed (12 tier-based authorities), fuzzy source matching (Levenshtein + word-boundary industry filtering), tier-based scoring, and geographic/industry filtering.
      - **Phase 3.4 (COMPLETED)**: Evidence Extraction Service with multi-stage LLM prompts (overview→claims), Azure translation with fallback, 2+ source corroboration with Tier 1 whitelist exception.
      - **Phase 3.5.1 (COMPLETED)**: Domain Extraction Service with comprehensive language inference (direct fields → nested objects → array traversal), industry/geography keyword inference, regulatory context aggregation, and assumption collection from strategic_entities.
      - **Phase 3.5.2 (COMPLETED)**: PESTLE Claims Generation with LLM-based trend analysis, domain categorization (POLITICAL/ECONOMIC/SOCIAL/TECHNOLOGICAL/LEGAL/ENVIRONMENTAL), time horizon extraction (short/medium/long-term), and rationale generation.
      - **Phase 3.5.3 (COMPLETED)**: Assumption Comparison Service with LLM-powered relationship identification (validates/contradicts/neutral), confidence scoring, evidence explanation, and summary statistics.
      - **Phase 3.5.4 (COMPLETED)**: Trend Synthesis Service with executive summary generation, key findings, strategic implications, recommended actions, risk/opportunity identification, and telemetry tracking (latency, LLM calls, tokens, cache hits, API calls, retries, provider usage).
      - **Phase 3.5.5 (COMPLETED)**: TrendAnalysisAgent Orchestrator with complete telemetry tracking across all phases - Phase 1 (domain extraction, latency only), Phase 2 (PESTLE generation with provider tracking), Phase 3 (assumption comparison with multi-provider tracking), Phase 4 (synthesis with telemetry accumulation). Accumulates latency correctly (no overwrites), tracks all LLM calls with actual providers (openai/anthropic/gemini), filters 'unknown' error cases, enables accurate usage analytics.
      - **Phase 3.6.1 (COMPLETED)**: Job Queue Service with race-safe idempotency using insert-then-catch pattern, handles concurrent createJob calls via unique constraint violations (PostgreSQL error 23505), status transitions (pending→running→completed/failed), timestamp tracking, result/error storage in JSONB.
      - **Phase 3.6.2 (COMPLETED)**: API Routes with SSE progress streaming - POST /api/trend-analysis/:understandingId for job orchestration and real-time updates, GET /:understandingId/status for job polling, GET /:understandingId/latest for newest analysis (desc ordering). Dual storage pattern persists to framework_insights (queryable) and strategyVersions (history). Idempotent caching returns completed results without re-execution.
      - **Phase 3.6.3 (COMPLETED)**: Frontend UI with 5 components - TrendProgressView (SSE streaming with 4 phase indicators), PESTLEFactorsView (6 color-coded categories: Political/red, Economic/green, Social/blue, Tech/purple, Legal/amber, Environmental/teal), AssumptionComparisonView (validates/contradicts highlighting), TrendSynthesisView (executive summary with opportunities/risks), TrendAnalysisPage (main orchestrator). Navigation: Analysis → Trend Analysis → Decisions. Route: /strategic-consultant/trend-analysis/:sessionId/:versionNumber. All components tested e2e with data-testids for automated testing. Cached result replay works instantly.
      - **Phase 3.7 (COMPLETED - E2E TESTED & PRODUCTION READY)**: Comprehensive automated e2e testing validated all 5 scenarios - Asana (US/English baseline), Paris restaurant (French multilingual), Mumbai healthcare (Hindi cross-domain filtering), Dubai real estate (Arabic geography normalization), Security (SQL injection protection). Tests confirmed: SSE streaming, framework_insights persistence, telemetry tracking, cross-domain filtering (healthcare ≠ SaaS trends), multilingual support (en/fr/hi/ar), geography normalization, idempotency (cached results), security protection (SQL injection blocked), GET /latest endpoint. All hardening features validated: versioning, throttling, circuit breakers, cache TTL, telemetry, idempotency, multi-provider fallback, translation fallback, geo fallback, authority scoring.
      - **Evidence-First Principle**: LLM extracts from sources, never generates facts. 2+ source corroboration requirement (exception: high-authority whitelist).
      - **Geography-Aware Architecture**: Multilingual support with Azure Translator + GeoNames integration, LLM fallbacks, circuit breaker pattern.
      - **Auto-Seeding**: Authorities auto-seed on first request with ensureSeeded() pattern (12 pre-defined tier-based sources).
      - **Dual Storage Pattern**: framework_insights (detailed queryable) AND strategic_versions.analysisData (version history).
      - **Hardening Integrated**: 40-hour production implementation with versioning, request throttling, exponential backoff, and multi-provider AI fallback.

### External Dependencies

- **Database Service**: Neon serverless PostgreSQL (`@neondatabase/serverless`)
- **Session Store**: `connect-pg-simple`
- **UI Libraries**: Radix UI, Tailwind CSS, Lucide React
- **Form Management/Validation**: `react-hook-form`, Zod
- **Date Utilities**: `date-fns`
- **Build Tools**: Vite (frontend), esbuild (server-side)
- **AI Providers**: OpenAI, Anthropic, Gemini
- **ORM**: Drizzle ORM
- **Authentication**: Passport.js with Replit OIDC