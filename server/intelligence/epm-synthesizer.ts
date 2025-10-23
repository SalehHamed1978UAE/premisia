/**
 * EPM Synthesizer
 * 
 * Converts normalized StrategyInsights into complete, validated EPM programs
 * with all 14 required components.
 * 
 * This is the core engine that ensures EVERY strategic journey produces
 * a complete, executable EPM program regardless of framework used.
 */

import type {
  EPMProgram,
  StrategyInsights,
  StrategyInsight,
  UserContext,
  ValidationReport,
  ExecutiveSummary,
  Workstream,
  Timeline,
  ResourcePlan,
  FinancialPlan,
  BenefitsRealization,
  RiskRegister,
  StageGates,
  KPIs,
  StakeholderMap,
  Governance,
  QAPlan,
  Procurement,
  ExitStrategy,
} from './types';

export class EPMSynthesizer {
  /**
   * Generate complete EPM program from strategic insights
   */
  async synthesize(
    insights: StrategyInsights,
    userContext?: UserContext,
    namingContext?: any
  ): Promise<EPMProgram> {
    
    // Generate intelligent program name from context
    const programName = await this.generateProgramName(insights, userContext, namingContext);
    
    // Generate all 14 components
    const executiveSummary = await this.generateExecutiveSummary(insights, programName);
    const workstreams = await this.generateWorkstreams(insights);
    const timeline = await this.generateTimeline(insights, workstreams, userContext);
    const resourcePlan = await this.generateResourcePlan(insights, workstreams, userContext);
    const financialPlan = await this.generateFinancialPlan(insights, resourcePlan, userContext);
    const benefitsRealization = await this.generateBenefitsRealization(insights, timeline);
    const riskRegister = await this.generateRiskRegister(insights);
    const stageGates = await this.generateStageGates(timeline, riskRegister);
    const kpis = await this.generateKPIs(insights, benefitsRealization);
    const stakeholderMap = await this.generateStakeholderMap(insights);
    const governance = await this.generateGovernance(insights, stakeholderMap);
    const qaPlan = await this.generateQAPlan(insights);
    const procurement = await this.generateProcurement(insights, financialPlan);
    const exitStrategy = await this.generateExitStrategy(insights, riskRegister);

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence([
      executiveSummary.confidence,
      timeline.confidence,
      resourcePlan.confidence,
      financialPlan.confidence,
      benefitsRealization.confidence,
      riskRegister.confidence,
      stageGates.confidence,
      kpis.confidence,
      stakeholderMap.confidence,
      governance.confidence,
      qaPlan.confidence,
      procurement.confidence,
      exitStrategy.confidence,
    ]);

    // Generate extraction rationale
    const extractionRationale = this.generateExtractionRationale(insights, userContext);

    const program: EPMProgram = {
      frameworkType: insights.frameworkType,
      frameworkRunId: insights.frameworkRunId,
      generatedAt: new Date(),
      overallConfidence,
      extractionRationale,
      executiveSummary,
      workstreams,
      timeline,
      resourcePlan,
      financialPlan,
      benefitsRealization,
      riskRegister,
      stageGates,
      kpis,
      stakeholderMap,
      governance,
      qaPlan,
      procurement,
      exitStrategy,
    };

    return program;
  }

  // ============================================================================
  // Component Generators
  // ============================================================================

  private async generateExecutiveSummary(insights: StrategyInsights, programName: string): Promise<ExecutiveSummary> {
    const marketInsights = insights.insights.filter(i => i.type === 'other' && i.source.includes('summary'));
    const riskInsights = insights.insights.filter(i => i.type === 'risk');
    const benefitInsights = insights.insights.filter(i => i.type === 'benefit');

    return {
      title: programName, // Add intelligent program name
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
      confidence: 0.90, // Executive summary is synthesized with high confidence
    };
  }

  private async generateWorkstreams(insights: StrategyInsights): Promise<Workstream[]> {
    const workstreamInsights = insights.insights.filter(i => i.type === 'workstream');
    
    const workstreams: Workstream[] = workstreamInsights.map((insight, index) => {
      const deliverables = this.generateDeliverables(insight, index);
      
      return {
        id: `WS${String(index + 1).padStart(3, '0')}`,
        name: insight.content.split('\n')[0] || `Workstream ${index + 1}`,
        description: insight.content,
        deliverables,
        startMonth: Math.floor(index / 2) + 1, // Stagger starts
        endMonth: Math.min(Math.floor(index / 2) + 1 + deliverables.length, 12),
        dependencies: index > 0 ? [`WS${String(index).padStart(3, '0')}`] : [],
        confidence: insight.confidence,
      };
    });

    // Ensure minimum 3 workstreams
    if (workstreams.length < 3) {
      workstreams.push(...this.generateDefaultWorkstreams(3 - workstreams.length));
    }

    // Validate and correct deliverable timelines
    this.validateDeliverableTimelines(workstreams);

    return workstreams;
  }

  /**
   * Validates that all deliverables fall within their parent workstream's timeline.
   * Auto-corrects out-of-range deliverables by clamping to workstream endMonth.
   */
  private validateDeliverableTimelines(workstreams: Workstream[]): void {
    for (const workstream of workstreams) {
      let correctedCount = 0;
      
      for (const deliverable of workstream.deliverables) {
        // Check if deliverable falls outside workstream timeline
        if (deliverable.dueMonth < workstream.startMonth || deliverable.dueMonth > workstream.endMonth) {
          const originalDueMonth = deliverable.dueMonth;
          
          // Clamp to workstream timeline
          deliverable.dueMonth = Math.max(
            workstream.startMonth,
            Math.min(deliverable.dueMonth, workstream.endMonth)
          );
          
          correctedCount++;
          console.warn(
            `[EPM Synthesis] Deliverable "${deliverable.name}" (${deliverable.id}) ` +
            `had dueMonth ${originalDueMonth} outside workstream "${workstream.name}" ` +
            `timeline (M${workstream.startMonth}-M${workstream.endMonth}). ` +
            `Auto-corrected to M${deliverable.dueMonth}.`
          );
        }
      }
      
      if (correctedCount > 0) {
        console.log(
          `[EPM Synthesis] Corrected ${correctedCount} deliverable(s) in "${workstream.name}" ` +
          `to fall within workstream timeline.`
        );
      }
    }
  }

  private generateDeliverables(insight: StrategyInsight, workstreamIndex: number) {
    const lines = insight.content.split('\n').filter(l => l.trim());
    const deliverableLines = lines.slice(1, 4); // Take up to 3 deliverables
    
    return deliverableLines.map((line, idx) => ({
      id: `D${String(workstreamIndex + 1).padStart(3, '0')}.${idx + 1}`,
      name: line.replace(/^[-•]\s*/, '').trim(),
      description: line.replace(/^[-•]\s*/, '').trim(),
      dueMonth: workstreamIndex + idx + 2,
      effort: this.estimateEffort(line),
    }));
  }

  private async generateTimeline(
    insights: StrategyInsights,
    workstreams: Workstream[],
    userContext?: UserContext
  ): Promise<Timeline> {
    const timelineInsight = insights.insights.find(i => i.type === 'timeline');
    
    // Determine total duration based on urgency
    let totalMonths = 12; // Default: strategic timeline
    if (insights.marketContext.urgency === 'ASAP') {
      totalMonths = 6;
    } else if (insights.marketContext.urgency === 'Exploratory') {
      totalMonths = 18;
    }
    
    if (userContext?.hardDeadlines && userContext.hardDeadlines.length > 0) {
      // Adjust timeline to meet hard deadlines
      const earliestDeadline = Math.min(...userContext.hardDeadlines.map(d => 
        Math.ceil((d.date.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000))
      ));
      totalMonths = Math.min(totalMonths, earliestDeadline);
    }

    // Generate phases
    const phases = this.generatePhases(totalMonths, workstreams);
    
    // Identify critical path (longest dependency chain)
    const criticalPath = this.identifyCriticalPath(workstreams);

    return {
      totalMonths,
      phases,
      criticalPath,
      confidence: timelineInsight?.confidence || 0.65,
    };
  }

  private generatePhases(totalMonths: number, workstreams: Workstream[]) {
    const phaseDuration = Math.ceil(totalMonths / 4);
    
    return [
      {
        phase: 1,
        name: 'Planning & Foundation',
        startMonth: 0,
        endMonth: phaseDuration,
        description: 'Initial setup, team assembly, detailed planning',
        keyMilestones: ['Project kickoff', 'Team onboarded', 'Detailed plan approved'],
        workstreamIds: workstreams.filter(w => w.startMonth <= phaseDuration).map(w => w.id),
      },
      {
        phase: 2,
        name: 'Development & Execution',
        startMonth: phaseDuration,
        endMonth: phaseDuration * 2,
        description: 'Core workstream execution, deliverable development',
        keyMilestones: ['Key deliverables completed', 'Progress review', 'Adjustments made'],
        workstreamIds: workstreams.filter(w => w.startMonth > phaseDuration && w.startMonth <= phaseDuration * 2).map(w => w.id),
      },
      {
        phase: 3,
        name: 'Integration & Testing',
        startMonth: phaseDuration * 2,
        endMonth: phaseDuration * 3,
        description: 'Integration of deliverables, testing, refinement',
        keyMilestones: ['Integration complete', 'Testing passed', 'Stakeholder approval'],
        workstreamIds: workstreams.filter(w => w.endMonth > phaseDuration * 2 && w.endMonth <= phaseDuration * 3).map(w => w.id),
      },
      {
        phase: 4,
        name: 'Deployment & Stabilization',
        startMonth: phaseDuration * 3,
        endMonth: totalMonths,
        description: 'Launch, monitoring, optimization',
        keyMilestones: ['Launch complete', 'Performance validated', 'Benefits tracking'],
        workstreamIds: workstreams.filter(w => w.endMonth > phaseDuration * 3).map(w => w.id),
      },
    ];
  }

  private identifyCriticalPath(workstreams: Workstream[]): string[] {
    // Simple critical path: longest chain of dependencies
    const pathLengths = workstreams.map(w => {
      let length = w.endMonth - w.startMonth;
      let current = w;
      
      while (current.dependencies.length > 0) {
        const dep = workstreams.find(ws => ws.id === current.dependencies[0]);
        if (dep) {
          length += dep.endMonth - dep.startMonth;
          current = dep;
        } else {
          break;
        }
      }
      
      return { workstream: w, length };
    });

    const longest = pathLengths.sort((a, b) => b.length - a.length)[0];
    return [longest.workstream.id];
  }

  private async generateResourcePlan(
    insights: StrategyInsights,
    workstreams: Workstream[],
    userContext?: UserContext
  ): Promise<ResourcePlan> {
    const resourceInsights = insights.insights.filter(i => i.type === 'resource');
    
    // Estimate FTE needs based on workstreams
    const estimatedFTEs = Math.max(8, Math.min(workstreams.length * 2, 20));
    
    const internalTeam = this.generateInternalTeam(estimatedFTEs, workstreams, resourceInsights);
    const externalResources = this.generateExternalResources(insights, userContext);
    const criticalSkills = Array.from(new Set(internalTeam.flatMap(r => r.skills)));

    return {
      internalTeam,
      externalResources,
      criticalSkills,
      totalFTEs: estimatedFTEs,
      confidence: resourceInsights.length > 0 ? 0.70 : 0.60,
    };
  }

  private generateInternalTeam(estimatedFTEs: number, workstreams: Workstream[], resourceInsights: StrategyInsight[]) {
    const roles = [
      { role: 'Program Manager', allocation: 100, months: 12, skills: ['Program management', 'Stakeholder management', 'Risk management'] },
      { role: 'Business Analyst', allocation: 100, months: 10, skills: ['Requirements analysis', 'Process mapping', 'Documentation'] },
      { role: 'Technical Lead', allocation: 100, months: 12, skills: ['Technical architecture', 'System design', 'Team leadership'] },
      { role: 'Developer/Engineer', allocation: 100, months: 10, skills: ['Software development', 'Testing', 'Integration'] },
      { role: 'Change Manager', allocation: 75, months: 8, skills: ['Change management', 'Training', 'Communication'] },
      { role: 'Quality Assurance', allocation: 75, months: 8, skills: ['Testing', 'Quality assurance', 'Documentation'] },
    ];

    return roles.slice(0, Math.min(estimatedFTEs, roles.length)).map(r => ({
      ...r,
      justification: `Required for ${workstreams.length} workstreams across ${workstreams[0]?.endMonth || 12} months`,
    }));
  }

  private generateExternalResources(insights: StrategyInsights, userContext?: UserContext) {
    const defaultBudget = userContext?.budgetRange?.max || 1000000;
    
    return [
      {
        type: 'Consultant' as const,
        description: 'Strategic advisory and specialized expertise',
        estimatedCost: Math.floor(defaultBudget * 0.15),
        timing: 'Months 0-3',
        justification: 'Domain expertise and methodology guidance',
      },
      {
        type: 'Software' as const,
        description: 'Project management and collaboration tools',
        estimatedCost: Math.floor(defaultBudget * 0.05),
        timing: 'Months 0-12',
        justification: 'Enable effective team collaboration and tracking',
      },
    ];
  }

  private async generateFinancialPlan(
    insights: StrategyInsights,
    resourcePlan: ResourcePlan,
    userContext?: UserContext
  ): Promise<FinancialPlan> {
    const costInsights = insights.insights.filter(i => i.type === 'cost');
    
    // Estimate total budget
    const personnelCost = resourcePlan.totalFTEs * 150000; // $150k per FTE per year
    const externalCost = resourcePlan.externalResources.reduce((sum, r) => sum + r.estimatedCost, 0);
    const overheadCost = (personnelCost + externalCost) * 0.15; // 15% overhead
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
      // Front-load spending (40%, 30%, 20%, 10%)
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

  private async generateBenefitsRealization(
    insights: StrategyInsights,
    timeline: Timeline
  ): Promise<BenefitsRealization> {
    const benefitInsights = insights.insights.filter(i => i.type === 'benefit');
    
    const benefits = benefitInsights.map((insight, idx) => ({
      id: `B${String(idx + 1).padStart(3, '0')}`,
      category: this.categorizeBenefit(insight.content) as any,
      description: insight.content,
      realizationMonth: Math.min(timeline.totalMonths - 2 + idx, timeline.totalMonths + 6),
      estimatedValue: this.estimateBenefitValue(insight),
      measurement: this.generateMeasurement(insight.content),
      confidence: insight.confidence,
    }));

    // Add default benefits if too few
    if (benefits.length < 3) {
      benefits.push({
        id: `B${String(benefits.length + 1).padStart(3, '0')}`,
        category: 'Strategic',
        description: 'Enhanced strategic positioning and market competitiveness',
        realizationMonth: timeline.totalMonths,
        estimatedValue: undefined,
        measurement: 'Market position assessment',
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

  private async generateRiskRegister(insights: StrategyInsights): Promise<RiskRegister> {
    const riskInsights = insights.insights.filter(i => i.type === 'risk');
    
    const risks = riskInsights.map((insight, idx) => {
      const probability = this.estimateRiskProbability(insight);
      const impact = this.estimateRiskImpact(insight);
      
      return {
        id: `R${String(idx + 1).padStart(3, '0')}`,
        description: insight.content,
        category: this.categorizeRisk(insight),
        probability,
        impact,
        severity: probability * (impact === 'Critical' ? 4 : impact === 'High' ? 3 : impact === 'Medium' ? 2 : 1),
        mitigation: `Monitor and implement controls to reduce ${impact.toLowerCase()} impact`,
        contingency: `Escalate to governance if probability exceeds ${probability + 20}%`,
        confidence: insight.confidence,
      };
    });

    // Sort by severity
    const topRisks = [...risks].sort((a, b) => b.severity - a.severity).slice(0, 5);

    return {
      risks,
      topRisks,
      mitigationBudget: risks.length * 25000, // $25k per risk for mitigation
      confidence: riskInsights.length > 0 ? 0.80 : 0.65,
    };
  }

  private async generateStageGates(timeline: Timeline, riskRegister: RiskRegister): Promise<StageGates> {
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

  private async generateKPIs(insights: StrategyInsights, benefitsRealization: BenefitsRealization): Promise<KPIs> {
    const kpis = benefitsRealization.benefits.map((benefit, idx) => {
      // Map benefit category to KPI category
      let kpiCategory: 'Financial' | 'Operational' | 'Strategic' | 'Customer' = 'Strategic';
      if (benefit.category === 'Financial') kpiCategory = 'Financial';
      else if (benefit.category === 'Operational') kpiCategory = 'Operational';
      else if (benefit.category === 'Strategic') kpiCategory = 'Strategic';
      
      return {
        id: `KPI${String(idx + 1).padStart(3, '0')}`,
        name: this.generateKPIName(benefit.description),
        category: kpiCategory,
        baseline: 'Current state',
        target: benefit.estimatedValue ? `+${benefit.estimatedValue.toLocaleString()}` : 'Improvement',
        measurement: benefit.measurement,
        frequency: benefit.category === 'Financial' ? 'Monthly' as const : 'Quarterly' as const,
        linkedBenefitIds: [benefit.id],
        confidence: benefit.confidence,
      };
    });

    // Add operational KPIs
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

  private async generateStakeholderMap(insights: StrategyInsights): Promise<StakeholderMap> {
    const stakeholderInsights = insights.insights.filter(i => i.type === 'stakeholder');
    
    const stakeholders = stakeholderInsights.map(insight => ({
      name: insight.content.split(':')[0] || 'Stakeholder',
      group: this.categorizeStakeholder(insight.content),
      power: this.assessStakeholderPower(insight) as any,
      interest: this.assessStakeholderInterest(insight) as any,
      engagement: `${this.assessStakeholderPower(insight)} power, ${this.assessStakeholderInterest(insight)} interest - ${this.getEngagementStrategy(insight)}`,
      communicationPlan: this.generateCommunicationPlan(insight),
    }));

    // Add default stakeholders
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

  private async generateGovernance(insights: StrategyInsights, stakeholderMap: StakeholderMap): Promise<Governance> {
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

  private async generateQAPlan(insights: StrategyInsights): Promise<QAPlan> {
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

  private async generateProcurement(insights: StrategyInsights, financialPlan: FinancialPlan): Promise<Procurement> {
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

  private async generateExitStrategy(insights: StrategyInsights, riskRegister: RiskRegister): Promise<ExitStrategy> {
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

  // ============================================================================
  // Helper Methods
  // ============================================================================

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

  private generateDefaultWorkstreams(count: number): Workstream[] {
    const defaults = [
      { name: 'Program Management', description: 'Overall program coordination, governance, and stakeholder management' },
      { name: 'Change Management', description: 'Organizational change, training, and adoption support' },
      { name: 'Quality Assurance', description: 'Quality reviews, testing, and validation' },
    ];

    return defaults.slice(0, count).map((def, idx) => ({
      id: `WS${String(idx + 100).padStart(3, '0')}`,
      name: def.name,
      description: def.description,
      deliverables: [],
      startMonth: 1,
      endMonth: 12,
      dependencies: [],
      confidence: 0.70,
    }));
  }

  private estimateEffort(deliverable: string): string {
    const words = deliverable.split(' ').length;
    if (words < 5) return '5-10 person-days';
    if (words < 10) return '10-20 person-days';
    return '20-40 person-days';
  }

  private categorizeBenefit(content: string): 'Financial' | 'Strategic' | 'Operational' | 'Risk Mitigation' {
    const lower = content.toLowerCase();
    if (lower.includes('revenue') || lower.includes('cost') || lower.includes('$')) return 'Financial';
    if (lower.includes('risk') || lower.includes('mitigate')) return 'Risk Mitigation';
    if (lower.includes('efficiency') || lower.includes('process')) return 'Operational';
    return 'Strategic';
  }

  private estimateBenefitValue(insight: StrategyInsight): number | undefined {
    // Extract dollar amounts from insight if present
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

  private categorizeRisk(insight: StrategyInsight): string {
    const lower = insight.content.toLowerCase();
    if (lower.includes('technology') || lower.includes('technical')) return 'Technical';
    if (lower.includes('market') || lower.includes('competitive')) return 'Market';
    if (lower.includes('resource') || lower.includes('team')) return 'Resource';
    if (lower.includes('regulatory') || lower.includes('compliance')) return 'Regulatory';
    return 'Strategic';
  }

  private estimateRiskProbability(insight: StrategyInsight): number {
    // Higher confidence = lower probability (known risks are often controllable)
    return Math.round((1 - insight.confidence) * 100);
  }

  private estimateRiskImpact(insight: StrategyInsight): 'Low' | 'Medium' | 'High' | 'Critical' {
    const lower = insight.content.toLowerCase();
    if (lower.includes('critical') || lower.includes('catastrophic')) return 'Critical';
    if (lower.includes('high') || lower.includes('significant')) return 'High';
    if (lower.includes('medium') || lower.includes('moderate')) return 'Medium';
    return 'Low';
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
    // Most stakeholders in strategic initiatives have high interest
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

  private generateKPIName(description: string): string {
    const words = description.split(' ').slice(0, 4).join(' ');
    return words.length > 40 ? words.substring(0, 37) + '...' : words;
  }

  private calculateOverallConfidence(confidences: number[]): number {
    // Weighted average with slight penalty for variance
    const avg = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const variance = confidences.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / confidences.length;
    return Math.max(0.5, avg - (variance * 0.1)); // Penalize high variance
  }

  private generateExtractionRationale(insights: StrategyInsights, userContext?: UserContext): string {
    const framework = insights.frameworkType.toUpperCase();
    const insightCount = insights.insights.length;
    
    return `
EPM Program generated from ${framework} framework analysis with ${insightCount} strategic insights.

EXTRACTION APPROACH:
- ${insights.insights.filter(i => i.type === 'workstream').length} workstreams extracted from framework activities/recommendations
- ${insights.insights.filter(i => i.type === 'risk').length} risks identified from framework analysis and contradictions
- ${insights.insights.filter(i => i.type === 'benefit').length} benefits mapped from strategic opportunities
- ${insights.insights.filter(i => i.type === 'stakeholder').length} stakeholders identified from framework segments
- Timeline inferred based on ${insights.marketContext.urgency} urgency
- Resource and financial plans estimated using industry benchmarks
- All 14 EPM components synthesized using documented ${framework}→EPM mappings

USER CONTEXT:
${userContext ? `
- Timeline urgency: ${insights.marketContext.urgency}
- Budget range: ${userContext.budgetRange ? `$${userContext.budgetRange.min.toLocaleString()} - $${userContext.budgetRange.max.toLocaleString()}` : 'Not specified'}
- Risk tolerance: ${userContext.riskTolerance || 'Not specified'}
` : 'No additional user context provided'}

CONFIDENCE ASSESSMENT:
Average confidence across components: ${Math.round(insights.overallConfidence * 100)}%
Confidence varies by component based on directness of extraction vs. AI inference.
`.trim();
  }

  /**
   * Generate intelligent program name from strategic context
   */
  private async generateProgramName(
    insights: StrategyInsights,
    userContext?: UserContext,
    namingContext?: any
  ): Promise<string> {
    try {
      // Import AI clients
      const { aiClients } = await import('../ai-clients.js');
      
      // Extract key context for naming
      const keyInsights = namingContext?.bmcKeyInsights || [];
      const recommendations = namingContext?.bmcRecommendations || [];
      const selectedDecisions = namingContext?.selectedDecisions || {};
      const decisionsData = namingContext?.decisionsData || {};
      const framework = namingContext?.framework || 'bmc';
      
      // Build context for AI
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
      
      // Include selected strategic decisions
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
      
      // Use AI to generate intelligent program name
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
      
      // Validate length
      if (programName && programName.length > 0 && programName.length <= 150) {
        return programName;
      }
      
      // Fallback if AI response is invalid
      return this.generateFallbackProgramName(selectedDecisions, decisionsData, framework);
      
    } catch (error) {
      console.error('[EPM-SYNTHESIZER] Program name generation failed:', error);
      // Fallback naming
      return this.generateFallbackProgramName(
        namingContext?.selectedDecisions,
        namingContext?.decisionsData,
        namingContext?.framework || 'bmc'
      );
    }
  }

  /**
   * Generate fallback program name from structured data
   */
  private generateFallbackProgramName(
    selectedDecisions: any,
    decisionsData: any,
    framework: string
  ): string {
    const parts: string[] = [];
    
    // Try to extract key decision labels
    if (decisionsData?.decisions && selectedDecisions) {
      decisionsData.decisions.slice(0, 2).forEach((decision: any) => {
        const selectedOptionId = selectedDecisions[decision.id];
        if (selectedOptionId) {
          const option = decision.options?.find((o: any) => o.id === selectedOptionId);
          if (option?.label) {
            parts.push(option.label);
          }
        }
      });
    }
    
    // Build name from parts
    if (parts.length > 0) {
      return `${parts.join(' + ')} Strategy (${framework.toUpperCase()})`;
    }
    
    // Ultimate fallback
    return `Strategic Initiative (${framework.toUpperCase()} Analysis)`;
  }
}
