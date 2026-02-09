# Knowledge Graph Scripts - Quick Reference

## Setup & Verification

### 1. Verify Neo4j Connection
```bash
tsx scripts/verify-neo4j.ts
```

### 2. Apply Schema (Constraints & Indexes)
```bash
tsx scripts/knowledge-graph/apply-schema.ts
```

### 3. Load All Seed Data
```bash
tsx scripts/etl/load-all.ts
```

## Individual ETL Scripts

Load specific datasets:

```bash
# Organizations (ADDED, DED, DIFC, etc.)
tsx scripts/etl/organizations.ts

# Locations (UAE, Abu Dhabi, Dubai, districts)
tsx scripts/etl/locations.ts

# Jurisdictions (mainland, free zones)
tsx scripts/etl/jurisdictions.ts

# Industries (F&B, tech, fintech, etc.)
tsx scripts/etl/industries.ts

# Incentives (ADDED Innovate, ADIO Rebate, etc.)
tsx scripts/etl/incentives.ts

# Regulations (PDPL, Emiratisation, etc.)
tsx scripts/etl/regulations.ts
```

## Environment Variables Required

Add to your `.env` file:

```bash
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password
NEO4J_DATABASE=neo4j
```

## Typical Workflow

1. **First Time Setup**
   ```bash
   # Verify connection
   tsx scripts/verify-neo4j.ts
   
   # Apply schema
   tsx scripts/knowledge-graph/apply-schema.ts
   
   # Load all seed data
   tsx scripts/etl/load-all.ts
   ```

2. **Adding New Data**
   - Edit JSON files in `scripts/etl/data/`
   - Run the specific ETL script
   - All scripts are idempotent (safe to run multiple times)

3. **Updating Schema**
   - Edit `scripts/knowledge-graph/schema.cypher`
   - Run `tsx scripts/knowledge-graph/apply-schema.ts`

## Logs & Provenance

- ETL run history: `scripts/output/etl_runs.csv`
- Each node includes `dataSource` and `retrievedAt` fields
- All operations are logged to console

## Documentation

See `docs/KNOWLEDGE_GRAPH.md` for:
- Complete architecture overview
- Usage examples
- API reference
- Maintenance procedures
