# Journey Builder Guide

## Overview

The Journey Builder is a visual drag-and-drop interface for creating custom strategic analysis workflows. While Premisia offers pre-built journeys (like Market Understanding, Innovation Strategy, and Competitive Intelligence), the Journey Builder allows you to compose your own unique analysis paths by connecting strategic framework modules.

**URL:** `/journey-builder`

---

## Journey Builder vs Pre-Built Journeys

| Feature | Pre-Built Journeys | Journey Builder |
|---------|-------------------|-----------------|
| **Frameworks** | Curated sequence | Custom selection |
| **Order** | Fixed flow | Flexible connections |
| **Bridges** | Automatic | Automatic |
| **User Input Steps** | Built-in checkpoints | Drag in as needed |
| **EPM Generation** | End of journey | Add anywhere |
| **Recommended For** | Most users | Advanced users |

### Key Similarity

Both use the **same real AI analyzers** and **cognitive bridges**. The Journey Builder is not a "lite" version - it executes the same sophisticated analysis modules.

---

## Available Modules

### Analysis Frameworks

| Module | Description | Inputs | Outputs |
|--------|-------------|--------|---------|
| **PESTLE** | Macro-environmental analysis | Business context | Political, Economic, Social, Technological, Legal, Environmental factors |
| **Porter's Five Forces** | Industry competitive analysis | Business context, PESTLE output (optional) | Competitive rivalry, supplier/buyer power, substitution/entry threats |
| **SWOT** | Internal/external positioning | Business context, BMC/Porter's/PESTLE outputs | Strengths, Weaknesses, Opportunities, Threats |
| **Business Model Canvas** | Business model mapping | Framework results | 9 BMC building blocks |
| **Ansoff Matrix** | Growth strategy options | Business context, SWOT/BMC outputs | Market/product expansion strategies |
| **Blue Ocean** | Value innovation | Business context, SWOT/Porter's outputs | Eliminate-Reduce-Raise-Create grid |
| **BCG Matrix** | Portfolio analysis | Products/business units | Star/Question Mark/Cash Cow/Dog classification |
| **Value Chain** | Activity analysis | Business context, Porter's output | Primary and support activity breakdown |
| **VRIO** | Resource analysis | Business context, resources | Value/Rarity/Imitability/Organization assessment |
| **JTBD** | Customer jobs analysis | Business context, segments | Jobs-to-be-done framework |
| **Competitive Positioning** | Market position analysis | Competitors, target market | Positioning map and recommendations |
| **Scenario Planning** | Future scenarios | Business context, uncertainties | Multiple future scenario narratives |

### User Input Steps

| Module | Purpose |
|--------|---------|
| **Strategic Decisions** | Pauses for user to make strategic choices based on analysis |
| **Prioritization** | Pauses for user to prioritize recommendations |

### Synthesis Modules

| Module | Description |
|--------|-------------|
| **OKR Generator** | Generates Objectives and Key Results from strategic goals |
| **EPM Generator** | Synthesizes Enterprise Program Management deliverable |

---

## Cognitive Bridges

Cognitive bridges are **transformation functions** that enrich data as it flows between frameworks. They translate insights from one framework into the "language" of the next.

### How Bridges Work

When you connect Module A → Module B:

1. Module A executes and produces output
2. The system checks if a bridge exists for A → B
3. If a bridge exists, it transforms A's output into enriched context
4. Module B receives both the raw output AND the bridge-enhanced context

### Available Bridges

| Source | Target | What It Does |
|--------|--------|--------------|
| PESTLE | Porter's | Transforms macro factors into industry force context |
| Porter's | SWOT | Translates competitive forces into strengths/weaknesses/opportunities/threats context |
| SWOT | BMC | Maps SWOT factors to relevant BMC building blocks |
| Porter's | BMC | Translates competitive dynamics into business model implications |
| BMC | Blue Ocean | Identifies value innovation opportunities from business model |
| PESTLE | BMC | Connects macro trends to business model blocks |
| BMC | Ansoff | Derives growth options from current business model |
| PESTLE | Ansoff | Connects macro trends to market/product expansion options |
| Ansoff | BMC | Translates growth strategy back to business model changes |
| Five Whys | SWOT | Transforms root causes into SWOT context |
| Five Whys | BMC | Connects root cause insights to business model blocks |

### Example: PESTLE → Porter's Bridge

**Input (PESTLE output):**
```json
{
  "economic": ["Rising interest rates affecting capital access"],
  "technological": ["AI disrupting traditional services"]
}
```

**Bridge transforms to:**
```json
{
  "macroContext": {
    "threatOfNewEntry": "High - AI lowers barriers",
    "supplierPower": "Medium - capital constraints increase supplier leverage"
  }
}
```

**Porter's analyzer receives** both the raw PESTLE output AND this enriched context.

---

## Using the Journey Builder

### Step 1: Access the Builder

Navigate to `/journey-builder` from the main menu.

### Step 2: Drag Modules onto Canvas

From the Module Palette on the left:
1. Find the module you want
2. Drag it onto the canvas
3. Position it where desired

### Step 3: Connect Modules

1. Click on an output port (right side of a module)
2. Drag to an input port (left side of another module)
3. Release to create a connection

**Rules:**
- Connections flow left-to-right (outputs to inputs)
- One output can connect to multiple inputs
- No circular connections allowed (cycles are rejected)

### Step 4: Validate

Click **Validate** to check your journey:
- Errors (red): Must fix before running
- Warnings (yellow): Informational, can proceed

### Step 5: Save

Click **Save** to store your journey configuration for future use.

### Step 6: Run

Click **Run** to execute the journey:
1. Journey validates automatically
2. Modules execute in topological order
3. Progress shows in real-time
4. User input steps pause execution and redirect you

---

## Example Custom Journeys

### Quick Competitive Assessment

```
PESTLE → Porter's Five Forces → SWOT
```

Get a rapid view of your competitive position by analyzing macro factors, industry forces, and synthesizing into actionable SWOT.

### Full Strategic Analysis

```
PESTLE → Porter's → SWOT → Strategic Decisions → EPM Generator
```

Complete analysis with user checkpoint before generating program plan.

### Innovation Focused

```
SWOT → Blue Ocean → BMC → OKR Generator
```

Identify innovation opportunities and translate into business model changes with measurable objectives.

### Growth Strategy

```
BMC → Ansoff → Strategic Decisions → OKR Generator
```

Analyze current business model, identify growth paths, make strategic choices, and set objectives.

---

## Tips & Best Practices

1. **Start with context**: Most journeys benefit from starting with a context-gathering module (PESTLE, SWOT, or BMC)

2. **Leverage bridges**: Connect modules where bridges exist to get richer analysis

3. **Use user input steps**: Add Strategic Decisions module where you want to pause and review before proceeding

4. **Don't over-complicate**: A focused 3-4 module journey often produces better results than using every framework

5. **Save and iterate**: Save your journey, run it, review results, then modify and re-run

6. **Check execution order**: The validation shows execution order - verify it matches your intended flow

---

## Troubleshooting

### "Unknown module" error
The module may be a stub (not yet implemented). Check the module status in the palette.

### "Cycle detected" error
You've created a circular connection. Remove one edge to break the cycle.

### "Invalid connection" error
The port types may be incompatible. Check that output type matches expected input type.

### Execution pauses unexpectedly
User input steps (Strategic Decisions, Prioritization) pause execution and redirect you to complete the step. This is expected behavior.

### Module shows "error" status after running
Check the execution log for details. Common causes:
- Missing required inputs
- Invalid input data format
- External API errors (rate limits, etc.)

---

## Technical Details

### Module Registry

Modules are defined in the central registry at `server/modules/registry.ts`. Each module specifies:
- ID, name, description
- Input/output ports with types
- Status (implemented/stub)
- Category and tags

### Custom Journey Executor

Located at `server/services/custom-journey-executor.ts`, the executor:
1. Resolves topological execution order
2. Routes to real analyzers (same as pre-built journeys)
3. Applies cognitive bridges between nodes
4. Streams progress via Server-Sent Events (SSE)
5. Handles user input pauses and redirects
6. Saves results to `frameworkInsights` table

### Database Tables

- `custom_journey_configs`: Stores journey configurations (nodes, edges)
- `custom_journey_executions`: Tracks execution state and results

---

## Summary

The Journey Builder gives advanced users the power to compose custom strategic analysis workflows while maintaining the same analytical rigor as pre-built journeys. With cognitive bridges automatically enriching data flow between frameworks, you can create unique analysis paths tailored to your specific strategic questions.
