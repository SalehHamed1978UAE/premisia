## Overview

Qgentic Intelligent Strategic EPM is a full-stack web application for enterprise program management, enhanced with AI. It provides tools for managing programs, workstreams, tasks, resources, risks, benefits, KPIs, and financial tracking via an intuitive dashboard. The system features role-based access, supports the full program lifecycle, and includes real-time AI intelligence through a multi-agent architecture and formal ontology for expert guidance and decision-making. The project aims to provide a comprehensive solution for strategic decision-making and EPM integration, offering capabilities like multi-modal input analysis, anti-bias research, and conversion of strategic decisions into actionable EPM program structures.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The frontend uses React with TypeScript and Vite, employing Shadcn/ui (Radix UI, Tailwind CSS) for a consistent "New York" style UI, including theming. It prioritizes a single-page application experience, mobile responsiveness, skeleton loading, and toast notifications.

### Technical Implementations

- **Frontend**: React, TypeScript, Vite, TanStack Query for state management, Wouter for client-side routing.
- **Backend**: Node.js with Express.js (ES modules), Passport.js for authentication (Local Strategy, scrypt hashing), Express sessions, RESTful API with role-based middleware.
- **Data Storage**: PostgreSQL with Neon serverless driver, Drizzle ORM for type-safe schema and Zod validation. `connect-pg-simple` for session storage.
- **Authentication/Authorization**: Session-based authentication using Passport.js, HTTP-only cookies, and a three-tier role system (Admin, Editor, Viewer).

### Feature Specifications

- **AI Multi-Agent System**:
    - **Ontology Foundation**: 9 core entities, 19 relationship mappings, 36 validation rules, 13 domain terms for AI reasoning and data validation.
    - **Executive Agent**: Manages session context, prevents goal drift, logs decisions, and tracks progress.
    - **Builder Specialist Agent**: Generates code, assesses feasibility, tracks requirements.
    - **QA Specialist Agent**: Performs adversarial code reviews, verifies requirements, detects issues, provides PASS/FAIL verdict.
    - **Multi-Agent Orchestrator**: Coordinates Builder-QA workflow, supports multiple AI providers (OpenAI, Anthropic, Gemini) with retry mechanisms and a web UI.
- **Strategic Consultant & EPM Integration**:
    - Converts executive input into AI-analyzed strategic decisions and EPM program structures.
    - Supports multi-modal input (text, PDF, DOCX, Excel, image).
    - **Five Whys Carousel Interface**: Interactive root cause analysis with anti-bias mechanisms (business-focused analysis, evidence-based decision support, cultural keyword blocking).
    - **Anti-Confirmation Bias Research**: Generates both validating and challenging web search queries, prioritizes contradictory findings.
    - **EPM Conversion**: Converts decisions into program structures (workstreams, tasks, KPIs, etc.) with atomic, concurrency-safe database integration.
    - **Version Management**: Unlimited strategy versions with comparison capabilities.
    - **Ontology Validation**: Validates outputs against 35 EPM ontology rules.
    - **Strategic Decisions Module**: Provides persistent access to all strategy versions and integrated programs.
    - **Intelligent Framework Selection**: AI-powered routing between Business Model Canvas and Porter's Five Forces based on input analysis.
    - **Business Model Canvas (BMC) Analysis**: Full 9-block implementation covering all BMC components (Customer Segments, Value Propositions, Revenue Streams, Channels, Customer Relationships, Key Resources, Key Activities, Key Partnerships, Cost Structure) with block-specific query generation, parallel research, and cross-block consistency validation. Includes proactive assumption challenge system with clear UI indicators for validation strength and contradictions.
        - **9-Block Implementation (Oct 2025)**: Extended from 3 to 9 blocks with parallel synthesis, cross-block consistency checks (Cost vs Revenue, Resources vs Activities, Partners vs Activities, Channels vs Segments), and distinct icon/color scheme for each block. Database schema updated with bmcBlockTypeEnum supporting all 9 blocks (enum: key_partnerships).
        - **Multi-Provider AI Fallback (Oct 2025)**: Centralized AIClients with Anthropic → OpenAI → Gemini fallback chain for all strategic consultant modules (FrameworkSelector, AssumptionExtractor, AssumptionValidator, BMCResearcher, MarketResearcher, BMCQueryGenerator). Includes comprehensive provider logging for cost tracking and outage resilience.
        - **Assumption-Query Separation (Oct 2025)**: Fixed assumption validation queries to distribute across ALL blocks instead of forcing to customer_segments. Assumption findings now shared with all 9 blocks to prevent synthesis skew and ensure contradictions surface across the entire business model.
        - **Architectural Fix (Oct 2025)**: Reordered research flow to detect contradictions BEFORE block synthesis, preventing blocks from validating contradicted assumptions. Block synthesis prompts now explicitly acknowledge contradictions.
        - **Investment Amount Transfer (Oct 2025)**: Implemented two-tier matching system for assumption-to-contradiction investment transfer: (1) Primary path uses exact matching on LLM-provided `matchedAssumptionClaim`, (2) Fallback uses entity-based fuzzy matching (dollar amounts, countries, tech terms) with 60/40 weighted scoring and 0.25 threshold. Includes whitespace normalization and comprehensive logging.
        - **Enhanced Assumption Extraction (Oct 2025)**: Extracts up to 10 assumptions per input (explicit + implicit), including quantitative claims, temporal assumptions, market dynamics, and ROI expectations. Prioritizes quality over quantity.
    - **Strategic Understanding Service (Knowledge Graph Architecture - Oct 2025)**:
        - **Hallucination Fix**: Replaced AssumptionExtractor with knowledge graph-based StrategicUnderstandingService using strict 3-tier categorization and source validation to prevent AI from inventing facts.
        - **Database Foundation**: PostgreSQL with pgvector extension, 3 knowledge graph tables (strategic_understanding, strategic_entities, strategic_relationships), 4 enums (entity_type, relationship_type, confidence_level, discovered_by), hybrid search indexes (IVFFlat vector cosine similarity, GIN full-text search, B-tree for filtering).
        - **3-Tier Entity Categorization**:
            - **Explicit (high confidence)**: User directly stated facts with exact quotes (e.g., "expand to India" → "India market expansion is planned")
            - **Implicit (medium confidence)**: Direct logical implications with evidence field explaining reasoning chain
            - **Inferred (low confidence)**: Exploratory/speculative insights marked as low confidence
        - **Source Validation**: Every entity's source field validated as substring in user input (case-insensitive, whitespace-normalized), empty sources rejected, invalid entities filtered out with logging.
        - **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions) with caching for duplicate claims, batch generation support (prevents timeouts), stored as pgvector for semantic search.
        - **Checkpoint 1 Results (Oct 2025)**: Asana test case verified 6 grounded entities (3 explicit, 2 implicit, 1 inferred), 0 hallucinations, 100% source validation pass rate, correct investment amount extraction ($500K), embeddings functional.
        - **BMC Integration Complete (Tasks 16-17, Oct 2025)**: BMCResearcher integrated with knowledge graph, user entities persist with `discovered_by='user_input'`, BMC findings persist with `discovered_by='bmc_agent'`, contradiction relationships created successfully. Critical fixes: batch embedding generation (prevents OpenAI timeout), query persisted entities before relationship creation (prevents null foreign key errors). Verified: contradictions reference specific user values ($500, 2-4 weeks).
        - **Semantic Validation for Contradictions (Oct 2025)**: Prevents false contradictions from semantically different claims (e.g., "PM software" vs "PM discipline"). LLM-based validation checks if user claim and research finding are about the SAME concept before creating "contradicts" relationship. Batch validation with Promise.all, stores metadata (reasoning, provider, model) in relationship.metadata JSON. Soft-fail error handling: skip relationship on validation failure with warning logs. Test coverage: 5/5 cases passed including PM software/discipline, market entry/research, hiring costs/process.
            - **Timeout Prevention (Oct 2025)**: Refactored to separate LLM validation from DB operations. validateAllContradictions() method does all semantic validations upfront (no DB connection), then fast DB writes with pre-validated results. Prevents Neon connection timeout during long LLM operations (reduced DB connection time from 60+ seconds to ~700ms).
        - **Pending**: Semantic/keyword/graph search (Tasks 11-14), framework metadata + temporal queries (Tasks 19-21), Checkpoint 2.

## External Dependencies

- **Database Service**: Neon serverless PostgreSQL (`@neondatabase/serverless`)
- **Session Store**: `connect-pg-simple`
- **UI Libraries**: Radix UI, Tailwind CSS, Lucide React
- **Form Management/Validation**: `react-hook-form`, Zod
- **Date Utilities**: `date-fns`
- **Build Tools**: Vite (frontend), esbuild (server-side)
- **AI Providers**: OpenAI, Anthropic, Gemini
- **ORM**: Drizzle ORM
- **Authentication**: Passport.js with Replit OIDC
    - **Auth Bug Fix (Oct 2025)**: Updated `upsertUser` to handle email unique constraint violations by checking for existing users by email before insert, preventing crashes on duplicate email logins.