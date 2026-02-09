#!/usr/bin/env tsx

/**
 * Apply Neo4j schema from schema.cypher file
 * This script can be run multiple times safely (idempotent)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSession } from '../../server/config/neo4j.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applySchema() {
  console.log('[apply-schema] Starting schema application...');
  
  // Read schema file
  const schemaPath = path.join(__dirname, 'schema.cypher');
  if (!fs.existsSync(schemaPath)) {
    console.error(`[apply-schema] ERROR: schema.cypher not found at ${schemaPath}`);
    process.exit(1);
  }

  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  console.log('[apply-schema] Read schema.cypher successfully');

  // Split into individual statements (by semicolon, ignoring comments)
  const statements = schemaContent
    .split('\n')
    .filter(line => !line.trim().startsWith('//') && line.trim() !== '')
    .join('\n')
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  console.log(`[apply-schema] Found ${statements.length} statements to execute`);

  const session = createSession();
  
  try {
    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        await session.run(statement);
        successCount++;
        
        // Extract constraint/index name for logging
        const match = statement.match(/(?:CONSTRAINT|INDEX)\s+(\w+)/i);
        const name = match ? match[1] : 'statement';
        console.log(`[apply-schema] ✓ Applied: ${name}`);
      } catch (error: any) {
        // Check if error is due to constraint/index already existing
        if (error.code === 'Neo.ClientError.Schema.EquivalentSchemaRuleAlreadyExists' ||
            error.code === 'Neo.ClientError.Schema.IndexAlreadyExists' ||
            error.code === 'Neo.ClientError.Schema.ConstraintAlreadyExists') {
          // This is expected for idempotent runs
          successCount++;
          const match = statement.match(/(?:CONSTRAINT|INDEX)\s+(\w+)/i);
          const name = match ? match[1] : 'statement';
          console.log(`[apply-schema] ○ Already exists: ${name}`);
        } else {
          errorCount++;
          console.error(`[apply-schema] ✗ Failed to apply statement:`, error.message);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
        }
      }
    }

    console.log('\n[apply-schema] ========================================');
    console.log(`[apply-schema] Schema application complete`);
    console.log(`[apply-schema] Success: ${successCount}/${statements.length}`);
    console.log(`[apply-schema] Errors: ${errorCount}`);
    console.log('[apply-schema] ========================================\n');

    if (errorCount > 0) {
      console.error('[apply-schema] WARNING: Some statements failed. Check logs above.');
      process.exit(1);
    }

    // Verify Meta node
    const result = await session.run('MATCH (m:Meta {id: "meta"}) RETURN m.graphSchemaVersion as version');
    if (result.records.length > 0) {
      const version = result.records[0].get('version');
      console.log(`[apply-schema] Schema version: ${version}`);
    }

  } catch (error) {
    console.error('[apply-schema] FATAL ERROR:', error);
    process.exit(1);
  } finally {
    await session.close();
    console.log('[apply-schema] Session closed');
  }
}

// Run if called directly
applySchema()
  .then(() => {
    console.log('[apply-schema] Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[apply-schema] Unhandled error:', error);
    process.exit(1);
  });

export { applySchema };
