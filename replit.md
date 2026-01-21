# Overview
Premisia is an AI-enhanced, full-stack web application designed for comprehensive enterprise program management. It aims to provide a holistic solution for strategic decision-making and EPM integration by supporting the entire program lifecycle, from program and task management to tracking resources, risks, benefits, KPIs, and financials. Key capabilities include real-time AI intelligence, a multi-agent architecture, multi-modal input analysis, anti-bias research, document intelligence enrichment, and the conversion of strategic decisions into actionable EPM program structures.

# User Preferences
Preferred communication style: Simple, everyday language.

**Development Philosophy:**
- No band-aid fixes or workarounds (e.g., making fields nullable to bypass foreign key constraints)
- Always fix root architectural issues properly the first time
- Take time to understand the proper data flow before implementing fixes
- Clean separation of concerns - don't mix old and new system architectures

# System Architecture

## UI/UX Decisions
The frontend uses React, TypeScript, and Vite, with Shadcn/ui (Radix UI and Tailwind CSS) for a themeable "New York" style UI. It features a single-page application with mobile-first responsive design, including a breakpoint system, adaptive layouts, responsive typography, skeleton loading, and toast notifications.

## Technical Implementations
- **Frontend**: React, TypeScript, Vite, TanStack Query, Wouter.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication, Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver and Drizzle ORM for type-safe schema and Zod validation.
- **Authentication/Authorization**: Session-based authentication via Passport.js with Replit OIDC, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer). Includes a two-phase auth initialization and lazy route loading.
- **Background Jobs**: A hybrid system with database persistence and real-time tracking, supporting a plugin system for strategic analysis frameworks.
- **Enterprise Data Encryption**: AWS KMS envelope encryption with AES-256-GCM for sensitive business data at rest in key database tables.
- **Journey Navigation Architecture**: Uses two orchestrator-driven entry points with a `pageSequence` array for navigation. Follow-on journeys create new, isolated journey sessions.
- **Context Foundry Integration**: Provides grounded analysis by querying verified organizational facts from Context Foundry before AI analysis, constraining LLM responses to use verified data with proper source citations. This is integrated into StrategyAnalyzer for frameworks like Five Whys and Porter's analysis, and is planned for BMC 9-Block Analysis and Segment Discovery Synthesis.
- **Multi-Agent EPM Generation System**: A TypeScript-native multi-agent orchestration system for generating EPM programs using 7 specialized agents working through 7 rounds of progressive elaboration, with full conversation persistence and resume capability via `multi_agent_sessions` and `multi_agent_turns` database tables. It includes a Critical Path Method (CPM) scheduler and an EPM Assembler.

## Feature Specifications
- **AI Multi-Agent System**: Ontology-based architecture with Executive, Builder, QA Specialist Agents, and a Multi-Agent Orchestrator.
- **Strategic Consultant & EPM Integration**: Converts executive input into AI-analyzed strategic decisions and EPM program structures, including AI-coaching, Anti-Confirmation Bias Research, Version Management, and Intelligent Framework Selection.
- **Business Model Canvas (BMC) Analysis**: Full 9-block implementation with query generation, parallel research, and cross-block consistency validation.
- **Strategic Understanding Service**: Uses PostgreSQL with `pgvector` for entity categorization, relationship mapping, semantic search, and contradiction validation.
- **Robustness**: Multi-provider AI fallback, extended socket timeouts, and request throttling.
- **Trend Analysis Agent**: Provides PESTLE analysis with an evidence-first architecture.
- **Journey-Based Strategic Analysis**: Guides users through interactive sequences for strategic frameworks with backend-controlled orchestration.
- **Strategy Intelligence Layer**: Core AI engine for converting strategic frameworks into executable EPM programs.
- **Strategy Workspace**: Bridges AI analysis and EPM programs through a wizard and EPM Program View.
- **EPM Display Formatters**: Enterprise-grade visual components for EPM data across multiple tabs.
- **Intelligent Planning System**: AI-powered project planning library for schedule optimization, resource allocation, and validation.
- **Journey Builder System**: Allows users to choose from pre-defined journeys or create custom ones with AI validation.
- **Universal Background Jobs System**: Hybrid system for tracking long-running operations with database persistence and real-time SSE streaming.
- **Full-Pass Export System**: Generates ZIP bundles with strategic analysis and EPM program data in multiple formats.
- **Document Intelligence Enrichment**: Background job pipeline for asynchronously extracting knowledge from uploaded documents, populating an encrypted knowledge graph.
- **Strategies Hub**: Unified view for all strategic initiatives, providing artifact hierarchy and research provenance.
- **Journey Launcher Modal**: Intelligent modal for initiating additional strategic analysis, with two modes and journey-aware readiness checks.
- **Ambiguity Resolution & Clarifications**: AI-powered clarification workflows for strategic inputs.
- **Geographic Disambiguation**: Location-aware journey intake with OpenStreetMap/Nominatim integration.
- **Journey Registry V2**: Centralized journey definitions with automatic summary generation, baseline reuse, intelligent readiness thresholds, and comprehensive test coverage, including an EPM Completion Hook.
- **Golden Records Automation System**: Baseline regression testing for journey executions with versioned snapshots, CLI tools, and auto-capture hooks.

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
- **Knowledge Graph**: Context Foundry