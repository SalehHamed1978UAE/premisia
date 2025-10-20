### Overview
Qgentic Intelligent Strategic EPM is an AI-enhanced, full-stack web application designed for comprehensive enterprise program management. It supports the entire program lifecycle, offering tools for managing programs, workstreams, tasks, resources, risks, benefits, KPIs, and financial tracking via an intuitive dashboard. The project aims to provide a holistic solution for strategic decision-making and EPM integration, featuring real-time AI intelligence, a multi-agent architecture, and a formal ontology for expert guidance. Capabilities include multi-modal input analysis, anti-bias research, and conversion of strategic decisions into actionable EPM program structures.

### User Preferences
Preferred communication style: Simple, everyday language.

### System Architecture

#### UI/UX Decisions
The frontend uses React, TypeScript, and Vite, with Shadcn/ui (Radix UI, Tailwind CSS) for a "New York" style, themeable UI. It delivers a single-page application experience with mobile responsiveness, skeleton loading, and toast notifications.

#### Technical Implementations
- **Frontend**: React, TypeScript, Vite, TanStack Query for state management, Wouter for client-side routing.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication, Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver, Drizzle ORM for type-safe schema and Zod validation.
- **Authentication/Authorization**: Session-based authentication via Passport.js with Replit OIDC, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer).

#### Feature Specifications
- **AI Multi-Agent System**: Utilizes an ontology foundation to power an Executive Agent, Builder Specialist Agent, QA Specialist Agent, and a Multi-Agent Orchestrator supporting multiple AI providers.
- **Strategic Consultant & EPM Integration**: Transforms executive input (multi-modal) into AI-analyzed strategic decisions and EPM program structures. Includes a Five Whys Carousel Interface, Anti-Confirmation Bias Research, EPM Conversion, Version Management, Strategic Decisions Module, and Intelligent Framework Selection (Business Model Canvas, Porter's Five Forces).
- **Business Model Canvas (BMC) Analysis**: Full 9-block implementation with block-specific query generation, parallel research, cross-block consistency validation, and proactive assumption challenging. Features real-time progress streaming via Server-Sent Events (SSE).
- **Strategic Understanding Service (Knowledge Graph Architecture)**: Employs a knowledge graph with PostgreSQL and `pgvector` for source-validated entity categorization and relationship mapping, using embeddings for semantic search and contradiction validation.
- **Robustness and Performance**: Implements multi-provider AI fallback, extended socket timeouts, and request throttling with exponential backoff.
- **Trend Analysis Agent**: Provides production-ready PESTLE analysis with an evidence-first architecture, including database schema, external services (Azure Translator, GeoNames), authority registry, evidence extraction, domain extraction, PESTLE claims generation, assumption comparison, and trend synthesis services.
- **Journey-Based Strategic Analysis**: A multi-framework sequential analysis system where "journeys" are interactive page sequences (e.g., Business Model Innovation Journey with WhysTreePage, ResearchPage, StrategyResultsPage) that guide users through strategic frameworks. Journeys are client-side driven and track user progress.
- **Modular Framework Renderer Architecture**: An extensible system for displaying strategic analysis results across multiple frameworks (BMC, Porter's, Five Whys) using a framework registry pattern and a unified `StrategyResultsPage`. This allows for pluggable renderers and data normalization without requiring new pages for each framework.
- **Strategy Intelligence Layer**: The core AI engine that converts ANY strategic framework (BMC, Porter's, PESTLE) into complete, executable EPM programs with all 14 required components (e.g., Executive Summary, Workstreams, Risks, KPIs). It includes framework-specific analyzers and an EPM Synthesis Engine.
- **Strategy Workspace**: A comprehensive system that bridges the automation gap between AI analysis and complete EPM programs through user strategic decision-making. It features a 4-page wizard for capturing strategic choices, decision validation, a confidence boosting algorithm for EPM generation, and an EPM Program View with inline editing, confidence displays, and status tracking.

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