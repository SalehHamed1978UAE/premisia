/**
 * Strategic Consultant Integration Tests
 * 
 * Full end-to-end tests for Strategic Consultant journeys.
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
            reader.cancel();
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

describe('Strategic Consultant Integration', () => {
  let testUser: TestUser;
  const TEST_USER_ID = 'integration-test-strategic';

  beforeAll(async () => {
    await cleanupTestData();
    testUser = await createTestUser({ id: TEST_USER_ID });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // Using describe.sequential ensures tests run in order (Vitest 1.0+)
  describe.sequential('EPM Generation Flow', () => {
    let understandingId: string;
    let sessionId: string;
    let strategyVersionId: string;
    const challengeInput = 'Open a premium specialty coffee shop in downtown Dubai targeting young professionals';

    it('should create strategic understanding', async () => {
      const response = await request(API_BASE)
        .post('/api/strategic-consultant/understanding')
        .send({ input: challengeInput })
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      const data = response.body;
      expect(data.understandingId).toBeDefined();
      expect(data.sessionId).toBeDefined();
      understandingId = data.understandingId;
      sessionId = data.sessionId;
      console.log(`✓ Strategic understanding created: ${understandingId}, sessionId: ${sessionId}`);
    }, TIMEOUT_MS);

    it('should start BMC research and receive SSE stream', async () => {
      expect(understandingId).toBeDefined();
      expect(sessionId).toBeDefined();
      
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

      try {
        const result = await readSSEUntilComplete(response);
        if (result.strategyVersionId) {
          strategyVersionId = result.strategyVersionId;
        }
        console.log(`✓ BMC research completed via SSE - strategyVersionId: ${strategyVersionId}`);
      } catch (error: any) {
        console.log(`⚠ SSE stream ended without completion event, will poll for status...`);
      }
    }, TIMEOUT_MS);

    it('should poll for BMC completion via /versions/:sessionId', async () => {
      expect(sessionId).toBeDefined();
      
      if (strategyVersionId) {
        console.log(`✓ Already have strategyVersionId from SSE: ${strategyVersionId}`);
        return;
      }

      const maxAttempts = 60;
      let completed = false;

      for (let i = 0; i < maxAttempts && !completed; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const response = await request(API_BASE)
          .get(`/api/strategic-consultant/versions/${sessionId}`);
        
        if (response.status === 200 && response.body?.versions?.length > 0) {
          const versions = response.body.versions;
          const completedVersion = versions.find((v: any) => v.status === 'completed' || v.status === 'finalized');
          
          if (completedVersion) {
            completed = true;
            strategyVersionId = completedVersion.id || `${sessionId}:${completedVersion.versionNumber}`;
            console.log(`✓ BMC completed - found version: ${JSON.stringify(completedVersion).slice(0, 100)}`);
            break;
          }
        }

        console.log(`  Polling /versions/${sessionId}... ${i + 1}/${maxAttempts}`);
      }

      expect(completed).toBe(true);
      expect(strategyVersionId).toBeDefined();
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

      if (data.progressId) {
        console.log(`✓ EPM generation started with progressId: ${data.progressId}`);
        
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
        validateEPMWorkstreams(data);
      }
    }, TIMEOUT_MS);
  });
});

function validateEPMWorkstreams(data: any) {
  const workstreams = data.workstreams || data.program?.workstreams || [];
  expect(Array.isArray(workstreams)).toBe(true);
  expect(workstreams.length).toBeGreaterThan(0);

  const firstWorkstream = workstreams[0];
  expect(firstWorkstream.name).toBeDefined();
  expect(firstWorkstream.name.length).toBeGreaterThan(0);
  
  expect(firstWorkstream.name).not.toMatch(/^Strategic Initiative \d+$/i);
  expect(firstWorkstream.name).not.toMatch(/^Initiative \d+$/i);

  if (firstWorkstream.deliverables?.length > 0) {
    const deliverable = firstWorkstream.deliverables[0];
    expect(deliverable.name).toBeDefined();
    expect(deliverable.name.length).toBeLessThan(100);
    expect(deliverable.name).not.toMatch(/research reveals|analysis shows|data indicates/i);
  }

  console.log(`✓ EPM validated with ${workstreams.length} workstreams`);
}
