/**
 * BMC Knowledge Endpoint Security Tests
 * 
 * Verifies that the /api/strategic-consultant/bmc-knowledge/:programId endpoint
 * correctly filters contradictions by understanding ID to prevent cross-user data leakage.
 * 
 * Critical Security Requirement:
 * - User A's contradictions must NEVER appear in User B's responses
 * - Contradictions query must filter by entity IDs belonging to current understanding
 * 
 * Test Coverage:
 * 1. User can access their own BMC knowledge data
 * 2. User cannot access another user's BMC knowledge (404)
 * 3. Contradictions are properly filtered by understanding/entity scope
 * 4. No cross-user data leakage in contradictions (regression test for filtered query bug)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { db } from '../server/db';
import { eq } from 'drizzle-orm';
import {
  strategicUnderstanding,
  journeySessions,
  strategyVersions,
  epmPrograms,
  strategicEntities,
  strategicRelationships,
  bmcAnalyses
} from '@shared/schema';
import strategicConsultantRoutes from '../server/routes/strategic-consultant';
import { createTestUser, type TestUser } from './fixtures';
import { cleanupTestData } from './test-db-setup';
import {
  saveStrategicUnderstanding,
  saveJourneySession,
  saveStrategyVersion,
  saveEPMProgram,
  saveStrategicEntity,
  saveStrategicRelationship
} from '../server/services/secure-data-service';

describe('BMC Knowledge Endpoint Security', () => {
  let app: Express;
  let userA: TestUser;
  let userB: TestUser;
  let programAId: string;
  let programBId: string;
  let understandingAId: string;
  let understandingBId: string;
  let entityA1Id: string;
  let entityA2Id: string;
  let entityB1Id: string;
  let entityB2Id: string;

  beforeAll(async () => {
    // Setup Express app with routes
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware for testing
    app.use((req: any, res, next) => {
      const testUserId = req.headers['x-test-user-id'];
      if (testUserId) {
        req.user = {
          claims: { sub: testUserId }
        };
      }
      next();
    });
    
    app.use('/api/strategic-consultant', strategicConsultantRoutes);

    // Clean up any leftover test data
    await cleanupTestData();

    // Create two test users with dynamic IDs to avoid collisions
    const timestamp = Date.now();
    userA = await createTestUser({ id: `security-test-user-a-${timestamp}` });
    userB = await createTestUser({ id: `security-test-user-b-${timestamp}` });

    // ========== USER A DATA ==========
    // Create strategic understanding for User A with temporary sessionId
    const tempSessionIdA = `temp-session-a-${timestamp}`;
    const understandingA = await saveStrategicUnderstanding({
      sessionId: tempSessionIdA,
      userInput: 'User A strategic input: Launch product in growing market',
      title: 'User A Strategy',
    });
    understandingAId = understandingA.id!;

    // Create journey session for User A
    const sessionA = await saveJourneySession({
      userId: userA.id,
      understandingId: understandingAId,
      journeyType: 'business_model_innovation',
      status: 'completed',
      versionNumber: 1,
      accumulatedContext: { userA: 'context' }
    });

    // Update understanding to use journey session ID (so endpoint can find it)
    await db.update(strategicUnderstanding)
      .set({ sessionId: sessionA.id! })
      .where(eq(strategicUnderstanding.id, understandingAId));

    // Create strategy version for User A
    const versionA = await saveStrategyVersion({
      userId: userA.id,
      sessionId: sessionA.id!,
      versionNumber: 1,
      inputSummary: 'User A wants to launch in market',
      analysisData: { frameworks: [] },
      decisionsData: { decision: 'go' },
      status: 'draft',
      createdBy: userA.id,
    });

    // Create EPM program for User A
    const programA = await saveEPMProgram({
      userId: userA.id,
      sessionId: sessionA.id!,
      strategyVersionId: versionA.id!,
      frameworkType: 'business_model_innovation',
      programName: 'User A Program',
      executiveSummary: 'User A confidential summary',
      workstreams: [],
      timeline: {},
      resourcePlan: {},
      financialPlan: {},
      benefitsRealization: {},
      riskRegister: [],
      stageGates: [],
      stakeholderMap: {},
      governance: {},
      qaPlan: {},
      procurement: {},
      exitStrategy: {},
      kpis: [],
      componentConfidence: {},
      overallConfidence: 0.8,
      editTracking: {},
    });
    programAId = programA.id!;

    // Create entities for User A
    const entityA1 = await saveStrategicEntity({
      understandingId: understandingAId,
      type: 'explicit_assumption',
      claim: 'User A Assumption: Market will grow 50% annually',
      source: 'User A input document',
      evidence: 'User provided growth estimate',
      confidence: 'high',
      category: 'Market Growth',
      discoveredBy: 'user_input',
    });
    entityA1Id = entityA1.id!;

    const entityA2 = await saveStrategicEntity({
      understandingId: understandingAId,
      type: 'research_finding',
      claim: 'User A Research: Market is actually declining at 10% per year',
      source: 'BMC Agent market research',
      evidence: 'Industry reports show contraction',
      confidence: 'high',
      category: 'Market Growth',
      discoveredBy: 'bmc_agent',
    });
    entityA2Id = entityA2.id!;

    // Create contradiction for User A
    await saveStrategicRelationship({
      fromEntityId: entityA1Id,
      toEntityId: entityA2Id,
      relationshipType: 'contradicts',
      discoveredBy: 'bmc_agent',
      evidence: 'User A specific evidence: Industry data contradicts growth assumption',
    });

    // Create BMC analysis with critical gaps for User A
    await db.insert(bmcAnalyses).values({
      strategyVersionId: versionA.id!,
      viability: 'moderate',
      criticalGaps: ['User A Gap: Missing customer demographics data'],
    });

    // ========== USER B DATA ==========
    // Create strategic understanding for User B with temporary sessionId
    const tempSessionIdB = `temp-session-b-${timestamp}`;
    const understandingB = await saveStrategicUnderstanding({
      sessionId: tempSessionIdB,
      userInput: 'User B strategic input: Different product different market',
      title: 'User B Strategy',
    });
    understandingBId = understandingB.id!;

    // Create journey session for User B
    const sessionB = await saveJourneySession({
      userId: userB.id,
      understandingId: understandingBId,
      journeyType: 'business_model_innovation',
      status: 'completed',
      versionNumber: 1,
      accumulatedContext: { userB: 'context' }
    });

    // Update understanding to use journey session ID (so endpoint can find it)
    await db.update(strategicUnderstanding)
      .set({ sessionId: sessionB.id! })
      .where(eq(strategicUnderstanding.id, understandingBId));

    // Create strategy version for User B
    const versionB = await saveStrategyVersion({
      userId: userB.id,
      sessionId: sessionB.id!,
      versionNumber: 1,
      inputSummary: 'User B different approach',
      analysisData: { frameworks: [] },
      decisionsData: { decision: 'pause' },
      status: 'draft',
      createdBy: userB.id,
    });

    // Create EPM program for User B
    const programB = await saveEPMProgram({
      userId: userB.id,
      sessionId: sessionB.id!,
      strategyVersionId: versionB.id!,
      frameworkType: 'business_model_innovation',
      programName: 'User B Program',
      executiveSummary: 'User B summary',
      workstreams: [],
      timeline: {},
      resourcePlan: {},
      financialPlan: {},
      benefitsRealization: {},
      riskRegister: [],
      stageGates: [],
      stakeholderMap: {},
      governance: {},
      qaPlan: {},
      procurement: {},
      exitStrategy: {},
      kpis: [],
      componentConfidence: {},
      overallConfidence: 0.7,
      editTracking: {},
    });
    programBId = programB.id!;

    // Create entities for User B (different understanding)
    const entityB1 = await saveStrategicEntity({
      understandingId: understandingBId,
      type: 'explicit_assumption',
      claim: 'User B Assumption: Different market dynamics apply',
      source: 'User B analysis',
      evidence: 'User B evidence',
      confidence: 'medium',
      category: 'Market',
      discoveredBy: 'user_input',
    });
    entityB1Id = entityB1.id!;

    const entityB2 = await saveStrategicEntity({
      understandingId: understandingBId,
      type: 'research_finding',
      claim: 'User B Research: Different finding contradicts assumption',
      source: 'BMC Agent research for User B',
      evidence: 'User B specific research evidence',
      confidence: 'high',
      category: 'Market',
      discoveredBy: 'bmc_agent',
    });
    entityB2Id = entityB2.id!;

    // Create contradiction for User B (different understanding)
    await saveStrategicRelationship({
      fromEntityId: entityB1Id,
      toEntityId: entityB2Id,
      relationshipType: 'contradicts',
      discoveredBy: 'bmc_agent',
      evidence: 'User B evidence: Different market data shows contradiction',
    });

    // Create BMC analysis for User B
    await db.insert(bmcAnalyses).values({
      strategyVersionId: versionB.id!,
      viability: 'weak',
      criticalGaps: ['User B Gap: Missing value metrics'],
    });
  }, 30000);

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Authorization and Access Control', () => {
    it('should allow user to access their own BMC knowledge data', async () => {
      const response = await request(app)
        .get(`/api/strategic-consultant/bmc-knowledge/${programAId}`)
        .set('x-test-user-id', userA.id)
        .expect(200);

      expect(response.body).toHaveProperty('userAssumptions');
      expect(response.body).toHaveProperty('researchFindings');
      expect(response.body).toHaveProperty('contradictions');
      expect(response.body).toHaveProperty('criticalGaps');

      // Verify User A can see their own data
      expect(response.body.userAssumptions.length).toBeGreaterThan(0);
      expect(response.body.researchFindings.length).toBeGreaterThan(0);
      expect(response.body.contradictions.length).toBeGreaterThan(0);
      expect(response.body.criticalGaps.length).toBeGreaterThan(0);
    });

    it('should return 404 when user tries to access another users program', async () => {
      // User B tries to access User A's program
      await request(app)
        .get(`/api/strategic-consultant/bmc-knowledge/${programAId}`)
        .set('x-test-user-id', userB.id)
        .expect(404);
    });

    it('should return 401 when no authentication is provided', async () => {
      await request(app)
        .get(`/api/strategic-consultant/bmc-knowledge/${programAId}`)
        .expect(401);
    });
  });

  describe('Cross-User Data Leakage Prevention (REGRESSION TEST)', () => {
    it('should NOT leak User A contradictions to User B (plaintext check)', async () => {
      // User B accesses their own program
      const response = await request(app)
        .get(`/api/strategic-consultant/bmc-knowledge/${programBId}`)
        .set('x-test-user-id', userB.id)
        .expect(200);

      const { contradictions, userAssumptions, researchFindings } = response.body;

      // Verify User B's data is properly decrypted (not showing encrypted JSON)
      if (userAssumptions.length > 0) {
        expect(userAssumptions[0].claim).not.toContain('dataKeyCiphertext');
        expect(typeof userAssumptions[0].claim).toBe('string');
      }

      // Check that NO User A data appears anywhere in the response
      const allClaims = [
        ...userAssumptions.map((e: any) => e.claim),
        ...researchFindings.map((e: any) => e.claim),
      ];

      for (const claim of allClaims) {
        // User A specific text should NEVER appear
        expect(claim).not.toContain('User A');
        expect(claim).not.toContain('Market will grow 50%');
        expect(claim).not.toContain('declining at 10%');
      }

      // Check contradictions
      for (const contradiction of contradictions) {
        const userClaim = contradiction.userClaim?.claim || '';
        const researchClaim = contradiction.researchClaim?.claim || '';
        const evidence = contradiction.evidence || '';

        // User A data should NEVER leak into User B's contradictions
        expect(userClaim).not.toContain('User A');
        expect(researchClaim).not.toContain('User A');
        expect(evidence).not.toContain('User A specific evidence');
        expect(evidence).not.toContain('Industry data contradicts');
      }
    });

    it('should filter contradictions by entity IDs from current understanding (ID check)', async () => {
      // Get User A's contradictions
      const responseA = await request(app)
        .get(`/api/strategic-consultant/bmc-knowledge/${programAId}`)
        .set('x-test-user-id', userA.id)
        .expect(200);

      const { contradictions: contradictionsA } = responseA.body;

      // Verify User A has contradictions
      expect(contradictionsA.length).toBeGreaterThan(0);

      // Get all entity IDs for User A's understanding
      const entitiesA = await db
        .select()
        .from(strategicEntities)
        .where(eq(strategicEntities.understandingId, understandingAId));
      
      const entityAIds = new Set(entitiesA.map(e => e.id));

      // Critical assertion: ALL entity IDs in contradictions must belong to User A
      for (const contradiction of contradictionsA) {
        const userClaimId = contradiction.userClaim?.id;
        const researchClaimId = contradiction.researchClaim?.id;

        expect(userClaimId).toBeDefined();
        expect(researchClaimId).toBeDefined();

        // Both entities MUST be in User A's entity set
        expect(entityAIds.has(userClaimId)).toBe(true);
        expect(entityAIds.has(researchClaimId)).toBe(true);

        // Neither should be User B's entities
        expect(userClaimId).not.toBe(entityB1Id);
        expect(userClaimId).not.toBe(entityB2Id);
        expect(researchClaimId).not.toBe(entityB1Id);
        expect(researchClaimId).not.toBe(entityB2Id);
      }
    });

    it('should NOT expose entity IDs from other understandings', async () => {
      // Get User B's entity IDs
      const entitiesB = await db
        .select()
        .from(strategicEntities)
        .where(eq(strategicEntities.understandingId, understandingBId));
      
      const entityBIds = new Set(entitiesB.map(e => e.id));

      // User A should not see any of User B's entity IDs
      const responseA = await request(app)
        .get(`/api/strategic-consultant/bmc-knowledge/${programAId}`)
        .set('x-test-user-id', userA.id)
        .expect(200);

      const { userAssumptions, researchFindings, contradictions } = responseA.body;

      // Check all returned entity IDs
      const allReturnedEntityIds = [
        ...userAssumptions.map((e: any) => e.id),
        ...researchFindings.map((e: any) => e.id),
      ];

      // None of User A's entities should match User B's IDs
      for (const entityId of allReturnedEntityIds) {
        expect(entityBIds.has(entityId)).toBe(false);
      }

      // Check contradiction entity IDs
      for (const contradiction of contradictions) {
        if (contradiction.userClaim?.id) {
          expect(entityBIds.has(contradiction.userClaim.id)).toBe(false);
        }
        if (contradiction.researchClaim?.id) {
          expect(entityBIds.has(contradiction.researchClaim.id)).toBe(false);
        }
      }
    });

    it('should handle critical gaps filtering correctly', async () => {
      const responseA = await request(app)
        .get(`/api/strategic-consultant/bmc-knowledge/${programAId}`)
        .set('x-test-user-id', userA.id)
        .expect(200);

      const { criticalGaps } = responseA.body;

      // User A should see their own gaps
      expect(criticalGaps).toContain('User A Gap: Missing customer demographics data');
      
      // Should NOT see User B's gaps
      expect(criticalGaps).not.toContain('User B Gap');
    });
  });

  describe('Data Integrity', () => {
    it('should return empty arrays when program has no BMC data', async () => {
      // Create a program without BMC data
      const tempEmptySessionId = `temp-session-empty-${Date.now()}`;
      const emptyUnderstanding = await saveStrategicUnderstanding({
        sessionId: tempEmptySessionId,
        userInput: 'Empty strategic input',
        title: 'Empty Strategy',
      });

      const emptySession = await saveJourneySession({
        userId: userA.id,
        understandingId: emptyUnderstanding.id!,
        journeyType: 'business_model_innovation',
        status: 'completed',
        versionNumber: 1,
        accumulatedContext: {},
      });

      // Update understanding to use journey session ID
      await db.update(strategicUnderstanding)
        .set({ sessionId: emptySession.id! })
        .where(eq(strategicUnderstanding.id, emptyUnderstanding.id!));

      const emptyVersion = await saveStrategyVersion({
        userId: userA.id,
        sessionId: emptySession.id!,
        versionNumber: 1,
        inputSummary: 'Empty',
        analysisData: {},
        decisionsData: {},
        status: 'draft',
        createdBy: userA.id,
      });

      const emptyProgram = await saveEPMProgram({
        userId: userA.id,
        sessionId: emptySession.id!,
        strategyVersionId: emptyVersion.id!,
        frameworkType: 'five_whys',
        programName: 'Empty Program',
        executiveSummary: 'Empty',
        workstreams: [],
        timeline: {},
        resourcePlan: {},
        financialPlan: {},
        benefitsRealization: {},
        riskRegister: [],
        stageGates: [],
        stakeholderMap: {},
        governance: {},
        qaPlan: {},
        procurement: {},
        exitStrategy: {},
        kpis: [],
        componentConfidence: {},
        overallConfidence: 0.5,
        editTracking: {},
      });

      const response = await request(app)
        .get(`/api/strategic-consultant/bmc-knowledge/${emptyProgram.id}`)
        .set('x-test-user-id', userA.id)
        .expect(200);

      expect(response.body.userAssumptions).toEqual([]);
      expect(response.body.researchFindings).toEqual([]);
      expect(response.body.contradictions).toEqual([]);
      expect(response.body.criticalGaps).toEqual([]);
    });

    it('should decrypt all entity fields correctly', async () => {
      const response = await request(app)
        .get(`/api/strategic-consultant/bmc-knowledge/${programAId}`)
        .set('x-test-user-id', userA.id)
        .expect(200);

      const { userAssumptions, researchFindings } = response.body;

      // Verify decrypted fields are readable strings (not encrypted JSON)
      for (const entity of [...userAssumptions, ...researchFindings]) {
        expect(typeof entity.claim).toBe('string');
        expect(entity.claim).not.toContain('dataKeyCiphertext');
        expect(entity.claim).not.toContain('ciphertext');
        expect(entity.claim.length).toBeGreaterThan(0);
        
        expect(typeof entity.source).toBe('string');
        expect(entity.source).not.toContain('dataKeyCiphertext');
      }
    });
  });

  describe('Multi-Program Ownership Edge Cases (CRITICAL REGRESSION PREVENTION)', () => {
    it('should isolate contradictions when same user owns multiple programs with different understandings', async () => {
      // SCENARIO: User A creates a second program with different strategic understanding
      // This tests the critical edge case where shared strategyVersionId could leak data
      
      // Create second understanding for User A
      const tempSessionId2 = `temp-session-a2-${Date.now()}`;
      const understanding2 = await saveStrategicUnderstanding({
        sessionId: tempSessionId2,
        userInput: 'User A second strategic input: Different initiative',
        title: 'User A Strategy #2',
      });

      const session2 = await saveJourneySession({
        userId: userA.id,
        understandingId: understanding2.id!,
        journeyType: 'digital_transformation',
        status: 'completed',
        versionNumber: 1,
        accumulatedContext: { second: 'initiative' },
      });

      await db.update(strategicUnderstanding)
        .set({ sessionId: session2.id! })
        .where(eq(strategicUnderstanding.id, understanding2.id!));

      // Create entities for second understanding
      const entity2A = await saveStrategicEntity({
        understandingId: understanding2.id!,
        type: 'explicit_assumption',
        claim: 'Second Initiative Assumption: Cloud migration will cost $100k',
        source: 'User A second initiative',
        evidence: 'Budget estimate',
        confidence: 'medium',
        category: 'Cost',
        discoveredBy: 'user_input',
      });

      const entity2B = await saveStrategicEntity({
        understandingId: understanding2.id!,
        type: 'research_finding',
        claim: 'Second Initiative Research: Actual cost is $500k',
        source: 'Market research',
        evidence: 'Vendor quotes',
        confidence: 'high',
        category: 'Cost',
        discoveredBy: 'bmc_agent',
      });

      // Create contradiction in second understanding
      await saveStrategicRelationship({
        fromEntityId: entity2A.id!,
        toEntityId: entity2B.id!,
        relationshipType: 'contradicts',
        discoveredBy: 'bmc_agent',
        evidence: 'Second initiative: Budget drastically underestimated',
      });

      // Create version and program for second initiative
      const version2 = await saveStrategyVersion({
        userId: userA.id,
        sessionId: session2.id!,
        versionNumber: 1,
        inputSummary: 'User A second initiative',
        analysisData: { frameworks: [] },
        decisionsData: { decision: 'proceed' },
        status: 'draft',
        createdBy: userA.id,
      });

      const program2 = await saveEPMProgram({
        userId: userA.id,
        sessionId: session2.id!,
        strategyVersionId: version2.id!,
        frameworkType: 'digital_transformation',
        programName: 'User A Second Program',
        executiveSummary: 'Cloud migration initiative',
        workstreams: [],
        timeline: {},
        resourcePlan: {},
        financialPlan: {},
        benefitsRealization: [],
        riskRegister: [],
        stageGates: [],
        stakeholderMap: {},
        governance: {},
        qaPlan: {},
        procurement: {},
        exitStrategy: {},
        kpis: [],
        componentConfidence: {},
        overallConfidence: 0.7,
        editTracking: {},
      });

      // CRITICAL TEST: Access first program - should only see first understanding's contradictions
      const response1 = await request(app)
        .get(`/api/strategic-consultant/bmc-knowledge/${programAId}`)
        .set('x-test-user-id', userA.id)
        .expect(200);

      const contradictions1 = response1.body.contradictions;
      
      // Debug: Log what we actually got
      if (contradictions1.length === 0 || !contradictions1.some((c: any) => c.evidence && c.evidence.includes('User A specific evidence'))) {
        console.log('DEBUG first program response:', JSON.stringify(response1.body, null, 2));
      }
      
      // Should see first understanding's contradiction
      expect(contradictions1.length).toBeGreaterThan(0);
      const hasFirstContradiction = contradictions1.some((c: any) => 
        c.evidence && c.evidence.includes('User A specific evidence')
      );
      expect(hasFirstContradiction).toBe(true);

      // Should NOT see second understanding's contradiction
      const hasSecondContradiction = contradictions1.some((c: any) => 
        c.evidence.includes('Second initiative')
      );
      expect(hasSecondContradiction).toBe(false);

      // CRITICAL TEST: Access second program - should only see second understanding's contradictions
      const response2 = await request(app)
        .get(`/api/strategic-consultant/bmc-knowledge/${program2.id}`)
        .set('x-test-user-id', userA.id)
        .expect(200);

      const contradictions2 = response2.body.contradictions;
      
      // Should see second understanding's contradiction
      expect(contradictions2.length).toBeGreaterThan(0);
      const hasSecond = contradictions2.some((c: any) => 
        c.evidence.includes('Second initiative')
      );
      expect(hasSecond).toBe(true);

      // Should NOT see first understanding's contradiction
      const hasFirst = contradictions2.some((c: any) => 
        c.evidence.includes('User A specific evidence')
      );
      expect(hasFirst).toBe(false);
    });

    it('should prevent leakage when user has multiple sessions for same understanding', async () => {
      // SCENARIO: User creates multiple journey sessions that reference the same understanding
      // Only the session linked to the strategy version should be used

      // Create second journey session for User A's first understanding
      const session3 = await saveJourneySession({
        userId: userA.id,
        understandingId: understandingAId, // Same understanding as first program
        journeyType: 'competitive_strategy',
        status: 'completed',
        versionNumber: 2,
        accumulatedContext: { different: 'context' },
      });

      // Query first program - should still work correctly
      const response = await request(app)
        .get(`/api/strategic-consultant/bmc-knowledge/${programAId}`)
        .set('x-test-user-id', userA.id)
        .expect(200);

      // Should still get data from correct understanding
      expect(response.body.userAssumptions.length).toBeGreaterThan(0);
      expect(response.body.contradictions.length).toBeGreaterThan(0);
    });
  });
});
