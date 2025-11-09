/**
 * Database Extension Verification
 * Checks if required PostgreSQL extensions are available
 * Does NOT attempt to create them (requires superuser privileges)
 * 
 * Manual Setup Required:
 * Run these SQL commands as a database admin before deploying:
 * 
 *   CREATE EXTENSION IF NOT EXISTS pg_trgm;
 *   CREATE EXTENSION IF NOT EXISTS vector; -- Optional, for future use
 * 
 */

import { sql } from 'drizzle-orm';
import { db } from './db';

interface ExtensionStatus {
  pg_trgm: boolean;
  pgvector: boolean;
}

/**
 * Verify that required PostgreSQL extensions are installed
 * Returns extension availability status without attempting to create them
 */
export async function verifyDatabaseExtensions(): Promise<ExtensionStatus> {
  const status: ExtensionStatus = {
    pg_trgm: false,
    pgvector: false,
  };
  
  try {
    // Check if pg_trgm extension exists
    const trgmResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
      ) as installed
    `);
    
    status.pg_trgm = (trgmResult.rows[0] as any)?.installed === true;
    
    if (status.pg_trgm) {
      console.log('[DB Extensions] ✓ pg_trgm extension is installed');
    } else {
      console.warn('[DB Extensions] ✗ pg_trgm extension is NOT installed');
      console.warn('[DB Extensions] Knowledge Graph insights will be disabled');
      console.warn('[DB Extensions] To enable: Run "CREATE EXTENSION IF NOT EXISTS pg_trgm;" as a database admin');
    }
    
  } catch (error: any) {
    console.error('[DB Extensions] Failed to check pg_trgm:', error.message);
  }
  
  try {
    // Check if pgvector extension exists (optional)
    const vectorResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as installed
    `);
    
    status.pgvector = (vectorResult.rows[0] as any)?.installed === true;
    
    if (status.pgvector) {
      console.log('[DB Extensions] ✓ pgvector extension is installed');
    } else {
      console.log('[DB Extensions] ⓘ pgvector extension not installed (optional)');
    }
    
  } catch (error: any) {
    console.log('[DB Extensions] ⓘ pgvector not available (optional)');
  }
  
  return status;
}

// Export singleton status for checking at runtime
let _extensionStatus: ExtensionStatus | null = null;

export function getExtensionStatus(): ExtensionStatus | null {
  return _extensionStatus;
}

export async function initializeDatabaseExtensions(): Promise<ExtensionStatus> {
  console.log('[DB Extensions] Verifying PostgreSQL extensions...');
  _extensionStatus = await verifyDatabaseExtensions();
  return _extensionStatus;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyDatabaseExtensions()
    .then((status) => {
      console.log('\nExtension Status:', status);
      if (!status.pg_trgm) {
        console.error('\n❌ CRITICAL: pg_trgm extension is missing!');
        console.error('Run this SQL as a database admin:');
        console.error('  CREATE EXTENSION IF NOT EXISTS pg_trgm;');
        process.exit(1);
      }
      console.log('\n✅ All required extensions are installed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Extension verification failed:', error);
      process.exit(1);
    });
}
