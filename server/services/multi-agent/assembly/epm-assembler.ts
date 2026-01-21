import { randomUUID as uuid } from 'crypto';
import { ConversationLog, BusinessContext } from '../persistence/conversation-log';
import { cpmScheduler, WorkstreamScheduleInput } from '../scheduling/cpm-scheduler';

export interface EPMWorkstream {
  id: string;
  name: string;
  description: string;
  owner?: string;
  deliverables: {
    id: string;
    name: string;
    description: string;
    dueMonth?: number;
    effort?: string;
  }[];
  dependencies: string[];
  startMonth: number;
  endMonth: number;
  confidence: number;
}

export interface EPMRisk {
  id: string;
  category: string;
  description: string;
  probability: string;
  impact: string;
  mitigation: string;
  owner?: string;
  status: string;
}

export interface EPMResource {
  role: string;
  skills: string[];
  count: number;
  allocation: string;
  costPerMonth?: number;
}

export interface EPMProgram {
  id: string;
  executiveSummary: string;
  workstreams: EPMWorkstream[];
  timeline: {
    totalMonths: number;
    phases: { name: string; startMonth: number; endMonth: number }[];
    criticalPath: string[];
  };
  resourcePlan: EPMResource[];
  financialPlan: {
    totalBudget: number;
    breakdown: { category: string; amount: number }[];
    contingency: number;
  };
  riskRegister: EPMRisk[];
  benefitsRealization: {
    benefits: { name: string; description: string; timeline: string }[];
    kpis: { name: string; target: string; measure: string }[];
  };
  stageGates: {
    name: string;
    criteria: string[];
    phase: number;
  }[];
  stakeholderMap: {
    name: string;
    role: string;
    expectations: string[];
  }[];
  governance: {
    decisionMakers: string[];
    meetingCadence: string;
    escalationPath: string;
  };
  componentConfidence: Record<string, number>;
  overallConfidence: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class EPMAssembler {
  assemble(conversationLog: ConversationLog, businessContext: BusinessContext): EPMProgram {
    const roundOutputs = this.extractRoundOutputs(conversationLog);
    
    const workstreamInputs = this.extractWorkstreamInputs(roundOutputs, businessContext);
    const { scheduled, timeline } = cpmScheduler.schedule(workstreamInputs, new Date());

    const workstreams = this.buildWorkstreams(roundOutputs, scheduled, businessContext);
    const riskRegister = this.buildRiskRegister(roundOutputs);
    const resourcePlan = this.buildResourcePlan(roundOutputs);
    const financialPlan = this.buildFinancialPlan(roundOutputs);
    const stakeholderMap = this.buildStakeholderMap(roundOutputs);
    const stageGates = this.buildStageGates(roundOutputs);
    const benefitsRealization = this.buildBenefitsRealization(roundOutputs);
    const governance = this.buildGovernance(roundOutputs);
    const componentConfidence = this.extractComponentConfidence(roundOutputs);
    const overallConfidence = this.calculateOverallConfidence(roundOutputs);

    return {
      id: uuid(),
      executiveSummary: this.buildExecutiveSummary(roundOutputs, businessContext),
      workstreams,
      timeline: {
        totalMonths: timeline.totalMonths,
        phases: timeline.phases.map(p => ({
          name: p.name,
          startMonth: p.startMonth,
          endMonth: p.endMonth,
        })),
        criticalPath: timeline.criticalPath,
      },
      resourcePlan,
      financialPlan,
      riskRegister,
      benefitsRealization,
      stageGates,
      stakeholderMap,
      governance,
      componentConfidence,
      overallConfidence,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private extractRoundOutputs(conversationLog: ConversationLog): Record<number, any> {
    const outputs: Record<number, any> = {};
    
    for (let round = 1; round <= 7; round++) {
      const synthesis = conversationLog.synthesisOutputsByRound[round];
      const agentOutputs = conversationLog.agentOutputsByRound[round] || {};
      
      outputs[round] = {
        synthesis: synthesis || {},
        agentOutputs,
      };
    }
    
    return outputs;
  }

  private extractWorkstreamInputs(
    roundOutputs: Record<number, any>,
    businessContext: BusinessContext
  ): WorkstreamScheduleInput[] {
    const round1 = roundOutputs[1]?.synthesis?.consolidatedOutputs?.workstreams || [];
    const round2 = roundOutputs[2]?.synthesis?.consolidatedOutputs || {};
    const round4 = roundOutputs[4]?.synthesis?.consolidatedOutputs || {};
    
    if (round1.length === 0) {
      return this.generateDefaultWorkstreams(businessContext);
    }
    
    return round1.map((ws: any, index: number) => ({
      id: ws.id || `WS${String(index + 1).padStart(3, '0')}`,
      name: ws.name || `Workstream ${index + 1}`,
      estimatedDurationMonths: ws.estimatedDurationMonths || 3,
      dependencies: ws.dependencies || [],
      deliverables: (ws.deliverables || []).map((d: any, dIndex: number) => ({
        id: d.id || `D${String(index + 1).padStart(3, '0')}.${dIndex + 1}`,
        name: d.name || `Deliverable ${dIndex + 1}`,
        relativeMonth: d.dueMonth || Math.floor((dIndex + 1) * 2 / (ws.deliverables?.length || 1)),
      })),
    }));
  }

  private generateDefaultWorkstreams(businessContext: BusinessContext): WorkstreamScheduleInput[] {
    const type = businessContext.type?.toLowerCase() || '';
    
    if (type.includes('software') || type.includes('digital')) {
      return [
        { id: 'WS001', name: 'Requirements & Architecture', estimatedDurationMonths: 2, dependencies: [], deliverables: [{ id: 'D001.1', name: 'Technical specification', relativeMonth: 1 }] },
        { id: 'WS002', name: 'Development', estimatedDurationMonths: 4, dependencies: ['WS001'], deliverables: [{ id: 'D002.1', name: 'MVP release', relativeMonth: 3 }] },
        { id: 'WS003', name: 'Testing & QA', estimatedDurationMonths: 2, dependencies: ['WS002'], deliverables: [{ id: 'D003.1', name: 'Test completion report', relativeMonth: 2 }] },
        { id: 'WS004', name: 'Launch & Marketing', estimatedDurationMonths: 2, dependencies: ['WS003'], deliverables: [{ id: 'D004.1', name: 'Public launch', relativeMonth: 2 }] },
      ];
    }
    
    return [
      { id: 'WS001', name: 'Planning & Setup', estimatedDurationMonths: 2, dependencies: [], deliverables: [{ id: 'D001.1', name: 'Project plan finalized', relativeMonth: 1 }] },
      { id: 'WS002', name: 'Location & Infrastructure', estimatedDurationMonths: 3, dependencies: ['WS001'], deliverables: [{ id: 'D002.1', name: 'Site ready', relativeMonth: 3 }] },
      { id: 'WS003', name: 'Staffing & Training', estimatedDurationMonths: 2, dependencies: ['WS001'], deliverables: [{ id: 'D003.1', name: 'Team trained', relativeMonth: 2 }] },
      { id: 'WS004', name: 'Launch & Operations', estimatedDurationMonths: 2, dependencies: ['WS002', 'WS003'], deliverables: [{ id: 'D004.1', name: 'Business opening', relativeMonth: 2 }] },
    ];
  }

  private buildWorkstreams(
    roundOutputs: Record<number, any>,
    scheduled: any[],
    businessContext: BusinessContext
  ): EPMWorkstream[] {
    const workstreamData = roundOutputs[1]?.synthesis?.consolidatedOutputs?.workstreams || [];
    const resourceAssignments = roundOutputs[4]?.synthesis?.consolidatedOutputs?.resources || [];
    
    return scheduled.map((sched, index) => {
      const wsData = workstreamData.find((w: any) => w.id === sched.id) || {};
      const owner = resourceAssignments.find((r: any) => r.workstreamId === sched.id)?.owner;
      
      return {
        id: sched.id,
        name: sched.name,
        description: wsData.description || `${sched.name} for ${businessContext.name}`,
        owner: owner || 'TBD',
        deliverables: sched.deliverables.map((d: any) => ({
          id: d.id,
          name: d.name,
          description: d.description || d.name,
          dueMonth: d.dueMonth,
          effort: d.effort,
        })),
        dependencies: sched.dependencies,
        startMonth: sched.startMonth,
        endMonth: sched.endMonth,
        confidence: wsData.confidence || 0.75,
      };
    });
  }

  private buildRiskRegister(roundOutputs: Record<number, any>): EPMRisk[] {
    const round5Risks = roundOutputs[5]?.synthesis?.consolidatedOutputs?.risks || [];
    const agentRisks = this.collectAgentRisks(roundOutputs);
    
    const allRisks = [...round5Risks, ...agentRisks];
    const uniqueRisks = this.deduplicateRisks(allRisks);
    
    return uniqueRisks.slice(0, 15).map((risk, index) => ({
      id: risk.id || `R${String(index + 1).padStart(3, '0')}`,
      category: risk.category || 'General',
      description: risk.description || 'Risk description',
      probability: risk.probability || 'medium',
      impact: risk.impact || 'medium',
      mitigation: risk.mitigation || risk.mitigationStrategy || 'Mitigation to be defined',
      owner: risk.owner,
      status: risk.status || 'identified',
    }));
  }

  private collectAgentRisks(roundOutputs: Record<number, any>): any[] {
    const risks: any[] = [];
    
    for (const round of Object.values(roundOutputs)) {
      for (const agentOutput of Object.values(round.agentOutputs || {})) {
        const output = agentOutput as any;
        if (output?.risks) {
          risks.push(...output.risks);
        }
      }
    }
    
    return risks;
  }

  private deduplicateRisks(risks: any[]): any[] {
    const seen = new Set<string>();
    return risks.filter(risk => {
      const key = (risk.description || '').toLowerCase().slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private buildResourcePlan(roundOutputs: Record<number, any>): EPMResource[] {
    const round4Resources = roundOutputs[4]?.synthesis?.consolidatedOutputs?.resources || [];
    const agentResources = this.collectAgentResources(roundOutputs);
    
    const allResources = [...round4Resources, ...agentResources];
    const consolidated = this.consolidateResources(allResources);
    
    return consolidated.map(r => ({
      role: r.role || 'Team Member',
      skills: r.skills || [],
      count: r.count || 1,
      allocation: r.allocation || 'Full-time',
      costPerMonth: r.costPerMonth,
    }));
  }

  private collectAgentResources(roundOutputs: Record<number, any>): any[] {
    const resources: any[] = [];
    
    for (const round of Object.values(roundOutputs)) {
      for (const agentOutput of Object.values(round.agentOutputs || {})) {
        const output = agentOutput as any;
        if (output?.resourceRequirements) {
          resources.push(...output.resourceRequirements);
        }
      }
    }
    
    return resources;
  }

  private consolidateResources(resources: any[]): any[] {
    const byRole = new Map<string, any>();
    
    for (const r of resources) {
      const key = (r.role || 'Unknown').toLowerCase();
      if (!byRole.has(key)) {
        byRole.set(key, { ...r });
      } else {
        const existing = byRole.get(key)!;
        existing.count = Math.max(existing.count || 1, r.count || 1);
        const combinedSkills = [...(existing.skills || []), ...(r.skills || [])];
        existing.skills = Array.from(new Set(combinedSkills));
      }
    }
    
    return Array.from(byRole.values());
  }

  private buildFinancialPlan(roundOutputs: Record<number, any>): any {
    const round4Finance = roundOutputs[4]?.agentOutputs?.finance_resources || {};
    const round6Finance = roundOutputs[6]?.agentOutputs?.finance_resources || {};
    
    const budget = round6Finance.budgetBreakdown || round4Finance.budgetBreakdown || {};
    
    return {
      totalBudget: budget.total || 0,
      breakdown: budget.categories || [],
      contingency: budget.contingency || 0,
    };
  }

  private buildStakeholderMap(roundOutputs: Record<number, any>): any[] {
    const round1Coord = roundOutputs[1]?.agentOutputs?.program_coordinator || {};
    return round1Coord.stakeholders || [];
  }

  private buildStageGates(roundOutputs: Record<number, any>): any[] {
    const round4Delivery = roundOutputs[4]?.agentOutputs?.platform_delivery || {};
    return round4Delivery.qualityGates || [];
  }

  private buildBenefitsRealization(roundOutputs: Record<number, any>): any {
    const round1 = roundOutputs[1]?.synthesis || {};
    const round7 = roundOutputs[7]?.synthesis || {};
    
    return {
      benefits: round1.consolidatedOutputs?.benefits || [],
      kpis: round7.consolidatedOutputs?.kpis || [],
    };
  }

  private buildGovernance(roundOutputs: Record<number, any>): any {
    const round6Synthesis = roundOutputs[6]?.synthesis?.consolidatedOutputs || {};
    const round7Synthesis = roundOutputs[7]?.synthesis?.consolidatedOutputs || {};
    
    return {
      decisionMakers: round6Synthesis.decisionMakers || ['Program Sponsor', 'Program Manager'],
      meetingCadence: round6Synthesis.meetingCadence || 'Weekly steering committee',
      escalationPath: round6Synthesis.escalationPath || 'Team Lead → Program Manager → Sponsor',
    };
  }

  private buildExecutiveSummary(roundOutputs: Record<number, any>, businessContext: BusinessContext): string {
    const round1Summary = roundOutputs[1]?.synthesis?.roundSummary || '';
    const round7Summary = roundOutputs[7]?.synthesis?.roundSummary || '';
    
    if (round7Summary) {
      return `${businessContext.name} Program Overview: ${round7Summary}`;
    }
    
    if (round1Summary) {
      return `${businessContext.name} Program Overview: ${round1Summary}`;
    }
    
    return `Strategic program plan for ${businessContext.name} (${businessContext.type}). This program outlines the key workstreams, resources, timeline, and risk mitigation strategies to achieve the business objectives.`;
  }

  private extractComponentConfidence(roundOutputs: Record<number, any>): Record<string, number> {
    const confidence: Record<string, number> = {};
    
    for (let round = 1; round <= 7; round++) {
      const synthesis = roundOutputs[round]?.synthesis;
      if (synthesis?.confidence) {
        confidence[`round${round}`] = synthesis.confidence;
      }
    }
    
    return confidence;
  }

  private calculateOverallConfidence(roundOutputs: Record<number, any>): number {
    const round7 = roundOutputs[7]?.synthesis;
    
    if (round7?.overallConfidence) {
      return round7.overallConfidence;
    }
    
    const confidences: number[] = [];
    
    for (let round = 1; round <= 7; round++) {
      const agentOutputs = roundOutputs[round]?.agentOutputs || {};
      for (const output of Object.values(agentOutputs)) {
        const conf = (output as any)?.confidence;
        if (typeof conf === 'number') {
          confidences.push(conf);
        }
      }
    }
    
    if (confidences.length === 0) return 0.7;
    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }
}

export const epmAssembler = new EPMAssembler();
