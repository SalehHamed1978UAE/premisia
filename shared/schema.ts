import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean, pgEnum, jsonb, index, vector, primaryKey, unique } from "drizzle-orm/pg-core";
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
export const bmcBlockTypeEnum = pgEnum('bmc_block_type', [
  'customer_segments', 
  'value_propositions', 
  'revenue_streams',
  'channels',
  'customer_relationships',
  'key_resources',
  'key_activities',
  'key_partnerships',
  'cost_structure'
]);
export const bmcConfidenceEnum = pgEnum('bmc_confidence', ['weak', 'moderate', 'strong']);
export const frameworkTypeEnum = pgEnum('framework_type', ['porters_five_forces', 'business_model_canvas', 'user_choice']);

// Initiative type classification enum
export const initiativeTypeEnum = pgEnum('initiative_type', [
  'physical_business_launch',    // Opening coffee shop, restaurant, retail store
  'software_development',         // Building SaaS, mobile app, platform
  'digital_transformation',       // Adding digital capabilities to existing business
  'market_expansion',            // Expanding existing business to new markets
  'product_launch',              // Launching new product line
  'service_launch',              // Launching new service offering
  'process_improvement',         // Operational efficiency, restructuring
  'other'                        // Catch-all
]);

// Strategic Understanding (Knowledge Graph) Enums
export const entityTypeEnum = pgEnum('entity_type', [
  'explicit_assumption',
  'implicit_implication', 
  'inferred_reasoning',
  'research_finding',
  'business_model_gap',
  'root_cause',
  'competitive_force',
  'risk',
  'opportunity',
  'constraint'
]);
export const relationshipTypeEnum = pgEnum('relationship_type', [
  'contradicts',
  'supports',
  'implies',
  'causes',
  'blocks',
  'enables',
  'validates',
  'challenges',
  'relates_to'
]);
export const confidenceLevelEnum = pgEnum('confidence_level', ['high', 'medium', 'low']);
export const discoveredByEnum = pgEnum('discovered_by', [
  'user_input',
  'bmc_agent',
  '5whys_agent',
  'porters_agent',
  'trends_agent',
  'system'
]);

// Journey enums
export const journeyTypeEnum = pgEnum('journey_type', [
  'market_entry',
  'business_model_innovation',
  'competitive_strategy',
  'digital_transformation',
  'crisis_recovery',
  'growth_strategy'
]);
export const journeyStatusEnum = pgEnum('journey_status', [
  'queued',
  'initializing',
  'in_progress',
  'paused',
  'completed',
  'failed'
]);
export const frameworkNameEnum = pgEnum('framework_name', [
  'five_whys',
  'bmc',
  'porters',
  'pestle',
  'swot',
  'ansoff',
  'blue_ocean'
]);

// Strategy Workspace enums
export const riskToleranceEnum = pgEnum('risk_tolerance', ['conservative', 'balanced', 'aggressive']);
export const timelinePreferenceEnum = pgEnum('timeline_preference', ['fast_growth', 'sustainable_pace', 'deliberate']);
export const goDecisionEnum = pgEnum('go_decision', ['proceed', 'pivot', 'abandon']);
export const epmStatusEnum = pgEnum('epm_status', ['draft', 'finalized']);

// Journey Builder enums
export const difficultyEnum = pgEnum('difficulty', ['beginner', 'intermediate', 'advanced']);
export const userJourneyStatusEnum = pgEnum('user_journey_status', ['in_progress', 'completed', 'paused', 'abandoned']);

// Background Jobs enums
export const jobStatusEnum = pgEnum('job_status', ['pending', 'running', 'completed', 'failed']);
export const jobTypeEnum = pgEnum('job_type', [
  'epm_generation',
  'bmc_analysis',
  'five_whys_generation',
  'porters_analysis',
  'pestle_analysis',
  'web_research',
  'strategic_understanding',
  'document_enrichment',
  'journey_execution',
  'framework_execution'
]);

// Task Assignment enums  
export const assignmentSourceEnum = pgEnum('assignment_source', ['ai_generated', 'manual', 'bulk_import']);
export const assignmentResourceTypeEnum = pgEnum('assignment_resource_type', ['internal_team', 'external_resource']);

// Reference source type enum (for research provenance)
export const referenceSourceTypeEnum = pgEnum('reference_source_type', ['article', 'report', 'document', 'dataset', 'manual_entry']);
export const referenceOriginEnum = pgEnum('reference_origin', ['web_search', 'manual_upload', 'document_extract', 'manual_entry']);

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
  finalizedAt: timestamp("finalized_at"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").notNull(),
}, (table) => ({
  userIdIdx: index("idx_strategy_versions_user_id").on(table.userId),
  statusIdx: index("idx_strategy_versions_status").on(table.status),
  sessionVersionIdx: index("idx_strategy_versions_session_version").on(table.sessionId, table.versionNumber),
  archivedIdx: index("idx_strategy_versions_archived").on(table.archived),
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

// Business Model Canvas tables
export const frameworkSelections = pgTable("framework_selections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => sessionContext.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  selectedFramework: frameworkTypeEnum("selected_framework").notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  signals: jsonb("signals").notNull(), // Keywords, business stage, query type
  reasoning: text("reasoning").notNull(),
  userOverride: boolean("user_override").default(false),
  alternativeFramework: frameworkTypeEnum("alternative_framework"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  sessionIdx: index("idx_framework_selections_session").on(table.sessionId),
  userIdx: index("idx_framework_selections_user").on(table.userId),
}));

// Strategic Understanding (Knowledge Graph) Tables
export const strategicUnderstanding = pgTable("strategic_understanding", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().unique(),
  userInput: text("user_input").notNull(),
  title: varchar("title", { length: 200 }),
  // Initiative classification fields
  initiativeType: initiativeTypeEnum("initiative_type"),
  initiativeDescription: text("initiative_description"),
  userConfirmed: boolean("user_confirmed").default(false),
  classificationConfidence: decimal("classification_confidence", { precision: 3, scale: 2 }),
  companyContext: jsonb("company_context"),
  graphVersion: integer("graph_version").default(1),
  lastEnrichedBy: varchar("last_enriched_by", { length: 50 }),
  lastEnrichedAt: timestamp("last_enriched_at"),
  archived: boolean("archived").notNull().default(false),
  
  // Strategy readiness metadata cache
  strategyMetadata: jsonb("strategy_metadata").default(sql`'{}'::jsonb`),
  // Format: { availableEntities: number, availableReferences: number, completedFrameworks: string[], clarificationsProvided: {}, confidence: number, lastUpdated: timestamp }
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  sessionIdx: index("idx_strategic_understanding_session").on(table.sessionId),
  archivedIdx: index("idx_strategic_understanding_archived").on(table.archived),
  initiativeTypeIdx: index("idx_strategic_understanding_initiative_type").on(table.initiativeType),
}));

// Journey Sessions - Tracks multi-framework strategic journeys
export const journeySessions = pgTable("journey_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  understandingId: varchar("understanding_id").notNull().references(() => strategicUnderstanding.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  journeyType: journeyTypeEnum("journey_type").notNull(),
  status: journeyStatusEnum("status").notNull().default('initializing'),
  currentFrameworkIndex: integer("current_framework_index").default(0),
  completedFrameworks: frameworkNameEnum("completed_frameworks").array().default(sql`ARRAY[]::framework_name[]`),
  accumulatedContext: jsonb("accumulated_context").notNull().default(sql`'{}'::jsonb`),
  
  // Versioning and background execution fields
  versionNumber: integer("version_number").notNull().default(1),
  startedAt: timestamp("started_at").defaultNow(),
  background: boolean("background").notNull().default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  understandingIdx: index("idx_journey_sessions_understanding").on(table.understandingId),
  userIdx: index("idx_journey_sessions_user").on(table.userId),
  statusIdx: index("idx_journey_sessions_status").on(table.status),
  uniqueVersionConstraint: unique("unique_understanding_version").on(table.understandingId, table.versionNumber),
}));

// Research References - Full provenance tracking for all research sources
export const references = pgTable("references", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to artifacts (at least one required)
  understandingId: varchar("understanding_id").references(() => strategicUnderstanding.id, { onDelete: 'cascade' }),
  sessionId: varchar("session_id").references(() => journeySessions.id, { onDelete: 'cascade' }),
  programId: varchar("program_id").references(() => epmPrograms.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Source metadata
  sourceType: referenceSourceTypeEnum("source_type").notNull(),
  title: text("title").notNull(),
  url: text("url"), // Nullable for manual uploads/documents
  description: text("description"),
  topics: text("topics").array().default(sql`ARRAY[]::text[]`),
  confidence: decimal("confidence", { precision: 3, scale: 2 }), // 0.00-1.00
  
  // Usage tracking
  extractedQuotes: jsonb("extracted_quotes").default(sql`'[]'::jsonb`),
  // Format: [{ snippet: "text", page?: number, usedIn?: "BMC.customerSegments" }]
  
  usedInComponents: text("used_in_components").array().default(sql`ARRAY[]::text[]`),
  // Format: ["BMC.customerSegments", "RiskRegister[2]", "Porter.buyerPower"]
  
  // Provenance
  origin: referenceOriginEnum("origin").notNull(),
  lastValidated: timestamp("last_validated"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  understandingIdx: index("idx_references_understanding").on(table.understandingId),
  sessionIdx: index("idx_references_session").on(table.sessionId),
  programIdx: index("idx_references_program").on(table.programId),
  sourceTypeIdx: index("idx_references_source_type").on(table.sourceType),
  confidenceIdx: index("idx_references_confidence").on(table.confidence),
  userIdx: index("idx_references_user").on(table.userId),
}));

// Strategy Decisions table - Links to Strategy Workspace (new system)
export const strategyDecisions = pgTable("strategy_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyVersionId: varchar("strategy_version_id").notNull().references(() => strategyVersions.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Strategic Choices
  primaryCustomerSegment: text("primary_customer_segment"),
  revenueModel: text("revenue_model"),
  channelPriorities: text("channel_priorities").array().default(sql`ARRAY[]::text[]`),
  partnershipStrategy: text("partnership_strategy"),
  
  // Risk & Investment
  riskTolerance: riskToleranceEnum("risk_tolerance").notNull().default('balanced'),
  investmentCapacityMin: integer("investment_capacity_min"),
  investmentCapacityMax: integer("investment_capacity_max"),
  timelinePreference: timelinePreferenceEnum("timeline_preference").notNull().default('sustainable_pace'),
  successMetricsPriority: text("success_metrics_priority").array().default(sql`ARRAY[]::text[]`),
  
  // Assumptions
  validatedAssumptions: jsonb("validated_assumptions").default(sql`'[]'::jsonb`),
  concerns: text("concerns").array().default(sql`ARRAY[]::text[]`),
  
  // Priorities & Decision
  topPriorities: text("top_priorities").array().default(sql`ARRAY[]::text[]`),
  goDecision: goDecisionEnum("go_decision").notNull(),
  decisionRationale: text("decision_rationale"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  strategyVersionIdx: index("idx_strategy_decisions_version").on(table.strategyVersionId),
  userIdx: index("idx_strategy_decisions_user").on(table.userId),
}));

// EPM Programs table - Links to Strategy Workspace (new system)
export const epmPrograms = pgTable("epm_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyVersionId: varchar("strategy_version_id").notNull().references(() => strategyVersions.id, { onDelete: 'cascade' }),
  strategyDecisionId: varchar("strategy_decision_id").references(() => strategyDecisions.id, { onDelete: 'set null' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  frameworkType: varchar("framework_type", { length: 50 }).notNull(),
  
  // 14 EPM Components (JSONB for flexibility)
  executiveSummary: jsonb("executive_summary").notNull(),
  workstreams: jsonb("workstreams").notNull(),
  timeline: jsonb("timeline").notNull(),
  resourcePlan: jsonb("resource_plan").notNull(),
  financialPlan: jsonb("financial_plan").notNull(),
  benefitsRealization: jsonb("benefits_realization").notNull(),
  riskRegister: jsonb("risk_register").notNull(),
  stageGates: jsonb("stage_gates").notNull(),
  kpis: jsonb("kpis").notNull(),
  stakeholderMap: jsonb("stakeholder_map").notNull(),
  governance: jsonb("governance").notNull(),
  qaPlan: jsonb("qa_plan").notNull(),
  procurement: jsonb("procurement").notNull(),
  exitStrategy: jsonb("exit_strategy").notNull(),
  
  // Confidence tracking
  componentConfidence: jsonb("component_confidence").notNull(),
  overallConfidence: decimal("overall_confidence", { precision: 5, scale: 4 }).notNull(),
  
  // Edit tracking
  editTracking: jsonb("edit_tracking").notNull().default(sql`'{}'::jsonb`),
  
  status: epmStatusEnum("status").notNull().default('draft'),
  archived: boolean("archived").notNull().default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  finalizedAt: timestamp("finalized_at"),
}, (table) => ({
  strategyVersionIdx: index("idx_epm_programs_version").on(table.strategyVersionId),
  strategyDecisionIdx: index("idx_epm_programs_decision").on(table.strategyDecisionId),
  userIdx: index("idx_epm_programs_user").on(table.userId),
  statusIdx: index("idx_epm_programs_status").on(table.status),
  archivedIdx: index("idx_epm_programs_archived").on(table.archived),
}));

// Task Assignments table - Links resources to tasks within EPM programs
export const taskAssignments = pgTable("task_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  epmProgramId: varchar("epm_program_id").notNull().references(() => epmPrograms.id, { onDelete: 'cascade' }),
  taskId: varchar("task_id").notNull(),
  resourceId: varchar("resource_id").notNull(),
  resourceType: assignmentResourceTypeEnum("resource_type").notNull(),
  
  assignedAt: timestamp("assigned_at").defaultNow(),
  estimatedHours: integer("estimated_hours"),
  actualHours: integer("actual_hours"),
  status: varchar("status", { length: 20 }).notNull().default('assigned'), // 'assigned' | 'in_progress' | 'completed'
  assignmentSource: assignmentSourceEnum("assignment_source").notNull().default('ai_generated'),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  programIdx: index("idx_task_assignments_program").on(table.epmProgramId),
  taskIdx: index("idx_task_assignments_task").on(table.taskId),
  resourceIdx: index("idx_task_assignments_resource").on(table.resourceId),
}));

export const strategicEntities = pgTable("strategic_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  understandingId: varchar("understanding_id").notNull().references(() => strategicUnderstanding.id, { onDelete: 'cascade' }),
  type: entityTypeEnum("type").notNull(),
  claim: text("claim").notNull(),
  confidence: confidenceLevelEnum("confidence"),
  embedding: vector("embedding", { dimensions: 1536 }),
  source: text("source").notNull(),
  evidence: text("evidence"),
  category: text("category"),
  subcategory: text("subcategory"),
  investmentAmount: integer("investment_amount"),
  discoveredBy: discoveredByEnum("discovered_by").notNull(),
  discoveredAt: timestamp("discovered_at").defaultNow(),
  validFrom: timestamp("valid_from").defaultNow(),
  validTo: timestamp("valid_to"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  understandingIdx: index("idx_strategic_entities_understanding").on(table.understandingId),
  typeIdx: index("idx_strategic_entities_type").on(table.type),
  discoveredByIdx: index("idx_strategic_entities_discovered_by").on(table.discoveredBy),
  validFromIdx: index("idx_strategic_entities_valid_from").on(table.validFrom),
  embeddingIdx: index("idx_strategic_entities_embedding").using(
    'ivfflat',
    table.embedding.op('vector_cosine_ops')
  ).with({ lists: 100 }),
  textSearchIdx: index("idx_strategic_entities_text_search").using(
    'gin',
    sql`to_tsvector('english', ${table.claim} || ' ' || COALESCE(${table.source}, '') || ' ' || COALESCE(${table.evidence}, ''))`
  ),
}));

export const strategicRelationships = pgTable("strategic_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromEntityId: varchar("from_entity_id").notNull().references(() => strategicEntities.id, { onDelete: 'cascade' }),
  toEntityId: varchar("to_entity_id").notNull().references(() => strategicEntities.id, { onDelete: 'cascade' }),
  relationshipType: relationshipTypeEnum("relationship_type").notNull(),
  confidence: confidenceLevelEnum("confidence"),
  evidence: text("evidence"),
  discoveredBy: discoveredByEnum("discovered_by").notNull(),
  discoveredAt: timestamp("discovered_at").defaultNow(),
  validFrom: timestamp("valid_from").defaultNow(),
  validTo: timestamp("valid_to"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  fromEntityIdx: index("idx_strategic_relationships_from").on(table.fromEntityId),
  toEntityIdx: index("idx_strategic_relationships_to").on(table.toEntityId),
  relationshipTypeIdx: index("idx_strategic_relationships_type").on(table.relationshipType),
  discoveredByIdx: index("idx_strategic_relationships_discovered_by").on(table.discoveredBy),
}));

// Trend Analysis Agent Tables (Phase 3)
// Authority Sources Registry - Main table with normalized junction tables
export const authoritySources = pgTable("authority_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  url: text("url"),
  tier: integer("tier").notNull(), // 1 = high, 2 = medium, 3 = low authority
  lastSeen: timestamp("last_seen").notNull().defaultNow(),
  hits: integer("hits").notNull().default(0),
  corroborations: integer("corroborations").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  nameIdx: index("idx_authority_sources_name").on(table.name),
  tierIdx: index("idx_authority_sources_tier").on(table.tier),
}));

export const authoritySourceIndustries = pgTable("authority_source_industries", {
  authorityId: varchar("authority_id").notNull().references(() => authoritySources.id, { onDelete: 'cascade' }),
  industry: text("industry").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.authorityId, table.industry] }),
  industryIdx: index("idx_auth_industry").on(table.industry),
}));

export const authoritySourceCountries = pgTable("authority_source_countries", {
  authorityId: varchar("authority_id").notNull().references(() => authoritySources.id, { onDelete: 'cascade' }),
  countryIso2: varchar("country_iso2", { length: 2 }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.authorityId, table.countryIso2] }),
  countryIdx: index("idx_auth_country").on(table.countryIso2),
}));

export const authoritySourceLanguages = pgTable("authority_source_languages", {
  authorityId: varchar("authority_id").notNull().references(() => authoritySources.id, { onDelete: 'cascade' }),
  language: text("language").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.authorityId, table.language] }),
  languageIdx: index("idx_auth_language").on(table.language),
}));

// Trend Analysis Claims Cache (optional, feature-flagged)
export const trendClaimsCache = pgTable("trend_claims_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimText: text("claim_text").notNull(),
  pestleDomain: varchar("pestle_domain", { length: 50 }).notNull(),
  industries: text("industries").array().notNull(),
  geographies: text("geographies").array().notNull(),
  metrics: jsonb("metrics"),
  evidence: jsonb("evidence").notNull(),
  agreement: varchar("agreement", { length: 20 }).notNull(),
  confidence: varchar("confidence", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => ({
  geographiesIdx: index("idx_claims_cache_geo").using('gin', table.geographies),
  expiresAtIdx: index("idx_claims_cache_expires").on(table.expiresAt),
}));

// Trend Analysis Jobs (for idempotency and job orchestration)
export const trendAnalysisJobs = pgTable("trend_analysis_jobs", {
  jobId: varchar("job_id").primaryKey().default(sql`gen_random_uuid()`),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  understandingId: varchar("understanding_id").notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  data: jsonb("data"),
  result: jsonb("result"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  idempotencyKeyIdx: index("idx_trend_jobs_idempotency").on(table.idempotencyKey),
  understandingIdx: index("idx_trend_jobs_understanding").on(table.understandingId),
  statusIdx: index("idx_trend_jobs_status").on(table.status),
}));

// Framework Insights - Generic storage for framework analysis results
export const frameworkInsights = pgTable("framework_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  understandingId: varchar("understanding_id").notNull().references(() => strategicUnderstanding.id, { onDelete: 'cascade' }),
  sessionId: varchar("session_id").references(() => journeySessions.id, { onDelete: 'cascade' }),
  frameworkName: varchar("framework_name", { length: 50 }).notNull(),
  frameworkVersion: varchar("framework_version", { length: 20 }),
  insights: jsonb("insights").notNull(),
  telemetry: jsonb("telemetry"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  understandingIdx: index("idx_framework_insights_understanding").on(table.understandingId),
  sessionIdx: index("idx_framework_insights_session").on(table.sessionId),
  frameworkIdx: index("idx_framework_insights_framework").on(table.frameworkName),
}));

export const bmcAnalyses = pgTable("bmc_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyVersionId: varchar("strategy_version_id").notNull().references(() => strategyVersions.id),
  viability: varchar("viability", { length: 20 }).notNull(), // strong, moderate, weak
  overallConfidence: decimal("overall_confidence", { precision: 3, scale: 2 }),
  keyInsights: text("key_insights").array().notNull().default(sql`ARRAY[]::text[]`),
  criticalGaps: text("critical_gaps").array().notNull().default(sql`ARRAY[]::text[]`),
  consistencyChecks: jsonb("consistency_checks").notNull().default(sql`'[]'::jsonb`),
  recommendations: jsonb("recommendations").notNull().default(sql`'[]'::jsonb`),
  researchSources: jsonb("research_sources").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  strategyVersionIdx: index("idx_bmc_analyses_strategy_version").on(table.strategyVersionId),
}));

export const bmcBlocks = pgTable("bmc_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bmcAnalysisId: varchar("bmc_analysis_id").notNull().references(() => bmcAnalyses.id),
  blockType: bmcBlockTypeEnum("block_type").notNull(),
  description: text("description").notNull(),
  confidence: bmcConfidenceEnum("confidence").notNull(),
  strategicImplications: text("strategic_implications"),
  gaps: text("gaps").array().notNull().default(sql`ARRAY[]::text[]`),
  researchQueries: text("research_queries").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  bmcAnalysisIdx: index("idx_bmc_blocks_analysis").on(table.bmcAnalysisId),
  blockTypeIdx: index("idx_bmc_blocks_type").on(table.blockType),
}));

export const bmcFindings = pgTable("bmc_findings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bmcBlockId: varchar("bmc_block_id").notNull().references(() => bmcBlocks.id),
  finding: text("finding").notNull(),
  validationStrength: varchar("validation_strength", { length: 20 }).notNull(), // STRONG, MODERATE, WEAK
  validationDetails: text("validation_details").notNull(),
  sources: jsonb("sources").notNull().default(sql`'[]'::jsonb`),
  contradictsInput: boolean("contradicts_input").default(false),
  contradictionDetails: text("contradiction_details"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  blockIdx: index("idx_bmc_findings_block").on(table.bmcBlockId),
}));

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
export const insertFrameworkSelectionSchema = createInsertSchema(frameworkSelections).omit({ id: true, createdAt: true });
export const insertBMCAnalysisSchema = createInsertSchema(bmcAnalyses).omit({ id: true, createdAt: true });
export const insertBMCBlockSchema = createInsertSchema(bmcBlocks).omit({ id: true, createdAt: true });
export const insertBMCFindingSchema = createInsertSchema(bmcFindings).omit({ id: true, createdAt: true });

// Strategic Understanding (Knowledge Graph) insert schemas
export const insertStrategicUnderstandingSchema = createInsertSchema(strategicUnderstanding).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJourneySessionSchema = createInsertSchema(journeySessions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReferenceSchema = createInsertSchema(references).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStrategyDecisionSchema = createInsertSchema(strategyDecisions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEpmProgramSchema = createInsertSchema(epmPrograms).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskAssignmentSchema = createInsertSchema(taskAssignments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStrategicEntitySchema = createInsertSchema(strategicEntities).omit({ id: true, createdAt: true, updatedAt: true, discoveredAt: true });
export const insertStrategicRelationshipSchema = createInsertSchema(strategicRelationships).omit({ id: true, createdAt: true, updatedAt: true, discoveredAt: true });

// Trend Analysis insert schemas
export const insertAuthoritySourceSchema = createInsertSchema(authoritySources).omit({ id: true, createdAt: true });
export const insertAuthoritySourceIndustrySchema = createInsertSchema(authoritySourceIndustries);
export const insertAuthoritySourceCountrySchema = createInsertSchema(authoritySourceCountries);
export const insertAuthoritySourceLanguageSchema = createInsertSchema(authoritySourceLanguages);
export const insertTrendClaimsCacheSchema = createInsertSchema(trendClaimsCache).omit({ id: true, createdAt: true });
export const insertTrendAnalysisJobSchema = createInsertSchema(trendAnalysisJobs).omit({ jobId: true, createdAt: true });
export const insertFrameworkInsightSchema = createInsertSchema(frameworkInsights).omit({ id: true, createdAt: true });

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
export type FrameworkSelection = typeof frameworkSelections.$inferSelect;
export type InsertFrameworkSelection = z.infer<typeof insertFrameworkSelectionSchema>;
export type BMCAnalysis = typeof bmcAnalyses.$inferSelect;
export type InsertBMCAnalysis = z.infer<typeof insertBMCAnalysisSchema>;
export type BMCBlock = typeof bmcBlocks.$inferSelect;
export type InsertBMCBlock = z.infer<typeof insertBMCBlockSchema>;
export type BMCFinding = typeof bmcFindings.$inferSelect;
export type InsertBMCFinding = z.infer<typeof insertBMCFindingSchema>;

// Strategic Understanding (Knowledge Graph) types
export type StrategicUnderstanding = typeof strategicUnderstanding.$inferSelect;
export type InsertStrategicUnderstanding = z.infer<typeof insertStrategicUnderstandingSchema>;
export type JourneySession = typeof journeySessions.$inferSelect;
export type InsertJourneySession = z.infer<typeof insertJourneySessionSchema>;
export type Reference = typeof references.$inferSelect;
export type InsertReference = z.infer<typeof insertReferenceSchema>;
export type StrategicEntity = typeof strategicEntities.$inferSelect;
export type InsertStrategicEntity = z.infer<typeof insertStrategicEntitySchema>;
export type StrategicRelationship = typeof strategicRelationships.$inferSelect;
export type InsertStrategicRelationship = z.infer<typeof insertStrategicRelationshipSchema>;

// Task Assignment types
export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type InsertTaskAssignment = z.infer<typeof insertTaskAssignmentSchema>;

// Trend Analysis types
export type AuthoritySource = typeof authoritySources.$inferSelect;
export type InsertAuthoritySource = z.infer<typeof insertAuthoritySourceSchema>;
export type AuthoritySourceIndustry = typeof authoritySourceIndustries.$inferSelect;
export type InsertAuthoritySourceIndustry = z.infer<typeof insertAuthoritySourceIndustrySchema>;
export type AuthoritySourceCountry = typeof authoritySourceCountries.$inferSelect;
export type InsertAuthoritySourceCountry = z.infer<typeof insertAuthoritySourceCountrySchema>;
export type AuthoritySourceLanguage = typeof authoritySourceLanguages.$inferSelect;
export type InsertAuthoritySourceLanguage = z.infer<typeof insertAuthoritySourceLanguageSchema>;
export type TrendClaimsCache = typeof trendClaimsCache.$inferSelect;
export type InsertTrendClaimsCache = z.infer<typeof insertTrendClaimsCacheSchema>;
export type TrendAnalysisJob = typeof trendAnalysisJobs.$inferSelect;
export type InsertTrendAnalysisJob = z.infer<typeof insertTrendAnalysisJobSchema>;
export type FrameworkInsight = typeof frameworkInsights.$inferSelect;
export type InsertFrameworkInsight = z.infer<typeof insertFrameworkInsightSchema>;

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

// Trend Analysis Agent Types (Phase 3)
export interface Geography {
  country: string;
  countryISO2: string;
  region?: string;
  regionISO?: string;
  city?: string;
  cityGeoNameId?: string;
  scope: 'local' | 'regional' | 'national' | 'international';
}

export interface Domain {
  industry: string;
  subDomain?: string;
  geography: Geography;
  language: {
    primary: string;
    secondary?: string[];
  };
  regulatory: {
    framework: string;
    jurisdiction?: string;
  };
  context: {
    decisionType: string;
    horizon: string;
    segment: string;
    companySize: string;
  };
}

export interface AuthoritySourceData {
  name: string;
  industries: string[];
  countries: string[];
  languages: string[];
  url?: string;
}

export interface SourceGuidance {
  tier1: AuthoritySourceData[];
  tier2: AuthoritySourceData[];
  tier3: AuthoritySourceData[];
  avoid: string[];
}

export interface Evidence {
  sourceId: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceName: string;
  publishDate: string;
  excerpt: string;
  originalExcerpt?: string;
  language: string;
  isTranslated: boolean;
  originalLanguage?: string;
  isRTL?: boolean;
}

export interface Claim {
  id: string;
  text: string;
  pestleDomain: 'POLITICAL' | 'ECONOMIC' | 'SOCIAL' | 'TECHNOLOGICAL' | 'LEGAL' | 'ENVIRONMENTAL';
  industries: string[];
  geographies: string[];
  timeHorizon: 'current' | 'short_term' | 'medium_term' | 'long_term';
  metrics?: Record<string, number>;
  evidence: Evidence[];
  agreement: 'full' | 'partial' | 'conflicting';
  confidence: 'high' | 'medium' | 'low';
  created: string;
}

export interface PESTLEFactors {
  POLITICAL: Claim[];
  ECONOMIC: Claim[];
  SOCIAL: Claim[];
  TECHNOLOGICAL: Claim[];
  LEGAL: Claim[];
  ENVIRONMENTAL: Claim[];
}

export interface AssumptionComparison {
  type: 'validates' | 'contradicts';
  userEntityId: string;
  trendClaim: Claim;
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface TrendTelemetry {
  latency_ms: number;
  tokens: {
    input: number;
    output: number;
    by_step: Record<string, { input: number; output: number }>;
  };
  cache_hits: {
    authority: number;
    documents: number;
    claims: number;
  };
  documents_by_tier: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  retries_used: number;
  external_api_calls: {
    azure_translator: number;
    geonames: number;
    web_search: number;
    web_fetch: number;
  };
  external_api_failures: {
    azure_translator: number;
    geonames: number;
  };
}

export interface TrendResult {
  version: string;
  domain: Domain;
  pestleFactors: PESTLEFactors;
  validatedClaims: Claim[];
  comparisons: AssumptionComparison[];
  synthesis: string;
  telemetry?: TrendTelemetry;
}

export interface Document {
  id: string;
  url: string;
  title: string;
  publisher: string;
  publishDateISO: string;
  content: string;
  abstract?: string;
  language: string;
  wasTranslated?: boolean;
  originalLanguage?: string;
  originalExcerpt?: string;
  isPaywalled?: boolean;
  hasAbstract?: boolean;
  isGlobal?: boolean;
  coversMultipleCountries?: boolean;
}

export interface Source {
  name: string;
  url?: string;
  industries?: string[];
  countries?: string[];
  language?: string;
  publishDateISO?: string;
  hasQuantitativeData?: boolean;
  citesPrimaryResearch?: boolean;
  showsMethodology?: boolean;
  matches(authorityName: string): boolean;
  coversCountryByISO(iso: string): boolean;
  coversRegionByISO(iso: string): boolean;
  coversCityByGeoNameId(id: string): boolean;
  isGlobalWithCountryData(iso: string): boolean;
  isGlobalGeneric(): boolean;
  coversRegulatoryFramework(framework: string): boolean;
}

// ============================================================================
// STRATEGY WORKSPACE - New Architecture (Production System)
// ============================================================================

// Strategy Workspace Enums
export const problemStatusEnum = pgEnum('problem_status', ['active', 'on_hold', 'archived', 'completed']);
export const strategyWorkspaceStatusEnum = pgEnum('strategy_workspace_status', ['draft', 'in_progress', 'analyzed', 'approved', 'rejected', 'archived']);
export const frameworkRunStatusEnum = pgEnum('framework_run_status', ['pending', 'running', 'complete', 'failed', 'skipped']);
export const executionPlanStatusEnum = pgEnum('execution_plan_status', ['draft', 'pending_approval', 'approved', 'in_execution', 'completed', 'cancelled']);
export const riskProfileEnum = pgEnum('risk_profile', ['low', 'medium', 'high', 'critical']);
export const confidenceLevelWorkspaceEnum = pgEnum('confidence_level_workspace', ['very_low', 'low', 'medium', 'high', 'very_high']);
export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'rejected', 'conditionally_approved']);
export const entityTypeWorkspaceEnum = pgEnum('entity_type_workspace', ['problem', 'strategy', 'execution_plan', 'framework_run']);

// Problems table - Root initiatives
export const swProblems = pgTable("sw_problems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  context: jsonb("context"),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: problemStatusEnum("status").notNull().default('active'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
}, (table) => ({
  userIdx: index("idx_sw_problems_user").on(table.userId),
  statusIdx: index("idx_sw_problems_status").on(table.status),
}));

// Strategies table - Multiple per problem with different journeys/decisions
export const swStrategies = pgTable("sw_strategies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  problemId: varchar("problem_id").notNull().references(() => swProblems.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  approachType: journeyTypeEnum("approach_type").notNull(),
  versionNumber: integer("version_number").notNull().default(1),
  decisionRationale: text("decision_rationale"),
  status: strategyWorkspaceStatusEnum("status").notNull().default('draft'),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by"),
}, (table) => ({
  problemIdx: index("idx_sw_strategies_problem").on(table.problemId),
  statusIdx: index("idx_sw_strategies_status").on(table.status),
  approachIdx: index("idx_sw_strategies_approach").on(table.approachType),
}));

// Framework Runs table - Stores execution results from Five Whys, BMC, Porter's, PESTLE
export const swFrameworkRuns = pgTable("sw_framework_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar("strategy_id").notNull().references(() => swStrategies.id, { onDelete: 'cascade' }),
  frameworkType: frameworkNameEnum("framework_type").notNull(),
  sequenceOrder: integer("sequence_order").notNull(),
  status: frameworkRunStatusEnum("status").notNull().default('pending'),
  inputParameters: jsonb("input_parameters"),
  rawResults: jsonb("raw_results"),
  errorLogs: text("error_logs"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  runBy: varchar("run_by").notNull(),
  metadata: jsonb("metadata"),
}, (table) => ({
  strategyIdx: index("idx_sw_framework_runs_strategy").on(table.strategyId),
  statusIdx: index("idx_sw_framework_runs_status").on(table.status),
  typeIdx: index("idx_sw_framework_runs_type").on(table.frameworkType),
}));

// Execution Plans table - Complete EPM programs with ALL 14 components
export const swExecutionPlans = pgTable("sw_execution_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar("strategy_id").notNull().references(() => swStrategies.id, { onDelete: 'cascade' }),
  status: executionPlanStatusEnum("status").notNull().default('draft'),
  riskProfile: riskProfileEnum("risk_profile").notNull(),
  costEstimateLow: decimal("cost_estimate_low", { precision: 12, scale: 2 }),
  costEstimateHigh: decimal("cost_estimate_high", { precision: 12, scale: 2 }),
  timelineMonths: integer("timeline_months"),
  npvEstimate: decimal("npv_estimate", { precision: 12, scale: 2 }),
  roiEstimate: decimal("roi_estimate", { precision: 5, scale: 2 }),
  paybackMonths: integer("payback_months"),
  confidenceLevel: confidenceLevelWorkspaceEnum("confidence_level").notNull(),
  benefitsRealizationCurve: jsonb("benefits_realization_curve"),
  extractionRationale: text("extraction_rationale"),
  epmProgram: jsonb("epm_program").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").notNull(),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
}, (table) => ({
  strategyIdx: index("idx_sw_execution_plans_strategy").on(table.strategyId),
  statusIdx: index("idx_sw_execution_plans_status").on(table.status),
  riskIdx: index("idx_sw_execution_plans_risk").on(table.riskProfile),
}));

// Strategy Versions table - Snapshots for version control
export const swStrategyVersions = pgTable("sw_strategy_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar("strategy_id").notNull().references(() => swStrategies.id, { onDelete: 'cascade' }),
  versionNumber: integer("version_number").notNull(),
  changesMade: text("changes_made"),
  snapshotData: jsonb("snapshot_data").notNull(),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  strategyIdx: index("idx_sw_strategy_versions_strategy").on(table.strategyId),
  versionIdx: index("idx_sw_strategy_versions_version").on(table.versionNumber),
}));

// Journey States table - Save/resume capability
export const swJourneyStates = pgTable("sw_journey_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  strategyId: varchar("strategy_id").notNull().references(() => swStrategies.id, { onDelete: 'cascade' }),
  currentStep: text("current_step").notNull(),
  journeyType: journeyTypeEnum("journey_type").notNull(),
  stateData: jsonb("state_data").notNull(),
  lastSaved: timestamp("last_saved").defaultNow(),
  expiresAt: timestamp("expires_at"),
  userId: varchar("user_id").notNull().references(() => users.id),
}, (table) => ({
  strategyIdx: index("idx_sw_journey_states_strategy").on(table.strategyId),
  userIdx: index("idx_sw_journey_states_user").on(table.userId),
  expiresIdx: index("idx_sw_journey_states_expires").on(table.expiresAt),
}));

// Approvals table - Workflow management
export const swApprovals = pgTable("sw_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: entityTypeWorkspaceEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  approverId: varchar("approver_id").notNull().references(() => users.id),
  status: approvalStatusEnum("status").notNull().default('pending'),
  comments: text("comments"),
  conditions: text("conditions"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  entityIdx: index("idx_sw_approvals_entity").on(table.entityType, table.entityId),
  approverIdx: index("idx_sw_approvals_approver").on(table.approverId),
  statusIdx: index("idx_sw_approvals_status").on(table.status),
}));

// Attachments table - File management
export const swAttachments = pgTable("sw_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: entityTypeWorkspaceEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => ({
  entityIdx: index("idx_sw_attachments_entity").on(table.entityType, table.entityId),
  uploaderIdx: index("idx_sw_attachments_uploader").on(table.uploadedBy),
}));

// Strategy Comparisons table - Side-by-side analysis
export const swStrategyComparisons = pgTable("sw_strategy_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  problemId: varchar("problem_id").notNull().references(() => swProblems.id, { onDelete: 'cascade' }),
  comparedStrategyIds: text("compared_strategy_ids").array().notNull(),
  comparisonCriteria: jsonb("comparison_criteria"),
  comparisonMatrix: jsonb("comparison_matrix").notNull(),
  recommendedStrategyId: varchar("recommended_strategy_id"),
  recommendationRationale: text("recommendation_rationale"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").notNull(),
}, (table) => ({
  problemIdx: index("idx_sw_comparisons_problem").on(table.problemId),
  createdByIdx: index("idx_sw_comparisons_created_by").on(table.createdBy),
}));

// Audit Log table - Change tracking and compliance
export const swAuditLog = pgTable("sw_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: entityTypeWorkspaceEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  action: text("action").notNull(),
  changes: jsonb("changes"),
  userId: varchar("user_id").notNull().references(() => users.id),
  timestamp: timestamp("timestamp").defaultNow(),
  ipAddress: text("ip_address"),
}, (table) => ({
  entityIdx: index("idx_sw_audit_log_entity").on(table.entityType, table.entityId),
  userIdx: index("idx_sw_audit_log_user").on(table.userId),
  timestampIdx: index("idx_sw_audit_log_timestamp").on(table.timestamp),
  actionIdx: index("idx_sw_audit_log_action").on(table.action),
}));

// =============================================================================
// Journey Builder Tables - User-Composable Framework System
// =============================================================================

// Journey Templates table - Pre-defined and custom journey blueprints
export const journeyTemplates = pgTable("journey_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isSystemTemplate: boolean("is_system_template").notNull().default(false),
  createdBy: varchar("created_by").references(() => users.id),
  steps: jsonb("steps").notNull(), // JourneyStep[]
  category: text("category"),
  tags: jsonb("tags").default(sql`'[]'::jsonb`), // string[]
  estimatedDuration: integer("estimated_duration_minutes"),
  difficulty: difficultyEnum("difficulty"),
  usageCount: integer("usage_count").notNull().default(0),
  version: integer("version").notNull().default(1),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  createdByIdx: index("idx_journey_templates_created_by").on(table.createdBy),
  categoryIdx: index("idx_journey_templates_category").on(table.category),
  systemIdx: index("idx_journey_templates_system").on(table.isSystemTemplate),
  publishedIdx: index("idx_journey_templates_published").on(table.isPublished),
}));

// User Journeys table - Active journey instances
export const userJourneys = pgTable("user_journeys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  sessionId: text("session_id").notNull().unique(),
  templateId: varchar("template_id").references(() => journeyTemplates.id),
  name: text("name").notNull(),
  steps: jsonb("steps").notNull(), // JourneyStep[]
  currentStepIndex: integer("current_step_index").notNull().default(0),
  status: userJourneyStatusEnum("status").notNull().default('in_progress'),
  completedSteps: jsonb("completed_steps").notNull().default(sql`'[]'::jsonb`), // string[]
  stepResults: jsonb("step_results").notNull().default(sql`'{}'::jsonb`), // Record<string, any>
  journeyContext: jsonb("journey_context").notNull().default(sql`'{}'::jsonb`), // Record<string, any>
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("idx_user_journeys_user").on(table.userId),
  sessionIdx: index("idx_user_journeys_session").on(table.sessionId),
  templateIdx: index("idx_user_journeys_template").on(table.templateId),
  statusIdx: index("idx_user_journeys_status").on(table.status),
}));

// Framework Registry table - All user-selectable frameworks
export const frameworkRegistry = pgTable("framework_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  frameworkKey: text("framework_key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  estimatedDuration: integer("estimated_duration_minutes"),
  difficulty: difficultyEnum("difficulty"),
  requiredInputs: jsonb("required_inputs").notNull().default(sql`'[]'::jsonb`), // string[]
  providedOutputs: jsonb("provided_outputs").notNull().default(sql`'[]'::jsonb`), // string[]
  isActive: boolean("is_active").notNull().default(true),
  version: text("version").notNull().default('1.0'),
  processorPath: text("processor_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  keyIdx: index("idx_framework_registry_key").on(table.frameworkKey),
  categoryIdx: index("idx_framework_registry_category").on(table.category),
  activeIdx: index("idx_framework_registry_active").on(table.isActive),
}));

// Background Jobs table - Track long-running operations for recovery
export const backgroundJobs = pgTable("background_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  jobType: jobTypeEnum("job_type").notNull(),
  status: jobStatusEnum("status").notNull().default('pending'),
  progress: integer("progress").notNull().default(0),
  progressMessage: text("progress_message"),
  inputData: jsonb("input_data"),
  resultData: jsonb("result_data"),
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
  sessionId: text("session_id"),
  relatedEntityId: varchar("related_entity_id"),
  relatedEntityType: text("related_entity_type"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("idx_background_jobs_user").on(table.userId),
  statusIdx: index("idx_background_jobs_status").on(table.status),
  sessionIdx: index("idx_background_jobs_session").on(table.sessionId),
  typeIdx: index("idx_background_jobs_type").on(table.jobType),
  relatedEntityIdx: index("idx_background_jobs_related_entity").on(table.relatedEntityId, table.relatedEntityType),
}));

// Insert Schemas for Strategy Workspace
export const insertSwProblemSchema = createInsertSchema(swProblems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSwProblem = z.infer<typeof insertSwProblemSchema>;
export type SelectSwProblem = typeof swProblems.$inferSelect;

export const insertSwStrategySchema = createInsertSchema(swStrategies).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSwStrategy = z.infer<typeof insertSwStrategySchema>;
export type SelectSwStrategy = typeof swStrategies.$inferSelect;

export const insertSwFrameworkRunSchema = createInsertSchema(swFrameworkRuns).omit({ id: true, startedAt: true, completedAt: true });
export type InsertSwFrameworkRun = z.infer<typeof insertSwFrameworkRunSchema>;
export type SelectSwFrameworkRun = typeof swFrameworkRuns.$inferSelect;

export const insertSwExecutionPlanSchema = createInsertSchema(swExecutionPlans).omit({ id: true, createdAt: true, approvedAt: true });
export type InsertSwExecutionPlan = z.infer<typeof insertSwExecutionPlanSchema>;
export type SelectSwExecutionPlan = typeof swExecutionPlans.$inferSelect;

export const insertSwJourneyStateSchema = createInsertSchema(swJourneyStates).omit({ id: true, lastSaved: true });
export type InsertSwJourneyState = z.infer<typeof insertSwJourneyStateSchema>;
export type SelectSwJourneyState = typeof swJourneyStates.$inferSelect;

export const insertSwApprovalSchema = createInsertSchema(swApprovals).omit({ id: true, createdAt: true, decidedAt: true });
export type InsertSwApproval = z.infer<typeof insertSwApprovalSchema>;
export type SelectSwApproval = typeof swApprovals.$inferSelect;

export const insertSwAttachmentSchema = createInsertSchema(swAttachments).omit({ id: true, uploadedAt: true });
export type InsertSwAttachment = z.infer<typeof insertSwAttachmentSchema>;
export type SelectSwAttachment = typeof swAttachments.$inferSelect;

export const insertSwComparisonSchema = createInsertSchema(swStrategyComparisons).omit({ id: true, createdAt: true });
export type InsertSwComparison = z.infer<typeof insertSwComparisonSchema>;
export type SelectSwComparison = typeof swStrategyComparisons.$inferSelect;

export const insertSwAuditLogSchema = createInsertSchema(swAuditLog).omit({ id: true, timestamp: true });
export type InsertSwAuditLog = z.infer<typeof insertSwAuditLogSchema>;
export type SelectSwAuditLog = typeof swAuditLog.$inferSelect;

// Insert Schemas for Journey Builder
export const insertJourneyTemplateSchema = createInsertSchema(journeyTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJourneyTemplate = z.infer<typeof insertJourneyTemplateSchema>;
export type SelectJourneyTemplate = typeof journeyTemplates.$inferSelect;

export const insertUserJourneySchema = createInsertSchema(userJourneys).omit({ id: true, startedAt: true, lastActivityAt: true });
export type InsertUserJourney = z.infer<typeof insertUserJourneySchema>;
export type SelectUserJourney = typeof userJourneys.$inferSelect;

export const insertFrameworkRegistrySchema = createInsertSchema(frameworkRegistry).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFrameworkRegistry = z.infer<typeof insertFrameworkRegistrySchema>;
export type SelectFrameworkRegistry = typeof frameworkRegistry.$inferSelect;

// Insert Schemas for Background Jobs
export const insertBackgroundJobSchema = createInsertSchema(backgroundJobs).omit({ id: true, createdAt: true, updatedAt: true, startedAt: true, completedAt: true, failedAt: true });
export type InsertBackgroundJob = z.infer<typeof insertBackgroundJobSchema>;
export type SelectBackgroundJob = typeof backgroundJobs.$inferSelect;
