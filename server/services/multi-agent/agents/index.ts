import { z } from 'zod';

export interface AgentDefinition {
  id: string;
  role: string;
  goal: string;
  expertise: string[];
  perspective: string;
  outputSchema: z.ZodSchema;
}

const baseAgentOutputSchema = z.object({
  observations: z.array(z.string()).describe('Key observations from your analysis'),
  recommendations: z.array(z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    rationale: z.string(),
  })).describe('Specific recommendations'),
  workItems: z.array(z.object({
    name: z.string(),
    description: z.string(),
    estimatedDurationMonths: z.number(),
    deliverables: z.array(z.string()),
  })).optional().describe('Proposed work items'),
  dependencies: z.array(z.string()).optional().describe('Dependencies on other workstreams'),
  risks: z.array(z.object({
    description: z.string(),
    likelihood: z.enum(['low', 'medium', 'high']),
    impact: z.enum(['low', 'medium', 'high']),
    mitigation: z.string(),
  })).optional().describe('Identified risks'),
  resourceRequirements: z.array(z.object({
    role: z.string(),
    skills: z.array(z.string()),
    allocation: z.string(),
  })).optional().describe('Resource needs'),
  timeline: z.object({
    startMonth: z.number().optional(),
    endMonth: z.number().optional(),
    milestones: z.array(z.object({
      name: z.string(),
      month: z.number(),
    })).optional(),
  }).optional().describe('Timeline considerations'),
  confidence: z.number().min(0).max(1).describe('Confidence score for this analysis'),
});

export const agents: Record<string, AgentDefinition> = {
  program_coordinator: {
    id: 'program_coordinator',
    role: 'Program Coordinator',
    goal: 'Synthesize inputs, track decisions, resolve conflicts, ensure program coherence',
    expertise: ['program management', 'cross-functional coordination', 'decision facilitation', 'stakeholder alignment'],
    perspective: 'Holistic view - ensures all pieces fit together and conflicts are resolved',
    outputSchema: baseAgentOutputSchema.extend({
      programVision: z.string().optional(),
      scopeBoundaries: z.array(z.string()).optional(),
      stakeholders: z.array(z.object({
        name: z.string(),
        role: z.string(),
        expectations: z.array(z.string()),
      })).optional(),
      successCriteria: z.array(z.string()).optional(),
    }),
  },

  tech_architect: {
    id: 'tech_architect',
    role: 'Technical Architecture Lead',
    goal: 'Define technology requirements, assess feasibility, identify technical risks',
    expertise: ['systems architecture', 'technology selection', 'technical feasibility', 'integration patterns'],
    perspective: 'Technical feasibility and scalability - what can actually be built',
    outputSchema: baseAgentOutputSchema.extend({
      technologyStack: z.array(z.object({
        category: z.string(),
        technology: z.string(),
        rationale: z.string(),
      })).optional(),
      integrationPoints: z.array(z.object({
        system: z.string(),
        type: z.string(),
        complexity: z.enum(['low', 'medium', 'high']),
      })).optional(),
      technicalConstraints: z.array(z.string()).optional(),
      scalabilityConsiderations: z.array(z.string()).optional(),
    }),
  },

  platform_delivery: {
    id: 'platform_delivery',
    role: 'Platform Delivery Manager',
    goal: 'Define delivery approach, quality gates, and operational readiness',
    expertise: ['delivery management', 'quality assurance', 'operational excellence', 'release management'],
    perspective: 'Execution reality - how things actually get delivered',
    outputSchema: baseAgentOutputSchema.extend({
      deliveryApproach: z.string().optional(),
      qualityGates: z.array(z.object({
        name: z.string(),
        criteria: z.array(z.string()),
        phase: z.number(),
      })).optional(),
      operationalReadiness: z.array(z.object({
        area: z.string(),
        requirements: z.array(z.string()),
        status: z.enum(['not_started', 'in_progress', 'ready']),
      })).optional(),
      releaseStrategy: z.string().optional(),
    }),
  },

  go_to_market: {
    id: 'go_to_market',
    role: 'Go-to-Market Strategist',
    goal: 'Define market entry, positioning, channels, and launch strategy',
    expertise: ['market strategy', 'positioning', 'channel development', 'launch planning', 'competitive analysis'],
    perspective: 'Market reality - what customers want and how to reach them',
    outputSchema: baseAgentOutputSchema.extend({
      targetMarket: z.object({
        segments: z.array(z.string()),
        primarySegment: z.string(),
        marketSize: z.string().optional(),
      }).optional(),
      positioning: z.object({
        valueProposition: z.string(),
        differentiators: z.array(z.string()),
        competitiveAdvantage: z.string(),
      }).optional(),
      channels: z.array(z.object({
        name: z.string(),
        type: z.string(),
        priority: z.enum(['primary', 'secondary']),
      })).optional(),
      launchStrategy: z.object({
        phases: z.array(z.object({
          name: z.string(),
          activities: z.array(z.string()),
          duration: z.string(),
        })),
      }).optional(),
    }),
  },

  customer_success: {
    id: 'customer_success',
    role: 'Customer Success Lead',
    goal: 'Define onboarding, retention, and customer experience strategies',
    expertise: ['customer onboarding', 'retention', 'customer experience', 'feedback loops', 'support operations'],
    perspective: 'Customer lifetime value - keeping customers happy long-term',
    outputSchema: baseAgentOutputSchema.extend({
      onboardingPlan: z.object({
        phases: z.array(z.object({
          name: z.string(),
          duration: z.string(),
          activities: z.array(z.string()),
        })),
        successMetrics: z.array(z.string()),
      }).optional(),
      retentionStrategy: z.object({
        tactics: z.array(z.string()),
        metrics: z.array(z.string()),
      }).optional(),
      supportModel: z.object({
        channels: z.array(z.string()),
        sla: z.string().optional(),
        escalation: z.string().optional(),
      }).optional(),
      feedbackMechanisms: z.array(z.string()).optional(),
    }),
  },

  risk_compliance: {
    id: 'risk_compliance',
    role: 'Risk & Compliance Officer',
    goal: 'Identify risks, regulatory requirements, and mitigation strategies',
    expertise: ['risk assessment', 'regulatory compliance', 'mitigation planning', 'audit preparation'],
    perspective: 'What can go wrong and how to prevent it',
    outputSchema: baseAgentOutputSchema.extend({
      riskRegister: z.array(z.object({
        category: z.string(),
        description: z.string(),
        probability: z.enum(['rare', 'unlikely', 'possible', 'likely', 'certain']),
        impact: z.enum(['negligible', 'minor', 'moderate', 'major', 'catastrophic']),
        mitigationStrategy: z.string(),
        owner: z.string().optional(),
        status: z.enum(['identified', 'mitigating', 'mitigated', 'accepted']),
      })).optional(),
      complianceRequirements: z.array(z.object({
        regulation: z.string(),
        requirements: z.array(z.string()),
        deadline: z.string().optional(),
      })).optional(),
      contingencyPlans: z.array(z.object({
        trigger: z.string(),
        response: z.string(),
      })).optional(),
    }),
  },

  finance_resources: {
    id: 'finance_resources',
    role: 'Finance & Resource Manager',
    goal: 'Define budget, resource allocation, and financial projections',
    expertise: ['financial planning', 'resource allocation', 'cost optimization', 'ROI analysis'],
    perspective: 'Financial viability - can we afford this and is it worth it',
    outputSchema: baseAgentOutputSchema.extend({
      budgetBreakdown: z.object({
        categories: z.array(z.object({
          name: z.string(),
          amount: z.number(),
          description: z.string(),
        })),
        total: z.number(),
        contingency: z.number().optional(),
      }).optional(),
      resourceAllocation: z.array(z.object({
        role: z.string(),
        count: z.number(),
        costPerMonth: z.number().optional(),
        duration: z.string(),
      })).optional(),
      financialProjections: z.object({
        year1Revenue: z.number().optional(),
        year1Costs: z.number().optional(),
        breakEvenMonth: z.number().optional(),
        roi: z.number().optional(),
      }).optional(),
      fundingRequirements: z.object({
        totalNeeded: z.number(),
        phases: z.array(z.object({
          phase: z.string(),
          amount: z.number(),
          timing: z.string(),
        })),
      }).optional(),
    }),
  },
};

export const agentIds = Object.keys(agents);
export const getAllAgentIds = () => agentIds;
export const getAgent = (id: string) => agents[id];
