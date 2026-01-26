# Overview
Premisia is an AI-enhanced, full-stack web application for comprehensive enterprise program management. It supports the entire program lifecycle, from program and task management to tracking resources, risks, benefits, KPIs, and financials via an intuitive dashboard. The project aims to provide a holistic solution for strategic decision-making and EPM integration, featuring real-time AI intelligence, a multi-agent architecture, and a formal ontology for expert guidance. Key capabilities include multi-modal input analysis, anti-bias research, document intelligence enrichment, and the conversion of strategic decisions into actionable EPM program structures, improving strategic decision-making and EPM integration.

# User Preferences
Preferred communication style: Simple, everyday language.

**Development Philosophy:**
- No band-aid fixes or workarounds (e.g., making fields nullable to bypass foreign key constraints)
- Always fix root architectural issues properly the first time
- Take time to understand the proper data flow before implementing fixes
- Clean separation of concerns - don't mix old and new system architectures

**UI Styling Standards:**
- All popups, dropdowns, and overlays MUST have solid opaque backgrounds - never transparent
- Use CSS variables from index.css (e.g., `bg-popover`, `text-popover-foreground`) - never inline hardcoded colors
- Dark mode popover color is `--popover: 222 47% 8%` (solid dark) - defined in `.dark` class in index.css
- When fixing a styling issue, fix it at the root (CSS variables or component defaults) not per-page
- Shadcn component defaults are the source of truth - don't override in individual pages unless necessary

# System Architecture

## UI/UX Decisions
The frontend uses React, TypeScript, and Vite, with Shadcn/ui (Radix UI and Tailwind CSS) for a themeable "New York" style UI. It features a single-page application with mobile-first responsive design, including a breakpoint system, adaptive layouts, responsive typography, skeleton loading, and toast notifications. The sidebar uses a compact, three-zone layout optimized for visibility on all devices.

## Technical Implementations
- **Frontend**: React, TypeScript, Vite, TanStack Query, Wouter.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication, Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver and Drizzle ORM for type-safe schema and Zod validation. `DBConnectionManager` handles database connections.
- **Authentication/Authorization**: Session-based authentication via Passport.js with Replit OIDC, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer). Includes a two-phase auth initialization for robust deployment health checks and lazy route loading to prevent module-load crashes when production secrets are missing. Health probes are handled by a root endpoint providing unconditional instant JSON responses, and a readiness gate middleware ensures proper server initialization. Process keep-alive strategies prevent premature process exit during autoscale deployments.
- **Background Jobs**: A hybrid system with database persistence and real-time tracking, dispatching jobs every 15 seconds. A `Modular Framework Executor Registry` supports a plugin system for strategic analysis frameworks.
- **Enterprise Data Encryption**: AWS KMS envelope encryption with AES-256-GCM for sensitive business data at rest across critical tables.
- **Journey Navigation Architecture**: Uses orchestrator-driven entry points with `pageSequence` for navigation.
- **BMI Workflow Resilience**: BMC SSE stream handler uses resilient version creation with 'system' user fallback when auth context is missing, ensuring AI-generated strategic decisions are always persisted.
- **BMC Knowledge Security Tests**: Comprehensive automated test suite validates cross-user data isolation, authorization, and decryption for the `/bmc-knowledge/:programId` endpoint.
- **Context Foundry Integration**: Grounded analysis capability that queries verified organizational facts from Context Foundry before AI analysis, constraining LLM responses to use verified data with proper source citations. Integrated into StrategyAnalyzer for Five Whys and Porter's analysis. Future integration points include BMC 9-Block Analysis and Segment Discovery Synthesis Phase to query Context Foundry for entity verification and grounding.
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
- **Journey Builder System**: Allows users to choose from 7 pre-defined journeys or create custom ones with AI validation. Custom journeys execute actual framework analyzers via JourneyOrchestrator with consistent session ID handling - all strategy_versions records use `understandingId` (not executionId) to ensure DecisionPage queries work correctly.
- **Universal Background Jobs System**: Hybrid system for tracking long-running operations with database persistence and real-time SSE streaming.
- **Non-Blocking Progress UX**: Uses a fixed-position progress card (`MinimizedJobTracker`) and polling.
- **Full-Pass Export System**: Generates ZIP bundles with strategic analysis and EPM program data in multiple formats.
- **Document Intelligence Enrichment**: Background job pipeline for asynchronously extracting knowledge from uploaded documents (PDF, DOCX, Excel, images), populating the encrypted knowledge graph.
- **Strategies Hub**: Unified view for all strategic initiatives, providing artifact hierarchy and research provenance.
- **Journey Launcher Modal**: Intelligent modal for initiating additional strategic analysis, with two modes (Full Journey, Single Framework) and journey-aware readiness checks.
- **Ambiguity Resolution & Clarifications**: AI-powered clarification workflows for strategic inputs.
- **Geographic Disambiguation**: Location-aware journey intake with OpenStreetMap/Nominatim integration.
- **Journey Registry V2**: Centralized journey definitions with automatic summary generation, baseline reuse, intelligent readiness thresholds, and comprehensive test coverage.
- **Module Catalog & Journey Config System**: Treats analyzers/generators as modules and expresses journeys via YAML configuration for eventual GUI composition. Key components include a module manifest, journey configuration schema, and a registry.
- **Module Factory System**: Unified module architecture with 20 registered modules (SWOT, BMC, Porter's, PESTLE, Five Whys, Ansoff, Blue Ocean, Ocean Strategy, BCG Matrix, Value Chain, VRIO, Scenario Planning, Jobs-to-be-Done, Competitive Positioning, Segment Discovery, Strategic Understanding, Strategic Decisions, OKR Generator, EPM Generator, Input Processor). Features include:
  - Type Registry (`shared/module-types.ts`): Zod schemas for all input/output types ensuring type-safe data flow
  - BaseModule class (`server/modules/base-module.ts`): Abstract class with validation and error handling
  - Module validation (`server/modules/validate-modules.ts`): Startup validation ensuring all modules properly configured
  - ModuleType classification: `ai_analyzer`, `user_input`, `generator`, `internal` for execution routing
  - ID mapping: Consistent translation between manifest IDs (hyphen-case) and registry keys (snake_case)
- **Journey Library Expansion**: Framework registry expanded to include 16 executors, including Marketing Consultant.
- **Golden Records Automation System**: Baseline regression testing for journey executions with versioned snapshots.
- **BMC SSE Regression Test Suite**: Comprehensive test coverage for Business Model Canvas SSE streaming contract.

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