/**
 * KMS Encryption Verification Tests
 * 
 * Comprehensive tests to verify that sensitive data is properly encrypted
 * using AWS KMS envelope encryption and cannot be read from the database
 * without proper decryption.
 * 
 * Test Coverage:
 * - Strategic Understanding: userInput, companyContext, initiativeDescription
 * - Journey Sessions: accumulatedContext
 * - EPM Programs: All 14 program fields
 * - Strategy Versions: analysisData, decisionsData
 * - Strategic Entities: claim, source, metadata
 * - Backward compatibility with legacy encryption format
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import {
  strategicUnderstanding,
  journeySessions,
  epmPrograms,
  strategyVersions,
  strategicEntities,
  users
} from '../../shared/schema';
import {
  saveStrategicUnderstanding,
  getStrategicUnderstanding,
  saveJourneySession,
  getJourneySession,
  saveEPMProgram,
  getEPMProgram,
  saveStrategyVersion,
  getStrategyVersion,
  saveStrategicEntity,
  getStrategicEntitiesByUnderstanding
} from '../services/secure-data-service';
import { cleanupTestData } from '../../tests/test-db-setup';
import { createTestUser, type TestUser } from '../../tests/fixtures';
import { encryptKMS, decryptKMS } from '../utils/kms-encryption';

describe('KMS Encryption Verification', () => {
  let testUser: TestUser;

  beforeAll(async () => {
    await cleanupTestData();
    testUser = await createTestUser({ id: 'test-user-kms-encryption' });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Strategic Understanding Encryption', () => {
    let testRecordId: string;

    afterEach(async () => {
      if (testRecordId) {
        await db.delete(strategicUnderstanding).where(eq(strategicUnderstanding.id, testRecordId));
        testRecordId = '';
      }
    });

    it('should encrypt userInput and prevent plaintext leakage', async () => {
      const secretText = 'Secret strategic plan: Launch AI-powered product in Q1 2025';
      
      // Insert via secure service
      const saved = await saveStrategicUnderstanding({
        sessionId: `test-session-${Date.now()}`,
        userInput: secretText,
        title: 'Test Strategy',
      });
      
      testRecordId = saved.id!;

      // Query raw database directly
      const rawResult = await db.execute(
        sql`SELECT user_input FROM strategic_understanding WHERE id = ${testRecordId}`
      );

      const rawUserInput = (rawResult.rows[0] as any).user_input;

      // Verify plaintext does NOT appear in database
      expect(rawUserInput).not.toContain(secretText);
      expect(rawUserInput).not.toContain('Secret');
      expect(rawUserInput).not.toContain('AI-powered product');

      // Verify it's in KMS format (JSON with dataKeyCiphertext)
      expect(rawUserInput).toContain('dataKeyCiphertext');
      expect(rawUserInput).toContain('iv');
      expect(rawUserInput).toContain('authTag');
      expect(rawUserInput).toContain('ciphertext');

      // Verify JSON structure
      const parsed = JSON.parse(rawUserInput);
      expect(parsed).toHaveProperty('dataKeyCiphertext');
      expect(parsed).toHaveProperty('iv');
      expect(parsed).toHaveProperty('authTag');
      expect(parsed).toHaveProperty('ciphertext');

      // Query via secure service should decrypt correctly
      const decrypted = await getStrategicUnderstanding(testRecordId);
      expect(decrypted).not.toBeNull();
      expect(decrypted!.userInput).toBe(secretText);
    });

    it('should encrypt companyContext JSON data', async () => {
      const companyContext = {
        companyName: 'SecretCorp Inc',
        industry: 'Confidential AI Services',
        revenue: '$50M ARR',
        competitiveAdvantage: 'Proprietary algorithms',
      };

      const saved = await saveStrategicUnderstanding({
        sessionId: `test-session-${Date.now()}`,
        userInput: 'Test input',
        companyContext,
      });

      testRecordId = saved.id!;

      // Query raw database
      const rawResult = await db.execute(
        sql`SELECT company_context FROM strategic_understanding WHERE id = ${testRecordId}`
      );

      const rawContext = (rawResult.rows[0] as any).company_context;

      // Verify sensitive data not in plaintext
      expect(rawContext).not.toContain('SecretCorp');
      expect(rawContext).not.toContain('Proprietary algorithms');
      expect(rawContext).toContain('dataKeyCiphertext');

      // Verify decryption works
      const decrypted = await getStrategicUnderstanding(testRecordId);
      expect(decrypted!.companyContext).toEqual(companyContext);
    });

    it('should encrypt initiativeDescription', async () => {
      const description = 'Highly confidential initiative to disrupt the market with revolutionary AI';

      const saved = await saveStrategicUnderstanding({
        sessionId: `test-session-${Date.now()}`,
        userInput: 'Test input',
        initiativeDescription: description,
      });

      testRecordId = saved.id!;

      // Query raw database
      const rawResult = await db.execute(
        sql`SELECT initiative_description FROM strategic_understanding WHERE id = ${testRecordId}`
      );

      const rawDesc = (rawResult.rows[0] as any).initiative_description;

      // Verify plaintext not visible
      expect(rawDesc).not.toContain('confidential');
      expect(rawDesc).not.toContain('revolutionary');
      expect(rawDesc).toContain('dataKeyCiphertext');

      // Verify decryption
      const decrypted = await getStrategicUnderstanding(testRecordId);
      expect(decrypted!.initiativeDescription).toBe(description);
    });
  });

  describe('Journey Sessions Encryption', () => {
    let testUnderstandingId: string;
    let testSessionId: string;

    beforeEach(async () => {
      const understanding = await saveStrategicUnderstanding({
        sessionId: `test-session-${Date.now()}`,
        userInput: 'Test',
      });
      testUnderstandingId = understanding.id!;
    });

    afterEach(async () => {
      if (testSessionId) {
        await db.delete(journeySessions).where(eq(journeySessions.id, testSessionId));
      }
      if (testUnderstandingId) {
        await db.delete(strategicUnderstanding).where(eq(strategicUnderstanding.id, testUnderstandingId));
      }
    });

    it('should encrypt accumulatedContext with sensitive insights', async () => {
      const sensitiveContext = {
        journeyType: 'business_model_innovation',
        frameworks: ['five_whys', 'bmc'],
        insights: {
          rootCauses: ['Poor product-market fit', 'Inadequate pricing strategy'],
          businessModelGaps: ['Revenue model unclear', 'Customer acquisition cost too high'],
          competitiveThreats: ['Competitor X launching similar product'],
        },
      };

      const saved = await saveJourneySession({
        userId: testUser.id,
        understandingId: testUnderstandingId,
        journeyType: 'business_model_innovation',
        accumulatedContext: sensitiveContext,
      });

      testSessionId = saved.id!;

      // Query raw database
      const rawResult = await db.execute(
        sql`SELECT accumulated_context FROM journey_sessions WHERE id = ${testSessionId}`
      );

      const rawContext = (rawResult.rows[0] as any).accumulated_context;

      // Verify sensitive insights not visible
      expect(rawContext).not.toContain('Poor product-market fit');
      expect(rawContext).not.toContain('Competitor X');
      expect(rawContext).not.toContain('pricing strategy');
      expect(rawContext).toContain('dataKeyCiphertext');

      // Verify decryption
      const decrypted = await getJourneySession(testSessionId);
      expect(decrypted!.accumulatedContext).toEqual(sensitiveContext);
    });
  });

  describe('EPM Programs Encryption (All 14 Fields)', () => {
    let testVersionId: string;
    let testProgramId: string;

    beforeEach(async () => {
      // Create test strategy version
      const [version] = await db.insert(strategyVersions).values({
        userId: testUser.id,
        sessionId: `test-session-${Date.now()}`,
        versionNumber: 1,
        inputSummary: 'Test',
        analysisData: {} as any,
        decisions: [] as any,
        createdBy: testUser.id,
      }).returning();
      testVersionId = version.id;
    });

    afterEach(async () => {
      if (testProgramId) {
        await db.delete(epmPrograms).where(eq(epmPrograms.id, testProgramId));
      }
      if (testVersionId) {
        await db.delete(strategyVersions).where(eq(strategyVersions.id, testVersionId));
      }
    });

    it('should encrypt all 14 EPM program fields', async () => {
      const sensitiveProgram = {
        userId: testUser.id,
        sessionId: `test-session-${Date.now()}`,
        strategyVersionId: testVersionId,
        programName: 'Secret Project Phoenix',
        executiveSummary: 'Confidential: Launch revolutionary AI product to capture 30% market share',
        workstreams: [
          { name: 'Product Development', lead: 'John Doe', budget: 5000000 },
          { name: 'Marketing Campaign', lead: 'Jane Smith', budget: 2000000 },
        ],
        timeline: {
          start: '2025-01-01',
          end: '2025-12-31',
          milestones: [
            { name: 'Alpha Release', date: '2025-03-01', confidential: true },
          ],
        },
        resourcePlan: {
          headcount: 50,
          keyRoles: ['AI Engineers', 'Product Managers'],
          partners: ['SecretVendor Corp'],
        },
        financialPlan: {
          totalBudget: 10000000,
          breakdown: { engineering: 6000000, marketing: 3000000, operations: 1000000 },
          roi: 'Expected 300% ROI in 18 months',
        },
        benefitsRealization: {
          quantifiable: ['$15M revenue increase', '50% cost reduction'],
          qualitative: ['Market leadership', 'Brand recognition'],
        },
        riskRegister: [
          { risk: 'Competitor launches first', impact: 'High', mitigation: 'Accelerate timeline' },
        ],
        stakeholderMap: {
          executives: ['CEO', 'CTO', 'CFO'],
          board: ['Board Member A'],
        },
        governance: {
          structure: 'Steering Committee',
          frequency: 'Weekly',
        },
        qaPlan: {
          standards: ['ISO 9001', 'SOC 2'],
          reviews: ['Weekly code reviews', 'Monthly audits'],
        },
        procurement: {
          vendors: ['AWS', 'OpenAI'],
          contracts: ['Enterprise SLA'],
        },
        exitStrategy: {
          criteria: ['Market share < 10%', 'Budget overrun > 50%'],
          plan: 'Pivot to B2B model',
        },
        kpis: [
          { metric: 'Customer Acquisition', target: '1000/month', current: '0' },
          { metric: 'Revenue', target: '$5M ARR', current: '$0' },
        ],
      };

      const saved = await saveEPMProgram(sensitiveProgram);
      testProgramId = saved.id!;

      // Query raw database for each encrypted field
      const rawResult = await db.execute(
        sql`SELECT program_name, executive_summary, workstreams, timeline, 
            resource_plan, financial_plan, benefits_realization, risk_register,
            stakeholder_map, governance, qa_plan, procurement, exit_strategy, kpis
            FROM epm_programs WHERE id = ${testProgramId}`
      );

      const rawRecord = rawResult.rows[0] as any;

      // Test each of the 14 fields for proper encryption
      const encryptedFields = [
        { name: 'program_name', plaintext: 'Secret Project Phoenix' },
        { name: 'executive_summary', plaintext: 'Confidential' },
        { name: 'workstreams', plaintext: 'John Doe' },
        { name: 'timeline', plaintext: 'Alpha Release' },
        { name: 'resource_plan', plaintext: 'SecretVendor' },
        { name: 'financial_plan', plaintext: '6000000' },
        { name: 'benefits_realization', plaintext: '$15M revenue' },
        { name: 'risk_register', plaintext: 'Competitor launches first' },
        { name: 'stakeholder_map', plaintext: 'Board Member A' },
        { name: 'governance', plaintext: 'Steering Committee' },
        { name: 'qa_plan', plaintext: 'ISO 9001' },
        { name: 'procurement', plaintext: 'OpenAI' },
        { name: 'exit_strategy', plaintext: 'Pivot to B2B' },
        { name: 'kpis', plaintext: 'Customer Acquisition' },
      ];

      // Verify all fields are encrypted
      for (const field of encryptedFields) {
        const rawValue = rawRecord[field.name];
        
        // Should not contain plaintext
        expect(rawValue).not.toContain(field.plaintext);
        
        // Should be in KMS format
        expect(rawValue).toContain('dataKeyCiphertext');
      }

      // Verify decryption works for all fields
      const decrypted = await getEPMProgram(testProgramId);
      expect(decrypted!.programName).toBe(sensitiveProgram.programName);
      expect(decrypted!.executiveSummary).toBe(sensitiveProgram.executiveSummary);
      expect(decrypted!.workstreams).toEqual(sensitiveProgram.workstreams);
      expect(decrypted!.timeline).toEqual(sensitiveProgram.timeline);
      expect(decrypted!.resourcePlan).toEqual(sensitiveProgram.resourcePlan);
      expect(decrypted!.financialPlan).toEqual(sensitiveProgram.financialPlan);
      expect(decrypted!.kpis).toEqual(sensitiveProgram.kpis);
    });
  });

  describe('Strategy Versions Encryption', () => {
    let testVersionId: string;

    afterEach(async () => {
      if (testVersionId) {
        await db.delete(strategyVersions).where(eq(strategyVersions.id, testVersionId));
      }
    });

    it('should encrypt analysisData and decisionsData', async () => {
      const analysisData = {
        five_whys_results: {
          rootCauses: ['Confidential root cause analysis'],
          whyChains: [['Why 1', 'Why 2', 'Secret finding']],
        },
        bmc_research: {
          keyInsights: ['Proprietary market insight', 'Competitive advantage details'],
        },
      };

      const decisionsData = {
        goDecision: 'proceed',
        confidence: 'high',
        keyFactors: ['Secret strategic advantage', 'Proprietary technology'],
      };

      const saved = await saveStrategyVersion({
        userId: testUser.id,
        sessionId: `test-session-${Date.now()}`,
        versionNumber: 1,
        inputSummary: 'Test',
        analysisData,
        decisionsData,
        status: 'active',
        createdBy: testUser.id,
      });

      testVersionId = saved.id!;

      // Query raw database
      const rawResult = await db.execute(
        sql`SELECT analysis_data, decisions_data FROM strategy_versions WHERE id = ${testVersionId}`
      );

      const rawRecord = rawResult.rows[0] as any;

      // Verify analysisData encryption
      expect(rawRecord.analysis_data).not.toContain('Confidential root cause');
      expect(rawRecord.analysis_data).not.toContain('Proprietary market insight');
      expect(rawRecord.analysis_data).toContain('dataKeyCiphertext');

      // Verify decisionsData encryption
      expect(rawRecord.decisions_data).not.toContain('Secret strategic advantage');
      expect(rawRecord.decisions_data).toContain('dataKeyCiphertext');

      // Verify decryption
      const decrypted = await getStrategyVersion(testUser.id, 1);
      expect(decrypted!.analysisData).toEqual(analysisData);
      expect(decrypted!.decisionsData).toEqual(decisionsData);
    });
  });

  describe('Strategic Entities Encryption', () => {
    let testUnderstandingId: string;

    beforeEach(async () => {
      const understanding = await saveStrategicUnderstanding({
        sessionId: `test-session-${Date.now()}`,
        userInput: 'Test',
      });
      testUnderstandingId = understanding.id!;
    });

    afterEach(async () => {
      if (testUnderstandingId) {
        await db.delete(strategicEntities).where(eq(strategicEntities.understandingId, testUnderstandingId));
        await db.delete(strategicUnderstanding).where(eq(strategicUnderstanding.id, testUnderstandingId));
      }
    });

    it('should encrypt claim, source, and metadata', async () => {
      const sensitiveEntity = {
        understandingId: testUnderstandingId,
        type: 'explicit_assumption' as any,
        claim: 'Secret assumption: Market will grow 50% annually',
        source: 'Confidential market research from Gartner',
        evidence: 'Proprietary data analysis',
        category: 'Market Growth',
        metadata: {
          confidence: 0.95,
          internalNote: 'Based on insider information',
        },
        discoveredBy: 'user_input' as any,
      };

      const saved = await saveStrategicEntity(sensitiveEntity);

      // Query raw database
      const rawResult = await db.execute(
        sql`SELECT claim, source, evidence, category, metadata 
            FROM strategic_entities WHERE id = ${saved.id}`
      );

      const rawRecord = rawResult.rows[0] as any;

      // Verify encryption
      expect(rawRecord.claim).not.toContain('Secret assumption');
      expect(rawRecord.claim).toContain('dataKeyCiphertext');

      expect(rawRecord.source).not.toContain('Gartner');
      expect(rawRecord.source).toContain('dataKeyCiphertext');

      expect(rawRecord.evidence).not.toContain('Proprietary');
      expect(rawRecord.evidence).toContain('dataKeyCiphertext');

      expect(rawRecord.metadata).not.toContain('insider information');
      expect(rawRecord.metadata).toContain('dataKeyCiphertext');

      // Verify decryption
      const decrypted = await getStrategicEntitiesByUnderstanding(testUnderstandingId);
      expect(decrypted[0].claim).toBe(sensitiveEntity.claim);
      expect(decrypted[0].source).toBe(sensitiveEntity.source);
      expect(decrypted[0].metadata).toEqual(sensitiveEntity.metadata);
    });
  });

  describe('Backward Compatibility', () => {
    it('should successfully decrypt legacy encrypted format', async () => {
      const testText = 'Test legacy encryption';
      
      // Import legacy encryption function
      const { encrypt } = await import('../utils/encryption');
      const legacyEncrypted = encrypt(testText);

      // Verify it can be decrypted with new KMS decryption
      const decrypted = await decryptKMS(legacyEncrypted);
      expect(decrypted).toBe(testText);
    });

    it('should handle mixed format data gracefully', async () => {
      const { encrypt } = await import('../utils/encryption');
      
      // Test that the system can handle both formats
      const legacyText = 'Legacy format data';
      const legacyEncrypted = encrypt(legacyText);
      
      const modernText = 'Modern KMS format data';
      const modernEncrypted = await encryptKMS(modernText);

      // Both should decrypt correctly
      const decryptedLegacy = await decryptKMS(legacyEncrypted);
      const decryptedModern = await decryptKMS(modernEncrypted!);

      expect(decryptedLegacy).toBe(legacyText);
      expect(decryptedModern).toBe(modernText);
    });
  });

  describe('Encryption Format Validation', () => {
    it('should produce valid KMS envelope encryption structure', async () => {
      const plaintext = 'Test encryption structure';
      const encrypted = await encryptKMS(plaintext);

      expect(encrypted).not.toBeNull();
      
      // Parse and validate structure
      const payload = JSON.parse(encrypted!);
      
      // Must have all 4 components
      expect(payload).toHaveProperty('dataKeyCiphertext');
      expect(payload).toHaveProperty('iv');
      expect(payload).toHaveProperty('authTag');
      expect(payload).toHaveProperty('ciphertext');

      // All should be base64 strings
      expect(payload.dataKeyCiphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(payload.iv).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(payload.authTag).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(payload.ciphertext).toMatch(/^[A-Za-z0-9+/]+=*$/);

      // IV should be 16 bytes (24 chars base64)
      const ivBuffer = Buffer.from(payload.iv, 'base64');
      expect(ivBuffer.length).toBe(16);

      // Should successfully decrypt
      const decrypted = await decryptKMS(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should use unique data keys for each encryption', async () => {
      const plaintext = 'Same plaintext';
      
      const encrypted1 = await encryptKMS(plaintext);
      const encrypted2 = await encryptKMS(plaintext);

      // Even with same plaintext, encrypted values should differ
      expect(encrypted1).not.toBe(encrypted2);

      const payload1 = JSON.parse(encrypted1!);
      const payload2 = JSON.parse(encrypted2!);

      // Data keys should be different
      expect(payload1.dataKeyCiphertext).not.toBe(payload2.dataKeyCiphertext);
      
      // IVs should be different (unique per encryption)
      expect(payload1.iv).not.toBe(payload2.iv);

      // Both should decrypt to same plaintext
      const decrypted1 = await decryptKMS(encrypted1);
      const decrypted2 = await decryptKMS(encrypted2);
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });
  });

  describe('Negative Test Cases - Error Handling', () => {
    it('should reject malformed encrypted payload - missing dataKeyCiphertext', async () => {
      const malformedPayload = JSON.stringify({
        iv: 'dGVzdGl2MTIzNDU2Nzg=',
        authTag: 'dGVzdGF1dGh0YWcxMjM=',
        ciphertext: 'dGVzdGNpcGhlcnRleHQ='
      });

      await expect(decryptKMS(malformedPayload)).rejects.toThrow();
    });

    it('should reject malformed encrypted payload - missing iv', async () => {
      const malformedPayload = JSON.stringify({
        dataKeyCiphertext: 'dGVzdGtleQ==',
        authTag: 'dGVzdGF1dGh0YWcxMjM=',
        ciphertext: 'dGVzdGNpcGhlcnRleHQ='
      });

      await expect(decryptKMS(malformedPayload)).rejects.toThrow();
    });

    it('should reject malformed encrypted payload - missing authTag', async () => {
      const malformedPayload = JSON.stringify({
        dataKeyCiphertext: 'dGVzdGtleQ==',
        iv: 'dGVzdGl2MTIzNDU2Nzg=',
        ciphertext: 'dGVzdGNpcGhlcnRleHQ='
      });

      await expect(decryptKMS(malformedPayload)).rejects.toThrow();
    });

    it('should reject malformed encrypted payload - missing ciphertext', async () => {
      const malformedPayload = JSON.stringify({
        dataKeyCiphertext: 'dGVzdGtleQ==',
        iv: 'dGVzdGl2MTIzNDU2Nzg=',
        authTag: 'dGVzdGF1dGh0YWcxMjM='
      });

      await expect(decryptKMS(malformedPayload)).rejects.toThrow();
    });

    it('should reject invalid data key ciphertext', async () => {
      const invalidPayload = JSON.stringify({
        dataKeyCiphertext: 'invalid-base64-!@#$',
        iv: 'dGVzdGl2MTIzNDU2Nzg=',
        authTag: 'dGVzdGF1dGh0YWcxMjM=',
        ciphertext: 'dGVzdGNpcGhlcnRleHQ='
      });

      await expect(decryptKMS(invalidPayload)).rejects.toThrow();
    });

    it('should reject non-JSON encrypted data', async () => {
      const invalidData = 'this-is-not-json-encrypted-data';

      await expect(decryptKMS(invalidData)).rejects.toThrow();
    });

    it('should reject empty string', async () => {
      await expect(decryptKMS('')).rejects.toThrow();
    });

    it('should handle tampered ciphertext', async () => {
      // First, encrypt valid data
      const plaintext = 'Test data for tampering';
      const encrypted = await encryptKMS(plaintext);
      
      // Parse and tamper with the ciphertext
      const payload = JSON.parse(encrypted!);
      payload.ciphertext = payload.ciphertext.slice(0, -5) + 'XXXXX'; // Tamper
      
      const tamperedPayload = JSON.stringify(payload);

      // Decryption should fail due to authentication tag mismatch
      await expect(decryptKMS(tamperedPayload)).rejects.toThrow();
    });

    it('should handle tampered authTag', async () => {
      // First, encrypt valid data
      const plaintext = 'Test data for auth tag tampering';
      const encrypted = await encryptKMS(plaintext);
      
      // Parse and tamper with the authTag
      const payload = JSON.parse(encrypted!);
      const originalTag = Buffer.from(payload.authTag, 'base64');
      originalTag[0] = originalTag[0] ^ 0xFF; // Flip bits in first byte
      payload.authTag = originalTag.toString('base64');
      
      const tamperedPayload = JSON.stringify(payload);

      // Decryption should fail due to authentication failure
      await expect(decryptKMS(tamperedPayload)).rejects.toThrow();
    });
  });
});
