/**
 * Module Registry Smoke Tests
 *
 * Verify module registry is populated and accessible via HTTP API.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:5000';

describe('Module Registry API Smoke Tests', () => {

  describe('Modules Endpoint', () => {
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

    it('should have required module properties', async () => {
      const response = await request(API_BASE)
        .get('/api/module-registry/modules');

      if (response.body.modules?.length > 0) {
        const firstModule = response.body.modules[0];
        expect(firstModule.id).toBeDefined();
        expect(firstModule.name).toBeDefined();
        expect(firstModule.type).toBeDefined();

        console.log(`✓ Module structure valid: ${firstModule.name} (${firstModule.type})`);
      }
    });

    it('should have analyzer modules', async () => {
      const response = await request(API_BASE)
        .get('/api/module-registry/modules');

      const modules = response.body.modules || [];
      const analyzers = modules.filter((m: any) => m.type === 'analyzer');
      
      console.log(`✓ Found ${analyzers.length} analyzer modules`);
      expect(analyzers.length).toBeGreaterThan(0);
    });
  });

  describe('Journeys Endpoint', () => {
    it('should list journey configs', async () => {
      const response = await request(API_BASE)
        .get('/api/module-registry/journeys')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.journeys).toBeDefined();
      expect(Array.isArray(response.body.journeys)).toBe(true);

      console.log(`✓ Found ${response.body.journeys.length} journey configs`);
    });

    it('should resolve individual journey by ID', async () => {
      // First get list of journeys
      const listResponse = await request(API_BASE)
        .get('/api/module-registry/journeys');

      const journeys = listResponse.body.journeys || [];
      
      if (journeys.length > 0) {
        const journeyId = journeys[0].id;
        
        const response = await request(API_BASE)
          .get(`/api/module-registry/journeys/${journeyId}`)
          .expect('Content-Type', /json/);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.journey).toBeDefined();
        expect(response.body.journey.id).toBe(journeyId);

        console.log(`✓ Journey resolved: ${journeyId}`);
      }
    });
  });

  describe('Stats Endpoint', () => {
    it('should return registry statistics', async () => {
      const response = await request(API_BASE)
        .get('/api/module-registry/stats')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      console.log(`✓ Registry stats: ${JSON.stringify(response.body).substring(0, 100)}...`);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent module', async () => {
      const response = await request(API_BASE)
        .get('/api/module-registry/modules/non-existent-module-xyz');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent journey', async () => {
      const response = await request(API_BASE)
        .get('/api/module-registry/journeys/non-existent-journey-xyz');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
