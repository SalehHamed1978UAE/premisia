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
} from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Clean up all test data from the database
 * This function deletes data in the correct order to respect foreign key constraints
 */
export async function cleanupTestData() {
  try {
    // Delete in reverse order of dependencies
    await db.delete(references).where(sql`title LIKE 'Test %'`);
    await db.delete(strategicEntities).where(sql`claim LIKE 'Test %'`);
    await db.delete(journeySessions).where(sql`user_id LIKE 'test-user-%'`);
    await db.delete(strategicUnderstanding).where(sql`session_id LIKE 'test-session-%'`);
    await db.delete(userJourneys).where(sql`user_id LIKE 'test-user-%'`);
    await db.delete(users).where(sql`email LIKE 'test-%@example.com' OR id LIKE 'test-user-%'`);
  } catch (error) {
    console.error('Error cleaning up test data:', error);
    // Don't throw - allow tests to continue even if cleanup fails
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
