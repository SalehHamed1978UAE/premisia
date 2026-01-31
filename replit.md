# Overview
Premisia is an AI-enhanced, full-stack web application for comprehensive enterprise program management. Its core purpose is to transform plain-language business challenges into fully structured EPM programs, leveraging AI-driven strategic analysis frameworks (e.g., PESTLE, Porter's, SWOT, Five Whys, BMC). The project aims to provide a holistic solution for strategic decision-making and EPM integration through real-time AI intelligence, a multi-agent architecture, and a formal ontology. It generates complete EPM programs including tasks, resources, risks, benefits, KPIs, and financials.

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
The frontend uses React, TypeScript, and Vite, with Shadcn/ui (Radix UI and Tailwind CSS) for a themeable "New York" style UI. It features a mobile-first responsive design, including a breakpoint system, adaptive layouts, responsive typography, skeleton loading, and toast notifications. The sidebar uses a compact, three-zone layout.

## Technical Implementations
- **Frontend**: React, TypeScript, Vite, TanStack Query, Wouter.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for session-based authentication, Express sessions, and a RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver and Drizzle ORM for type-safe schema and Zod validation.
- **Authentication/Authorization**: Session-based authentication via Passport.js with Replit OIDC, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer).
- **AI Multi-Agent System**: An ontology-based architecture with Executive, Builder, QA Specialist Agents, and a Multi-Agent Orchestrator.
- **Strategic Consultant & EPM Integration**: Converts executive input into AI-analyzed strategic decisions and EPM program structures, supporting Five Whys AI-coaching, Anti-Confirmation Bias Research, Version Management, and Intelligent Framework Selection.
- **EPM V2 Engine**: Generates EPM programs with industry-appropriate content, proper FTE decimals, validated dependencies, and context-aware risks/benefits.
- **Business Model Canvas (BMC) Analysis**: Full 9-block implementation with query generation, parallel research, and cross-block consistency validation.
- **Strategic Understanding Service**: Uses PostgreSQL with `pgvector` for entity categorization, relationship mapping, semantic search, and contradiction validation.
- **Journey-Based Strategic Analysis**: Guides users through interactive sequences for strategic frameworks with backend-controlled orchestration via an Orchestrator-driven `pageSequence`.
- **Modular Framework Renderer Architecture**: An extensible system for displaying analysis results, supported by a `Module Factory System` with 20 registered modules (e.g., SWOT, BMC, Porter's, PESTLE, Five Whys, Ansoff, Blue Ocean, Segment Discovery, EPM Generator).
- **Universal Background Jobs System**: A hybrid system for tracking long-running operations with database persistence and real-time SSE streaming, used for Document Intelligence Enrichment (extracting knowledge from uploaded documents).
- **Full-Pass Export System**: Generates ZIP bundles containing strategic analysis and EPM program data in multiple formats.
- **Robustness**: Features multi-provider AI fallback, extended socket timeouts, and request throttling.

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
- **Encryption**: AWS KMS
- **Knowledge Graph**: Context Foundry