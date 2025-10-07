import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean, pgEnum, jsonb, index } from "drizzle-orm/pg-core";
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
export const strategyStatusEnum = pgEnum('strategy_status', ['draft', 'finalized', 'converting', 'converted_to_program']);

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table - Updated for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  role: roleEnum("role").notNull().default('Viewer'),
  createdAt: timestamp("created_at").defaultNow(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// Ontology tables for AI knowledge base
export const ontologyEntities = pgTable("ontology_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityName: text("entity_name").notNull().unique(),
  definition: text("definition").notNull(),
  purpose: text("purpose").notNull(),
  data: jsonb("data").notNull(),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  versionIdx: index("idx_ontology_entities_version").on(table.version),
}));

export const ontologyRelationships = pgTable("ontology_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromEntity: text("from_entity").notNull(),
  toEntity: text("to_entity").notNull(),
  relationshipType: text("relationship_type").notNull(),
  cardinality: text("cardinality").notNull(),
  required: boolean("required").default(false),
  data: jsonb("data").notNull(),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  fromEntityIdx: index("idx_ontology_rels_from_entity").on(table.fromEntity),
  toEntityIdx: index("idx_ontology_rels_to_entity").on(table.toEntity),
  typeIdx: index("idx_ontology_rels_type").on(table.relationshipType),
  fromToIdx: index("idx_ontology_rels_from_to").on(table.fromEntity, table.toEntity),
}));

export const ontologyValidationRules = pgTable("ontology_validation_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: text("rule_id").notNull().unique(),
  entity: text("entity").notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  rule: text("rule").notNull(),
  validation: text("validation").notNull(),
  data: jsonb("data").notNull(),
  enabled: boolean("enabled").default(true),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  entityIdx: index("idx_ontology_rules_entity").on(table.entity),
  categoryIdx: index("idx_ontology_rules_category").on(table.category),
  severityIdx: index("idx_ontology_rules_severity").on(table.severity),
  enabledIdx: index("idx_ontology_rules_enabled").on(table.enabled),
  entityCategoryIdx: index("idx_ontology_rules_entity_category").on(table.entity, table.category),
}));

export const ontologyCompletenessChecks = pgTable("ontology_completeness_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  checkId: text("check_id").notNull().unique(),
  entity: text("entity").notNull(),
  checkType: text("check_type").notNull(),
  importance: text("importance").notNull(),
  description: text("description").notNull(),
  validation: text("validation").notNull(),
  data: jsonb("data").notNull(),
  enabled: boolean("enabled").default(true),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  entityIdx: index("idx_ontology_checks_entity").on(table.entity),
  checkTypeIdx: index("idx_ontology_checks_type").on(table.checkType),
  importanceIdx: index("idx_ontology_checks_importance").on(table.importance),
  enabledIdx: index("idx_ontology_checks_enabled").on(table.enabled),
  entityImportanceIdx: index("idx_ontology_checks_entity_importance").on(table.entity, table.importance),
}));

export const ontologyCascadeImpacts = pgTable("ontology_cascade_impacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trigger: text("trigger").notNull(),
  automationPotential: text("automation_potential").notNull(),
  impactDescription: text("impact_description").notNull(),
  data: jsonb("data").notNull(),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  triggerIdx: index("idx_ontology_cascades_trigger").on(table.trigger),
  automationIdx: index("idx_ontology_cascades_automation").on(table.automationPotential),
}));

export const ontologyDomainTerms = pgTable("ontology_domain_terms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  term: text("term").notNull().unique(),
  definition: text("definition").notNull(),
  context: text("context").notNull(),
  data: jsonb("data").notNull(),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ontologyFrameworkMappings = pgTable("ontology_framework_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  framework: text("framework").notNull(),
  concept: text("concept").notNull(),
  epmEntity: text("epm_entity").notNull(),
  mapping: text("mapping").notNull(),
  data: jsonb("data").notNull(),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  frameworkIdx: index("idx_ontology_mappings_framework").on(table.framework),
  entityIdx: index("idx_ontology_mappings_entity").on(table.epmEntity),
  frameworkEntityIdx: index("idx_ontology_mappings_framework_entity").on(table.framework, table.epmEntity),
}));

// Session Context table for goal tracking
export const sessionContext = pgTable("session_context", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goal: text("goal").notNull(),
  successCriteria: text("success_criteria").array().notNull().default(sql`ARRAY[]::text[]`),
  decisionsLog: jsonb("decisions_log").notNull().default(sql`'[]'::jsonb`),
  currentPhase: text("current_phase"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  isActiveIdx: index("idx_session_context_is_active").on(table.isActive),
}));

// Strategic Consultant tables
export const strategyVersions = pgTable("strategy_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  sessionId: varchar("session_id").references(() => sessionContext.id),
  versionNumber: integer("version_number").notNull(),
  versionLabel: varchar("version_label", { length: 100 }),
  inputSummary: text("input_summary"),
  analysisData: jsonb("analysis_data"),
  decisionsData: jsonb("decisions_data"),
  selectedDecisions: jsonb("selected_decisions"),
  strategicApproach: varchar("strategic_approach", { length: 100 }),
  marketContext: varchar("market_context", { length: 100 }),
  costMin: integer("cost_min"),
  costMax: integer("cost_max"),
  timelineMonths: integer("timeline_months"),
  teamSizeMin: integer("team_size_min"),
  teamSizeMax: integer("team_size_max"),
  decisions: jsonb("decisions").notNull().default(sql`'[]'::jsonb`),
  programStructure: jsonb("program_structure"),
  status: strategyStatusEnum("status").notNull().default('draft'),
  convertedProgramId: varchar("converted_program_id").references(() => programs.id),
  finalizedAt: timestamp("finalized_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").notNull(),
}, (table) => ({
  userIdIdx: index("idx_strategy_versions_user_id").on(table.userId),
  statusIdx: index("idx_strategy_versions_status").on(table.status),
  sessionVersionIdx: index("idx_strategy_versions_session_version").on(table.sessionId, table.versionNumber),
}));

export const strategicDecisions = pgTable("strategic_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyVersionId: varchar("strategy_version_id").notNull().references(() => strategyVersions.id),
  decisionPoint: varchar("decision_point", { length: 200 }).notNull(),
  optionSelected: varchar("option_selected", { length: 100 }).notNull(),
  rationale: text("rationale"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const strategyInsights = pgTable("strategy_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  context: jsonb("context").notNull(),
  observation: text("observation").notNull(),
  patternDetected: varchar("pattern_detected", { length: 200 }),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  validated: boolean("validated").default(false),
  createdFromSession: varchar("created_from_session").references(() => strategyVersions.id),
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
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
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
export const insertOntologyEntitySchema = createInsertSchema(ontologyEntities).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOntologyRelationshipSchema = createInsertSchema(ontologyRelationships).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOntologyValidationRuleSchema = createInsertSchema(ontologyValidationRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOntologyCompletenessCheckSchema = createInsertSchema(ontologyCompletenessChecks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOntologyCascadeImpactSchema = createInsertSchema(ontologyCascadeImpacts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOntologyDomainTermSchema = createInsertSchema(ontologyDomainTerms).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOntologyFrameworkMappingSchema = createInsertSchema(ontologyFrameworkMappings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSessionContextSchema = createInsertSchema(sessionContext).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStrategyVersionSchema = createInsertSchema(strategyVersions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStrategicDecisionSchema = createInsertSchema(strategicDecisions).omit({ id: true, createdAt: true });
export const insertStrategyInsightSchema = createInsertSchema(strategyInsights).omit({ id: true, createdAt: true });

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;  // For Replit Auth
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
export type OntologyEntity = typeof ontologyEntities.$inferSelect;
export type OntologyRelationship = typeof ontologyRelationships.$inferSelect;
export type OntologyValidationRule = typeof ontologyValidationRules.$inferSelect;
export type OntologyCompletenessCheck = typeof ontologyCompletenessChecks.$inferSelect;
export type OntologyCascadeImpact = typeof ontologyCascadeImpacts.$inferSelect;
export type OntologyDomainTerm = typeof ontologyDomainTerms.$inferSelect;
export type OntologyFrameworkMapping = typeof ontologyFrameworkMappings.$inferSelect;
export type SessionContext = typeof sessionContext.$inferSelect;
export type InsertSessionContext = z.infer<typeof insertSessionContextSchema>;
export type StrategyVersion = typeof strategyVersions.$inferSelect;
export type InsertStrategyVersion = z.infer<typeof insertStrategyVersionSchema>;
export type StrategicDecision = typeof strategicDecisions.$inferSelect;
export type InsertStrategicDecision = z.infer<typeof insertStrategicDecisionSchema>;
export type StrategyInsight = typeof strategyInsights.$inferSelect;
export type InsertStrategyInsight = z.infer<typeof insertStrategyInsightSchema>;

// AI Orchestration Types

export const aiProviderSchema = z.enum(['openai', 'anthropic', 'gemini']);
export type AIProvider = z.infer<typeof aiProviderSchema>;

export const codeArtifactSchema = z.object({
  filePath: z.string(),
  content: z.string(),
  description: z.string(),
});
export type CodeArtifact = z.infer<typeof codeArtifactSchema>;

export const requirementFulfillmentSchema = z.object({
  requirement: z.string(),
  satisfied: z.boolean(),
  notes: z.string(),
});
export type RequirementFulfillment = z.infer<typeof requirementFulfillmentSchema>;

export const decisionLogSchema = z.object({
  decision: z.string(),
  rationale: z.string(),
  alternatives: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(100),
});
export type DecisionLog = z.infer<typeof decisionLogSchema>;

export const builderResponseSchema = z.object({
  approach: z.string(),
  artifacts: z.array(codeArtifactSchema),
  confidence: z.number().min(0).max(100),
  requirements: z.array(requirementFulfillmentSchema),
  unmetRequirements: z.array(z.string()),
  decisions: z.array(decisionLogSchema),
});
export type BuilderResponse = z.infer<typeof builderResponseSchema>;

export const qaIssueSchema = z.object({
  category: z.enum(['gap', 'bug', 'edge-case', 'security', 'quality']),
  severity: z.enum(['critical', 'major', 'minor']),
  description: z.string(),
  location: z.string().optional(),
  recommendation: z.string(),
});
export type QAIssue = z.infer<typeof qaIssueSchema>;

export const qaReviewSchema = z.object({
  verdict: z.enum(['PASS', 'FAIL']),
  confidence: z.number().min(0).max(100),
  requirementsVerification: z.array(requirementFulfillmentSchema),
  issues: z.array(qaIssueSchema),
  criticalBlockers: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string(),
});
export type QAReview = z.infer<typeof qaReviewSchema>;

export const orchestratorTaskSchema = z.object({
  taskDescription: z.string(),
  requirements: z.array(z.string()),
  entity: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  preferredProvider: aiProviderSchema.optional(),
  maxRetries: z.number().min(0).max(5).default(2),
});
export type OrchestratorTask = z.infer<typeof orchestratorTaskSchema>;

export const orchestratorResponseSchema = z.object({
  taskId: z.string(),
  builderResponse: builderResponseSchema,
  qaReview: qaReviewSchema,
  verdict: z.enum(['PASS', 'FAIL']),
  iterations: z.number(),
  finalCode: z.array(codeArtifactSchema).optional(),
  provider: aiProviderSchema,
  error: z.string().optional(),
  timestamp: z.string(),
});
export type OrchestratorResponse = z.infer<typeof orchestratorResponseSchema>;
