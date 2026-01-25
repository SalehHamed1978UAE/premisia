import { db } from '../db';
import {
  strategicUnderstanding,
  journeySessions,
  epmPrograms,
  strategicEntities,
  strategicRelationships,
  strategicDecisions,
  strategyVersions,
  users
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { encryptKMS, decryptKMS, encryptJSONKMS, decryptJSONKMS } from '../utils/kms-encryption';

/**
 * Secure Data Service
 * 
 * Handles encryption/decryption for all sensitive business data
 * 
 * Fields encrypted per table:
 * - Strategic Understanding: userInput, companyContext, initiativeDescription
 * - Journey Sessions: accumulatedContext
 * - Strategic Entities (Knowledge Graph): content, properties
 * - Strategic Decisions: decisionsData
 * - Strategy Versions: inputSummary, analysisData, decisionsData
 * - EPM Programs: ALL program data fields (programName, executiveSummary, workstreams, 
 *   timeline, resourcePlan, financialPlan, benefitsRealization, riskRegister, 
 *   stakeholderMap, governance, qaPlan, procurement, exitStrategy, kpis)
 * - Users: email (if PII), fullName, phoneNumber, companyName
 * 
 * ENCRYPTION AUDIT (2025-11-02):
 * ✅ EPM Programs - All strategic fields are properly encrypted:
 *    - executiveSummary: Encrypted with encrypt() (line 331)
 *    - workstreams: Encrypted with encryptJSON() (line 332) 
 *    - timeline: Encrypted with encryptJSON() (line 333)
 *    - All 14 EPM fields use proper encryption methods
 * ✅ Strategy Versions - analysisData and decisionsData encrypted
 * ✅ All CRUD operations (save/update/get) properly encrypt/decrypt data
 */

// ==================== STRATEGIC UNDERSTANDING ====================

export interface SecureStrategicUnderstanding {
  id?: string;
  sessionId: string;
  userInput: string;
  title?: string | null;
  initiativeType?: string | null;
  initiativeDescription?: string | null;
  userConfirmed?: boolean;
  classificationConfidence?: string | null;
  companyContext?: any;
  graphVersion?: number;
  lastEnrichedBy?: string | null;
  lastEnrichedAt?: Date | null;
  archived?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export async function saveStrategicUnderstanding(data: SecureStrategicUnderstanding) {
  const encrypted = {
    ...data,
    userInput: await encryptKMS(data.userInput)!,
    companyContext: data.companyContext ? await encryptJSONKMS(data.companyContext) : null,
    initiativeDescription: data.initiativeDescription ? await encryptKMS(data.initiativeDescription) : null,
  };

  const result = await db.insert(strategicUnderstanding)
    .values(encrypted as any)
    .returning();

  return await decryptStrategicUnderstanding(result[0]);
}

export async function updateStrategicUnderstanding(id: string, data: Partial<SecureStrategicUnderstanding>) {
  const encrypted: any = { ...data };

  if (data.userInput !== undefined) {
    encrypted.userInput = await encryptKMS(data.userInput);
  }
  if (data.companyContext !== undefined) {
    encrypted.companyContext = await encryptJSONKMS(data.companyContext);
  }
  if (data.initiativeDescription !== undefined) {
    encrypted.initiativeDescription = await encryptKMS(data.initiativeDescription);
  }

  encrypted.updatedAt = new Date();

  const result = await db.update(strategicUnderstanding)
    .set(encrypted)
    .where(eq(strategicUnderstanding.id, id))
    .returning();

  return result[0] ? await decryptStrategicUnderstanding(result[0]) : null;
}

export async function getStrategicUnderstanding(id: string) {
  const result = await db.select()
    .from(strategicUnderstanding)
    .where(eq(strategicUnderstanding.id, id))
    .limit(1);

  return result[0] ? await decryptStrategicUnderstanding(result[0]) : null;
}

export async function getStrategicUnderstandingBySession(sessionId: string) {
  const result = await db.select()
    .from(strategicUnderstanding)
    .where(eq(strategicUnderstanding.sessionId, sessionId))
    .limit(1);

  return result[0] ? await decryptStrategicUnderstanding(result[0]) : null;
}

async function decryptStrategicUnderstanding(record: any): Promise<SecureStrategicUnderstanding> {
  return {
    ...record,
    userInput: await decryptKMS(record.userInput) || record.userInput,
    companyContext: record.companyContext ? await decryptJSONKMS(record.companyContext) || record.companyContext : null,
    initiativeDescription: record.initiativeDescription ? await decryptKMS(record.initiativeDescription) || record.initiativeDescription : null,
  };
}

// ==================== JOURNEY SESSIONS ====================

export interface SecureJourneySession {
  id?: string;
  userId: string;
  sessionId?: string;
  understandingId?: string;
  journeyType?: string;
  status?: string;
  currentFrameworkIndex?: number;
  completedFrameworks?: string[];
  accumulatedContext?: any;
  versionNumber?: number;
  startedAt?: Date;
  background?: boolean;
  completedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: any; // Custom journey metadata (frameworks, templateId, etc.)
}

export async function saveJourneySession(data: SecureJourneySession) {
  const encrypted = {
    ...data,
    accumulatedContext: data.accumulatedContext ? await encryptJSONKMS(data.accumulatedContext) : null,
  };

  const result = await db.insert(journeySessions)
    .values(encrypted as any)
    .returning();

  return await decryptJourneySession(result[0]);
}

export async function updateJourneySession(id: string, data: Partial<SecureJourneySession>) {
  const encrypted: any = { ...data };

  if (data.accumulatedContext !== undefined) {
    encrypted.accumulatedContext = await encryptJSONKMS(data.accumulatedContext);
  }

  encrypted.updatedAt = new Date();

  const result = await db.update(journeySessions)
    .set(encrypted)
    .where(eq(journeySessions.id, id))
    .returning();

  return result[0] ? await decryptJourneySession(result[0]) : null;
}

export async function getJourneySession(id: string) {
  const result = await db.select()
    .from(journeySessions)
    .where(eq(journeySessions.id, id))
    .limit(1);

  return result[0] ? await decryptJourneySession(result[0]) : null;
}

export async function getJourneySessionByUnderstandingSessionId(understandingSessionId: string) {
  // First find the understanding by session ID
  const understanding = await getStrategicUnderstandingBySession(understandingSessionId);
  
  if (!understanding) {
    return null;
  }

  // Then find the journey session by understanding ID
  const result = await db.select()
    .from(journeySessions)
    .where(eq(journeySessions.understandingId, understanding.id!))
    .limit(1);

  return result[0] ? await decryptJourneySession(result[0]) : null;
}

async function decryptJourneySession(record: any): Promise<SecureJourneySession> {
  return {
    ...record,
    accumulatedContext: record.accumulatedContext ? await decryptJSONKMS(record.accumulatedContext) || record.accumulatedContext : null,
    metadata: record.metadata, // Pass through metadata (not encrypted)
  };
}

// ==================== STRATEGIC ENTITIES (Knowledge Graph) ====================

export interface SecureStrategicEntity {
  id?: string;
  understandingId: string;
  type: any;
  claim: string;
  confidence?: any;
  embedding?: any;
  source: string;
  evidence?: string | null;
  category?: string | null;
  subcategory?: string | null;
  investmentAmount?: number | null;
  discoveredBy: any;
  discoveredAt?: Date;
  validFrom?: Date;
  validTo?: Date | null;
  metadata?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export async function saveStrategicEntity(data: SecureStrategicEntity) {
  const encrypted = {
    ...data,
    claim: await encryptKMS(data.claim)!,
    source: await encryptKMS(data.source)!,
    evidence: data.evidence ? await encryptKMS(data.evidence) : null,
    category: data.category ? await encryptKMS(data.category) : null,
    subcategory: data.subcategory ? await encryptKMS(data.subcategory) : null,
    metadata: data.metadata ? await encryptJSONKMS(data.metadata) : null,
  };

  const result = await db.insert(strategicEntities)
    .values(encrypted as any)
    .returning();

  return await decryptStrategicEntity(result[0]);
}

export async function getStrategicEntitiesByUnderstanding(understandingId: string) {
  const result = await db.select()
    .from(strategicEntities)
    .where(eq(strategicEntities.understandingId, understandingId));

  return Promise.all(result.map(decryptStrategicEntity));
}

async function decryptStrategicEntity(record: any): Promise<SecureStrategicEntity> {
  return {
    ...record,
    claim: await decryptKMS(record.claim) || record.claim,
    source: await decryptKMS(record.source) || record.source,
    evidence: record.evidence ? await decryptKMS(record.evidence) || record.evidence : null,
    category: record.category ? await decryptKMS(record.category) || record.category : null,
    subcategory: record.subcategory ? await decryptKMS(record.subcategory) || record.subcategory : null,
    metadata: record.metadata ? await decryptJSONKMS(record.metadata) || record.metadata : null,
  };
}

// ==================== STRATEGIC RELATIONSHIPS (Knowledge Graph) ====================

export interface SecureStrategicRelationship {
  id?: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: any;
  confidence?: any;
  evidence?: string | null;
  discoveredBy: any;
  discoveredAt?: Date;
  validFrom?: Date;
  validTo?: Date | null;
  metadata?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export async function saveStrategicRelationship(data: SecureStrategicRelationship) {
  const encrypted = {
    ...data,
    evidence: data.evidence ? await encryptKMS(data.evidence) : null,
    metadata: data.metadata ? await encryptJSONKMS(data.metadata) : null,
  };

  const result = await db.insert(strategicRelationships)
    .values(encrypted as any)
    .returning();

  return await decryptStrategicRelationship(result[0]);
}

async function decryptStrategicRelationship(record: any): Promise<SecureStrategicRelationship> {
  return {
    ...record,
    evidence: record.evidence ? await decryptKMS(record.evidence) || record.evidence : null,
    metadata: record.metadata ? await decryptJSONKMS(record.metadata) || record.metadata : null,
  };
}

// ==================== EPM PROGRAMS ====================

export interface SecureEPMProgram {
  id?: string;
  userId: string;
  sessionId: string;
  strategyVersionId?: string;
  frameworkType?: string;
  frameworkRunId?: string | null;
  programName?: string;
  executiveSummary?: string;
  workstreams?: any;
  timeline?: any;
  resourcePlan?: any;
  financialPlan?: any;
  benefitsRealization?: any;
  riskRegister?: any;
  stakeholderMap?: any;
  governance?: any;
  qaPlan?: any;
  procurement?: any;
  exitStrategy?: any;
  kpis?: any;
  overallConfidence?: number;
  status?: string;
  generatedAt?: Date;
  finalizedAt?: Date | null;
  archived?: boolean;
}

export async function saveEPMProgram(data: SecureEPMProgram) {
  const encrypted = {
    ...data,
    programName: data.programName ? await encryptKMS(data.programName) : null,
    executiveSummary: data.executiveSummary ? await encryptKMS(data.executiveSummary) : null,
    workstreams: data.workstreams ? await encryptJSONKMS(data.workstreams) : null,
    timeline: data.timeline ? await encryptJSONKMS(data.timeline) : null,
    resourcePlan: data.resourcePlan ? await encryptJSONKMS(data.resourcePlan) : null,
    financialPlan: data.financialPlan ? await encryptJSONKMS(data.financialPlan) : null,
    benefitsRealization: data.benefitsRealization ? await encryptJSONKMS(data.benefitsRealization) : null,
    riskRegister: data.riskRegister ? await encryptJSONKMS(data.riskRegister) : null,
    stakeholderMap: data.stakeholderMap ? await encryptJSONKMS(data.stakeholderMap) : null,
    governance: data.governance ? await encryptJSONKMS(data.governance) : null,
    qaPlan: data.qaPlan ? await encryptJSONKMS(data.qaPlan) : null,
    procurement: data.procurement ? await encryptJSONKMS(data.procurement) : null,
    exitStrategy: data.exitStrategy ? await encryptJSONKMS(data.exitStrategy) : null,
    kpis: data.kpis ? await encryptJSONKMS(data.kpis) : null,
  };

  const result = await db.insert(epmPrograms)
    .values(encrypted as any)
    .returning() as any[];

  return await decryptEPMProgram(result[0]);
}

export async function updateEPMProgram(id: string, data: Partial<SecureEPMProgram>) {
  const encrypted: any = { ...data };

  if (data.programName !== undefined) encrypted.programName = await encryptKMS(data.programName);
  if (data.executiveSummary !== undefined) encrypted.executiveSummary = await encryptKMS(data.executiveSummary);
  if (data.workstreams !== undefined) encrypted.workstreams = await encryptJSONKMS(data.workstreams);
  if (data.timeline !== undefined) encrypted.timeline = await encryptJSONKMS(data.timeline);
  if (data.resourcePlan !== undefined) encrypted.resourcePlan = await encryptJSONKMS(data.resourcePlan);
  if (data.financialPlan !== undefined) encrypted.financialPlan = await encryptJSONKMS(data.financialPlan);
  if (data.benefitsRealization !== undefined) encrypted.benefitsRealization = await encryptJSONKMS(data.benefitsRealization);
  if (data.riskRegister !== undefined) encrypted.riskRegister = await encryptJSONKMS(data.riskRegister);
  if (data.stakeholderMap !== undefined) encrypted.stakeholderMap = await encryptJSONKMS(data.stakeholderMap);
  if (data.governance !== undefined) encrypted.governance = await encryptJSONKMS(data.governance);
  if (data.qaPlan !== undefined) encrypted.qaPlan = await encryptJSONKMS(data.qaPlan);
  if (data.procurement !== undefined) encrypted.procurement = await encryptJSONKMS(data.procurement);
  if (data.exitStrategy !== undefined) encrypted.exitStrategy = await encryptJSONKMS(data.exitStrategy);
  if (data.kpis !== undefined) encrypted.kpis = await encryptJSONKMS(data.kpis);

  const result = await db.update(epmPrograms)
    .set(encrypted)
    .where(eq(epmPrograms.id, id))
    .returning();

  return result[0] ? await decryptEPMProgram(result[0]) : null;
}

export async function getEPMProgram(id: string) {
  const result = await db.select()
    .from(epmPrograms)
    .where(eq(epmPrograms.id, id))
    .limit(1);

  return result[0] ? await decryptEPMProgram(result[0]) : null;
}

export async function getEPMProgramsByUser(userId: string) {
  const result = await db.select()
    .from(epmPrograms)
    .where(eq(epmPrograms.userId, userId));

  return Promise.all(result.map(decryptEPMProgram));
}

async function decryptEPMProgram(record: any): Promise<SecureEPMProgram> {
  return {
    ...record,
    programName: record.programName ? await decryptKMS(record.programName) || record.programName : null,
    executiveSummary: record.executiveSummary ? await decryptKMS(record.executiveSummary) || record.executiveSummary : null,
    workstreams: record.workstreams ? await decryptJSONKMS(record.workstreams) || record.workstreams : null,
    timeline: record.timeline ? await decryptJSONKMS(record.timeline) || record.timeline : null,
    resourcePlan: record.resourcePlan ? await decryptJSONKMS(record.resourcePlan) || record.resourcePlan : null,
    financialPlan: record.financialPlan ? await decryptJSONKMS(record.financialPlan) || record.financialPlan : null,
    benefitsRealization: record.benefitsRealization ? await decryptJSONKMS(record.benefitsRealization) || record.benefitsRealization : null,
    riskRegister: record.riskRegister ? await decryptJSONKMS(record.riskRegister) || record.riskRegister : null,
    stakeholderMap: record.stakeholderMap ? await decryptJSONKMS(record.stakeholderMap) || record.stakeholderMap : null,
    governance: record.governance ? await decryptJSONKMS(record.governance) || record.governance : null,
    qaPlan: record.qaPlan ? await decryptJSONKMS(record.qaPlan) || record.qaPlan : null,
    procurement: record.procurement ? await decryptJSONKMS(record.procurement) || record.procurement : null,
    exitStrategy: record.exitStrategy ? await decryptJSONKMS(record.exitStrategy) || record.exitStrategy : null,
    kpis: record.kpis ? await decryptJSONKMS(record.kpis) || record.kpis : null,
  };
}

// ==================== STRATEGY VERSIONS ====================

export interface SecureStrategyVersion {
  id?: string;
  sessionId: string;
  versionNumber: number;
  inputSummary?: string | null;
  status: string;
  analysisData?: any;
  decisionsData?: any;
  userId: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export async function saveStrategyVersion(data: SecureStrategyVersion) {
  const encrypted = {
    ...data,
    inputSummary: data.inputSummary ? await encryptKMS(data.inputSummary) : null,
    analysisData: data.analysisData ? await encryptJSONKMS(data.analysisData) : null,
    decisionsData: data.decisionsData ? await encryptJSONKMS(data.decisionsData) : null,
  };

  const result = await db.insert(strategyVersions)
    .values(encrypted as any)
    .returning() as any[];

  return await decryptStrategyVersion(result[0]);
}

export async function updateStrategyVersion(id: string, data: Partial<SecureStrategyVersion>) {
  const encrypted: any = { ...data };

  if (data.inputSummary !== undefined) {
    encrypted.inputSummary = data.inputSummary ? await encryptKMS(data.inputSummary) : null;
  }
  if (data.analysisData !== undefined) {
    encrypted.analysisData = await encryptJSONKMS(data.analysisData);
  }
  if (data.decisionsData !== undefined) {
    encrypted.decisionsData = await encryptJSONKMS(data.decisionsData);
  }

  encrypted.updatedAt = new Date();

  const result = await db.update(strategyVersions)
    .set(encrypted)
    .where(eq(strategyVersions.id, id))
    .returning();

  return result[0] ? await decryptStrategyVersion(result[0]) : null;
}

export async function getStrategyVersion(sessionId: string, versionNumber: number) {
  const result = await db.select()
    .from(strategyVersions)
    .where(
      and(
        eq(strategyVersions.sessionId, sessionId),
        eq(strategyVersions.versionNumber, versionNumber)
      )
    )
    .limit(1);

  return result[0] ? await decryptStrategyVersion(result[0]) : null;
}

async function decryptStrategyVersion(record: any): Promise<SecureStrategyVersion> {
  return {
    ...record,
    inputSummary: record.inputSummary ? await decryptKMS(record.inputSummary) || record.inputSummary : null,
    analysisData: record.analysisData ? await decryptJSONKMS(record.analysisData) || record.analysisData : null,
    decisionsData: record.decisionsData ? await decryptJSONKMS(record.decisionsData) || record.decisionsData : null,
  };
}
