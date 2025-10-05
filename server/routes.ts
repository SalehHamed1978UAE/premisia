import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertProgramSchema, insertWorkstreamSchema, insertStageGateSchema, insertTaskSchema, insertKpiSchema, insertRiskSchema, insertBenefitSchema, insertFundingSourceSchema, insertExpenseSchema, insertResourceSchema, insertSessionContextSchema, orchestratorTaskSchema } from "@shared/schema";
import { ontologyService } from "./ontology-service";
import { assessmentService } from "./assessment-service";
import { Orchestrator } from "./orchestrator";
import strategicConsultantRoutes from "./routes/strategic-consultant";

export function registerRoutes(app: Express): Server {
  // Setup authentication routes
  setupAuth(app);

  // Strategic Consultant routes
  app.use("/api/strategic-consultant", strategicConsultantRoutes);

  // Middleware to check authentication
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  // Middleware to check roles
  const requireRole = (roles: string[]) => (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };

  // Programs
  app.get("/api/programs", requireAuth, async (req, res) => {
    try {
      const programs = await storage.getPrograms();
      res.json(programs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch programs" });
    }
  });

  app.get("/api/programs/:id", requireAuth, async (req, res) => {
    try {
      const program = await storage.getProgram(req.params.id);
      if (!program) {
        return res.status(404).json({ message: "Program not found" });
      }
      res.json(program);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch program" });
    }
  });

  app.post("/api/programs", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const validatedData = insertProgramSchema.parse(req.body);
      const program = await storage.createProgram(validatedData);
      res.status(201).json(program);
    } catch (error) {
      res.status(400).json({ message: "Invalid program data" });
    }
  });

  // Workstreams
  app.get("/api/workstreams", requireAuth, async (req, res) => {
    try {
      const programId = req.query.programId as string;
      const workstreams = await storage.getWorkstreams(programId);
      res.json(workstreams);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch workstreams" });
    }
  });

  app.post("/api/workstreams", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const validatedData = insertWorkstreamSchema.parse(req.body);
      const workstream = await storage.createWorkstream(validatedData);
      res.status(201).json(workstream);
    } catch (error) {
      res.status(400).json({ message: "Invalid workstream data" });
    }
  });

  // Resources
  app.get("/api/resources", requireAuth, async (req, res) => {
    try {
      const programId = req.query.programId as string;
      const resources = await storage.getResources(programId);
      res.json(resources);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch resources" });
    }
  });

  app.post("/api/resources", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const validatedData = insertResourceSchema.parse(req.body);
      const resource = await storage.createResource(validatedData);
      res.status(201).json(resource);
    } catch (error) {
      res.status(400).json({ message: "Invalid resource data" });
    }
  });

  app.put("/api/resources/:id", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const resource = await storage.updateResource(req.params.id, req.body);
      res.json(resource);
    } catch (error) {
      res.status(400).json({ message: "Failed to update resource" });
    }
  });

  // Stage Gates
  app.get("/api/stage-gates", requireAuth, async (req, res) => {
    try {
      const programId = req.query.programId as string;
      const stageGates = await storage.getStageGates(programId);
      res.json(stageGates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stage gates" });
    }
  });

  app.post("/api/stage-gates", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const validatedData = insertStageGateSchema.parse(req.body);
      const stageGate = await storage.createStageGate(validatedData);
      res.status(201).json(stageGate);
    } catch (error) {
      console.error("Stage gate validation error:", error);
      res.status(400).json({ message: "Invalid stage gate data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/stage-gates/reviews", requireAuth, async (req, res) => {
    try {
      const programId = req.query.programId as string;
      const reviews = await storage.getStageGateReviews(programId);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stage gate reviews" });
    }
  });

  app.post("/api/stage-gates/reviews", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const review = await storage.createStageGateReview(req.body);
      res.status(201).json(review);
    } catch (error) {
      res.status(400).json({ message: "Failed to create stage gate review" });
    }
  });

  // Tasks
  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const programId = req.query.programId as string;
      const workstreamId = req.query.workstreamId as string;
      const tasks = await storage.getTasks(programId, workstreamId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  app.post("/api/tasks", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const validatedData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(validatedData);
      res.status(201).json(task);
    } catch (error) {
      res.status(400).json({ message: "Invalid task data" });
    }
  });

  app.put("/api/tasks/:id", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const task = await storage.updateTask(req.params.id, req.body);
      res.json(task);
    } catch (error) {
      res.status(400).json({ message: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, requireRole(['Admin']), async (req, res) => {
    try {
      await storage.deleteTask(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: "Failed to delete task" });
    }
  });

  // KPIs
  app.get("/api/kpis", requireAuth, async (req, res) => {
    try {
      const programId = req.query.programId as string;
      const kpis = await storage.getKpis(programId);
      res.json(kpis);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch KPIs" });
    }
  });

  app.get("/api/kpis/:id/measurements", requireAuth, async (req, res) => {
    try {
      const measurements = await storage.getKpiMeasurements(req.params.id);
      res.json(measurements);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch KPI measurements" });
    }
  });

  app.post("/api/kpis", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const validatedData = insertKpiSchema.parse(req.body);
      const kpi = await storage.createKpi(validatedData);
      res.status(201).json(kpi);
    } catch (error) {
      console.error("KPI validation error:", error);
      res.status(400).json({ message: "Invalid KPI data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/kpis/:id", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const kpi = await storage.updateKpi(req.params.id, req.body);
      res.json(kpi);
    } catch (error) {
      res.status(400).json({ message: "Failed to update KPI" });
    }
  });

  app.post("/api/kpis/:id/measurements", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const measurement = await storage.createKpiMeasurement({
        ...req.body,
        kpiId: req.params.id
      });
      res.status(201).json(measurement);
    } catch (error) {
      res.status(400).json({ message: "Failed to create KPI measurement" });
    }
  });

  // Risks
  app.get("/api/risks", requireAuth, async (req, res) => {
    try {
      const programId = req.query.programId as string;
      const risks = await storage.getRisks(programId);
      res.json(risks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch risks" });
    }
  });

  app.get("/api/risks/:id", requireAuth, async (req, res) => {
    try {
      const risk = await storage.getRisk(req.params.id);
      if (!risk) {
        return res.status(404).json({ message: "Risk not found" });
      }
      res.json(risk);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch risk" });
    }
  });

  app.post("/api/risks", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const validatedData = insertRiskSchema.parse(req.body);
      const risk = await storage.createRisk(validatedData);
      res.status(201).json(risk);
    } catch (error) {
      res.status(400).json({ message: "Invalid risk data" });
    }
  });

  app.put("/api/risks/:id", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const risk = await storage.updateRisk(req.params.id, req.body);
      res.json(risk);
    } catch (error) {
      res.status(400).json({ message: "Failed to update risk" });
    }
  });

  app.get("/api/risks/:id/mitigations", requireAuth, async (req, res) => {
    try {
      const mitigations = await storage.getRiskMitigations(req.params.id);
      res.json(mitigations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch risk mitigations" });
    }
  });

  app.post("/api/risks/:id/mitigations", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const mitigation = await storage.createRiskMitigation({
        ...req.body,
        riskId: req.params.id
      });
      res.status(201).json(mitigation);
    } catch (error) {
      res.status(400).json({ message: "Failed to create risk mitigation" });
    }
  });

  // Benefits
  app.get("/api/benefits", requireAuth, async (req, res) => {
    try {
      const programId = req.query.programId as string;
      const benefits = await storage.getBenefits(programId);
      res.json(benefits);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch benefits" });
    }
  });

  app.post("/api/benefits", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const validatedData = insertBenefitSchema.parse(req.body);
      const benefit = await storage.createBenefit(validatedData);
      res.status(201).json(benefit);
    } catch (error) {
      res.status(400).json({ message: "Invalid benefit data" });
    }
  });

  app.put("/api/benefits/:id", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const benefit = await storage.updateBenefit(req.params.id, req.body);
      res.json(benefit);
    } catch (error) {
      res.status(400).json({ message: "Failed to update benefit" });
    }
  });

  // Funding
  app.get("/api/funding/sources", requireAuth, async (req, res) => {
    try {
      const programId = req.query.programId as string;
      const sources = await storage.getFundingSources(programId);
      res.json(sources);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch funding sources" });
    }
  });

  app.get("/api/funding/expenses", requireAuth, async (req, res) => {
    try {
      const programId = req.query.programId as string;
      const expenses = await storage.getExpenses(programId);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/funding/sources", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const validatedData = insertFundingSourceSchema.parse(req.body);
      const source = await storage.createFundingSource(validatedData);
      res.status(201).json(source);
    } catch (error) {
      console.error("Funding source validation error:", error);
      res.status(400).json({ message: "Failed to create funding source", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/funding/expenses", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const validatedData = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(validatedData);
      res.status(201).json(expense);
    } catch (error) {
      console.error("Expense validation error:", error);
      res.status(400).json({ message: "Invalid expense data", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Dashboard summary endpoint
  app.get("/api/dashboard/summary", requireAuth, async (req, res) => {
    try {
      const programId = req.query.programId as string;
      
      const [tasks, risks, kpis, benefits, expenses, fundingSources] = await Promise.all([
        storage.getTasks(programId),
        storage.getRisks(programId),
        storage.getKpis(programId),
        storage.getBenefits(programId),
        storage.getExpenses(programId),
        storage.getFundingSources(programId)
      ]);

      const totalBudget = fundingSources.reduce((sum, source) => sum + parseFloat(source.allocatedAmount || '0'), 0);
      const totalSpent = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount || '0'), 0);
      const completedTasks = tasks.filter(task => task.status === 'Completed').length;
      const activeTasks = tasks.filter(task => task.status === 'In Progress').length;
      const activeRisks = risks.filter(risk => risk.status === 'Open').length;
      const highRisks = risks.filter(risk => risk.priority === 'High' || risk.priority === 'Critical').length;

      res.json({
        tasks: {
          total: tasks.length,
          completed: completedTasks,
          active: activeTasks,
          completionRate: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0
        },
        budget: {
          total: totalBudget,
          spent: totalSpent,
          remaining: totalBudget - totalSpent,
          utilizationRate: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0
        },
        risks: {
          total: risks.length,
          active: activeRisks,
          high: highRisks
        },
        kpis: kpis.length,
        benefits: benefits.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard summary" });
    }
  });

  // Ontology API endpoints
  app.get("/api/ontology/entities", requireAuth, async (req, res) => {
    try {
      const entities = await ontologyService.getAllEntities();
      res.json(entities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch entity definitions" });
    }
  });

  app.get("/api/ontology/entities/:entityName", requireAuth, async (req, res) => {
    try {
      const entity = await ontologyService.getEntityDefinition(req.params.entityName as any);
      if (!entity) {
        return res.status(404).json({ message: "Entity not found" });
      }
      res.json(entity);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch entity definition" });
    }
  });

  app.get("/api/ontology/entities/:entityName/context", requireAuth, async (req, res) => {
    try {
      const context = await ontologyService.getFullEntityContext(req.params.entityName as any);
      res.json(context);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch entity context" });
    }
  });

  app.get("/api/ontology/relationships", requireAuth, async (req, res) => {
    try {
      const { entity, direction } = req.query;
      if (entity) {
        const relationships = await ontologyService.getEntityRelationships(
          entity as any,
          (direction as any) || "both"
        );
        res.json(relationships);
      } else {
        res.status(400).json({ message: "Entity parameter required" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch relationships" });
    }
  });

  app.get("/api/ontology/validation-rules", requireAuth, async (req, res) => {
    try {
      const { entity, category, severity, enabled } = req.query;
      const rules = await ontologyService.getValidationRules({
        entity: entity as any,
        category: category as string,
        severity: severity as any,
        enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      });
      res.json(rules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch validation rules" });
    }
  });

  app.post("/api/ontology/validate", requireAuth, async (req, res) => {
    try {
      const { entityName, data } = req.body;
      if (!entityName || !data) {
        return res.status(400).json({ message: "entityName and data required" });
      }
      const result = await ontologyService.validateEntityData(entityName, data);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to validate entity data" });
    }
  });

  app.get("/api/ontology/completeness-checks", requireAuth, async (req, res) => {
    try {
      const { entity, checkType, importance, enabled } = req.query;
      const checks = await ontologyService.getCompletenessChecks({
        entity: entity as any,
        checkType: checkType as string,
        importance: importance as any,
        enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      });
      res.json(checks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch completeness checks" });
    }
  });

  app.post("/api/ontology/check-completeness", requireAuth, async (req, res) => {
    try {
      const { entityName, data } = req.body;
      if (!entityName || !data) {
        return res.status(400).json({ message: "entityName and data required" });
      }
      const result = await ontologyService.checkCompleteness(entityName, data);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to check completeness" });
    }
  });

  app.get("/api/ontology/cascade-impacts", requireAuth, async (req, res) => {
    try {
      const { trigger } = req.query;
      const impacts = await ontologyService.getCascadeImpacts(trigger as string);
      res.json(impacts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cascade impacts" });
    }
  });

  app.get("/api/ontology/domain-terms", requireAuth, async (req, res) => {
    try {
      const { term } = req.query;
      if (term) {
        const domainTerm = await ontologyService.getDomainTerm(term as string);
        if (!domainTerm) {
          return res.status(404).json({ message: "Term not found" });
        }
        res.json(domainTerm);
      } else {
        const terms = await ontologyService.getAllDomainTerms();
        res.json(terms);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch domain terms" });
    }
  });

  app.get("/api/ontology/framework-mappings", requireAuth, async (req, res) => {
    try {
      const { framework, epmEntity } = req.query;
      const mappings = await ontologyService.getFrameworkMappings({
        framework: framework as string,
        epmEntity: epmEntity as any,
      });
      res.json(mappings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch framework mappings" });
    }
  });

  // Session Context API endpoints
  app.get("/api/session-context", requireAuth, async (req, res) => {
    try {
      const activeContext = await storage.getActiveSessionContext();
      res.json(activeContext || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session context" });
    }
  });

  app.post("/api/session-context", requireAuth, async (req, res) => {
    try {
      const validatedData = insertSessionContextSchema.parse(req.body);
      const context = await storage.createSessionContext(validatedData);
      res.status(201).json(context);
    } catch (error) {
      res.status(400).json({ message: "Invalid session context data" });
    }
  });

  app.patch("/api/session-context/:id", requireAuth, async (req, res) => {
    try {
      // Validate that only allowed fields are being updated
      const allowedFields = ['goal', 'successCriteria', 'currentPhase', 'decisionsLog'];
      const updates = Object.keys(req.body);
      const invalidFields = updates.filter(field => !allowedFields.includes(field));
      
      if (invalidFields.length > 0) {
        return res.status(400).json({ message: `Invalid fields: ${invalidFields.join(', ')}` });
      }

      // Validate successCriteria if present
      if (req.body.successCriteria && !Array.isArray(req.body.successCriteria)) {
        return res.status(400).json({ message: "successCriteria must be an array" });
      }

      const context = await storage.updateSessionContext(req.params.id, req.body);
      res.json(context);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to update session context" });
    }
  });

  app.post("/api/session-context/:id/decision", requireAuth, async (req, res) => {
    try {
      // Validate decision structure
      if (!req.body.decision || typeof req.body.decision !== 'string') {
        return res.status(400).json({ message: "decision (string) is required" });
      }

      const context = await storage.addDecisionToContext(req.params.id, {
        decision: req.body.decision,
        reason: req.body.reason || '',
      });
      res.json(context);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to add decision" });
    }
  });

  app.post("/api/session-context/:id/deactivate", requireAuth, async (req, res) => {
    try {
      await storage.deactivateSessionContext(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ message: "Failed to deactivate session context" });
    }
  });

  // Assessment API endpoints
  app.post("/api/assessment/program", requireAuth, async (req, res) => {
    try {
      const { program, relatedData } = req.body;
      if (!program) {
        return res.status(400).json({ message: "program data required" });
      }
      const assessment = await assessmentService.assessProgram(program, relatedData);
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ message: "Failed to assess program" });
    }
  });

  app.post("/api/assessment/task", requireAuth, async (req, res) => {
    try {
      const { task, program } = req.body;
      if (!task) {
        return res.status(400).json({ message: "task data required" });
      }
      const assessment = await assessmentService.assessTask(task, program);
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ message: "Failed to assess task" });
    }
  });

  app.post("/api/assessment/risk", requireAuth, async (req, res) => {
    try {
      const { risk, mitigations } = req.body;
      if (!risk) {
        return res.status(400).json({ message: "risk data required" });
      }
      const assessment = await assessmentService.assessRisk(risk, mitigations);
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ message: "Failed to assess risk" });
    }
  });

  app.post("/api/assessment/benefit", requireAuth, async (req, res) => {
    try {
      const { benefit, program } = req.body;
      if (!benefit) {
        return res.status(400).json({ message: "benefit data required" });
      }
      const assessment = await assessmentService.assessBenefit(benefit, program);
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ message: "Failed to assess benefit" });
    }
  });

  app.post("/api/assessment/resource", requireAuth, async (req, res) => {
    try {
      const { resource } = req.body;
      if (!resource) {
        return res.status(400).json({ message: "resource data required" });
      }
      const assessment = await assessmentService.assessResource(resource);
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ message: "Failed to assess resource" });
    }
  });

  app.post("/api/assessment/kpi", requireAuth, async (req, res) => {
    try {
      const { kpi, measurements } = req.body;
      if (!kpi) {
        return res.status(400).json({ message: "kpi data required" });
      }
      const assessment = await assessmentService.assessKpi(kpi, measurements);
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ message: "Failed to assess KPI" });
    }
  });

  // AI Orchestration Routes
  const orchestrator = new Orchestrator(storage);

  app.post("/api/orchestrator/task", requireAuth, requireRole(['Admin', 'Editor']), async (req, res) => {
    try {
      const validatedTask = orchestratorTaskSchema.parse(req.body);
      const result = await orchestrator.processTask(validatedTask);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ 
        message: "Failed to process orchestration task", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/orchestrator/task/:id", requireAuth, async (req, res) => {
    try {
      const session = await storage.getSessionContextById(req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  // Strategic Consultant Test Endpoint
  app.get("/api/strategy/test", requireAuth, async (req, res) => {
    try {
      const { strategyOntologyService } = await import("./ontology/strategy-ontology-service");
      
      // Test: Get all approaches
      const approachesRecord = strategyOntologyService.getStrategicApproaches();
      const approaches = Object.entries(approachesRecord).map(([id, approach]) => ({ 
        id, 
        name: approach.label 
      }));
      
      // Test: Get cost estimate for cost_leadership in UAE
      const costEstimate = strategyOntologyService.calculateCostEstimate('cost_leadership', 'uae');
      console.log('Cost Estimate Result:', costEstimate);
      
      // Test: Get workstream allocations
      const workstreams = strategyOntologyService.calculateWorkstreamAllocations('cost_leadership', 'uae');
      console.log('Workstreams Result:', workstreams);
      
      // Test: Validate coherence
      const coherence = strategyOntologyService.validateStrategicCoherence('cost_leadership', 'uae', { 
        has_regulatory_requirements: true 
      });
      console.log('Coherence Result:', coherence);
      
      // Test: Get decision options
      const decisionOptions = strategyOntologyService.getDecisionOptions('differentiation_service', 'usa');
      console.log('Decision Options Result:', decisionOptions);
      
      const responseData = {
        status: 'success',
        tests: {
          approaches,
          costEstimate,
          workstreams: workstreams.slice(0, 3),
          coherence,
          decisionOptions: decisionOptions ? {
            approach: decisionOptions.approach.label,
            market: decisionOptions.market.label,
            cost: decisionOptions.cost_estimate,
            workstreamCount: decisionOptions.workstreams.length,
            coherence: decisionOptions.coherence
          } : null
        }
      };
      
      console.log('Full Response Data:', JSON.stringify(responseData, null, 2));
      res.json(responseData);
    } catch (error) {
      console.error('Strategy Test Error:', error);
      res.status(500).json({ 
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
