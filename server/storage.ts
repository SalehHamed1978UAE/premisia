import { db } from "./db";
import { 
  users, programs, workstreams, resources, stageGates, stageGateReviews, 
  tasks, taskDependencies, kpis, kpiMeasurements, risks, riskMitigations,
  benefits, fundingSources, expenses, sessionContext, strategyVersions
} from "@shared/schema";
import type { 
  User, InsertUser, Program, Workstream, Resource, StageGate, StageGateReview,
  Task, TaskDependency, Kpi, KpiMeasurement, Risk, RiskMitigation,
  Benefit, FundingSource, Expense, SessionContext, InsertSessionContext, StrategyVersion
} from "@shared/schema";
import { eq, desc, and, isNull, not } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import type { Store } from "express-session";
import { ontologyService } from "./ontology-service";
import type { EPMEntity } from "@shared/ontology";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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
  createStrategyVersion(version: any): Promise<any>;
  updateStrategyVersion(id: string, data: any): Promise<any>;

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

  // User management
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
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
    return await db.select()
      .from(strategyVersions)
      .where(eq(strategyVersions.sessionId, sessionId))
      .orderBy(desc(strategyVersions.versionNumber));
  }

  async getStrategyVersion(sessionId: string, versionNumber: number): Promise<StrategyVersion | undefined> {
    const [version] = await db.select()
      .from(strategyVersions)
      .where(and(
        eq(strategyVersions.sessionId, sessionId),
        eq(strategyVersions.versionNumber, versionNumber)
      ));
    return version || undefined;
  }

  async createStrategyVersion(version: any): Promise<StrategyVersion> {
    const [newVersion] = await db.insert(strategyVersions).values(version).returning();
    return newVersion;
  }

  async updateStrategyVersion(id: string, data: any): Promise<StrategyVersion> {
    const [updated] = await db.update(strategyVersions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(strategyVersions.id, id))
      .returning();
    return updated;
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
    return updated || null;
  }
}

export const storage = new DatabaseStorage();
