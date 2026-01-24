/**
 * Test Database Setup
 * Utilities for managing test database state
 */

import { db } from '../server/db';
import { 
  users,
  strategicUnderstanding,
  journeySessions,
  strategicEntities,
  references,
  userJourneys,
  strategyVersions,
  epmPrograms,
  bmcAnalyses,
} from '@shared/schema';
import { sql, eq, like, or } from 'drizzle-orm';

/**
 * Clean up all test data from the database
 * Deletes data in the correct order to respect foreign key constraints
 * 
 * FK Order (delete children first):
 * 1. references (→ strategic_understanding, users)
 * 2. strategic_entities (→ strategic_understanding)
 * 3. bmc_analyses (→ strategy_versions)
 * 4. epm_programs (→ strategy_versions)
 * 5. strategy_versions (→ strategic_understanding)
 * 6. journey_sessions (→ strategic_understanding, users)
 * 7. user_journeys (→ users)
 * 8. strategic_understanding (no user FK)
 * 9. users (last - everything references this)
 */
export async function cleanupTestData() {
  try {
    // Pattern matches both old and new test user ID formats
    const testUserPatterns = [
      'test-user-%',
      'smoke-test-user-%',
      'smoke-journeys-%',
      'security-test-user-%',
    ];
    
    // Build OR condition for user patterns
    const userIdCondition = or(
      like(users.id, 'test-user-%'),
      like(users.id, 'smoke-test-user-%'),
      like(users.id, 'smoke-journeys-%'),
      like(users.id, 'security-test-user-%'),
    );

    // 1. Delete references (FK to understanding + users)
    await db.delete(references).where(sql`title LIKE 'Test %' OR user_id LIKE 'test-%' OR user_id LIKE 'smoke-%' OR user_id LIKE 'security-%'`);
    
    // 2. Delete strategic entities (FK to understanding)
    await db.delete(strategicEntities).where(sql`claim LIKE 'Test %'`);
    
    // 3. Delete BMC analyses (FK to strategy_versions)
    // Skip if table doesn't exist yet
    try {
      await db.execute(sql`DELETE FROM bmc_analyses WHERE strategy_version_id IN (
        SELECT id FROM strategy_versions WHERE session_id LIKE 'test-session-%' OR session_id LIKE 'session-%'
      )`);
    } catch { /* Table may not exist */ }
    
    // 4. Delete EPM programs (FK to strategy_versions AND users)
    try {
      await db.execute(sql`DELETE FROM epm_programs WHERE 
        user_id LIKE 'test-user-%' OR user_id LIKE 'smoke-test-user-%' OR 
        user_id LIKE 'smoke-journeys-%' OR user_id LIKE 'security-test-user-%' OR
        strategy_version_id IN (
          SELECT id FROM strategy_versions WHERE session_id LIKE 'test-session-%' OR session_id LIKE 'session-%'
        )`);
    } catch { /* Table may not exist */ }
    
    // 5. Delete strategy versions (FK to understanding AND users)
    try {
      await db.execute(sql`DELETE FROM strategy_versions WHERE 
        user_id LIKE 'test-user-%' OR user_id LIKE 'smoke-test-user-%' OR 
        user_id LIKE 'smoke-journeys-%' OR user_id LIKE 'security-test-user-%' OR
        session_id LIKE 'test-session-%' OR session_id LIKE 'session-%'`);
    } catch { /* Table may not exist */ }
    
    // 6. Delete journey sessions (FK to understanding + users) - BEFORE users
    await db.delete(journeySessions).where(
      sql`user_id LIKE 'test-user-%' OR user_id LIKE 'smoke-test-user-%' OR user_id LIKE 'smoke-journeys-%' OR user_id LIKE 'security-test-user-%'`
    );
    
    // 7. Delete user journeys (FK to users)
    await db.delete(userJourneys).where(
      sql`user_id LIKE 'test-user-%' OR user_id LIKE 'smoke-test-user-%' OR user_id LIKE 'smoke-journeys-%' OR user_id LIKE 'security-test-user-%'`
    );
    
    // 8. Delete strategic understanding (no FK to users)
    await db.delete(strategicUnderstanding).where(sql`session_id LIKE 'test-session-%'`);
    
    // 9. Delete users (LAST - after all FK references removed)
    await db.delete(users).where(
      sql`email LIKE 'test-%@example.com' OR id LIKE 'test-user-%' OR id LIKE 'smoke-test-user-%' OR id LIKE 'smoke-journeys-%' OR id LIKE 'security-test-user-%'`
    );
    
  } catch (error) {
    console.error('Error cleaning up test data:', error);
    // Don't throw - allow tests to continue even if cleanup fails
  }
}

/**
 * Clean up test data for a specific user ID
 * More targeted cleanup that handles FK constraints properly
 */
export async function cleanupTestDataForUser(userId: string) {
  try {
    // Delete in FK order
    await db.execute(sql`DELETE FROM references WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM journey_sessions WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM user_journeys WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
  } catch (error) {
    console.error(`Error cleaning up test data for user ${userId}:`, error);
  }
}

/**
 * Initialize test database
 * Ensures the database is ready for tests
 */
export async function initializeTestDatabase() {
  // The database connection is already initialized in server/db.ts
  // This function can be expanded to run migrations or seed data if needed
  
  // Verify connection
  try {
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw new Error('Test database connection failed. Make sure DATABASE_URL is set correctly.');
  }
}

/**
 * Reset test database to a clean state
 * Use this before each test suite to ensure isolation
 */
export async function resetTestDatabase() {
  await cleanupTestData();
}

/**
 * Create encryption key for tests if not set
 * This ensures tests can run even without a real encryption key
 */
export function ensureTestEncryptionKey() {
  if (!process.env.ENCRYPTION_KEY) {
    // Generate a test encryption key (base64 encoded 32 bytes)
    const testKey = Buffer.from('test-encryption-key-for-testing-only-32bytes').toString('base64');
    process.env.ENCRYPTION_KEY = testKey;
  }
}
