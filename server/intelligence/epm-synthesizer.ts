/**
 * EPM Synthesizer
 * 
 * Converts normalized StrategyInsights into complete, validated EPM programs
 * with all 14 required components.
 * 
 * This is the core engine that ensures EVERY strategic journey produces
 * a complete, executable EPM program regardless of framework used.
 * 
 * ARCHITECTURE: This is the main orchestrator that delegates to specialized submodules:
 * - ContextBuilder: Infers business context from insights
 * - WorkstreamGenerator: Creates workstreams using WBS Builder
 * - TimelineCalculator: Generates timelines and phases
 * - ResourceAllocator: Handles resource planning with LLM support
 * - EPMValidator: Validates and auto-corrects EPM data
 * - Various generators for EPM components
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
import { replaceTimelineGeneration } from '../../src/lib/intelligent-planning/epm-integration';
import type { PlanningContext, BusinessScale } from '../../src/lib/intelligent-planning/types';
import { aiClients } from '../ai-clients';

import {
  ContextBuilder,
  EPMValidator,
  TimelineCalculator,
  WorkstreamGenerator,
  ResourceAllocator,
  AssignmentGenerator,
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
} from './epm';

export { ContextBuilder } from './epm';

/**
 * Core EPM synthesis options
 */
interface SynthesisOptions {
  forceIntelligentPlanning?: boolean;
  onProgress?: (event: any) => void;
  initiativeType?: string;
}

/**
 * Main EPM Synthesizer class
 * Orchestrates all submodule components to generate complete EPM programs
 */
export class EPMSynthesizer {
  private llm: any;
  
  private workstreamGenerator: WorkstreamGenerator;
  private timelineCalculator: TimelineCalculator;
  private resourceAllocator: ResourceAllocator;
  private validator: EPMValidator;
  
  private executiveSummaryGenerator: ExecutiveSummaryGenerator;
  private financialPlanGenerator: FinancialPlanGenerator;
  private benefitsGenerator: BenefitsGenerator;
  private riskGenerator: RiskGenerator;
  private stageGateGenerator: StageGateGenerator;
  private kpiGenerator: KPIGenerator;
  private stakeholderGenerator: StakeholderGenerator;
  private governanceGenerator: GovernanceGenerator;
  private qaPlanGenerator: QAPlanGenerator;
  private procurementGenerator: ProcurementGenerator;
  private exitStrategyGenerator: ExitStrategyGenerator;
  private programNameGenerator: ProgramNameGenerator;
  private assignmentGenerator: AssignmentGenerator;

  constructor(llm?: any) {
    // Note: llm should implement ILLMProvider with generateStructured method
    // for WBS Builder. If null, WorkstreamGenerator will use fallback mode.
    // aiClients is kept for other AI operations that don't need generateStructured.
    this.llm = llm;
    
    this.workstreamGenerator = new WorkstreamGenerator(this.llm);
    this.timelineCalculator = new TimelineCalculator();
    this.resourceAllocator = new ResourceAllocator();
    this.validator = new EPMValidator();
    
    this.executiveSummaryGenerator = new ExecutiveSummaryGenerator();
    this.financialPlanGenerator = new FinancialPlanGenerator();
    this.benefitsGenerator = new BenefitsGenerator();
    this.riskGenerator = new RiskGenerator();
    this.stageGateGenerator = new StageGateGenerator();
    this.kpiGenerator = new KPIGenerator();
    this.stakeholderGenerator = new StakeholderGenerator();
    this.governanceGenerator = new GovernanceGenerator();
    this.qaPlanGenerator = new QAPlanGenerator();
    this.procurementGenerator = new ProcurementGenerator();
    this.exitStrategyGenerator = new ExitStrategyGenerator();
    this.programNameGenerator = new ProgramNameGenerator();
    this.assignmentGenerator = new AssignmentGenerator();
  }

  /**
   * Generate task assignments from an EPM program
   * Maps resources to deliverables across workstreams
   */
  async generateAssignments(epmProgram: EPMProgram, programId: string): Promise<any[]> {
    return this.assignmentGenerator.generate(epmProgram, programId);
  }

  /**
   * Main entry point: Synthesize complete EPM program from strategic insights
   * 
   * This method orchestrates all components to produce a complete, validated
   * EPM program with all 14 required components.
   */
  async synthesize(
    insights: StrategyInsights,
    userContext?: UserContext,
    namingContext?: any,
    options?: SynthesisOptions
  ): Promise<EPMProgram> {
    const startTime = Date.now();
    const onProgress = options?.onProgress;
    
    console.log('\n' + '='.repeat(80));
    console.log('[EPM Synthesis] 🚀 STARTING EPM PROGRAM SYNTHESIS');
    console.log('='.repeat(80));
    console.log('[EPM Synthesis] Framework type:', insights.frameworkType);
    console.log('[EPM Synthesis] Insights count:', insights.insights.length);
    console.log('[EPM Synthesis] Session ID:', userContext?.sessionId || 'N/A');
    
    onProgress?.({
      type: 'step-start',
      step: 'init',
      description: 'Initializing EPM synthesis',
      elapsedSeconds: 0
    });

    try {
      const program = await this.buildWithIntelligentPlanning(
        insights,
        userContext,
        namingContext,
        onProgress,
        startTime
      );
      
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      console.log(`[EPM Synthesis] ✅ Complete in ${elapsedSeconds}s`);
      
      onProgress?.({
        type: 'complete',
        description: 'EPM synthesis complete',
        elapsedSeconds
      });
      
      return program;
    } catch (error) {
      console.error('[EPM Synthesis] ❌ Synthesis failed:', error);
      
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      onProgress?.({
        type: 'error',
        description: 'EPM synthesis failed',
        error: error instanceof Error ? error.message : String(error),
        elapsedSeconds
      });
      
      return this.buildWithOldSystem(insights, userContext, namingContext);
    }
  }

  /**
   * Build EPM using intelligent planning (primary path)
   */
  private async buildWithIntelligentPlanning(
    insights: StrategyInsights,
    userContext?: UserContext,
    namingContext?: any,
    onProgress?: (event: any) => void,
    startTime?: number
  ): Promise<EPMProgram> {
    const processStartTime = startTime || Date.now();
    
    onProgress?.({
      type: 'step-start',
      step: 'workstreams',
      description: 'Generating intelligent workstreams',
      elapsedSeconds: Math.round((Date.now() - processStartTime) / 1000)
    });
    
    const workstreams = await this.workstreamGenerator.generate(
      insights,
      userContext,
      onProgress,
      processStartTime
    );
    
    console.log(`[EPM Synthesis] ✓ Generated ${workstreams.length} workstreams`);
    
    onProgress?.({
      type: 'step-start',
      step: 'planning-context',
      description: 'Building planning context',
      elapsedSeconds: Math.round((Date.now() - processStartTime) / 1000)
    });
    
    const planningContext = await ContextBuilder.fromJourneyInsights(
      insights,
      insights.frameworkType || 'strategy_workspace',
      userContext?.sessionId
    );
    
    console.log(`[EPM Synthesis] ✓ Planning context: Scale=${planningContext.business.scale}, Timeline=${planningContext.execution.timeline.min}-${planningContext.execution.timeline.max}mo`);
    
    onProgress?.({
      type: 'step-start',
      step: 'intelligent-planning',
      description: 'Applying intelligent timeline planning',
      elapsedSeconds: Math.round((Date.now() - processStartTime) / 1000)
    });
    
    const planningResult = await replaceTimelineGeneration(
      workstreams,
      planningContext
    );
    
    if (planningResult.success && planningResult.confidence >= 0.6) {
      console.log('[EPM Synthesis] ✓ Intelligent planning successful');
      console.log(`[EPM Synthesis]   Confidence: ${(planningResult.confidence * 100).toFixed(1)}%`);
      
      const scheduledWorkstreams = planningResult.workstreams || workstreams;
      
      return await this.buildFullProgram(
        insights,
        scheduledWorkstreams,
        planningContext,
        userContext,
        namingContext,
        onProgress,
        processStartTime
      );
    } else {
      console.warn('[EPM Synthesis] ⚠️ Intelligent planning unsuccessful, falling back to old system');
      console.log('[EPM Synthesis] Planning result details:');
      console.log('  - Success:', planningResult.success);
      console.log('  - Confidence:', planningResult.confidence);
      console.log('  - Warnings count:', planningResult.warnings?.length || 0);
      console.log('  - Adjustments count:', planningResult.adjustments?.length || 0);
      
      if (planningResult.adjustments && planningResult.adjustments.length > 0) {
        console.log('[EPM Synthesis] Adjustments needed:');
        planningResult.adjustments.forEach((adj, i) => {
          console.log(`    ${i + 1}. ${adj}`);
        });
      }
      
      return await this.buildWithOldSystem(insights, userContext, namingContext);
    }
  }

  /**
   * Build full EPM program with all 14 components
   */
  private async buildFullProgram(
    insights: StrategyInsights,
    workstreams: Workstream[],
    planningContext: PlanningContext,
    userContext?: UserContext,
    namingContext?: any,
    onProgress?: (event: any) => void,
    startTime?: number
  ): Promise<EPMProgram> {
    const processStartTime = startTime || Date.now();
    
    onProgress?.({
      type: 'step-start',
      step: 'program-name',
      description: 'Generating program name',
      elapsedSeconds: Math.round((Date.now() - processStartTime) / 1000)
    });
    
    const programName = await this.programNameGenerator.generate(insights, userContext, namingContext);
    console.log(`[EPM Synthesis] Program name: "${programName}"`);
    
    onProgress?.({
      type: 'step-start',
      step: 'timeline',
      description: 'Calculating timeline and phases',
      elapsedSeconds: Math.round((Date.now() - processStartTime) / 1000)
    });
    
    const timeline = await this.timelineCalculator.calculate(insights, workstreams, userContext);
    console.log(`[EPM Synthesis] ✓ Timeline: ${timeline.totalMonths} months, ${timeline.phases.length} phases`);
    
    onProgress?.({
      type: 'step-start',
      step: 'resources',
      description: 'Generating resource plan',
      elapsedSeconds: Math.round((Date.now() - processStartTime) / 1000)
    });
    
    const initiativeType = planningContext.business.initiativeType;
    const resourcePlan = await this.resourceAllocator.allocate(
      insights,
      workstreams,
      userContext,
      initiativeType
    );
    console.log(`[EPM Synthesis] ✓ Resources: ${resourcePlan.totalFTEs} FTEs, ${resourcePlan.internalTeam.length} roles`);
    
    onProgress?.({
      type: 'step-start',
      step: 'components',
      description: 'Generating EPM components',
      elapsedSeconds: Math.round((Date.now() - processStartTime) / 1000)
    });
    
    const [
      executiveSummary,
      riskRegister,
      stakeholderMap,
      qaPlan,
    ] = await Promise.all([
      this.executiveSummaryGenerator.generate(insights, programName),
      this.riskGenerator.generate(insights),
      this.stakeholderGenerator.generate(insights),
      this.qaPlanGenerator.generate(insights),
    ]);
    
    const stageGates = await this.stageGateGenerator.generate(timeline, riskRegister);
    
    onProgress?.({
      type: 'step-start',
      step: 'validation',
      description: 'Validating EPM data',
      elapsedSeconds: Math.round((Date.now() - processStartTime) / 1000)
    });
    
    const validationResult = this.validator.validate(workstreams, timeline, stageGates);
    if (validationResult.errors.length > 0) {
      console.log(`[EPM Synthesis] ⚠️ Validation found ${validationResult.errors.length} errors, auto-corrected`);
      validationResult.corrections.forEach(c => console.log(`    - ${c}`));
    }
    
    const planningGrid = this.validator.analyzePlanningGrid(workstreams, timeline);
    if (planningGrid.conflicts.length > 0) {
      console.log(`[EPM Synthesis] ⚠️ Planning grid conflicts: ${planningGrid.conflicts.length}`);
    }
    
    onProgress?.({
      type: 'step-start',
      step: 'financial',
      description: 'Generating financial and benefit plans',
      elapsedSeconds: Math.round((Date.now() - processStartTime) / 1000)
    });
    
    const [
      financialPlan,
      benefitsRealization,
      governance,
    ] = await Promise.all([
      this.financialPlanGenerator.generate(insights, resourcePlan, userContext),
      this.benefitsGenerator.generate(insights, timeline),
      this.governanceGenerator.generate(insights, stakeholderMap),
    ]);
    
    const [
      kpis,
      procurement,
      exitStrategy,
    ] = await Promise.all([
      this.kpiGenerator.generate(insights, benefitsRealization),
      this.procurementGenerator.generate(insights, financialPlan),
      this.exitStrategyGenerator.generate(insights, riskRegister),
    ]);
    
    const validationReport = this.buildValidationReport(
      workstreams,
      timeline,
      stageGates,
      validationResult,
      planningGrid
    );
    
    const confidences = [
      executiveSummary.confidence,
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
    ];
    
    const overallConfidence = this.calculateOverallConfidence(confidences);
    
    const program: EPMProgram = {
      id: `EPM-${Date.now()}`,
      generatedAt: new Date(),
      sourceFramework: insights.frameworkType,
      sourceInsightsCount: insights.insights.length,
      overallConfidence,
      validationReport,
      
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
      
      extractionRationale: this.generateExtractionRationale(insights, userContext),
    };
    
    console.log('[EPM Synthesis] ✓ Program built successfully');
    console.log(`[EPM Synthesis]   Overall confidence: ${(overallConfidence * 100).toFixed(1)}%`);
    
    return program;
  }

  /**
   * Fallback: Build EPM using old system (legacy path)
   */
  private async buildWithOldSystem(
    insights: StrategyInsights,
    userContext?: UserContext,
    namingContext?: any
  ): Promise<EPMProgram> {
    console.log('[EPM Synthesis] Using legacy synthesis path');
    
    const programName = await this.programNameGenerator.generate(insights, userContext, namingContext);
    
    const workstreamInsights = insights.insights.filter(i => i.type === 'workstream');
    const workstreams: Workstream[] = workstreamInsights.map((insight, index) => {
      const deliverables = this.workstreamGenerator.generateDeliverables(insight, index);
      
      return {
        id: `WS${String(index + 1).padStart(3, '0')}`,
        name: insight.content.split('\n')[0] || `Workstream ${index + 1}`,
        description: insight.content,
        deliverables,
        startMonth: Math.floor(index / 2) + 1,
        endMonth: Math.min(Math.floor(index / 2) + 1 + deliverables.length, 12),
        dependencies: index > 0 ? [`WS${String(index).padStart(3, '0')}`] : [],
        confidence: insight.confidence,
      };
    });
    
    if (workstreams.length < 3) {
      workstreams.push(...this.workstreamGenerator.generateDefaultWorkstreams(3 - workstreams.length));
    }
    
    const timeline = await this.timelineCalculator.calculate(insights, workstreams, userContext);
    const resourcePlan = await this.resourceAllocator.allocate(insights, workstreams, userContext);
    
    const [
      executiveSummary,
      riskRegister,
      stakeholderMap,
      qaPlan,
    ] = await Promise.all([
      this.executiveSummaryGenerator.generate(insights, programName),
      this.riskGenerator.generate(insights),
      this.stakeholderGenerator.generate(insights),
      this.qaPlanGenerator.generate(insights),
    ]);
    
    const stageGates = await this.stageGateGenerator.generate(timeline, riskRegister);
    
    const validationResult = this.validator.validate(workstreams, timeline, stageGates);
    const planningGrid = this.validator.analyzePlanningGrid(workstreams, timeline);
    
    const [
      financialPlan,
      benefitsRealization,
      governance,
    ] = await Promise.all([
      this.financialPlanGenerator.generate(insights, resourcePlan, userContext),
      this.benefitsGenerator.generate(insights, timeline),
      this.governanceGenerator.generate(insights, stakeholderMap),
    ]);
    
    const [
      kpis,
      procurement,
      exitStrategy,
    ] = await Promise.all([
      this.kpiGenerator.generate(insights, benefitsRealization),
      this.procurementGenerator.generate(insights, financialPlan),
      this.exitStrategyGenerator.generate(insights, riskRegister),
    ]);
    
    const validationReport = this.buildValidationReport(
      workstreams,
      timeline,
      stageGates,
      validationResult,
      planningGrid
    );
    
    const confidences = [
      executiveSummary.confidence,
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
    ];
    
    const overallConfidence = this.calculateOverallConfidence(confidences);
    
    return {
      id: `EPM-${Date.now()}`,
      generatedAt: new Date(),
      sourceFramework: insights.frameworkType,
      sourceInsightsCount: insights.insights.length,
      overallConfidence,
      validationReport,
      
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
      
      extractionRationale: this.generateExtractionRationale(insights, userContext),
    };
  }

  /**
   * Build validation report from validation results
   */
  private buildValidationReport(
    workstreams: Workstream[],
    timeline: Timeline,
    stageGates: StageGates,
    validationResult: { errors: string[]; corrections: string[] },
    planningGrid: { conflicts: string[]; maxUtilization: number; totalTasks: number }
  ): ValidationReport {
    return {
      isComplete: validationResult.errors.length === 0,
      missingComponents: [],
      warnings: validationResult.errors.concat(planningGrid.conflicts),
      corrections: validationResult.corrections,
      completenessScore: 1.0 - (validationResult.errors.length * 0.05),
      planningGrid: {
        conflicts: planningGrid.conflicts,
        maxUtilization: planningGrid.maxUtilization,
        totalTasks: planningGrid.totalTasks,
      },
    };
  }

  /**
   * Calculate overall confidence from component confidences
   */
  private calculateOverallConfidence(confidences: number[]): number {
    const avg = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const variance = confidences.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / confidences.length;
    return Math.max(0.5, avg - (variance * 0.1));
  }

  /**
   * Generate extraction rationale for audit trail
   */
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
- Timeline inferred based on ${insights.marketContext?.urgency || 'standard'} urgency
- Resource and financial plans estimated using industry benchmarks
- All 14 EPM components synthesized using documented ${framework}→EPM mappings

USER CONTEXT:
${userContext ? `
- Timeline urgency: ${insights.marketContext?.urgency || 'standard'}
- Budget range: ${userContext.budgetRange ? `$${userContext.budgetRange.min.toLocaleString()} - $${userContext.budgetRange.max.toLocaleString()}` : 'Not specified'}
- Risk tolerance: ${userContext.riskTolerance || 'Not specified'}
` : 'No additional user context provided'}

CONFIDENCE ASSESSMENT:
Average confidence across components: ${Math.round((insights.overallConfidence || 0.75) * 100)}%
Confidence varies by component based on directness of extraction vs. AI inference.
`.trim();
  }
}

export default EPMSynthesizer;
