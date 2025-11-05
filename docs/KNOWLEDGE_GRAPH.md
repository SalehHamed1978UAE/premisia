# Decision Support Knowledge Graph

## Overview

The Decision Support Knowledge Graph is a Neo4j-based graph database that powers intelligent recommendations, incentive discovery, and similar journey matching in the Premisia platform.

## Architecture

### Node Types

The graph consists of the following node types:

#### Core Domain Nodes
- **Location**: Geographic entities (countries, emirates, cities, districts)
- **Jurisdiction**: Legal/administrative zones (mainland, free zones)
- **Industry**: Business sectors and industry classifications
- **Incentive**: Government programs and financial incentives
- **Regulation**: Laws, policies, and regulatory requirements
- **Reference**: Source documents and research materials
- **Organization**: Government bodies and authorities

#### Journey Nodes
- **JourneySession**: User planning sessions
- **FrameworkOutput**: Analysis results (BMC, Five Whys, Porter's, etc.)
- **Decision**: Strategic decisions made during journeys
- **DecisionOption**: Available choices for each decision
- **Evidence**: Supporting data and research
- **Program**: Generated EPM outputs

### Key Relationships

```cypher
(Location)-[:WITHIN]->(Location)                    // Geographic hierarchy
(JourneySession)-[:LOCATED_IN]->(Location)          // Journey context
(JourneySession)-[:UNDER]->(Jurisdiction)           // Legal context
(JourneySession)-[:TARGETS_INDUSTRY]->(Industry)    // Industry focus
(Incentive)-[:AVAILABLE_IN]->(Jurisdiction)         // Incentive eligibility
(Program)-[:ELIGIBLE_FOR]->(Incentive)              // Program benefits
(Program)-[:CONSTRAINED_BY]->(Regulation)           // Compliance requirements
(Decision)-[:SUPPORTED_BY]->(Evidence)              // Decision rationale
(Evidence)-[:CITES]->(Reference)                    // Evidence sources
```

## Setup

### 1. Environment Variables

Add the following to your `.env` file:

```bash
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password
NEO4J_DATABASE=neo4j
```

### 2. Verify Connection

```bash
npm run kg:verify
```

This checks:
- Environment variables are set
- Neo4j instance is reachable
- Database is accessible

### 3. Apply Schema

```bash
npm run kg:apply-schema
```

This creates all constraints and indexes defined in `scripts/knowledge-graph/schema.cypher`.
The script is idempotent - safe to run multiple times.

### 4. Load Seed Data

```bash
npm run kg:seed
```

This loads all initial data:
- Organizations (ADDED, DED, DIFC, DMCC, etc.)
- Locations (UAE, Abu Dhabi, Dubai, districts)
- Jurisdictions (mainland, free zones)
- Industries (F&B, tech, fintech, etc.)
- Incentives (ADDED Innovate, ADIO Rebate, etc.)
- Regulations (PDPL, Emiratisation, etc.)

## Usage

### Service Layer

The `knowledge-graph-service.ts` provides high-level functions for graph operations:

```typescript
import {
  upsertJourneySession,
  upsertFrameworkOutput,
  getSimilarJourneys,
  getAvailableIncentives,
} from '@/server/services/knowledge-graph-service';

// Record a journey session
await upsertJourneySession({
  id: sessionId,
  journeyType: 'business_model_innovation',
  versionNumber: 1,
  locationId: 'loc-dubai-city',
  jurisdictionId: 'jur-dubai-mainland',
  industryId: 'ind-software',
  consentAggregate: true,
  createdAt: new Date().toISOString(),
});

// Find similar journeys
const similar = await getSimilarJourneys({
  locationId: 'loc-dubai-city',
  industryId: 'ind-software',
  limit: 5,
});

// Get available incentives
const incentives = await getAvailableIncentives({
  jurisdictionId: 'jur-dubai-mainland',
  industryId: 'ind-software',
});
```

### ETL Scripts

All ETL scripts are idempotent and can be run multiple times:

```bash
# Load individual datasets
npm run kg:load-locations
npm run kg:load-jurisdictions
npm run kg:load-industries
npm run kg:load-incentives
npm run kg:load-regulations

# Load all datasets
npm run kg:seed
```

### Adding New Data

#### 1. Manual Seed Data

Add data to JSON files in `scripts/etl/data/`:

```json
// scripts/etl/data/incentives.json
{
  "sourceKey": "new-program",
  "name": "New Program Name",
  "provider": "Government Body",
  "description": "Program description",
  "eligibilitySummary": "Who can apply",
  "benefits": ["Benefit 1", "Benefit 2"],
  "url": "https://...",
  "jurisdictionId": "jur-dubai-mainland"
}
```

Then run the relevant ETL script:

```bash
npm run kg:load-incentives
```

#### 2. Programmatic Upserts

Use the service layer to add data from your application:

```typescript
import { upsertNodes, upsertRelationships } from '@/scripts/etl/common';

// Upsert nodes
await upsertNodes([
  {
    label: 'Incentive',
    matchOn: { sourceKey: 'my-incentive' },
    properties: {
      id: 'inc-my-incentive',
      sourceKey: 'my-incentive',
      name: 'My Incentive',
      // ... other properties
    },
  },
]);

// Create relationships
await upsertRelationships([
  {
    from: { label: 'Incentive', matchOn: { sourceKey: 'my-incentive' } },
    type: 'AVAILABLE_IN',
    to: { label: 'Jurisdiction', matchOn: { id: 'jur-dubai-mainland' } },
  },
]);
```

## Data Sources

All nodes include provenance tracking:

- `dataSource`: Origin of the data (e.g., "manual-seed", "geonames-api", "government-portal")
- `retrievedAt`: ISO timestamp when data was ingested
- ETL runs are logged to `scripts/output/etl_runs.csv`

## Maintenance

### Viewing ETL History

Check `scripts/output/etl_runs.csv` for:
- Run ID and timestamp
- Script name and data source
- Nodes/relationships created
- Status (completed/failed)
- Error messages

### Schema Migrations

When adding new node types or properties:

1. Update `scripts/knowledge-graph/schema.cypher`
2. Update `shared/knowledge-graph-types.ts`
3. Run `npm run kg:apply-schema`
4. Update the Meta node version in schema.cypher

### Querying the Graph

Use Neo4j Browser or Cypher queries:

```cypher
// Find all incentives in Dubai
MATCH (i:Incentive)-[:AVAILABLE_IN]->(j:Jurisdiction)
WHERE j.name CONTAINS 'Dubai'
RETURN i.name, i.provider, i.url

// Find similar journeys
MATCH (j:JourneySession)-[:TARGETS_INDUSTRY]->(ind:Industry {name: 'Software & Technology'})
OPTIONAL MATCH (j)-[:GENERATED_PROGRAM]->(p:Program)
RETURN j.id, j.createdAt, p.status
ORDER BY j.createdAt DESC
LIMIT 10
```

## Features Enabled

With the Knowledge Graph, the platform can:

1. **Similar Journey Discovery**: "People like you did..."
   - Match journeys by location, industry, root cause
   - Show success/failure patterns
   - Recommend proven strategies

2. **Incentive Recommendations**: "Unlocks these incentives..."
   - Automatic eligibility matching
   - Program discovery based on context
   - Link to official sources

3. **Regulatory Awareness**: "Subject to these regulations..."
   - Jurisdiction-specific compliance
   - Industry-specific requirements
   - Effective date tracking

4. **Evidence-Based Decisions**: "Supported by..."
   - Citation tracking
   - Source transparency
   - Confidence scoring

5. **Program Intelligence**: "Similar programs had..."
   - Resource allocation patterns
   - Timeline estimates
   - Budget benchmarks

## Future Enhancements

Phase 2+ features:

- Vector similarity for root cause matching
- Real-time incentive expiry monitoring
- Multi-hop relationship queries
- Graph-based recommendation engine
- Agentic AI grounding with graph context
- Advanced analytics and insights
