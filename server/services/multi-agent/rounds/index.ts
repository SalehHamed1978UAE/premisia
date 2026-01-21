import { z } from 'zod';
import { agentIds } from '../agents';

export interface RoundDefinition {
  round: number;
  name: string;
  objective: string;
  participatingAgents: string[];
  parallel: boolean;
  requiresSynthesis: boolean;
  conflictResolution: boolean;
  inputFromPreviousRounds: number[];
  expectedOutputs: string[];
}

export const synthesisOutputSchema = z.object({
  consensusPoints: z.array(z.object({
    topic: z.string(),
    agreement: z.string(),
    supportingAgents: z.array(z.string()),
  })).describe('What all agents agree on'),
  conflicts: z.array(z.object({
    topic: z.string(),
    agentA: z.string(),
    positionA: z.string(),
    agentB: z.string(),
    positionB: z.string(),
    impact: z.string(),
  })).describe('Disagreements to be resolved'),
  consolidatedOutputs: z.object({
    workstreams: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      owner: z.string().optional(),
      deliverables: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        dueMonth: z.number().optional(),
      })),
      dependencies: z.array(z.string()).optional(),
      estimatedDurationMonths: z.number().optional(),
    })).optional(),
    risks: z.array(z.object({
      id: z.string(),
      description: z.string(),
      probability: z.string(),
      impact: z.string(),
      mitigation: z.string(),
      owner: z.string().optional(),
    })).optional(),
    resources: z.array(z.object({
      role: z.string(),
      skills: z.array(z.string()),
      count: z.number(),
      allocation: z.string(),
    })).optional(),
    timeline: z.object({
      totalMonths: z.number(),
      phases: z.array(z.object({
        name: z.string(),
        startMonth: z.number(),
        endMonth: z.number(),
      })),
    }).optional(),
  }).describe('Merged recommendations'),
  openItems: z.array(z.object({
    question: z.string(),
    context: z.string(),
    forRound: z.number().optional(),
  })).describe('Questions or decisions for later rounds'),
  roundSummary: z.string().describe('Brief summary of this round'),
});

export const conflictResolutionSchema = z.object({
  resolutions: z.array(z.object({
    conflictTopic: z.string(),
    resolution: z.string(),
    rationale: z.string(),
    compromises: z.array(z.string()).optional(),
    impactOnTimeline: z.string().optional(),
    impactOnBudget: z.string().optional(),
    impactOnScope: z.string().optional(),
  })),
  summary: z.string(),
});

export const rounds: RoundDefinition[] = [
  {
    round: 1,
    name: 'Framing',
    objective: 'Understand scope, objectives, constraints, and success criteria',
    participatingAgents: agentIds,
    parallel: true,
    requiresSynthesis: true,
    conflictResolution: false,
    inputFromPreviousRounds: [],
    expectedOutputs: [
      'program_vision',
      'scope_boundaries',
      'stakeholder_expectations',
      'success_criteria',
      'initial_constraints',
    ],
  },
  {
    round: 2,
    name: 'Dependency Discovery',
    objective: 'Map cross-workstream dependencies, integration points, critical path',
    participatingAgents: ['program_coordinator', 'tech_architect', 'platform_delivery', 'go_to_market', 'customer_success'],
    parallel: true,
    requiresSynthesis: true,
    conflictResolution: false,
    inputFromPreviousRounds: [1],
    expectedOutputs: [
      'dependency_matrix',
      'integration_points',
      'critical_path_elements',
      'shared_resources',
    ],
  },
  {
    round: 3,
    name: 'Negotiation',
    objective: 'Resolve conflicts, make trade-offs, reach consensus',
    participatingAgents: agentIds,
    parallel: false,
    requiresSynthesis: true,
    conflictResolution: true,
    inputFromPreviousRounds: [1, 2],
    expectedOutputs: [
      'resolved_conflicts',
      'trade_off_decisions',
      'priority_rankings',
      'scope_adjustments',
    ],
  },
  {
    round: 4,
    name: 'Resource & Timeline',
    objective: 'Allocate resources, build schedule, establish milestones',
    participatingAgents: ['program_coordinator', 'platform_delivery', 'finance_resources', 'tech_architect'],
    parallel: true,
    requiresSynthesis: true,
    conflictResolution: false,
    inputFromPreviousRounds: [1, 2, 3],
    expectedOutputs: [
      'resource_allocation',
      'project_schedule',
      'milestone_roadmap',
      'capacity_analysis',
    ],
  },
  {
    round: 5,
    name: 'Risk Assessment',
    objective: 'Identify risks, assess impact, define mitigation strategies',
    participatingAgents: ['program_coordinator', 'risk_compliance', 'tech_architect', 'finance_resources', 'platform_delivery'],
    parallel: true,
    requiresSynthesis: true,
    conflictResolution: false,
    inputFromPreviousRounds: [1, 2, 3, 4],
    expectedOutputs: [
      'risk_register',
      'mitigation_plans',
      'contingency_reserves',
      'risk_monitoring_plan',
    ],
  },
  {
    round: 6,
    name: 'Reconciliation',
    objective: 'Verify alignment, reconcile budget, ensure consistency',
    participatingAgents: ['program_coordinator', 'finance_resources', 'platform_delivery'],
    parallel: false,
    requiresSynthesis: true,
    conflictResolution: true,
    inputFromPreviousRounds: [1, 2, 3, 4, 5],
    expectedOutputs: [
      'consolidated_plan',
      'budget_reconciliation',
      'timeline_validation',
      'consistency_report',
    ],
  },
  {
    round: 7,
    name: 'Sign-off',
    objective: 'Final review, confidence scoring, formal approval',
    participatingAgents: agentIds,
    parallel: true,
    requiresSynthesis: true,
    conflictResolution: false,
    inputFromPreviousRounds: [1, 2, 3, 4, 5, 6],
    expectedOutputs: [
      'final_program_plan',
      'confidence_scores',
      'outstanding_items',
      'sign_off_record',
    ],
  },
];

export const getRound = (roundNumber: number) => rounds.find(r => r.round === roundNumber);
export const getTotalRounds = () => rounds.length;
