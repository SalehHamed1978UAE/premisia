import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { 
  insertProgramSchema, 
  insertWorkstreamSchema, 
  insertStageGateSchema, 
  insertTaskSchema, 
  insertKpiSchema, 
  insertRiskSchema, 
  insertBenefitSchema, 
  insertFundingSourceSchema, 
  insertExpenseSchema, 
  insertResourceSchema 
} from '@shared/schema';

const router = Router();

const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: any) => {
    const user = (req as any).user;
    if (!user || !allowedRoles.includes(user.role || 'Viewer')) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
};

router.get("/programs", async (req: Request, res: Response) => {
  try {
    const programs = await storage.getPrograms();
    res.json(programs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch programs" });
  }
});

router.get("/programs/:id", async (req: Request, res: Response) => {
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

router.post("/programs", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const validatedData = insertProgramSchema.parse(req.body);
    const program = await storage.createProgram(validatedData);
    res.status(201).json(program);
  } catch (error) {
    res.status(400).json({ message: "Invalid program data" });
  }
});

router.get("/workstreams", async (req: Request, res: Response) => {
  try {
    const programId = req.query.programId as string;
    const workstreams = await storage.getWorkstreams(programId);
    res.json(workstreams);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch workstreams" });
  }
});

router.post("/workstreams", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const validatedData = insertWorkstreamSchema.parse(req.body);
    const workstream = await storage.createWorkstream(validatedData);
    res.status(201).json(workstream);
  } catch (error) {
    res.status(400).json({ message: "Invalid workstream data" });
  }
});

router.get("/resources", async (req: Request, res: Response) => {
  try {
    const programId = req.query.programId as string;
    const resources = await storage.getResources(programId);
    res.json(resources);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch resources" });
  }
});

router.post("/resources", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const validatedData = insertResourceSchema.parse(req.body);
    const resource = await storage.createResource(validatedData);
    res.status(201).json(resource);
  } catch (error) {
    res.status(400).json({ message: "Invalid resource data" });
  }
});

router.put("/resources/:id", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const resource = await storage.updateResource(req.params.id, req.body);
    res.json(resource);
  } catch (error) {
    res.status(400).json({ message: "Failed to update resource" });
  }
});

router.get("/stage-gates", async (req: Request, res: Response) => {
  try {
    const programId = req.query.programId as string;
    const stageGates = await storage.getStageGates(programId);
    res.json(stageGates);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch stage gates" });
  }
});

router.post("/stage-gates", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const validatedData = insertStageGateSchema.parse(req.body);
    const stageGate = await storage.createStageGate(validatedData);
    res.status(201).json(stageGate);
  } catch (error) {
    console.error("Stage gate validation error:", error);
    res.status(400).json({ message: "Invalid stage gate data", error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/stage-gates/reviews", async (req: Request, res: Response) => {
  try {
    const programId = req.query.programId as string;
    const reviews = await storage.getStageGateReviews(programId);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch stage gate reviews" });
  }
});

router.post("/stage-gates/reviews", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const review = await storage.createStageGateReview(req.body);
    res.status(201).json(review);
  } catch (error) {
    res.status(400).json({ message: "Failed to create stage gate review" });
  }
});

router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const programId = req.query.programId as string;
    const workstreamId = req.query.workstreamId as string;
    const tasks = await storage.getTasks(programId, workstreamId);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tasks" });
  }
});

router.get("/tasks/:id", async (req: Request, res: Response) => {
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

router.post("/tasks", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const validatedData = insertTaskSchema.parse(req.body);
    const task = await storage.createTask(validatedData);
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ message: "Invalid task data" });
  }
});

router.put("/tasks/:id", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const task = await storage.updateTask(req.params.id, req.body);
    res.json(task);
  } catch (error) {
    res.status(400).json({ message: "Failed to update task" });
  }
});

router.delete("/tasks/:id", requireRole(['Admin']), async (req: Request, res: Response) => {
  try {
    await storage.deleteTask(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ message: "Failed to delete task" });
  }
});

router.get("/kpis", async (req: Request, res: Response) => {
  try {
    const programId = req.query.programId as string;
    const kpis = await storage.getKpis(programId);
    res.json(kpis);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch KPIs" });
  }
});

router.get("/kpis/:id/measurements", async (req: Request, res: Response) => {
  try {
    const measurements = await storage.getKpiMeasurements(req.params.id);
    res.json(measurements);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch KPI measurements" });
  }
});

router.post("/kpis", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const validatedData = insertKpiSchema.parse(req.body);
    const kpi = await storage.createKpi(validatedData);
    res.status(201).json(kpi);
  } catch (error) {
    console.error("KPI validation error:", error);
    res.status(400).json({ message: "Invalid KPI data", error: error instanceof Error ? error.message : String(error) });
  }
});

router.put("/kpis/:id", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const kpi = await storage.updateKpi(req.params.id, req.body);
    res.json(kpi);
  } catch (error) {
    res.status(400).json({ message: "Failed to update KPI" });
  }
});

router.post("/kpis/:id/measurements", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
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

router.get("/risks", async (req: Request, res: Response) => {
  try {
    const programId = req.query.programId as string;
    const risks = await storage.getRisks(programId);
    res.json(risks);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch risks" });
  }
});

router.get("/risks/:id", async (req: Request, res: Response) => {
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

router.post("/risks", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const validatedData = insertRiskSchema.parse(req.body);
    const risk = await storage.createRisk(validatedData);
    res.status(201).json(risk);
  } catch (error) {
    res.status(400).json({ message: "Invalid risk data" });
  }
});

router.put("/risks/:id", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const risk = await storage.updateRisk(req.params.id, req.body);
    res.json(risk);
  } catch (error) {
    res.status(400).json({ message: "Failed to update risk" });
  }
});

router.get("/risks/:id/mitigations", async (req: Request, res: Response) => {
  try {
    const mitigations = await storage.getRiskMitigations(req.params.id);
    res.json(mitigations);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch risk mitigations" });
  }
});

router.post("/risks/:id/mitigations", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
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

router.get("/benefits", async (req: Request, res: Response) => {
  try {
    const programId = req.query.programId as string;
    const benefits = await storage.getBenefits(programId);
    res.json(benefits);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch benefits" });
  }
});

router.post("/benefits", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const validatedData = insertBenefitSchema.parse(req.body);
    const benefit = await storage.createBenefit(validatedData);
    res.status(201).json(benefit);
  } catch (error) {
    res.status(400).json({ message: "Invalid benefit data" });
  }
});

router.put("/benefits/:id", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const benefit = await storage.updateBenefit(req.params.id, req.body);
    res.json(benefit);
  } catch (error) {
    res.status(400).json({ message: "Failed to update benefit" });
  }
});

router.get("/funding/sources", async (req: Request, res: Response) => {
  try {
    const programId = req.query.programId as string;
    const sources = await storage.getFundingSources(programId);
    res.json(sources);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch funding sources" });
  }
});

router.get("/funding/expenses", async (req: Request, res: Response) => {
  try {
    const programId = req.query.programId as string;
    const expenses = await storage.getExpenses(programId);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
});

router.post("/funding/sources", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const validatedData = insertFundingSourceSchema.parse(req.body);
    const source = await storage.createFundingSource(validatedData);
    res.status(201).json(source);
  } catch (error) {
    console.error("Funding source validation error:", error);
    res.status(400).json({ message: "Failed to create funding source", error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/funding/expenses", requireRole(['Admin', 'Editor']), async (req: Request, res: Response) => {
  try {
    const validatedData = insertExpenseSchema.parse(req.body);
    const expense = await storage.createExpense(validatedData);
    res.status(201).json(expense);
  } catch (error) {
    console.error("Expense validation error:", error);
    res.status(400).json({ message: "Invalid expense data", error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/dashboard/summary", async (req: Request, res: Response) => {
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
    
    const tasksByStatus = tasks.reduce((acc: Record<string, number>, task) => {
      const status = task.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const risksByPriority = risks.reduce((acc: Record<string, number>, risk) => {
      const priority = risk.priority || 'unknown';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {});

    res.json({
      tasks: {
        total: tasks.length,
        byStatus: tasksByStatus,
      },
      risks: {
        total: risks.length,
        byPriority: risksByPriority,
      },
      kpis: {
        total: kpis.length,
      },
      benefits: {
        total: benefits.length,
      },
      financial: {
        totalBudget,
        totalSpent,
        remaining: totalBudget - totalSpent,
      },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard summary" });
  }
});

export default router;
