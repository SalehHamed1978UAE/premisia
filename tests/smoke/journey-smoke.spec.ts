/**
 * Journey Smoke Tests
 *
 * Quick tests for journey-related functionality.
 * These tests validate API contracts and data structures WITHOUT making AI calls.
 * 
 * For full end-to-end AI journey tests, see tests/integration/
 * 
 * Run with: npm run test:smoke
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestUser, type TestUser } from '../fixtures';
import { cleanupTestData } from '../test-db-setup';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Journey Smoke Tests', () => {
  let testUser: TestUser;
  const TEST_USER_ID = 'smoke-test-user-journeys';

  beforeAll(async () => {
    await cleanupTestData();
    testUser = await createTestUser({ id: TEST_USER_ID });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Module Registry API', () => {
    it('should list registered modules', async () => {
      const response = await request(API_BASE)
        .get('/api/module-registry/modules')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.modules).toBeDefined();
      expect(Array.isArray(response.body.modules)).toBe(true);
      expect(response.body.modules.length).toBeGreaterThan(0);
      
      console.log(`✓ Found ${response.body.modules.length} registered modules`);
    });

    it('should list journey configs', async () => {
      const response = await request(API_BASE)
        .get('/api/module-registry/journeys')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.journeys).toBeDefined();
      
      console.log(`✓ Found ${response.body.journeys.length} journey configs`);
    });

    it('should return registry stats', async () => {
      const response = await request(API_BASE)
        .get('/api/module-registry/stats')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      console.log(`✓ Registry stats available`);
    });
  });

  describe('Journey Session Management', () => {
    it('should handle non-existent journey session gracefully', async () => {
      const response = await request(API_BASE)
        .get('/api/strategic-consultant/journey-status/non-existent-id');

      // Should return 404 or empty result, not error
      expect([200, 404]).toContain(response.status);
    });

    it('should list versions for non-existent session', async () => {
      const response = await request(API_BASE)
        .get('/api/strategic-consultant/versions/non-existent-session');

      // Should return 200 with empty versions or 404
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.versions).toBeDefined();
      }
    });
  });

  describe('Marketing Consultant Discovery Status', () => {
    it('should handle non-existent discovery gracefully', async () => {
      const response = await request(API_BASE)
        .get('/api/marketing-consultant/discovery-status/non-existent-id');

      expect([200, 404]).toContain(response.status);
    });

    it('should handle non-existent results gracefully', async () => {
      const response = await request(API_BASE)
        .get('/api/marketing-consultant/results/non-existent-id');

      expect([200, 404]).toContain(response.status);
    });
  });
});
