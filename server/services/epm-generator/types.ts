/**
 * Multi-Agent EPM Generator Types
 * 
 * Shared interfaces for both legacy and multi-agent EPM generators.
 * Ensures consistent input/output contracts regardless of implementation.
 */

export interface BusinessContext {
  name: string;
  type: string;
  scale: 'smb' | 'mid_market' | 'enterprise';
  description: string;
  industry?: string;
  keywords?: string[];
}

export interface Constraints {
  budget?: number;
  deadline?: Date;
  regulations?: string[];
  resourceLimits?: {
    maxHeadcount?: number;
    maxContractors?: number;
  };
}

export interface EPMGeneratorInput {
  businessContext: BusinessContext;
  bmcInsights: any;
  strategyInsights?: any;
  constraints?: Constraints;
  userId: string;
  sessionId: string;
  journeyType?: string;
}

export interface Deliverable {
  id: string;
  name: string;
  description: string;
  workstreamId: string;
  dueMonth?: number;
  status?: 'not_started' | 'in_progress' | 'completed';
}

export interface Workstream {
  id: string;
  name: string;
  description: string;
  owner: string;
  deliverables: Deliverable[];
  dependencies: string[];
  resourceRequirements: ResourceRequirement[];
  startMonth: number;
  endMonth: number;
  confidence: number;
  // CPM-calculated fields (added by post-processing)
  startDate?: Date;
  endDate?: Date;
  earlyStart?: number;
  lateStart?: number;
  earlyFinish?: number;
  lateFinish?: number;
  slack?: number;
  isCritical?: boolean;
}

export interface ResourceRequirement {
  role: string;
  skills: string[];
  allocation: number;
  costPerMonth?: number;
}

export interface TimelinePhase {
  id: string;
  name: string;
  startMonth: number;
  endMonth: number;
  workstreamIds: string[];
  milestones: Milestone[];
}

export interface Milestone {
  id: string;
  name: string;
  dueMonth: number;
  deliverableIds: string[];
}

export interface Risk {
  id: string;
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
  owner?: string;
  category?: string;
}

export interface FinancialItem {
  category: string;
  description: string;
  amount: number;
  frequency: 'one_time' | 'monthly' | 'quarterly' | 'annual';
}

export interface SupportingEvidence {
  agentId: string;
  agentName: string;
  round: number;
  statement: string;
}

export interface KnowledgeEmission {
  id: string;
  content: string;
  summary: string;
  type: 'fact' | 'estimate' | 'constraint' | 'lesson_learned' | 'decision_rationale' | 'pattern';
  scope: 'organization' | 'industry' | 'program_specific';
  suggestedMemoryLayer: 'semantic' | 'episodic' | 'symbolic';
  tags: string[];
  confidence: number;
  verificationStatus: 'verified' | 'contested' | 'hypothesis';
  supportingEvidence: SupportingEvidence[];
  contradictions?: SupportingEvidence[];
  source: {
    programId: string;
    programName: string;
    generatedAt: string;
    curatorVersion: string;
  };
}

export interface KnowledgeStats {
  totalCandidates: number;
  verified: number;
  deduplicated: number;
  emitted: number;
  contested: number;
  rejected: number;
  flaggedForReview: number;
}

export interface KnowledgeLedger {
  emissions: KnowledgeEmission[];
  contested: any[];
  rejected: any[];
  stats: KnowledgeStats;
}

export interface ConversationEntry {
  round: number;
  agentId: string;
  agentName: string;
  message: string;
  timestamp: string;
}

export interface Decision {
  id: string;
  round: number;
  topic: string;
  decision: string;
  rationale: string;
  madeBy: string;
  endorsedBy: string[];
}

export interface EPMProgram {
  id: string;
  title: string;
  description: string;
  workstreams: Workstream[];
  timeline: {
    phases: TimelinePhase[];
    totalMonths: number;
    criticalPath: string[];
    startDate?: Date;
    endDate?: Date;
    confidence?: number;
  };
  resourcePlan: {
    roles: ResourceRequirement[];
    totalHeadcount: number;
    totalCost: number;
  };
  riskRegister: {
    risks: Risk[];
    overallRiskLevel: 'low' | 'medium' | 'high';
  };
  financialPlan: {
    capex: FinancialItem[];
    opex: FinancialItem[];
    totalBudget: number;
    contingency: number;
  };
  overallConfidence: number;
}

export interface EPMGeneratorOutput {
  program: EPMProgram;
  metadata: {
    generator: 'legacy' | 'multi-agent';
    generatedAt: string;
    confidence: number;
    roundsCompleted?: number;
    agentsParticipated?: number;
    knowledgeEmissions?: number;
    generationTimeMs?: number;
  };
  conversationLog?: ConversationEntry[];
  decisions?: Decision[];
  knowledgeLedger?: KnowledgeLedger;
}

export interface IEPMGenerator {
  generate(input: EPMGeneratorInput): Promise<EPMGeneratorOutput>;
}

export interface GenerationProgress {
  round: number;
  totalRounds: number;
  currentAgent: string;
  message: string;
  percentComplete: number;
}

export interface EPMRouterOptions {
  forceMultiAgent?: boolean;
  forceLegacy?: boolean;
  fallbackOnError?: boolean;
}
