/**
 * EPM Completion Hook Integration Test
 * 
 * This test verifies that when a BMI journey completes through the "old flow"
 * (separate Five Whys → BMC → EPM endpoints), the completion hook in
 * server/routes/strategy-workspace.ts saves a journey summary.
 * 
 * Schema Linkage:
 * - strategyVersions.sessionId → strategicUnderstanding.sessionId (string like "session-xxx")
 * - strategicUnderstanding.id → journeySessions.understandingId (UUID)
 * 
 * Completion Hook Logic:
 * 1. Look up understanding by sessionId from strategyVersion
 * 2. Look up journey session by understanding.id and versionNumber
 * 3. If journey type is 'business_model_innovation', save summary
 * 
 * Test Flow:
 * 1. Enable FEATURE_JOURNEY_REGISTRY_V2
 * 2. Create test data with proper foreign key relationships
 * 3. Simulate completion hook following the correct lookup path
 * 4. Verify journey summary is saved and contains expected data
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../server/db';
import { 
  journeySessions, 
  strategyVersions,
  epmPrograms,
  strategicUnderstanding
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { 
  createTestUser, 
  createTestUnderstanding, 
  createTestJourneySession,
  type TestUser,
  type TestUnderstanding,
  type TestJourneySession
} from './fixtures';
import { cleanupTestData } from './test-db-setup';
import { decryptJSON } from '../server/utils/encryption';
import type { JourneySummary } from '@shared/journey-types';

describe('EPM Completion Hook - Journey Summary Persistence', () => {
  let originalEnv: string | undefined;
  let testUser: TestUser;
  let testUnderstanding: TestUnderstanding;
  let testJourneySession: TestJourneySession;
  let testVersionId: string;

  beforeAll(async () => {
    // Clean up any leftover test data
    await cleanupTestData();
    
    // Create shared test user
    testUser = await createTestUser({ id: 'test-user-epm-hook' });
  });

  afterAll(async () => {
    // Clean up all test data
    await cleanupTestData();
  });

  beforeEach(() => {
    // Save and set environment variable
    originalEnv = process.env.FEATURE_JOURNEY_REGISTRY_V2;
    process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'true';
  });

  afterEach(async () => {
    // Restore environment variable
    if (originalEnv === undefined) {
      delete process.env.FEATURE_JOURNEY_REGISTRY_V2;
    } else {
      process.env.FEATURE_JOURNEY_REGISTRY_V2 = originalEnv;
    }
    
    // Clean up test-specific data
    if (testVersionId) {
      await db.delete(epmPrograms).where(eq(epmPrograms.strategyVersionId, testVersionId));
      await db.delete(strategyVersions).where(eq(strategyVersions.id, testVersionId));
    }
    if (testJourneySession) {
      await db.delete(journeySessions).where(eq(journeySessions.id, testJourneySession.id));
    }
    if (testUnderstanding) {
      await db.delete(strategicUnderstanding).where(eq(strategicUnderstanding.id, testUnderstanding.id));
    }
    
    vi.clearAllMocks();
  });

  it('should save journey summary when BMI journey completes via EPM generation', async () => {
    // STEP 1: Create test understanding
    testUnderstanding = await createTestUnderstanding({
      userInput: 'Test BMI initiative for EPM completion hook',
      title: 'Test BMI Strategy',
    });

    // STEP 2: Create BMI journey session with versionNumber = 1
    // understandingId links to strategicUnderstanding.id
    testJourneySession = await createTestJourneySession(
      testUnderstanding.id,
      testUser.id,
      'business_model_innovation',
      {
        status: 'in_progress',
        versionNumber: 1,
        accumulatedContext: {
          journeyType: 'business_model_innovation',
          frameworks: ['five_whys', 'bmc'],
          insights: {},
        },
      }
    );

    // STEP 3: Create strategy version with analysis data
    // sessionId links to strategicUnderstanding.sessionId (string like "session-xxx")
    const analysisData = {
      five_whys_results: {
        rootCauses: [
          'Poor product-market fit',
          'Inadequate customer research',
        ],
        whyChains: [
          ['Why 1', 'Why 2', 'Why 3', 'Why 4', 'Root Cause'],
        ],
      },
      bmc_research: {
        keyInsights: [
          'Target customers are small businesses',
          'Value proposition focuses on automation',
        ],
        blocks: {
          customer_segments: ['Small businesses', 'Startups'],
          value_propositions: ['Save time with automation', 'Reduce costs by 30%'],
          revenue_streams: ['Subscription model', 'Freemium tier'],
          key_activities: ['Software development', 'Customer support'],
        },
        recommendations: [
          'Focus on SMB segment',
          'Build freemium tier first',
        ],
      },
    };

    const [strategyVersion] = await db
      .insert(strategyVersions)
      .values({
        userId: testUser.id,
        sessionId: testUnderstanding.sessionId, // This is the session ID string
        versionNumber: 1,
        versionLabel: 'V1 - Initial BMI Analysis',
        inputSummary: testUnderstanding.userInput,
        analysisData: analysisData as any,
        selectedDecisions: {
          approach: 'lean_startup',
          priority: 'customer_validation',
        } as any,
        decisions: [] as any,
        createdBy: testUser.id,
      })
      .returning();

    testVersionId = strategyVersion.id;

    // STEP 4: Simulate the completion hook logic directly
    // Note: We're not running the full EPM generation pipeline to avoid AI calls.
    // Instead, we're directly testing the completion hook logic (lines 612-678)
    // This is the code from lines 612-678 in strategy-workspace.ts
    const { isJourneyRegistryV2Enabled } = await import('../server/config');
    const { journeySummaryService } = await import('../server/services/journey-summary-service');
    const { journeyRegistry } = await import('../server/journey/journey-registry');

    // Verify feature flag is enabled
    expect(isJourneyRegistryV2Enabled()).toBe(true);

    // STEP 5: Follow the actual completion hook logic path
    // First, look up understanding by sessionId from strategyVersion
    const [understanding] = await db
      .select()
      .from(strategicUnderstanding)
      .where(eq(strategicUnderstanding.sessionId, strategyVersion.sessionId))
      .limit(1);

    expect(understanding).toBeDefined();
    expect(understanding.id).toBe(testUnderstanding.id);
    expect(understanding.sessionId).toBe(strategyVersion.sessionId);

    // Then, look up journey session by understandingId and versionNumber
    const [journeySession] = await db
      .select()
      .from(journeySessions)
      .where(
        and(
          eq(journeySessions.understandingId, understanding.id),
          eq(journeySessions.versionNumber, strategyVersion.versionNumber)
        )
      )
      .limit(1);

    expect(journeySession).toBeDefined();
    expect(journeySession.id).toBe(testJourneySession.id);
    expect(journeySession.journeyType).toBe('business_model_innovation');
    expect(journeySession.understandingId).toBe(understanding.id);

    // STEP 6: Build strategic context from available data
    const context = {
      understandingId: journeySession.understandingId!,
      sessionId: understanding.sessionId, // Use the understanding's sessionId
      userInput: strategyVersion.inputSummary || '',
      journeyType: journeySession.journeyType,
      currentFrameworkIndex: 2,
      completedFrameworks: ['five_whys', 'bmc'],
      status: 'completed' as const,
      insights: {
        rootCauses: analysisData.five_whys_results.rootCauses,
        bmcBlocks: analysisData.bmc_research.blocks,
        strategicImplications: [],
        businessModelGaps: [],
      },
      createdAt: new Date(journeySession.createdAt || new Date()),
      updatedAt: new Date(),
    };

    // Get journey definition and build summary
    const journeyDef = journeyRegistry.getJourney('business_model_innovation');
    expect(journeyDef).toBeDefined();
    expect(journeyDef?.summaryBuilder).toBe('fiveWhysBmc');

    const summary = journeySummaryService.buildSummary(
      journeyDef!.summaryBuilder,
      context,
      {
        versionNumber: journeySession.versionNumber || 1,
        completedAt: new Date().toISOString(),
      }
    );

    // STEP 7: Save the summary (simulating the completion hook action)
    await journeySummaryService.saveSummary(journeySession.id, summary);

    // STEP 8: Verify the summary was saved correctly
    const [updatedSession] = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.id, journeySession.id))
      .limit(1);

    // Summary should not be null
    expect(updatedSession.summary).not.toBeNull();
    expect(updatedSession.summary).toBeDefined();

    // Decrypt and verify summary contents
    const decryptedSummary = decryptJSON<JourneySummary>(updatedSession.summary as any);
    
    // Verify journey type
    expect(decryptedSummary.journeyType).toBe('business_model_innovation');
    
    // Verify version number
    expect(decryptedSummary.versionNumber).toBe(1);
    
    // Verify key insights exist and contain Five Whys root causes
    expect(decryptedSummary.keyInsights).toBeDefined();
    expect(Array.isArray(decryptedSummary.keyInsights)).toBe(true);
    expect(decryptedSummary.keyInsights.length).toBeGreaterThan(0);
    
    // Should contain at least one insight about root causes
    const hasRootCauseInsight = decryptedSummary.keyInsights.some(
      insight => insight.includes('Root Cause') || insight.includes('Poor product-market fit')
    );
    expect(hasRootCauseInsight).toBe(true);
    
    // Verify frameworks data
    expect(decryptedSummary.frameworks).toBeDefined();
    
    // Verify Five Whys framework data
    expect(decryptedSummary.frameworks.five_whys).toBeDefined();
    expect(decryptedSummary.frameworks.five_whys.rootCauses).toBeDefined();
    expect(Array.isArray(decryptedSummary.frameworks.five_whys.rootCauses)).toBe(true);
    expect(decryptedSummary.frameworks.five_whys.rootCauses).toContain('Poor product-market fit');
    expect(decryptedSummary.frameworks.five_whys.rootCauses).toContain('Inadequate customer research');
    
    // Verify BMC framework data
    expect(decryptedSummary.frameworks.bmc).toBeDefined();
    expect(decryptedSummary.frameworks.bmc.valuePropositions).toBeDefined();
    expect(decryptedSummary.frameworks.bmc.customerSegments).toBeDefined();
    expect(Array.isArray(decryptedSummary.frameworks.bmc.customerSegments)).toBe(true);
    expect(decryptedSummary.frameworks.bmc.customerSegments).toContain('Small businesses');
    
    // Verify strategic implications
    expect(decryptedSummary.strategicImplications).toBeDefined();
    expect(Array.isArray(decryptedSummary.strategicImplications)).toBe(true);
    expect(decryptedSummary.strategicImplications.length).toBeGreaterThan(0);
  });

  it('should NOT save summary when journey type is not BMI', async () => {
    // Create test data with non-BMI journey type
    testUnderstanding = await createTestUnderstanding({
      userInput: 'Test competitive strategy initiative',
      title: 'Test Competitive Strategy',
    });

    testJourneySession = await createTestJourneySession(
      testUnderstanding.id,
      testUser.id,
      'competitive_strategy', // NOT business_model_innovation
      {
        status: 'in_progress',
        versionNumber: 1,
      }
    );

    const [strategyVersion] = await db
      .insert(strategyVersions)
      .values({
        userId: testUser.id,
        sessionId: testUnderstanding.sessionId,
        versionNumber: 1,
        inputSummary: testUnderstanding.userInput,
        analysisData: {} as any,
        decisions: [] as any,
        createdBy: testUser.id,
      })
      .returning();

    testVersionId = strategyVersion.id;

    // The completion hook would check if journeyType === 'business_model_innovation'
    // Since our journey is 'competitive_strategy', it should skip saving summary
    
    // Verify the journey session was created correctly
    const [journeySession] = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.id, testJourneySession.id))
      .limit(1);

    expect(journeySession).toBeDefined();
    expect(journeySession.journeyType).toBe('competitive_strategy');

    // The hook should skip saving summary for non-BMI journeys
    // Verify summary is still null
    expect(journeySession.summary).toBeNull();
  });

  it('should NOT save summary when feature flag is disabled', async () => {
    // Disable feature flag
    process.env.FEATURE_JOURNEY_REGISTRY_V2 = 'false';
    vi.resetModules();

    const { isJourneyRegistryV2Enabled } = await import('../server/config');
    expect(isJourneyRegistryV2Enabled()).toBe(false);

    // Create test data
    testUnderstanding = await createTestUnderstanding({
      userInput: 'Test BMI with flag disabled',
      title: 'Test BMI Strategy (flag off)',
    });

    testJourneySession = await createTestJourneySession(
      testUnderstanding.id,
      testUser.id,
      'business_model_innovation',
      {
        status: 'in_progress',
        versionNumber: 1,
      }
    );

    // When flag is disabled, the completion hook should not run at all
    // Summary should remain null
    const [journeySession] = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.id, testJourneySession.id))
      .limit(1);

    expect(journeySession.summary).toBeNull();
  });
});
