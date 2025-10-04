# QData Enterprise Program Management (EPM) System

## Overview

This is a comprehensive Program Management System built as a full-stack web application with AI intelligence integration. The system enables organizations to manage programs, workstreams, tasks, resources, risks, benefits, KPIs, and financial tracking through an intuitive dashboard interface. It provides role-based access control (Admin, Editor, Viewer) and supports complete program lifecycle management including stage gate reviews and dependency tracking.

**Strategic Direction**: The system integrates real-time AI intelligence with multi-agent architecture that continuously monitors and provides expert guidance. A formal ontology foundation provides the AI with a complete knowledge base for decision-making.

## User Preferences

Preferred communication style: Simple, everyday language.

## Current Status

**Phase 1: Ontology Foundation - COMPLETE (October 4, 2025)**

All 12 tasks completed:
1. ✅ Entity ontology design (9 core entities with definitions, attributes, rules, lifecycle states)
2. ✅ Relationship graph model (19 mappings with cascade rules)
3. ✅ Validation rules (36 rules with severity levels and auto-fix suggestions)
4. ✅ Completeness criteria and cascade impact model
5. ✅ Domain vocabulary and framework mappings (13 terms, 20 mappings)
6. ✅ Database schema for ontology storage (7 tables with indexes)
7. ✅ Database implementation and seeding (117 records, idempotent upserts)
8. ✅ Ontology query service (11 API endpoints for AI querying)
9. ✅ Validation layer integration (non-blocking validation in CRUD operations)
10. ✅ Practical assessment framework (6 entity assessors with industry benchmarks)

The ontology foundation provides:
- Complete knowledge base for AI reasoning
- Automated data quality validation
- Practicality assessments against industry standards
- Framework for AI-driven recommendations
- Foundation for multi-agent architecture integration

**Next Phase**: AI Intelligence Integration (multi-agent architecture with OpenAI, Anthropic, Gemini)

## System Architecture

### Frontend Architecture

**Technology Stack**: React with TypeScript, using Vite as the build tool and development server.

**UI Framework**: Shadcn/ui component library built on Radix UI primitives with Tailwind CSS for styling. The "New York" style variant is configured with neutral base colors and CSS variables for theming.

**State Management**: TanStack Query (React Query) for server state management with aggressive caching strategies (staleTime: Infinity). Query client is configured to avoid automatic refetching on window focus or interval-based polling.

**Routing**: Wouter for lightweight client-side routing with protected route middleware that redirects unauthenticated users to the auth page.

**Component Structure**:
- **Layout Components**: Sidebar navigation and TopBar for consistent UI structure
- **Feature Components**: Modular views for Dashboard, Timeline, Stage Gates, KPIs, Risks, Benefits, Funding, and Resources
- **Shared UI Components**: Extensive library of reusable components from Shadcn/ui

**Design Decisions**:
- Single-page application architecture with view switching rather than page navigation
- Mobile-responsive design with breakpoint-aware components
- Loading states with skeleton components for better UX
- Toast notifications for user feedback

### Backend Architecture

**Runtime**: Node.js with Express.js framework using ES modules (type: "module")

**Authentication Strategy**: Passport.js with Local Strategy for username/password authentication. Passwords are hashed using scrypt with salt for security. Express sessions are used for maintaining user state.

**API Design**: RESTful API structure with role-based middleware:
- `requireAuth` middleware validates authentication
- `requireRole` middleware enforces role-based permissions (Admin, Editor, Viewer)
- API routes follow pattern: `/api/{resource}` with standard HTTP methods

**Request Handling**:
- JSON body parsing with raw body buffer preservation for webhook support
- URL-encoded form data support
- Request logging middleware for API endpoints with response truncation

**Error Handling**: Centralized error responses with appropriate HTTP status codes (401 for unauthorized, 403 for forbidden, 404 for not found, 500 for server errors)

### Data Storage Solutions

**Database**: PostgreSQL via Neon serverless driver with WebSocket support for connection pooling.

**ORM**: Drizzle ORM with type-safe schema definitions and Zod integration for validation.

**Schema Design**:
- **Core Entities**: Users, Programs, Workstreams, Resources
- **Tracking Entities**: Tasks with dependencies, KPIs with measurements, Risks with mitigations, Benefits
- **Financial Entities**: Funding sources, Expenses
- **Governance**: Stage gates with reviews
- **Enums**: Predefined types for roles, task status, risk levels, gate status, benefit status

**Session Storage**: PostgreSQL-backed sessions using connect-pg-simple for distributed session management.

**Data Relationships**:
- Programs have many Workstreams, Tasks, Resources
- Tasks support dependency relationships (predecessor/successor)
- Risks have mitigation actions
- KPIs track measurements over time
- Foreign key constraints maintain referential integrity

### Authentication and Authorization

**Authentication Mechanism**: Session-based authentication using Passport.js Local Strategy with scrypt password hashing.

**Session Management**:
- Express sessions stored in PostgreSQL
- Session secret from environment variable
- Trust proxy enabled for deployment behind load balancers
- Session persistence across server restarts

**Authorization Model**:
- Three-tier role system: Admin, Editor, Viewer
- Role enforcement at API route level
- User object serialization/deserialization in session

**Security Considerations**:
- Timing-safe password comparison to prevent timing attacks
- Salt-based password hashing with scrypt
- HTTP-only session cookies
- CSRF protection through same-site cookie policies

### External Dependencies

**Database Service**: 
- Neon serverless PostgreSQL (via @neondatabase/serverless)
- Requires DATABASE_URL environment variable
- WebSocket support for real-time connections

**Development Tools**:
- Replit-specific plugins for development (cartographer, dev-banner, runtime-error-modal)
- Conditional loading only in development environment

**Session Store**: connect-pg-simple for PostgreSQL-backed session storage

**Build Tools**:
- Vite for frontend bundling and development server
- esbuild for server-side bundling in production
- TypeScript compiler for type checking

**Environment Variables Required**:
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption
- `NODE_ENV`: Environment identifier (development/production)
- `REPL_ID`: Optional Replit identifier for development features

**Third-party UI Libraries**:
- Radix UI primitives for accessible components
- Tailwind CSS for utility-first styling
- Lucide React for icons
- date-fns for date manipulation
- react-hook-form with Zod resolvers for form validation