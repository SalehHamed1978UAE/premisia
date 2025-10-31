import { storage } from '../storage';
import type { EPMProgram } from './epm-converter';

export class EPMIntegrator {
  /**
   * Integrates a Strategic Consultant EPM program into the main EPM suite database.
   * Creates actual database records for programs, workstreams, tasks, stage gates, KPIs, benefits, risks, and resources.
   */
  async integrateToEPMSuite(
    epmProgram: EPMProgram,
    userId: string,
    sessionId: string,
    versionId: string
  ): Promise<{ programId: string; summary: IntegrationSummary }> {
    console.log(`[EPMIntegrator] Starting integration for session ${sessionId}`);
    
    const summary: IntegrationSummary = {
      programId: '',
      workstreamsCreated: 0,
      tasksCreated: 0,
      stageGatesCreated: 0,
      kpisCreated: 0,
      benefitsCreated: 0,
      risksCreated: 0,
      fundingSourcesCreated: 0,
      resourcesCreated: 0,
    };

    try {
      // 1. Create Program
      const program = await this.createProgram(epmProgram, userId);
      summary.programId = program.id;
      console.log(`[EPMIntegrator] Created program: ${program.id}`);

      // 2. Create Workstreams and Tasks
      const workstreamMap = await this.createWorkstreamsAndTasks(
        epmProgram,
        program.id
      );
      summary.workstreamsCreated = workstreamMap.size;
      summary.tasksCreated = Array.from(workstreamMap.values())
        .reduce((total, tasks) => total + tasks.length, 0);
      console.log(`[EPMIntegrator] Created ${summary.workstreamsCreated} workstreams with ${summary.tasksCreated} tasks`);

      // 3. Create Stage Gates
      summary.stageGatesCreated = await this.createStageGates(
        epmProgram,
        program.id
      );
      console.log(`[EPMIntegrator] Created ${summary.stageGatesCreated} stage gates`);

      // 4. Create KPIs
      summary.kpisCreated = await this.createKPIs(
        epmProgram,
        program.id
      );
      console.log(`[EPMIntegrator] Created ${summary.kpisCreated} KPIs`);

      // 5. Create Benefits
      summary.benefitsCreated = await this.createBenefits(
        epmProgram,
        program.id
      );
      console.log(`[EPMIntegrator] Created ${summary.benefitsCreated} benefits`);

      // 6. Create Risks
      summary.risksCreated = await this.createRisks(
        epmProgram,
        program.id
      );
      console.log(`[EPMIntegrator] Created ${summary.risksCreated} risks`);

      // 7. Create Funding Sources
      summary.fundingSourcesCreated = await this.createFundingSources(
        epmProgram,
        program.id
      );
      console.log(`[EPMIntegrator] Created ${summary.fundingSourcesCreated} funding sources`);

      // 8. Create Resources
      summary.resourcesCreated = await this.createResources(
        epmProgram,
        program.id,
        userId
      );
      console.log(`[EPMIntegrator] Created ${summary.resourcesCreated} resources`);

      console.log(`[EPMIntegrator] Integration complete for program ${program.id}`);
      return { programId: program.id, summary };
    } catch (error) {
      console.error('[EPMIntegrator] Integration failed:', error);
      throw error;
    }
  }

  private async createProgram(
    epmProgram: EPMProgram,
    userId: string
  ): Promise<{ id: string }> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + epmProgram.timeline.total_months);

    const programData = {
      name: epmProgram.title,
      description: epmProgram.description,
      status: 'Planning',
      startDate,
      endDate,
      ownerId: userId,
    };

    return await storage.createProgram(programData);
  }

  private async createWorkstreamsAndTasks(
    epmProgram: EPMProgram,
    programId: string
  ): Promise<Map<string, string[]>> {
    const workstreamMap = new Map<string, string[]>();

    for (const ws of epmProgram.workstreams) {
      const workstreamData = {
        programId,
        name: ws.title,
        description: ws.description,
      };

      const workstream = await storage.createWorkstream(workstreamData);
      const taskIds: string[] = [];

      // Create tasks for this workstream
      for (const task of ws.tasks) {
        const taskData = {
          workstreamId: workstream.id,
          name: task.title,
          description: task.description,
          status: 'Not Started' as const,
          priority: this.normalizePriority(task.priority),
          progress: 0,
        };

        const createdTask = await storage.createTask(taskData);
        taskIds.push(createdTask.id);
      }

      workstreamMap.set(workstream.id, taskIds);
    }

    return workstreamMap;
  }

  private async createStageGates(
    epmProgram: EPMProgram,
    programId: string
  ): Promise<number> {
    let count = 0;

    for (const sg of epmProgram.stage_gates) {
      const stageGateData = {
        programId,
        code: sg.gate,
        name: sg.name,
        description: sg.criteria.join(', '),
        successCriteria: sg.deliverables.join('; '),
      };

      await storage.createStageGate(stageGateData);
      count++;
    }

    return count;
  }

  private async createKPIs(
    epmProgram: EPMProgram,
    programId: string
  ): Promise<number> {
    let count = 0;

    for (const kpi of epmProgram.kpis) {
      const kpiData = {
        programId,
        name: kpi.name,
        description: kpi.description,
        targetValue: this.extractNumericTarget(kpi.target),
        currentValue: '0',
        unit: this.extractUnit(kpi.target),
        frequency: kpi.measurement_frequency,
      };

      await storage.createKpi(kpiData);
      count++;
    }

    return count;
  }

  private async createBenefits(
    epmProgram: EPMProgram,
    programId: string
  ): Promise<number> {
    let count = 0;

    for (const benefit of epmProgram.benefits) {
      const benefitData = {
        programId,
        name: benefit.category,
        description: benefit.description,
        category: benefit.category,
        targetValue: benefit.quantified_value ? this.extractNumericValue(benefit.quantified_value) : '0',
        realizedValue: '0',
        unit: benefit.quantified_value ? this.extractUnit(benefit.quantified_value) : '$',
        status: 'Not Started' as const,
        realizationDate: this.parseRealizationDate(benefit.realization_timeline),
      };

      await storage.createBenefit(benefitData);
      count++;
    }

    return count;
  }

  private async createRisks(
    epmProgram: EPMProgram,
    programId: string
  ): Promise<number> {
    let count = 0;

    for (let i = 0; i < epmProgram.risks.length; i++) {
      const risk = epmProgram.risks[i];
      const riskData = {
        programId,
        riskId: `R-${String(i + 1).padStart(3, '0')}`,
        description: risk.description,
        category: 'Strategic',
        likelihood: this.normalizeLikelihood(risk.likelihood),
        impact: this.normalizeImpact(risk.impact),
        priority: this.calculateRiskPriority(risk.likelihood, risk.impact),
        mitigationPlan: risk.mitigation_strategy,
        status: 'Open' as const,
      };

      await storage.createRisk(riskData);
      count++;
    }

    return count;
  }

  private async createFundingSources(
    epmProgram: EPMProgram,
    programId: string
  ): Promise<number> {
    let count = 0;

    for (const source of epmProgram.funding.sources) {
      const fundingData = {
        programId,
        sourceName: source.source,
        allocatedAmount: source.amount, // Keep as number
        dateReceived: new Date(),
      };

      await storage.createFundingSource(fundingData);
      count++;
    }

    return count;
  }

  private async createResources(
    epmProgram: EPMProgram,
    programId: string,
    userId: string
  ): Promise<number> {
    let count = 0;

    for (const resource of epmProgram.resources) {
      for (let i = 0; i < resource.count; i++) {
        const resourceData = {
          programId,
          name: `${resource.role} ${i + 1}`,
          role: resource.role,
          department: resource.skillset.join(', '),
          email: null,
          userId: null,
        };

        await storage.createResource(resourceData);
        count++;
      }
    }

    return count;
  }

  private normalizePriority(priority: string): string {
    const map: Record<string, string> = {
      'critical': 'High',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low',
    };
    return map[priority.toLowerCase()] || 'Medium';
  }

  private normalizeLikelihood(likelihood: string): 'Rare' | 'Unlikely' | 'Possible' | 'Likely' | 'Certain' {
    const map: Record<string, 'Rare' | 'Unlikely' | 'Possible' | 'Likely' | 'Certain'> = {
      'low': 'Unlikely',
      'medium': 'Possible',
      'high': 'Likely',
    };
    return map[likelihood.toLowerCase()] || 'Possible';
  }

  private normalizeImpact(impact: string): 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High' {
    const map: Record<string, 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High'> = {
      'low': 'Low',
      'medium': 'Medium',
      'high': 'High',
    };
    return map[impact.toLowerCase()] || 'Medium';
  }

  private calculateRiskPriority(likelihood: string, impact: string): 'Low' | 'Medium' | 'High' | 'Critical' {
    if (likelihood === 'high' && impact === 'high') return 'Critical';
    if (likelihood === 'high' || impact === 'high') return 'High';
    if (likelihood === 'medium' && impact === 'medium') return 'Medium';
    return 'Low';
  }

  private extractNumericTarget(target: string): string {
    const match = target.match(/[\d.]+/);
    return match ? match[0] : '0';
  }

  private extractNumericValue(value: string): string {
    const match = value.match(/[\d.]+/);
    return match ? match[0] : '0';
  }

  private extractUnit(target: string): string {
    if (target.includes('%')) return '%';
    if (target.includes('$') || target.includes('M') || target.includes('USD')) return '$';
    if (target.includes('hours')) return 'hours';
    if (target.includes('days')) return 'days';
    return 'count';
  }

  private parseRealizationDate(timeline: string): Date {
    const match = timeline.match(/\d+/);
    const months = match ? parseInt(match[0]) : 12;
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return date;
  }
}

export interface IntegrationSummary {
  programId: string;
  workstreamsCreated: number;
  tasksCreated: number;
  stageGatesCreated: number;
  kpisCreated: number;
  benefitsCreated: number;
  risksCreated: number;
  fundingSourcesCreated: number;
  resourcesCreated: number;
}

export const epmIntegrator = new EPMIntegrator();
