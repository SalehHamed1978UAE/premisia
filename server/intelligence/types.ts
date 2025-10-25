/**
 * Strategy Intelligence Layer Types
 * 
 * Defines the architecture for converting framework results (BMC, Porter's, PESTLE)
 * into complete, executable EPM programs with all 14 required components.
 */

// ============================================================================
// EPM Program Components (The 14 Required Components)
// ============================================================================

export interface StrategicImperative {
  action: string;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface ExecutiveSummary {
  title?: string; // Intelligent program name
  marketOpportunity: string;
  strategicImperatives: (string | StrategicImperative)[];
  keySuccessFactors: string[];
  riskSummary: string;
  investmentRequired: string;
  expectedOutcomes: string;
  confidence: number;
}

export interface Workstream {
  id: string;
  name: string;
  description: string;
  deliverables: Deliverable[];
  owner?: string;
  startMonth: number;
  endMonth: number;
  dependencies: string[]; // IDs of other workstreams
  confidence: number;
}

export interface Deliverable {
  id: string;
  name: string;
  description: string;
  dueMonth: number;
  effort: string; // e.g., "10 person-days"
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
  allocation: number; // Percentage (0-100)
  months: number;
  skills: string[];
  justification: string;
}

export interface ExternalResource {
  type: string; // "Consultant", "Software", "Service"
  description: string;
  estimatedCost: number;
  timing: string; // e.g., "Months 1-3"
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
  amount: number; // Negative = expenditure, Positive = benefit
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
  estimatedValue?: number; // For financial benefits
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
  probability: number; // 0-100
  impact: 'Low' | 'Medium' | 'High' | 'Critical';
  severity: number; // probability * impact
  mitigation: string;
  contingency: string;
  owner?: string;
  confidence: number;
}

export interface RiskRegister {
  risks: Risk[];
  topRisks: Risk[]; // Top 5 by severity
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

// ============================================================================
// Complete EPM Program (All 14 Components)
// ============================================================================

export interface EPMProgram {
  // Metadata
  frameworkType: 'bmc' | 'porters' | 'pestle';
  frameworkRunId: string;
  generatedAt: Date;
  overallConfidence: number;
  extractionRationale: string;

  // The 14 Required Components
  executiveSummary: ExecutiveSummary;
  workstreams: Workstream[];
  timeline: Timeline;
  resourcePlan: ResourcePlan;
  financialPlan: FinancialPlan;
  benefitsRealization: BenefitsRealization;
  riskRegister: RiskRegister;
  stageGates: StageGates;
  kpis: KPIs;
  stakeholderMap: StakeholderMap;
  governance: Governance;
  qaPlan: QAPlan;
  procurement: Procurement;
  exitStrategy: ExitStrategy;
}

// ============================================================================
// Strategic Insights (Normalized Framework Output)
// ============================================================================

export interface StrategyInsight {
  type: 'workstream' | 'resource' | 'risk' | 'stakeholder' | 'benefit' | 'cost' | 'timeline' | 'other';
  source: string; // e.g., "BMC.keyActivities", "Porters.competitiveRivalry"
  content: string;
  confidence: number;
  reasoning: string;
  metadata?: Record<string, any>;
}

export interface StrategyInsights {
  frameworkType: 'bmc' | 'porters' | 'pestle';
  frameworkRunId: string;
  insights: StrategyInsight[];
  marketContext: {
    industry?: string;
    urgency: 'ASAP' | 'Strategic' | 'Exploratory';
    budgetRange?: string;
    riskTolerance?: 'Conservative' | 'Moderate' | 'Aggressive';
  };
  overallConfidence: number;
  initiativeType?: string;  // Added for initiative-aware resource generation
}

// ============================================================================
// Framework Analyzer Interface
// ============================================================================

export interface FrameworkAnalyzer<T> {
  /**
   * Analyze framework results and extract strategic insights
   */
  analyze(frameworkResults: T): Promise<StrategyInsights>;

  /**
   * Extract workstreams from framework
   */
  extractWorkstreams(frameworkResults: T): Promise<StrategyInsight[]>;

  /**
   * Extract resource requirements
   */
  extractResources(frameworkResults: T): Promise<StrategyInsight[]>;

  /**
   * Extract risks
   */
  extractRisks(frameworkResults: T): Promise<StrategyInsight[]>;

  /**
   * Extract stakeholders
   */
  extractStakeholders(frameworkResults: T): Promise<StrategyInsight[]>;

  /**
   * Extract benefits
   */
  extractBenefits(frameworkResults: T): Promise<StrategyInsight[]>;

  /**
   * Extract costs
   */
  extractCosts(frameworkResults: T): Promise<StrategyInsight[]>;

  /**
   * Infer timeline
   */
  inferTimeline(frameworkResults: T): Promise<StrategyInsight>;

  /**
   * Calculate overall confidence
   */
  calculateConfidence(insights: StrategyInsight[]): number;
}

// ============================================================================
// BMC-Specific Types
// ============================================================================

export interface BMCResults {
  customerSegments: string;
  valuePropositions: string;
  channels: string;
  customerRelationships: string;
  revenueStreams: string;
  keyActivities: string;
  keyResources: string;
  keyPartnerships: string;
  costStructure: string;
  contradictions: string[];
  recommendations: string[];
  executiveSummary: string;
}

// ============================================================================
// Porter's-Specific Types
// ============================================================================

export interface PortersForce {
  score: number; // 0-10
  analysis: string;
  risks?: string[];
  mitigations?: string[];
  barriers?: string[];
  opportunities?: string[];
  competitors?: string[];
  strategies?: string[];
  substitutes?: string[];
  defensibility?: string;
}

export interface PortersResults {
  threatOfNewEntrants: PortersForce;
  bargainingPowerOfSuppliers: PortersForce;
  bargainingPowerOfBuyers: PortersForce;
  threatOfSubstitutes: PortersForce;
  competitiveRivalry: PortersForce;
  overallAttractiveness: {
    score: number;
    summary: string;
    recommendations: string[];
  };
  strategicImplications: string[];
}

// ============================================================================
// PESTLE-Specific Types
// ============================================================================

export interface PESTLETrend {
  description: string;
  strength: number; // 0-10
  timeframe: string;
  source: string;
}

export interface PESTLERisk {
  description: string;
  probability: number;
  impact: string;
}

export interface PESTLEOpportunity {
  description: string;
  potential: string;
  requirements: string[];
}

export interface PESTLEFactor {
  trends: PESTLETrend[];
  risks: PESTLERisk[];
  opportunities: PESTLEOpportunity[];
}

export interface PESTLEResults {
  political: PESTLEFactor;
  economic: PESTLEFactor;
  social: PESTLEFactor;
  technological: PESTLEFactor;
  legal: PESTLEFactor;
  environmental: PESTLEFactor;
  crossFactorInsights: {
    synergies: string[];
    conflicts: string[];
  };
  strategicRecommendations: string[];
}

// ============================================================================
// Validation Types
// ============================================================================

export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface ValidationIssue {
  severity: ValidationSeverity;
  component: string;
  message: string;
  recommendation: string;
}

export interface ValidationReport {
  valid: boolean;
  canProceed: boolean;
  confidence: number;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

// ============================================================================
// User Input Types
// ============================================================================

export interface UserContext {
  timelineUrgency: 'ASAP' | 'Strategic' | 'Exploratory';
  budgetRange?: {
    min: number;
    max: number;
  };
  budgetFlexibility?: 'Fixed' | 'Flexible' | 'Very Flexible';
  riskTolerance?: 'Conservative' | 'Moderate' | 'Aggressive';
  teamAvailability?: {
    currentTeamSize?: number;
    constraints?: string;
  };
  strategicPriorities?: Array<'Growth' | 'Profitability' | 'Innovation' | 'Efficiency'>;
  hardDeadlines?: Array<{
    description: string;
    date: Date;
  }>;
  organizationalContext?: string;
  sessionId?: string;  // Added for initiative type lookup
}
