/**
 * API Health Smoke Tests
 * 
 * Quick endpoint validation tests that verify APIs respond correctly.
 * No AI calls - these should complete in <30 seconds total.
 * 
 * Run with: npm run test:smoke
 */

import { describe, it, expect } from 'vitest';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:5000';

describe('API Health', () => {
  describe('Strategic Consultant Endpoints', () => {
    it('strategic-consultant/understanding accepts POST', async () => {
      const res = await fetch(`${API_BASE}/api/strategic-consultant/understanding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: 'test business challenge' }),
      });
      expect(res.status).toBe(200);
    });

    it('strategic-consultant/versions/:sessionId returns 404 for invalid session', async () => {
      const res = await fetch(`${API_BASE}/api/strategic-consultant/versions/non-existent-session`);
      expect([404, 200]).toContain(res.status); // 404 or empty 200
    });
  });

  describe('Marketing Consultant Endpoints', () => {
    it('marketing-consultant/understanding accepts POST', async () => {
      const res = await fetch(`${API_BASE}/api/marketing-consultant/understanding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          input: 'test product for smoke test',
          userId: 'smoke-test-user'
        }),
      });
      expect([200, 201]).toContain(res.status);
    });

    it('marketing-consultant/discovery-status/:id returns 404 for invalid id', async () => {
      const res = await fetch(`${API_BASE}/api/marketing-consultant/discovery-status/non-existent`);
      expect([404, 200]).toContain(res.status); // 404 or empty 200
    });
  });

  describe('Strategy Workspace Endpoints', () => {
    it('strategy-workspace/versions endpoint responds', async () => {
      const res = await fetch(`${API_BASE}/api/strategy-workspace/versions`);
      // May require auth, so accept 200, 401, or 403
      expect([200, 401, 403]).toContain(res.status);
    });

    it('strategy-workspace/epm/generate returns 400 without strategyVersionId', async () => {
      const res = await fetch(`${API_BASE}/api/strategy-workspace/epm/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect([400, 422]).toContain(res.status);
    });
  });

  describe('Module Registry Endpoints', () => {
    it('module-registry/modules returns list', async () => {
      const res = await fetch(`${API_BASE}/api/module-registry/modules`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.modules)).toBe(true);
    });

    it('module-registry/journeys returns list', async () => {
      const res = await fetch(`${API_BASE}/api/module-registry/journeys`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('module-registry/stats returns stats', async () => {
      const res = await fetch(`${API_BASE}/api/module-registry/stats`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Core API Health', () => {
    it('root endpoint responds', async () => {
      const res = await fetch(`${API_BASE}/`);
      expect(res.status).toBe(200);
    });

    it('health endpoint responds', async () => {
      const res = await fetch(`${API_BASE}/health`);
      expect([200, 404]).toContain(res.status); // May not exist
    });
  });
});
