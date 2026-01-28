import Anthropic from '@anthropic-ai/sdk';
import { strategyOntologyService } from '../ontology/strategy-ontology-service';
import type { StrategyAnalysis } from './strategy-analyzer';
import type { GeneratedDecisions } from './decision-generator';
import { ontologyService } from '../ontology-service';
import { qualityGateRunner } from '../intelligence/epm/validators/quality-gate-runner';
import type { 
  Workstream as ValidatorWorkstream, 
  Timeline as ValidatorTimeline, 
  StageGates as ValidatorStageGates, 
  StageGate as ValidatorStageGate, 
  Deliverable as ValidatorDeliverable 
} from '../intelligence/types';

export interface EPMProgram {
  title: string;
  description: string;
  objectives: string[];
  strategic_approach: string;
  market_context: string;
  cost_estimate: {
    total_min: number;
    total_max: number;
    currency: string;
  };
  timeline: {
    total_months: number;
    start_date?: string;
    end_date?: string;
  };
  workstreams: EPMWorkstream[];
  success_criteria: string[];
  key_risks: string[];
  stage_gates: StageGate[];
  kpis: KPI[];
  benefits: Benefit[];
  risks: Risk[];
  funding: FundingPlan;
  resources: ResourceRequirement[];
}

export interface StageGate {
  gate: string;
  name: string;
  criteria: string[];
  deliverables: string[];
}

export interface KPI {
  name: string;
  description: string;
  target: string;
  measurement_frequency: string;
  owner: string;
}

export interface Benefit {
  name: string;
  category: string;
  description: string;
  quantified_value: string;
  measurable_target: string;
  realization_timeline: string;
}

export interface Risk {
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation_strategy: string;
}

export interface FundingPlan {
  sources: FundingSource[];
  timeline: FundingTimeline[];
}

export interface FundingSource {
  source: string;
  amount: number;
  terms?: string;
}

export interface FundingTimeline {
  phase: string;
  amount: number;
  timing: string;
}

export interface ResourceRequirement {
  role: string;
  count: number;
  skillset: string[];
  duration_months: number;
}

export interface EPMWorkstream {
  id: string;
  title: string;
  description: string;
  strategic_purpose: string;
  cost_allocation: {
    min: number;
    max: number;
  };
  timeline_months: number;
  required_team: {
    role: string;
    count: number;
  }[];
  tasks: EPMTask[];
  confidence: number;
}

export interface EPMTask {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimated_hours: number;
  dependencies: string[];
  deliverables: string[];
}

export class EPMConverter {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  async convertToEPM(
    analysis: StrategyAnalysis,
    decisions: GeneratedDecisions,
    selectedDecisions: Record<string, string>
  ): Promise<EPMProgram> {
    const selectedApproach = this.extractSelectedApproach(analysis, selectedDecisions);
    const selectedMarket = this.normalizeMarket(analysis.recommended_market);

    const workstreams = strategyOntologyService.allocateWorkstreams(
      selectedApproach,
      selectedMarket
    );

    const costEstimate = strategyOntologyService.calculateCostEstimate(
      selectedApproach,
      selectedMarket
    );

    const programTitle = await this.generateProgramTitle(analysis, selectedApproach);
    const programDescription = await this.generateProgramDescription(
      analysis,
      selectedApproach,
      selectedMarket
    );

    const enrichedWorkstreams = await this.enrichWorkstreamsWithTasks(
      workstreams,
      analysis,
      selectedApproach,
      costEstimate
    );

    const objectives = this.extractObjectives(analysis);
    const successCriteria = this.extractSuccessCriteria(analysis);
    const keyRisks = this.extractKeyRisks(analysis);

    const [stageGates, kpis, benefits, risks, funding, resources] = await Promise.all([
      this.generateStageGates(analysis, selectedApproach),
      this.generateKPIs(analysis, objectives),
      this.generateBenefits(analysis, costEstimate),
      this.generateRisks(analysis),
      this.generateFundingPlan(costEstimate),
      this.generateResourceRequirements(workstreams, costEstimate),
    ]);

    // Note: Standard path uses integer headcounts (count), not FTE allocations.
    // FTE normalization is handled in the custom path (resource-allocator.ts)
    // where LLM returns percentage allocations that need conversion to decimals.
    console.log('[EPM Converter] Standard path conversion complete - headcount-based resources');

    const program = {
      title: programTitle,
      description: programDescription,
      objectives,
      strategic_approach: selectedApproach,
      market_context: selectedMarket,
      cost_estimate: {
        total_min: costEstimate?.min || 0,
        total_max: costEstimate?.max || 0,
        currency: 'USD',
      },
      timeline: {
        total_months: costEstimate?.timeline_months || 12,
      },
      workstreams: enrichedWorkstreams,
      success_criteria: successCriteria,
      key_risks: keyRisks,
      stage_gates: stageGates,
      kpis,
      benefits,
      risks,
      funding,
      resources,
    };

    // Run quality gate validation
    this.runQualityGateValidation(enrichedWorkstreams, stageGates, costEstimate?.timeline_months || 12);

    return program;
  }

  /**
   * Run quality gate validation on the EPM output
   * Maps EPM structures to validator types and runs quality checks
   */
  private runQualityGateValidation(
    epmWorkstreams: EPMWorkstream[],
    epmStageGates: StageGate[],
    totalMonths: number
  ): void {
    try {
      // Map EPMWorkstream to ValidatorWorkstream type expected by validators
      const validatorWorkstreams: ValidatorWorkstream[] = epmWorkstreams.map((ws, index) => ({
        id: ws.id,
        name: ws.title,
        description: ws.description,
        deliverables: ws.tasks.map((t, taskIndex): ValidatorDeliverable => ({
          id: t.id,
          name: t.title,
          description: t.description,
          dueMonth: Math.ceil((index + 1) * (totalMonths / epmWorkstreams.length)),
          effort: `${t.estimated_hours} hours`,
        })),
        owner: 'Program Manager',
        startMonth: index * 2, // Estimate based on position
        endMonth: Math.min((index + 1) * 3, totalMonths),
        dependencies: index > 0 ? [epmWorkstreams[index - 1].id] : [],
        confidence: ws.confidence,
      }));

      // Map to ValidatorTimeline
      const validatorTimeline: ValidatorTimeline = {
        totalMonths,
        phases: [{
          phase: 1,
          name: 'Execution',
          startMonth: 0,
          endMonth: totalMonths,
          description: 'Program execution phase',
          keyMilestones: epmStageGates.map(g => g.name),
          workstreamIds: validatorWorkstreams.map(w => w.id),
        }],
        criticalPath: validatorWorkstreams.map(w => w.id),
        confidence: 0.85,
      };

      // Map EPM StageGate to ValidatorStageGates
      const validatorStageGates: ValidatorStageGates = {
        gates: epmStageGates.map((g, idx): ValidatorStageGate => ({
          id: `gate-${idx + 1}`,
          name: g.name,
          month: (idx + 1) * Math.floor(totalMonths / (epmStageGates.length + 1)),
          criteria: g.criteria,
          deliverables: g.deliverables,
          approvers: ['Steering Committee'],
          confidence: 0.85,
        })),
        confidence: 0.85,
      };

      // Run quality gate
      const report = qualityGateRunner.runQualityGate(
        validatorWorkstreams,
        validatorTimeline,
        validatorStageGates,
        'Standard EPM conversion'
      );

      console.log('[EPM Converter] Quality gate report:', {
        passed: report.overallPassed,
        totalIssues: report.totalIssues,
        errors: report.errorCount,
        warnings: report.warningCount,
        corrections: report.corrections.length
      });
    } catch (error) {
      console.error('[EPM Converter] Quality gate validation error:', error);
      // Non-blocking - continue with EPM output even if validation fails
    }
  }

  private normalizeMarket(recommendedMarket: string | undefined | null): string {
    // Handle undefined/null values - default to 'usa'
    if (!recommendedMarket) {
      return 'usa';
    }
    
    const marketLower = recommendedMarket.toLowerCase();
    
    if (marketLower.includes('uae') || marketLower.includes('emirates') || marketLower.includes('dubai')) {
      return 'uae';
    }
    
    if (marketLower.includes('usa') || marketLower.includes('united states') || marketLower.includes('america')) {
      return 'usa';
    }
    
    return 'usa';
  }

  private extractSelectedApproach(
    analysis: StrategyAnalysis,
    selectedDecisions: Record<string, string>
  ): string {
    for (const [decisionId, optionId] of Object.entries(selectedDecisions)) {
      if (decisionId.includes('approach') || decisionId.includes('strategy')) {
        const option = optionId.toLowerCase();
        if (option.includes('cost') && option.includes('leadership')) {
          return 'cost_leadership';
        }
        if (option.includes('differentiation') || option.includes('service')) {
          return 'differentiation_service';
        }
        if (option.includes('blue') && option.includes('ocean')) {
          return 'blue_ocean';
        }
      }
    }

    return analysis.recommended_approaches[0] || 'cost_leadership';
  }

  private async generateProgramTitle(
    analysis: StrategyAnalysis,
    approach: string
  ): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: `Generate a concise, professional program title (max 8 words) for this strategic initiative:

ROOT CAUSE: ${analysis.five_whys.root_cause}
APPROACH: ${approach.replace('_', ' ')}
EXECUTIVE SUMMARY: ${analysis.executive_summary}

Return ONLY the title, nothing else.`,
        },
      ],
    });

    const title = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('');

    return title.trim().replace(/['"]/g, '');
  }

  private async generateProgramDescription(
    analysis: StrategyAnalysis,
    approach: string,
    market: string
  ): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: `Write a 2-3 paragraph program description for:

ROOT CAUSE: ${analysis.five_whys.root_cause}
STRATEGIC APPROACH: ${approach.replace('_', ' ')}
MARKET: ${market.toUpperCase()}
EXECUTIVE SUMMARY: ${analysis.executive_summary}

The description should explain:
1. What problem this program solves
2. How the strategic approach addresses it
3. Expected business impact

Return ONLY the description, nothing else.`,
        },
      ],
    });

    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('')
      .trim();
  }

  private async enrichWorkstreamsWithTasks(
    workstreams: Array<{ id: string; label: string; cost_allocation: number; team_size: number }>,
    analysis: StrategyAnalysis,
    approach: string,
    costEstimate: any
  ): Promise<EPMWorkstream[]> {
    const enrichedWorkstreams: EPMWorkstream[] = [];

    for (let i = 0; i < workstreams.length; i++) {
      const ws = workstreams[i];
      const tasks = await this.generateTasksForWorkstream(ws, analysis, approach);
      const confidence = this.calculateWorkstreamConfidence(i, workstreams.length, ws.label);

      enrichedWorkstreams.push({
        id: ws.id,
        title: ws.label,
        description: `Strategic workstream focused on ${ws.label.toLowerCase()} to support ${approach.replace('_', ' ')} approach`,
        strategic_purpose: `Deliver ${ws.label.toLowerCase()} capabilities required for strategy execution`,
        cost_allocation: {
          min: Math.round(ws.cost_allocation * 0.8),
          max: Math.round(ws.cost_allocation * 1.2),
        },
        timeline_months: costEstimate?.timeline_months || 12,
        required_team: this.estimateTeamSize(ws),
        tasks,
        confidence,
      });
    }

    return enrichedWorkstreams;
  }

  private async generateTasksForWorkstream(
    workstream: { id: string; label: string },
    analysis: StrategyAnalysis,
    approach: string
  ): Promise<EPMTask[]> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: `Generate 4-6 concrete tasks for the "${workstream.label}" workstream.

STRATEGIC CONTEXT:
- Approach: ${approach.replace('_', ' ')}
- Root Cause: ${analysis.five_whys.root_cause.substring(0, 200)}

Each task should be:
- Specific and actionable
- Include clear deliverables
- Have realistic hour estimates (20-160 hours)
- Marked with priority (critical/high/medium/low)

Return ONLY valid JSON (no markdown):

{
  "tasks": [
    {
      "id": "task_1",
      "title": "Task Title",
      "description": "Detailed description of what needs to be done",
      "priority": "high",
      "estimated_hours": 80,
      "dependencies": [],
      "deliverables": ["deliverable 1", "deliverable 2"]
    }
  ]
}`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return this.createDefaultTasks(workstream);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.tasks || this.createDefaultTasks(workstream);
    } catch {
      return this.createDefaultTasks(workstream);
    }
  }

  private createDefaultTasks(workstream: { id: string; label: string }): EPMTask[] {
    return [
      {
        id: `${workstream.id}_task_1`,
        title: `Initialize ${workstream.label}`,
        description: `Set up foundational elements for ${workstream.label} workstream`,
        priority: 'high',
        estimated_hours: 40,
        dependencies: [],
        deliverables: ['Setup complete', 'Initial documentation'],
      },
      {
        id: `${workstream.id}_task_2`,
        title: `Implement ${workstream.label} Core`,
        description: `Build core capabilities for ${workstream.label}`,
        priority: 'high',
        estimated_hours: 120,
        dependencies: [`${workstream.id}_task_1`],
        deliverables: ['Core implementation', 'Test results'],
      },
      {
        id: `${workstream.id}_task_3`,
        title: `Validate ${workstream.label}`,
        description: `Validate and refine ${workstream.label} deliverables`,
        priority: 'medium',
        estimated_hours: 60,
        dependencies: [`${workstream.id}_task_2`],
        deliverables: ['Validation report', 'Refinement plan'],
      },
    ];
  }

  private estimateTeamSize(workstream: { team_size: number }): Array<{ role: string; count: number }> {
    const teamSize = workstream.team_size;
    
    if (teamSize <= 2) {
      return [
        { role: 'Senior Specialist', count: 1 },
        { role: 'Specialist', count: 1 },
      ];
    } else if (teamSize <= 5) {
      return [
        { role: 'Team Lead', count: 1 },
        { role: 'Senior Specialist', count: 1 },
        { role: 'Specialist', count: teamSize - 2 },
      ];
    } else {
      return [
        { role: 'Workstream Manager', count: 1 },
        { role: 'Team Lead', count: 1 },
        { role: 'Senior Specialist', count: 2 },
        { role: 'Specialist', count: teamSize - 4 },
      ];
    }
  }

  /**
   * Calculate workstream confidence based on position and type.
   * Earlier workstreams (foundational) get higher confidence,
   * later workstreams (dependent on earlier work) get lower confidence.
   * Range: 0.60 - 0.90 with variation based on workstream characteristics.
   */
  private calculateWorkstreamConfidence(
    index: number,
    totalCount: number,
    label: string
  ): number {
    // Base confidence starts high for early workstreams, decreases for later ones
    // Position factor: 0.0 for first, 1.0 for last
    const positionFactor = totalCount > 1 ? index / (totalCount - 1) : 0;
    
    // Early workstreams: 0.85-0.90, Later workstreams: 0.60-0.70
    const baseConfidence = 0.90 - (positionFactor * 0.25);
    
    // Add keyword-based adjustment
    const labelLower = label.toLowerCase();
    let keywordAdjustment = 0;
    
    // Foundational/core workstreams get boost
    if (labelLower.includes('foundation') || labelLower.includes('core') || 
        labelLower.includes('infrastructure') || labelLower.includes('platform')) {
      keywordAdjustment = 0.05;
    }
    // Innovation/experimental workstreams get penalty
    else if (labelLower.includes('innovation') || labelLower.includes('experimental') ||
             labelLower.includes('pilot') || labelLower.includes('research')) {
      keywordAdjustment = -0.05;
    }
    // Market expansion gets slight penalty due to external dependencies
    else if (labelLower.includes('market') || labelLower.includes('expansion') ||
             labelLower.includes('international')) {
      keywordAdjustment = -0.03;
    }
    
    // Add small random variation for natural feel (±0.02)
    const variation = (Math.random() - 0.5) * 0.04;
    
    // Clamp to valid range [0.60, 0.90]
    const confidence = Math.max(0.60, Math.min(0.90, baseConfidence + keywordAdjustment + variation));
    
    // Round to 2 decimal places
    return Math.round(confidence * 100) / 100;
  }

  private extractObjectives(analysis: StrategyAnalysis): string[] {
    return analysis.five_whys.strategic_implications.slice(0, 3);
  }

  private extractSuccessCriteria(analysis: StrategyAnalysis): string[] {
    if (analysis.porters_five_forces?.key_strategic_priorities) {
      return analysis.porters_five_forces.key_strategic_priorities.map(
        (priority) => `Achieve measurable progress in: ${priority}`
      );
    }
    
    return [
      'Achieve product-market fit within first 6 months',
      'Establish sustainable revenue streams',
      'Build operational infrastructure for scale'
    ];
  }

  private extractKeyRisks(analysis: StrategyAnalysis): string[] {
    const risks: string[] = [];
    const forces = analysis.porters_five_forces;

    if (forces?.competitive_rivalry?.level === 'high') {
      risks.push(`High competitive rivalry: ${forces.competitive_rivalry.factors[0]}`);
    }
    if (forces?.threat_of_substitution?.level === 'high') {
      risks.push(`Substitution risk: ${forces.threat_of_substitution.factors[0]}`);
    }
    if (forces?.buyer_power?.level === 'high') {
      risks.push(`Buyer power pressure: ${forces.buyer_power.factors[0]}`);
    }

    return risks.length > 0 ? risks : ['Market dynamics may shift', 'Resource constraints', 'Execution challenges'];
  }

  private async generateStageGates(analysis: StrategyAnalysis, approach: string): Promise<StageGate[]> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `Generate 5 stage gates (G0-G4) for this strategic program:

APPROACH: ${approach.replace('_', ' ')}
ROOT CAUSE: ${analysis.five_whys.root_cause}

For each gate, provide:
- name: Clear gate name
- criteria: 3-5 specific pass/fail criteria
- deliverables: 3-5 required deliverables

Return ONLY valid JSON:

{
  "stage_gates": [
    {
      "gate": "G0",
      "name": "Program Initiation",
      "criteria": ["criterion 1", "criterion 2"],
      "deliverables": ["deliverable 1", "deliverable 2"]
    }
  ]
}`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.stage_gates || this.getDefaultStageGates();
      } catch {
        return this.getDefaultStageGates();
      }
    }
    return this.getDefaultStageGates();
  }

  private getDefaultStageGates(): StageGate[] {
    return [
      { gate: 'G0', name: 'Program Initiation', criteria: ['Business case approved', 'Resources allocated'], deliverables: ['Program charter', 'Initial plan'] },
      { gate: 'G1', name: 'Planning Complete', criteria: ['Detailed plan approved', 'Risks identified'], deliverables: ['Program plan', 'Risk register'] },
      { gate: 'G2', name: 'Design Complete', criteria: ['Solution designed', 'Architecture approved'], deliverables: ['Design documentation', 'Technical specifications'] },
      { gate: 'G3', name: 'Implementation Complete', criteria: ['All features delivered', 'Testing passed'], deliverables: ['Implemented solution', 'Test reports'] },
      { gate: 'G4', name: 'Program Closure', criteria: ['Benefits realized', 'Lessons captured'], deliverables: ['Final report', 'Lessons learned'] },
    ];
  }

  private async generateKPIs(analysis: StrategyAnalysis, objectives: string[]): Promise<KPI[]> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `Generate 5-7 KPIs aligned with these strategic objectives:

OBJECTIVES:
${objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

ROOT CAUSE: ${analysis.five_whys.root_cause}

Each KPI should have:
- name: Concise KPI name
- description: What it measures
- target: Specific measurable target
- measurement_frequency: How often measured
- owner: Who owns this KPI

Return ONLY valid JSON:

{
  "kpis": [
    {
      "name": "Revenue Growth",
      "description": "Year-over-year revenue increase",
      "target": "25% increase",
      "measurement_frequency": "Monthly",
      "owner": "CFO"
    }
  ]
}`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.kpis || this.getDefaultKPIs();
      } catch {
        return this.getDefaultKPIs();
      }
    }
    return this.getDefaultKPIs();
  }

  private getDefaultKPIs(): KPI[] {
    return [
      { name: 'Program ROI', description: 'Return on investment', target: '>200%', measurement_frequency: 'Quarterly', owner: 'Program Manager' },
      { name: 'Budget Variance', description: 'Actual vs planned spend', target: '<5%', measurement_frequency: 'Monthly', owner: 'Finance Lead' },
      { name: 'Milestone Achievement', description: 'On-time delivery rate', target: '>90%', measurement_frequency: 'Monthly', owner: 'Program Manager' },
    ];
  }

  private async generateBenefits(analysis: StrategyAnalysis, costEstimate: any): Promise<Benefit[]> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `Generate 4-6 quantified benefits for this program:

ROOT CAUSE: ${analysis.five_whys.root_cause}
EXECUTIVE SUMMARY: ${analysis.executive_summary}
PROGRAM INVESTMENT: $${costEstimate?.min?.toLocaleString() || '2M'} - $${costEstimate?.max?.toLocaleString() || '4M'}

Benefits should be:
- Name: Short benefit title (2-5 words)
- Category: Financial, Operational, Strategic, Customer, or Risk
- Description: Clear benefit statement
- Quantified value: Specific dollar or % value
- Measurable target: Specific measurable goal with baseline and target
- Realization timeline: When benefit will be realized

Return ONLY valid JSON:

{
  "benefits": [
    {
      "name": "Revenue Growth",
      "category": "Financial",
      "description": "Revenue increase from new market expansion",
      "quantified_value": "$5M annual recurring revenue",
      "measurable_target": "Increase annual revenue from $10M to $15M by Q4",
      "realization_timeline": "Month 12-18"
    }
  ]
}`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const rawBenefits = parsed.benefits || [];
        // Transform benefits to ensure all fields are present with measurable targets
        return this.transformBenefits(rawBenefits);
      } catch {
        return this.getDefaultBenefits();
      }
    }
    return this.getDefaultBenefits();
  }

  private getDefaultBenefits(): Benefit[] {
    return [
      { 
        name: 'Revenue Growth',
        category: 'Financial', 
        description: 'Revenue growth from strategic initiatives', 
        quantified_value: '+20% annual revenue',
        measurable_target: 'Increase annual revenue from baseline to +20% by end of program',
        realization_timeline: 'Month 12' 
      },
      { 
        name: 'Cost Optimization',
        category: 'Operational', 
        description: 'Operational efficiency improvement', 
        quantified_value: '15% cost reduction',
        measurable_target: 'Reduce operational costs by 15% from current baseline',
        realization_timeline: 'Month 6' 
      },
      { 
        name: 'Market Position',
        category: 'Strategic', 
        description: 'Enhanced competitive market position',
        quantified_value: 'Top 3 market position',
        measurable_target: 'Achieve top 3 market position in target segment by month 18',
        realization_timeline: 'Month 18' 
      },
    ];
  }

  /**
   * Transform raw benefits to ensure all have name and measurable_target fields.
   * Uses keyword-based target generation when targets are missing.
   */
  private transformBenefits(rawBenefits: any[]): Benefit[] {
    return rawBenefits.map((benefit, index) => {
      const description = benefit.description || '';
      const category = benefit.category || 'Strategic';
      
      // Generate name if missing
      const name = benefit.name || this.generateBenefitName(description, category, index);
      
      // Generate measurable target if missing
      const measurableTarget = benefit.measurable_target || 
        this.generateMeasurableTarget(description, category, benefit.quantified_value);
      
      // Ensure quantified_value is present
      const quantifiedValue = benefit.quantified_value || 
        this.generateQuantifiedValue(description, category);
      
      return {
        name,
        category,
        description,
        quantified_value: quantifiedValue,
        measurable_target: measurableTarget,
        realization_timeline: benefit.realization_timeline || 'Month 12',
      };
    });
  }

  /**
   * Generate a benefit name from description
   */
  private generateBenefitName(description: string, category: string, index: number): string {
    const descLower = description.toLowerCase();
    
    if (descLower.includes('revenue')) return 'Revenue Growth';
    if (descLower.includes('cost') || descLower.includes('efficiency')) return 'Cost Optimization';
    if (descLower.includes('customer') || descLower.includes('satisfaction')) return 'Customer Experience';
    if (descLower.includes('market') || descLower.includes('share')) return 'Market Position';
    if (descLower.includes('risk')) return 'Risk Reduction';
    if (descLower.includes('time') || descLower.includes('speed')) return 'Time-to-Value';
    if (descLower.includes('quality')) return 'Quality Improvement';
    
    return `${category} Benefit ${index + 1}`;
  }

  /**
   * Generate measurable target based on keyword analysis
   */
  private generateMeasurableTarget(description: string, category: string, quantifiedValue?: string): string {
    const descLower = description.toLowerCase();
    
    // Revenue-related benefits
    if (descLower.includes('revenue')) {
      return `Achieve ${quantifiedValue || '+20%'} revenue increase from baseline by program completion`;
    }
    
    // Cost-related benefits
    if (descLower.includes('cost') || descLower.includes('efficiency') || descLower.includes('reduction')) {
      return `Reduce operational costs by ${quantifiedValue || '15%'} from current baseline`;
    }
    
    // Customer-related benefits
    if (descLower.includes('customer') || descLower.includes('satisfaction') || descLower.includes('experience')) {
      return `Improve customer satisfaction score from current baseline to ${quantifiedValue || '+15 points NPS'}`;
    }
    
    // Market-related benefits
    if (descLower.includes('market') || descLower.includes('share') || descLower.includes('position')) {
      return `Capture ${quantifiedValue || '10%'} additional market share in target segment`;
    }
    
    // Time-related benefits
    if (descLower.includes('time') || descLower.includes('speed') || descLower.includes('faster')) {
      return `Reduce time-to-market by ${quantifiedValue || '30%'} compared to current process`;
    }
    
    // Risk-related benefits
    if (descLower.includes('risk')) {
      return `Reduce identified risk exposure by ${quantifiedValue || '40%'} through mitigation measures`;
    }
    
    // Quality-related benefits
    if (descLower.includes('quality')) {
      return `Improve quality metrics by ${quantifiedValue || '25%'} from baseline`;
    }
    
    // Default based on category
    const categoryTargets: Record<string, string> = {
      'Financial': `Achieve ${quantifiedValue || '20%'} improvement in financial metrics by program end`,
      'Operational': `Improve operational efficiency by ${quantifiedValue || '25%'} from baseline`,
      'Strategic': `Achieve strategic milestone with ${quantifiedValue || 'measurable'} impact`,
      'Customer': `Improve customer metrics by ${quantifiedValue || '15%'} from baseline`,
      'Risk': `Reduce risk exposure by ${quantifiedValue || '30%'} through program initiatives`,
    };
    
    return categoryTargets[category] || `Achieve ${quantifiedValue || 'target'} improvement by program completion`;
  }

  /**
   * Generate quantified value based on keyword analysis
   */
  private generateQuantifiedValue(description: string, category: string): string {
    const descLower = description.toLowerCase();
    
    if (descLower.includes('revenue')) return '+20% annual revenue';
    if (descLower.includes('cost')) return '15% cost reduction';
    if (descLower.includes('customer')) return '+15 points NPS';
    if (descLower.includes('market')) return '10% market share gain';
    if (descLower.includes('time')) return '30% faster delivery';
    if (descLower.includes('risk')) return '40% risk reduction';
    if (descLower.includes('quality')) return '25% quality improvement';
    
    const categoryDefaults: Record<string, string> = {
      'Financial': '20% financial improvement',
      'Operational': '25% efficiency gain',
      'Strategic': 'Strategic milestone achievement',
      'Customer': '15% customer satisfaction increase',
      'Risk': '30% risk mitigation',
    };
    
    return categoryDefaults[category] || 'Measurable improvement';
  }

  private async generateRisks(analysis: StrategyAnalysis): Promise<Risk[]> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `Generate 5-7 program risks with mitigation strategies:

PORTER'S FIVE FORCES:
- Competitive Rivalry: ${analysis.porters_five_forces.competitive_rivalry.level}
- Buyer Power: ${analysis.porters_five_forces.buyer_power.level}
- Supplier Power: ${analysis.porters_five_forces.supplier_power.level}

ROOT CAUSE: ${analysis.five_whys.root_cause}

For each risk:
- description: Clear risk description
- likelihood: low/medium/high
- impact: low/medium/high
- mitigation_strategy: Specific mitigation approach

Return ONLY valid JSON:

{
  "risks": [
    {
      "description": "Market conditions change unexpectedly",
      "likelihood": "medium",
      "impact": "high",
      "mitigation_strategy": "Quarterly market reviews and adaptive planning"
    }
  ]
}`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.risks || this.getDefaultRisks();
      } catch {
        return this.getDefaultRisks();
      }
    }
    return this.getDefaultRisks();
  }

  private getDefaultRisks(): Risk[] {
    return [
      { description: 'Resource availability', likelihood: 'medium', impact: 'high', mitigation_strategy: 'Maintain backup resource pool' },
      { description: 'Technical complexity', likelihood: 'medium', impact: 'medium', mitigation_strategy: 'Phased implementation approach' },
      { description: 'Market dynamics shift', likelihood: 'low', impact: 'high', mitigation_strategy: 'Regular market monitoring' },
    ];
  }

  private async generateFundingPlan(costEstimate: any): Promise<FundingPlan> {
    const totalCost = costEstimate?.max || 2000000;
    const timeline = costEstimate?.timeline_months || 12;

    return {
      sources: [
        { source: 'Operating Budget', amount: Math.floor(totalCost * 0.6) },
        { source: 'Capital Investment', amount: Math.floor(totalCost * 0.4) },
      ],
      timeline: [
        { phase: 'Initiation', amount: Math.floor(totalCost * 0.2), timing: 'Month 1' },
        { phase: 'Execution', amount: Math.floor(totalCost * 0.6), timing: `Months 2-${Math.floor(timeline * 0.8)}` },
        { phase: 'Closure', amount: Math.floor(totalCost * 0.2), timing: `Month ${timeline}` },
      ],
    };
  }

  private async generateResourceRequirements(
    workstreams: Array<{ id: string; label: string; cost_allocation: number; team_size: number }>,
    costEstimate: any
  ): Promise<ResourceRequirement[]> {
    const resources: ResourceRequirement[] = [
      {
        role: 'Program Manager',
        count: 1,
        skillset: ['Program management', 'Stakeholder engagement', 'Risk management'],
        duration_months: costEstimate?.timeline_months || 12,
      },
    ];

    const totalTeamSize = workstreams.reduce((sum, ws) => sum + ws.team_size, 0);
    
    if (totalTeamSize > 10) {
      resources.push({
        role: 'Workstream Leads',
        count: workstreams.length,
        skillset: ['Domain expertise', 'Team leadership', 'Delivery management'],
        duration_months: costEstimate?.timeline_months || 12,
      });
    }

    resources.push({
      role: 'Specialists',
      count: Math.max(totalTeamSize - workstreams.length - 1, 5),
      skillset: ['Technical delivery', 'Subject matter expertise'],
      duration_months: costEstimate?.timeline_months || 12,
    });

    return resources;
  }

  async validateEPMStructure(program: EPMProgram): Promise<{
    valid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!program.title || program.title.length < 5) {
      issues.push('Program title must be at least 5 characters');
    }

    if (!program.description || program.description.length < 50) {
      issues.push('Program description must be at least 50 characters');
    }

    if (program.objectives.length === 0) {
      issues.push('Program must have at least one objective');
    }

    if (program.workstreams.length === 0) {
      issues.push('Program must have at least one workstream');
    }

    for (const ws of program.workstreams) {
      if (ws.tasks.length === 0) {
        warnings.push(`Workstream "${ws.title}" has no tasks`);
      }

      if (ws.cost_allocation.min <= 0 || ws.cost_allocation.max <= 0) {
        warnings.push(`Workstream "${ws.title}" has invalid cost allocation`);
      }
    }

    if (program.cost_estimate.total_min > program.cost_estimate.total_max) {
      issues.push('Min cost cannot exceed max cost');
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
    };
  }

  async validateAgainstOntology(program: EPMProgram): Promise<{
    valid: boolean;
    validation: any;
    completeness: any;
    recommendations: string[];
  }> {
    const programData = {
      title: program.title,
      description: program.description,
      objectives: program.objectives,
      budget: program.cost_estimate.total_max,
      timelineDays: program.timeline.total_months * 30,
      status: 'planning',
      successCriteria: program.success_criteria,
      workstreams: program.workstreams,
      stage_gates: program.stage_gates,
      kpis: program.kpis,
      benefits: program.benefits,
      risks: program.risks,
      funding: program.funding,
      resources: program.resources,
    };

    const [validation, baseCompleteness] = await Promise.all([
      ontologyService.validateEntityData('Program', programData),
      ontologyService.checkCompleteness('Program', programData),
    ]);

    const criticalChecks = {
      passed: 0,
      total: 4,
      fields: [
        { check: program.workstreams.length > 0, description: 'Programs must have defined work (tasks or workstreams)' },
        { check: program.stage_gates.length >= 5, description: 'Programs must have all standard stage gates (G0-G4)' },
        { check: program.benefits.length > 0, description: 'Programs must define expected benefits' },
        { check: program.funding.sources.length > 0, description: 'Programs must have identified funding sources' },
      ]
    };

    const importantChecks = {
      passed: 0,
      total: 3,
      fields: [
        { check: program.kpis.length >= 3 && program.kpis.length <= 7, description: 'Programs should have 3-7 KPIs to measure success' },
        { check: program.risks.length > 0, description: 'Programs should conduct risk assessment' },
        { check: program.resources.length > 0, description: 'Programs should have allocated resources' },
      ]
    };

    criticalChecks.passed = criticalChecks.fields.filter(f => f.check).length;
    importantChecks.passed = importantChecks.fields.filter(f => f.check).length;

    const totalScore = (criticalChecks.passed * 3) + (importantChecks.passed * 2);
    const maxScore = (criticalChecks.total * 3) + (importantChecks.total * 2);

    const missingFields = [
      ...criticalChecks.fields.filter(f => !f.check).map(f => ({ importance: 'critical', description: f.description })),
      ...importantChecks.fields.filter(f => !f.check).map(f => ({ importance: 'important', description: f.description })),
    ];

    const completeness = {
      score: totalScore,
      maxScore: maxScore,
      critical: {
        passed: criticalChecks.passed,
        total: criticalChecks.total,
      },
      important: {
        passed: importantChecks.passed,
        total: importantChecks.total,
      },
      niceToHave: {
        passed: 0,
        total: 0,
      },
      missingFields,
    };

    const recommendations: string[] = [];

    const completenessPercentage = maxScore > 0 
      ? Math.round((totalScore / maxScore) * 100) 
      : 0;

    if (completenessPercentage < 100) {
      recommendations.push(`Consider adding more detail to improve completeness (currently ${completenessPercentage}%)`);
    }

    if (missingFields.length > 0) {
      const critical = missingFields.filter((f: any) => f.importance === 'critical');
      if (critical.length > 0) {
        recommendations.push(`Add critical fields: ${critical.map((f: any) => f.description.split(' ')[3] || '').join(', ')}`);
      }
    }

    if (validation.warnings && validation.warnings.length > 0) {
      validation.warnings.forEach((w: any) => {
        recommendations.push(`Warning: ${w.message}`);
      });
    }

    return {
      valid: validation.isValid && criticalChecks.passed === criticalChecks.total,
      validation,
      completeness,
      recommendations,
    };
  }
}
