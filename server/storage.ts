import { db } from "./db";
import { 
  users, programs, workstreams, resources, stageGates, stageGateReviews, 
  tasks, taskDependencies, kpis, kpiMeasurements, risks, riskMitigations,
  benefits, fundingSources, expenses, sessionContext, strategyVersions,
  strategyDecisions, epmPrograms, strategicUnderstanding, journeySessions, goldenRecords, goldenRecordChecks,
  locations, segmentDiscoveryResults
} from "@shared/schema";
import type { 
  User, InsertUser, UpsertUser, Program, Workstream, Resource, StageGate, StageGateReview,
  Task, TaskDependency, Kpi, KpiMeasurement, Risk, RiskMitigation,
  Benefit, FundingSource, Expense, SessionContext, InsertSessionContext, StrategyVersion,
  Location, InsertLocation
} from "@shared/schema";
import { eq, desc, and, isNull, not, count, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import type { Store } from "express-session";
import { ontologyService } from "./ontology-service";
import type { EPMEntity } from "@shared/ontology";
import { getStrategicUnderstandingBySession } from "./services/secure-data-service";
import { encryptKMS, decryptKMS, encryptJSONKMS, decryptJSONKMS } from "./utils/kms-encryption";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>; // For Replit Auth
  
  // Location management
  createLocation(location: InsertLocation): Promise<Location>;
  getLocationsByQuery(rawQuery: string): Promise<Location[]>;
  getLocation(id: string): Promise<Location | undefined>;
  
  // Program management
  getPrograms(): Promise<Program[]>;
  getProgram(id: string): Promise<Program | undefined>;
  createProgram(program: any): Promise<Program>;
  
  // Workstream management
  getWorkstreams(programId?: string): Promise<Workstream[]>;
  createWorkstream(workstream: any): Promise<Workstream>;
  
  // Resource management
  getResources(programId?: string): Promise<Resource[]>;
  createResource(resource: any): Promise<Resource>;
  updateResource(id: string, resource: any): Promise<Resource>;
  
  // Stage Gates
  getStageGates(programId?: string): Promise<StageGate[]>;
  createStageGate(gate: any): Promise<StageGate>;
  getStageGateReviews(programId?: string): Promise<StageGateReview[]>;
  createStageGateReview(review: any): Promise<StageGateReview>;
  
  // Tasks
  getTasks(programId?: string, workstreamId?: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: any): Promise<Task>;
  updateTask(id: string, task: any): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  
  // KPIs
  getKpis(programId?: string): Promise<Kpi[]>;
  getKpiMeasurements(kpiId: string): Promise<KpiMeasurement[]>;
  createKpi(kpi: any): Promise<Kpi>;
  updateKpi(id: string, kpi: any): Promise<Kpi>;
  createKpiMeasurement(measurement: any): Promise<KpiMeasurement>;
  
  // Risks
  getRisks(programId?: string): Promise<Risk[]>;
  getRisk(id: string): Promise<Risk | undefined>;
  createRisk(risk: any): Promise<Risk>;
  updateRisk(id: string, risk: any): Promise<Risk>;
  getRiskMitigations(riskId: string): Promise<RiskMitigation[]>;
  createRiskMitigation(mitigation: any): Promise<RiskMitigation>;
  
  // Benefits
  getBenefits(programId?: string): Promise<Benefit[]>;
  createBenefit(benefit: any): Promise<Benefit>;
  updateBenefit(id: string, benefit: any): Promise<Benefit>;
  
  // Funding
  getFundingSources(programId?: string): Promise<FundingSource[]>;
  getExpenses(programId?: string): Promise<Expense[]>;
  createFundingSource(source: any): Promise<FundingSource>;
  createExpense(expense: any): Promise<Expense>;

  // Session Context
  getActiveSessionContext(): Promise<SessionContext | undefined>;
  getSessionContextById(id: string): Promise<SessionContext | undefined>;
  createSessionContext(context: InsertSessionContext): Promise<SessionContext>;
  updateSessionContext(id: string, data: Partial<InsertSessionContext>): Promise<SessionContext>;
  deactivateSessionContext(id: string): Promise<void>;
  addDecisionToContext(id: string, decision: any): Promise<SessionContext>;

  // Strategy Versions
  getStrategyVersionsBySession(sessionId: string): Promise<any[]>;
  getStrategyVersion(sessionId: string, versionNumber: number): Promise<any | undefined>;
  getStrategyVersionById(id: string): Promise<any | undefined>;
  createStrategyVersion(version: any): Promise<any>;
  updateStrategyVersion(id: string, data: any): Promise<any>;

  // Dashboard
  getDashboardSummary(userId: string): Promise<{
    counts: {
      analyses: number;
      strategies: number;
      programs: number;
      segments: number;
    };
    recentArtifacts: Array<{
      id: string;
      type: 'analysis' | 'strategy' | 'program';
      title: string;
      createdAt: Date;
      link: string;
    }>;
  }>;

  // Golden Records
  createGoldenRecord(record: any): Promise<any>;
  listGoldenRecords(journeyType?: string, includeHistory?: boolean): Promise<any[]>;
  getGoldenRecord(journeyType: string, version: number): Promise<any | undefined>;
  getCurrentGoldenRecord(journeyType: string): Promise<any | undefined>;
  promoteGoldenRecord(journeyType: string, version: number): Promise<any>;
  compareGoldenRecords(journeyType: string, version1: number, version2: number): Promise<any>;
  createGoldenRecordCheck(check: any): Promise<any>;

  sessionStore: Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  private async validateEntity(entityName: EPMEntity, data: any): Promise<{
    isValid: boolean;
    errors: Array<{ rule: string; message: string; autoFix?: string }>;
    warnings: Array<{ rule: string; message: string }>;
    completeness: {
      score: number;
      maxScore: number;
      percentage: number;
      missingFields: Array<{ field: string; importance: string; description: string }>;
    };
  }> {
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

  private logValidationResults(entityName: string, entityId: string, results: any) {
    if (results.errors.length > 0) {
      console.warn(`[Validation] ${entityName} ${entityId} has ${results.errors.length} error(s):`, results.errors);
    }
    if (results.warnings.length > 0) {
      console.info(`[Validation] ${entityName} ${entityId} has ${results.warnings.length} warning(s):`, results.warnings);
    }
    console.info(`[Completeness] ${entityName} ${entityId} is ${results.completeness.percentage}% complete (${results.completeness.score}/${results.completeness.maxScore})`);
    if (results.completeness.missingFields.length > 0) {
      console.info(`[Completeness] Missing fields for ${entityName} ${entityId}:`, results.completeness.missingFields.map((f: any) => `${f.field} (${f.importance})`).join(', '));
    }
  }

  // Helper to decrypt strategy version fields
  private async decryptStrategyVersion(version: StrategyVersion): Promise<StrategyVersion> {
    // Helper to check if data is encrypted (KMS envelope format)
    const isEncrypted = (data: any): boolean => {
      if (!data || typeof data !== 'object') return false;
      return 'dataKeyCiphertext' in data && 'iv' in data && 'authTag' in data && 'ciphertext' in data;
    };
    
    // Only decrypt if data is actually encrypted; otherwise return as-is (already decrypted)
    let decryptedAnalysis = version.analysisData;
    if (version.analysisData && isEncrypted(version.analysisData)) {
      // PostgreSQL JSONB returns objects, but KMS functions expect JSON strings
      const analysisDataStr = JSON.stringify(version.analysisData);
      decryptedAnalysis = await decryptJSONKMS(analysisDataStr);
    }
    
    let decryptedDecisions = version.decisionsData;
    if (version.decisionsData && isEncrypted(version.decisionsData)) {
      const decisionsDataStr = JSON.stringify(version.decisionsData);
      decryptedDecisions = await decryptJSONKMS(decisionsDataStr);
    }
    
    return {
      ...version,
      inputSummary: version.inputSummary ? await decryptKMS(version.inputSummary as string) : null,
      analysisData: decryptedAnalysis,
      decisionsData: decryptedDecisions,
    };
  }

  // User management
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Legacy method - kept for backward compatibility
    return undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Replit Auth user upsert
  async upsertUser(userData: UpsertUser): Promise<User> {
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
  async createLocation(location: InsertLocation): Promise<Location> {
    const [newLocation] = await db.insert(locations).values(location).returning();
    return newLocation;
  }

  async getLocationsByQuery(rawQuery: string): Promise<Location[]> {
    return await db.select().from(locations).where(eq(locations.rawQuery, rawQuery));
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location || undefined;
  }

  // Program management
  async getPrograms(): Promise<Program[]> {
    return await db.select().from(programs).orderBy(desc(programs.createdAt));
  }

  async getProgram(id: string): Promise<Program | undefined> {
    const [program] = await db.select().from(programs).where(eq(programs.id, id));
    return program || undefined;
  }

  async createProgram(program: any): Promise<Program> {
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
  async getWorkstreams(programId?: string): Promise<Workstream[]> {
    const query = programId 
      ? db.select().from(workstreams).where(eq(workstreams.programId, programId))
      : db.select().from(workstreams);
    return await query.orderBy(desc(workstreams.createdAt));
  }

  async createWorkstream(workstream: any): Promise<Workstream> {
    const [newWorkstream] = await db.insert(workstreams).values(workstream).returning();
    return newWorkstream;
  }

  // Resource management
  async getResources(programId?: string): Promise<Resource[]> {
    const query = programId 
      ? db.select().from(resources).where(eq(resources.programId, programId))
      : db.select().from(resources);
    return await query.orderBy(desc(resources.createdAt));
  }

  async createResource(resource: any): Promise<Resource> {
    const [newResource] = await db.insert(resources).values(resource).returning();
    return newResource;
  }

  async updateResource(id: string, resource: any): Promise<Resource> {
    const [updatedResource] = await db.update(resources)
      .set(resource)
      .where(eq(resources.id, id))
      .returning();
    return updatedResource;
  }

  // Stage Gates
  async getStageGates(programId?: string): Promise<StageGate[]> {
    const query = programId 
      ? db.select().from(stageGates).where(eq(stageGates.programId, programId))
      : db.select().from(stageGates);
    return await query.orderBy(stageGates.code);
  }

  async createStageGate(gate: any): Promise<StageGate> {
    // Validate stage gate data using ontology
    const validationResults = await this.validateEntity('StageGate', gate);
    this.logValidationResults('StageGate', gate.name || gate.code || 'new', validationResults);
    
    const [newGate] = await db.insert(stageGates).values(gate).returning();
    return newGate;
  }

  async getStageGateReviews(programId?: string): Promise<StageGateReview[]> {
    const query = programId 
      ? db.select().from(stageGateReviews).where(eq(stageGateReviews.programId, programId))
      : db.select().from(stageGateReviews);
    return await query.orderBy(desc(stageGateReviews.reviewDate));
  }

  async createStageGateReview(review: any): Promise<StageGateReview> {
    const [newReview] = await db.insert(stageGateReviews).values(review).returning();
    return newReview;
  }

  // Tasks
  async getTasks(programId?: string, workstreamId?: string): Promise<Task[]> {
    if (workstreamId) {
      return await db.select().from(tasks)
        .where(eq(tasks.workstreamId, workstreamId))
        .orderBy(desc(tasks.createdAt));
    } else if (programId) {
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
      
      return result as Task[];
    }
    
    return await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async createTask(task: any): Promise<Task> {
    // Validate task data using ontology
    const validationResults = await this.validateEntity('Task', task);
    this.logValidationResults('Task', task.name || 'new', validationResults);
    
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: string, task: any): Promise<Task> {
    const [updatedTask] = await db.update(tasks)
      .set(task)
      .where(eq(tasks.id, id))
      .returning();
    return updatedTask;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // KPIs
  async getKpis(programId?: string): Promise<Kpi[]> {
    const query = programId 
      ? db.select().from(kpis).where(eq(kpis.programId, programId))
      : db.select().from(kpis);
    return await query.orderBy(desc(kpis.createdAt));
  }

  async getKpiMeasurements(kpiId: string): Promise<KpiMeasurement[]> {
    return await db.select()
      .from(kpiMeasurements)
      .where(eq(kpiMeasurements.kpiId, kpiId))
      .orderBy(desc(kpiMeasurements.measurementDate));
  }

  async createKpi(kpi: any): Promise<Kpi> {
    const [newKpi] = await db.insert(kpis).values(kpi).returning();
    return newKpi;
  }

  async updateKpi(id: string, kpi: any): Promise<Kpi> {
    const [updatedKpi] = await db.update(kpis)
      .set(kpi)
      .where(eq(kpis.id, id))
      .returning();
    return updatedKpi;
  }

  async createKpiMeasurement(measurement: any): Promise<KpiMeasurement> {
    const [newMeasurement] = await db.insert(kpiMeasurements).values(measurement).returning();
    return newMeasurement;
  }

  // Risks
  async getRisks(programId?: string): Promise<Risk[]> {
    const query = programId 
      ? db.select().from(risks).where(eq(risks.programId, programId))
      : db.select().from(risks);
    return await query.orderBy(desc(risks.createdAt));
  }

  async getRisk(id: string): Promise<Risk | undefined> {
    const [risk] = await db.select().from(risks).where(eq(risks.id, id));
    return risk || undefined;
  }

  async createRisk(risk: any): Promise<Risk> {
    const [newRisk] = await db.insert(risks).values(risk).returning();
    return newRisk;
  }

  async updateRisk(id: string, risk: any): Promise<Risk> {
    const [updatedRisk] = await db.update(risks)
      .set(risk)
      .where(eq(risks.id, id))
      .returning();
    return updatedRisk;
  }

  async getRiskMitigations(riskId: string): Promise<RiskMitigation[]> {
    return await db.select()
      .from(riskMitigations)
      .where(eq(riskMitigations.riskId, riskId))
      .orderBy(desc(riskMitigations.actionDate));
  }

  async createRiskMitigation(mitigation: any): Promise<RiskMitigation> {
    const [newMitigation] = await db.insert(riskMitigations).values(mitigation).returning();
    return newMitigation;
  }

  // Benefits
  async getBenefits(programId?: string): Promise<Benefit[]> {
    const query = programId 
      ? db.select().from(benefits).where(eq(benefits.programId, programId))
      : db.select().from(benefits);
    return await query.orderBy(desc(benefits.createdAt));
  }

  async createBenefit(benefit: any): Promise<Benefit> {
    const [newBenefit] = await db.insert(benefits).values(benefit).returning();
    return newBenefit;
  }

  async updateBenefit(id: string, benefit: any): Promise<Benefit> {
    const [updatedBenefit] = await db.update(benefits)
      .set(benefit)
      .where(eq(benefits.id, id))
      .returning();
    return updatedBenefit;
  }

  // Funding
  async getFundingSources(programId?: string): Promise<FundingSource[]> {
    const query = programId 
      ? db.select().from(fundingSources).where(eq(fundingSources.programId, programId))
      : db.select().from(fundingSources);
    return await query.orderBy(desc(fundingSources.createdAt));
  }

  async getExpenses(programId?: string): Promise<Expense[]> {
    const query = programId 
      ? db.select().from(expenses).where(eq(expenses.programId, programId))
      : db.select().from(expenses);
    return await query.orderBy(desc(expenses.expenseDate));
  }

  async createFundingSource(source: any): Promise<FundingSource> {
    const [newSource] = await db.insert(fundingSources).values(source).returning();
    return newSource;
  }

  async createExpense(expense: any): Promise<Expense> {
    const [newExpense] = await db.insert(expenses).values(expense).returning();
    return newExpense;
  }

  // Session Context
  async getActiveSessionContext(): Promise<SessionContext | undefined> {
    const [activeContext] = await db.select()
      .from(sessionContext)
      .where(eq(sessionContext.isActive, true))
      .orderBy(desc(sessionContext.createdAt))
      .limit(1);
    return activeContext || undefined;
  }

  async getSessionContextById(id: string): Promise<SessionContext | undefined> {
    const [context] = await db.select()
      .from(sessionContext)
      .where(eq(sessionContext.id, id));
    return context || undefined;
  }

  async createSessionContext(context: InsertSessionContext): Promise<SessionContext> {
    // Deactivate any existing active contexts
    await db.update(sessionContext)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(sessionContext.isActive, true));

    const [newContext] = await db.insert(sessionContext).values(context).returning();
    return newContext;
  }

  async updateSessionContext(id: string, data: Partial<InsertSessionContext>): Promise<SessionContext> {
    const [updatedContext] = await db.update(sessionContext)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sessionContext.id, id))
      .returning();
    return updatedContext;
  }

  async deactivateSessionContext(id: string): Promise<void> {
    await db.update(sessionContext)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(sessionContext.id, id));
  }

  async addDecisionToContext(id: string, decision: any): Promise<SessionContext> {
    const [existing] = await db.select().from(sessionContext).where(eq(sessionContext.id, id));
    if (!existing) {
      throw new Error(`SessionContext with id ${id} not found`);
    }

    const currentLog = (existing.decisionsLog as any[]) || [];
    const updatedLog = [...currentLog, { ...decision, timestamp: new Date().toISOString() }];

    const [updated] = await db.update(sessionContext)
      .set({ decisionsLog: updatedLog, updatedAt: new Date() })
      .where(eq(sessionContext.id, id))
      .returning();

    return updated;
  }

  // Strategy Versions
  async getStrategyVersionsBySession(sessionId: string): Promise<StrategyVersion[]> {
    const versions = await db.select()
      .from(strategyVersions)
      .where(eq(strategyVersions.sessionId, sessionId))
      .orderBy(desc(strategyVersions.versionNumber));
    
    return await Promise.all(versions.map(v => this.decryptStrategyVersion(v as StrategyVersion)));
  }

  async getAllStrategyVersionsByUser(userId: string): Promise<StrategyVersion[]> {
    const versions = await db.select()
      .from(strategyVersions)
      .where(eq(strategyVersions.userId, userId))
      .orderBy(desc(strategyVersions.createdAt));
    
    return await Promise.all(versions.map(v => this.decryptStrategyVersion(v as StrategyVersion)));
  }

  async getStrategyVersion(sessionId: string, versionNumber: number): Promise<StrategyVersion | undefined> {
    const [version] = await db.select()
      .from(strategyVersions)
      .where(and(
        eq(strategyVersions.sessionId, sessionId),
        eq(strategyVersions.versionNumber, versionNumber)
      ));
    
    if (!version) return undefined;
    return await this.decryptStrategyVersion(version as StrategyVersion);
  }

  async getStrategyVersionById(id: string): Promise<StrategyVersion | undefined> {
    const [version] = await db.select()
      .from(strategyVersions)
      .where(eq(strategyVersions.id, id))
      .limit(1);
    
    if (!version) return undefined;
    return await this.decryptStrategyVersion(version as StrategyVersion);
  }

  async createStrategyVersion(version: any): Promise<StrategyVersion> {
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
    
    const result = await db.insert(strategyVersions).values(dataToInsert as any).returning();
    return (result as any[])[0];
  }

  async getInitiativeDescriptionForSession(sessionId: string): Promise<string | null> {
    // Use secure service to get decrypted data
    const understanding = await getStrategicUnderstandingBySession(sessionId);
    return understanding?.initiativeDescription || null;
  }

  async updateStrategyVersion(id: string, data: any): Promise<StrategyVersion> {
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
      .set({ ...dataToUpdate as any, updatedAt: new Date() })
      .where(eq(strategyVersions.id, id))
      .returning();
    return updated as StrategyVersion;
  }

  async getDashboardSummary(userId: string) {
    try {
      // Get counts (filter out archived items)
      const counts = await Promise.all([
        // Count analyses (DISTINCT strategic_understanding records) via journey sessions - matches repository logic
        db.select({ count: sql<number>`COUNT(DISTINCT ${strategicUnderstanding.id})` })
          .from(strategicUnderstanding)
          .innerJoin(
            journeySessions,
            and(
              eq(strategicUnderstanding.id, journeySessions.understandingId),
              eq(journeySessions.userId, userId)
            )
          )
          .where(eq(strategicUnderstanding.archived, false)),
        // Count strategic_understanding records (strategies) via journey sessions for ownership
        db.select({ count: sql<number>`COUNT(DISTINCT ${strategicUnderstanding.id})` })
          .from(strategicUnderstanding)
          .innerJoin(
            journeySessions,
            and(
              eq(strategicUnderstanding.id, journeySessions.understandingId),
              eq(journeySessions.userId, userId)
            )
          )
          .where(eq(strategicUnderstanding.archived, false)),
        db.select({ count: count() })
          .from(epmPrograms)
          .where(and(
            eq(epmPrograms.userId, userId),
            eq(epmPrograms.archived, false)
          )),
        // Count completed segment discoveries
        db.select({ count: count() })
          .from(segmentDiscoveryResults)
          .where(and(
            eq(segmentDiscoveryResults.userId, userId),
            eq(segmentDiscoveryResults.status, 'completed')
          ))
      ]);

      const [analysesCount] = counts[0];
      const [strategiesCount] = counts[1];
      const [programsCount] = counts[2];
      const [segmentsCount] = counts[3];

      // Fetch recent artifacts (analyses and programs)
      const [recentAnalyses, recentPrograms] = await Promise.all([
        // Recent strategy versions (analyses)
        db.select({
          id: strategyVersions.id,
          inputSummary: strategyVersions.inputSummary,
          createdAt: strategyVersions.createdAt,
        })
          .from(strategyVersions)
          .where(and(
            eq(strategyVersions.userId, userId),
            eq(strategyVersions.archived, false)
          ))
          .orderBy(desc(strategyVersions.createdAt))
          .limit(5),
        
        // Recent EPM programs
        db.select({
          id: epmPrograms.id,
          executiveSummary: epmPrograms.executiveSummary,
          createdAt: epmPrograms.createdAt,
        })
          .from(epmPrograms)
          .where(and(
            eq(epmPrograms.userId, userId),
            eq(epmPrograms.archived, false)
          ))
          .orderBy(desc(epmPrograms.createdAt))
          .limit(5)
      ]);

      // Decrypt and format analyses
      const { decryptKMS } = await import('./utils/kms-encryption');
      const formattedAnalyses = await Promise.all(
        recentAnalyses.map(async (analysis) => {
          const decryptedSummary = analysis.inputSummary
            ? await decryptKMS(analysis.inputSummary)
            : 'Strategic Analysis';
          
          return {
            id: analysis.id,
            type: 'analysis' as const,
            title: decryptedSummary || 'Strategic Analysis',
            createdAt: analysis.createdAt?.toISOString() || new Date().toISOString(),
            link: `/repository?highlight=${analysis.id}`
          };
        })
      );

      // Format programs
      const formattedPrograms = recentPrograms.map((program) => {
        const executiveSummary = program.executiveSummary as any;
        const title = executiveSummary?.title || 'EPM Program';
        
        return {
          id: program.id,
          type: 'program' as const,
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
          segments: segmentsCount?.count || 0,
        },
        recentArtifacts: allArtifacts
      };
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
      throw new Error('Failed to fetch dashboard summary');
    }
  }

  /**
   * Atomically start integration - prevents concurrent integrations
   * Returns the version if successful, null if already integrating/integrated
   */
  async tryStartIntegration(versionId: string): Promise<StrategyVersion | null> {
    const [updated] = await db.update(strategyVersions)
      .set({ status: 'converting', updatedAt: new Date() })
      .where(
        and(
          eq(strategyVersions.id, versionId),
          isNull(strategyVersions.convertedProgramId),
          not(eq(strategyVersions.status, 'converting'))
        )
      )
      .returning();
    return (updated as StrategyVersion) || null;
  }

  // Golden Records
  async createGoldenRecord(record: any): Promise<any> {
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
        .where(
          and(
            eq(goldenRecords.journeyType, record.journeyType),
            eq(goldenRecords.isCurrent, true)
          )
        );
      newRecord.isCurrent = true;
      delete newRecord.promoteAsCurrent;
    }

    const [created] = await db.insert(goldenRecords).values(newRecord).returning();
    return created;
  }

  async listGoldenRecords(journeyType?: string, includeHistory?: boolean): Promise<any[]> {
    let query = db.select().from(goldenRecords);

    if (journeyType) {
      query = query.where(eq(goldenRecords.journeyType, journeyType as any)) as any;
    }

    if (!includeHistory) {
      query = query.where(eq(goldenRecords.isCurrent, true)) as any;
    }

    const records = await query.orderBy(desc(goldenRecords.createdAt));
    return records;
  }

  async getGoldenRecord(journeyType: string, version: number): Promise<any | undefined> {
    const [record] = await db
      .select()
      .from(goldenRecords)
      .where(
        and(
          eq(goldenRecords.journeyType, journeyType as any),
          eq(goldenRecords.version, version)
        )
      );
    return record || undefined;
  }

  async getCurrentGoldenRecord(journeyType: string): Promise<any | undefined> {
    const [record] = await db
      .select()
      .from(goldenRecords)
      .where(
        and(
          eq(goldenRecords.journeyType, journeyType as any),
          eq(goldenRecords.isCurrent, true)
        )
      );
    return record || undefined;
  }

  async promoteGoldenRecord(journeyType: string, version: number): Promise<any> {
    // Unset current flag on all records for this journey type
    await db
      .update(goldenRecords)
      .set({ isCurrent: false })
      .where(eq(goldenRecords.journeyType, journeyType as any));

    // Set the specified version as current
    const [promoted] = await db
      .update(goldenRecords)
      .set({ isCurrent: true })
      .where(
        and(
          eq(goldenRecords.journeyType, journeyType as any),
          eq(goldenRecords.version, version)
        )
      )
      .returning();

    return promoted;
  }

  async compareGoldenRecords(journeyType: string, version1: number, version2: number): Promise<any> {
    const [record1, record2] = await Promise.all([
      this.getGoldenRecord(journeyType, version1),
      this.getGoldenRecord(journeyType, version2),
    ]);

    if (!record1 || !record2) {
      throw new Error('One or both golden records not found');
    }

    // Simple diff summary - this can be enhanced with more sophisticated diff logic
    const stepDiffs = [];
    const steps1 = record1.steps as any[] || [];
    const steps2 = record2.steps as any[] || [];

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
      } else if (!step2) {
        stepDiffs.push({
          stepNumber: i + 1,
          changeType: 'removed',
          v1Step: step1,
          v2Step: null,
        });
      } else if (JSON.stringify(step1) !== JSON.stringify(step2)) {
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
      } else {
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

  async createGoldenRecordCheck(check: any): Promise<any> {
    const [created] = await db.insert(goldenRecordChecks).values(check).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
