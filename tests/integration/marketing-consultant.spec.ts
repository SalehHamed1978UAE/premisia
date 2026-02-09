/**
 * Marketing Consultant Integration Tests
 * 
 * Full end-to-end tests for Marketing Consultant Segment Discovery.
 * These tests make real AI calls and may take 5-10 minutes to complete.
 * 
 * Run with: npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestUser, type TestUser } from '../fixtures';
import { cleanupTestData } from '../test-db-setup';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:5000';
const TIMEOUT_MS = 300000; // 5 minutes for long-running journeys

describe('Marketing Consultant Integration', () => {
  let testUser: TestUser;
  const TEST_USER_ID = 'integration-test-marketing';

  beforeAll(async () => {
    await cleanupTestData();
    testUser = await createTestUser({ id: TEST_USER_ID });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe.sequential('Segment Discovery (B2C Physical Product)', () => {
    let understandingId: string;

    it('should create understanding and classify as B2C for physical product', async () => {
      const response = await request(API_BASE)
        .post('/api/marketing-consultant/understanding')
        .send({
          input: 'Premium artisan bakery specializing in sourdough bread and French pastries',
          userId: testUser.id
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      const data = response.body;
      expect(data.id || data.understandingId).toBeDefined();
      understandingId = data.id || data.understandingId;
      
      if (data.offeringType) {
        expect(['physical_product', 'local_business']).toContain(data.offeringType);
      }
      console.log(`✓ Understanding created: ${understandingId}`);
    }, TIMEOUT_MS);

    it('should confirm classification for segment discovery', async () => {
      expect(understandingId).toBeDefined();

      const response = await request(API_BASE)
        .post('/api/marketing-consultant/classification/confirm')
        .send({
          understandingId,
          offeringType: 'physical_product',
          stage: 'idea_stage',
          gtmConstraint: 'small_team',
          salesMotion: 'self_serve'
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      console.log(`✓ Classification confirmed`);
    }, TIMEOUT_MS);

    it('should start segment discovery', async () => {
      expect(understandingId).toBeDefined();

      const response = await request(API_BASE)
        .post(`/api/marketing-consultant/start-discovery/${understandingId}`)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      console.log(`✓ Discovery started for ${understandingId}`);
    }, TIMEOUT_MS);

    it('should complete discovery with consumer segments (not B2B)', async () => {
      expect(understandingId).toBeDefined();

      const maxAttempts = 60;
      let completed = false;
      let discoveryStatus: any = null;

      for (let i = 0; i < maxAttempts && !completed; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const response = await request(API_BASE)
          .get(`/api/marketing-consultant/discovery-status/${understandingId}`);

        discoveryStatus = response.body;

        if (discoveryStatus?.status === 'completed') {
          completed = true;
        } else if (discoveryStatus?.status === 'failed') {
          throw new Error(`Discovery failed: ${discoveryStatus?.error}`);
        } else {
          console.log(`  Polling... ${i + 1}/${maxAttempts} (status: ${discoveryStatus?.status})`);
        }
      }

      expect(completed).toBe(true);
      console.log(`✓ Discovery completed`);
    }, TIMEOUT_MS);

    it('should have B2C consumer segments (not B2B distribution)', async () => {
      expect(understandingId).toBeDefined();

      const response = await request(API_BASE)
        .get(`/api/marketing-consultant/results/${understandingId}`);

      expect(response.status).toBe(200);
      const data = response.body;
      expect(data.synthesis).toBeDefined();
      expect(data.synthesis.beachhead).toBeDefined();
      
      const beachhead = data.synthesis.beachhead;
      const genes = beachhead.genome?.genes;

      if (genes) {
        const geneKeys = Object.keys(genes);
        const hasB2BDimensions = geneKeys.some(k => 
          ['industry_vertical', 'company_size', 'decision_maker', 'buying_committee'].includes(k)
        );
        
        expect(hasB2BDimensions).toBe(false);
        console.log(`✓ Gene dimensions are consumer-focused: ${geneKeys.slice(0, 3).join(', ')}...`);
      }

      const validationPlan = beachhead.validationPlan || [];
      const hasB2BValidation = validationPlan.some((step: string) =>
        step.toLowerCase().includes('b2b') ||
        step.toLowerCase().includes('procurement') ||
        step.toLowerCase().includes('distributor') ||
        step.toLowerCase().includes('wholesaler')
      );

      expect(hasB2BValidation).toBe(false);
      console.log(`✓ Validation plan is consumer-focused (${validationPlan.length} steps)`);
    }, TIMEOUT_MS);
  });
});
