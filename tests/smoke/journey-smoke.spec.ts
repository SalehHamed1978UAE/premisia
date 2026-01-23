/**
 * Journey Smoke Tests
 *
 * These tests verify that core journeys complete successfully.
 * Run daily or on deployment to catch regressions.
 * 
 * Focus areas:
 * - EPM: Workstreams generated, deliverables are actionable (not research text)
 * - Marketing: Segments are consumers (not B2B), context keywords extracted
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestUser, type TestUser } from '../fixtures';
import { cleanupTestData } from '../test-db-setup';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:5000';
const TIMEOUT_MS = 300000; // 5 minutes for long-running journeys

describe('Journey Smoke Tests', () => {
  let testUser: TestUser;

  beforeAll(async () => {
    await cleanupTestData();
    testUser = await createTestUser({ id: 'smoke-test-user-journeys' });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Strategic Consultant (EPM Generation)', () => {
    let understandingId: string;
    let sessionId: string;

    it('should create strategic understanding', async () => {
      const response = await request(API_BASE)
        .post('/api/strategic-consultant/understanding')
        .send({
          title: 'Coffee Shop Strategy',
          userInput: 'Open a premium coffee shop in downtown Dubai',
          userId: testUser.id
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      const data = response.body;
      expect(data.id).toBeDefined();
      understandingId = data.id;
      console.log(`✓ Strategic understanding created: ${understandingId}`);
    }, TIMEOUT_MS);

    it('should start BMC research', async () => {
      expect(understandingId).toBeDefined();
      
      const response = await request(API_BASE)
        .post('/api/strategic-consultant/bmc-research')
        .send({
          understandingId,
          userId: testUser.id,
          journeyType: 'bmc'
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      const data = response.body;
      expect(data.sessionId || data.id).toBeDefined();
      sessionId = data.sessionId || data.id;
      console.log(`✓ BMC research started: ${sessionId}`);
    }, TIMEOUT_MS);

    it('should complete BMC research (poll for completion)', async () => {
      expect(sessionId).toBeDefined();
      
      const maxAttempts = 60; // 5 minutes with 5s intervals
      let completed = false;
      let researchStatus: any = null;

      for (let i = 0; i < maxAttempts && !completed; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const response = await request(API_BASE)
          .get(`/api/strategic-consultant/journey-status/${sessionId}`);

        if (response.status === 200) {
          researchStatus = response.body;
          
          if (researchStatus?.status === 'completed' || researchStatus?.bmcComplete) {
            completed = true;
          } else if (researchStatus?.status === 'failed') {
            throw new Error(`BMC research failed: ${researchStatus?.error}`);
          } else {
            console.log(`  Polling... ${i + 1}/${maxAttempts} (status: ${researchStatus?.status || 'unknown'})`);
          }
        }
      }

      expect(completed).toBe(true);
      console.log(`✓ BMC research completed`);
    }, TIMEOUT_MS);

    it('should generate EPM with valid workstreams', async () => {
      expect(understandingId).toBeDefined();
      
      const response = await request(API_BASE)
        .post('/api/strategy-workspace/epm/generate')
        .send({
          understandingId,
          userId: testUser.id
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      const data = response.body;

      // Validate EPM structure
      expect(data.workstreams || data.program?.workstreams).toBeDefined();
      const workstreams = data.workstreams || data.program?.workstreams || [];
      expect(Array.isArray(workstreams)).toBe(true);
      expect(workstreams.length).toBeGreaterThan(0);

      // Validate workstream has proper structure (not generic names)
      const firstWorkstream = workstreams[0];
      expect(firstWorkstream.name).toBeDefined();
      expect(firstWorkstream.name.length).toBeGreaterThan(0);
      
      // Should NOT be generic like "Strategic Initiative 1"
      expect(firstWorkstream.name).not.toMatch(/^Strategic Initiative \d+$/i);
      expect(firstWorkstream.name).not.toMatch(/^Initiative \d+$/i);

      // Validate deliverables are NOT research text paragraphs
      if (firstWorkstream.deliverables?.length > 0) {
        const deliverable = firstWorkstream.deliverables[0];
        expect(deliverable.name).toBeDefined();
        expect(deliverable.name.length).toBeLessThan(100); // Not a paragraph
        expect(deliverable.name).not.toMatch(/research reveals|analysis shows|data indicates/i);
      }

      console.log(`✓ EPM generated with ${workstreams.length} workstreams`);
    }, TIMEOUT_MS);
  });

  describe('Marketing Consultant (Segment Discovery)', () => {
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
      
      // Should classify as physical product (B2C mode)
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

      // Poll for completion
      const maxAttempts = 60; // 5 minutes with 5s intervals
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
        // Should have consumer dimensions, not B2B
        const geneKeys = Object.keys(genes);
        const hasB2BDimensions = geneKeys.some(k => 
          ['industry_vertical', 'company_size', 'decision_maker', 'buying_committee'].includes(k)
        );
        
        // For physical_product, should NOT have B2B dimensions
        expect(hasB2BDimensions).toBe(false);
        console.log(`✓ Gene dimensions are consumer-focused: ${geneKeys.slice(0, 3).join(', ')}...`);
      }

      // Validation plan should NOT contain B2B terms
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
});
