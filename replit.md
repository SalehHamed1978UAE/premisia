### Overview
Qgentic Intelligent Strategic EPM is an AI-enhanced, full-stack web application for comprehensive enterprise program management. It supports the entire program lifecycle—managing programs, workstreams, tasks, resources, risks, benefits, KPIs, and financial tracking via an intuitive dashboard. The project aims to provide a holistic solution for strategic decision-making and EPM integration, featuring real-time AI intelligence, a multi-agent architecture, and a formal ontology for expert guidance. Key capabilities include multi-modal input analysis, anti-bias research, and the conversion of strategic decisions into actionable EPM program structures.

### User Preferences
Preferred communication style: Simple, everyday language.

**Development Philosophy:**
- No band-aid fixes or workarounds (e.g., making fields nullable to bypass foreign key constraints)
- Always fix root architectural issues properly the first time
- Take time to understand the proper data flow before implementing fixes
- Clean separation of concerns - don't mix old and new system architectures

### System Architecture

#### UI/UX Decisions
The frontend uses React, TypeScript, and Vite, with Shadcn/ui (Radix UI and Tailwind CSS) for a themeable "New York" style UI. It offers a single-page application experience with mobile responsiveness, skeleton loading, and toast notifications, applying responsive design principles with Tailwind's `sm:` breakpoint for mobile-to-desktop transitions.

#### Technical Implementations
- **Frontend**: React, TypeScript, Vite, TanStack Query, Wouter.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication, Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver and Drizzle ORM for type-safe schema and Zod validation.
- **Database Connection Management**: `DBConnectionManager` handles Neon serverless connections with `withFreshConnection()` and `retryWithBackoff()`.
- **Authentication/Authorization**: Session-based authentication via Passport.js with Replit OIDC, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer).

#### Feature Specifications
- **AI Multi-Agent System**: Ontology-based, comprising an Executive Agent, Builder Specialist Agent, QA Specialist Agent, and a Multi-Agent Orchestrator supporting multiple AI providers.
- **Strategic Consultant & EPM Integration**: Transforms executive input into AI-analyzed strategic decisions and EPM program structures, including Five Whys, Anti-Confirmation Bias Research, EPM Conversion, Version Management, Strategic Decisions, and Intelligent Framework Selection.
- **Business Model Canvas (BMC) Analysis**: Full 9-block implementation with query generation, parallel research, cross-block consistency validation, proactive assumption challenging, and real-time progress streaming via Server-Sent Events (SSE).
- **Strategic Understanding Service (Knowledge Graph Architecture)**: Uses a knowledge graph with PostgreSQL and `pgvector` for source-validated entity categorization, relationship mapping, semantic search, and contradiction validation.
- **Robustness and Performance**: Multi-provider AI fallback, extended socket timeouts, and request throttling with exponential backoff.
- **Trend Analysis Agent**: Provides production-ready PESTLE analysis with an evidence-first architecture.
- **Journey-Based Strategic Analysis**: Interactive page sequences guide users through strategic frameworks.
- **Modular Framework Renderer Architecture**: Extensible system for displaying strategic analysis results across various frameworks.
- **Strategy Intelligence Layer**: Core AI engine converting strategic frameworks into complete, executable EPM programs with 14 components, including framework-specific analyzers and an EPM Synthesis Engine.
- **Strategy Workspace**: Bridges AI analysis and EPM programs through user strategic decision-making via a 4-page wizard, decision validation, and an EPM Program View.
- **EPM Display Formatters**: Enterprise-grade visual components for EPM data across 7 tabs, with 14 specialized formatters.
- **Dynamic Home Page**: Adaptive landing page providing personalized experiences for new and existing users.
- **Batch Operations & Archive**: Analysis Repository and EPM Programs pages support batch actions (delete, archive, export).
- **Intelligent Planning System**: AI-powered project planning library (`src/lib/intelligent-planning/`) for advanced schedule optimization, resource allocation, and validation for EPM programs. Includes an LLM Task Extractor, CPM Scheduler, Resource Manager, AI Optimizer, LLM Validator, and a Project Planning Orchestrator. Integrates with EPM synthesis engine via a feature flag for AI-validated schedules and features real-time progress streaming via SSE.
- **Journey Builder System**: Allows users to choose from 6 pre-defined strategic journeys or create custom journeys by selecting their own frameworks, with AI-powered validation for EPM generation.
- **Universal Background Jobs System**: A hybrid safety net for long-running operations (e.g., EPM generation) that tracks job progress in the database alongside existing real-time SSE streaming, enabling users to navigate away and return to check status.
- **Non-Blocking Progress UX**: UI/UX overhaul replacing blocking modals with truly navigable experiences, using a fixed-position progress card, `MinimizedJobTracker`, polling-based notifications, and automatic navigation to results.
- **Enterprise Data Encryption**: AES-256-GCM encryption for sensitive business data at rest. Implemented for Strategic Understanding, Journey Sessions, and Strategic Entities/Knowledge Graph tables, with EPM Programs and Strategy Versions pending.

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