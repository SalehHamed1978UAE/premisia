/**
 * Journey Registry V2 Feature Flag Integration Tests
 * 
 * These tests verify that the FEATURE_JOURNEY_REGISTRY_V2 flag correctly gates
 * all new journey registry behavior by ACTUALLY EXECUTING the code paths.
 * 
 * Tests implemented:
 * 1. Config Helper - verifies isJourneyRegistryV2Enabled() returns correct value
 * 2. Orchestrator Integration - creates real data and executes journey orchestrator
 * 3. Readiness Endpoint HTTP - makes real HTTP requests to verify threshold logic
 * 4. Summary Endpoint HTTP - makes real HTTP requests to verify summary behavior
 * 5. Config Endpoint HTTP - makes real HTTP requests to verify feature flag exposure
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { isJourneyRegistryV2Enabled } from '../server/config';
import { JourneyOrchestrator } from '../server/journey/journey-orchestrator';
import { db } from '../server/db';
import { strategicUnderstanding, journeySessions, strategicEntities, references, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import strategicConsultantRoutes from '../server/routes/strategic-consultant';
import type { JourneyType } from '@shared/journey-types';
import { 
  createTestUser, 
  createTestUnderstanding, 
  createTestJourneySession,
  createTestEntity,
  createTestReference,
  type TestUser,
  type TestUnderstanding
} from './fixtures';
import { cleanupTestData } from './test-db-setup';
import { decryptJSON } from '../server/utils/encryption';

describe('Journey Registry V2 Feature Flag Integration Tests', () => {
  let originalEnv: string | undefined;
  let sharedTestUser: TestUser;

  beforeAll(async () => {
    // Clean up any leftover test data from previous runs
    await cleanupTestData();
    
    // Create a shared test user for all tests
    sharedTestUser = await createTestUser({ id: 'test-user-smoke-tests' });
  });

  afterAll(async () => {
    // Clean up all test data
    await cleanupTestData();
  });

  beforeEach(() => {
    // Save original env value
    originalEnv = process.env.FEATURE_JOURNEY_REGISTRY_V2;
  });

  afterEach(() => {
    // Restore original env value
    if (originalEnv === undefined) {
      delete process.env.FEATURE_JOURNEY_REGISTRY_V2;
    } else {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = originalEnv;
    }
    
    // Clear module cache to ensure fresh imports
    vi.resetModules();
  });

  /**
   * TEST CATEGORY 1: Config Helper
   * Verifies that isJourneyRegistryV2Enabled() correctly reads and interprets the env var
   */
  describe('Config Helper', () => {
    it('should return false when flag is not set', async () => {
      delete process.env.FEATURE_JOURNEY_REGISTRY_V2;
      vi.resetModules();
      
      const { isJourneyRegistryV2Enabled } = await import('../server/config');
      expect(isJourneyRegistryV2Enabled()).toBe(false);
    });

    it('should return false when flag is set to "false"', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'false';
      vi.resetModules();
      
      const { isJourneyRegistryV2Enabled } = await import('../server/config');
      expect(isJourneyRegistryV2Enabled()).toBe(false);
    });

    it('should return true when flag is set to "true"', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'true';
      vi.resetModules();
      
      const { isJourneyRegistryV2Enabled } = await import('../server/config');
      expect(isJourneyRegistryV2Enabled()).toBe(true);
    });

    it('should return false for any value other than "true"', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = '1';
      vi.resetModules();
      
      const { isJourneyRegistryV2Enabled } = await import('../server/config');
      expect(isJourneyRegistryV2Enabled()).toBe(false);
    });
  });

  /**
   * TEST CATEGORY 2: Orchestrator Integration Tests
   * Executes the REAL orchestrator completion pipeline with mocked framework executors
   * to verify that the orchestrator respects the flag (not the test)
   */
  describe('Journey Orchestrator Integration', () => {
    let testUnderstanding: TestUnderstanding;
    
    beforeEach(async () => {
      // Create test understanding using fixture
      testUnderstanding = await createTestUnderstanding();
    });

    afterEach(async () => {
      // Clean up test data
      if (testUnderstanding) {
        // Delete journey sessions first (foreign key constraint)
        await db
          .delete(journeySessions)
          .where(eq(journeySessions.understandingId, testUnderstanding.id));
        
        // Delete understanding
        await db
          .delete(strategicUnderstanding)
          .where(eq(strategicUnderstanding.id, testUnderstanding.id));
      }
    });

    it('should NOT load baseline summary when flag is OFF', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'false';
      vi.resetModules();

      const { JourneyOrchestrator } = await import('../server/journey/journey-orchestrator');
      const { journeySummaryService } = await import('../server/services/journey-summary-service');
      const orchestrator = new JourneyOrchestrator();

      // STEP 1: Create a COMPLETED journey session with saved summary
      const firstRun = await orchestrator.startJourney(
        testUnderstanding.id,
        'business_model_innovation' as JourneyType,
        sharedTestUser.id
      );

      const mockSummary = {
        journeyType: 'business_model_innovation' as JourneyType,
        completedAt: new Date().toISOString(),
        versionNumber: 1,
        keyInsights: ['Test insight 1', 'Test insight 2'],
        frameworks: { five_whys: {}, bmc: {} },
        strategicImplications: ['Implication 1', 'Implication 2'],
      };

      await journeySummaryService.saveSummary(firstRun.journeySessionId, mockSummary);
      await db
        .update(journeySessions)
        .set({ status: 'completed' as any })
        .where(eq(journeySessions.id, firstRun.journeySessionId));

      // STEP 2: Call startJourney() for the SAME journey type with flag OFF
      const secondRun = await orchestrator.startJourney(
        testUnderstanding.id,
        'business_model_innovation' as JourneyType,
        sharedTestUser.id
      );

      expect(secondRun.versionNumber).toBe(2);

      // STEP 3: Load and decrypt the new session's context
      const [newSession] = await db
        .select()
        .from(journeySessions)
        .where(eq(journeySessions.id, secondRun.journeySessionId));

      const decryptedContext = decryptJSON(newSession.accumulatedContext as string);

      // STEP 4: Verify context does NOT have baselineSummary (flag is OFF)
      expect(decryptedContext).toBeDefined();
      expect(decryptedContext.baselineSummary).toBeUndefined();
      console.log('[TEST] ✓ Verified baseline summary was NOT loaded when flag is OFF');
    });

    it('should load baseline summary when flag is ON (if previous session exists)', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'true';
      vi.resetModules();

      const { JourneyOrchestrator } = await import('../server/journey/journey-orchestrator');
      const { journeySummaryService } = await import('../server/services/journey-summary-service');
      const orchestrator = new JourneyOrchestrator();

      // STEP 1: Create a COMPLETED journey session with saved summary
      const firstRun = await orchestrator.startJourney(
        testUnderstanding.id,
        'business_model_innovation' as JourneyType,
        sharedTestUser.id
      );

      expect(firstRun.versionNumber).toBe(1);

      const mockSummary = {
        journeyType: 'business_model_innovation' as JourneyType,
        completedAt: new Date().toISOString(),
        versionNumber: 1,
        keyInsights: ['Test insight 1', 'Test insight 2'],
        frameworks: { five_whys: {}, bmc: {} },
        strategicImplications: ['Implication 1', 'Implication 2'],
      };

      await journeySummaryService.saveSummary(firstRun.journeySessionId, mockSummary);
      await db
        .update(journeySessions)
        .set({ status: 'completed' as any })
        .where(eq(journeySessions.id, firstRun.journeySessionId));

      // STEP 2: Call startJourney() for the SAME journey type with flag ON
      const secondRun = await orchestrator.startJourney(
        testUnderstanding.id,
        'business_model_innovation' as JourneyType,
        sharedTestUser.id
      );

      expect(secondRun.versionNumber).toBe(2);

      // STEP 3: Load and decrypt the new session's context
      const [newSession] = await db
        .select()
        .from(journeySessions)
        .where(eq(journeySessions.id, secondRun.journeySessionId));

      const decryptedContext = decryptJSON(newSession.accumulatedContext as string);

      // STEP 4: Verify context DOES have baselineSummary (flag is ON)
      expect(decryptedContext).toBeDefined();
      expect(decryptedContext.baselineSummary).toBeDefined();
      expect(decryptedContext.baselineSummary.versionNumber).toBe(1);
      expect(decryptedContext.baselineSummary.keyInsights).toEqual(['Test insight 1', 'Test insight 2']);
      
      // STEP 5: Verify it was loaded from database
      const latestSummary = await journeySummaryService.getLatestSummary(
        testUnderstanding.id,
        'business_model_innovation' as JourneyType
      );

      expect(latestSummary).toBeDefined();
      expect(latestSummary?.versionNumber).toBe(1);
      console.log('[TEST] ✓ Verified baseline summary was loaded when flag is ON');
    });

    it('should NOT save summary when journey completes with flag OFF', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'false';
      
      // Mock framework executors to return quickly without AI calls
      vi.doMock('../server/journey/framework-executor-registry', () => ({
        frameworkRegistry: {
          execute: vi.fn().mockResolvedValue({
            frameworkName: 'five_whys',
            executedAt: new Date(),
            duration: 100,
            data: {
              rootCauses: ['Test root cause'],
              bmcBlocks: { value_propositions: ['Test VP'] },
            },
          }),
        },
      }));
      
      vi.resetModules();

      const { JourneyOrchestrator } = await import('../server/journey/journey-orchestrator');
      const orchestrator = new JourneyOrchestrator();

      // STEP 1: Start journey
      const result = await orchestrator.startJourney(
        testUnderstanding.id,
        'business_model_innovation' as JourneyType,
        sharedTestUser.id
      );

      // STEP 2: Execute journey to completion (orchestrator handles flag internally)
      await orchestrator.executeJourney(result.journeySessionId);

      // STEP 3: Verify summary was NOT saved (flag is OFF, orchestrator skipped save)
      const [session] = await db
        .select()
        .from(journeySessions)
        .where(eq(journeySessions.id, result.journeySessionId));

      expect(session.summary).toBeNull();
      expect(session.status).toBe('completed');
      
      console.log('[TEST] ✓ Verified summary was NOT saved when flag is OFF');
    });

    it('should save summary when journey completes with flag ON', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'true';
      
      // Mock framework executors to return quickly without AI calls
      vi.doMock('../server/journey/framework-executor-registry', () => ({
        frameworkRegistry: {
          execute: vi.fn().mockResolvedValue({
            frameworkName: 'five_whys',
            executedAt: new Date(),
            duration: 100,
            data: {
              rootCauses: ['Test root cause'],
              bmcBlocks: { value_propositions: ['Test VP'] },
            },
          }),
        },
      }));
      
      vi.resetModules();

      const { JourneyOrchestrator } = await import('../server/journey/journey-orchestrator');
      const orchestrator = new JourneyOrchestrator();

      // STEP 1: Start journey
      const result = await orchestrator.startJourney(
        testUnderstanding.id,
        'business_model_innovation' as JourneyType,
        sharedTestUser.id
      );

      // STEP 2: Execute journey to completion (orchestrator handles flag internally)
      await orchestrator.executeJourney(result.journeySessionId);

      // STEP 3: Verify summary WAS saved (flag is ON, orchestrator saved it)
      const [session] = await db
        .select()
        .from(journeySessions)
        .where(eq(journeySessions.id, result.journeySessionId));

      expect(session.summary).not.toBeNull();
      expect(session.status).toBe('completed');
      
      // Decrypt and verify summary contents
      const decryptedSummary = decryptJSON(session.summary as string);
      expect(decryptedSummary).toBeDefined();
      expect(decryptedSummary.versionNumber).toBe(result.versionNumber);
      expect(decryptedSummary.journeyType).toBe('business_model_innovation');
      expect(decryptedSummary.keyInsights).toBeDefined();
      expect(decryptedSummary.strategicImplications).toBeDefined();
      
      console.log('[TEST] ✓ Verified summary was saved when flag is ON');
    });
  });

  /**
   * TEST CATEGORY 3: Readiness Endpoint HTTP Tests
   * Makes real HTTP requests to verify threshold logic changes based on flag
   */
  describe('Readiness Endpoint HTTP Tests', () => {
    let app: Express;
    let testUnderstanding: TestUnderstanding;

    beforeAll(async () => {
      // Create Express app with routes directly (bypass auth for tests)
      app = express();
      app.use(express.json());
      app.use('/api/strategic-consultant', strategicConsultantRoutes);
    });

    beforeEach(async () => {
      // Create test understanding using fixture
      testUnderstanding = await createTestUnderstanding({
        userInput: 'Test strategic input for readiness check',
      });

      // Create test entities and references using fixtures
      await createTestEntity(testUnderstanding.id, {
        claim: 'Test assumption',
      });

      await createTestReference(testUnderstanding.id, sharedTestUser.id, {
        title: 'Test Reference',
        url: 'https://example.com',
      });
    });

    afterEach(async () => {
      // Clean up test data
      if (testUnderstanding) {
        await db.delete(references).where(eq(references.understandingId, testUnderstanding.id));
        await db.delete(strategicEntities).where(eq(strategicEntities.understandingId, testUnderstanding.id));
        await db.delete(strategicUnderstanding).where(eq(strategicUnderstanding.id, testUnderstanding.id));
      }
    });

    it('should use registry thresholds for BMI journey when flag is ON', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'true';

      const response = await request(app)
        .post('/api/strategic-consultant/journeys/check-readiness')
        .send({
          understandingId: testUnderstanding.id,
          journeyType: 'business_model_innovation',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // With flag ON, BMI journey uses registry default: minReferences: 0, minEntities: 0
      // So it should be ready (we have 1 entity and 1 reference)
      expect(response.body.ready).toBe(true);
      expect(response.body.context.referenceCount).toBe(1);
      expect(response.body.context.entityCount).toBe(1);
    });

    it('should use registry thresholds for market_entry journey when flag is ON', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'true';

      const response = await request(app)
        .post('/api/strategic-consultant/journeys/check-readiness')
        .send({
          understandingId: testUnderstanding.id,
          journeyType: 'market_entry',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // With flag ON, market_entry uses registry default: minReferences: 3, minEntities: 5
      // We only have 1 reference and 1 entity, so should NOT be ready
      expect(response.body.ready).toBe(false);
      expect(response.body.missingRequirements).toBeDefined();
      expect(response.body.missingRequirements.length).toBeGreaterThan(0);
    });

    it('should use legacy thresholds for BMI journey when flag is OFF', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'false';

      const response = await request(app)
        .post('/api/strategic-consultant/journeys/check-readiness')
        .send({
          understandingId: testUnderstanding.id,
          journeyType: 'business_model_innovation',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // With flag OFF, BMI uses hardcoded: minReferences: 0, minEntities: 0
      // So it should be ready (we have 1 entity and 1 reference)
      expect(response.body.ready).toBe(true);
    });

    it('should use legacy default thresholds for market_entry when flag is OFF', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'false';

      const response = await request(app)
        .post('/api/strategic-consultant/journeys/check-readiness')
        .send({
          understandingId: testUnderstanding.id,
          journeyType: 'market_entry',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // With flag OFF, market_entry uses legacy default: minReferences: 3, minEntities: 5
      // We only have 1 reference and 1 entity, so should NOT be ready
      expect(response.body.ready).toBe(false);
      expect(response.body.missingRequirements).toBeDefined();
    });
  });

  /**
   * TEST CATEGORY 4: Summary Endpoint HTTP Tests
   * Makes real HTTP requests to verify summary return behavior
   */
  describe('Summary Endpoint HTTP Tests', () => {
    let app: Express;
    let testUnderstanding: TestUnderstanding;

    beforeAll(async () => {
      // Create Express app with routes directly (bypass auth for tests)
      app = express();
      app.use(express.json());
      app.use('/api/strategic-consultant', strategicConsultantRoutes);
    });

    beforeEach(async () => {
      // Create test understanding using fixture
      testUnderstanding = await createTestUnderstanding({
        userInput: 'Test strategic input for summary endpoint',
      });
    });

    afterEach(async () => {
      // Clean up test data
      if (testUnderstanding) {
        await db.delete(journeySessions).where(eq(journeySessions.understandingId, testUnderstanding.id));
        await db.delete(strategicUnderstanding).where(eq(strategicUnderstanding.id, testUnderstanding.id));
      }
    });

    it('should return null summary when flag is OFF', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'false';

      const response = await request(app)
        .post('/api/strategic-consultant/journeys/summary')
        .send({
          understandingId: testUnderstanding.id,
          journeyType: 'business_model_innovation',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.summary).toBeNull();
    });

    it('should return null summary when flag is ON but no completed journey exists', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'true';

      const response = await request(app)
        .post('/api/strategic-consultant/journeys/summary')
        .send({
          understandingId: testUnderstanding.id,
          journeyType: 'business_model_innovation',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.summary).toBeNull();
    });

    it('should return summary data when flag is ON and completed journey exists', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'true';

      const { journeySummaryService } = await import('../server/services/journey-summary-service');

      // Create a completed journey session using fixture
      const session = await createTestJourneySession(
        testUnderstanding.id,
        sharedTestUser.id,
        'business_model_innovation',
        {
          status: 'completed',
          versionNumber: 1,
        }
      );

      // Save summary
      const mockSummary = {
        journeyType: 'business_model_innovation' as JourneyType,
        completedAt: new Date().toISOString(),
        versionNumber: 1,
        keyInsights: ['Insight 1', 'Insight 2', 'Insight 3'],
        frameworks: { five_whys: {}, bmc: {} },
        strategicImplications: ['Implication 1', 'Implication 2'],
      };

      await journeySummaryService.saveSummary(session.id, mockSummary);

      // Make request
      const response = await request(app)
        .post('/api/strategic-consultant/journeys/summary')
        .send({
          understandingId: testUnderstanding.id,
          journeyType: 'business_model_innovation',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.versionNumber).toBe(1);
      expect(response.body.summary.keyInsights).toBeDefined();
      expect(response.body.summary.strategicImplications).toBeDefined();
    });
  });

  /**
   * TEST CATEGORY 5: Config Endpoint HTTP Tests
   * Makes real HTTP requests to verify feature flag exposure
   */
  describe('Config Endpoint HTTP Tests', () => {
    let app: Express;

    beforeAll(async () => {
      // Create Express app with routes directly (bypass auth for tests)
      app = express();
      app.use(express.json());
      app.use('/api/strategic-consultant', strategicConsultantRoutes);
    });

    it('should return journeyRegistryV2: false when flag is OFF', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'false';

      const response = await request(app)
        .get('/api/strategic-consultant/config/features');

      expect(response.status).toBe(200);
      expect(response.body.journeyRegistryV2).toBe(false);
    });

    it('should return journeyRegistryV2: true when flag is ON', async () => {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'true';

      const response = await request(app)
        .get('/api/strategic-consultant/config/features');

      expect(response.status).toBe(200);
      expect(response.body.journeyRegistryV2).toBe(true);
    });

    it('should return journeyRegistryV2: false when flag is not set', async () => {
      delete process.env.FEATURE_JOURNEY_REGISTRY_V2;

      const response = await request(app)
        .get('/api/strategic-consultant/config/features');

      expect(response.status).toBe(200);
      expect(response.body.journeyRegistryV2).toBe(false);
    });
  });
});
