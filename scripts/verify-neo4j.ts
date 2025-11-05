#!/usr/bin/env tsx

/**
 * Verify Neo4j connection and basic health
 */

import { verifyConnection, createSession } from '../server/config/neo4j';

async function verifyNeo4j() {
  console.log('[verify-neo4j] Starting Neo4j health check...\n');

  // Check environment variables
  const requiredEnvVars = ['NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.error('[verify-neo4j] ✗ Missing required environment variables:');
    missingVars.forEach(v => console.error(`  - ${v}`));
    console.error('\nPlease set these environment variables and try again.');
    process.exit(1);
  }

  console.log('[verify-neo4j] ✓ Environment variables configured');
  console.log(`[verify-neo4j]   URI: ${process.env.NEO4J_URI}`);
  console.log(`[verify-neo4j]   User: ${process.env.NEO4J_USERNAME}`);
  console.log(`[verify-neo4j]   Database: ${process.env.NEO4J_DATABASE || 'neo4j'}\n`);

  // Test connection
  const connected = await verifyConnection();
  
  if (!connected) {
    console.error('[verify-neo4j] ✗ Connection failed');
    console.error('[verify-neo4j] Please check your Neo4j instance and credentials.');
    process.exit(1);
  }

  console.log('[verify-neo4j] ✓ Connection successful\n');

  // Check schema version
  const session = createSession();
  try {
    const result = await session.run('MATCH (m:Meta {id: "meta"}) RETURN m.graphSchemaVersion as version, m.createdAt as created');
    
    if (result.records.length === 0) {
      console.log('[verify-neo4j] ⚠ Schema not initialized');
      console.log('[verify-neo4j] Run: npm run kg:apply-schema');
    } else {
      const version = result.records[0].get('version');
      const created = result.records[0].get('created');
      console.log('[verify-neo4j] ✓ Schema initialized');
      console.log(`[verify-neo4j]   Version: ${version}`);
      console.log(`[verify-neo4j]   Created: ${created}\n`);
    }

    // Get node counts
    const countsResult = await session.run(`
      MATCH (n)
      RETURN labels(n)[0] as label, count(*) as count
      ORDER BY count DESC
      LIMIT 10
    `);

    if (countsResult.records.length > 0) {
      console.log('[verify-neo4j] Node counts:');
      countsResult.records.forEach(record => {
        const label = record.get('label');
        const count = record.get('count').toNumber();
        console.log(`[verify-neo4j]   ${label}: ${count}`);
      });
    } else {
      console.log('[verify-neo4j] ⚠ No nodes in database yet');
      console.log('[verify-neo4j] Run ETL scripts to populate data');
    }

  } catch (error) {
    console.error('[verify-neo4j] Error checking schema:', error);
  } finally {
    await session.close();
  }

  console.log('\n[verify-neo4j] ========================================');
  console.log('[verify-neo4j] Health check complete ✓');
  console.log('[verify-neo4j] ========================================');
}

// Run if called directly
verifyNeo4j()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[verify-neo4j] Fatal error:', error);
    process.exit(1);
  });

export { verifyNeo4j };
