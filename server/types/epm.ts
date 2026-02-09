export interface EPMProgram {
  id: string;
  strategyVersionId: string;
  userId: string;
  frameworkType: FrameworkType;
  executiveSummary: ExecutiveSummary;
  workstreams: Workstream[];
  timeline: Timeline;
  resourcePlan: ResourcePlan;
  financialPlan: FinancialPlan;
  riskRegister: RiskRegister;
  kpis: KPISet;
  stakeholderMap: StakeholderMap;
  governance: GovernanceStructure;
  status: ProgramStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutiveSummary {
  programName: string;
  vision: string;
  objectives: string[];
  scope: string;
  keyStakeholders: string[];
  confidence: number;
}

export interface Workstream {
  id: string;
  name: string;
  description: string;
  owner: string;
  startMonth: number;
  endMonth: number;
  confidence: number;
  deliverables: Deliverable[];
  dependencies: string[];
  resourceRequirements: ResourceRequirement[];
  earlyStart?: number;
  earlyFinish?: number;
  lateStart?: number;
  lateFinish?: number;
  slack?: number;
  isCritical?: boolean;
}

export interface Deliverable {
  id: string;
  name: string;
  description: string;
  dueMonth: number;
  workstreamId: string;
  status?: DeliverableStatus;
}

export interface ResourceRequirement {
  role: string;
  count: number;
  allocation: number;
}

export interface Timeline {
  startDate: string;
  endDate: string;
  durationMonths: number;
  phases: Phase[];
  criticalPath?: string[];
  confidence: number;
}

export interface Phase {
  name: string;
  startMonth: number;
  endMonth: number;
  milestones: Milestone[];
}

export interface Milestone {
  name: string;
  month: number;
  description: string;
}

export interface ResourcePlan {
  totalHeadcount: number;
  roles: RoleAllocation[];
  skillRequirements: string[];
  confidence: number;
}

export interface RoleAllocation {
  role: string;
  count: number;
  allocation: number;
  monthlyDistribution?: number[];
}

export interface FinancialPlan {
  totalBudget: number;
  capitalExpenses: number;
  operationalExpenses: number;
  monthlyBurnRate: number;
  contingency: number;
  categories: BudgetCategory[];
  confidence: number;
}

export interface BudgetCategory {
  name: string;
  amount: number;
  percentage: number;
}

export interface RiskRegister {
  risks: Risk[];
  overallRiskLevel: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface Risk {
  id: string;
  name: string;
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
  owner: string;
  status: 'open' | 'mitigating' | 'closed';
}

export interface KPISet {
  kpis: KPI[];
  confidence: number;
}

export interface KPI {
  name: string;
  description: string;
  target: string;
  baseline: string;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  owner: string;
}

export interface StakeholderMap {
  stakeholders: Stakeholder[];
  confidence: number;
}

export interface Stakeholder {
  name: string;
  role: string;
  influence: 'high' | 'medium' | 'low';
  interest: 'high' | 'medium' | 'low';
  engagementStrategy: string;
}

export interface GovernanceStructure {
  steeringCommittee: string[];
  decisionRights: DecisionRight[];
  meetingCadence: string;
  escalationPath: string[];
  confidence: number;
}

export interface DecisionRight {
  decision: string;
  owner: string;
  consulted: string[];
}

export type FrameworkType = 'bmc' | 'porters' | 'pestle' | 'five_whys' | 'digital_transformation';
export type ProgramStatus = 'draft' | 'in_progress' | 'finalized' | 'archived';
export type DeliverableStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
