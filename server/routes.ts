import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertProgramSchema, insertWorkstreamSchema, insertStageGateSchema, insertTaskSchema, insertKpiSchema, insertRiskSchema, insertBenefitSchema, insertFundingSourceSchema, insertExpenseSchema, insertResourceSchema } from "@shared/schema";

export function registerRoutes(app: Express): Server {
  // Setup authentication routes
  setupAuth(app);

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

  const httpServer = createServer(app);
  return httpServer;
}
