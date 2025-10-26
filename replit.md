### Overview
Qgentic Intelligent Strategic EPM is an AI-enhanced, full-stack web application designed for comprehensive enterprise program management. It supports the entire program lifecycle, offering tools for managing programs, workstreams, tasks, resources, risks, benefits, KPIs, and financial tracking via an intuitive dashboard. The project's core purpose is to provide a holistic solution for strategic decision-making and EPM integration, featuring real-time AI intelligence, a multi-agent architecture, and a formal ontology for expert guidance. Key capabilities include multi-modal input analysis, anti-bias research, and the conversion of strategic decisions into actionable EPM program structures.

### User Preferences
Preferred communication style: Simple, everyday language.

**Development Philosophy:**
- No band-aid fixes or workarounds (e.g., making fields nullable to bypass foreign key constraints)
- Always fix root architectural issues properly the first time
- Take time to understand the proper data flow before implementing fixes
- Clean separation of concerns - don't mix old and new system architectures

### System Architecture

#### UI/UX Decisions
The frontend utilizes React, TypeScript, and Vite, leveraging Shadcn/ui (built on Radix UI and Tailwind CSS) to achieve a "New York" style, themeable UI. It provides a single-page application experience with mobile responsiveness, skeleton loading, and toast notifications. Responsive design principles are applied across components like Gantt charts, tab navigation, button layouts, and card displays, primarily using Tailwind's `sm:` breakpoint for transitions from mobile-first to desktop layouts.

#### Technical Implementations
- **Frontend**: React, TypeScript, Vite, TanStack Query for state management, and Wouter for client-side routing.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication, Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver, and Drizzle ORM for type-safe schema and Zod validation.
- **Database Connection Management**: A system-wide `DBConnectionManager` ensures reliable database operations, using `withFreshConnection()` for short operations and `retryWithBackoff()` for saves after long operations to manage Neon serverless connections.
- **Authentication/Authorization**: Session-based authentication via Passport.js with Replit OIDC, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer).

#### Feature Specifications
- **AI Multi-Agent System**: Built on an ontology, comprising an Executive Agent, Builder Specialist Agent, QA Specialist Agent, and a Multi-Agent Orchestrator supporting multiple AI providers.
- **Strategic Consultant & EPM Integration**: Transforms executive input into AI-analyzed strategic decisions and EPM program structures, including modules for Five Whys, Anti-Confirmation Bias Research, EPM Conversion, Version Management, Strategic Decisions, and Intelligent Framework Selection (Business Model Canvas, Porter's Five Forces).
- **Five Whys Custom Input**: Users can add custom "Why" statements at any level when AI-generated options don't fit. Fixed duplication bug (Oct 2025) where custom options were being added twice to previousAnswers array, causing AI to ignore or misinterpret custom user input. The fix ensures selectedPath (which frontend adds custom options to) is passed directly to the AI prompt without re-adding the custom option in the backend.
- **Business Model Canvas (BMC) Analysis**: Features a full 9-block implementation with block-specific query generation, parallel research, cross-block consistency validation, proactive assumption challenging, and real-time progress streaming via Server-Sent Events (SSE).
- **Strategic Understanding Service (Knowledge Graph Architecture)**: Uses a knowledge graph with PostgreSQL and `pgvector` for source-validated entity categorization, relationship mapping, semantic search, and contradiction validation.
- **Robustness and Performance**: Incorporates multi-provider AI fallback, extended socket timeouts, and request throttling with exponential backoff.
- **Trend Analysis Agent**: Provides production-ready PESTLE analysis with an evidence-first architecture, encompassing data extraction, claim generation, and trend synthesis.
- **Journey-Based Strategic Analysis**: Implements interactive page sequences guiding users through strategic frameworks.
- **Modular Framework Renderer Architecture**: An extensible system for displaying strategic analysis results across various frameworks (BMC, Porter's, Five Whys) using a framework registry.
- **Strategy Intelligence Layer**: The core AI engine that converts any strategic framework into complete, executable EPM programs with all 14 required components, including framework-specific analyzers and an EPM Synthesis Engine.
- **Strategy Workspace**: A system bridging AI analysis and EPM programs through user strategic decision-making, featuring a 4-page wizard for capturing strategic choices, decision validation, a confidence boosting algorithm for EPM generation, and an EPM Program View with inline editing.
- **EPM Display Formatters**: Enterprise-grade visual components for displaying EPM data across 7 tabs, with 14 specialized formatters for all EPM components, including color-coded risk levels, priority badges, confidence indicators, timeline visualizations, and stakeholder maps.
- **Dynamic Home Page**: An adaptive landing page providing personalized experiences; new users see an onboarding flow, while existing users see a dashboard with stats cards, recent activity, and quick action buttons.
- **Batch Operations & Archive**: Both Analysis Repository and EPM Programs pages support batch selection for actions like delete, archive (soft-delete), and export, with dedicated backend endpoints for these operations.
- **Intelligent Planning System**: A comprehensive AI-powered project planning library (`src/lib/intelligent-planning/`) that provides advanced schedule optimization, resource allocation, and validation for EPM programs. It includes an LLM Task Extractor, CPM Scheduler, Resource Manager, AI Optimizer, LLM Validator, and a Project Planning Orchestrator. This system integrates with the EPM synthesis engine via a feature flag to replace standard timeline generation with AI-validated, confidence-scored schedules. It features real-time progress streaming via SSE during EPM generation, with granular updates originating from actual LLM operations and planning steps. The WBS Builder module within this system is strategy-aware, adapting workstream generation based on BMC strategic recommendations rather than fixed business types.
- **Journey Builder System** (October 2025): A user-composable framework system allowing users to choose from 6 pre-defined strategic journeys OR create custom journeys by selecting their own frameworks. Features AI-powered validation ensuring enough information is collected for EPM generation. Each journey creates an isolated knowledge graph via unique sessionId. Backend includes 3 core services (validator, builder, recommendations), database schema with 2 enums and 3 tables (journey_templates, user_journeys, framework_registry), 6 system templates (Business Model Innovation, Digital Transformation, Market Entry, Competitive Strategy, Crisis Recovery, Growth Strategy), and 7 registered frameworks. API routes at `/api/journey-builder/*` include endpoints for templates, frameworks, journey creation, validation, analysis, and AI framework suggestions. Zero breaking changes to existing Strategic Consultant flow - purely additive feature.

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