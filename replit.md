# Overview
QGentic Intelligent Strategic EPM is an AI-enhanced, full-stack web application designed for comprehensive enterprise program management. It supports the entire program lifecycle, from managing programs, workstreams, and tasks to tracking resources, risks, benefits, KPIs, and financials through an intuitive dashboard. The project aims to provide a holistic solution for strategic decision-making and EPM integration, featuring real-time AI intelligence, a multi-agent architecture, and a formal ontology for expert guidance. Key capabilities include multi-modal input analysis, anti-bias research, document intelligence enrichment, and the conversion of strategic decisions into actionable EPM program structures.

# User Preferences
Preferred communication style: Simple, everyday language.

**Development Philosophy:**
- No band-aid fixes or workarounds (e.g., making fields nullable to bypass foreign key constraints)
- Always fix root architectural issues properly the first time
- Take time to understand the proper data flow before implementing fixes
- Clean separation of concerns - don't mix old and new system architectures

# System Architecture

## UI/UX Decisions
The frontend utilizes React, TypeScript, and Vite, enhanced with Shadcn/ui (Radix UI and Tailwind CSS) to deliver a themeable "New York" style UI. It offers a single-page application experience, ensuring mobile responsiveness, skeleton loading, and toast notifications.

**Mobile-First Responsive Design Strategy:**
- **Breakpoint System**: Mobile (default, <640px), Tablet (sm: 640-1023px), Desktop (lg: 1024px+)
- **Layout Patterns**: 
  - Headers: Stack vertically on mobile (`flex-col`), horizontal on desktop (`lg:flex-row`)
  - Grids: Single column mobile (`grid-cols-1`), progressive enhancement to multi-column (`sm:grid-cols-2 lg:grid-cols-4`)
  - Buttons: Full-width on mobile (`w-full`), auto-width on desktop (`lg:w-auto`)
- **Typography**: Responsive scaling (e.g., `text-xl sm:text-2xl lg:text-3xl`)
- **Text Handling**: `break-words` for wrapping, `min-w-0` for flex shrinking
- **Spacing**: Reduced gaps/padding on mobile, increased on larger screens
- **Key Pages**: StrategiesListPage, StrategyDetailPage, and JourneyLauncherModal follow these principles to prevent horizontal overflow and ensure accessibility on all device sizes.

## Technical Implementations
- **Frontend**: React, TypeScript, Vite, TanStack Query, Wouter.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication, Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver and Drizzle ORM for type-safe schema and Zod validation.
- **Database Connection Management**: `DBConnectionManager` handles Neon serverless connections with connection pooling and retry mechanisms.
- **Authentication/Authorization**: Session-based authentication via Passport.js with Replit OIDC, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer).

## Feature Specifications
- **AI Multi-Agent System**: Ontology-based architecture comprising an Executive Agent, Builder Specialist Agent, QA Specialist Agent, and a Multi-Agent Orchestrator, supporting multiple AI providers.
- **Strategic Consultant & EPM Integration**: Transforms executive input into AI-analyzed strategic decisions and EPM program structures, incorporating Five Whys (with AI validation and coaching), Anti-Confirmation Bias Research, EPM Conversion, Version Management, Strategic Decisions, and Intelligent Framework Selection.
- **Five Whys AI Coaching System**: Validates Five Whys analysis using AI, evaluating causality, relevance, specificity, evidence, duplication, contradiction, and circular logic. Provides interactive coaching, suggestions, and conditional overrides.
- **Business Model Canvas (BMC) Analysis**: Full 9-block implementation with query generation, parallel research, cross-block consistency validation, and real-time progress streaming via Server-Sent Events (SSE).
- **Strategic Understanding Service (Knowledge Graph Architecture)**: Utilizes a knowledge graph with PostgreSQL and `pgvector` for entity categorization, relationship mapping, semantic search, and contradiction validation.
- **Robustness and Performance**: Features multi-provider AI fallback, extended socket timeouts, and request throttling with exponential backoff.
- **Trend Analysis Agent**: Provides production-ready PESTLE analysis with an evidence-first architecture.
- **Journey-Based Strategic Analysis**: Guides users through interactive page sequences for strategic frameworks.
- **Modular Framework Renderer Architecture**: An extensible system for displaying strategic analysis results across various frameworks.
- **Strategy Intelligence Layer**: Core AI engine for converting strategic frameworks into executable EPM programs.
- **Strategy Workspace**: Bridges AI analysis and EPM programs through a 4-page wizard, decision validation, and an EPM Program View.
- **EPM Display Formatters**: Enterprise-grade visual components for EPM data across 7 tabs, with 14 specialized formatters.
- **Dynamic Home Page**: Adaptive landing page providing personalized experiences.
- **Batch Operations & Archive**: Supports batch actions (delete, archive, export) for Analysis Repository and EPM Programs pages.
- **Intelligent Planning System**: AI-powered project planning library for schedule optimization, resource allocation, and validation, including an LLM Task Extractor, CPM Scheduler, Resource Manager, AI Optimizer, and LLM Validator.
- **Journey Builder System**: Allows users to choose from 6 pre-defined strategic journeys or create custom ones with AI-powered validation for EPM generation.
- **Universal Background Jobs System**: A hybrid system for tracking long-running operations (e.g., EPM generation) with database persistence and real-time SSE streaming.
- **Non-Blocking Progress UX**: Replaces blocking modals with navigable experiences, using a fixed-position progress card, `MinimizedJobTracker`, and polling-based notifications.
- **Enterprise Data Encryption**: AES-256-GCM encryption for sensitive business data at rest, applied to Strategic Understanding, Journey Sessions, and Strategic Entities/Knowledge Graph tables.
- **Full-Pass Export System**: Comprehensive enterprise-grade export generating ZIP bundles with strategic analysis and EPM program data in multiple formats (Markdown, PDF, DOCX, HTML) including rich framework analysis and detailed EPM components.
- **Document Intelligence Enrichment**: Background job pipeline for asynchronously extracting knowledge from uploaded documents (PDF, DOCX, Excel, images), populating the encrypted knowledge graph with provenance metadata. Features a notification system with a Floating Action Button (FAB) and slide-over panel for insights.
- **Strategies Hub**: Unified view for all strategic initiatives, providing complete artifact hierarchy and research provenance tracking. Includes a list view with aggregated metrics and a detailed view with journey timelines, a research library, and linked EPM programs. Supports context inheritance for new journey creation.
- **Journey Launcher Modal**: Intelligent modal system for initiating additional strategic analysis on existing strategies. Features two modes: Full Journey (6 pre-planned journeys) and Single Framework (surgical analysis). Includes context readiness check (minimum 3 references, 5 entities) with conditional UI showing "Run Now" for interactive execution or "Start in Background" when sufficient context exists. Integrates with Universal Background Jobs for non-blocking execution.

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