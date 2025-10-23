### Overview
Qgentic Intelligent Strategic EPM is an AI-enhanced, full-stack web application for comprehensive enterprise program management. It supports the entire program lifecycle, offering tools for managing programs, workstreams, tasks, resources, risks, benefits, KPIs, and financial tracking via an intuitive dashboard. The project aims to provide a holistic solution for strategic decision-making and EPM integration, featuring real-time AI intelligence, a multi-agent architecture, and a formal ontology for expert guidance. Capabilities include multi-modal input analysis, anti-bias research, and conversion of strategic decisions into actionable EPM program structures.

### User Preferences
Preferred communication style: Simple, everyday language.

**Development Philosophy:**
- No band-aid fixes or workarounds (e.g., making fields nullable to bypass foreign key constraints)
- Always fix root architectural issues properly the first time
- Take time to understand the proper data flow before implementing fixes
- Clean separation of concerns - don't mix old and new system architectures

### System Architecture

#### UI/UX Decisions
The frontend uses React, TypeScript, and Vite, with Shadcn/ui (Radix UI, Tailwind CSS) for a "New York" style, themeable UI. It delivers a single-page application experience with mobile responsiveness, skeleton loading, and toast notifications.

#### Technical Implementations
- **Frontend**: React, TypeScript, Vite, TanStack Query for state management, Wouter for client-side routing.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication, Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver, Drizzle ORM for type-safe schema and Zod validation.
- **Database Connection Management**: System-wide `DBConnectionManager` pattern ensures reliable database operations during long-running AI/web operations. All journey components MUST use `dbConnectionManager.withFreshConnection()` for short DB operations and `dbConnectionManager.retryWithBackoff()` for saves after long operations to prevent Neon serverless from killing idle connections.
- **Authentication/Authorization**: Session-based authentication via Passport.js with Replit OIDC, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer).

#### Feature Specifications
- **AI Multi-Agent System**: Utilizes an ontology foundation to power an Executive Agent, Builder Specialist Agent, QA Specialist Agent, and a Multi-Agent Orchestrator supporting multiple AI providers.
- **Strategic Consultant & EPM Integration**: Transforms executive input into AI-analyzed strategic decisions and EPM program structures, including a Five Whys Carousel, Anti-Confirmation Bias Research, EPM Conversion, Version Management, Strategic Decisions Module, and Intelligent Framework Selection (Business Model Canvas, Porter's Five Forces).
- **Business Model Canvas (BMC) Analysis**: Full 9-block implementation with block-specific query generation, parallel research, cross-block consistency validation, and proactive assumption challenging, featuring real-time progress streaming via Server-Sent Events (SSE).
- **Strategic Understanding Service (Knowledge Graph Architecture)**: Employs a knowledge graph with PostgreSQL and `pgvector` for source-validated entity categorization and relationship mapping, using embeddings for semantic search and contradiction validation.
- **Robustness and Performance**: Implements multi-provider AI fallback, extended socket timeouts, and request throttling with exponential backoff.
- **Trend Analysis Agent**: Provides production-ready PESTLE analysis with an evidence-first architecture, including database schema, external services, authority registry, evidence extraction, domain extraction, PESTLE claims generation, assumption comparison, and trend synthesis services.
- **Journey-Based Strategic Analysis**: A multi-framework sequential analysis system where "journeys" are interactive page sequences that guide users through strategic frameworks.
- **Modular Framework Renderer Architecture**: An extensible system for displaying strategic analysis results across multiple frameworks (BMC, Porter's, Five Whys) using a framework registry pattern and a unified `StrategyResultsPage`.
- **Strategy Intelligence Layer**: The core AI engine that converts ANY strategic framework into complete, executable EPM programs with all 14 required components. It includes framework-specific analyzers and an EPM Synthesis Engine.
- **Strategy Workspace**: A comprehensive system bridging AI analysis and complete EPM programs through user strategic decision-making, featuring a 4-page wizard for capturing strategic choices, decision validation, a confidence boosting algorithm for EPM generation, and an EPM Program View with inline editing, confidence displays, and status tracking.
- **EPM Display Formatters**: Enterprise-grade visual components replacing raw JSON with professionally formatted displays across 7 tabs (Summary, Planning, Resources, Benefits, Risks, Governance, Other). Features 14 specialized formatters for all EPM components with color-coded risk levels, priority badges, confidence indicators, timeline visualizations, and stakeholder maps. Implements type-safe handling of both simple string arrays and structured objects (e.g., strategic imperatives with action/priority/rationale), with graceful degradation and console warnings for debugging.
- **Dynamic Home Page**: Adaptive landing page that provides personalized experiences based on user activity. For new users (no existing work), displays an interactive 3-step onboarding flow introducing Strategic Consultant, Analysis Repository, and EPM Programs features. For existing users, shows a comprehensive dashboard with: (1) stats cards displaying counts of completed analyses, strategies, and programs; (2) recent activity section showing last 5 artifacts with navigation links; (3) quick action buttons for creating new analyses and accessing key features. Powered by `/api/dashboard-summary` endpoint with efficient database aggregation queries. Auth state management includes `staleTime: 0` and `refetchOnMount: "always"` to ensure fresh authentication data after OAuth redirects.
- **Batch Operations & Archive**: Both Analysis Repository and EPM Programs pages support batch selection with checkboxes for individual items and "Select all" functionality. Users can perform bulk actions (delete, archive, export) on multiple items simultaneously. Archive functionality uses soft-delete pattern with boolean `archived` field on `strategicUnderstanding`, `strategyVersions`, and `epmPrograms` tables. Export generates downloadable JSON files containing all selected items with their complete data. Backend provides 6 batch operation endpoints (3 for analyses at `/api/repository/batch-*`, 3 for programs at `/api/strategy-workspace/epm/batch-*`) supporting delete, archive, and export actions.
- **Intelligent Planning System**: A comprehensive AI-powered project planning library (`src/lib/intelligent-planning/`) that provides advanced schedule optimization, resource allocation, and validation for EPM programs. The system consists of modular components including: (1) LLM Task Extractor - converts strategic workstreams into detailed, executable tasks with dependencies; (2) CPM Scheduler - uses Critical Path Method to calculate optimal task sequencing and identify critical paths; (3) Resource Manager - allocates resources, detects conflicts, and performs resource leveling; (4) AI Optimizer - iteratively improves schedules using LLM-based reasoning to balance duration, resources, and constraints; (5) LLM Validator - provides deep validation with logical coherence checking, dependency analysis, and rationalization reports; (6) Project Planning Orchestrator - coordinates all modules with event-driven progress tracking. Features include: retry handling with exponential backoff, circuit breakers for service resilience, response caching for expensive LLM operations, and comprehensive error classification. The system is server-side only (uses Node.js `crypto` and `events` modules) and integrates with the EPM synthesis engine to generate intelligent, validated timelines.

### External Dependencies
- **Database Service**: Neon serverless PostgreSQL
- **Session Store**: `connect-pg-simple`
- **UI Libraries**: Radix UI, Tailwind CSS, Lucide React
- **Form Management/Validation**: `react-hook-form`, Zod
- **Date Utilities**: `date-fns`
- **Build Tools**: Vite, esbuild
- **AI Providers**: OpenAI, Anthropic, Gemini
- **ORM**: Drizzle ORM
- **Authentication**: Passport.js with Replit OIDC