# Production Deployment Setup for Premisia

This document outlines the required steps to deploy Premisia to production successfully.

## Required PostgreSQL Extensions

The Knowledge Graph insights feature requires the `pg_trgm` PostgreSQL extension for text similarity searches.

### Setting Up Extensions in Production

**IMPORTANT**: These extensions must be enabled by a database administrator **before** deploying the application.

#### Step 1: Access Production Database

Access your production PostgreSQL database using the Replit Database tool or a database admin tool.

#### Step 2: Enable Required Extensions

Run the following SQL commands as a database administrator:

```sql
-- Required for Knowledge Graph text similarity searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Optional: For future vector embeddings support
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Step 3: Verify Extensions

Verify the extensions are installed:

```sql
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_trgm', 'vector');
```

You should see:

| extname | extversion |
|---------|------------|
| pg_trgm | 1.6        |
| vector  | 0.x.x      |

### Without Extensions

If the `pg_trgm` extension is not installed:

- ✅ The application will start successfully
- ⚠️ Knowledge Graph features will be automatically disabled
- ⚠️ Server logs will show: `[DB Extensions] ✗ pg_trgm extension is NOT installed`
- ℹ️ All other features will work normally

## Environment Variables

Ensure these environment variables are set in your production deployment:

### Required Secrets

```bash
# Database (automatically configured by Replit)
DATABASE_URL=postgresql://...

# Encryption (for sensitive data)
ENCRYPTION_KEY=your-encryption-key

# Feature Flags
FEATURE_KNOWLEDGE_GRAPH=true
FEATURE_JOURNEY_REGISTRY_V2=true

# Neo4j (for Knowledge Graph)
NEO4J_URI=neo4j://...
NEO4J_PASSWORD=your-neo4j-password
```

### Setting Production Secrets

**Development and Production secrets are separate on Replit.**

1. Open your Deployment dashboard (Publishing tab)
2. Navigate to **Environment Variables** or **Secrets** configuration
3. Add all required secrets listed above
4. Redeploy your application

## Troubleshooting

### Knowledge Graph Returns Empty Results

**Symptoms:**
- No insights shown in dashboard, strategies, or EPM programs
- Server logs show: `[DB Extensions] ✗ pg_trgm extension is NOT installed`

**Solution:**
1. Access production database as admin
2. Run: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
3. Restart your deployment

### 500 Internal Server Errors

**Symptoms:**
- Browser console shows 500 errors for `/api/knowledge/insights/...`

**Solution:**
1. Check server logs for specific error messages
2. Verify all environment variables are set in production
3. Verify database extensions are installed
4. Check database connection

### Extension Verification Script

You can manually verify extension status by running:

```bash
npm run tsx server/db-init.ts
```

This will check and report the status of required extensions.

## Deployment Checklist

Before deploying to production:

- [ ] Enable `pg_trgm` extension in production database
- [ ] Configure all required environment variables in deployment
- [ ] Verify Neo4j connection if using Knowledge Graph
- [ ] Test knowledge graph features in production
- [ ] Monitor server logs for extension warnings

## Support

If you encounter issues:

1. Check server logs for `[DB Extensions]` messages
2. Verify all secrets are configured in production deployment
3. Ensure database extensions are installed by an admin
4. Contact Replit support for database-related issues
