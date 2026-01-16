# Premisia User Guide

## What is Premisia?

Premisia is an AI-enhanced enterprise program management platform that transforms strategic vision into executable programs. It bridges the gap between "I have this idea" and "here's exactly how we execute it."

**Tagline:** Think it through.

---

## Who Is Premisia For?

| User Type | Use Case |
|-----------|----------|
| **C-Suite Executives** | Turn strategic vision into actionable programs |
| **Strategy Teams** | Accelerate analysis with AI-powered frameworks |
| **Product/Marketing Leaders** | Identify and validate target market segments |
| **Consultants** | Deliver rigorous, data-grounded recommendations |
| **Program Managers** | Bridge strategy and execution with structured programs |

---

## The Three Stages of Premisia

Premisia works in three connected stages:

```
Stage 1: Marketing Consultant     Stage 2: Strategic Consultant     Stage 3: Strategy Workspace
     (WHO to target)         →         (HOW to compete)         →      (Execute the plan)
```

---

# Stage 1: Marketing Consultant

## Purpose
Systematically identify your ideal target customer segment using a "gene library" approach.

## User Flow

### 1.1 Input Page
**URL:** `/marketing-consultant`

**What you see:**
- Text input field for describing your product/service
- Optional document upload (PDF, DOCX, Excel, images)
- "Analyze" button to start

**What to do:**
Describe your product or service. Be specific about what you offer and what problem it solves.

**Example input:**
> "We're building an AI-powered project management tool for software development teams. It automatically generates sprint plans, identifies blockers, and suggests task assignments based on team capacity and skills."

**Screenshot location:** Input page with example text entered

---

### 1.2 Classification Page
**URL:** `/marketing-consultant/classification/:id`

**What you see:**
- AI-generated classification of your business context
- Industry category
- Business model type
- Key value propositions identified

**What to do:**
Review the classification and confirm it's accurate, or provide corrections.

**Screenshot location:** Classification results showing business context

---

### 1.3 Journey Selection Page
**URL:** `/marketing-consultant/journey-selection/:id`

**What you see:**
- Available marketing journeys to choose from
- "Segment Discovery" option highlighted

**What to do:**
Select "Segment Discovery" to start identifying your target customer segments.

**Screenshot location:** Journey selection with Segment Discovery option

---

### 1.4 Segment Discovery Results
**URL:** `/marketing-consultant/segment-discovery/:id`

**What you see:**
- **8 Dimension Cards:** Industry, Company Size, Geography, Technology Adoption, Pain Points, Buying Behavior, Competition Exposure, Growth Potential
- **Genome List:** 80-100+ customer segment candidates with fit scores
- **Beachhead Recommendation:** AI-synthesized recommendation for which segment to target first
- **Validation Plan:** Experiments to validate your beachhead choice

**What to do:**
1. Explore the 8 dimensions to understand the analysis
2. Review the genome list sorted by fit score
3. Read the beachhead recommendation
4. Click "Continue to Strategic Analysis" to hand off insights to Strategic Consultant

**Screenshot locations:**
- 8 dimension cards overview
- Genome list with scores
- Beachhead recommendation section
- "Continue to Strategic Analysis" button

---

### 1.5 My Discoveries
**URL:** `/marketing-consultant/discoveries`

**What you see:**
- List of all your past segment discoveries
- Date, status, and summary for each
- Quick access to view results or continue analysis

**Screenshot location:** Discoveries list page

---

# Stage 2: Strategic Consultant

## Purpose
Deep strategic analysis using proven frameworks like Five Whys, Porter's Five Forces, and Business Model Canvas.

## User Flow

### 2.1 Input Page
**URL:** `/strategic-consultant`

**What you see:**
- Text input field for strategic challenge
- If coming from Marketing Consultant: Pre-filled with segment discovery insights and "From Segment Discovery" badge
- Document upload option
- "Analyze" button

**What to do:**
Enter your strategic challenge or review the pre-filled segment discovery context.

**Screenshot locations:**
- Empty input page
- Input page with segment discovery context pre-filled (showing badge)

---

### 2.2 Journey Hub
**URL:** `/journeys`

**What you see:**
- Available strategic journeys:
  - **Five Whys:** Root cause analysis
  - **Porter's Five Forces:** Competitive analysis
  - **Business Model Canvas:** 9-block business model
  - **PESTLE:** Macro-environmental scanning
  - **Custom Journey:** Build your own sequence

**What to do:**
Select the journey that matches your analysis needs.

**Screenshot location:** Journey Hub showing all available journeys

---

### 2.3 Five Whys Tree
**URL:** `/strategic-consultant/whys-tree/:id`

**What you see:**
- Interactive tree visualization
- Root problem at top
- Branching "Why?" questions
- AI-generated causal chains
- Highlighted root causes at the bottom

**What to do:**
1. Review the AI-generated causal analysis
2. Click nodes to expand/collapse
3. Add your own insights
4. Identify the root causes to address

**Screenshot locations:**
- Full Five Whys tree view
- Expanded node showing causal chain

---

### 2.4 Analysis Page
**URL:** `/strategic-consultant/analysis/:id`

**What you see:**
- Framework-specific analysis results
- Structured findings
- Evidence and citations
- Confidence scores

**Screenshot location:** Analysis results for selected framework

---

### 2.5 Research Page (Anti-Confirmation Bias)
**URL:** `/strategic-consultant/research/:id`

**What you see:**
- **Contradiction Detection:** Conflicts between assumptions and findings
- **Counter-Evidence:** Alternative perspectives that challenge conclusions
- **Assumption Flags:** Unvalidated assumptions highlighted
- **Confidence Indicators:** Reliability scores for each insight

**What to do:**
Review the challenges to your assumptions. This is where Premisia stress-tests your thinking.

**Screenshot locations:**
- Contradiction detection panel
- Counter-evidence section
- Assumption flags

---

### 2.6 BMC Results Page
**URL:** `/bmc/results/:sessionId/:versionNumber`

**What you see:**
- Full 9-block Business Model Canvas:
  1. Customer Segments
  2. Value Propositions
  3. Channels
  4. Customer Relationships
  5. Revenue Streams
  6. Key Resources
  7. Key Activities
  8. Key Partnerships
  9. Cost Structure
- Cross-block consistency validation
- Research evidence for each block

**Screenshot location:** Full BMC canvas with all 9 blocks

---

### 2.7 Decisions Page
**URL:** `/strategic-consultant/decisions/:id/:version`

**What you see:**
- Extracted strategic decisions from analysis
- Priority rankings
- Resource requirements
- Timeline estimates

**Screenshot location:** Decisions extraction page

---

### 2.8 Versions Page
**URL:** `/strategic-consultant/versions/:id`

**What you see:**
- Version history of strategic analysis
- Compare different versions
- Track how strategy evolved

**Screenshot location:** Version history view

---

# Stage 3: Strategy Workspace & EPM

## Purpose
Convert strategic decisions into executable programs with tasks, resources, timelines, and accountability.

## User Flow

### 3.1 Decision Summary Page
**URL:** `/strategy-workspace/decisions/:sessionId/:version`

**What you see:**
- Summary of all strategic decisions
- Grouped by theme or priority
- Ready for conversion to programs

**Screenshot location:** Decision summary view

---

### 3.2 Prioritization Page
**URL:** `/strategy-workspace/prioritization/:sessionId/:version`

**What you see:**
- Prioritization matrix
- Impact vs. Effort visualization
- Drag-and-drop ranking
- Resource allocation preview

**Screenshot location:** Prioritization matrix

---

### 3.3 Programs List
**URL:** `/strategy-workspace/programs`

**What you see:**
- All EPM programs created from strategic decisions
- Status indicators
- Quick access to program details

**Screenshot location:** Programs list view

---

### 3.4 EPM Program View (7 Tabs)
**URL:** `/strategy-workspace/epm/:id`

**What you see:**
A comprehensive program management dashboard with 7 tabs:

| Tab | Contents |
|-----|----------|
| **Overview** | Program summary, status, key metrics |
| **Tasks** | Work breakdown structure, assignments, deadlines |
| **Resources** | Team members, capacity, allocation |
| **Risks** | Risk register, mitigation plans, status |
| **Benefits** | Expected outcomes, tracking metrics |
| **KPIs** | Key performance indicators, progress |
| **Financials** | Budget, actuals, forecasts |

**Screenshot locations:**
- EPM Overview tab
- Tasks breakdown structure
- Resources allocation view
- Risks register
- KPIs dashboard

---

# Supporting Features

## Strategies Hub
**URL:** `/strategies`

**What you see:**
- Unified view of all strategic initiatives
- Artifact hierarchy (analysis → decisions → programs)
- Research provenance tracking
- Export options

**Screenshot location:** Strategies Hub unified view

---

## Repository Browser
**URL:** `/repository`

**What you see:**
- Knowledge graph explorer
- Searchable statements and insights
- Cross-reference between analyses

**Screenshot location:** Repository browser

---

## Document Intelligence

**What you see:**
- Upload button on input pages
- Background processing indicator
- Extracted insights added to analysis

**Supported formats:**
- PDF
- DOCX
- Excel (.xlsx, .xls)
- Images (JPG, PNG)

**Screenshot location:** Document upload flow

---

# Value Summary

| Without Premisia | With Premisia |
|------------------|---------------|
| Weeks of manual strategic analysis | Minutes of AI-enhanced analysis |
| Gut-feel market targeting | Systematic 100+ segment evaluation |
| Siloed frameworks | Integrated analysis with handoffs |
| Confirmation bias unchecked | Built-in contradiction detection |
| Strategy decks gather dust | Executable EPM programs |

---

# Quick Start Guide

## For Market Discovery
1. Go to `/marketing-consultant`
2. Describe your product/service
3. Run Segment Discovery
4. Review 8 dimensions and beachhead recommendation
5. Click "Continue to Strategic Analysis"

## For Strategic Analysis
1. Go to `/strategic-consultant` (or arrive from Marketing)
2. Enter strategic challenge
3. Select journey (Five Whys, Porter's, BMC, etc.)
4. Review analysis and research
5. Extract decisions

## For Program Execution
1. Go to Strategy Workspace
2. Review and prioritize decisions
3. Convert to EPM programs
4. Track in 7-tab dashboard

---

*Premisia: From "I have this idea" to "here's exactly how we execute it."*
