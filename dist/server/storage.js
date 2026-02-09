import { db } from "./db";
import { users, programs, workstreams, resources, stageGates, stageGateReviews, tasks, kpis, kpiMeasurements, risks, riskMitigations, benefits, fundingSources, expenses, sessionContext, strategyVersions, epmPrograms, strategicUnderstanding, journeySessions, goldenRecords, goldenRecordChecks, locations } from "@shared/schema";
import { eq, desc, and, isNull, not, count, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { ontologyService } from "./ontology-service";
import { getStrategicUnderstandingBySession } from "./services/secure-data-service";
import { encryptKMS, decryptKMS, encryptJSONKMS, decryptJSONKMS } from "./utils/kms-encryption";
const PostgresSessionStore = connectPg(session);
export class DatabaseStorage {
    sessionStore;
    constructor() {
        this.sessionStore = new PostgresSessionStore({
            pool,
            createTableIfMissing: true
        });
    }
    async validateEntity(entityName, data) {
        const [validation, completeness] = await Promise.all([
            ontologyService.validateEntityData(entityName, data),
            ontologyService.checkCompleteness(entityName, data)
        ]);
        return {
            isValid: validation.isValid,
            errors: validation.errors,
            warnings: validation.warnings,
            completeness: {
                ...completeness,
                percentage: completeness.maxScore > 0 ? Math.round((completeness.score / completeness.maxScore) * 100) : 0
            }
        };
    }
    logValidationResults(entityName, entityId, results) {
        if (results.errors.length > 0) {
            console.warn(`[Validation] ${entityName} ${entityId} has ${results.errors.length} error(s):`, results.errors);
        }
        if (results.warnings.length > 0) {
            console.info(`[Validation] ${entityName} ${entityId} has ${results.warnings.length} warning(s):`, results.warnings);
        }
        console.info(`[Completeness] ${entityName} ${entityId} is ${results.completeness.percentage}% complete (${results.completeness.score}/${results.completeness.maxScore})`);
        if (results.completeness.missingFields.length > 0) {
            console.info(`[Completeness] Missing fields for ${entityName} ${entityId}:`, results.completeness.missingFields.map((f) => `${f.field} (${f.importance})`).join(', '));
        }
    }
    // Helper to decrypt strategy version fields
    async decryptStrategyVersion(version) {
        return {
            ...version,
            inputSummary: version.inputSummary ? await decryptKMS(version.inputSummary) : null,
            analysisData: version.analysisData ? await decryptJSONKMS(version.analysisData) : null,
            decisionsData: version.decisionsData ? await decryptJSONKMS(version.decisionsData) : null,
        };
    }
    // User management
    async getUser(id) {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user || undefined;
    }
    async getUserByUsername(username) {
        // Legacy method - kept for backward compatibility
        return undefined;
    }
    async createUser(insertUser) {
        const [user] = await db.insert(users).values(insertUser).returning();
        return user;
    }
    // Replit Auth user upsert
    async upsertUser(userData) {
        // Check if user exists by email (to handle email unique constraint)
        if (userData.email) {
            const existing = await db
                .select()
                .from(users)
                .where(eq(users.email, userData.email))
                .limit(1);
            if (existing.length > 0) {
                // Update existing user by their current ID
                // CRITICAL: Never update the ID field to avoid FK constraint violations
                const { id, ...updateData } = userData;
                const [user] = await db
                    .update(users)
                    .set({
                    ...updateData,
                    updatedAt: new Date(),
                })
                    .where(eq(users.id, existing[0].id))
                    .returning();
                return user;
            }
        }
        // Insert new user or update if ID conflicts
        // CRITICAL: Never update the ID field to avoid FK constraint violations
        const { id: _, ...updateData } = userData;
        const [user] = await db
            .insert(users)
            .values(userData)
            .onConflictDoUpdate({
            target: users.id,
            set: {
                ...updateData,
                updatedAt: new Date(),
            },
        })
            .returning();
        return user;
    }
    // Location management
    async createLocation(location) {
        const [newLocation] = await db.insert(locations).values(location).returning();
        return newLocation;
    }
    async getLocationsByQuery(rawQuery) {
        return await db.select().from(locations).where(eq(locations.rawQuery, rawQuery));
    }
    async getLocation(id) {
        const [location] = await db.select().from(locations).where(eq(locations.id, id));
        return location || undefined;
    }
    // Program management
    async getPrograms() {
        return await db.select().from(programs).orderBy(desc(programs.createdAt));
    }
    async getProgram(id) {
        const [program] = await db.select().from(programs).where(eq(programs.id, id));
        return program || undefined;
    }
    async createProgram(program) {
        // Validate program data using ontology
        const validationResults = await this.validateEntity('Program', program);
        this.logValidationResults('Program', program.name || 'new', validationResults);
        const [newProgram] = await db.insert(programs).values(program).returning();
        const defaultStageGates = [
            {
                code: 'G0',
                name: 'Ideation',
                description: 'Initial concept development and feasibility assessment',
                successCriteria: 'Business case approved, feasibility confirmed, initial scope defined',
                programId: newProgram.id
            },
            {
                code: 'G1',
                name: 'Planning',
                description: 'Detailed planning and requirements definition',
                successCriteria: 'Requirements documented, project plan approved, resources allocated',
                programId: newProgram.id
            },
            {
                code: 'G2',
                name: 'Execution',
                description: 'Development and implementation phase',
                successCriteria: 'Development complete, quality standards met, documentation updated',
                programId: newProgram.id
            },
            {
                code: 'G3',
                name: 'Validation',
                description: 'Testing and quality assurance',
                successCriteria: 'Testing complete, acceptance criteria met, stakeholder approval received',
                programId: newProgram.id
            },
            {
                code: 'G4',
                name: 'Closure',
                description: 'Deployment and project closeout',
                successCriteria: 'Deployment successful, handover complete, lessons learned documented',
                programId: newProgram.id
            }
        ];
        await db.insert(stageGates).values(defaultStageGates);
        return newProgram;
    }
    // Workstream management
    async getWorkstreams(programId) {
        const query = programId
            ? db.select().from(workstreams).where(eq(workstreams.programId, programId))
            : db.select().from(workstreams);
        return await query.orderBy(desc(workstreams.createdAt));
    }
    async createWorkstream(workstream) {
        const [newWorkstream] = await db.insert(workstreams).values(workstream).returning();
        return newWorkstream;
    }
    // Resource management
    async getResources(programId) {
        const query = programId
            ? db.select().from(resources).where(eq(resources.programId, programId))
            : db.select().from(resources);
        return await query.orderBy(desc(resources.createdAt));
    }
    async createResource(resource) {
        const [newResource] = await db.insert(resources).values(resource).returning();
        return newResource;
    }
    async updateResource(id, resource) {
        const [updatedResource] = await db.update(resources)
            .set(resource)
            .where(eq(resources.id, id))
            .returning();
        return updatedResource;
    }
    // Stage Gates
    async getStageGates(programId) {
        const query = programId
            ? db.select().from(stageGates).where(eq(stageGates.programId, programId))
            : db.select().from(stageGates);
        return await query.orderBy(stageGates.code);
    }
    async createStageGate(gate) {
        // Validate stage gate data using ontology
        const validationResults = await this.validateEntity('StageGate', gate);
        this.logValidationResults('StageGate', gate.name || gate.code || 'new', validationResults);
        const [newGate] = await db.insert(stageGates).values(gate).returning();
        return newGate;
    }
    async getStageGateReviews(programId) {
        const query = programId
            ? db.select().from(stageGateReviews).where(eq(stageGateReviews.programId, programId))
            : db.select().from(stageGateReviews);
        return await query.orderBy(desc(stageGateReviews.reviewDate));
    }
    async createStageGateReview(review) {
        const [newReview] = await db.insert(stageGateReviews).values(review).returning();
        return newReview;
    }
    // Tasks
    async getTasks(programId, workstreamId) {
        if (workstreamId) {
            return await db.select().from(tasks)
                .where(eq(tasks.workstreamId, workstreamId))
                .orderBy(desc(tasks.createdAt));
        }
        else if (programId) {
            // Join with workstreams to filter by program
            const result = await db.select({
                id: tasks.id,
                name: tasks.name,
                description: tasks.description,
                workstreamId: tasks.workstreamId,
                ownerId: tasks.ownerId,
                stageGateId: tasks.stageGateId,
                startDate: tasks.startDate,
                endDate: tasks.endDate,
                status: tasks.status,
                progress: tasks.progress,
                priority: tasks.priority,
                createdAt: tasks.createdAt,
            })
                .from(tasks)
                .leftJoin(workstreams, eq(tasks.workstreamId, workstreams.id))
                .where(eq(workstreams.programId, programId))
                .orderBy(desc(tasks.createdAt));
            return result;
        }
        return await db.select().from(tasks).orderBy(desc(tasks.createdAt));
    }
    async getTask(id) {
        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        return task || undefined;
    }
    async createTask(task) {
        // Validate task data using ontology
        const validationResults = await this.validateEntity('Task', task);
        this.logValidationResults('Task', task.name || 'new', validationResults);
        const [newTask] = await db.insert(tasks).values(task).returning();
        return newTask;
    }
    async updateTask(id, task) {
        const [updatedTask] = await db.update(tasks)
            .set(task)
            .where(eq(tasks.id, id))
            .returning();
        return updatedTask;
    }
    async deleteTask(id) {
        await db.delete(tasks).where(eq(tasks.id, id));
    }
    // KPIs
    async getKpis(programId) {
        const query = programId
            ? db.select().from(kpis).where(eq(kpis.programId, programId))
            : db.select().from(kpis);
        return await query.orderBy(desc(kpis.createdAt));
    }
    async getKpiMeasurements(kpiId) {
        return await db.select()
            .from(kpiMeasurements)
            .where(eq(kpiMeasurements.kpiId, kpiId))
            .orderBy(desc(kpiMeasurements.measurementDate));
    }
    async createKpi(kpi) {
        const [newKpi] = await db.insert(kpis).values(kpi).returning();
        return newKpi;
    }
    async updateKpi(id, kpi) {
        const [updatedKpi] = await db.update(kpis)
            .set(kpi)
            .where(eq(kpis.id, id))
            .returning();
        return updatedKpi;
    }
    async createKpiMeasurement(measurement) {
        const [newMeasurement] = await db.insert(kpiMeasurements).values(measurement).returning();
        return newMeasurement;
    }
    // Risks
    async getRisks(programId) {
        const query = programId
            ? db.select().from(risks).where(eq(risks.programId, programId))
            : db.select().from(risks);
        return await query.orderBy(desc(risks.createdAt));
    }
    async getRisk(id) {
        const [risk] = await db.select().from(risks).where(eq(risks.id, id));
        return risk || undefined;
    }
    async createRisk(risk) {
        const [newRisk] = await db.insert(risks).values(risk).returning();
        return newRisk;
    }
    async updateRisk(id, risk) {
        const [updatedRisk] = await db.update(risks)
            .set(risk)
            .where(eq(risks.id, id))
            .returning();
        return updatedRisk;
    }
    async getRiskMitigations(riskId) {
        return await db.select()
            .from(riskMitigations)
            .where(eq(riskMitigations.riskId, riskId))
            .orderBy(desc(riskMitigations.actionDate));
    }
    async createRiskMitigation(mitigation) {
        const [newMitigation] = await db.insert(riskMitigations).values(mitigation).returning();
        return newMitigation;
    }
    // Benefits
    async getBenefits(programId) {
        const query = programId
            ? db.select().from(benefits).where(eq(benefits.programId, programId))
            : db.select().from(benefits);
        return await query.orderBy(desc(benefits.createdAt));
    }
    async createBenefit(benefit) {
        const [newBenefit] = await db.insert(benefits).values(benefit).returning();
        return newBenefit;
    }
    async updateBenefit(id, benefit) {
        const [updatedBenefit] = await db.update(benefits)
            .set(benefit)
            .where(eq(benefits.id, id))
            .returning();
        return updatedBenefit;
    }
    // Funding
    async getFundingSources(programId) {
        const query = programId
            ? db.select().from(fundingSources).where(eq(fundingSources.programId, programId))
            : db.select().from(fundingSources);
        return await query.orderBy(desc(fundingSources.createdAt));
    }
    async getExpenses(programId) {
        const query = programId
            ? db.select().from(expenses).where(eq(expenses.programId, programId))
            : db.select().from(expenses);
        return await query.orderBy(desc(expenses.expenseDate));
    }
    async createFundingSource(source) {
        const [newSource] = await db.insert(fundingSources).values(source).returning();
        return newSource;
    }
    async createExpense(expense) {
        const [newExpense] = await db.insert(expenses).values(expense).returning();
        return newExpense;
    }
    // Session Context
    async getActiveSessionContext() {
        const [activeContext] = await db.select()
            .from(sessionContext)
            .where(eq(sessionContext.isActive, true))
            .orderBy(desc(sessionContext.createdAt))
            .limit(1);
        return activeContext || undefined;
    }
    async getSessionContextById(id) {
        const [context] = await db.select()
            .from(sessionContext)
            .where(eq(sessionContext.id, id));
        return context || undefined;
    }
    async createSessionContext(context) {
        // Deactivate any existing active contexts
        await db.update(sessionContext)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(sessionContext.isActive, true));
        const [newContext] = await db.insert(sessionContext).values(context).returning();
        return newContext;
    }
    async updateSessionContext(id, data) {
        const [updatedContext] = await db.update(sessionContext)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(sessionContext.id, id))
            .returning();
        return updatedContext;
    }
    async deactivateSessionContext(id) {
        await db.update(sessionContext)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(sessionContext.id, id));
    }
    async addDecisionToContext(id, decision) {
        const [existing] = await db.select().from(sessionContext).where(eq(sessionContext.id, id));
        if (!existing) {
            throw new Error(`SessionContext with id ${id} not found`);
        }
        const currentLog = existing.decisionsLog || [];
        const updatedLog = [...currentLog, { ...decision, timestamp: new Date().toISOString() }];
        const [updated] = await db.update(sessionContext)
            .set({ decisionsLog: updatedLog, updatedAt: new Date() })
            .where(eq(sessionContext.id, id))
            .returning();
        return updated;
    }
    // Strategy Versions
    async getStrategyVersionsBySession(sessionId) {
        const versions = await db.select()
            .from(strategyVersions)
            .where(eq(strategyVersions.sessionId, sessionId))
            .orderBy(desc(strategyVersions.versionNumber));
        return await Promise.all(versions.map(v => this.decryptStrategyVersion(v)));
    }
    async getAllStrategyVersionsByUser(userId) {
        const versions = await db.select()
            .from(strategyVersions)
            .where(eq(strategyVersions.userId, userId))
            .orderBy(desc(strategyVersions.createdAt));
        return await Promise.all(versions.map(v => this.decryptStrategyVersion(v)));
    }
    async getStrategyVersion(sessionId, versionNumber) {
        const [version] = await db.select()
            .from(strategyVersions)
            .where(and(eq(strategyVersions.sessionId, sessionId), eq(strategyVersions.versionNumber, versionNumber)));
        if (!version)
            return undefined;
        return await this.decryptStrategyVersion(version);
    }
    async getStrategyVersionById(id) {
        const [version] = await db.select()
            .from(strategyVersions)
            .where(eq(strategyVersions.id, id))
            .limit(1);
        if (!version)
            return undefined;
        return await this.decryptStrategyVersion(version);
    }
    async createStrategyVersion(version) {
        // Encrypt sensitive fields if they exist
        const dataToInsert = { ...version };
        if (version.inputSummary) {
            dataToInsert.inputSummary = await encryptKMS(version.inputSummary);
        }
        if (version.analysisData) {
            dataToInsert.analysisData = await encryptJSONKMS(version.analysisData);
        }
        if (version.decisionsData) {
            dataToInsert.decisionsData = await encryptJSONKMS(version.decisionsData);
        }
        const result = await db.insert(strategyVersions).values(dataToInsert).returning();
        return result[0];
    }
    async getInitiativeDescriptionForSession(sessionId) {
        // Use secure service to get decrypted data
        const understanding = await getStrategicUnderstandingBySession(sessionId);
        return understanding?.initiativeDescription || null;
    }
    async updateStrategyVersion(id, data) {
        // Encrypt sensitive fields if they exist in the data parameter
        const dataToUpdate = { ...data };
        if (data.inputSummary !== undefined) {
            dataToUpdate.inputSummary = data.inputSummary ? await encryptKMS(data.inputSummary) : null;
        }
        if (data.analysisData !== undefined) {
            dataToUpdate.analysisData = data.analysisData ? await encryptJSONKMS(data.analysisData) : null;
        }
        if (data.decisionsData !== undefined) {
            dataToUpdate.decisionsData = data.decisionsData ? await encryptJSONKMS(data.decisionsData) : null;
        }
        const [updated] = await db.update(strategyVersions)
            .set({ ...dataToUpdate, updatedAt: new Date() })
            .where(eq(strategyVersions.id, id))
            .returning();
        return updated;
    }
    async getDashboardSummary(userId) {
        try {
            // Get counts (filter out archived items)
            const counts = await Promise.all([
                // Count analyses (DISTINCT strategic_understanding records) via journey sessions - matches repository logic
                db.select({ count: sql `COUNT(DISTINCT ${strategicUnderstanding.id})` })
                    .from(strategicUnderstanding)
                    .innerJoin(journeySessions, and(eq(strategicUnderstanding.id, journeySessions.understandingId), eq(journeySessions.userId, userId)))
                    .where(eq(strategicUnderstanding.archived, false)),
                // Count strategic_understanding records (strategies) via journey sessions for ownership
                db.select({ count: sql `COUNT(DISTINCT ${strategicUnderstanding.id})` })
                    .from(strategicUnderstanding)
                    .innerJoin(journeySessions, and(eq(strategicUnderstanding.id, journeySessions.understandingId), eq(journeySessions.userId, userId)))
                    .where(eq(strategicUnderstanding.archived, false)),
                db.select({ count: count() })
                    .from(epmPrograms)
                    .where(and(eq(epmPrograms.userId, userId), eq(epmPrograms.archived, false)))
            ]);
            const [analysesCount] = counts[0];
            const [strategiesCount] = counts[1];
            const [programsCount] = counts[2];
            // Fetch recent artifacts (analyses and programs)
            const [recentAnalyses, recentPrograms] = await Promise.all([
                // Recent strategy versions (analyses)
                db.select({
                    id: strategyVersions.id,
                    inputSummary: strategyVersions.inputSummary,
                    createdAt: strategyVersions.createdAt,
                })
                    .from(strategyVersions)
                    .where(and(eq(strategyVersions.userId, userId), eq(strategyVersions.archived, false)))
                    .orderBy(desc(strategyVersions.createdAt))
                    .limit(5),
                // Recent EPM programs
                db.select({
                    id: epmPrograms.id,
                    executiveSummary: epmPrograms.executiveSummary,
                    createdAt: epmPrograms.createdAt,
                })
                    .from(epmPrograms)
                    .where(and(eq(epmPrograms.userId, userId), eq(epmPrograms.archived, false)))
                    .orderBy(desc(epmPrograms.createdAt))
                    .limit(5)
            ]);
            // Decrypt and format analyses
            const { decryptKMS } = await import('./utils/kms-encryption');
            const formattedAnalyses = await Promise.all(recentAnalyses.map(async (analysis) => {
                const decryptedSummary = analysis.inputSummary
                    ? await decryptKMS(analysis.inputSummary)
                    : 'Strategic Analysis';
                return {
                    id: analysis.id,
                    type: 'analysis',
                    title: decryptedSummary || 'Strategic Analysis',
                    createdAt: analysis.createdAt?.toISOString() || new Date().toISOString(),
                    link: `/repository?highlight=${analysis.id}`
                };
            }));
            // Format programs
            const formattedPrograms = recentPrograms.map((program) => {
                const executiveSummary = program.executiveSummary;
                const title = executiveSummary?.title || 'EPM Program';
                return {
                    id: program.id,
                    type: 'program',
                    title,
                    createdAt: program.createdAt?.toISOString() || new Date().toISOString(),
                    link: `/strategy-workspace/epm/${program.id}`
                };
            });
            // Combine and sort by date (most recent first)
            const allArtifacts = [...formattedAnalyses, ...formattedPrograms]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 5); // Take only top 5
            return {
                counts: {
                    analyses: analysesCount?.count || 0,
                    strategies: strategiesCount?.count || 0,
                    programs: programsCount?.count || 0,
                },
                recentArtifacts: allArtifacts
            };
        }
        catch (error) {
            console.error('Error fetching dashboard summary:', error);
            throw new Error('Failed to fetch dashboard summary');
        }
    }
    /**
     * Atomically start integration - prevents concurrent integrations
     * Returns the version if successful, null if already integrating/integrated
     */
    async tryStartIntegration(versionId) {
        const [updated] = await db.update(strategyVersions)
            .set({ status: 'converting', updatedAt: new Date() })
            .where(and(eq(strategyVersions.id, versionId), isNull(strategyVersions.convertedProgramId), not(eq(strategyVersions.status, 'converting'))))
            .returning();
        return updated || null;
    }
    // Golden Records
    async createGoldenRecord(record) {
        // Auto-increment version number for the journey type
        const existing = await db
            .select()
            .from(goldenRecords)
            .where(eq(goldenRecords.journeyType, record.journeyType))
            .orderBy(desc(goldenRecords.version));
        const nextVersion = existing.length > 0 ? existing[0].version + 1 : 1;
        const newRecord = {
            ...record,
            version: nextVersion,
        };
        // If promoteAsCurrent is true, unset current flag on existing records
        if (record.promoteAsCurrent) {
            await db
                .update(goldenRecords)
                .set({ isCurrent: false })
                .where(and(eq(goldenRecords.journeyType, record.journeyType), eq(goldenRecords.isCurrent, true)));
            newRecord.isCurrent = true;
            delete newRecord.promoteAsCurrent;
        }
        const [created] = await db.insert(goldenRecords).values(newRecord).returning();
        return created;
    }
    async listGoldenRecords(journeyType, includeHistory) {
        let query = db.select().from(goldenRecords);
        if (journeyType) {
            query = query.where(eq(goldenRecords.journeyType, journeyType));
        }
        if (!includeHistory) {
            query = query.where(eq(goldenRecords.isCurrent, true));
        }
        const records = await query.orderBy(desc(goldenRecords.createdAt));
        return records;
    }
    async getGoldenRecord(journeyType, version) {
        const [record] = await db
            .select()
            .from(goldenRecords)
            .where(and(eq(goldenRecords.journeyType, journeyType), eq(goldenRecords.version, version)));
        return record || undefined;
    }
    async getCurrentGoldenRecord(journeyType) {
        const [record] = await db
            .select()
            .from(goldenRecords)
            .where(and(eq(goldenRecords.journeyType, journeyType), eq(goldenRecords.isCurrent, true)));
        return record || undefined;
    }
    async promoteGoldenRecord(journeyType, version) {
        // Unset current flag on all records for this journey type
        await db
            .update(goldenRecords)
            .set({ isCurrent: false })
            .where(eq(goldenRecords.journeyType, journeyType));
        // Set the specified version as current
        const [promoted] = await db
            .update(goldenRecords)
            .set({ isCurrent: true })
            .where(and(eq(goldenRecords.journeyType, journeyType), eq(goldenRecords.version, version)))
            .returning();
        return promoted;
    }
    async compareGoldenRecords(journeyType, version1, version2) {
        const [record1, record2] = await Promise.all([
            this.getGoldenRecord(journeyType, version1),
            this.getGoldenRecord(journeyType, version2),
        ]);
        if (!record1 || !record2) {
            throw new Error('One or both golden records not found');
        }
        // Simple diff summary - this can be enhanced with more sophisticated diff logic
        const stepDiffs = [];
        const steps1 = record1.steps || [];
        const steps2 = record2.steps || [];
        const maxSteps = Math.max(steps1.length, steps2.length);
        for (let i = 0; i < maxSteps; i++) {
            const step1 = steps1[i];
            const step2 = steps2[i];
            if (!step1) {
                stepDiffs.push({
                    stepNumber: i + 1,
                    changeType: 'added',
                    v1Step: null,
                    v2Step: step2,
                });
            }
            else if (!step2) {
                stepDiffs.push({
                    stepNumber: i + 1,
                    changeType: 'removed',
                    v1Step: step1,
                    v2Step: null,
                });
            }
            else if (JSON.stringify(step1) !== JSON.stringify(step2)) {
                const differences = [];
                if (step1.stepName !== step2.stepName) {
                    differences.push({
                        field: 'stepName',
                        v1Value: step1.stepName,
                        v2Value: step2.stepName,
                    });
                }
                if (step1.expectedUrl !== step2.expectedUrl) {
                    differences.push({
                        field: 'expectedUrl',
                        v1Value: step1.expectedUrl,
                        v2Value: step2.expectedUrl,
                    });
                }
                if (JSON.stringify(step1.requestPayload) !== JSON.stringify(step2.requestPayload)) {
                    differences.push({
                        field: 'requestPayload',
                        v1Value: step1.requestPayload,
                        v2Value: step2.requestPayload,
                    });
                }
                if (JSON.stringify(step1.responsePayload) !== JSON.stringify(step2.responsePayload)) {
                    differences.push({
                        field: 'responsePayload',
                        v1Value: step1.responsePayload,
                        v2Value: step2.responsePayload,
                    });
                }
                if (JSON.stringify(step1.dbSnapshot) !== JSON.stringify(step2.dbSnapshot)) {
                    differences.push({
                        field: 'dbSnapshot',
                        v1Value: step1.dbSnapshot,
                        v2Value: step2.dbSnapshot,
                    });
                }
                if (step1.observations !== step2.observations) {
                    differences.push({
                        field: 'observations',
                        v1Value: step1.observations,
                        v2Value: step2.observations,
                    });
                }
                stepDiffs.push({
                    stepNumber: i + 1,
                    changeType: 'modified',
                    v1Step: step1,
                    v2Step: step2,
                    differences,
                });
            }
            else {
                stepDiffs.push({
                    stepNumber: i + 1,
                    changeType: 'unchanged',
                    v1Step: step1,
                    v2Step: step2,
                });
            }
        }
        return {
            journeyType,
            version1,
            version2,
            totalSteps1: steps1.length,
            totalSteps2: steps2.length,
            stepDiffs,
            summary: {
                totalSteps: maxSteps,
                added: stepDiffs.filter(d => d.changeType === 'added').length,
                removed: stepDiffs.filter(d => d.changeType === 'removed').length,
                modified: stepDiffs.filter(d => d.changeType === 'modified').length,
                unchanged: stepDiffs.filter(d => d.changeType === 'unchanged').length,
            }
        };
    }
    async createGoldenRecordCheck(check) {
        const [created] = await db.insert(goldenRecordChecks).values(check).returning();
        return created;
    }
}
export const storage = new DatabaseStorage();
//# sourceMappingURL=storage.js.map