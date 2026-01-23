/**
 * Repository Smoke Tests
 *
 * Verify that repositories are registered in the container and can perform basic operations.
 * These tests ensure the DI container is correctly configured and repositories can query data.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { container, registerServices } from '../../server/services/container';
import { ServiceKeys } from '../../server/types/interfaces';

describe('Repository Smoke Tests', () => {

  beforeAll(() => {
    // Ensure services are registered
    try {
      registerServices();
    } catch (e) {
      // Services might already be registered
    }
  });

  describe('Service Container', () => {
    it('should have container available', () => {
      expect(container).toBeDefined();
      expect(typeof container.has).toBe('function');
      expect(typeof container.resolve).toBe('function');
    });
  });

  describe('EPM Repository', () => {
    it('should be registered in container', () => {
      expect(container.has(ServiceKeys.EPM_REPOSITORY)).toBe(true);
    });

    it('should resolve without error', () => {
      const repo = container.resolve(ServiceKeys.EPM_REPOSITORY);
      expect(repo).toBeDefined();
      console.log(`✓ EPM Repository resolved`);
    });

    it('should perform findAll query without error', async () => {
      const repo = container.resolve<any>(ServiceKeys.EPM_REPOSITORY);
      expect(typeof repo.findAll).toBe('function');
      
      const results = await repo.findAll({ limit: 5 });
      expect(Array.isArray(results)).toBe(true);
      console.log(`✓ EPM Repository findAll returned ${results.length} records`);
    });
  });

  describe('Journey Repository', () => {
    it('should be registered in container', () => {
      expect(container.has(ServiceKeys.JOURNEY_REPOSITORY)).toBe(true);
    });

    it('should resolve without error', () => {
      const repo = container.resolve(ServiceKeys.JOURNEY_REPOSITORY);
      expect(repo).toBeDefined();
      console.log(`✓ Journey Repository resolved`);
    });

    it('should perform findAll query without error', async () => {
      const repo = container.resolve<any>(ServiceKeys.JOURNEY_REPOSITORY);
      expect(typeof repo.findAll).toBe('function');
      
      const results = await repo.findAll({ limit: 5 });
      expect(Array.isArray(results)).toBe(true);
      console.log(`✓ Journey Repository findAll returned ${results.length} records`);
    });
  });

  describe('Strategy Repository', () => {
    it('should be registered in container', () => {
      expect(container.has(ServiceKeys.STRATEGY_REPOSITORY)).toBe(true);
    });

    it('should resolve without error', () => {
      const repo = container.resolve(ServiceKeys.STRATEGY_REPOSITORY);
      expect(repo).toBeDefined();
      console.log(`✓ Strategy Repository resolved`);
    });

    it('should perform findAll query without error', async () => {
      const repo = container.resolve<any>(ServiceKeys.STRATEGY_REPOSITORY);
      expect(typeof repo.findAll).toBe('function');
      
      const results = await repo.findAll({ limit: 5 });
      expect(Array.isArray(results)).toBe(true);
      console.log(`✓ Strategy Repository findAll returned ${results.length} records`);
    });
  });

  describe('EPM Components', () => {
    it('should have EPM Synthesizer registered', () => {
      expect(container.has(ServiceKeys.EPM_SYNTHESIZER)).toBe(true);
    });

    it('should have Workstream Generator registered', () => {
      expect(container.has(ServiceKeys.WORKSTREAM_GENERATOR)).toBe(true);
    });

    it('should have Timeline Calculator registered', () => {
      expect(container.has(ServiceKeys.TIMELINE_CALCULATOR)).toBe(true);
    });

    it('should have Resource Allocator registered', () => {
      expect(container.has(ServiceKeys.RESOURCE_ALLOCATOR)).toBe(true);
    });

    it('should have EPM Validator registered', () => {
      expect(container.has(ServiceKeys.EPM_VALIDATOR)).toBe(true);
    });
  });

  describe('Export Services', () => {
    it('should have all exporters registered', () => {
      expect(container.has(ServiceKeys.MARKDOWN_EXPORTER)).toBe(true);
      expect(container.has(ServiceKeys.HTML_EXPORTER)).toBe(true);
      expect(container.has(ServiceKeys.PDF_EXPORTER)).toBe(true);
      expect(container.has(ServiceKeys.DOCX_EXPORTER)).toBe(true);
      expect(container.has(ServiceKeys.CSV_EXPORTER)).toBe(true);
      console.log(`✓ All 5 exporters registered`);
    });

    it('should have export orchestrator registered', () => {
      expect(container.has(ServiceKeys.EXPORT_ORCHESTRATOR)).toBe(true);
    });
  });
});
