# Overview
QGentic Intelligent Strategic EPM is an AI-enhanced, full-stack web application for comprehensive enterprise program management. It supports the entire program lifecycle, from managing programs, workstreams, and tasks to tracking resources, risks, benefits, KPIs, and financials through an intuitive dashboard. The project aims to provide a holistic solution for strategic decision-making and EPM integration, featuring real-time AI intelligence, a multi-agent architecture, and a formal ontology for expert guidance. Key capabilities include multi-modal input analysis, anti-bias research, document intelligence enrichment, and the conversion of strategic decisions into actionable EPM program structures.

# User Preferences
Preferred communication style: Simple, everyday language.

**Development Philosophy:**
- No band-aid fixes or workarounds (e.g., making fields nullable to bypass foreign key constraints)
- Always fix root architectural issues properly the first time
- Take time to understand the proper data flow before implementing fixes
- Clean separation of concerns - don't mix old and new system architectures

# System Architecture

## UI/UX Decisions
The frontend utilizes React, TypeScript, and Vite, enhanced with Shadcn/ui (Radix UI and Tailwind CSS) to deliver a themeable "New York" style UI. It offers a single-page application experience, ensuring mobile responsiveness, skeleton loading, and toast notifications. A mobile-first responsive design strategy is implemented with a breakpoint system, adaptive layout patterns (headers, grids, buttons), responsive typography, and careful spacing adjustments.

## Technical Implementations
- **Frontend**: React, TypeScript, Vite, TanStack Query, Wouter.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication, Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver and Drizzle ORM for type-safe schema and Zod validation. `DBConnectionManager` handles database connections with pooling and retry mechanisms.
- **Authentication/Authorization**: Session-based authentication via Passport.js with Replit OIDC, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer).

## Background Jobs Architecture
The application employs a hybrid background job system with database persistence and real-time progress tracking. A `Background Job Service` dispatches jobs every 15 seconds to appropriate workers (e.g., `document-enrichment-worker`, `strategic-understanding-worker`). A `Modular Framework Executor Registry` provides a plugin system for strategic analysis frameworks (e.g., Five Whys, BMC), allowing for easy integration of new frameworks without modifying the orchestrator. Journeys are pre-defined sequences of these frameworks.

## Feature Specifications
- **AI Multi-Agent System**: Ontology-based architecture with Executive, Builder, QA Specialist Agents, and a Multi-Agent Orchestrator supporting multiple AI providers.
- **Strategic Consultant & EPM Integration**: Transforms executive input into AI-analyzed strategic decisions and EPM program structures, including Five Whys (AI-coached), Anti-Confirmation Bias Research, Version Management, and Intelligent Framework Selection.
- **Five Whys AI Coaching System**: Validates Five Whys analysis for causality, relevance, specificity, evidence, and logical consistency.
- **Business Model Canvas (BMC) Analysis**: Full 9-block implementation with query generation, parallel research, cross-block consistency validation, and real-time progress streaming.
- **Strategic Understanding Service (Knowledge Graph Architecture)**: Uses PostgreSQL with `pgvector` for entity categorization, relationship mapping, semantic search, and contradiction validation.
- **Robustness and Performance**: Multi-provider AI fallback, extended socket timeouts, and request throttling with exponential backoff.
- **Trend Analysis Agent**: Provides production-ready PESTLE analysis with an evidence-first architecture.
- **Journey-Based Strategic Analysis**: Guides users through interactive sequences for strategic frameworks.
- **Modular Framework Renderer Architecture**: Extensible system for displaying analysis results.
- **Strategy Intelligence Layer**: Core AI engine for converting strategic frameworks into executable EPM programs.
- **Strategy Workspace**: Bridges AI analysis and EPM programs through a 4-page wizard and EPM Program View.
- **EPM Display Formatters**: Enterprise-grade visual components for EPM data across 7 tabs, with 14 specialized formatters.
- **Dynamic Home Page**: Adaptive, personalized landing page.
- **Batch Operations & Archive**: Supports batch actions for Analysis Repository and EPM Programs pages.
- **Intelligent Planning System**: AI-powered project planning library for schedule optimization, resource allocation, and validation, including an LLM Task Extractor, CPM Scheduler, Resource Manager, AI Optimizer, and LLM Validator.
- **Journey Builder System**: Allows users to choose from 6 pre-defined journeys or create custom ones with AI validation.
- **Universal Background Jobs System**: Hybrid system for tracking long-running operations with database persistence and real-time SSE streaming.
- **Non-Blocking Progress UX**: Replaces blocking modals with navigable experiences using a fixed-position progress card (`MinimizedJobTracker`) and polling.
- **Enterprise Data Encryption**: AES-256-GCM encryption for sensitive business data at rest.
- **Full-Pass Export System**: Comprehensive export generating ZIP bundles with strategic analysis and EPM program data in multiple formats (Markdown, PDF, DOCX, HTML).
- **Document Intelligence Enrichment**: Background job pipeline for asynchronously extracting knowledge from uploaded documents (PDF, DOCX, Excel, images), populating the encrypted knowledge graph with provenance. Features a notification system.
- **Strategies Hub**: Unified view for all strategic initiatives, providing artifact hierarchy and research provenance, with list and detailed views. Supports context inheritance. Enhanced with:
  - **Version Metadata Enrichment**: Strategy versions track versionLabel, confidence scores (0-1), ROI estimates, and lineage via derivedFromVersionId
  - **EPM Program Visibility**: Programs display version number, created date, journey deep links, and metadata badges (confidence%, ROI%)
  - **Research Tab Tags**: Framework and journey tags extracted from references with version badges (e.g., "BMI v2")
  - **Delete/Archive Operations**: Individual strategy deletion with cascade preview showing affected journeys, versions, programs, assignments, and references, with user-scoped security
  - **Version-Specific EPM Filtering**: Prioritization page checks strategyVersionId to prevent cross-version leakage
- **Journey Launcher Modal**: Intelligent modal for initiating additional strategic analysis, with two modes (Full Journey, Single Framework). Includes journey-aware readiness checks and uses a `Strategic Summary Builder` for context, implementing a single-snapshot architecture to prevent token limit overruns.
- **Ambiguity Resolution & Clarifications**: AI-powered clarification workflows for strategic inputs, prompting users to resolve unclear inputs, which are then merged and persisted for follow-on analysis.

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