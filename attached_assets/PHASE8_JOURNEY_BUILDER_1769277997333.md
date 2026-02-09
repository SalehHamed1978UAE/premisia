# Phase 8: Journey Builder Prep

**Date:** January 24, 2026
**Prerequisite:** Phase 7 (Journey Library Expansion) complete
**Goal:** Define APIs, UX, and rules for a visual Journey Builder

---

## Overview

The Journey Builder allows users to visually compose strategic analysis workflows by:
- Dragging modules (frameworks) onto a canvas
- Connecting them with data-flow arrows
- Configuring each module's parameters
- Saving and executing custom journeys

---

## 8.1: Journey Builder API Contract

### Module Catalog Endpoints

```typescript
// GET /api/journey-builder/modules
// List all available modules for the builder palette
interface ModuleCatalogResponse {
  modules: ModuleDefinition[];
}

interface ModuleDefinition {
  id: FrameworkName;                    // e.g., 'porters', 'swot'
  name: string;                         // e.g., "Porter's Five Forces"
  category: ModuleCategory;             // e.g., 'analysis', 'strategy', 'execution'
  description: string;
  icon: string;                         // Icon identifier or URL
  status: 'implemented' | 'stub';       // Whether it actually works
  inputs: PortDefinition[];             // What data it needs
  outputs: PortDefinition[];            // What data it produces
  configSchema: JSONSchema;             // Configuration options
  estimatedDuration: string;            // e.g., "2-3 minutes"
}

interface PortDefinition {
  id: string;                           // e.g., 'challenge', 'industry_context'
  name: string;                         // e.g., "Strategic Challenge"
  type: DataType;                       // e.g., 'string', 'bmc_output', 'swot_output'
  required: boolean;
  description: string;
}

type ModuleCategory =
  | 'input'           // Data entry points
  | 'analysis'        // Porter's, PESTLE, SWOT, etc.
  | 'strategy'        // Ansoff, Blue Ocean, Ocean Strategy
  | 'customer'        // Segment Discovery, JTBD
  | 'execution'       // OKR Generator, Action Plans
  | 'output';         // Reports, Exports

type DataType =
  | 'string'
  | 'strategic_context'
  | 'bmc_output'
  | 'five_whys_output'
  | 'segment_discovery_output'
  | 'swot_output'
  | 'porters_output'
  | 'pestle_output'
  | 'any';            // Accepts any input type
```

### Journey Configuration Endpoints

```typescript
// POST /api/journey-builder/configs
// Save a new journey configuration
interface CreateJourneyConfigRequest {
  name: string;
  description?: string;
  nodes: NodeConfig[];
  edges: EdgeConfig[];
  settings?: JourneySettings;
}

interface NodeConfig {
  id: string;                           // Unique node ID (UUID)
  moduleId: FrameworkName;              // Which module this node uses
  position: { x: number; y: number };   // Canvas position
  config: Record<string, any>;          // Module-specific configuration
}

interface EdgeConfig {
  id: string;                           // Unique edge ID
  sourceNodeId: string;
  sourcePortId: string;                 // Output port of source
  targetNodeId: string;
  targetPortId: string;                 // Input port of target
}

interface JourneySettings {
  parallelExecution: boolean;           // Run independent branches in parallel
  stopOnError: boolean;                 // Halt journey if any module fails
  timeoutMinutes: number;               // Max total execution time
}

interface CreateJourneyConfigResponse {
  id: string;                           // Journey config ID
  createdAt: string;
}

// GET /api/journey-builder/configs
// List saved journey configurations
interface ListJourneyConfigsResponse {
  configs: JourneyConfigSummary[];
}

interface JourneyConfigSummary {
  id: string;
  name: string;
  description?: string;
  moduleCount: number;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'valid' | 'invalid';
}

// GET /api/journey-builder/configs/:id
// Load a specific journey configuration
interface GetJourneyConfigResponse {
  id: string;
  name: string;
  description?: string;
  nodes: NodeConfig[];
  edges: EdgeConfig[];
  settings: JourneySettings;
  validation: ValidationResult;
}

// PUT /api/journey-builder/configs/:id
// Update a journey configuration
// Same body as CreateJourneyConfigRequest

// DELETE /api/journey-builder/configs/:id
// Delete a journey configuration
```

### Validation Endpoint

```typescript
// POST /api/journey-builder/validate
// Validate a journey configuration before saving/running
interface ValidateJourneyRequest {
  nodes: NodeConfig[];
  edges: EdgeConfig[];
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  type: 'missing_input' | 'invalid_connection' | 'cycle_detected' | 'no_start_node' | 'stub_module';
  nodeId?: string;
  edgeId?: string;
  message: string;
}

interface ValidationWarning {
  type: 'long_duration' | 'unconnected_output' | 'parallel_bottleneck';
  nodeId?: string;
  message: string;
}
```

### Execution Endpoint

```typescript
// POST /api/journey-builder/execute/:configId
// Execute a saved journey configuration
interface ExecuteJourneyRequest {
  initialContext: {
    challenge: string;
    [key: string]: any;           // Additional context data
  };
}

interface ExecuteJourneyResponse {
  executionId: string;
  status: 'started';
  streamUrl: string;              // SSE endpoint for progress updates
}

// GET /api/journey-builder/execute/:executionId/stream
// SSE endpoint for execution progress
// Events:
//   - node_started: { nodeId, moduleName }
//   - node_progress: { nodeId, progress, message }
//   - node_completed: { nodeId, output }
//   - node_failed: { nodeId, error }
//   - journey_completed: { results }
//   - journey_failed: { error }
```

---

## 8.2: Wireframes / UX Spec

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Journey Builder                                        [Save] [Run ▶]  │
├─────────────┬───────────────────────────────────────────┬───────────────┤
│             │                                           │               │
│  MODULE     │              CANVAS                       │   CONFIG      │
│  PALETTE    │                                           │   SIDEBAR     │
│             │   ┌─────────┐         ┌─────────┐         │               │
│  [Analysis] │   │  BMC    │────────▶│  SWOT   │         │  Module:      │
│   ├ Porter's│   └─────────┘         └─────────┘         │  SWOT         │
│   ├ PESTLE  │         │                   │             │               │
│   ├ SWOT    │         │                   │             │  Inputs:      │
│   └ VRIO    │         ▼                   ▼             │  - BMC Output │
│             │   ┌─────────┐         ┌─────────┐         │               │
│  [Strategy] │   │ Porter's│────────▶│ Ansoff  │         │  Config:      │
│   ├ Ansoff  │   └─────────┘         └─────────┘         │  □ Include    │
│   ├ Blue O. │                             │             │    threats    │
│   └ Ocean   │                             ▼             │  □ Focus on   │
│             │                       ┌─────────┐         │    internal   │
│  [Customer] │                       │   OKR   │         │               │
│   ├ Segment │                       │Generator│         │  [Delete]     │
│   └ JTBD    │                       └─────────┘         │               │
│             │                                           │               │
│  [Execution]│                                           │               │
│   └ OKR Gen │                                           │               │
│             │                                           │               │
└─────────────┴───────────────────────────────────────────┴───────────────┘
```

### Module Palette (Left Panel)

- **Collapsible categories**: Analysis, Strategy, Customer, Execution
- **Drag to add**: Drag module from palette to canvas
- **Status indicators**:
  - Green dot = implemented
  - Gray dot = stub (not yet available)
- **Search/filter**: Quick search by name
- **Tooltips**: Hover shows description + estimated duration

### Canvas (Center)

- **Nodes**: Rounded rectangles with:
  - Module icon + name
  - Input ports (left side, circles)
  - Output ports (right side, circles)
  - Status indicator (idle/running/complete/error)
- **Edges**: Curved lines connecting ports
  - Arrow head shows data flow direction
  - Color indicates data type compatibility
- **Interactions**:
  - Click node to select (shows config in sidebar)
  - Drag nodes to reposition
  - Drag from output port to input port to create connection
  - Right-click for context menu (delete, duplicate, disconnect)
  - Zoom/pan with scroll wheel + drag
- **Start node**: Special "Input" node where journey begins
- **Validation overlay**: Red outline on nodes with errors

### Config Sidebar (Right Panel)

- **Selected module header**: Icon + name + description
- **Inputs section**: Shows connected inputs and their sources
- **Configuration form**: Module-specific settings (auto-generated from JSON schema)
- **Outputs section**: Shows what data this module produces
- **Actions**: Delete node, Duplicate node

### Top Bar

- **Journey name**: Editable title
- **Save button**: Save current configuration
- **Validation status**: "Valid" or "3 errors" badge
- **Run button**: Execute the journey (disabled if invalid)
- **Preview button**: Show execution order / data flow animation

### Execution View

When running, overlay the canvas with:
- **Progress indicators** on each node (spinner → checkmark → X)
- **Real-time output preview** in sidebar for selected node
- **Timeline** at bottom showing execution sequence
- **Stop button** to cancel execution

---

## 8.3: Module Compatibility Rules

### Data Type Compatibility Matrix

| Output Type | Compatible Input Types |
|-------------|------------------------|
| `strategic_context` | Any module that needs context |
| `bmc_output` | `swot`, `porters`, `ansoff`, `value_chain` |
| `five_whys_output` | Any analysis module |
| `swot_output` | `ansoff`, `blue_ocean`, `ocean_strategy`, `okr_generator` |
| `porters_output` | `swot`, `competitive_positioning`, `blue_ocean` |
| `pestle_output` | `swot`, `scenario_planning` |
| `segment_discovery_output` | `jobs_to_be_done`, `competitive_positioning`, `value_chain` |

### Connection Rules

```typescript
interface ConnectionRule {
  sourceModule: FrameworkName;
  sourcePort: string;
  targetModule: FrameworkName;
  targetPort: string;
  allowed: boolean;
  reason?: string;
}

// Example rules
const connectionRules: ConnectionRule[] = [
  // BMC outputs can feed into multiple analysis modules
  { sourceModule: 'bmc', sourcePort: 'output', targetModule: 'swot', targetPort: 'business_context', allowed: true },
  { sourceModule: 'bmc', sourcePort: 'output', targetModule: 'porters', targetPort: 'business_context', allowed: true },
  { sourceModule: 'bmc', sourcePort: 'output', targetModule: 'value_chain', targetPort: 'business_context', allowed: true },

  // SWOT can inform strategy modules
  { sourceModule: 'swot', sourcePort: 'output', targetModule: 'ansoff', targetPort: 'swot_analysis', allowed: true },
  { sourceModule: 'swot', sourcePort: 'output', targetModule: 'blue_ocean', targetPort: 'current_state', allowed: true },
  { sourceModule: 'swot', sourcePort: 'output', targetModule: 'okr_generator', targetPort: 'strategic_analysis', allowed: true },

  // Porter's informs competitive strategy
  { sourceModule: 'porters', sourcePort: 'output', targetModule: 'competitive_positioning', targetPort: 'competitive_forces', allowed: true },
  { sourceModule: 'porters', sourcePort: 'output', targetModule: 'blue_ocean', targetPort: 'industry_analysis', allowed: true },

  // Segment discovery feeds customer-focused modules
  { sourceModule: 'segment_discovery', sourcePort: 'output', targetModule: 'jobs_to_be_done', targetPort: 'target_segments', allowed: true },
  { sourceModule: 'segment_discovery', sourcePort: 'output', targetModule: 'value_chain', targetPort: 'customer_context', allowed: true },

  // PESTLE feeds macro-environmental analysis
  { sourceModule: 'pestle', sourcePort: 'output', targetModule: 'scenario_planning', targetPort: 'macro_factors', allowed: true },
  { sourceModule: 'pestle', sourcePort: 'output', targetModule: 'swot', targetPort: 'external_factors', allowed: true },

  // Prevent cycles and invalid connections
  { sourceModule: 'okr_generator', sourcePort: 'output', targetModule: 'bmc', targetPort: 'any', allowed: false, reason: 'OKRs are an output, not input to business model' },
];
```

### Validation Rules

```typescript
const validationRules = {
  // Must have exactly one start node
  requireStartNode: true,

  // All required inputs must be connected
  requireAllInputs: true,

  // No cycles allowed (DAG only)
  preventCycles: true,

  // Warn if stub modules are used
  warnOnStubModules: true,

  // Maximum nodes per journey
  maxNodes: 15,

  // Maximum parallel branches
  maxParallelBranches: 4,

  // Estimated duration warning threshold
  durationWarningMinutes: 20,
};
```

### Module Input/Output Definitions

```typescript
const modulePortDefinitions: Record<FrameworkName, { inputs: PortDefinition[], outputs: PortDefinition[] }> = {
  five_whys: {
    inputs: [
      { id: 'problem', name: 'Problem Statement', type: 'string', required: true, description: 'The problem to analyze' }
    ],
    outputs: [
      { id: 'output', name: 'Root Cause Analysis', type: 'five_whys_output', description: 'Root causes and insights' }
    ]
  },

  bmc: {
    inputs: [
      { id: 'challenge', name: 'Business Challenge', type: 'string', required: true, description: 'Business context' },
      { id: 'five_whys', name: 'Root Cause Analysis', type: 'five_whys_output', required: false, description: 'Optional pre-analysis' }
    ],
    outputs: [
      { id: 'output', name: 'Business Model Canvas', type: 'bmc_output', description: 'Complete BMC with all 9 blocks' }
    ]
  },

  segment_discovery: {
    inputs: [
      { id: 'offering', name: 'Offering Description', type: 'string', required: true, description: 'What you are selling' },
      { id: 'classification', name: 'Business Classification', type: 'marketing_context', required: true, description: 'B2B/B2C, stage, etc.' }
    ],
    outputs: [
      { id: 'output', name: 'Segment Analysis', type: 'segment_discovery_output', description: 'Beachhead + backup segments' }
    ]
  },

  swot: {
    inputs: [
      { id: 'business_context', name: 'Business Context', type: 'any', required: true, description: 'BMC, challenge, or other context' },
      { id: 'external_factors', name: 'External Analysis', type: 'pestle_output', required: false, description: 'PESTLE results if available' }
    ],
    outputs: [
      { id: 'output', name: 'SWOT Analysis', type: 'swot_output', description: 'Strengths, Weaknesses, Opportunities, Threats' }
    ]
  },

  porters: {
    inputs: [
      { id: 'business_context', name: 'Business Context', type: 'any', required: true, description: 'Industry and competitive context' }
    ],
    outputs: [
      { id: 'output', name: 'Five Forces Analysis', type: 'porters_output', description: 'Competitive forces assessment' }
    ]
  },

  ansoff: {
    inputs: [
      { id: 'swot_analysis', name: 'SWOT Analysis', type: 'swot_output', required: false, description: 'Current state assessment' },
      { id: 'business_context', name: 'Business Context', type: 'any', required: true, description: 'Growth objectives' }
    ],
    outputs: [
      { id: 'output', name: 'Growth Strategy Matrix', type: 'ansoff_output', description: 'Market penetration, development, diversification options' }
    ]
  },

  okr_generator: {
    inputs: [
      { id: 'strategic_analysis', name: 'Strategic Analysis', type: 'any', required: true, description: 'SWOT, Ansoff, or other strategy output' }
    ],
    outputs: [
      { id: 'output', name: 'OKRs', type: 'okr_output', description: 'Objectives and Key Results' }
    ]
  },

  // ... define for all 16 modules
};
```

---

## Implementation Order

### Phase 8.1: API Foundation
1. Create `/api/journey-builder/modules` endpoint (returns module catalog)
2. Create module port definitions in shared types
3. Add compatibility rules to server

### Phase 8.2: Config Management
1. Create journey_configs database table
2. Implement CRUD endpoints for configs
3. Implement validation endpoint

### Phase 8.3: Basic UI
1. Create JourneyBuilder page route
2. Implement module palette (collapsible categories)
3. Implement basic canvas (react-flow or similar)
4. Implement node rendering

### Phase 8.4: Canvas Interactions
1. Drag from palette to canvas
2. Connect nodes (port-to-port)
3. Select/delete/move nodes
4. Zoom/pan

### Phase 8.5: Config Sidebar
1. Show selected node config
2. Dynamic form from JSON schema
3. Input/output port display

### Phase 8.6: Validation & Execution
1. Real-time validation as user builds
2. Execute journey with SSE progress
3. Results display

---

## Database Schema Addition

```sql
CREATE TABLE journey_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  settings JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE journey_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES journey_configs(id),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  initial_context JSONB NOT NULL,
  results JSONB,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Tech Stack Recommendations

| Component | Recommendation | Reason |
|-----------|---------------|--------|
| Canvas library | **React Flow** | Best React DAG editor, handles zoom/pan/connections |
| Form generation | **react-jsonschema-form** | Auto-generate config forms from JSON schema |
| State management | **Zustand** or existing store | Lightweight, good for canvas state |
| Drag & drop | Built into React Flow | Native support for drag from external source |

---

## Success Criteria

- [ ] Module catalog API returns all 16 frameworks with ports
- [ ] Journey configs can be saved/loaded/deleted
- [ ] Validation catches invalid connections and missing inputs
- [ ] Canvas supports drag, connect, zoom, pan
- [ ] Config sidebar shows module settings
- [ ] Journey can be executed with progress streaming
- [ ] All existing smoke tests still pass

---

## Estimated Scope

| Sub-phase | Effort |
|-----------|--------|
| 8.1 API Foundation | Medium |
| 8.2 Config Management | Medium |
| 8.3 Basic UI | Large |
| 8.4 Canvas Interactions | Large |
| 8.5 Config Sidebar | Medium |
| 8.6 Validation & Execution | Large |

This is a significant feature. Consider splitting into Phase 8a (API + data model) and Phase 8b (UI).
