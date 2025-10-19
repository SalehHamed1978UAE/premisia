### Overview

Qgentic Intelligent Strategic EPM is an AI-enhanced, full-stack web application designed for comprehensive enterprise program management. It supports the entire program lifecycle, offering tools for managing programs, workstreams, tasks, resources, risks, benefits, KPIs, and financial tracking via an intuitive dashboard. The project aims to provide a holistic solution for strategic decision-making and EPM integration, featuring real-time AI intelligence, a multi-agent architecture, and a formal ontology for expert guidance. Capabilities include multi-modal input analysis, anti-bias research, and conversion of strategic decisions into actionable EPM program structures.

### User Preferences

Preferred communication style: Simple, everyday language.

### System Architecture

#### UI/UX Decisions

The frontend uses React, TypeScript, and Vite, with Shadcn/ui (Radix UI, Tailwind CSS) for a "New York" style, themeable UI. It delivers a single-page application experience with mobile responsiveness, skeleton loading, and toast notifications.

#### Technical Implementations

- **Frontend**: React, TypeScript, Vite, TanStack Query for state management, Wouter for client-side routing.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication (Local Strategy, scrypt hashing), Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver, Drizzle ORM for type-safe schema and Zod validation. `connect-pg-simple` for session storage.
- **Authentication/Authorization**: Session-based authentication via Passport.js with Replit OIDC, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer). Includes a secure development authentication bypass.

#### Feature Specifications

- **AI Multi-Agent System**: Utilizes an ontology foundation (9 core entities, 19 relationship mappings, 36 validation rules, 13 domain terms) to power an Executive Agent, Builder Specialist Agent, QA Specialist Agent, and a Multi-Agent Orchestrator supporting multiple AI providers (OpenAI, Anthropic, Gemini).
- **Strategic Consultant & EPM Integration**:
    - Transforms executive input (multi-modal: text, PDF, DOCX, Excel, image) into AI-analyzed strategic decisions and EPM program structures.
    - **Five Whys Carousel Interface**: Interactive root cause analysis with anti-bias mechanisms.
    - **Anti-Confirmation Bias Research**: Generates validating and challenging web search queries.
    - **EPM Conversion**: Converts strategic decisions into program structures (workstreams, tasks, KPIs) with atomic, concurrency-safe database integration.
    - **Version Management**: Supports unlimited strategy versions with comparison features and ontology validation against 35 EPM rules.
    - **Strategic Decisions Module**: Provides persistent access to all strategy versions and integrated programs, including a statement repository with delete and archive functionality.
    - **Intelligent Framework Selection**: AI-powered routing between Business Model Canvas and Porter's Five Forces based on input analysis.
    - **Business Model Canvas (BMC) Analysis**: Full 9-block implementation with block-specific query generation, parallel research, cross-block consistency validation, and proactive assumption challenging. Features real-time progress streaming via Server-Sent Events (SSE).
    - **Strategic Understanding Service (Knowledge Graph Architecture)**: Employs a knowledge graph with PostgreSQL and `pgvector` for source-validated entity categorization (Explicit, Implicit, Inferred) and relationship mapping, using embeddings for semantic search and contradiction validation.
    - **Robustness and Performance**: Implements multi-provider AI fallback, extended socket timeouts, and request throttling with exponential backoff.
    - **Trend Analysis Agent**: Provides production-ready PESTLE analysis with an evidence-first architecture, including database schema, external services (Azure Translator, GeoNames), authority registry, evidence extraction, domain extraction, PESTLE claims generation, assumption comparison, and trend synthesis services. Features a job queue, API routes with SSE progress streaming, and a comprehensive frontend UI with 5 components. Fully tested for multilingual support, geography awareness, idempotency, and security.
    - **Journey-Based Strategic Analysis**: A multi-framework sequential analysis system where "journeys" are interactive page sequences that guide users through strategic frameworks. Each journey is a series of interactive pages (not automated backend execution). Features include:
      - Journey type system with 6 pre-planned journeys (Business Model Innovation is available)
      - Interactive pages: WhysTreePage (carousel selection), ResearchPage (SSE streaming), BMCResultsPage (analysis display)
      - Journey sessions track user progress through page sequences
      - Strategic context accumulation persists data as users complete each interactive step
      - Framework-agnostic bridges transform context between pages (e.g., Five Whys → BMC)
      - JSONB context persistence and pause/resume support
      - Navigation is client-side, routing users through the defined page sequence

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