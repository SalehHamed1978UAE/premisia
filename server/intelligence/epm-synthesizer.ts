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
  Deliverable,
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
  qualityGateRunner,
} from './epm';
import { extractUserConstraintsFromText } from './epm/constraint-utils';

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

    // SPRINT 1: Parse user constraints from input (not decisions)
    const userConstraints = this.parseUserConstraints(insights, planningContext);

    // SPRINT 1: Validate decisions against user constraints (integrity gate)
    const decisionValidation = this.validateDecisionsAgainstConstraints(strategicContext.decisions, userConstraints);

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
        strategicContext,
        decisionValidation,
        userConstraints,
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
        strategicContext,
        decisionValidation,
        userConstraints,
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
   * Parse user constraints from USER INPUT (not AI decisions)
   *
   * SPRINT 1 - INTEGRITY: Parse constraints from user's original input
   * Source: insights.marketContext.budgetRange (string)
   *
   * This enforces system integrity: USER constraints are the source of truth,
   * not AI-generated strategic decisions.
   *
   * Returns: Structured constraints object { budget: {min, max}, timeline: {min, max} }
   */
  private parseUserConstraints(
    insights: StrategyInsights,
    planningContext?: PlanningContext
  ): { budget?: { min: number; max: number }; timeline?: { min: number; max: number } } {
    const rawUserInput = planningContext?.business?.description || '';
    return extractUserConstraintsFromText(rawUserInput, insights.marketContext?.budgetRange);
  }

  /**
   * Validate strategic decisions against user constraints
   *
   * SPRINT 1 - INTEGRITY: Decisions CANNOT override user constraints without approval
   *
   * Returns: { needsApproval: boolean, violations: string[] }
   */
  private validateDecisionsAgainstConstraints(
    decisions: any[],
    userConstraints: { budget?: { min: number; max: number }; timeline?: { min: number; max: number } }
  ): { needsApproval: boolean; violations: string[] } {
    const violations: string[] = [];
    const selectedDecisions = decisions.filter((d: any) => d.selectedOptionId);

    console.log('[Decision Gate] Validating decisions against user constraints...');

    if (!userConstraints.budget && !userConstraints.timeline) {
      console.log('[Decision Gate] No user constraints defined - all decisions allowed');
      return { needsApproval: false, violations: [] };
    }

    // Check if any decision proposes budget exceeding user's stated limit
    for (const decision of selectedDecisions) {
      const selectedOption = decision.options?.find((opt: any) => opt.id === decision.selectedOptionId);
      if (!selectedOption) continue;

      const optionText = selectedOption.text || selectedOption.label || selectedOption.description || '';
      const decisionText = `${decision.question} ${optionText}`.toLowerCase();

      // Parse decision's proposed budget
      const budgetPattern = /\$?(\d+(?:\.\d+)?)\s*(?:million|m|mil)?\s*(?:-|to)?\s*(?:\$?(\d+(?:\.\d+)?))?\s*(?:million|m|mil)?/i;
      const budgetMatch = decisionText.match(budgetPattern);

      if (budgetMatch && userConstraints.budget) {
        let proposedMin = parseFloat(budgetMatch[1]) * 1_000_000;
        let proposedMax = budgetMatch[2] ? parseFloat(budgetMatch[2]) * 1_000_000 : proposedMin;

        // Check if decision exceeds user's budget limit
        if (proposedMax > userConstraints.budget.max) {
          const violation = `Decision proposes $${(proposedMax / 1_000_000).toFixed(1)}M but user limit is $${(userConstraints.budget.max / 1_000_000).toFixed(1)}M`;
          violations.push(violation);
          console.warn(`[Decision Gate] ⚠️  VIOLATION: ${violation}`);
        }
      }

      // Parse decision's proposed timeline
      const timelinePattern = /(\d+)\s*(?:-|to)?\s*(?:(\d+)\s*)?(?:month|mo|year|yr)s?/i;
      const timelineMatch = decisionText.match(timelinePattern);

      if (timelineMatch && userConstraints.timeline) {
        let proposedMonths = parseInt(timelineMatch[1], 10);
        if (decisionText.includes('year') || decisionText.includes('yr')) {
          proposedMonths *= 12;
        }

        // Check if decision exceeds user's timeline limit
        if (userConstraints.timeline.max && proposedMonths > userConstraints.timeline.max) {
          const violation = `Decision proposes ${proposedMonths} months but user limit is ${userConstraints.timeline.max} months`;
          violations.push(violation);
          console.warn(`[Decision Gate] ⚠️  VIOLATION: ${violation}`);
        }
      }
    }

    if (violations.length > 0) {
      console.warn(`[Decision Gate] ❌ ${violations.length} violations detected - requiresApproval flag will be set`);
      return { needsApproval: true, violations };
    }

    console.log('[Decision Gate] ✅ All decisions within user constraints');
    return { needsApproval: false, violations: [] };
  }

  private alignWorkstreamsToDecisions(
    workstreams: Workstream[],
    decisions: any[],
    planningContext: PlanningContext
  ): Workstream[] {
    const selectedDecisions = (decisions || []).filter((d: any) => d.selectedOptionId);
    if (selectedDecisions.length === 0) return workstreams;

    const decisionSeeds = selectedDecisions.map((decision: any, index: number) => {
      const selectedOption = Array.isArray(decision.options)
        ? decision.options.find((option: any) => option.id === decision.selectedOptionId)
        : null;
      const title = decision.title || decision.question || `Decision ${index + 1}`;
      const optionLabel = selectedOption?.label || decision.selectedOptionId || 'Selected option';
      const optionDescription = selectedOption?.description || '';
      const context = decision.context || '';
      const impactAreas = Array.isArray(decision.impact_areas) ? decision.impact_areas : [];
      const dependsOn = Array.isArray(decision.dependsOn)
        ? decision.dependsOn
        : Array.isArray(decision.depends_on)
          ? decision.depends_on
          : Array.isArray(decision.dependencies)
            ? decision.dependencies
            : [];
      const seedText = [title, optionLabel, optionDescription, context, impactAreas.join(' ')].filter(Boolean).join(' ');

      return {
        id: decision.id || `decision_${index + 1}`,
        title,
        optionLabel,
        optionDescription,
        context,
        impactAreas,
        dependsOn,
        seedText,
      };
    });

    const aligned = workstreams.map((ws) => ({
      ...ws,
      deliverables: ws.deliverables.map((d) => ({ ...d })),
      dependencies: [...(ws.dependencies || [])],
    }));

    const decisionToWorkstream = new Map<string, string>();
    const usedWorkstreamIds = new Set<string>();
    const unmatchedSeeds: typeof decisionSeeds = [];

    decisionSeeds.forEach((seed) => {
      const match = this.findBestWorkstreamMatch(seed, aligned, usedWorkstreamIds);
      if (match && match.score >= 1) {
        const target = aligned[match.index];
        this.applyDecisionToWorkstream(target, seed, planningContext);
        decisionToWorkstream.set(seed.id, target.id);
        usedWorkstreamIds.add(target.id);
      } else {
        unmatchedSeeds.push(seed);
      }
    });

    let nextIndex = this.nextWorkstreamIndex(aligned);
    const decisionWorkstreams: Workstream[] = [];

    for (const seed of unmatchedSeeds) {
      const created = this.createDecisionWorkstream(seed, nextIndex, planningContext);
      decisionWorkstreams.push(created);
      decisionToWorkstream.set(seed.id, created.id);
      nextIndex += 1;
    }

    const combined = [...aligned, ...decisionWorkstreams];

    const hasExplicitDependencies = decisionSeeds.some(
      (seed) => Array.isArray(seed.dependsOn) && seed.dependsOn.length > 0
    );

    if (hasExplicitDependencies) {
      for (const seed of decisionSeeds) {
        if (!seed.dependsOn || seed.dependsOn.length === 0) continue;
        const currentId = decisionToWorkstream.get(seed.id);
        if (!currentId) continue;
        const target = combined.find((ws) => ws.id === currentId);
        if (!target) continue;

        for (const depSeedId of seed.dependsOn) {
          const depWorkstreamId = decisionToWorkstream.get(depSeedId);
          const dependency = depWorkstreamId ? combined.find((ws) => ws.id === depWorkstreamId) : null;
          if (!depWorkstreamId || !dependency) continue;
          if (target.dependencies.includes(depWorkstreamId)) continue;
          if (this.wouldCreateCycle(combined, currentId, depWorkstreamId)) continue;
          target.dependencies.push(depWorkstreamId);
          if (target.startMonth <= dependency.endMonth) {
            const shift = dependency.endMonth - target.startMonth + 1;
            target.startMonth += shift;
            target.endMonth += shift;
            this.resequenceDeliverables(target);
          }
        }
      }
    }

    return combined;
  }

  private applyDecisionToWorkstream(
    workstream: Workstream,
    seed: {
      id: string;
      title: string;
      optionLabel: string;
      optionDescription: string;
      context: string;
      impactAreas: string[];
      seedText: string;
    },
    planningContext: PlanningContext
  ): void {
    const decisionTag = this.truncateText(`${seed.optionLabel || seed.title}`, 64);
    if (!workstream.name.toLowerCase().includes(decisionTag.toLowerCase())) {
      workstream.name = `${workstream.name} — ${decisionTag}`;
    }

    const decisionSummary = this.truncateText(
      `${seed.title}. Selected option: ${seed.optionLabel}. ${seed.optionDescription}`.trim(),
      240
    );
    const prefix = `Decision alignment: ${decisionSummary}`;
    if (!workstream.description.includes(prefix)) {
      workstream.description = `${prefix}\n\n${workstream.description}`.trim();
    }

    const decisionDeliverables: Deliverable[] = [
      {
        id: `${workstream.id}-DEC-1`,
        name: `Decision execution plan: ${decisionTag}`,
        description: `Define scope, milestones, and success criteria for ${decisionTag}.`,
        dueMonth: workstream.startMonth,
        effort: '10-20 person-days',
      },
      {
        id: `${workstream.id}-DEC-2`,
        name: `Resource and budget alignment for ${decisionTag}`,
        description: `Align resources, budget, and ownership to execute ${decisionTag}.`,
        dueMonth: workstream.startMonth,
        effort: '10-20 person-days',
      },
    ];

    workstream.deliverables = [...decisionDeliverables, ...workstream.deliverables];
    this.resequenceDeliverables(workstream);

    if (seed.impactAreas.length > 0) {
      const impactLine = `Impact areas: ${seed.impactAreas.join(', ')}.`;
      if (!workstream.description.includes(impactLine)) {
        workstream.description = `${workstream.description}\n\n${impactLine}`.trim();
      }
    }

    if (planningContext.business.industry) {
      const industryLine = `Industry focus: ${planningContext.business.industry}.`;
      if (!workstream.description.includes(industryLine)) {
        workstream.description = `${workstream.description}\n\n${industryLine}`.trim();
      }
    }
  }

  private createDecisionWorkstream(
    seed: {
      id: string;
      title: string;
      optionLabel: string;
      optionDescription: string;
      context: string;
      impactAreas: string[];
      seedText: string;
    },
    index: number,
    planningContext: PlanningContext
  ): Workstream {
    const name = this.truncateText(`Decision Implementation: ${seed.optionLabel || seed.title}`, 72);
    const description = [
      `Implements selected decision: ${seed.title}.`,
      seed.optionDescription ? `Option detail: ${seed.optionDescription}` : null,
      seed.context ? `Context: ${seed.context}` : null,
      planningContext.business.industry ? `Industry focus: ${planningContext.business.industry}.` : null,
    ].filter(Boolean).join(' ');

    const deliverables: Deliverable[] = [
      {
        id: `WS${String(index).padStart(3, '0')}-D1`,
        name: `Decision execution plan`,
        description: `Plan milestones, success criteria, and governance for ${seed.optionLabel || seed.title}.`,
        dueMonth: 1,
        effort: '10-20 person-days',
      },
      {
        id: `WS${String(index).padStart(3, '0')}-D2`,
        name: `Implementation roadmap`,
        description: `Define phased rollout, dependencies, and key deliverables for ${seed.optionLabel || seed.title}.`,
        dueMonth: 2,
        effort: '10-20 person-days',
      },
      {
        id: `WS${String(index).padStart(3, '0')}-D3`,
        name: `Resource alignment`,
        description: `Align owners, staffing, and budget to deliver ${seed.optionLabel || seed.title}.`,
        dueMonth: 3,
        effort: '10-20 person-days',
      },
    ];

    const workstream: Workstream = {
      id: `WS${String(index).padStart(3, '0')}`,
      name,
      description,
      deliverables,
      startMonth: 1,
      endMonth: 3,
      dependencies: [],
      confidence: 0.9,
    };

    this.resequenceDeliverables(workstream);
    return workstream;
  }

  private findBestWorkstreamMatch(
    seed: { seedText: string },
    workstreams: Workstream[],
    usedIds: Set<string>
  ): { index: number; score: number } | null {
    const seedTokens = this.tokenize(seed.seedText);
    if (seedTokens.size === 0) return null;

    let bestIndex = -1;
    let bestScore = 0;

    workstreams.forEach((ws, index) => {
      if (usedIds.has(ws.id)) return;
      const wsText = [ws.name, ws.description, ...ws.deliverables.map(d => d.name)].join(' ');
      const wsTokens = this.tokenize(wsText);
      const score = this.overlapScore(seedTokens, wsTokens);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex === -1) return null;
    return { index: bestIndex, score: bestScore };
  }

  private overlapScore(a: Set<string>, b: Set<string>): number {
    let score = 0;
    a.forEach((token) => {
      if (b.has(token)) score += 1;
    });
    return score;
  }

  private tokenize(text: string): Set<string> {
    const stopWords = new Set([
      'the', 'and', 'with', 'for', 'from', 'that', 'this', 'into', 'over', 'under', 'will', 'must',
      'should', 'could', 'would', 'about', 'after', 'before', 'their', 'they', 'them', 'your', 'our',
      'from', 'into', 'when', 'where', 'while', 'which', 'what', 'who', 'how', 'why', 'use', 'using',
    ]);

    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\\s]/g, ' ')
        .split(/\\s+/)
        .filter((token) => token.length > 3 && !stopWords.has(token))
    );
  }

  private nextWorkstreamIndex(workstreams: Workstream[]): number {
    const ids = workstreams
      .map((ws) => parseInt(ws.id.replace(/\\D+/g, ''), 10))
      .filter((n) => !Number.isNaN(n));
    if (ids.length === 0) return workstreams.length + 1;
    return Math.max(...ids) + 1;
  }

  private resequenceDeliverables(workstream: Workstream): void {
    if (!workstream.deliverables || workstream.deliverables.length === 0) return;
    const start = workstream.startMonth;
    const end = workstream.endMonth;
    const span = Math.max(1, end - start);
    const count = workstream.deliverables.length;
    workstream.deliverables = workstream.deliverables.map((deliverable, index) => {
      const progress = (index + 1) / count;
      const dueMonth = Math.floor(start + span * progress);
      return { ...deliverable, dueMonth };
    });
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
  }

  private wouldCreateCycle(workstreams: Workstream[], currentId: string, dependencyId: string): boolean {
    const byId = new Map(workstreams.map((ws) => [ws.id, ws]));
    const stack: string[] = [dependencyId];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (id === currentId) return true;
      if (visited.has(id)) continue;
      visited.add(id);
      const ws = byId.get(id);
      if (!ws) continue;
      (ws.dependencies || []).forEach((depId) => {
        if (!visited.has(depId)) stack.push(depId);
      });
    }
    return false;
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
        startMonth = maxDepEnd + 1;
      } else {
        startMonth = Math.floor(independentCursor * baseDurationMonths * overlapFactor);
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
    decisionValidation?: { needsApproval: boolean; violations: string[] },
    userConstraints?: { budget?: { min: number; max: number }; timeline?: { min: number; max: number } },
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

    const alignedWorkstreams = this.alignWorkstreamsToDecisions(
      workstreams,
      strategicContext?.decisions || [],
      planningContext
    );
    if (alignedWorkstreams.length !== workstreams.length) {
      console.log(`[EPM Synthesis] ✓ Decision alignment adjusted workstreams: ${workstreams.length} → ${alignedWorkstreams.length}`);
    } else {
      console.log('[EPM Synthesis] ✓ Decision alignment applied (no count change)');
    }
    
    onProgress?.({
      type: 'step-start',
      step: 'timeline',
      description: 'Calculating timeline and phases',
      elapsedSeconds: Math.round((Date.now() - processStartTime) / 1000)
    });
    
    const timeline = await this.timelineCalculator.calculate(insights, alignedWorkstreams, userContext);
    console.log(`[EPM Synthesis] ✓ Timeline: ${timeline.totalMonths} months, ${timeline.phases.length} phases`);

    // Sprint 1: Deduplicate workstreams before phase assignment
    const deduplicatedWorkstreams = this.deduplicateWorkstreams(alignedWorkstreams);
    if (deduplicatedWorkstreams.length !== alignedWorkstreams.length) {
      console.log(`[EPM Synthesis] ✓ Deduplication: ${alignedWorkstreams.length} → ${deduplicatedWorkstreams.length} workstreams`);
    }

    // Sprint 1: Assign phases with containment enforcement
    const phasedWorkstreams = this.assignWorkstreamPhases(deduplicatedWorkstreams, timeline);
    
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
      phasedWorkstreams,
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
    const roleValidationWarnings = await this.assignWorkstreamOwners(phasedWorkstreams, resourcePlan, ownerInferenceContext);
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
    
    const stageGates = await this.stageGateGenerator.generate(timeline, riskRegister, phasedWorkstreams);
    
    onProgress?.({
      type: 'step-start',
      step: 'validation',
      description: 'Validating EPM data',
      elapsedSeconds: Math.round((Date.now() - processStartTime) / 1000)
    });
    
    const businessContext = insights.marketContext?.industry || '';
    const validationResult = this.validator.validate(phasedWorkstreams, timeline, stageGates, businessContext);
    if (validationResult.errors.length > 0) {
      console.log(`[EPM Synthesis] ⚠️ Validation found ${validationResult.errors.length} errors, auto-corrected`);
      validationResult.corrections.forEach(c => console.log(`    - ${c}`));
    }
    if (validationResult.warnings.length > 0) {
      console.log(`[EPM Synthesis] ⚠️ Validation warnings: ${validationResult.warnings.length}`);
      validationResult.warnings.forEach(w => console.log(`    - ${w}`));
    }
    
    const planningGrid = this.validator.analyzePlanningGrid(alignedWorkstreams, timeline);
    if (planningGrid.conflicts.length > 0) {
      console.log(`[EPM Synthesis] ⚠️ Planning grid conflicts: ${planningGrid.conflicts.length}`);
    }

    // Sprint 1 (P2 Scheduling): Run WBS timeline validation
    console.log('[EPM Synthesis] 🔍 Running WBS timeline quality gates');
    const qualityReport = qualityGateRunner.runQualityGate(alignedWorkstreams, timeline, stageGates, businessContext);
    if (!qualityReport.overallPassed) {
      console.log(`[EPM Synthesis] ⚠️ WBS validation found ${qualityReport.errorCount} errors, ${qualityReport.warningCount} warnings`);
      qualityReport.validatorResults.forEach(result => {
        result.issues.forEach(issue => {
          if (issue.severity === 'error') {
            console.log(`    ❌ [${issue.code}] ${issue.message}`);
            if (issue.suggestion) {
              console.log(`       💡 ${issue.suggestion}`);
            }
          }
        });
      });
    } else {
      console.log(`[EPM Synthesis] ✓ WBS timeline validation passed`);
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
        alignedWorkstreams,
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
      phasedWorkstreams,
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
      workstreams: phasedWorkstreams,
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

      // SPRINT 1: Add requiresApproval flag if decisions exceed user constraints
      requiresApproval: decisionValidation?.needsApproval ? {
        budget: decisionValidation.violations.some(v => v.includes('budget')),
        timeline: decisionValidation.violations.some(v => v.includes('month')),
        violations: decisionValidation.violations,
      } : undefined,
      constraints: userConstraints,
    };

    console.log('[EPM Synthesis] ✓ Program built successfully');
    console.log(`[EPM Synthesis]   Overall confidence: ${(overallConfidence * 100).toFixed(1)}%`);

    if (program.requiresApproval) {
      console.warn('[EPM Synthesis] ⚠️  REQUIRES USER APPROVAL: Decisions exceed user constraints');
      console.warn(`[EPM Synthesis]   Violations: ${program.requiresApproval.violations.join('; ')}`);
    }
    
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
    
    const stageGates = await this.stageGateGenerator.generate(timeline, riskRegister, workstreams);
    
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
   * Sprint 1: Deduplicate workstreams by name and timeline hash
   * Removes duplicate workstreams that have identical name, startMonth, and endMonth
   */
  private deduplicateWorkstreams(workstreams: Workstream[]): Workstream[] {
    const seen = new Map<string, Workstream>();
    const duplicates: string[] = [];

    for (const ws of workstreams) {
      // Create hash key from name + timeline
      const key = `${ws.name.trim().toLowerCase()}:${ws.startMonth}:${ws.endMonth}`;

      if (seen.has(key)) {
        duplicates.push(`"${ws.name}" (M${ws.startMonth}-M${ws.endMonth})`);
        console.warn(`[EPM Synthesis] ⚠️ Duplicate workstream detected: ${ws.name} (${ws.startMonth}-${ws.endMonth}), skipping duplicate`);
        continue;
      }

      seen.set(key, ws);
    }

    const deduplicated = Array.from(seen.values());

    if (duplicates.length > 0) {
      console.log(`[EPM Synthesis] 🔧 Deduplication removed ${duplicates.length} duplicate workstream(s):`);
      duplicates.forEach(dup => console.log(`  - ${dup}`));
    }

    return deduplicated;
  }

  /**
   * Sprint 1: Assign workstreams to phases with preventive containment enforcement
   * Ensures workstream dates are constrained to fit within phase boundaries
   */
  private assignWorkstreamPhases(workstreams: Workstream[], timeline: Timeline): Workstream[] {
    if (!timeline?.phases || timeline.phases.length === 0) {
      return workstreams;
    }

    return workstreams.map((ws) => {
      // First, try to find a phase that FULLY CONTAINS the workstream
      let containingPhase = timeline.phases.find((phase) => {
        return ws.startMonth >= phase.startMonth && ws.endMonth <= phase.endMonth;
      });

      // If no containing phase, find the phase with maximum overlap
      if (!containingPhase) {
        let maxOverlap = 0;
        for (const phase of timeline.phases) {
          // Calculate overlap duration
          const overlapStart = Math.max(ws.startMonth, phase.startMonth);
          const overlapEnd = Math.min(ws.endMonth, phase.endMonth);
          const overlap = Math.max(0, overlapEnd - overlapStart);

          if (overlap > maxOverlap) {
            maxOverlap = overlap;
            containingPhase = phase;
          }
        }
      }

      if (!containingPhase) {
        console.warn(`[EPM Synthesis] ⚠️ Workstream "${ws.name}" (M${ws.startMonth}-M${ws.endMonth}) could not be assigned to any phase`);
        return ws;
      }

      // Sprint 1: ENFORCE CONTAINMENT - constrain workstream dates to phase boundaries
      let adjustedStart = ws.startMonth;
      let adjustedEnd = ws.endMonth;
      let wasAdjusted = false;

      if (ws.startMonth < containingPhase.startMonth) {
        adjustedStart = containingPhase.startMonth;
        wasAdjusted = true;
        console.log(`[EPM Synthesis] 🔧 Constrained workstream "${ws.name}" start: M${ws.startMonth} → M${adjustedStart} (phase boundary)`);
      }

      if (ws.endMonth > containingPhase.endMonth) {
        adjustedEnd = containingPhase.endMonth;
        wasAdjusted = true;
        console.log(`[EPM Synthesis] 🔧 Constrained workstream "${ws.name}" end: M${ws.endMonth} → M${adjustedEnd} (phase boundary)`);
      }

      // Adjust deliverable dates to fit within constrained workstream
      let adjustedDeliverables = ws.deliverables;
      if (wasAdjusted && ws.deliverables) {
        adjustedDeliverables = ws.deliverables.map((del) => {
          if (del.dueMonth !== undefined) {
            const constrainedDueMonth = Math.max(adjustedStart, Math.min(adjustedEnd, del.dueMonth));
            if (constrainedDueMonth !== del.dueMonth) {
              console.log(`[EPM Synthesis] 🔧 Adjusted deliverable "${del.name}" due: M${del.dueMonth} → M${constrainedDueMonth}`);
            }
            return {
              ...del,
              dueMonth: constrainedDueMonth,
            };
          }
          return del;
        });
      }

      return {
        ...ws,
        phase: containingPhase.name,
        startMonth: adjustedStart,
        endMonth: adjustedEnd,
        deliverables: adjustedDeliverables,
      };
    });
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
        ensureResourceExists(inferred.roleTitle, resourcePlan, inferred.category);

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
