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

**Phase 2: SessionContext & Executive Agent - COMPLETE (October 4, 2025)**

Built goal drift prevention system with behavioral workflow:
1. ✅ SessionContext database table for persistent session tracking
2. ✅ Storage CRUD methods with validation
3. ✅ API routes with request validation (5 endpoints)
4. ✅ SessionContextPanel UI component with progress tracking
5. ✅ Executive Agent helper module (server/executive-agent.ts)
6. ✅ Integration into main app router
7. ✅ Decision logging and ontology query utilities

**Executive Agent Workflow** (used on all tasks):
```
1. START TASK: Create SessionContext
   - Define clear goal
   - List explicit success criteria
   - Set current phase

2. BEFORE DECISIONS: Query ontology
   - Get validation rules for relevant entities
   - Check completeness requirements
   - Document alternatives considered

3. LOG DECISIONS: Record rationale
   - What was decided
   - Why this approach
   - Ontology rules consulted
   - Confidence level

4. UPDATE PROGRESS: Mark criteria complete
   - Check off completed items
   - Update current phase
   - Track remaining work

5. BEFORE COMPLETION: Validate
   - All success criteria met?
   - Query ontology to validate output quality
   - Flag user if criteria incomplete
   - End session when done
```

**Phase 3: Builder Specialist Agent - COMPLETE (October 4, 2025)**

Built code generation specialist agent for EPM system:
1. ✅ BuilderTask and BuilderResponse interface design
2. ✅ BuilderAgent module with complete processTask workflow
3. ✅ Requirement analysis and feasibility checking
4. ✅ Confidence level calculation (0-100 scale)
5. ✅ Unmet requirement identification and reporting
6. ✅ ExecutiveAgent integration for decision logging
7. ✅ Validation script demonstrating all capabilities

**Builder Agent Capabilities**:
1. **Task Processing**: Accepts BuilderTask with description, requirements[], and optional context (entity, relatedFiles, constraints)
2. **Code Generation**: Returns BuilderResponse with:
   - Approach description explaining implementation strategy
   - Code artifacts array (filePath, content, description)
   - Confidence level (0-100) based on requirement fulfillment
   - Requirements fulfillment tracking (met/unmet with notes)
   - Unmet requirements list
   - Decisions log with rationale
3. **Workflow Integration**: Uses ExecutiveAgent for session management, ontology queries, and decision logging
4. **Confidence Scoring**: Maps fulfillment rates to confidence levels (100%=95, 80%+=75, 60%+=60, 40%+=40, else 25)

**BuilderAgent Workflow** (Phase-based execution):
```
1. PLANNING: Start ExecutiveAgent session with task requirements as success criteria

2. ONTOLOGY QUERY: If entity context provided, query ontology for validation rules

3. ANALYSIS: For each requirement:
   - Analyze feasibility with analyzeRequirement()
   - Track met/unmet status
   - Mark fulfilled criteria via ExecutiveAgent

4. IMPLEMENTATION:
   - Generate approach description with constraints
   - Create code artifacts (main file + types if needed)
   - Log decisions for approach and each artifact

5. VALIDATION: Calculate confidence and validate completion
```

**Phase 4: QA Specialist Agent - COMPLETE (October 5, 2025)**

Built adversarial code reviewer for EPM system:
1. ✅ QAReview and QAIssue interface design
2. ✅ QAAgent module with adversarial review logic
3. ✅ Requirement verification (defaults to REJECT until proven)
4. ✅ Gap/bug/edge-case/security issue detection
5. ✅ ExecutiveAgent integration for decision logging
6. ✅ Validation with FAIL scenario (rejects incomplete work)
7. ✅ Validation with PASS scenario (approves complete work)

**QA Agent Capabilities**:
1. **Adversarial Review**: Accepts BuilderResponse + original requirements, defaults to FAIL stance
2. **Issue Detection**: Returns QAReview with:
   - Verdict (PASS/FAIL) based on strict criteria
   - Requirements verification (independent of builder's claims)
   - Issues categorized by severity (critical/major/minor) and category (gap/bug/edge-case/security/quality)
   - Critical blockers list (must-fix issues)
   - Recommendations for improvement
   - Review summary with detailed rationale
3. **Multi-Layer Verification**:
   - findGaps(): Unmet requirements, placeholder code, missing implementation
   - findBugs(): Weak typing, missing error handling, magic numbers
   - findSecurityIssues(): SQL injection, eval(), hardcoded secrets, missing validation
   - assessQuality(): Low confidence, missing documentation
4. **Confidence Scoring**: High confidence in rejections (95%), medium in approvals (70-85%)

**QAAgent Workflow** (Adversarial execution):
```
1. REQUIREMENTS VERIFICATION: Independently verify each requirement
   - Don't trust builder's self-assessment
   - Require strong evidence in code
   - Default: NOT satisfied until proven

2. GAP ANALYSIS: Find missing implementation
   - Unmet requirements → critical blockers
   - Placeholder/TODO code → major gaps

3. BUG DETECTION: Find potential issues
   - Missing error handling → major bugs
   - Weak typing, magic numbers → minor quality issues

4. SECURITY ANALYSIS: Check for vulnerabilities
   - SQL injection, eval(), hardcoded secrets → critical
   - Missing validation (high security) → major

5. QUALITY ASSESSMENT: Evaluate completeness
   - Low builder confidence → major issue
   - Missing documentation → minor issue

6. VERDICT DECISION: Apply strict criteria
   - FAIL if: ANY requirement unsatisfied OR critical issues OR major issues
   - PASS only if: ALL requirements satisfied AND no critical/major issues
```

**Test Results**:
- FAIL Scenario: 0/5 requirements satisfied → FAIL (95% confidence, 2 critical blockers)
- PASS Scenario: 4/4 requirements satisfied → PASS (80% confidence, 0 blockers)

**Next Phase**: Multi-Agent Orchestration (integrate Builder+QA agents with OpenAI, Anthropic, Gemini for production code generation and review)

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