/**
 * Test Setup File
 * Runs before all tests to configure the test environment
 */

import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Set test environment variables
  if (!process.env.DATABASE_URL) {
    // Use a dummy value for tests that don't need a real database
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  }
});

afterAll(() => {
  // Clean up if needed
});
