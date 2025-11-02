# Overview
Premisia (formerly QGentic) is an AI-enhanced, full-stack web application designed for comprehensive enterprise program management. Tagline: "Think it through" It supports the entire program lifecycle, from program and task management to tracking resources, risks, benefits, KPIs, and financials via an intuitive dashboard. The project aims to provide a holistic solution for strategic decision-making and EPM integration, featuring real-time AI intelligence, a multi-agent architecture, and a formal ontology for expert guidance. Key capabilities include multi-modal input analysis, anti-bias research, document intelligence enrichment, and the conversion of strategic decisions into actionable EPM program structures.

# User Preferences
Preferred communication style: Simple, everyday language.

**Development Philosophy:**
- No band-aid fixes or workarounds (e.g., making fields nullable to bypass foreign key constraints)
- Always fix root architectural issues properly the first time
- Take time to understand the proper data flow before implementing fixes
- Clean separation of concerns - don't mix old and new system architectures

# System Architecture

## UI/UX Decisions
The frontend uses React, TypeScript, and Vite, with Shadcn/ui (Radix UI and Tailwind CSS) for a themeable "New York" style UI. It's a single-page application with mobile-first responsive design, including a breakpoint system, adaptive layouts, responsive typography, skeleton loading, and toast notifications. The "Five Whys" page features an interactive, responsive design with a progressive breadcrumb, carousel wheel picker for mobile, and a 2x2 grid for desktop.

## Technical Implementations
- **Frontend**: React, TypeScript, Vite, TanStack Query, Wouter.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication, Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver and Drizzle ORM for type-safe schema and Zod validation. `DBConnectionManager` handles database connections.
- **Authentication/Authorization**: Session-based authentication via Passport.js with Replit OIDC, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer).
- **Background Jobs**: A hybrid system with database persistence and real-time tracking, dispatching jobs every 15 seconds. A `Modular Framework Executor Registry` supports a plugin system for strategic analysis frameworks.

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
- **Journey Builder System**: Allows users to choose from 6 pre-defined journeys or create custom ones with AI validation.
- **Universal Background Jobs System**: Hybrid system for tracking long-running operations with database persistence and real-time SSE streaming.
- **Non-Blocking Progress UX**: Uses a fixed-position progress card (`MinimizedJobTracker`) and polling.
- **Enterprise Data Encryption**: AES-256-GCM encryption for sensitive business data at rest.
- **Full-Pass Export System**: Generates ZIP bundles with strategic analysis and EPM program data in multiple formats.
- **Document Intelligence Enrichment**: Background job pipeline for asynchronously extracting knowledge from uploaded documents (PDF, DOCX, Excel, images), populating the encrypted knowledge graph.
- **Strategies Hub**: Unified view for all strategic initiatives, providing artifact hierarchy and research provenance.
- **Journey Launcher Modal**: Intelligent modal for initiating additional strategic analysis, with two modes (Full Journey, Single Framework) and journey-aware readiness checks.
- **Ambiguity Resolution & Clarifications**: AI-powered clarification workflows for strategic inputs.
- **Journey Registry V2** (FEATURE_JOURNEY_REGISTRY_V2): "Register once, works everywhere" system with centralized journey definitions, automatic summary generation, baseline reuse for follow-on runs, and intelligent readiness thresholds. Includes developer tools (sync script, smoke tests, CLI admin commands) and 100% test coverage with 18/18 automated tests passing.
  - **EPM Completion Hook**: Bridges old and new flows by automatically saving journey summaries when BMI journeys complete through the legacy Five Whys → BMC → EPM endpoint flow. Uses two-step lookup (strategyVersions → strategicUnderstanding → journeySessions) to locate journey sessions and persist encrypted summaries for follow-on run reuse. Integration tests verify positive/negative/flag-gated behavior (tests/epm-completion-hook.spec.ts).

## Journey Navigation Architecture
The application uses two orchestrator-driven entry points for strategic journeys: "Strategic Consultant Journey" (new analysis) and "Strategies Hub Run Now" (follow-on analysis). Both use a `pageSequence` array to determine navigation order. Critical navigation rules include using `pageSequence[1]` to skip the input page for journey execution and the strict requirement for both `sessionId` and `versionNumber` in the Strategic Decisions page route. Research endpoints are expected to return a `nextUrl` with the complete path and `versionNumber`.

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