# QData Enterprise Program Management (EPM) System

## Overview

QData EPM is a comprehensive full-stack web application designed for enterprise program management, integrating AI intelligence. It enables organizations to manage programs, workstreams, tasks, resources, risks, benefits, KPIs, and financial tracking through an intuitive dashboard. The system provides role-based access control and supports the complete program lifecycle, including stage gate reviews and dependency tracking. A core feature is its real-time AI intelligence, powered by a multi-agent architecture and a formal ontology foundation, which continuously monitors and provides expert guidance for decision-making.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React and TypeScript, using Vite for development and bundling. It leverages Shadcn/ui (based on Radix UI and Tailwind CSS) for a consistent "New York" style UI with theming. State management is handled by TanStack Query for efficient server state caching. Wouter provides lightweight client-side routing with protected routes. The design emphasizes a single-page application experience, mobile responsiveness, skeleton loading states, and toast notifications for user feedback.

### Backend Architecture

The backend runs on Node.js with Express.js (ES modules). Authentication uses Passport.js with Local Strategy and scrypt for password hashing, with Express sessions for state management. The API is RESTful, featuring role-based middleware (`requireAuth`, `requireRole`) for Admin, Editor, and Viewer permissions. It includes JSON and URL-encoded body parsing, request logging, and centralized error handling with appropriate HTTP status codes.

### Data Storage Solutions

PostgreSQL is used as the primary database, accessed via the Neon serverless driver. Drizzle ORM provides type-safe schema definitions and Zod integration for validation. The schema includes core entities like Users, Programs, Workstreams, and Resources, alongside tracking entities for Tasks, KPIs, Risks, Benefits, and financial entities. PostgreSQL also stores session data using `connect-pg-simple`. Data relationships are maintained through foreign key constraints, supporting complex dependencies (e.g., task dependencies, KPI measurements).

### Authentication and Authorization

Authentication is session-based using Passport.js Local Strategy with scrypt-hashed passwords. Sessions are managed by Express and stored in PostgreSQL, secured with HTTP-only cookies and an environment-variable-derived secret. Authorization employs a three-tier role system (Admin, Editor, Viewer), enforced at the API route level. Security measures include timing-safe password comparisons, salt-based hashing, and CSRF protection.

### AI Multi-Agent System

The system incorporates a multi-agent AI architecture:
- **Ontology Foundation**: A formal ontology with 9 core entities, 19 relationship mappings, 36 validation rules, and 13 domain terms provides a comprehensive knowledge base for AI reasoning, data quality validation, and practicality assessments.
- **Executive Agent**: Manages session context, prevents goal drift, logs decisions, and tracks progress. It queries the ontology before decisions and validates outcomes against success criteria.
- **Builder Specialist Agent**: Generates code based on task requirements, assessing feasibility, calculating confidence levels, and tracking requirement fulfillment. It integrates with the Executive Agent for session management and decision logging.
- **QA Specialist Agent**: Performs adversarial code reviews, verifying requirements, detecting gaps, bugs, edge cases, and security issues. It provides a PASS/FAIL verdict with detailed rationale and recommendations, integrating with the Executive Agent.
- **Multi-Agent Orchestrator**: Coordinates the Builder-QA workflow, supporting multiple AI providers (OpenAI gpt-5, Anthropic claude-sonnet-4, Gemini gemini-2.5-pro) with lazy initialization and provider selection logic. It implements retry mechanisms with QA feedback and integrates fully with the Executive Agent. Features a complete web UI for task submission and result viewing with editable forms, real-time status updates, and comprehensive test coverage.

### Strategic Consultant & EPM Integration

The Strategic Consultant is a velocity tool that converts executive input into AI-analyzed strategic decisions and complete EPM program structures:
- **Multi-Modal Input**: Supports text, PDF, DOCX, Excel, and image uploads (50MB limit)
- **AI Analysis**: Claude Sonnet 4 analyzes input and generates strategic decisions with rationale
- **EPM Conversion**: Converts decisions into complete program structures (workstreams, tasks, stage gates, KPIs, benefits, risks, funding sources, resources)
- **Database Integration**: Atomic, concurrency-safe integration into main EPM Suite database with idempotency guarantees
  - Uses `tryStartIntegration()` method with SQL WHERE clause for atomic check-and-set operation
  - Sets `convertedProgramId` immediately after program creation to prevent duplicate programs on retry
  - Prevents concurrent integrations through database-level locking
  - Integrated programs are accessible from Dashboard and all EPM module pages
- **Version Management**: Unlimited strategy versions with full comparison capabilities
- **Ontology Validation**: Validates all outputs against 35 EPM ontology rules for data quality

## External Dependencies

- **Database Service**: Neon serverless PostgreSQL (`@neondatabase/serverless`)
- **Session Store**: `connect-pg-simple` (for PostgreSQL-backed sessions)
- **UI Libraries**: Radix UI, Tailwind CSS, Lucide React
- **Form Management/Validation**: `react-hook-form`, Zod
- **Date Utilities**: `date-fns`
- **Build Tools**: Vite (frontend), esbuild (server-side)
- **AI Providers**: OpenAI, Anthropic, Gemini (API integrations for multi-agent system)
- **Runtime**: Node.js, Express.js
- **ORM**: Drizzle ORM
- **Authentication**: Passport.js