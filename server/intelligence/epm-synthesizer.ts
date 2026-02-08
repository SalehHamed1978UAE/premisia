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
  EPMValidationReport,
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
  StrategyContext,
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
  RoleInferenceService,
  normalizeRole,
  ensureResourceExists,
} from './epm';
import { enforceDomainSequencing } from './epm/domain-sequencing';

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
  private roleInferenceService: RoleInferenceService;

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
    this.roleInferenceService = new RoleInferenceService();
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
    const domainContextText = [
      planningContext.business.industry,
      planningContext.business.description,
      planningContext.business.initiativeType,
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ');

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

    // Extract strategic context for benefits generation
    const strategicContext = this.extractStrategicContext(insights, namingContext);
    console.log(`[EPM Synthesis] ✓ Strategic context: ${strategicContext.decisions.length} decisions, SWOT available: ${!!strategicContext.swotData}`);

    if (planningResult.success && planningResult.confidence >= 0.6) {
      console.log('[EPM Synthesis] ✓ Intelligent planning successful');
      console.log(`[EPM Synthesis]   Confidence: ${(planningResult.confidence * 100).toFixed(1)}%`);

      // CRITICAL: Extract workstreams from program object, not from non-existent planningResult.workstreams
      const scheduledWorkstreams = planningResult.program?.workstreams || workstreams;
      const sequencedWorkstreams = enforceDomainSequencing(scheduledWorkstreams, domainContextText);

      return await this.buildFullProgram(
        insights,
        sequencedWorkstreams,
        planningContext,
        userContext,
        namingContext,
        strategicContext,
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
      const sequencedTimedWorkstreams = enforceDomainSequencing(timedWorkstreams, domainContextText);
      sequencedTimedWorkstreams.forEach((ws, i) => {
        console.log(`[EPM Synthesis]     ${i + 1}. ${ws.name} (M${ws.startMonth}-M${ws.endMonth}, ${ws.deliverables?.length || 0} deliverables)`);
      });

      return await this.buildFullProgram(
        insights,
        sequencedTimedWorkstreams, // Use WBS Builder workstreams with domain sequencing guardrails
        planningContext,
        userContext,
        namingContext,
        strategicContext,
        onProgress,
        processStartTime
      );
    }
  }

  /**
   * Extract strategic context (decisions + SWOT) for benefits generation
   * This pulls ACTUAL user decisions and SWOT analysis data
   *
   * DUAL-PATH SUPPORT:
   * 1. Legacy path: namingContext.decisionsData / selectedDecisions (from version table)
   * 2. Journey Builder path: namingContext.decisionsData (from frameworkInsights)
   * 3. SWOT: Check namingContext.journeyBuilderSwot first, then insights
   */
  private extractStrategicContext(
    insights: StrategyInsights,
    namingContext?: any
  ): { decisions: any[]; swotData: any } {
    // Extract decisions from namingContext (works for both legacy and Journey Builder paths)
    // The route handler already fetches from frameworkInsights if version.decisionsData is empty
    const decisionsData = namingContext?.decisionsData?.decisions || [];
    const selectedDecisions = namingContext?.selectedDecisions || {};

    // Merge selection into decisions
    const decisions = decisionsData.map((d: any) => ({
      ...d,
      selectedOptionId: selectedDecisions[d.id] || d.selectedOptionId,
    }));

    // SWOT extraction with Journey Builder fallback
    // Priority: 1. Journey Builder SWOT (from frameworkInsights), 2. Insights, 3. Market context
    let opportunities: any[] = [];
    let strengths: any[] = [];

    // Check Journey Builder SWOT first (passed from route handler)
    const journeyBuilderSwot = namingContext?.journeyBuilderSwot;
    if (journeyBuilderSwot) {
      console.log('[EPM Synthesis] Using Journey Builder SWOT from frameworkInsights');

      // Extract opportunities from Journey Builder SWOT structure
      const jbOpportunities = journeyBuilderSwot?.opportunities ||
        journeyBuilderSwot?.output?.opportunities ||
        journeyBuilderSwot?.data?.output?.opportunities || [];

      opportunities = jbOpportunities.map((op: any) => ({
        name: typeof op === 'string' ? op.substring(0, 60) : (op.name || op.title || op.content?.substring(0, 60)),
        description: typeof op === 'string' ? op : (op.description || op.content || op.name || ''),
        content: typeof op === 'string' ? op : (op.content || op.description || op.name || ''),
      }));

      // Extract strengths
      const jbStrengths = journeyBuilderSwot?.strengths ||
        journeyBuilderSwot?.output?.strengths ||
        journeyBuilderSwot?.data?.output?.strengths || [];

      strengths = jbStrengths.map((s: any) => ({
        content: typeof s === 'string' ? s : (s.content || s.description || s.name || ''),
      }));
    }

    // Fallback: Extract from insights if Journey Builder SWOT not available
    if (opportunities.length === 0) {
      const swotInsights = insights.insights.filter(i =>
        i.source?.includes('SWOT') ||
        i.source?.includes('swot') ||
        i.type === 'benefit' && i.source?.includes('opportunity')
      );

      opportunities = swotInsights
        .filter(i => i.source?.includes('opportunity') || i.source?.includes('Opportunities'))
        .map(i => ({
          name: i.content.split('\n')[0]?.substring(0, 60),
          description: i.content,
          content: i.content,
        }));

      strengths = swotInsights
        .filter(i => i.source?.includes('strength') || i.source?.includes('Strengths'))
        .map(i => ({ content: i.content }));
    }

    // Final fallback: Check market context
    if (opportunities.length === 0) {
      opportunities = (insights.marketContext as any)?.swot?.opportunities || [];
    }

    const swotData = { opportunities, strengths };

    console.log(`[EPM Synthesis] Extracted strategic context:`);
    console.log(`  - Decisions with selections: ${decisions.filter((d: any) => d.selectedOptionId).length}`);
    console.log(`  - SWOT opportunities: ${swotData.opportunities.length}`);
    console.log(`  - SWOT strengths: ${swotData.strengths.length}`);
    console.log(`  - Source: ${journeyBuilderSwot ? 'Journey Builder (frameworkInsights)' : 'Legacy (insights/marketContext)'}`);

    return { decisions, swotData };
  }
  
  /**
   * Assign default timings to workstreams when intelligent planning fails
   * Uses business scale and workstream count to create COMPACT durations (not enterprise-sized)
   */
  private assignDefaultTimings(workstreams: Workstream[], planningContext: PlanningContext): Workstream[] {
    const scale = planningContext.business.scale || 'mid_market';

    // Base duration per workstream based on scale.
    const baseDurationMonths = scale === 'smb' ? 1 : scale === 'mid_market' ? 2 : 3;
    const overlapFactor = 0.5;

    const byId = new Map(workstreams.map((ws) => [ws.id, ws]));
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();
    const validDepsById = new Map<string, string[]>();

    for (const ws of workstreams) {
      inDegree.set(ws.id, 0);
      dependents.set(ws.id, []);
      validDepsById.set(ws.id, []);
    }

    for (const ws of workstreams) {
      const validDeps = (ws.dependencies || []).filter((depId) => byId.has(depId));
      validDepsById.set(ws.id, validDeps);
      for (const depId of validDeps) {
        inDegree.set(ws.id, (inDegree.get(ws.id) || 0) + 1);
        dependents.get(depId)?.push(ws.id);
      }
    }

    const queue: string[] = workstreams
      .filter((ws) => (inDegree.get(ws.id) || 0) === 0)
      .map((ws) => ws.id);
    const topo: string[] = [];

    while (queue.length > 0) {
      const id = queue.shift() as string;
      topo.push(id);

      for (const dependentId of dependents.get(id) || []) {
        const nextDegree = (inDegree.get(dependentId) || 0) - 1;
        inDegree.set(dependentId, nextDegree);
        if (nextDegree === 0) queue.push(dependentId);
      }
    }

    // Cycle fallback: preserve original order to avoid hard failure.
    const orderedIds = topo.length === workstreams.length
      ? topo
      : workstreams.map((ws) => ws.id);

    const endMonthById = new Map<string, number>();
    const timedById = new Map<string, Workstream>();
    let independentCursor = 0;

    for (const id of orderedIds) {
      const ws = byId.get(id)!;
      const deps = validDepsById.get(id) || [];

      const complexityLift = Math.floor((ws.deliverables?.length || 0) / 4);
      const durationMonths = Math.max(1, baseDurationMonths + complexityLift);

      let startMonth: number;
      if (deps.length > 0) {
        const depEndMonths = deps
          .map((depId) => endMonthById.get(depId))
          .filter((month): month is number => month !== undefined);
        const maxDepEnd = depEndMonths.length > 0 ? Math.max(...depEndMonths) : 0;
        startMonth = Math.max(1, maxDepEnd + 1);
      } else {
        startMonth = Math.max(1, Math.floor(independentCursor * baseDurationMonths * overlapFactor) + 1);
        independentCursor += 1;
      }

      const endMonth = startMonth + durationMonths - 1;

      console.log(`[EPM Synthesis]   ${ws.name}: M${startMonth}-M${endMonth} (${durationMonths}mo)`);

      const timed: Workstream = {
        ...ws,
        startMonth,
        endMonth,
        deliverables: (ws.deliverables || []).map((d) => ({
          ...d,
          dueMonth: endMonth, // Deliverables due at end of workstream
        })),
      };

      timedById.set(id, timed);
      endMonthById.set(id, endMonth);
    }

    const timedWorkstreams = workstreams.map((ws) => timedById.get(ws.id) || ws);
    const maxEndMonth = timedWorkstreams.length > 0
      ? Math.max(...timedWorkstreams.map((ws) => ws.endMonth))
      : 0;

    console.log(
      `[EPM Synthesis] 📅 Assigned dependency-aware default timings: ` +
      `Scale=${scale}, workstreams=${workstreams.length}, total=${maxEndMonth + 1}mo`
    );

    return timedWorkstreams;
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
    strategicContext?: { decisions: any[]; swotData: any },
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

    // Create StrategyContext for context-aware role selection
    // This ensures cafe gets cafe roles, restaurant gets restaurant roles, etc.
    const strategyContext = ContextBuilder.toStrategyContext(
      planningContext,
      userContext?.sessionId || 'unknown',
      'strategy_workspace'
    );
    console.log(`[EPM Synthesis] ✓ Strategy context: ${strategyContext.businessType.category}/${strategyContext.businessType.subcategory || 'default'}`);

    const resourcePlan = await this.resourceAllocator.allocate(
      insights,
      workstreams,
      userContext,
      initiativeType,
      strategyContext  // Pass strategy context for context-aware role selection
    );
    console.log(`[EPM Synthesis] ✓ Resources: ${resourcePlan.totalFTEs} FTEs, ${resourcePlan.internalTeam.length} roles`);

    // LLM-driven workstream owner assignment (replaces hardcoded keyword matching)
    // Uses batch AI call to infer appropriate role for each workstream
    const ownerInferenceContext = {
      industry: planningContext.business.industry || 'general',
      businessType: strategyContext?.businessType?.subcategory || strategyContext?.businessType?.category || 'general_business',
      geography: 'unspecified', // TODO: Extract from strategic understanding
      initiativeType: planningContext.business.initiativeType || 'market_entry',
      programName,
    };
    const roleValidationWarnings = await this.assignWorkstreamOwners(workstreams, resourcePlan, ownerInferenceContext);
    console.log(`[EPM Synthesis] ✓ Workstream owners assigned via LLM inference`);
    
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

    // Generate benefits from ACTUAL STRATEGIC DATA when available
    // This uses decisions + SWOT instead of AI generation
    let benefitsRealization: BenefitsRealization;

    const hasStrategicDecisions = strategicContext?.decisions?.some((d: any) => d.selectedOptionId);

    if (hasStrategicDecisions) {
      console.log('[EPM Synthesis] 🎯 Using generateFromContext (decisions + SWOT) for benefits');
      benefitsRealization = this.benefitsGenerator.generateFromContext(
        strategicContext!.decisions,
        strategicContext!.swotData,
        workstreams,
        resourcePlan.internalTeam,
        timeline.totalMonths
      );
      console.log('[EPM Synthesis] ✓ Generated benefits from strategic context:', benefitsRealization.benefits.map(b => ({
        name: b.name,
        owner: b.responsibleParty,
        category: b.category
      })));
    } else {
      console.log('[EPM Synthesis] ⚠️ No strategic decisions found, falling back to insight-based generation');
      const benefitsRealizationRaw = await this.benefitsGenerator.generate(insights, timeline);
      // Still enhance with AI for descriptions and assign owners
      const benefitsWithOwners = await this.benefitsGenerator.enhanceBenefitsWithAI(
        benefitsRealizationRaw.benefits,
        resourcePlan.internalTeam,
        { name: programName, description: planningContext.business.description }
      );
      benefitsRealization = {
        ...benefitsRealizationRaw,
        benefits: benefitsWithOwners
      };
      console.log('[EPM Synthesis] ✓ Enhanced benefits with AI (fallback):', benefitsWithOwners.map(b => ({ name: b.name, owner: b.responsibleParty })));
    }

    const [
      financialPlan,
      governance,
    ] = await Promise.all([
      this.financialPlanGenerator.generate(insights, resourcePlan, userContext),
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
      planningGrid,
      roleValidationWarnings
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
    planningGrid: { conflicts: string[]; maxUtilization: number; totalTasks: number },
    roleValidationWarnings: string[] = []
  ): EPMValidationReport {
    // Combine all warnings: validation errors + planning conflicts + role validation
    const allWarnings = [
      ...validationResult.errors,
      ...planningGrid.conflicts,
      ...roleValidationWarnings,
    ];

    return {
      isComplete: validationResult.errors.length === 0,
      missingComponents: [],
      warnings: allWarnings,
      corrections: validationResult.corrections,
      completenessScore: 1.0 - (validationResult.errors.length * 0.05),
      planningGrid: {
        conflicts: planningGrid.conflicts,
        maxUtilization: planningGrid.maxUtilization,
        totalTasks: planningGrid.totalTasks,
      },
      roleValidation: roleValidationWarnings.length > 0 ? {
        warnings: roleValidationWarnings,
        checked: true,
      } : undefined,
    };
  }

  /**
   * Assign owners to workstreams using LLM-based role inference
   * Makes a single batch AI call to determine appropriate roles for all workstreams
   * Falls back to heuristics if LLM call fails
   */
  private async assignWorkstreamOwners(
    workstreams: Workstream[],
    resourcePlan: ResourcePlan,
    businessContext?: { industry?: string; businessType?: string; geography?: string; initiativeType?: string; programName?: string }
  ): Promise<string[]> {
    if (!resourcePlan.internalTeam || resourcePlan.internalTeam.length === 0) {
      // No resources to assign - use default
      workstreams.forEach(ws => {
        ws.owner = 'Program Manager';
      });
      return ['[Role Validation] No internal team defined - using default Program Manager for all workstreams'];
    }

    // Find default/fallback owner
    const defaultOwner = resourcePlan.internalTeam.find(r =>
      r.role.toLowerCase().includes('program') ||
      r.role.toLowerCase().includes('director') ||
      r.role.toLowerCase().includes('manager')
    )?.role || resourcePlan.internalTeam[0]?.role || 'Program Manager';

    // Use LLM-based role inference
    const maxRoles = Math.min(workstreams.length, 6);

    console.log(`[EPM Synthesis] 🤖 Invoking LLM for workstream owner inference...`);
    const inferenceResult = await this.roleInferenceService.inferOwners(
      businessContext || {},
      workstreams,
      maxRoles
    );

    console.log(`[EPM Synthesis] Role inference result: cache=${inferenceResult.usedCache}, fallback=${inferenceResult.usedFallback}, validated=${inferenceResult.validationRan}`);
    if (inferenceResult.notes) {
      console.log(`[EPM Synthesis] Notes: ${inferenceResult.notes}`);
    }

    // Log validation warnings for visibility
    if (inferenceResult.warnings && inferenceResult.warnings.length > 0) {
      console.log(`[EPM Synthesis] ⚠️ Validation warnings (${inferenceResult.warnings.length}):`);
      inferenceResult.warnings.forEach(w => {
        console.log(`  - [${w.severity.toUpperCase()}] ${w.message}`);
        console.log(`    Recommendation: ${w.recommendation}`);
      });
    }

    // Build owner lookup map
    const ownerMap = new Map<string, { roleTitle: string; category: string; rationale: string }>();
    for (const owner of inferenceResult.owners) {
      ownerMap.set(owner.workstreamId, {
        roleTitle: owner.roleTitle,
        category: owner.category,
        rationale: owner.rationale,
      });
    }

    // Assign owners to workstreams and ensure resources exist
    for (const ws of workstreams) {
      const inferred = ownerMap.get(ws.id);

      if (inferred) {
        ws.owner = normalizeRole(inferred.roleTitle);

        // Store rationale in metadata for audit/export
        (ws as any).metadata = {
          ...(ws as any).metadata,
          ownerCategory: inferred.category,
          ownerRationale: inferred.rationale,
        };

        // Ensure the role exists in the resource plan
        ensureResourceExists(inferred.roleTitle, resourcePlan, inferred.category, businessContext);

        console.log(`[EPM Synthesis]   ${ws.name} → ${ws.owner} (${inferred.category})`);
      } else {
        // Fallback if no inference returned for this workstream
        ws.owner = defaultOwner;
        console.log(`[EPM Synthesis]   ${ws.name} → ${ws.owner} (default fallback)`);
      }
    }

    // Log summary of unique roles assigned
    const uniqueRoles = new Set(workstreams.map(ws => ws.owner));
    console.log(`[EPM Synthesis] ✓ Assigned ${uniqueRoles.size} unique owner roles across ${workstreams.length} workstreams`);

    // Return warnings for inclusion in validation report
    return inferenceResult.warnings.map(w => `[Role Validation] ${w.message} - ${w.recommendation}`);
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
