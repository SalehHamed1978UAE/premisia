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
} from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Test user ID patterns - ONLY these will be cleaned up
 */
const TEST_USER_PATTERNS = [
  'test-user-',
  'smoke-test-user-',
  'smoke-test-',
  'smoke-journeys-',
  'security-test-user-',
  'integration-test-',
];

/**
 * Check if a user ID matches test patterns
 */
function isTestUserId(userId: string): boolean {
  return TEST_USER_PATTERNS.some(pattern => userId.startsWith(pattern));
}

/**
 * Build SQL LIKE conditions for test user patterns
 */
function getTestUserLikeConditions(): string {
  return TEST_USER_PATTERNS.map(p => `user_id LIKE '${p}%'`).join(' OR ');
}

/**
 * Build SQL LIKE conditions for test user IDs (on id column)
 */
function getTestUserIdLikeConditions(): string {
  return TEST_USER_PATTERNS.map(p => `id LIKE '${p}%'`).join(' OR ');
}

/**
 * Clean up all test data from the database
 * Deletes data in the correct order to respect foreign key constraints
 * ONLY deletes data matching test patterns - never touches production data
 * 
 * FK Order (delete children first):
 * 1. references (→ strategic_understanding, users)
 * 2. strategic_entities (→ strategic_understanding)
 * 3. bmc_analyses (→ strategy_versions)
 * 4. epm_programs (→ strategy_versions, users)
 * 5. strategy_versions (→ strategic_understanding, users)
 * 6. journey_sessions (→ strategic_understanding, users)
 * 7. user_journeys (→ users)
 * 8. strategic_understanding (no user FK)
 * 9. users (last - everything references this)
 */
export async function cleanupTestData() {
  const userConditions = getTestUserLikeConditions();
  const idConditions = getTestUserIdLikeConditions();
  
  // 1. Delete references (FK to understanding + users)
  try {
    await db.execute(sql.raw(`DELETE FROM references WHERE ${userConditions}`));
  } catch { /* Ignore if table empty or doesn't exist */ }
  
  // 2. Delete strategic entities (FK to understanding) - test entities have 'Test' prefix
  try {
    await db.delete(strategicEntities).where(sql`claim LIKE 'Test %'`);
  } catch { /* Ignore */ }
  
  // 3. Delete BMC analyses for test users' strategy versions
  try {
    await db.execute(sql.raw(`
      DELETE FROM bmc_analyses WHERE strategy_version_id IN (
        SELECT id FROM strategy_versions WHERE ${userConditions}
      )
    `));
  } catch { /* Table may not exist */ }
  
  // 4. Delete EPM programs for test users
  try {
    await db.execute(sql.raw(`DELETE FROM epm_programs WHERE ${userConditions}`));
  } catch { /* Table may not exist */ }
  
  // 5. Delete strategy versions for test users
  try {
    await db.execute(sql.raw(`DELETE FROM strategy_versions WHERE ${userConditions}`));
  } catch { /* Table may not exist */ }
  
  // 6. Delete journey sessions for test users
  try {
    await db.execute(sql.raw(`DELETE FROM journey_sessions WHERE ${userConditions}`));
  } catch { /* Ignore */ }
  
  // 7. Delete user journeys for test users
  try {
    await db.execute(sql.raw(`DELETE FROM user_journeys WHERE ${userConditions}`));
  } catch { /* Ignore */ }
  
  // 8. Delete strategic understanding with test session IDs
  try {
    await db.delete(strategicUnderstanding).where(sql`session_id LIKE 'test-session-%'`);
  } catch { /* Ignore */ }
  
  // 9. Delete test users (LAST - after all FK references removed)
  try {
    await db.execute(sql.raw(`DELETE FROM users WHERE ${idConditions}`));
  } catch { /* Ignore */ }
  
  // Note: Any remaining FK errors are silently ignored - they indicate 
  // non-test data that we should not touch
}

/**
 * Clean up test data for a specific user ID
 * Only cleans up if the user ID matches test patterns
 */
export async function cleanupTestDataForUser(userId: string) {
  // Safety check: only clean up test users
  if (!isTestUserId(userId)) {
    console.log(`Skipping cleanup for non-test user: ${userId}`);
    return;
  }
  
  try {
    await db.execute(sql`DELETE FROM references WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM epm_programs WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM strategy_versions WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM journey_sessions WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM user_journeys WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
  } catch {
    // Silently ignore - may have already been cleaned up
  }
}

/**
 * Initialize test database
 * Ensures the database is ready for tests
 */
export async function initializeTestDatabase() {
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
 */
export function ensureTestEncryptionKey() {
  if (!process.env.ENCRYPTION_KEY) {
    const testKey = Buffer.from('test-encryption-key-for-testing-only-32bytes').toString('base64');
    process.env.ENCRYPTION_KEY = testKey;
  }
}
