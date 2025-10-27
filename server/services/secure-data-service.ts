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
import { encrypt, decrypt, encryptJSON, decryptJSON } from '../utils/encryption';

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
 * - Strategy Versions: analysisData, decisionsData
 * - EPM Programs: ALL program data fields
 * - Users: email (if PII), fullName, phoneNumber, companyName
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
    userInput: encrypt(data.userInput)!,
    companyContext: data.companyContext ? encryptJSON(data.companyContext) : null,
    initiativeDescription: data.initiativeDescription ? encrypt(data.initiativeDescription) : null,
  };

  const result = await db.insert(strategicUnderstanding)
    .values(encrypted as any)
    .returning();

  return decryptStrategicUnderstanding(result[0]);
}

export async function updateStrategicUnderstanding(id: string, data: Partial<SecureStrategicUnderstanding>) {
  const encrypted: any = { ...data };

  if (data.userInput !== undefined) {
    encrypted.userInput = encrypt(data.userInput);
  }
  if (data.companyContext !== undefined) {
    encrypted.companyContext = encryptJSON(data.companyContext);
  }
  if (data.initiativeDescription !== undefined) {
    encrypted.initiativeDescription = encrypt(data.initiativeDescription);
  }

  encrypted.updatedAt = new Date();

  const result = await db.update(strategicUnderstanding)
    .set(encrypted)
    .where(eq(strategicUnderstanding.id, id))
    .returning();

  return result[0] ? decryptStrategicUnderstanding(result[0]) : null;
}

export async function getStrategicUnderstanding(id: string) {
  const result = await db.select()
    .from(strategicUnderstanding)
    .where(eq(strategicUnderstanding.id, id))
    .limit(1);

  return result[0] ? decryptStrategicUnderstanding(result[0]) : null;
}

export async function getStrategicUnderstandingBySession(sessionId: string) {
  const result = await db.select()
    .from(strategicUnderstanding)
    .where(eq(strategicUnderstanding.sessionId, sessionId))
    .limit(1);

  return result[0] ? decryptStrategicUnderstanding(result[0]) : null;
}

function decryptStrategicUnderstanding(record: any): SecureStrategicUnderstanding {
  return {
    ...record,
    userInput: decrypt(record.userInput) || record.userInput,
    companyContext: record.companyContext ? decryptJSON(record.companyContext) || record.companyContext : null,
    initiativeDescription: record.initiativeDescription ? decrypt(record.initiativeDescription) || record.initiativeDescription : null,
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
  completedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export async function saveJourneySession(data: SecureJourneySession) {
  const encrypted = {
    ...data,
    accumulatedContext: data.accumulatedContext ? encryptJSON(data.accumulatedContext) : null,
  };

  const result = await db.insert(journeySessions)
    .values(encrypted as any)
    .returning();

  return decryptJourneySession(result[0]);
}

export async function updateJourneySession(id: string, data: Partial<SecureJourneySession>) {
  const encrypted: any = { ...data };

  if (data.accumulatedContext !== undefined) {
    encrypted.accumulatedContext = encryptJSON(data.accumulatedContext);
  }

  encrypted.updatedAt = new Date();

  const result = await db.update(journeySessions)
    .set(encrypted)
    .where(eq(journeySessions.id, id))
    .returning();

  return result[0] ? decryptJourneySession(result[0]) : null;
}

export async function getJourneySession(id: string) {
  const result = await db.select()
    .from(journeySessions)
    .where(eq(journeySessions.id, id))
    .limit(1);

  return result[0] ? decryptJourneySession(result[0]) : null;
}

function decryptJourneySession(record: any): SecureJourneySession {
  return {
    ...record,
    accumulatedContext: record.accumulatedContext ? decryptJSON(record.accumulatedContext) || record.accumulatedContext : null,
  };
}

// ==================== STRATEGIC ENTITIES (Knowledge Graph) ====================

export interface SecureStrategicEntity {
  id?: string;
  userId: string;
  sessionId: string;
  entityType: string;
  content: string;
  properties?: any;
  evidence?: string | null;
  reasoning?: string | null;
  confidence?: string;
  createdAt?: Date;
}

export async function saveStrategicEntity(data: SecureStrategicEntity) {
  const encrypted = {
    ...data,
    content: encrypt(data.content)!,
    properties: data.properties ? encryptJSON(data.properties) : null,
    evidence: data.evidence ? encrypt(data.evidence) : null,
    reasoning: data.reasoning ? encrypt(data.reasoning) : null,
  };

  const result = await db.insert(strategicEntities)
    .values(encrypted as any)
    .returning();

  return decryptStrategicEntity(result[0]);
}

function decryptStrategicEntity(record: any): SecureStrategicEntity {
  return {
    ...record,
    content: decrypt(record.content) || record.content,
    properties: record.properties ? decryptJSON(record.properties) || record.properties : null,
    evidence: record.evidence ? decrypt(record.evidence) || record.evidence : null,
    reasoning: record.reasoning ? decrypt(record.reasoning) || record.reasoning : null,
  };
}

// ==================== EPM PROGRAMS ====================

export interface SecureEPMProgram {
  id?: string;
  userId: string;
  sessionId: string;
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
    programName: data.programName ? encrypt(data.programName) : null,
    executiveSummary: data.executiveSummary ? encrypt(data.executiveSummary) : null,
    workstreams: data.workstreams ? encryptJSON(data.workstreams) : null,
    timeline: data.timeline ? encryptJSON(data.timeline) : null,
    resourcePlan: data.resourcePlan ? encryptJSON(data.resourcePlan) : null,
    financialPlan: data.financialPlan ? encryptJSON(data.financialPlan) : null,
    benefitsRealization: data.benefitsRealization ? encryptJSON(data.benefitsRealization) : null,
    riskRegister: data.riskRegister ? encryptJSON(data.riskRegister) : null,
    stakeholderMap: data.stakeholderMap ? encryptJSON(data.stakeholderMap) : null,
    governance: data.governance ? encryptJSON(data.governance) : null,
    qaPlan: data.qaPlan ? encryptJSON(data.qaPlan) : null,
    procurement: data.procurement ? encryptJSON(data.procurement) : null,
    exitStrategy: data.exitStrategy ? encryptJSON(data.exitStrategy) : null,
    kpis: data.kpis ? encryptJSON(data.kpis) : null,
  };

  const result = await db.insert(epmPrograms)
    .values(encrypted as any)
    .returning();

  return decryptEPMProgram(result[0]);
}

export async function updateEPMProgram(id: string, data: Partial<SecureEPMProgram>) {
  const encrypted: any = { ...data };

  if (data.programName !== undefined) encrypted.programName = encrypt(data.programName);
  if (data.executiveSummary !== undefined) encrypted.executiveSummary = encrypt(data.executiveSummary);
  if (data.workstreams !== undefined) encrypted.workstreams = encryptJSON(data.workstreams);
  if (data.timeline !== undefined) encrypted.timeline = encryptJSON(data.timeline);
  if (data.resourcePlan !== undefined) encrypted.resourcePlan = encryptJSON(data.resourcePlan);
  if (data.financialPlan !== undefined) encrypted.financialPlan = encryptJSON(data.financialPlan);
  if (data.benefitsRealization !== undefined) encrypted.benefitsRealization = encryptJSON(data.benefitsRealization);
  if (data.riskRegister !== undefined) encrypted.riskRegister = encryptJSON(data.riskRegister);
  if (data.stakeholderMap !== undefined) encrypted.stakeholderMap = encryptJSON(data.stakeholderMap);
  if (data.governance !== undefined) encrypted.governance = encryptJSON(data.governance);
  if (data.qaPlan !== undefined) encrypted.qaPlan = encryptJSON(data.qaPlan);
  if (data.procurement !== undefined) encrypted.procurement = encryptJSON(data.procurement);
  if (data.exitStrategy !== undefined) encrypted.exitStrategy = encryptJSON(data.exitStrategy);
  if (data.kpis !== undefined) encrypted.kpis = encryptJSON(data.kpis);

  const result = await db.update(epmPrograms)
    .set(encrypted)
    .where(eq(epmPrograms.id, id))
    .returning();

  return result[0] ? decryptEPMProgram(result[0]) : null;
}

export async function getEPMProgram(id: string) {
  const result = await db.select()
    .from(epmPrograms)
    .where(eq(epmPrograms.id, id))
    .limit(1);

  return result[0] ? decryptEPMProgram(result[0]) : null;
}

export async function getEPMProgramsByUser(userId: string) {
  const result = await db.select()
    .from(epmPrograms)
    .where(eq(epmPrograms.userId, userId));

  return result.map(decryptEPMProgram);
}

function decryptEPMProgram(record: any): SecureEPMProgram {
  return {
    ...record,
    programName: record.programName ? decrypt(record.programName) || record.programName : null,
    executiveSummary: record.executiveSummary ? decrypt(record.executiveSummary) || record.executiveSummary : null,
    workstreams: record.workstreams ? decryptJSON(record.workstreams) || record.workstreams : null,
    timeline: record.timeline ? decryptJSON(record.timeline) || record.timeline : null,
    resourcePlan: record.resourcePlan ? decryptJSON(record.resourcePlan) || record.resourcePlan : null,
    financialPlan: record.financialPlan ? decryptJSON(record.financialPlan) || record.financialPlan : null,
    benefitsRealization: record.benefitsRealization ? decryptJSON(record.benefitsRealization) || record.benefitsRealization : null,
    riskRegister: record.riskRegister ? decryptJSON(record.riskRegister) || record.riskRegister : null,
    stakeholderMap: record.stakeholderMap ? decryptJSON(record.stakeholderMap) || record.stakeholderMap : null,
    governance: record.governance ? decryptJSON(record.governance) || record.governance : null,
    qaPlan: record.qaPlan ? decryptJSON(record.qaPlan) || record.qaPlan : null,
    procurement: record.procurement ? decryptJSON(record.procurement) || record.procurement : null,
    exitStrategy: record.exitStrategy ? decryptJSON(record.exitStrategy) || record.exitStrategy : null,
    kpis: record.kpis ? decryptJSON(record.kpis) || record.kpis : null,
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
    analysisData: data.analysisData ? encryptJSON(data.analysisData) : null,
    decisionsData: data.decisionsData ? encryptJSON(data.decisionsData) : null,
  };

  const result = await db.insert(strategyVersions)
    .values(encrypted as any)
    .returning();

  return decryptStrategyVersion(result[0]);
}

export async function updateStrategyVersion(id: string, data: Partial<SecureStrategyVersion>) {
  const encrypted: any = { ...data };

  if (data.analysisData !== undefined) {
    encrypted.analysisData = encryptJSON(data.analysisData);
  }
  if (data.decisionsData !== undefined) {
    encrypted.decisionsData = encryptJSON(data.decisionsData);
  }

  encrypted.updatedAt = new Date();

  const result = await db.update(strategyVersions)
    .set(encrypted)
    .where(eq(strategyVersions.id, id))
    .returning();

  return result[0] ? decryptStrategyVersion(result[0]) : null;
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

  return result[0] ? decryptStrategyVersion(result[0]) : null;
}

function decryptStrategyVersion(record: any): SecureStrategyVersion {
  return {
    ...record,
    analysisData: record.analysisData ? decryptJSON(record.analysisData) || record.analysisData : null,
    decisionsData: record.decisionsData ? decryptJSON(record.decisionsData) || record.decisionsData : null,
  };
}
