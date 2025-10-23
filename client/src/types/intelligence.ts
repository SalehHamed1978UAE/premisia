/**
 * Strategy Intelligence Layer Types (Client-Side)
 * 
 * Type definitions for EPM program components used by formatters
 */

// ============================================================================
// EPM Program Components (The 14 Required Components)
// ============================================================================

export interface ExecutiveSummary {
  title?: string;
  marketOpportunity: string;
  strategicImperatives: string[];
  keySuccessFactors: string[];
  riskSummary: string;
  investmentRequired: string;
  expectedOutcomes: string;
  confidence: number;
}

export interface Deliverable {
  id: string;
  name: string;
  description: string;
  dueMonth: number;
  effort: string;
}

export interface Workstream {
  id: string;
  name: string;
  description: string;
  deliverables: Deliverable[];
  owner?: string;
  startMonth: number;
  endMonth: number;
  dependencies: string[];
  confidence: number;
}

export interface TimelinePhase {
  phase: number;
  name: string;
  startMonth: number;
  endMonth: number;
  description: string;
  keyMilestones: string[];
  workstreamIds: string[];
}

export interface Timeline {
  totalMonths: number;
  phases: TimelinePhase[];
  criticalPath: string[];
  confidence: number;
}

export interface ResourceAllocation {
  role: string;
  allocation: number;
  months: number;
  skills: string[];
  justification: string;
}

export interface ExternalResource {
  type: string;
  description: string;
  estimatedCost: number;
  timing: string;
  justification: string;
}

export interface ResourcePlan {
  internalTeam: ResourceAllocation[];
  externalResources: ExternalResource[];
  criticalSkills: string[];
  totalFTEs: number;
  confidence: number;
}

export interface CostBreakdown {
  category: string;
  amount: number;
  percentage: number;
  description: string;
}

export interface CashFlow {
  quarter: number;
  amount: number;
  cumulative: number;
}

export interface FinancialPlan {
  totalBudget: number;
  costBreakdown: CostBreakdown[];
  cashFlow: CashFlow[];
  contingency: number;
  contingencyPercentage: number;
  assumptions: string[];
  confidence: number;
}

export interface Benefit {
  id: string;
  category: 'Financial' | 'Strategic' | 'Operational' | 'Risk Mitigation';
  description: string;
  realizationMonth: number;
  estimatedValue?: number;
  measurement: string;
  confidence: number;
}

export interface BenefitsRealization {
  benefits: Benefit[];
  totalFinancialValue?: number;
  roi?: number;
  npv?: number;
  paybackPeriod?: number;
  confidence: number;
}

export interface Risk {
  id: string;
  description: string;
  category: string;
  probability: number;
  impact: 'Low' | 'Medium' | 'High' | 'Critical';
  severity: number;
  mitigation: string;
  contingency: string;
  owner?: string;
  confidence: number;
}

export interface RiskRegister {
  risks: Risk[];
  topRisks: Risk[];
  mitigationBudget?: number;
  confidence: number;
}

export interface StageGate {
  gate: number;
  name: string;
  month: number;
  goCriteria: string[];
  noGoTriggers: string[];
  deliverables: string[];
  confidence: number;
}

export interface StageGates {
  gates: StageGate[];
  confidence: number;
}

export interface KPI {
  id: string;
  name: string;
  category: 'Financial' | 'Operational' | 'Strategic' | 'Customer';
  baseline: string;
  target: string;
  measurement: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annual';
  owner?: string;
  linkedBenefitIds: string[];
  confidence: number;
}

export interface KPIs {
  kpis: KPI[];
  confidence: number;
}

export interface Stakeholder {
  name: string;
  group: string;
  power: 'Low' | 'Medium' | 'High';
  interest: 'Low' | 'Medium' | 'High';
  engagement: string;
  communicationPlan: string;
}

export interface ChangeManagementPhase {
  phase: string;
  months: string;
  activities: string[];
}

export interface StakeholderMap {
  stakeholders: Stakeholder[];
  changeManagement: ChangeManagementPhase[];
  impactedGroups: number;
  confidence: number;
}

export interface GovernanceBody {
  name: string;
  level: 'Strategic' | 'Tactical' | 'Execution';
  members: string[];
  cadence: string;
  responsibilities: string[];
  escalationPath: string;
}

export interface DecisionRight {
  decision: string;
  responsible: string;
  accountable: string;
  consulted: string;
  informed: string;
}

export interface Governance {
  bodies: GovernanceBody[];
  decisionRights: DecisionRight[];
  meetingCadence: Record<string, string>;
  confidence: number;
}

export interface QualityStandard {
  area: string;
  standard: string;
  acceptanceCriteria: string[];
}

export interface QualityProcess {
  phase: string;
  activities: string[];
}

export interface QAPlan {
  standards: QualityStandard[];
  processes: QualityProcess[];
  acceptanceCriteria: string[];
  confidence: number;
}

export interface ProcurementItem {
  id: string;
  name: string;
  type: 'Software' | 'Services' | 'Hardware' | 'Other';
  estimatedValue: number;
  timing: string;
  purpose: string;
  approvalRequired: string;
}

export interface Procurement {
  items: ProcurementItem[];
  vendorManagement: string[];
  policies: string[];
  totalProcurementValue: number;
  confidence: number;
}

export interface FailureCondition {
  trigger: string;
  severity: 'Critical' | 'High' | 'Medium';
  responseTime: string;
}

export interface RollbackProcedure {
  name: string;
  trigger: string;
  actions: string[];
  estimatedCost: number;
  timeline: string;
}

export interface PivotOption {
  name: string;
  description: string;
  conditions: string[];
}

export interface ExitStrategy {
  failureConditions: FailureCondition[];
  rollbackProcedures: RollbackProcedure[];
  pivotOptions: PivotOption[];
  lessonsLearned: string[];
  confidence: number;
}
