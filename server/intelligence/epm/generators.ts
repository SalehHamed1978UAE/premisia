/**
 * EPM Component Generators
 * 
 * Contains generators for all EPM components:
 * - Executive Summary
 * - Financial Plan
 * - Benefits Realization
 * - Risk Register
 * - Stage Gates
 * - KPIs
 * - Stakeholder Map
 * - Governance
 * - QA Plan
 * - Procurement
 * - Exit Strategy
 */

import type {
  StrategyInsights,
  StrategyInsight,
  UserContext,
  ResourcePlan,
  ResourceAllocation,
  Timeline,
  RiskRegister,
  StageGates,
  BenefitsRealization,
  Benefit,
  Risk,
  ExecutiveSummary,
  FinancialPlan,
  KPIs,
  StakeholderMap,
  Governance,
  QAPlan,
  Procurement,
  ExitStrategy
} from '../types';
import { aiClients } from '../../ai-clients';

/**
 * Executive Summary Generator
 */
export class ExecutiveSummaryGenerator {
  async generate(insights: StrategyInsights, programName: string): Promise<ExecutiveSummary> {
    const marketInsights = insights.insights.filter(i => i.type === 'other' && i.source.includes('summary'));
    const riskInsights = insights.insights.filter(i => i.type === 'risk');
    const benefitInsights = insights.insights.filter(i => i.type === 'benefit');

    return {
      title: programName,
      marketOpportunity: marketInsights[0]?.content || 
        'Strategic opportunity identified through framework analysis',
      strategicImperatives: insights.insights
        .filter(i => i.source.includes('recommendation') || i.source.includes('implication'))
        .slice(0, 5)
        .map(i => i.content),
      keySuccessFactors: insights.insights
        .filter(i => i.type === 'workstream')
        .slice(0, 4)
        .map(i => i.content.split('\n')[0]),
      riskSummary: `${riskInsights.length} risks identified, with ${riskInsights.filter(i => i.confidence > 0.8).length} high-priority risks requiring immediate mitigation.`,
      investmentRequired: this.estimateInvestmentFromInsights(insights),
      expectedOutcomes: this.summarizeExpectedOutcomes(benefitInsights),
      confidence: 0.90,
    };
  }

  private estimateInvestmentFromInsights(insights: StrategyInsights): string {
    const costInsights = insights.insights.filter(i => i.type === 'cost');
    if (costInsights.length > 0) {
      return `$${(costInsights.length * 200000).toLocaleString()} estimated`;
    }
    return insights.marketContext.budgetRange || '$500k - $1.5M';
  }

  private summarizeExpectedOutcomes(benefitInsights: StrategyInsight[]): string {
    if (benefitInsights.length === 0) {
      return 'Enhanced strategic positioning, operational efficiency, and competitive advantage';
    }
    return benefitInsights.slice(0, 3).map(i => i.content).join('; ');
  }
}

/**
 * Financial Plan Generator
 */
export class FinancialPlanGenerator {
  async generate(
    insights: StrategyInsights,
    resourcePlan: ResourcePlan,
    userContext?: UserContext
  ): Promise<FinancialPlan> {
    const costInsights = insights.insights.filter(i => i.type === 'cost');
    
    const personnelCost = resourcePlan.totalFTEs * 150000;
    const externalCost = resourcePlan.externalResources.reduce((sum, r) => sum + r.estimatedCost, 0);
    const overheadCost = (personnelCost + externalCost) * 0.15;
    const totalBudget = userContext?.budgetRange?.max || (personnelCost + externalCost + overheadCost);

    const costBreakdown = [
      { category: 'Personnel', amount: personnelCost, percentage: (personnelCost / totalBudget) * 100, description: 'Internal team costs' },
      { category: 'External Resources', amount: externalCost, percentage: (externalCost / totalBudget) * 100, description: 'Consultants, software, services' },
      { category: 'Overhead', amount: overheadCost, percentage: (overheadCost / totalBudget) * 100, description: 'Infrastructure, admin, facilities' },
    ];

    const contingency = totalBudget * 0.10;
    const cashFlow = this.generateCashFlow(totalBudget, 12);

    return {
      totalBudget: totalBudget + contingency,
      costBreakdown,
      cashFlow,
      contingency,
      contingencyPercentage: 10,
      assumptions: [
        `FTE cost: $150k/year`,
        `${resourcePlan.totalFTEs} FTEs for ${12} months`,
        `15% overhead for infrastructure and support`,
        `10% contingency for risks and unknowns`,
      ],
      confidence: costInsights.length > 0 ? 0.65 : 0.55,
    };
  }

  private generateCashFlow(totalBudget: number, months: number) {
    const quarters = Math.ceil(months / 3);
    const cashFlow = [];
    let cumulative = 0;

    for (let q = 1; q <= quarters; q++) {
      const percentage = q === 1 ? 0.40 : q === 2 ? 0.30 : q === 3 ? 0.20 : 0.10;
      const amount = -(totalBudget * percentage);
      cumulative += amount;
      
      cashFlow.push({
        quarter: q,
        amount,
        cumulative,
      });
    }

    return cashFlow;
  }
}

/**
 * Benefits Realization Generator
 */
export class BenefitsGenerator {
  async generate(
    insights: StrategyInsights,
    timeline: Timeline
  ): Promise<BenefitsRealization> {
    const benefitInsights = insights.insights.filter(i => i.type === 'benefit');
    
    const benefits: Benefit[] = benefitInsights.map((insight, idx) => {
      const estimatedValue = this.estimateBenefitValue(insight);
      return {
        id: `B${String(idx + 1).padStart(3, '0')}`,
        name: this.generateBenefitName(insight.content),
        category: this.categorizeBenefit(insight.content) as any,
        description: insight.content,
        target: this.generateBenefitTarget(insight.content, estimatedValue),
        realizationMonth: Math.min(timeline.totalMonths - 2 + idx, timeline.totalMonths + 6),
        estimatedValue,
        measurement: this.generateMeasurement(insight.content),
        confidence: insight.confidence,
      };
    });

    if (benefits.length < 3) {
      benefits.push({
        id: `B${String(benefits.length + 1).padStart(3, '0')}`,
        name: 'Strategic Positioning',
        category: 'Strategic',
        description: 'Enhanced strategic positioning and market competitiveness',
        target: '+10% market position improvement',
        realizationMonth: timeline.totalMonths,
        estimatedValue: undefined,
        measurement: 'Strategic metrics (annual)',
        confidence: 0.70,
      });
    }

    const totalFinancialValue = benefits
      .filter(b => b.estimatedValue)
      .reduce((sum, b) => sum + (b.estimatedValue || 0), 0);

    return {
      benefits,
      totalFinancialValue: totalFinancialValue > 0 ? totalFinancialValue : undefined,
      confidence: benefitInsights.length > 0 ? 0.70 : 0.60,
    };
  }

  private categorizeBenefit(content: string): 'Financial' | 'Strategic' | 'Operational' | 'Risk Mitigation' {
    const lower = content.toLowerCase();
    if (lower.includes('revenue') || lower.includes('cost') || lower.includes('$')) return 'Financial';
    if (lower.includes('risk') || lower.includes('mitigate')) return 'Risk Mitigation';
    if (lower.includes('efficiency') || lower.includes('process')) return 'Operational';
    return 'Strategic';
  }

  private estimateBenefitValue(insight: StrategyInsight): number | undefined {
    const match = insight.content.match(/\$([0-9,]+)/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''));
    }
    return undefined;
  }

  private generateMeasurement(content: string): string {
    const lower = content.toLowerCase();
    if (lower.includes('revenue')) return 'Revenue tracking (monthly)';
    if (lower.includes('cost')) return 'Cost analysis (quarterly)';
    if (lower.includes('customer')) return 'Customer surveys (quarterly)';
    if (lower.includes('market')) return 'Market analysis (semi-annual)';
    return 'Performance metrics (quarterly)';
  }

  private generateBenefitName(content: string): string {
    // Extract a short, descriptive name from the benefit content
    const lower = content.toLowerCase();
    
    // Look for common benefit patterns
    if (lower.includes('revenue') || lower.includes('sales')) return 'Revenue Growth';
    if (lower.includes('cost reduction') || lower.includes('cost savings')) return 'Cost Reduction';
    if (lower.includes('efficiency')) return 'Operational Efficiency';
    if (lower.includes('customer satisfaction') || lower.includes('nps')) return 'Customer Satisfaction';
    if (lower.includes('market share')) return 'Market Share Expansion';
    if (lower.includes('brand') || lower.includes('awareness')) return 'Brand Awareness';
    if (lower.includes('employee') || lower.includes('productivity')) return 'Team Productivity';
    if (lower.includes('quality')) return 'Quality Improvement';
    if (lower.includes('time to market') || lower.includes('speed')) return 'Time-to-Market';
    if (lower.includes('risk')) return 'Risk Mitigation';
    if (lower.includes('compliance')) return 'Compliance Achievement';
    if (lower.includes('innovation')) return 'Innovation Capability';
    
    // Fallback: extract first meaningful phrase (up to 40 chars)
    const firstSentence = content.split(/[.!?]/)[0].trim();
    if (firstSentence.length <= 40) return firstSentence;
    
    // Truncate at word boundary
    const truncated = firstSentence.substring(0, 40);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated;
  }

  private generateBenefitTarget(content: string, estimatedValue?: number): string {
    const lower = content.toLowerCase();
    
    // If we have an estimated value, use it
    if (estimatedValue) {
      return `$${estimatedValue.toLocaleString()} expected value`;
    }
    
    // Generate measurable targets based on content
    if (lower.includes('revenue') || lower.includes('sales')) return '+15% revenue increase';
    if (lower.includes('cost')) return '-20% cost reduction';
    if (lower.includes('efficiency') || lower.includes('productivity')) return '+25% efficiency gain';
    if (lower.includes('customer satisfaction') || lower.includes('nps')) return '+10 NPS improvement';
    if (lower.includes('market share')) return '+5% market share growth';
    if (lower.includes('time') || lower.includes('speed')) return '-30% cycle time reduction';
    if (lower.includes('quality') || lower.includes('defect')) return '-50% defect rate';
    if (lower.includes('employee') || lower.includes('retention')) return '+15% retention improvement';
    if (lower.includes('brand') || lower.includes('awareness')) return '+20% brand awareness';
    if (lower.includes('compliance')) return '100% compliance achievement';
    if (lower.includes('risk')) return '-40% risk exposure reduction';
    
    return '+10% performance improvement';
  }

  /**
   * Assign responsible parties to benefits based on their category and content
   * Matches benefits to resources using role-based logic similar to workstream owners
   */
  assignBenefitOwners(benefits: Benefit[], resources: ResourceAllocation[]): Benefit[] {
    if (!resources || resources.length === 0) {
      console.log('[BenefitsGenerator] No resources available, using default owner');
      return benefits.map(b => ({ ...b, responsibleParty: 'Program Director' }));
    }
    
    return benefits.map(benefit => {
      let owner = '';
      const lowerContent = benefit.description.toLowerCase();
      // Normalize category for matching - handle variants like "Risk Mitigation (Compliance)"
      const categoryLower = (benefit.category || '').toLowerCase();
      
      // Match by category first (case-insensitive with variants)
      if (categoryLower.includes('financial') || categoryLower.includes('finance')) {
        const match = resources.find(r => 
          r.role.toLowerCase().includes('financial') || 
          r.role.toLowerCase().includes('finance') ||
          r.role.toLowerCase().includes('performance')
        );
        owner = match?.role || '';
      } 
      else if (categoryLower.includes('strategic') || categoryLower.includes('strategy')) {
        const match = resources.find(r => 
          r.role.toLowerCase().includes('strategy') || 
          r.role.toLowerCase().includes('lead') ||
          r.role.toLowerCase().includes('director')
        );
        owner = match?.role || '';
      }
      else if (categoryLower.includes('operational') || categoryLower.includes('operations') || categoryLower.includes('ops')) {
        const match = resources.find(r => 
          r.role.toLowerCase().includes('operations') || 
          r.role.toLowerCase().includes('supply chain') ||
          r.role.toLowerCase().includes('manager')
        );
        owner = match?.role || '';
      }
      else if (categoryLower.includes('risk') || categoryLower.includes('compliance') || categoryLower.includes('mitigation')) {
        const match = resources.find(r => 
          r.role.toLowerCase().includes('risk') || 
          r.role.toLowerCase().includes('compliance') ||
          r.role.toLowerCase().includes('legal')
        );
        owner = match?.role || '';
      }
      
      // If no category match, try content-based matching
      if (!owner) {
        if (lowerContent.includes('customer') || lowerContent.includes('experience')) {
          const match = resources.find(r => 
            r.role.toLowerCase().includes('customer') || 
            r.role.toLowerCase().includes('experience')
          );
          owner = match?.role || '';
        }
        else if (lowerContent.includes('data') || lowerContent.includes('technology')) {
          const match = resources.find(r => 
            r.role.toLowerCase().includes('data') || 
            r.role.toLowerCase().includes('technology') ||
            r.role.toLowerCase().includes('digital')
          );
          owner = match?.role || '';
        }
        else if (lowerContent.includes('supply') || lowerContent.includes('inventory')) {
          const match = resources.find(r => 
            r.role.toLowerCase().includes('supply') || 
            r.role.toLowerCase().includes('operations')
          );
          owner = match?.role || '';
        }
      }
      
      // Final fallback: use first resource (usually the lead/director)
      if (!owner) {
        owner = resources[0]?.role || 'Program Director';
      }
      
      return {
        ...benefit,
        responsibleParty: owner
      };
    });
  }
}

/**
 * Risk Register Generator
 */
export class RiskGenerator {
  async generate(insights: StrategyInsights): Promise<RiskRegister> {
    const riskInsights = insights.insights.filter(i => i.type === 'risk');
    
    const risks: Risk[] = riskInsights.map((insight, idx) => {
      const probability = this.estimateRiskProbability(insight);
      const impact = this.estimateRiskImpact(insight);
      const category = this.categorizeRisk(insight);
      
      return {
        id: `R${String(idx + 1).padStart(3, '0')}`,
        description: insight.content,
        category,
        probability,
        impact,
        severity: probability * (impact === 'Critical' ? 4 : impact === 'High' ? 3 : impact === 'Medium' ? 2 : 1),
        mitigation: this.generateMitigation(insight, category),
        contingency: `Escalate to governance if probability exceeds ${probability + 20}%`,
        confidence: insight.confidence,
      };
    });

    const topRisks = [...risks].sort((a, b) => b.severity - a.severity).slice(0, 5);

    return {
      risks,
      topRisks,
      mitigationBudget: risks.length * 25000,
      confidence: riskInsights.length > 0 ? 0.80 : 0.65,
    };
  }

  private categorizeRisk(insight: StrategyInsight): string {
    const lower = insight.content.toLowerCase();
    if (lower.includes('technology') || lower.includes('technical')) return 'Technical';
    if (lower.includes('market') || lower.includes('competitive')) return 'Market';
    if (lower.includes('resource') || lower.includes('team')) return 'Resource';
    if (lower.includes('regulatory') || lower.includes('compliance')) return 'Regulatory';
    return 'Strategic';
  }

  private estimateRiskProbability(insight: StrategyInsight): number {
    return Math.round((1 - insight.confidence) * 100);
  }

  private estimateRiskImpact(insight: StrategyInsight): 'Low' | 'Medium' | 'High' | 'Critical' {
    const lower = insight.content.toLowerCase();
    if (lower.includes('critical') || lower.includes('catastrophic')) return 'Critical';
    if (lower.includes('high') || lower.includes('significant')) return 'High';
    if (lower.includes('medium') || lower.includes('moderate')) return 'Medium';
    return 'Low';
  }

  private generateMitigation(insight: StrategyInsight, category: string): string {
    const lower = insight.content.toLowerCase();
    
    if (lower.includes('competition') || lower.includes('competitor')) {
      return 'Develop competitive differentiation strategy and monitor competitor movements weekly';
    }
    if (lower.includes('supply chain') || lower.includes('supplier')) {
      return 'Diversify supplier base and maintain 30-day inventory buffer for critical materials';
    }
    if (lower.includes('talent') || lower.includes('hiring') || lower.includes('recruitment')) {
      return 'Implement retention bonuses, accelerate hiring pipeline, and cross-train existing staff';
    }
    if (lower.includes('technology') || lower.includes('system') || lower.includes('integration')) {
      return 'Conduct technical proof-of-concept, establish rollback procedures, and schedule vendor support';
    }
    if (lower.includes('regulatory') || lower.includes('compliance') || lower.includes('legal')) {
      return 'Engage legal counsel, implement compliance monitoring, and establish regulatory liaison';
    }
    if (lower.includes('budget') || lower.includes('cost') || lower.includes('financial')) {
      return 'Establish contingency reserve (15% of budget), implement monthly cost reviews, and identify cost reduction levers';
    }
    if (lower.includes('timeline') || lower.includes('delay') || lower.includes('schedule')) {
      return 'Build 2-week buffer into critical path, identify fast-track options, and escalate blockers within 48 hours';
    }
    if (lower.includes('customer') || lower.includes('user') || lower.includes('adoption')) {
      return 'Conduct user research, implement feedback loops, and develop change management communication plan';
    }
    if (lower.includes('market') || lower.includes('demand') || lower.includes('economic')) {
      return 'Monitor market indicators monthly, develop scenario-based contingency plans, and maintain pricing flexibility';
    }
    if (lower.includes('quality') || lower.includes('defect') || lower.includes('performance')) {
      return 'Implement quality gates at each phase, establish acceptance criteria, and conduct regular testing';
    }
    if (lower.includes('security') || lower.includes('breach') || lower.includes('data')) {
      return 'Conduct security audit, implement access controls, and establish incident response procedures';
    }
    if (lower.includes('stakeholder') || lower.includes('sponsor') || lower.includes('executive')) {
      return 'Schedule bi-weekly stakeholder updates, document decisions formally, and maintain RACI clarity';
    }
    if (lower.includes('resource') || lower.includes('capacity') || lower.includes('bandwidth')) {
      return 'Prioritize workload, identify backup resources, and establish resource escalation path';
    }
    
    const categoryMitigations: Record<string, string> = {
      'Technical': 'Conduct technical review, establish fallback architecture, and maintain vendor support agreements',
      'Market': 'Monitor market trends quarterly, develop pivot scenarios, and maintain customer feedback channels',
      'Resource': 'Cross-train team members, maintain contractor relationships, and document key processes',
      'Regulatory': 'Engage compliance experts, monitor regulatory changes, and maintain audit documentation',
      'Strategic': 'Review strategy quarterly with leadership, maintain scenario plans, and track leading indicators',
    };
    
    return categoryMitigations[category] || 'Establish monitoring process, define escalation triggers, and review mitigation effectiveness monthly';
  }
}

/**
 * Stage Gates Generator
 */
export class StageGateGenerator {
  async generate(timeline: Timeline, riskRegister: RiskRegister): Promise<StageGates> {
    const gates = timeline.phases.map((phase, idx) => ({
      gate: idx + 1,
      name: `Gate ${idx + 1}: ${phase.name} Complete`,
      month: phase.endMonth,
      goCriteria: [
        `All ${phase.name} deliverables completed`,
        `Phase objectives achieved`,
        `Budget within ±10% of plan`,
        `No critical risks unmitigated`,
      ],
      noGoTriggers: [
        `Critical deliverables >2 weeks late`,
        `Budget overrun >20%`,
        `${riskRegister.topRisks.slice(0, 2).map(r => `Risk ${r.id} realized`).join(' OR ')}`,
      ],
      deliverables: phase.workstreamIds,
      confidence: 0.85,
    }));

    return {
      gates,
      confidence: 0.85,
    };
  }
}

/**
 * KPI Generator
 */
export class KPIGenerator {
  async generate(insights: StrategyInsights, benefitsRealization: BenefitsRealization): Promise<KPIs> {
    const kpis = benefitsRealization.benefits.map((benefit, idx) => {
      let kpiCategory: 'Financial' | 'Operational' | 'Strategic' | 'Customer' = 'Strategic';
      if (benefit.category === 'Financial') kpiCategory = 'Financial';
      else if (benefit.category === 'Operational') kpiCategory = 'Operational';
      else if (benefit.category === 'Strategic') kpiCategory = 'Strategic';
      
      return {
        id: `KPI${String(idx + 1).padStart(3, '0')}`,
        name: this.generateKPIName(benefit.description),
        category: kpiCategory,
        baseline: 'Current state',
        target: benefit.estimatedValue ? `+${benefit.estimatedValue.toLocaleString()}` : this.generateMeasurableTarget(benefit),
        measurement: benefit.measurement,
        frequency: benefit.category === 'Financial' ? 'Monthly' as const : 'Quarterly' as const,
        linkedBenefitIds: [benefit.id],
        confidence: benefit.confidence,
      };
    });

    kpis.push({
      id: `KPI${String(kpis.length + 1).padStart(3, '0')}`,
      name: 'Program Progress',
      category: 'Operational',
      baseline: '0%',
      target: '100%',
      measurement: 'Percentage of deliverables completed',
      frequency: 'Monthly',
      linkedBenefitIds: [],
      confidence: 0.95,
    });

    return {
      kpis,
      confidence: 0.75,
    };
  }

  private generateKPIName(description: string): string {
    const words = description.split(' ').slice(0, 4).join(' ');
    return words.length > 40 ? words.substring(0, 37) + '...' : words;
  }

  private generateMeasurableTarget(benefit: { description: string; category: string; measurement?: string }): string {
    const lower = benefit.description.toLowerCase();
    const measurement = benefit.measurement?.toLowerCase() || '';
    
    if (lower.includes('revenue') || lower.includes('sales')) {
      return '+15% year-over-year';
    }
    if (lower.includes('cost') || lower.includes('expense') || lower.includes('savings')) {
      return '-20% reduction from baseline';
    }
    if (lower.includes('efficiency') || lower.includes('productivity')) {
      return '+25% improvement in throughput';
    }
    if (lower.includes('time') || lower.includes('speed') || lower.includes('faster')) {
      return '-30% reduction in cycle time';
    }
    if (lower.includes('customer') || lower.includes('satisfaction') || lower.includes('nps')) {
      return '+10 points NPS improvement';
    }
    if (lower.includes('quality') || lower.includes('defect') || lower.includes('error')) {
      return '-50% reduction in defect rate';
    }
    if (lower.includes('market') || lower.includes('share')) {
      return '+5% market share gain';
    }
    if (lower.includes('retention') || lower.includes('churn')) {
      return '+10% improvement in retention rate';
    }
    if (lower.includes('conversion') || lower.includes('lead')) {
      return '+20% conversion rate improvement';
    }
    if (lower.includes('engagement') || lower.includes('adoption')) {
      return '+30% increase in active users';
    }
    if (lower.includes('compliance') || lower.includes('audit')) {
      return '100% compliance score';
    }
    if (lower.includes('risk') || lower.includes('incident')) {
      return '-40% reduction in incidents';
    }
    
    if (benefit.category === 'Financial') {
      return '+10% improvement vs baseline';
    }
    if (benefit.category === 'Operational') {
      return '+15% operational improvement';
    }
    if (benefit.category === 'Customer') {
      return '+20% customer metric improvement';
    }
    
    return '+15% improvement vs current state';
  }
}

/**
 * Stakeholder Map Generator
 */
export class StakeholderGenerator {
  async generate(insights: StrategyInsights): Promise<StakeholderMap> {
    const stakeholderInsights = insights.insights.filter(i => i.type === 'stakeholder');
    
    const stakeholders = stakeholderInsights.map(insight => ({
      name: insight.content.split(':')[0] || 'Stakeholder',
      group: this.categorizeStakeholder(insight.content),
      power: this.assessStakeholderPower(insight) as any,
      interest: this.assessStakeholderInterest(insight) as any,
      engagement: `${this.assessStakeholderPower(insight)} power, ${this.assessStakeholderInterest(insight)} interest - ${this.getEngagementStrategy(insight)}`,
      communicationPlan: this.generateCommunicationPlan(insight),
    }));

    if (stakeholders.length < 3) {
      stakeholders.push(
        { name: 'Executive Sponsor', group: 'Leadership', power: 'High', interest: 'High', engagement: 'Manage closely', communicationPlan: 'Weekly updates' },
        { name: 'Program Team', group: 'Execution', power: 'Medium', interest: 'High', engagement: 'Keep informed', communicationPlan: 'Daily standups' },
        { name: 'End Users', group: 'Customers', power: 'Medium', interest: 'High', engagement: 'Keep informed', communicationPlan: 'Monthly updates' }
      );
    }

    const changeManagement = [
      { phase: 'Awareness', months: 'Months 0-2', activities: ['Stakeholder identification', 'Impact assessment', 'Communication planning'] },
      { phase: 'Mobilization', months: 'Months 2-4', activities: ['Training programs', 'Change champions', 'Feedback loops'] },
      { phase: 'Execution', months: 'Months 4-10', activities: ['Ongoing support', 'Resistance management', 'Progress tracking'] },
      { phase: 'Sustainment', months: 'Months 10-12+', activities: ['Reinforcement', 'Best practices', 'Continuous improvement'] },
    ];

    return {
      stakeholders,
      changeManagement,
      impactedGroups: stakeholders.length,
      confidence: stakeholderInsights.length > 0 ? 0.75 : 0.65,
    };
  }

  private categorizeStakeholder(content: string): string {
    const lower = content.toLowerCase();
    if (lower.includes('customer') || lower.includes('user')) return 'Customers';
    if (lower.includes('executive') || lower.includes('leadership')) return 'Leadership';
    if (lower.includes('team') || lower.includes('employee')) return 'Execution';
    if (lower.includes('partner') || lower.includes('supplier')) return 'Partners';
    return 'Other';
  }

  private assessStakeholderPower(insight: StrategyInsight): string {
    if (insight.confidence > 0.8) return 'High';
    if (insight.confidence > 0.6) return 'Medium';
    return 'Low';
  }

  private assessStakeholderInterest(insight: StrategyInsight): string {
    return 'High';
  }

  private getEngagementStrategy(insight: StrategyInsight): string {
    const power = this.assessStakeholderPower(insight);
    const interest = this.assessStakeholderInterest(insight);
    
    if (power === 'High' && interest === 'High') return 'Manage closely';
    if (power === 'High' && interest !== 'High') return 'Keep satisfied';
    if (power !== 'High' && interest === 'High') return 'Keep informed';
    return 'Monitor';
  }

  private generateCommunicationPlan(insight: StrategyInsight): string {
    const strategy = this.getEngagementStrategy(insight);
    if (strategy === 'Manage closely') return 'Weekly updates, monthly reviews';
    if (strategy === 'Keep satisfied') return 'Monthly updates';
    if (strategy === 'Keep informed') return 'Quarterly updates, newsletters';
    return 'As needed';
  }
}

/**
 * Governance Generator
 */
export class GovernanceGenerator {
  async generate(insights: StrategyInsights, stakeholderMap: StakeholderMap): Promise<Governance> {
    return {
      bodies: [
        {
          name: 'Steering Committee',
          level: 'Strategic',
          members: ['Executive Sponsor', 'Business Owners', 'Program Manager'],
          cadence: 'Monthly',
          responsibilities: ['Strategic direction', 'Budget approval', 'Risk escalation'],
          escalationPath: 'Board of Directors',
        },
        {
          name: 'Program Management Office',
          level: 'Tactical',
          members: ['Program Manager', 'Workstream Leads', 'Change Manager'],
          cadence: 'Weekly',
          responsibilities: ['Progress tracking', 'Issue resolution', 'Resource allocation'],
          escalationPath: 'Steering Committee',
        },
      ],
      decisionRights: [
        { decision: 'Budget Changes >10%', responsible: 'Program Manager', accountable: 'Steering Committee', consulted: 'Finance', informed: 'All Stakeholders' },
        { decision: 'Scope Changes', responsible: 'Workstream Leads', accountable: 'Program Manager', consulted: 'Business Owners', informed: 'Steering Committee' },
        { decision: 'Risk Mitigation', responsible: 'Risk Owner', accountable: 'Program Manager', consulted: 'PMO', informed: 'Steering Committee' },
      ],
      meetingCadence: {
        'Daily': 'Team standups',
        'Weekly': 'PMO sync, workstream reviews',
        'Monthly': 'Steering Committee, stakeholder updates',
      },
      confidence: 0.85,
    };
  }
}

/**
 * QA Plan Generator
 */
export class QAPlanGenerator {
  async generate(insights: StrategyInsights): Promise<QAPlan> {
    return {
      standards: [
        { area: 'Deliverables', standard: 'All deliverables reviewed and approved', acceptanceCriteria: ['Peer review completed', 'Stakeholder approval', 'Quality checklist passed'] },
        { area: 'Testing', standard: 'Comprehensive testing before deployment', acceptanceCriteria: ['Test plans executed', 'Defects resolved', 'User acceptance complete'] },
        { area: 'Documentation', standard: 'Complete and current documentation', acceptanceCriteria: ['User guides', 'Technical specs', 'Process documentation'] },
      ],
      processes: [
        { phase: 'Planning', activities: ['Quality plan development', 'Standards definition', 'Acceptance criteria'] },
        { phase: 'Execution', activities: ['Quality reviews', 'Testing', 'Defect tracking'] },
        { phase: 'Closure', activities: ['Final QA audit', 'Lessons learned', 'Quality metrics'] },
      ],
      acceptanceCriteria: [
        'All deliverables meet quality standards',
        'Testing complete with <5% defect rate',
        'Stakeholder sign-off received',
        'Documentation complete and approved',
      ],
      confidence: 0.80,
    };
  }
}

/**
 * Procurement Generator
 */
export class ProcurementGenerator {
  async generate(insights: StrategyInsights, financialPlan: FinancialPlan): Promise<Procurement> {
    const items = financialPlan.costBreakdown
      .filter(c => c.category === 'External Resources')
      .map((cost, idx) => ({
        id: `P${String(idx + 1).padStart(3, '0')}`,
        name: cost.description,
        type: 'Services' as const,
        estimatedValue: cost.amount,
        timing: 'Months 0-6',
        purpose: cost.description,
        approvalRequired: cost.amount > 100000 ? 'Steering Committee' : 'Program Manager',
      }));

    return {
      items,
      vendorManagement: [
        'Monthly vendor performance reviews',
        'Contract compliance monitoring',
        'Service level agreement tracking',
      ],
      policies: [
        'All procurement >$50k requires competitive bidding',
        'Vendor selection based on capability and cost',
        'Quarterly vendor portfolio review',
      ],
      totalProcurementValue: items.reduce((sum, i) => sum + i.estimatedValue, 0),
      confidence: 0.75,
    };
  }
}

/**
 * Exit Strategy Generator
 */
export class ExitStrategyGenerator {
  async generate(insights: StrategyInsights, riskRegister: RiskRegister): Promise<ExitStrategy> {
    return {
      failureConditions: riskRegister.topRisks.slice(0, 3).map(risk => ({
        trigger: risk.description,
        severity: (risk.impact === 'Low' ? 'Medium' : risk.impact) as 'Critical' | 'High' | 'Medium',
        responseTime: risk.impact === 'Critical' ? 'Immediate' : '30 days',
      })),
      rollbackProcedures: [
        {
          name: 'Program Pause',
          trigger: 'Critical risk realized or budget overrun >30%',
          actions: ['Pause all workstreams', 'Stakeholder notification', 'Impact assessment', 'Remediation plan'],
          estimatedCost: 100000,
          timeline: '2-4 weeks',
        },
        {
          name: 'Graceful Wind-Down',
          trigger: 'Strategic objectives no longer valid',
          actions: ['Complete in-flight deliverables', 'Knowledge transfer', 'Asset disposition', 'Team redeployment'],
          estimatedCost: 250000,
          timeline: '3 months',
        },
      ],
      pivotOptions: [
        { name: 'Reduce Scope', description: 'Focus on core deliverables only', conditions: ['Budget constraints', 'Timeline pressure'] },
        { name: 'Phased Approach', description: 'Deliver in multiple phases', conditions: ['Resource constraints', 'Risk mitigation'] },
      ],
      lessonsLearned: [
        'Conduct post-implementation review',
        'Document successes and challenges',
        'Update organizational playbooks',
      ],
      confidence: 0.75,
    };
  }
}

/**
 * Program Name Generator
 */
export class ProgramNameGenerator {
  async generate(
    insights: StrategyInsights,
    userContext?: UserContext,
    namingContext?: any
  ): Promise<string> {
    try {
      // PRIORITY: Use journey title if available (from strategic_understanding)
      // This is the user-facing name they see in the journey, so use it directly
      if (namingContext?.journeyTitle) {
        console.log(`[ProgramNameGenerator] 🎯 Using journey title: "${namingContext.journeyTitle}"`);
        return namingContext.journeyTitle;
      }
      
      const keyInsights = namingContext?.bmcKeyInsights || [];
      const recommendations = namingContext?.bmcRecommendations || [];
      const selectedDecisions = namingContext?.selectedDecisions || {};
      const decisionsData = namingContext?.decisionsData || {};
      const framework = namingContext?.framework || 'bmc';
      
      let contextSummary = '';
      
      if (keyInsights.length > 0) {
        contextSummary += `\nKey Strategic Insights:\n${keyInsights.slice(0, 3).join('\n')}`;
      }
      
      if (recommendations.length > 0) {
        const recs = recommendations.slice(0, 2).map((r: any) => 
          typeof r === 'object' ? r.action : r
        );
        contextSummary += `\n\nTop Recommendations:\n${recs.join('\n')}`;
      }
      
      if (decisionsData?.decisions && selectedDecisions) {
        const selectedOptions: string[] = [];
        decisionsData.decisions.forEach((decision: any) => {
          const selectedOptionId = selectedDecisions[decision.id];
          if (selectedOptionId) {
            const option = decision.options?.find((o: any) => o.id === selectedOptionId);
            if (option) {
              selectedOptions.push(`${decision.title}: ${option.label}`);
            }
          }
        });
        
        if (selectedOptions.length > 0) {
          contextSummary += `\n\nSelected Strategic Decisions:\n${selectedOptions.slice(0, 3).join('\n')}`;
        }
      }
      
      const prompt = `You are an expert program manager creating concise, descriptive program names.

Given the following strategic analysis and decisions, generate a professional program name that captures the essence of this initiative.

${contextSummary}

Framework Used: ${framework.toUpperCase()}

Requirements:
- 8-15 words maximum
- Clear and descriptive
- Professional tone
- Captures the core strategic approach
- Avoid generic terms like "Strategic Initiative"
- Focus on the unique strategic choices made

Examples of good program names:
- "Brooklyn Coffee Shop Community Hub with Diversified Revenue Strategy"
- "Premium Customer Segment Market Entry via Pop-up Testing"
- "Sustainable Pace Technology Integration for Local Market"

Generate ONLY the program name, nothing else.`;

      const result = await aiClients.callWithFallback({
        systemPrompt: 'You are a program naming expert. Generate concise, professional program names.',
        userMessage: prompt,
        maxTokens: 100,
      });
      
      const programName = result.content.trim();
      
      if (programName && programName.length > 0 && programName.length <= 150) {
        return programName;
      }
      
      return this.generateFallbackProgramName(selectedDecisions, decisionsData, framework);
      
    } catch (error) {
      console.error('[ProgramNameGenerator] Program name generation failed:', error);
      return this.generateFallbackProgramName(
        namingContext?.selectedDecisions,
        namingContext?.decisionsData,
        namingContext?.framework || 'bmc'
      );
    }
  }

  private generateFallbackProgramName(
    selectedDecisions: any,
    decisionsData: any,
    framework: string
  ): string {
    const parts: string[] = [];
    
    if (decisionsData?.decisions && selectedDecisions) {
      decisionsData.decisions.slice(0, 2).forEach((decision: any) => {
        const selectedOptionId = selectedDecisions[decision.id];
        if (selectedOptionId) {
          const option = decision.options?.find((o: any) => o.id === selectedOptionId);
          if (option) {
            parts.push(option.label);
          }
        }
      });
    }
    
    if (parts.length === 0) {
      return `${framework.toUpperCase()} Strategic Initiative`;
    }
    
    return parts.slice(0, 3).join(' - ') + ' Program';
  }
}

export default {
  ExecutiveSummaryGenerator,
  FinancialPlanGenerator,
  BenefitsGenerator,
  RiskGenerator,
  StageGateGenerator,
  KPIGenerator,
  StakeholderGenerator,
  GovernanceGenerator,
  QAPlanGenerator,
  ProcurementGenerator,
  ExitStrategyGenerator,
  ProgramNameGenerator,
};
