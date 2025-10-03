import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const roleEnum = pgEnum('role', ['Admin', 'Editor', 'Viewer']);
export const taskStatusEnum = pgEnum('task_status', ['Not Started', 'In Progress', 'Completed', 'On Hold', 'At Risk', 'Delayed']);
export const riskStatusEnum = pgEnum('risk_status', ['Open', 'Mitigated', 'Closed', 'Monitoring']);
export const riskLikelihoodEnum = pgEnum('risk_likelihood', ['Rare', 'Unlikely', 'Possible', 'Likely', 'Certain']);
export const riskImpactEnum = pgEnum('risk_impact', ['Very Low', 'Low', 'Medium', 'High', 'Very High']);
export const riskPriorityEnum = pgEnum('risk_priority', ['Low', 'Medium', 'High', 'Critical']);
export const gateStatusEnum = pgEnum('gate_status', ['Pending', 'In Review', 'Passed', 'Failed', 'On Hold']);
export const benefitStatusEnum = pgEnum('benefit_status', ['Not Started', 'In Progress', 'Realized', 'At Risk']);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  role: roleEnum("role").notNull().default('Viewer'),
  createdAt: timestamp("created_at").defaultNow(),
});

// Programs table
export const programs = pgTable("programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").default('Active'),
  createdAt: timestamp("created_at").defaultNow(),
});

// Workstreams table
export const workstreams = pgTable("workstreams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: varchar("program_id").notNull().references(() => programs.id),
  name: text("name").notNull(),
  description: text("description"),
  leadId: varchar("lead_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Resources table
export const resources = pgTable("resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  role: text("role"),
  department: text("department"),
  email: text("email"),
  userId: varchar("user_id").references(() => users.id),
  programId: varchar("program_id").references(() => programs.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Stage Gates table
export const stageGates = pgTable("stage_gates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull(), // G0, G1, G2, etc.
  name: text("name").notNull(),
  description: text("description"),
  successCriteria: text("success_criteria"),
  programId: varchar("program_id").references(() => programs.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Stage Gate Reviews table
export const stageGateReviews = pgTable("stage_gate_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stageGateId: varchar("stage_gate_id").notNull().references(() => stageGates.id),
  programId: varchar("program_id").notNull().references(() => programs.id),
  reviewDate: timestamp("review_date"),
  status: gateStatusEnum("status").notNull().default('Pending'),
  approverId: varchar("approver_id").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tasks table
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  workstreamId: varchar("workstream_id").references(() => workstreams.id),
  ownerId: varchar("owner_id").references(() => resources.id),
  stageGateId: varchar("stage_gate_id").references(() => stageGates.id),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: taskStatusEnum("status").notNull().default('Not Started'),
  progress: integer("progress").default(0), // 0-100
  priority: text("priority").default('Medium'),
  createdAt: timestamp("created_at").defaultNow(),
});

// Task Dependencies table
export const taskDependencies = pgTable("task_dependencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id),
  dependsOnTaskId: varchar("depends_on_task_id").notNull().references(() => tasks.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// KPIs table
export const kpis = pgTable("kpis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: varchar("program_id").notNull().references(() => programs.id),
  name: text("name").notNull(),
  description: text("description"),
  targetValue: decimal("target_value", { precision: 12, scale: 2 }),
  currentValue: decimal("current_value", { precision: 12, scale: 2 }),
  unit: text("unit"),
  frequency: text("frequency").default('Monthly'),
  ownerId: varchar("owner_id").references(() => resources.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// KPI Measurements table
export const kpiMeasurements = pgTable("kpi_measurements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  kpiId: varchar("kpi_id").notNull().references(() => kpis.id),
  value: decimal("value", { precision: 12, scale: 2 }).notNull(),
  measurementDate: timestamp("measurement_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Risks table
export const risks = pgTable("risks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: varchar("program_id").notNull().references(() => programs.id),
  riskId: text("risk_id").notNull(), // R-001, R-002, etc.
  description: text("description").notNull(),
  category: text("category"),
  likelihood: riskLikelihoodEnum("likelihood").notNull(),
  impact: riskImpactEnum("impact").notNull(),
  priority: riskPriorityEnum("priority").notNull(),
  mitigationPlan: text("mitigation_plan"),
  ownerId: varchar("owner_id").references(() => resources.id),
  status: riskStatusEnum("status").notNull().default('Open'),
  createdAt: timestamp("created_at").defaultNow(),
});

// Risk Mitigation Actions table
export const riskMitigations = pgTable("risk_mitigations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  riskId: varchar("risk_id").notNull().references(() => risks.id),
  action: text("action").notNull(),
  actionDate: timestamp("action_date").notNull(),
  result: text("result"),
  status: text("status").default('Planned'),
  createdAt: timestamp("created_at").defaultNow(),
});

// Benefits table
export const benefits = pgTable("benefits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: varchar("program_id").notNull().references(() => programs.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  targetValue: decimal("target_value", { precision: 12, scale: 2 }),
  realizedValue: decimal("realized_value", { precision: 12, scale: 2 }).default(sql`0`),
  unit: text("unit"),
  ownerId: varchar("owner_id").references(() => resources.id),
  status: benefitStatusEnum("status").notNull().default('Not Started'),
  realizationDate: timestamp("realization_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Funding Sources table
export const fundingSources = pgTable("funding_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: varchar("program_id").notNull().references(() => programs.id),
  sourceName: text("source_name").notNull(),
  allocatedAmount: decimal("allocated_amount", { precision: 12, scale: 2 }).notNull(),
  dateReceived: timestamp("date_received"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Expenses table
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: varchar("program_id").notNull().references(() => programs.id),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  category: text("category"),
  vendor: text("vendor"),
  expenseDate: timestamp("expense_date").notNull(),
  approvedById: varchar("approved_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  programs: many(programs),
  resources: many(resources),
  stageGateReviews: many(stageGateReviews),
  expenses: many(expenses),
}));

export const programsRelations = relations(programs, ({ one, many }) => ({
  owner: one(users, {
    fields: [programs.ownerId],
    references: [users.id],
  }),
  workstreams: many(workstreams),
  resources: many(resources),
  stageGates: many(stageGates),
  stageGateReviews: many(stageGateReviews),
  kpis: many(kpis),
  risks: many(risks),
  benefits: many(benefits),
  fundingSources: many(fundingSources),
  expenses: many(expenses),
}));

export const workstreamsRelations = relations(workstreams, ({ one, many }) => ({
  program: one(programs, {
    fields: [workstreams.programId],
    references: [programs.id],
  }),
  lead: one(users, {
    fields: [workstreams.leadId],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  user: one(users, {
    fields: [resources.userId],
    references: [users.id],
  }),
  program: one(programs, {
    fields: [resources.programId],
    references: [programs.id],
  }),
  tasks: many(tasks),
  kpis: many(kpis),
  risks: many(risks),
  benefits: many(benefits),
}));

export const stageGatesRelations = relations(stageGates, ({ one, many }) => ({
  program: one(programs, {
    fields: [stageGates.programId],
    references: [programs.id],
  }),
  reviews: many(stageGateReviews),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  workstream: one(workstreams, {
    fields: [tasks.workstreamId],
    references: [workstreams.id],
  }),
  owner: one(resources, {
    fields: [tasks.ownerId],
    references: [resources.id],
  }),
  stageGate: one(stageGates, {
    fields: [tasks.stageGateId],
    references: [stageGates.id],
  }),
  dependencies: many(taskDependencies),
  dependents: many(taskDependencies),
}));

export const kpisRelations = relations(kpis, ({ one, many }) => ({
  program: one(programs, {
    fields: [kpis.programId],
    references: [programs.id],
  }),
  owner: one(resources, {
    fields: [kpis.ownerId],
    references: [resources.id],
  }),
  measurements: many(kpiMeasurements),
}));

export const risksRelations = relations(risks, ({ one, many }) => ({
  program: one(programs, {
    fields: [risks.programId],
    references: [programs.id],
  }),
  owner: one(resources, {
    fields: [risks.ownerId],
    references: [resources.id],
  }),
  mitigations: many(riskMitigations),
}));

export const benefitsRelations = relations(benefits, ({ one }) => ({
  program: one(programs, {
    fields: [benefits.programId],
    references: [programs.id],
  }),
  owner: one(resources, {
    fields: [benefits.ownerId],
    references: [resources.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertProgramSchema = createInsertSchema(programs).omit({ id: true, createdAt: true });
export const insertWorkstreamSchema = createInsertSchema(workstreams).omit({ id: true, createdAt: true });
export const insertResourceSchema = createInsertSchema(resources).omit({ id: true, createdAt: true });
export const insertStageGateSchema = createInsertSchema(stageGates).omit({ id: true, createdAt: true });
export const insertStageGateReviewSchema = createInsertSchema(stageGateReviews).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export const insertTaskDependencySchema = createInsertSchema(taskDependencies).omit({ id: true, createdAt: true });
export const insertKpiSchema = createInsertSchema(kpis).omit({ id: true, createdAt: true });
export const insertKpiMeasurementSchema = createInsertSchema(kpiMeasurements).omit({ id: true, createdAt: true });
export const insertRiskSchema = createInsertSchema(risks).omit({ id: true, createdAt: true });
export const insertRiskMitigationSchema = createInsertSchema(riskMitigations).omit({ id: true, createdAt: true });
export const insertBenefitSchema = createInsertSchema(benefits).omit({ id: true, createdAt: true });
export const insertFundingSourceSchema = createInsertSchema(fundingSources).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type Workstream = typeof workstreams.$inferSelect;
export type Resource = typeof resources.$inferSelect;
export type StageGate = typeof stageGates.$inferSelect;
export type StageGateReview = typeof stageGateReviews.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskDependency = typeof taskDependencies.$inferSelect;
export type Kpi = typeof kpis.$inferSelect;
export type KpiMeasurement = typeof kpiMeasurements.$inferSelect;
export type Risk = typeof risks.$inferSelect;
export type RiskMitigation = typeof riskMitigations.$inferSelect;
export type Benefit = typeof benefits.$inferSelect;
export type FundingSource = typeof fundingSources.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
