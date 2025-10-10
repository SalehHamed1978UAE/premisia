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
    - **Business Model Canvas (BMC) Analysis**: Focuses on Customer Segments, Value Propositions, Revenue Streams with block-specific query generation, parallel research, and validation. Includes a proactive assumption challenge system for extracting, validating, and detecting contradictions in user assumptions, with clear UI indicators for validation strength and contradictions.

## External Dependencies

- **Database Service**: Neon serverless PostgreSQL (`@neondatabase/serverless`)
- **Session Store**: `connect-pg-simple`
- **UI Libraries**: Radix UI, Tailwind CSS, Lucide React
- **Form Management/Validation**: `react-hook-form`, Zod
- **Date Utilities**: `date-fns`
- **Build Tools**: Vite (frontend), esbuild (server-side)
- **AI Providers**: OpenAI, Anthropic, Gemini
- **ORM**: Drizzle ORM
- **Authentication**: Passport.js