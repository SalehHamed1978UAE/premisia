import { db } from '../db';
import { strategicUnderstanding, journeySessions, epmPrograms, strategicEntities, strategicRelationships, strategyVersions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { encryptKMS, decryptKMS, encryptJSONKMS, decryptJSONKMS } from '../utils/kms-encryption';
export async function saveStrategicUnderstanding(data) {
    const encrypted = {
        ...data,
        userInput: await encryptKMS(data.userInput),
        companyContext: data.companyContext ? await encryptJSONKMS(data.companyContext) : null,
        initiativeDescription: data.initiativeDescription ? await encryptKMS(data.initiativeDescription) : null,
    };
    const result = await db.insert(strategicUnderstanding)
        .values(encrypted)
        .returning();
    return await decryptStrategicUnderstanding(result[0]);
}
export async function updateStrategicUnderstanding(id, data) {
    const encrypted = { ...data };
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
export async function getStrategicUnderstanding(id) {
    const result = await db.select()
        .from(strategicUnderstanding)
        .where(eq(strategicUnderstanding.id, id))
        .limit(1);
    return result[0] ? await decryptStrategicUnderstanding(result[0]) : null;
}
export async function getStrategicUnderstandingBySession(sessionId) {
    const result = await db.select()
        .from(strategicUnderstanding)
        .where(eq(strategicUnderstanding.sessionId, sessionId))
        .limit(1);
    return result[0] ? await decryptStrategicUnderstanding(result[0]) : null;
}
async function decryptStrategicUnderstanding(record) {
    return {
        ...record,
        userInput: await decryptKMS(record.userInput) || record.userInput,
        companyContext: record.companyContext ? await decryptJSONKMS(record.companyContext) || record.companyContext : null,
        initiativeDescription: record.initiativeDescription ? await decryptKMS(record.initiativeDescription) || record.initiativeDescription : null,
    };
}
export async function saveJourneySession(data) {
    const encrypted = {
        ...data,
        accumulatedContext: data.accumulatedContext ? await encryptJSONKMS(data.accumulatedContext) : null,
    };
    const result = await db.insert(journeySessions)
        .values(encrypted)
        .returning();
    return await decryptJourneySession(result[0]);
}
export async function updateJourneySession(id, data) {
    const encrypted = { ...data };
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
export async function getJourneySession(id) {
    const result = await db.select()
        .from(journeySessions)
        .where(eq(journeySessions.id, id))
        .limit(1);
    return result[0] ? await decryptJourneySession(result[0]) : null;
}
export async function getJourneySessionByUnderstandingSessionId(understandingSessionId) {
    // First find the understanding by session ID
    const understanding = await getStrategicUnderstandingBySession(understandingSessionId);
    if (!understanding) {
        return null;
    }
    // Then find the journey session by understanding ID
    const result = await db.select()
        .from(journeySessions)
        .where(eq(journeySessions.understandingId, understanding.id))
        .limit(1);
    return result[0] ? await decryptJourneySession(result[0]) : null;
}
async function decryptJourneySession(record) {
    return {
        ...record,
        accumulatedContext: record.accumulatedContext ? await decryptJSONKMS(record.accumulatedContext) || record.accumulatedContext : null,
    };
}
export async function saveStrategicEntity(data) {
    const encrypted = {
        ...data,
        claim: await encryptKMS(data.claim),
        source: await encryptKMS(data.source),
        evidence: data.evidence ? await encryptKMS(data.evidence) : null,
        category: data.category ? await encryptKMS(data.category) : null,
        subcategory: data.subcategory ? await encryptKMS(data.subcategory) : null,
        metadata: data.metadata ? await encryptJSONKMS(data.metadata) : null,
    };
    const result = await db.insert(strategicEntities)
        .values(encrypted)
        .returning();
    return await decryptStrategicEntity(result[0]);
}
export async function getStrategicEntitiesByUnderstanding(understandingId) {
    const result = await db.select()
        .from(strategicEntities)
        .where(eq(strategicEntities.understandingId, understandingId));
    return Promise.all(result.map(decryptStrategicEntity));
}
async function decryptStrategicEntity(record) {
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
export async function saveStrategicRelationship(data) {
    const encrypted = {
        ...data,
        evidence: data.evidence ? await encryptKMS(data.evidence) : null,
        metadata: data.metadata ? await encryptJSONKMS(data.metadata) : null,
    };
    const result = await db.insert(strategicRelationships)
        .values(encrypted)
        .returning();
    return await decryptStrategicRelationship(result[0]);
}
async function decryptStrategicRelationship(record) {
    return {
        ...record,
        evidence: record.evidence ? await decryptKMS(record.evidence) || record.evidence : null,
        metadata: record.metadata ? await decryptJSONKMS(record.metadata) || record.metadata : null,
    };
}
export async function saveEPMProgram(data) {
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
        .values(encrypted)
        .returning();
    return await decryptEPMProgram(result[0]);
}
export async function updateEPMProgram(id, data) {
    const encrypted = { ...data };
    if (data.programName !== undefined)
        encrypted.programName = await encryptKMS(data.programName);
    if (data.executiveSummary !== undefined)
        encrypted.executiveSummary = await encryptKMS(data.executiveSummary);
    if (data.workstreams !== undefined)
        encrypted.workstreams = await encryptJSONKMS(data.workstreams);
    if (data.timeline !== undefined)
        encrypted.timeline = await encryptJSONKMS(data.timeline);
    if (data.resourcePlan !== undefined)
        encrypted.resourcePlan = await encryptJSONKMS(data.resourcePlan);
    if (data.financialPlan !== undefined)
        encrypted.financialPlan = await encryptJSONKMS(data.financialPlan);
    if (data.benefitsRealization !== undefined)
        encrypted.benefitsRealization = await encryptJSONKMS(data.benefitsRealization);
    if (data.riskRegister !== undefined)
        encrypted.riskRegister = await encryptJSONKMS(data.riskRegister);
    if (data.stakeholderMap !== undefined)
        encrypted.stakeholderMap = await encryptJSONKMS(data.stakeholderMap);
    if (data.governance !== undefined)
        encrypted.governance = await encryptJSONKMS(data.governance);
    if (data.qaPlan !== undefined)
        encrypted.qaPlan = await encryptJSONKMS(data.qaPlan);
    if (data.procurement !== undefined)
        encrypted.procurement = await encryptJSONKMS(data.procurement);
    if (data.exitStrategy !== undefined)
        encrypted.exitStrategy = await encryptJSONKMS(data.exitStrategy);
    if (data.kpis !== undefined)
        encrypted.kpis = await encryptJSONKMS(data.kpis);
    const result = await db.update(epmPrograms)
        .set(encrypted)
        .where(eq(epmPrograms.id, id))
        .returning();
    return result[0] ? await decryptEPMProgram(result[0]) : null;
}
export async function getEPMProgram(id) {
    const result = await db.select()
        .from(epmPrograms)
        .where(eq(epmPrograms.id, id))
        .limit(1);
    return result[0] ? await decryptEPMProgram(result[0]) : null;
}
export async function getEPMProgramsByUser(userId) {
    const result = await db.select()
        .from(epmPrograms)
        .where(eq(epmPrograms.userId, userId));
    return Promise.all(result.map(decryptEPMProgram));
}
async function decryptEPMProgram(record) {
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
export async function saveStrategyVersion(data) {
    const encrypted = {
        ...data,
        inputSummary: data.inputSummary ? await encryptKMS(data.inputSummary) : null,
        analysisData: data.analysisData ? await encryptJSONKMS(data.analysisData) : null,
        decisionsData: data.decisionsData ? await encryptJSONKMS(data.decisionsData) : null,
    };
    const result = await db.insert(strategyVersions)
        .values(encrypted)
        .returning();
    return await decryptStrategyVersion(result[0]);
}
export async function updateStrategyVersion(id, data) {
    const encrypted = { ...data };
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
export async function getStrategyVersion(sessionId, versionNumber) {
    const result = await db.select()
        .from(strategyVersions)
        .where(and(eq(strategyVersions.sessionId, sessionId), eq(strategyVersions.versionNumber, versionNumber)))
        .limit(1);
    return result[0] ? await decryptStrategyVersion(result[0]) : null;
}
async function decryptStrategyVersion(record) {
    return {
        ...record,
        inputSummary: record.inputSummary ? await decryptKMS(record.inputSummary) || record.inputSummary : null,
        analysisData: record.analysisData ? await decryptJSONKMS(record.analysisData) || record.analysisData : null,
        decisionsData: record.decisionsData ? await decryptJSONKMS(record.decisionsData) || record.decisionsData : null,
    };
}
//# sourceMappingURL=secure-data-service.js.map