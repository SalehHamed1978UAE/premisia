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
- **Authentication/Authorization**: Session-based authentication using Passport.js, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer).

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
    - **Progress Streaming UX (Oct 2025)**: Real-time BMC research progress via Server-Sent Events (SSE) during 5-6 minute analysis. Backend emits 8 milestone messages ("🔍 Analyzing...", "🌐 Searching markets...", "🎯 Detecting contradictions...", "✨ Complete!"). Frontend uses rolling buffer to handle partial chunks, error events propagate to user, completion message persists with checkmark. Progress bar shows "Step 3 of 8" during research. Prevents "frozen" appearance.

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