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

/**
 * SSE Stream Reader - parses Server-Sent Events until completion payload received
 */
async function readSSEUntilComplete(response: Response): Promise<{sessionId: string, strategyVersionId: string}> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body reader available');
  
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) throw new Error('Stream ended without completion event');

    buffer += decoder.decode(value, { stream: true });

    // SSE format: "event: <type>\ndata: <json>\n\n"
    const events = buffer.split('\n\n');
    buffer = events.pop() || ''; // Keep incomplete event in buffer

    for (const event of events) {
      const dataMatch = event.match(/data:\s*(.+)/);
      if (dataMatch) {
        try {
          const data = JSON.parse(dataMatch[1]);
          // Check for completion event with required IDs
          if (data.strategyVersionId && data.sessionId) {
            reader.cancel(); // Clean up
            return { sessionId: data.sessionId, strategyVersionId: data.strategyVersionId };
          }
          // Also check for completion type event
          if (data.type === 'complete' || data.type === 'bmc_complete') {
            if (data.data?.strategyVersionId || data.strategyVersionId) {
              reader.cancel();
              return {
                sessionId: data.data?.sessionId || data.sessionId || '',
                strategyVersionId: data.data?.strategyVersionId || data.strategyVersionId
              };
            }
          }
        } catch { /* Not JSON or incomplete */ }
      }
    }
  }
}

describe('Journey Smoke Tests', () => {
  let testUser: TestUser;

  beforeAll(async () => {
    await cleanupTestData();
    testUser = await createTestUser({ id: 'smoke-test-user-journeys' });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // Strategic Consultant tests run sequentially with shared state
  describe('Strategic Consultant (EPM Generation)', () => {
    let understandingId: string;
    let sessionId: string;
    let strategyVersionId: string;
    const challengeInput = 'Open a premium specialty coffee shop in downtown Dubai targeting young professionals';

    it('should create strategic understanding', async () => {
      // Use correct 'input' field (not userInput/title)
      const response = await request(API_BASE)
        .post('/api/strategic-consultant/understanding')
        .send({ input: challengeInput })
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      const data = response.body;
      expect(data.understandingId).toBeDefined();
      understandingId = data.understandingId;
      console.log(`✓ Strategic understanding created: ${understandingId}`);
    }, TIMEOUT_MS);

    it('should start BMC research and receive SSE stream', async () => {
      expect(understandingId).toBeDefined();
      
      // Use native fetch for SSE stream handling
      const response = await fetch(`${API_BASE}/api/strategic-consultant/bmc-research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          input: challengeInput,
          understandingId 
        })
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      console.log(`✓ BMC research SSE stream started`);

      // Read SSE stream until we get completion payload
      try {
        const result = await readSSEUntilComplete(response);
        sessionId = result.sessionId;
        strategyVersionId = result.strategyVersionId;
        console.log(`✓ BMC research completed - sessionId: ${sessionId}, strategyVersionId: ${strategyVersionId}`);
      } catch (error: any) {
        // If stream reading fails, try polling for status instead
        console.log(`⚠ SSE stream ended, checking status via polling...`);
        
        // Try to get session from understanding
        const statusRes = await request(API_BASE)
          .get(`/api/strategic-consultant/understanding/${understandingId}`);
        
        if (statusRes.body?.sessionId) {
          sessionId = statusRes.body.sessionId;
        }
        if (statusRes.body?.strategyVersionId) {
          strategyVersionId = statusRes.body.strategyVersionId;
        }
      }
    }, TIMEOUT_MS);

    it('should poll for BMC completion if needed', async () => {
      // Skip if we already have strategyVersionId from SSE
      if (strategyVersionId) {
        console.log(`✓ Already have strategyVersionId: ${strategyVersionId}`);
        return;
      }

      expect(understandingId).toBeDefined();
      
      // Poll for completion using journey status endpoint
      const maxAttempts = 60; // 5 minutes with 5s intervals
      let completed = false;

      for (let i = 0; i < maxAttempts && !completed; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Try multiple status endpoints
        const endpoints = [
          `/api/strategic-consultant/journey-status/${sessionId || understandingId}`,
          `/api/strategic-consultant/understanding/${understandingId}`,
          `/api/strategy-workspace/versions?understandingId=${understandingId}`
        ];

        for (const endpoint of endpoints) {
          try {
            const response = await request(API_BASE).get(endpoint);
            
            if (response.status === 200) {
              const data = response.body;
              
              // Check for completed status
              if (data?.status === 'completed' || data?.bmcComplete) {
                completed = true;
                strategyVersionId = data.strategyVersionId || data.latestVersionId;
                sessionId = data.sessionId || sessionId;
                break;
              }
              
              // Check versions array
              if (data?.versions?.length > 0) {
                const latest = data.versions[0];
                if (latest.status === 'completed') {
                  completed = true;
                  strategyVersionId = latest.id;
                  break;
                }
              }
            }
          } catch { /* Try next endpoint */ }
        }

        if (!completed) {
          console.log(`  Polling... ${i + 1}/${maxAttempts}`);
        }
      }

      expect(completed || strategyVersionId).toBeTruthy();
      console.log(`✓ BMC research completed - strategyVersionId: ${strategyVersionId}`);
    }, TIMEOUT_MS);

    it('should generate EPM with valid workstreams', async () => {
      expect(strategyVersionId).toBeDefined();
      
      const response = await request(API_BASE)
        .post('/api/strategy-workspace/epm/generate')
        .send({ strategyVersionId })
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      const data = response.body;

      // EPM generation returns progressId for SSE streaming
      if (data.progressId) {
        console.log(`✓ EPM generation started with progressId: ${data.progressId}`);
        
        // Poll for EPM completion
        const maxAttempts = 60;
        let epmData: any = null;
        
        for (let i = 0; i < maxAttempts && !epmData; i++) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const epmRes = await request(API_BASE)
            .get(`/api/strategy-workspace/epm/${strategyVersionId}`);
          
          if (epmRes.status === 200 && epmRes.body?.workstreams?.length > 0) {
            epmData = epmRes.body;
          } else {
            console.log(`  EPM polling... ${i + 1}/${maxAttempts}`);
          }
        }
        
        expect(epmData).toBeDefined();
        validateEPMWorkstreams(epmData);
      } else if (data.workstreams || data.program?.workstreams) {
        // Direct response with workstreams
        validateEPMWorkstreams(data);
      }
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

/**
 * Helper to validate EPM workstreams meet quality standards
 */
function validateEPMWorkstreams(data: any) {
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

  console.log(`✓ EPM validated with ${workstreams.length} workstreams`);
}
