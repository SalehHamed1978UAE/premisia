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
  ResourceAllocation,
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
    // Note: llm MUST implement ILLMProvider with generateStructured method for WBS Builder.
    // If llm is null/undefined, WBS Builder will FAIL (no silent fallback).
    // Always pass a valid LLM provider for proper workstream generation.
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
      
      // NOTE: Do NOT send 'complete' event here - the route handler sends it WITH programId
      // Sending complete here would cause frontend to receive a complete event without programId
      // The route at strategy-workspace.ts line 607-615 sends the proper complete event after DB save
      onProgress?.({
        type: 'step-complete',
        step: 'synthesis',
        description: 'EPM synthesis finished, preparing to save...',
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
      
      // CRITICAL: Do NOT fall back to legacy system - it produces garbage workstreams
      // Propagate the error so the caller knows synthesis genuinely failed
      throw error;
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
    
    // CRITICAL: Wrap workstreams in object structure expected by replaceTimelineGeneration
    // The function expects an object with a .workstreams property, not a raw array
    const epmProgramInput = { workstreams };
    
    const planningResult = await replaceTimelineGeneration(
      epmProgramInput,
      planningContext
    );
    
    if (planningResult.success && planningResult.confidence >= 0.6) {
      console.log('[EPM Synthesis] ✓ Intelligent planning successful');
      console.log(`[EPM Synthesis]   Confidence: ${(planningResult.confidence * 100).toFixed(1)}%`);
      
      // CRITICAL: Extract workstreams from program object, not from non-existent planningResult.workstreams
      const scheduledWorkstreams = planningResult.program?.workstreams || workstreams;
      
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
      // CRITICAL FIX: Intelligent planning failed (timeout, validation, etc.)
      // BUT we already have good workstreams from WBS Builder - USE THEM!
      // Do NOT fall back to legacy system which regenerates garbage workstreams
      console.warn('[EPM Synthesis] ⚠️ Intelligent planning unsuccessful');
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
      
      // PRESERVE WBS BUILDER WORKSTREAMS - Use them as-is without timeline optimization
      console.log('[EPM Synthesis] 📦 Using WBS Builder workstreams as-is (skipping timeline optimization)');
      console.log(`[EPM Synthesis]   Workstreams preserved: ${workstreams.length}`);
      
      // Assign default timings based on workstream position when intelligent planning fails
      // This ensures timeline calculator gets proper duration data
      const timedWorkstreams = this.assignDefaultTimings(workstreams, planningContext);
      timedWorkstreams.forEach((ws, i) => {
        console.log(`[EPM Synthesis]     ${i + 1}. ${ws.name} (M${ws.startMonth}-M${ws.endMonth}, ${ws.deliverables?.length || 0} deliverables)`);
      });
      
      return await this.buildFullProgram(
        insights,
        timedWorkstreams, // Use WBS Builder workstreams with default timings
        planningContext,
        userContext,
        namingContext,
        onProgress,
        processStartTime
      );
    }
  }
  
  /**
   * Assign default timings to workstreams when intelligent planning fails
   * Uses business scale and workstream count to create COMPACT durations (not enterprise-sized)
   */
  private assignDefaultTimings(workstreams: Workstream[], planningContext: PlanningContext): Workstream[] {
    const scale = planningContext.business.scale || 'mid_market';
    
    // Base duration per workstream based on scale - this is what we actually use
    const baseDurationMonths = scale === 'smb' ? 1 : scale === 'mid_market' ? 1 : 2;
    
    const wsCount = workstreams.length || 1;
    
    // Calculate total program duration: number of workstreams with overlap
    // For SMB: short, compact timelines. Each workstream ~1 month, some overlap
    const overlapFactor = 0.5; // Each workstream overlaps 50% with the next
    const totalDuration = Math.ceil(baseDurationMonths + (wsCount - 1) * baseDurationMonths * overlapFactor);
    
    console.log(`[EPM Synthesis] 📅 Assigning default timings: Scale=${scale}, ${wsCount} workstreams, ${baseDurationMonths}mo each, total=${totalDuration}mo`);
    
    return workstreams.map((ws, index) => {
      // Staggered start with overlap between workstreams
      const startMonth = Math.floor(index * baseDurationMonths * overlapFactor);
      const endMonth = startMonth + baseDurationMonths;
      
      console.log(`[EPM Synthesis]   ${index + 1}. ${ws.name}: M${startMonth}-M${endMonth}`);
      
      return {
        ...ws,
        startMonth,
        endMonth,
        deliverables: ws.deliverables.map((d, di) => ({
          ...d,
          dueMonth: endMonth, // Deliverables due at end of workstream
        })),
      };
    });
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
    
    // Assign owners to workstreams based on resource roles (Fix 5b)
    this.assignWorkstreamOwners(workstreams, resourcePlan);
    console.log(`[EPM Synthesis] ✓ Workstream owners assigned`);
    
    onProgress?.({
      type: 'step-start',
      step: 'components',
      description: 'Generating EPM components',
      elapsedSeconds: Math.round((Date.now() - processStartTime) / 1000)
    });
    
    const [
      executiveSummary,
      riskRegisterRaw,
      stakeholderMap,
      qaPlan,
    ] = await Promise.all([
      this.executiveSummaryGenerator.generate(insights, programName),
      this.riskGenerator.generate(insights),
      this.stakeholderGenerator.generate(insights),
      this.qaPlanGenerator.generate(insights),
    ]);
    
    // Assign owners to risks based on resources (Fix 3)
    const risksWithOwners = this.riskGenerator.assignRiskOwners(
      riskRegisterRaw.risks,
      resourcePlan.internalTeam
    );
    const riskRegister = {
      ...riskRegisterRaw,
      risks: risksWithOwners,
      topRisks: risksWithOwners.slice().sort((a, b) => b.severity - a.severity).slice(0, 5)
    };
    console.log('[EPM Synthesis] ✓ Assigned risk owners (buildV2Program):', risksWithOwners.map(r => ({ id: r.id, owner: r.owner })));
    
    const stageGates = await this.stageGateGenerator.generate(timeline, riskRegister);
    
    onProgress?.({
      type: 'step-start',
      step: 'validation',
      description: 'Validating EPM data',
      elapsedSeconds: Math.round((Date.now() - processStartTime) / 1000)
    });
    
    const businessContext = insights.marketContext?.industry || '';
    const validationResult = this.validator.validate(workstreams, timeline, stageGates, businessContext);
    if (validationResult.errors.length > 0) {
      console.log(`[EPM Synthesis] ⚠️ Validation found ${validationResult.errors.length} errors, auto-corrected`);
      validationResult.corrections.forEach(c => console.log(`    - ${c}`));
    }
    if (validationResult.warnings.length > 0) {
      console.log(`[EPM Synthesis] ⚠️ Validation warnings: ${validationResult.warnings.length}`);
      validationResult.warnings.forEach(w => console.log(`    - ${w}`));
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
      benefitsRealizationRaw,
      governance,
    ] = await Promise.all([
      this.financialPlanGenerator.generate(insights, resourcePlan, userContext),
      this.benefitsGenerator.generate(insights, timeline),
      this.governanceGenerator.generate(insights, stakeholderMap),
    ]);
    
    // Enhance benefits with AI-generated descriptions and assign owners
    const benefitsWithOwners = await this.benefitsGenerator.enhanceBenefitsWithAI(
      benefitsRealizationRaw.benefits,
      resourcePlan.internalTeam,
      { name: programName, description: planningContext.business.description }
    );
    const benefitsRealization = {
      ...benefitsRealizationRaw,
      benefits: benefitsWithOwners
    };
    console.log('[EPM Synthesis] ✓ Enhanced benefits with AI (buildV2Program):', benefitsWithOwners.map(b => ({ name: b.name, owner: b.responsibleParty })));
    
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
      riskRegisterRaw2,
      stakeholderMap,
      qaPlan,
    ] = await Promise.all([
      this.executiveSummaryGenerator.generate(insights, programName),
      this.riskGenerator.generate(insights),
      this.stakeholderGenerator.generate(insights),
      this.qaPlanGenerator.generate(insights),
    ]);
    
    // Assign owners to risks based on resources (Fix 3 - legacy path)
    const risksWithOwners2 = this.riskGenerator.assignRiskOwners(
      riskRegisterRaw2.risks,
      resourcePlan.internalTeam
    );
    const riskRegister = {
      ...riskRegisterRaw2,
      risks: risksWithOwners2,
      topRisks: risksWithOwners2.slice().sort((a, b) => b.severity - a.severity).slice(0, 5)
    };
    console.log('[EPM Synthesis] ✓ Assigned risk owners (legacy):', risksWithOwners2.map(r => ({ id: r.id, owner: r.owner })));
    
    const stageGates = await this.stageGateGenerator.generate(timeline, riskRegister);
    
    const businessContext = insights.marketContext?.industry || '';
    const validationResult = this.validator.validate(workstreams, timeline, stageGates, businessContext);
    const planningGrid = this.validator.analyzePlanningGrid(workstreams, timeline);
    
    if (validationResult.warnings.length > 0) {
      console.log(`[EPM Synthesis] ⚠️ Validation warnings: ${validationResult.warnings.length}`);
      validationResult.warnings.forEach(w => console.log(`    - ${w}`));
    }
    
    const [
      financialPlan,
      benefitsRealizationRaw2,
      governance,
    ] = await Promise.all([
      this.financialPlanGenerator.generate(insights, resourcePlan, userContext),
      this.benefitsGenerator.generate(insights, timeline),
      this.governanceGenerator.generate(insights, stakeholderMap),
    ]);
    
    // Enhance benefits with AI-generated descriptions and assign owners (legacy path)
    const benefitsWithOwners2 = await this.benefitsGenerator.enhanceBenefitsWithAI(
      benefitsRealizationRaw2.benefits,
      resourcePlan.internalTeam,
      { name: programName }
    );
    const benefitsRealization = {
      ...benefitsRealizationRaw2,
      benefits: benefitsWithOwners2
    };
    console.log('[EPM Synthesis] ✓ Enhanced benefits with AI (legacy):', benefitsWithOwners2.map(b => ({ name: b.name, owner: b.responsibleParty })));
    
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
   * Assign owners to workstreams based on resource roles (Fix 5b)
   * Matches workstream category/content to appropriate resource role
   */
  private assignWorkstreamOwners(workstreams: Workstream[], resourcePlan: ResourcePlan): void {
    if (!resourcePlan.internalTeam || resourcePlan.internalTeam.length === 0) {
      // No resources to assign - use default
      workstreams.forEach(ws => {
        ws.owner = 'Program Manager';
      });
      return;
    }

    // Build role lookup from internal team
    const roleNames = resourcePlan.internalTeam.map(r => r.role.toLowerCase());
    
    // Find default/fallback owner (prefer Program Manager, then first role)
    const defaultOwner = resourcePlan.internalTeam.find(r => 
      r.role.toLowerCase().includes('program') || 
      r.role.toLowerCase().includes('director') ||
      r.role.toLowerCase().includes('manager')
    )?.role || resourcePlan.internalTeam[0]?.role || 'Program Manager';

    workstreams.forEach(ws => {
      const wsName = ws.name.toLowerCase();
      const wsDesc = ws.description.toLowerCase();
      const combined = `${wsName} ${wsDesc}`;
      
      // Match workstream to resource based on category keywords
      let assignedOwner = defaultOwner;
      
      // Supply Chain / Operations workstreams
      if (combined.includes('supply chain') || combined.includes('logistics') || 
          combined.includes('inventory') || combined.includes('vendor') || combined.includes('sourcing')) {
        assignedOwner = this.findMatchingRole(resourcePlan.internalTeam, 
          ['supply chain', 'operations', 'logistics', 'procurement']) || defaultOwner;
      }
      // Financial workstreams
      else if (combined.includes('financial') || combined.includes('budget') || 
               combined.includes('cost') || combined.includes('revenue') || combined.includes('pricing')) {
        assignedOwner = this.findMatchingRole(resourcePlan.internalTeam, 
          ['financial', 'finance', 'controller', 'accountant']) || defaultOwner;
      }
      // Customer / Marketing workstreams
      else if (combined.includes('customer') || combined.includes('marketing') || 
               combined.includes('brand') || combined.includes('sales') || combined.includes('experience')) {
        assignedOwner = this.findMatchingRole(resourcePlan.internalTeam, 
          ['customer', 'marketing', 'sales', 'experience', 'brand']) || defaultOwner;
      }
      // Technology / Data workstreams
      else if (combined.includes('technology') || combined.includes('data') || 
               combined.includes('system') || combined.includes('digital') || combined.includes('integration')) {
        assignedOwner = this.findMatchingRole(resourcePlan.internalTeam, 
          ['technology', 'data', 'tech', 'digital', 'engineer', 'architect']) || defaultOwner;
      }
      // Talent / HR workstreams
      else if (combined.includes('talent') || combined.includes('hr') || 
               combined.includes('hiring') || combined.includes('training') || combined.includes('staff')) {
        assignedOwner = this.findMatchingRole(resourcePlan.internalTeam, 
          ['hr', 'human resource', 'talent', 'people', 'training']) || defaultOwner;
      }
      // Quality / Compliance workstreams
      else if (combined.includes('quality') || combined.includes('compliance') || 
               combined.includes('audit') || combined.includes('standard')) {
        assignedOwner = this.findMatchingRole(resourcePlan.internalTeam, 
          ['quality', 'compliance', 'qa', 'audit']) || defaultOwner;
      }
      // Store / Location / Retail workstreams
      else if (combined.includes('store') || combined.includes('location') || 
               combined.includes('retail') || combined.includes('launch') || combined.includes('setup')) {
        assignedOwner = this.findMatchingRole(resourcePlan.internalTeam, 
          ['store', 'retail', 'operations', 'location']) || defaultOwner;
      }
      
      ws.owner = assignedOwner;
    });
  }

  /**
   * Find a matching role from the team based on keywords
   */
  private findMatchingRole(team: ResourceAllocation[], keywords: string[]): string | null {
    for (const keyword of keywords) {
      const match = team.find(r => r.role.toLowerCase().includes(keyword));
      if (match) return match.role;
    }
    return null;
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
