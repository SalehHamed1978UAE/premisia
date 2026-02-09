/**
 * Test Setup File
 * Runs before all tests to configure the test environment
 */

import { beforeAll, afterAll } from 'vitest';
import { ensureTestEncryptionKey, initializeTestDatabase, cleanupTestData } from './test-db-setup';

beforeAll(async () => {
  // Set test environment variables
  if (!process.env.DATABASE_URL) {
    // Use a dummy value for tests that don't need a real database
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  }

  // Ensure encryption key is available for tests
  ensureTestEncryptionKey();

  // Initialize test database connection
  await initializeTestDatabase();
});

afterAll(async () => {
  // Clean up test data after all tests complete
  await cleanupTestData();
});
