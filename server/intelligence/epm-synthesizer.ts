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
import { replaceTimelineGeneration } from '../../src/lib/intelligent-planning/epm-integration';
import type { PlanningContext, BusinessScale } from '../../src/lib/intelligent-planning/types';
import { createWBSBuilder } from '../../src/lib/intelligent-planning/wbs-builder';
import { aiClients } from '../ai-clients';

/**
 * ContextBuilder - Infers business context from strategic insights
 * Provides robust scale inference using multiple signals to prevent
 * the intelligent planning system from generating inappropriate timelines
 * (e.g., 166 months for a coffee shop)
 */
export class ContextBuilder {
  /**
   * Build planning context from journey insights
   * Now ASYNC to fetch initiative type from database
   */
  static async fromJourneyInsights(
    insights: StrategyInsights,
    journeyType: string = 'strategy_workspace',
    sessionId?: string
  ): Promise<PlanningContext> {
    const scale = this.inferScale(insights);
    const timelineRange = this.inferTimelineRange(scale, insights);
    const budgetRange = this.inferBudgetRange(scale, insights);
    
    // Fetch initiative type from database if sessionId is provided
    let initiativeType: string | undefined = undefined;
    if (sessionId) {
      try {
        const { db } = await import('../db');
        const { strategicUnderstanding } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');
        
        const understanding = await db
          .select({ initiativeType: strategicUnderstanding.initiativeType })
          .from(strategicUnderstanding)
          .where(eq(strategicUnderstanding.sessionId, sessionId))
          .limit(1);
        
        if (understanding.length > 0 && understanding[0].initiativeType) {
          initiativeType = understanding[0].initiativeType;
          console.log(`[ContextBuilder] 🎯 Retrieved initiative type from DB: ${initiativeType}`);
        } else {
          console.log('[ContextBuilder] ⚠️ No initiative type found in DB for session:', sessionId);
        }
      } catch (error) {
        console.error('[ContextBuilder] Error fetching initiative type:', error);
        // Continue without initiative type if fetch fails
      }
    } else {
      console.log('[ContextBuilder] ⚠️ No sessionId provided, cannot fetch initiative type');
    }
    
    return {
      business: {
        name: 'Unnamed Business',  // No businessName on StrategyInsights
        type: this.inferBusinessType(insights),
        industry: insights.marketContext?.industry || 'general',
        description: '',  // No context/description on StrategyInsights
        scale,
        initiativeType  // Add initiative type to context
      },
      strategic: {
        insights: insights,
        constraints: [],  // No constraints on StrategyInsights
        objectives: this.extractObjectives(insights)
      },
      execution: {
        timeline: timelineRange,
        budget: budgetRange,
        resources: []
      },
      meta: {
        journeyType,
        confidence: insights.overallConfidence || 0.75,
        version: '1.0'
      }
    };
  }

  /**
   * Infer business scale using multiple signals:
   * - Budget indicators (if mentioned)
   * - Employee count keywords
   * - Market scope (local, regional, national, global)
   * - Complexity indicators (single location vs multi-location)
   * - Industry keywords (shop, enterprise, platform, etc.)
   * 
   * Default conservatively to mid_market if unclear
   */
  private static inferScale(insights: StrategyInsights): BusinessScale {
    const contextText = (
      insights.insights.map(i => i.content).join(' ')
    ).toLowerCase();
    
    let smb_score = 0;
    let enterprise_score = 0;
    
    // SMB indicators
    if (contextText.match(/\b(shop|store|cafe|coffee|local|small|startup|boutique|restaurant)\b/g)) {
      smb_score += 3;
    }
    if (contextText.match(/\b(single location|one location|neighborhood|community)\b/g)) {
      smb_score += 2;
    }
    if (contextText.match(/\b(under \$\d+k|small budget|limited budget|bootstrap)\b/g)) {
      smb_score += 2;
    }
    if (contextText.match(/\b(1-5 employees|small team|solo|founder)\b/g)) {
      smb_score += 2;
    }
    
    // Enterprise indicators
    if (contextText.match(/\b(enterprise|corporation|global|multinational|platform|saas)\b/g)) {
      enterprise_score += 3;
    }
    if (contextText.match(/\b(multi-location|nationwide|international|multiple markets)\b/g)) {
      enterprise_score += 2;
    }
    if (contextText.match(/\b(million|series [abc]|vc funded|enterprise software)\b/g)) {
      enterprise_score += 2;
    }
    if (contextText.match(/\b(100\+ employees|large team|department)\b/g)) {
      enterprise_score += 2;
    }
    
    // Decision logic with conservative default
    if (smb_score >= 4 && smb_score > enterprise_score) {
      return 'smb';
    }
    if (enterprise_score >= 4 && enterprise_score > smb_score) {
      return 'enterprise';
    }
    
    // Default conservatively to mid_market
    return 'mid_market';
  }

  /**
   * Infer timeline range based on scale
   * SMB: 6-12 months
   * Mid-market: 12-24 months
   * Enterprise: 24-48 months
   */
  private static inferTimelineRange(scale: BusinessScale, insights: StrategyInsights): { min: number; max: number } {
    // Check if insights have explicit timeline hints
    const contextText = insights.insights.map(i => i.content).join(' ').toLowerCase();
    
    // Override if explicit timeline mentioned
    const monthsMatch = contextText.match(/(\d+)\s*months?/);
    if (monthsMatch) {
      const explicitMonths = parseInt(monthsMatch[1]);
      return {
        min: Math.max(3, Math.floor(explicitMonths * 0.75)),
        max: Math.ceil(explicitMonths * 1.5)
      };
    }
    
    // Default ranges by scale
    switch (scale) {
      case 'smb':
        return { min: 6, max: 12 };
      case 'mid_market':
        return { min: 12, max: 24 };
      case 'enterprise':
        return { min: 24, max: 48 };
    }
  }

  /**
   * Infer budget range based on scale and context
   */
  private static inferBudgetRange(scale: BusinessScale, insights: StrategyInsights): { min: number; max: number } | undefined {
    const contextText = insights.insights.map(i => i.content).join(' ').toLowerCase();
    
    // Try to extract explicit budget if mentioned
    const budgetMatch = contextText.match(/\$(\d+(?:,\d+)*)\s*(k|thousand|million|mm|m(?=\s|$))?/i);
    if (budgetMatch) {
      const amount = parseInt(budgetMatch[1].replace(/,/g, ''));
      const unit = (budgetMatch[2] || '').toLowerCase();
      
      // Only treat as millions with explicit "million", "mm", or standalone "m"
      const multiplier = (unit === 'million' || unit === 'mm' || unit === 'm') ? 1000000 : 
                        (unit === 'k' || unit === 'thousand') ? 1000 : 1;
      const budget = amount * multiplier;
      return {
        min: budget * 0.75,
        max: budget * 1.25
      };
    }
    
    // Default ranges by scale
    switch (scale) {
      case 'smb':
        return { min: 50000, max: 250000 };
      case 'mid_market':
        return { min: 250000, max: 2000000 };
      case 'enterprise':
        return { min: 2000000, max: 10000000 };
    }
  }

  /**
   * Infer business type from insights
   */
  private static inferBusinessType(insights: StrategyInsights): string {
    const contextText = insights.insights.map(i => i.content).join(' ').toLowerCase();
    
    // Pattern matching for common business types
    if (contextText.match(/\b(coffee|cafe|shop|store|restaurant|bakery)\b/)) return 'retail_food_service';
    if (contextText.match(/\b(saas|software|platform|app|tech)\b/)) return 'saas_platform';
    if (contextText.match(/\b(consulting|service|agency)\b/)) return 'professional_services';
    if (contextText.match(/\b(manufacturing|factory|production)\b/)) return 'manufacturing';
    if (contextText.match(/\b(ecommerce|online|marketplace)\b/)) return 'ecommerce';
    
    return 'general_business';
  }

  /**
   * Extract objectives from insights
   */
  private static extractObjectives(insights: StrategyInsights): string[] {
    return insights.insights
      .filter(i => i.type === 'workstream' || i.source?.includes('objective'))
      .slice(0, 5)
      .map(i => i.content.split('\n')[0]);
  }
}

export class EPMSynthesizer {
  private llm: any;
  
  constructor(llm?: any) {
    this.llm = llm;
  }
  
  /**
   * Generate complete EPM program from strategic insights
   */
  async synthesize(
    insights: StrategyInsights,
    userContext?: UserContext,
    namingContext?: any,
    options?: { 
      forceIntelligentPlanning?: boolean; 
      onProgress?: (event: any) => void;
      initiativeType?: string;  // EXPLICIT: Initiative type from database
    }
  ): Promise<EPMProgram> {
    
    // ===== CHECK FLAG FIRST - ROUTE TO ONE PATH ONLY =====
    // Feature flag: Use AI-powered planning system OR old system (never both)
    const intelligentPlanningEnabled = 
      options?.forceIntelligentPlanning === true || 
      process.env.INTELLIGENT_PLANNING_ENABLED?.toLowerCase() === 'true';
    
    if (intelligentPlanningEnabled) {
      console.log('[EPM Synthesis] 🚀 Using intelligent planning system for complete EPM generation...');
      return await this.buildWithIntelligentPlanning(insights, userContext, namingContext, options?.onProgress, options?.initiativeType);
    } else {
      console.log('[EPM Synthesis] Using standard EPM generation system...');
      return await this.buildWithOldSystem(insights, userContext, namingContext, options?.initiativeType);
    }
  }

  /**
   * Build EPM program using OLD system (original logic)
   * Used when INTELLIGENT_PLANNING_ENABLED is false
   */
  private async buildWithOldSystem(
    insights: StrategyInsights,
    userContext?: UserContext,
    namingContext?: any,
    initiativeType?: string  // EXPLICIT: Initiative type from database
  ): Promise<EPMProgram> {
    
    // Generate intelligent program name from context
    const programName = await this.generateProgramName(insights, userContext, namingContext);
    
    // Generate CORE components first (timeline, workstreams, gates)
    const executiveSummary = await this.generateExecutiveSummary(insights, programName);
    const workstreams = await this.generateWorkstreams(insights, userContext);
    const timeline = await this.generateTimeline(insights, workstreams, userContext);
    const riskRegister = await this.generateRiskRegister(insights);
    const stageGates = await this.generateStageGates(timeline, riskRegister);

    // ===== PHASE 1: DATA VALIDATION & CORRECTION =====
    // Validate and auto-correct all logical constraints BEFORE building dependent components
    let validation = this.validateEPMData(workstreams, timeline, stageGates);
    
    if (validation.errors.length > 0) {
      console.log('\n[EPM Synthesis] Data validation found issues:');
      validation.errors.forEach(err => console.warn(`  ❌ ${err}`));
      console.log('\n[EPM Synthesis] Auto-corrections applied:');
      validation.corrections.forEach(corr => console.log(`  ✓ ${corr}`));
      console.log('');
      
      // ALWAYS fully regenerate timeline/phases/gates after ANY validation corrections
      // This ensures critical path, phases, and gates reflect corrected workstream dates
      console.log('[EPM Synthesis] Fully regenerating timeline, phases, critical path, and stage gates...');
      
      // FULLY regenerate timeline (including critical path, phases, confidence)
      const regeneratedTimeline = await this.generateTimeline(insights, workstreams, userContext);
      Object.assign(timeline, regeneratedTimeline);
      
      // Regenerate stage gates based on new timeline
      const regeneratedStageGates = await this.generateStageGates(timeline, riskRegister);
      Object.assign(stageGates, regeneratedStageGates);
      
      // Re-validate after complete regeneration to catch any cascading issues
      validation = this.validateEPMData(workstreams, timeline, stageGates);
      if (validation.errors.length > 0) {
        console.log('[EPM Synthesis] Re-validation after timeline regeneration:');
        validation.corrections.forEach(corr => console.log(`  ✓ ${corr}`));
      }
    }

    // ===== PHASE 2: PLANNING GRID ANALYSIS =====
    // Analyze resource utilization and identify conflicts (using VALIDATED data)
    const gridAnalysis = this.analyzePlanningGrid(workstreams, timeline);
    
    if (gridAnalysis.conflicts.length > 0) {
      console.log('[EPM Synthesis] Planning grid analysis:');
      console.log(`  Max utilization: ${gridAnalysis.maxUtilization} parallel tasks`);
      console.log('\n  Resource conflicts detected:');
      gridAnalysis.conflicts.forEach(conflict => console.warn(`  ⚠️  ${conflict}`));
      console.log('');
      
      // TODO: Phase 3 - If conflicts exceed threshold, call LLM optimization
      // For now, we log warnings but allow generation to continue
    }
    
    // NOW generate downstream components using VALIDATED workstreams/timeline
    const resourcePlan = await this.generateResourcePlan(insights, workstreams, userContext, initiativeType);
    const financialPlan = await this.generateFinancialPlan(insights, resourcePlan, userContext);
    const benefitsRealization = await this.generateBenefitsRealization(insights, timeline);
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

    return {
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
  }

  /**
   * Build EPM program using INTELLIGENT PLANNING system
   * Used when INTELLIGENT_PLANNING_ENABLED is true
   * 
   * Architecture: 
   * 1. Generate timeline-independent components (workstreams, resources, financial plan)
   * 2. Call intelligent planning to build optimized timeline via CPM scheduling
   * 3. Generate timeline-dependent components (stage gates, benefits, KPIs) using optimized timeline
   */
  private async buildWithIntelligentPlanning(
    insights: StrategyInsights,
    userContext?: UserContext,
    namingContext?: any,
    onProgress?: (event: any) => void,
    initiativeType?: string  // EXPLICIT: Initiative type from database
  ): Promise<EPMProgram> {
    
    // Track total elapsed time for progress updates
    const startTime = Date.now();
    
    // Generate program name
    const programName = await this.generateProgramName(insights, userContext, namingContext);
    
    // REMOVED MUTATION: Initiative type is now passed explicitly as a parameter
    // No longer mutating insights.initiativeType - single source of truth from database
    
    // PHASE 1: Generate timeline-INDEPENDENT components
    const executiveSummary = await this.generateExecutiveSummary(insights, programName);
    const workstreams = await this.generateWorkstreams(insights, userContext, onProgress, startTime);
    const riskRegister = await this.generateRiskRegister(insights);
    const resourcePlan = await this.generateResourcePlan(insights, workstreams, userContext, initiativeType);
    const financialPlan = await this.generateFinancialPlan(insights, resourcePlan, userContext);
    const stakeholderMap = await this.generateStakeholderMap(insights);
    const governance = await this.generateGovernance(insights, stakeholderMap);
    const qaPlan = await this.generateQAPlan(insights);
    const procurement = await this.generateProcurement(insights, financialPlan);
    const exitStrategy = await this.generateExitStrategy(insights, riskRegister);
    
    // PHASE 2: Call intelligent planning for CPM timeline generation
    // Create minimal program for intelligent planning input
    const placeholderTimeline: Timeline = {
      totalMonths: 12, // Placeholder for intelligent planning
      phases: [],
      criticalPath: [],
      confidence: 0
    };
    
    const minimalProgram: EPMProgram = {
      frameworkType: insights.frameworkType,
      frameworkRunId: insights.frameworkRunId,
      generatedAt: new Date(),
      overallConfidence: 0,
      extractionRationale: this.generateExtractionRationale(insights, userContext),
      executiveSummary,
      workstreams,
      timeline: placeholderTimeline,
      resourcePlan,
      financialPlan,
      benefitsRealization: {} as BenefitsRealization, // Will generate after timeline
      riskRegister,
      stageGates: {} as StageGates, // Will generate after timeline
      kpis: {} as KPIs, // Will generate after timeline
      stakeholderMap,
      governance,
      qaPlan,
      procurement,
      exitStrategy,
    };
    
    try {
      // Build planning context with business scale inference
      console.log('\n' + '='.repeat(80));
      console.log('[EPM Synthesis] 🚀 CALLING INTELLIGENT PLANNING FOR CPM TIMELINE');
      console.log('='.repeat(80));
      
      // DEBUG: Verify sessionId is present
      console.log('[DEBUG] 🔍 Checking sessionId propagation:');
      console.log(`  userContext exists: ${!!userContext}`);
      console.log(`  userContext.sessionId: ${userContext?.sessionId || 'UNDEFINED'}`);
      console.log(`  insights keys:`, Object.keys(insights));
      
      const planningContext = await ContextBuilder.fromJourneyInsights(
        insights,
        insights.frameworkType || 'strategy_workspace',
        userContext?.sessionId  // Pass sessionId if available from userContext
      );
      
      // REMOVED MUTATION: Initiative type was already passed explicitly to generateResourcePlan
      // No longer mutating insights.initiativeType - explicit parameter passing ensures single source of truth
      
      console.log('[EPM Synthesis] 📋 PLANNING CONTEXT BEING PASSED:');
      console.log(`  Business Name: "${planningContext.business.name}"`);
      console.log(`  Business Type: ${planningContext.business.type}`);
      console.log(`  Business Scale: ${planningContext.business.scale}`);
      console.log(`  Timeline Range: ${planningContext.execution.timeline.min}-${planningContext.execution.timeline.max} months`);
      console.log(`  Budget Range: $${planningContext.execution.budget?.min || 'N/A'} - $${planningContext.execution.budget?.max || 'N/A'}`);
      
      console.log('\n[EPM Synthesis] 📦 WORKSTREAMS BEING PASSED TO INTELLIGENT PLANNING:');
      minimalProgram.workstreams.forEach((ws, idx) => {
        console.log(`  ${idx + 1}. ${ws.name} (${ws.id})`);
        console.log(`     - ${ws.deliverables.length} deliverables`);
        console.log(`     - Dependencies: ${ws.dependencies.length > 0 ? ws.dependencies.join(', ') : 'None'}`);
      });
      
      console.log('\n[EPM Synthesis] ⚙️  CALLING INTELLIGENT PLANNING ORCHESTRATOR...');
      console.log(`  Max Duration: ${planningContext.execution.timeline.max} months`);
      console.log(`  Total Budget: $${financialPlan.totalBudget}`);
      console.log('─'.repeat(80));
      
      const planningResult = await replaceTimelineGeneration(
        minimalProgram,
        planningContext,
        { 
          maxDuration: planningContext.execution.timeline.max,
          budget: financialPlan.totalBudget
        },
        onProgress  // Pass through the progress callback
      );
      
      console.log('\n[EPM Synthesis] 📊 INTELLIGENT PLANNING ORCHESTRATOR RETURNED:');
      console.log(`  Success: ${planningResult.success ? '✓ YES' : '✗ NO'}`);
      console.log(`  Confidence: ${planningResult.confidence}%`);
      console.log(`  Warnings: ${planningResult.warnings?.length || 0}`);
      
      if (planningResult.success) {
        console.log(`[EPM Synthesis] ✅ Intelligent planning succeeded with ${planningResult.confidence}% confidence`);
        if (planningResult.warnings && planningResult.warnings.length > 0) {
          console.log('[EPM Synthesis] ⚠️  Planning warnings:', planningResult.warnings);
        }
        
        // PHASE 3: Generate timeline-DEPENDENT components using optimized timeline
        const optimizedProgram = planningResult.program;
        const optimizedTimeline = optimizedProgram.timeline;
        
        console.log('[EPM Synthesis] Generating timeline-dependent components with optimized schedule...');
        const stageGates = await this.generateStageGates(optimizedTimeline, riskRegister);
        const benefitsRealization = await this.generateBenefitsRealization(insights, optimizedTimeline);
        const kpis = await this.generateKPIs(insights, benefitsRealization);
        
        // Update program with timeline-dependent components
        optimizedProgram.stageGates = stageGates;
        optimizedProgram.benefitsRealization = benefitsRealization;
        optimizedProgram.kpis = kpis;
        
        // Calculate overall confidence
        optimizedProgram.overallConfidence = this.calculateOverallConfidence([
          optimizedProgram.executiveSummary.confidence,
          optimizedProgram.timeline.confidence || planningResult.confidence / 100,
          optimizedProgram.resourcePlan.confidence,
          optimizedProgram.financialPlan.confidence,
          benefitsRealization.confidence,
          optimizedProgram.riskRegister.confidence,
          stageGates.confidence,
          kpis.confidence,
          optimizedProgram.stakeholderMap.confidence,
          optimizedProgram.governance.confidence,
          optimizedProgram.qaPlan.confidence,
          optimizedProgram.procurement.confidence,
          optimizedProgram.exitStrategy.confidence,
        ]);
        
        return optimizedProgram;
      } else {
        console.warn('[EPM Synthesis] ⚠️  Intelligent planning unsuccessful, falling back to old system');
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
    } catch (error) {
      console.error('[EPM Synthesis] ❌ Intelligent planning failed:', error);
      console.error('[EPM Synthesis] Falling back to old system');
      return await this.buildWithOldSystem(insights, userContext, namingContext);
    }
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

  /**
   * Generate workstreams using WBS Builder for semantic analysis
   * Replaces blind workstream generation with business-intent-aware pattern matching
   */
  private async generateWorkstreams(
    insights: StrategyInsights, 
    userContext?: UserContext,
    onProgress?: (event: any) => void,
    startTime?: number  // Optional start time for elapsed tracking
  ): Promise<Workstream[]> {
    console.log('\n' + '='.repeat(80));
    console.log('[EPM Synthesis] 📊 GENERATING WORKSTREAMS USING WBS BUILDER');
    console.log('='.repeat(80));
    
    // Use provided start time or create new one
    const processStartTime = startTime || Date.now();
    
    try {
      // Build planning context for WBS analysis
      console.log('[EPM Synthesis] Step 1: Building planning context from insights...');
      const planningContext = await ContextBuilder.fromJourneyInsights(
        insights,
        insights.frameworkType || 'strategy_workspace',
        userContext?.sessionId  // Pass sessionId if available from userContext
      );
      
      console.log('[EPM Synthesis] ✓ Planning Context Created:');
      console.log(`  Business Name: "${planningContext.business.name}"`);
      console.log(`  Business Type: ${planningContext.business.type}`);
      console.log(`  Business Scale: ${planningContext.business.scale}`);
      console.log(`  Timeline Range: ${planningContext.execution.timeline.min}-${planningContext.execution.timeline.max} months`);
      console.log(`  Budget Range: $${planningContext.execution.budget?.min || 'N/A'} - $${planningContext.execution.budget?.max || 'N/A'}`);
      console.log(`  Total Insights: ${insights.insights.length}`);
      console.log(`  Framework Type: ${insights.frameworkType}`);
      
      // Create WBS Builder with LLM provider and progress callback
      console.log('\n[EPM Synthesis] Step 2: Creating WBS Builder with LLM provider...');
      const wbsBuilder = createWBSBuilder(this.llm, (current, total, workstreamName) => {
        // Emit WBS workstream generation progress with elapsed time
        if (onProgress) {
          const elapsedSeconds = Math.round((Date.now() - processStartTime) / 1000);
          onProgress({
            type: 'step-start',
            step: 'wbs-generation',
            progress: Math.round((current / total) * 100),
            description: `Generating workstream ${current}/${total}: ${workstreamName}`,
            elapsedSeconds
          });
        }
      });
      console.log('[EPM Synthesis] ✓ WBS Builder created');
      
      // Generate semantically coherent WBS
      console.log('\n[EPM Synthesis] Step 3: Calling WBS Builder to generate workstreams...');
      console.log('[EPM Synthesis] >>> Passing to WBS Builder:');
      console.log(`  - Insights count: ${insights.insights.length}`);
      console.log(`  - Planning context: Business=${planningContext.business.name}, Scale=${planningContext.business.scale}`);
      
      const wbs = await wbsBuilder.buildWBS(insights, planningContext);
      
      // Log WBS results
      console.log('\n[EPM Synthesis] ✓ WBS Builder Completed Successfully!');
      console.log('[EPM Synthesis] 📋 WBS BUILDER RESULTS:');
      console.log('─'.repeat(80));
      console.log(`  Initiative Type: ${wbs.intent.initiativeType}`);
      console.log(`  Technology Role: ${wbs.intent.technologyRole}`);
      console.log(`  Total Workstreams: ${wbs.workstreams.length}`);
      console.log(`  Validation Status: ${wbs.validationReport.isValid ? '✓ PASSED' : '✗ FAILED'}`);
      console.log(`  Coherence Score: ${(wbs.validationReport.coherenceScore * 100).toFixed(1)}%`);
      console.log(`  Confidence: ${(wbs.intent.confidence * 100).toFixed(1)}%`);
      
      console.log('\n[EPM Synthesis] 📦 WORKSTREAMS GENERATED BY WBS:');
      wbs.workstreams.forEach((ws, idx) => {
        console.log(`\n  Workstream ${idx + 1}: ${ws.name} (${ws.id})`);
        console.log(`    Description: ${ws.description.substring(0, 100)}...`);
        console.log(`    Deliverables: ${ws.deliverables.length}`);
        ws.deliverables.forEach((d, di) => {
          // WBS deliverables are strings at this point, not objects
          const delivName = typeof d === 'string' ? d : (d as any).name || 'Unknown';
          console.log(`      ${di + 1}. ${delivName}`);
        });
        console.log(`    Dependencies: ${ws.dependencies.length > 0 ? ws.dependencies.join(', ') : 'None'}`);
        console.log(`    Confidence: ${(ws.confidence * 100).toFixed(1)}%`);
      });
      
      // Convert WBS workstreams to EPM format
      console.log('\n[EPM Synthesis] Step 4: Converting WBS workstreams to EPM format...');
      const workstreams: Workstream[] = wbs.workstreams.map((ws, index) => {
        // Convert WBS deliverables (strings) to EPM deliverables (objects with due dates)
        const deliverables = ws.deliverables.map((delivName, delIndex) => ({
          id: `${ws.id}-D${delIndex + 1}`,
          name: delivName,
          description: delivName, // Use deliverable name as description
          dueMonth: 0, // Will be filled by intelligent planning
          responsible: 'TBD',
          effort: '1 person-month', // Effort as string
          confidence: ws.confidence
        }));
        
        return {
          id: ws.id,
          name: ws.name,
          description: ws.description,
          deliverables,
          startMonth: 0, // Will be filled by intelligent planning
          endMonth: 0, // Will be filled by intelligent planning
          dependencies: ws.dependencies,
          confidence: ws.confidence,
        };
      });
      
      // Ensure minimum 3 workstreams
      if (workstreams.length < 3) {
        console.warn('[EPM Synthesis] WBS generated less than 3 workstreams, adding defaults');
        workstreams.push(...this.generateDefaultWorkstreams(3 - workstreams.length));
      }
      
      console.log(`\n[EPM Synthesis] ✓ Successfully converted ${workstreams.length} workstreams to EPM format`);
      console.log('[EPM Synthesis] 📊 EPM WORKSTREAMS READY FOR INTELLIGENT PLANNING:');
      workstreams.forEach((ws, idx) => {
        console.log(`  ${idx + 1}. ${ws.name} (${ws.id})`);
        console.log(`     - Deliverables: ${ws.deliverables.length}`);
        console.log(`     - Dependencies: ${ws.dependencies.length > 0 ? ws.dependencies.join(', ') : 'None'}`);
      });
      console.log('='.repeat(80) + '\n');
      
      return workstreams;
      
    } catch (error) {
      console.error('[EPM Synthesis] WBS Builder failed, falling back to legacy generation:', error);
      
      // Fallback to legacy workstream generation
      const workstreamInsights = insights.insights.filter(i => i.type === 'workstream');
      
      const workstreams: Workstream[] = workstreamInsights.map((insight, index) => {
        const deliverables = this.generateDeliverables(insight, index);
        
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
        workstreams.push(...this.generateDefaultWorkstreams(3 - workstreams.length));
      }

      return workstreams;
    }
  }

  /**
   * PHASE 1: Comprehensive data validation and auto-correction
   * Validates all logical constraints: deliverables, dependencies, phases, gates
   */
  private validateEPMData(
    workstreams: Workstream[],
    timeline: Timeline,
    stageGates: StageGates
  ): { errors: string[]; corrections: string[] } {
    const errors: string[] = [];
    const corrections: string[] = [];

    // 1. Validate deliverables are within workstream bounds
    for (const workstream of workstreams) {
      for (const deliverable of workstream.deliverables) {
        if (deliverable.dueMonth < workstream.startMonth || deliverable.dueMonth > workstream.endMonth) {
          const originalDueMonth = deliverable.dueMonth;
          deliverable.dueMonth = Math.max(
            workstream.startMonth,
            Math.min(deliverable.dueMonth, workstream.endMonth)
          );
          
          errors.push(
            `Deliverable "${deliverable.name}" at M${originalDueMonth} outside workstream ` +
            `"${workstream.name}" (M${workstream.startMonth}-M${workstream.endMonth})`
          );
          corrections.push(`Clamped deliverable "${deliverable.name}" to M${deliverable.dueMonth}`);
        }
      }
    }

    // 2. Validate dependencies exist and are logically ordered
    const workstreamsWithAdjustedDates: string[] = [];
    
    for (const workstream of workstreams) {
      const validDependencies: string[] = [];
      
      for (const depId of workstream.dependencies) {
        const dependency = workstreams.find(w => w.id === depId);
        
        if (!dependency) {
          errors.push(`Workstream "${workstream.name}" depends on non-existent "${depId}"`);
          corrections.push(`Removed invalid dependency "${depId}" from "${workstream.name}"`);
          continue;
        }
        
        // Check if dependency finishes before dependent starts
        if (dependency.endMonth >= workstream.startMonth) {
          errors.push(
            `Invalid dependency: "${workstream.name}" (M${workstream.startMonth}) ` +
            `starts before "${dependency.name}" ends (M${dependency.endMonth})`
          );
          
          // Auto-correct: Push dependent workstream start date
          const oldStart = workstream.startMonth;
          workstream.startMonth = dependency.endMonth + 1;
          
          // Also push end date to maintain duration
          const duration = workstream.endMonth - oldStart;
          workstream.endMonth = workstream.startMonth + duration;
          
          corrections.push(
            `Adjusted "${workstream.name}" to M${workstream.startMonth}-M${workstream.endMonth} ` +
            `to respect dependency on "${dependency.name}"`
          );
          
          // Track that this workstream had date changes
          workstreamsWithAdjustedDates.push(workstream.id);
        }
        
        validDependencies.push(depId);
      }
      
      workstream.dependencies = validDependencies;
    }

    // RE-VALIDATE: After dependency adjustments, re-check deliverables against NEW dates
    if (workstreamsWithAdjustedDates.length > 0) {
      for (const workstream of workstreams) {
        if (workstreamsWithAdjustedDates.includes(workstream.id)) {
          for (const deliverable of workstream.deliverables) {
            if (deliverable.dueMonth < workstream.startMonth || deliverable.dueMonth > workstream.endMonth) {
              const originalDueMonth = deliverable.dueMonth;
              deliverable.dueMonth = Math.max(
                workstream.startMonth,
                Math.min(deliverable.dueMonth, workstream.endMonth)
              );
              
              corrections.push(
                `Re-clamped deliverable "${deliverable.name}" to M${deliverable.dueMonth} ` +
                `after "${workstream.name}" date adjustment`
              );
            }
          }
        }
      }
    }

    // 3. Validate phases don't overlap
    const sortedPhases = [...timeline.phases].sort((a, b) => a.phase - b.phase);
    for (let i = 1; i < sortedPhases.length; i++) {
      const prevPhase = sortedPhases[i - 1];
      const currPhase = sortedPhases[i];
      
      if (currPhase.startMonth <= prevPhase.endMonth) {
        errors.push(
          `Phase ${currPhase.phase} "${currPhase.name}" overlaps with ` +
          `Phase ${prevPhase.phase} "${prevPhase.name}"`
        );
        
        const oldStart = currPhase.startMonth;
        currPhase.startMonth = prevPhase.endMonth + 1;
        
        corrections.push(
          `Adjusted Phase ${currPhase.phase} start from M${oldStart} to M${currPhase.startMonth}`
        );
      }
    }

    // 4. Validate stage gates align with phases
    for (const gate of stageGates.gates) {
      const phase = timeline.phases.find(p =>
        gate.month >= p.startMonth && gate.month <= p.endMonth
      );
      
      if (!phase) {
        errors.push(`Stage gate ${gate.gate} at M${gate.month} not within any phase`);
        
        // Auto-correct: Move to nearest phase end
        const nearestPhase = timeline.phases.reduce((prev, curr) =>
          Math.abs(curr.endMonth - gate.month) < Math.abs(prev.endMonth - gate.month) ? curr : prev
        );
        
        const oldMonth = gate.month;
        gate.month = nearestPhase.endMonth;
        
        corrections.push(
          `Moved gate ${gate.gate} from M${oldMonth} to M${gate.month} (end of Phase ${nearestPhase.phase})`
        );
      }
    }

    return { errors, corrections };
  }

  /**
   * PHASE 2: Planning Grid Analysis
   * Creates month-by-month view to identify resource conflicts
   */
  private analyzePlanningGrid(workstreams: Workstream[], timeline: Timeline) {
    interface MonthCell {
      month: number;
      tasks: Array<{ id: string; name: string; confidence: number }>;
      deliverables: Array<{ id: string; name: string; workstreamId: string }>;
      phase: string | null;
      utilization: number;
    }

    const grid: MonthCell[] = [];
    const conflicts: string[] = [];

    // Initialize grid for each month
    for (let m = 0; m <= timeline.totalMonths; m++) {
      const phase = timeline.phases.find(p => m >= p.startMonth && m <= p.endMonth);
      
      grid[m] = {
        month: m,
        tasks: [],
        deliverables: [],
        phase: phase?.name || null,
        utilization: 0
      };
    }

    // Place workstreams across their duration
    for (const ws of workstreams) {
      for (let m = ws.startMonth; m <= ws.endMonth; m++) {
        if (grid[m]) {
          grid[m].tasks.push({
            id: ws.id,
            name: ws.name,
            confidence: ws.confidence
          });
          grid[m].utilization += 1;
        }
      }

      // Place deliverables at their due month
      for (const deliverable of ws.deliverables) {
        if (grid[deliverable.dueMonth]) {
          grid[deliverable.dueMonth].deliverables.push({
            id: deliverable.id,
            name: deliverable.name,
            workstreamId: ws.id
          });
        }
      }
    }

    // Identify resource conflicts
    for (const month of grid) {
      if (month.utilization > 3) {
        conflicts.push(
          `Month ${month.month} (${month.phase || 'No phase'}): ` +
          `${month.utilization} parallel tasks (max recommended: 3)`
        );
      }

      // Check if too many deliverables in one month
      if (month.deliverables.length > 5) {
        conflicts.push(
          `Month ${month.month}: ${month.deliverables.length} deliverables due ` +
          `(may overwhelm review capacity)`
        );
      }
    }

    return {
      grid,
      conflicts,
      maxUtilization: Math.max(...grid.map(m => m.utilization)),
      totalTasks: workstreams.length
    };
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
    
    // Determine base duration from urgency
    let baseMonths = 12; // Default: strategic timeline
    if (insights.marketContext.urgency === 'ASAP') {
      baseMonths = 6;
    } else if (insights.marketContext.urgency === 'Exploratory') {
      baseMonths = 18;
    }
    
    // Check hard deadlines
    let deadlineMonths = baseMonths;
    if (userContext?.hardDeadlines && userContext.hardDeadlines.length > 0) {
      const earliestDeadline = Math.min(...userContext.hardDeadlines.map(d => 
        Math.ceil((d.date.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000))
      ));
      deadlineMonths = earliestDeadline;
    }

    // CRITICAL: Ensure timeline accommodates ALL workstreams (including corrected ones)
    // totalMonths = MAX(urgency duration, actual workstream needs)
    // Hard deadlines are informational but cannot truncate the validated schedule
    let maxWorkstreamEnd = baseMonths;
    if (workstreams.length > 0) {
      maxWorkstreamEnd = Math.max(...workstreams.map(w => w.endMonth));
    }

    // Use the maximum of all constraints - corrected workstreams take precedence
    const totalMonths = Math.max(baseMonths, maxWorkstreamEnd);
    
    // Log warning if hard deadline is exceeded
    if (deadlineMonths < totalMonths && userContext?.hardDeadlines) {
      console.warn(
        `[EPM Synthesis] Hard deadline at M${deadlineMonths} exceeded by corrected schedule (M${totalMonths}). ` +
        `Consider resource optimization or deadline renegotiation.`
      );
    }

    // Generate phases (ensuring final phase covers totalMonths)
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
    userContext?: UserContext,
    initiativeType?: string  // EXPLICIT: Initiative type passed from parent
  ): Promise<ResourcePlan> {
    const resourceInsights = insights.insights.filter(i => i.type === 'resource');
    
    // Estimate FTE needs based on workstreams
    const estimatedFTEs = Math.max(8, Math.min(workstreams.length * 2, 20));
    
    // Use explicit initiative type parameter (fallback to 'other' if undefined)
    const finalInitiativeType = initiativeType || 'other';
    console.log('[Resource Generation] 🎯 Initiative type source:');
    console.log(`  Passed parameter: ${initiativeType || 'UNDEFINED'}`);
    console.log(`  Final value used: ${finalInitiativeType}`);
    
    const internalTeam = await this.generateInternalTeam(
      estimatedFTEs, 
      workstreams, 
      resourceInsights,
      finalInitiativeType,
      insights
    );
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

  /**
   * Initiative-aware internal team generation
   * Uses LLM to generate contextually appropriate roles with fallback templates
   */
  private async generateInternalTeam(
    estimatedFTEs: number, 
    workstreams: Workstream[], 
    resourceInsights: StrategyInsight[],
    initiativeType: string,
    insights: StrategyInsights
  ) {
    console.log(`[Resource Generation] 🎯 Generating team for initiative type: ${initiativeType}`);
    
    try {
      // Try LLM-based generation first
      const llmRoles = await this.generateRolesWithLLM(
        initiativeType,
        estimatedFTEs,
        workstreams,
        insights
      );
      
      if (llmRoles && llmRoles.length > 0) {
        console.log(`[Resource Generation] ✅ LLM generated ${llmRoles.length} initiative-appropriate roles`);
        return llmRoles;
      }
      
      console.warn('[Resource Generation] ⚠️ LLM returned empty roles, falling back to templates');
    } catch (error) {
      console.error('[Resource Generation] ⚠️ LLM generation failed, using fallback templates:', error);
      console.error('[Resource Generation] Error details:', error instanceof Error ? error.message : String(error));
    }
    
    // Fallback to templates if LLM fails
    console.log(`[Resource Generation] 📋 Using fallback template for ${initiativeType}`);
    console.log('[Resource Generation] ⚠️ NOTE: Fallback roles are generic - LLM should be fixed to provide context-appropriate roles');
    return this.getFallbackRoles(initiativeType, estimatedFTEs, workstreams);
  }
  
  /**
   * Generate roles using LLM for context-aware team composition
   */
  private async generateRolesWithLLM(
    initiativeType: string,
    estimatedFTEs: number,
    workstreams: Workstream[],
    insights: StrategyInsights
  ): Promise<any[]> {
    const workstreamSummary = workstreams.map(w => `- ${w.name} (${w.deliverables.length} deliverables)`).join('\n');
    const timeline = workstreams[0]?.endMonth || 12;
    
    // Extract business description from insights
    const businessDescription = insights.insights
      .find(i => i.type === 'other' || i.content.includes('business') || i.content.includes('initiative'))
      ?.content.substring(0, 200)?.trim() || 'a new business initiative';
    
    // Log business context for debugging
    console.log(`[Resource Generation] Business context: "${businessDescription.substring(0, 100)}..."`);
    console.log(`[Resource Generation] Initiative type: ${initiativeType}`);
    
    const prompt = `Generate an internal team structure for this initiative.

BUSINESS DESCRIPTION: ${businessDescription}
INITIATIVE TYPE: ${initiativeType}
WORKSTREAMS (${workstreams.length}):
${workstreamSummary}

PROJECT TIMELINE: ${timeline} months
ESTIMATED TEAM SIZE: ${estimatedFTEs} FTEs

Generate ${Math.min(6, estimatedFTEs)} key roles that are APPROPRIATE for this specific business and initiative type.

CRITICAL: Match roles to the ACTUAL BUSINESS described above, not generic templates:
- For physical retail/food businesses: Store Manager, Barista, Server, Chef, Sales Associate, etc.
- For educational/training facilities: Director of Education, Lead Instructor, Curriculum Developer, Student Advisor, etc.
- For software development: Software Engineer, DevOps Engineer, QA Engineer, Product Manager, UX Designer, etc.
- For digital transformation: Digital Strategy Lead, Change Manager, Integration Specialist, Training Coordinator, etc.
- For market expansion: Market Research Analyst, Regional Manager, Business Development, Localization Specialist, etc.
- For product launch: Product Manager, Marketing Manager, Supply Chain Coordinator, Sales Enablement, etc.
- For service launch: Service Designer, Operations Manager, Training Specialist, Customer Success Manager, etc.

For each role, provide:
- role: Job title (MUST match the actual business - e.g., "Lead AI Tutor" for tutoring center, NOT "Barista")
- allocation: % time (50-100)
- months: Duration on project (1-${timeline})
- skills: Array of 3-5 relevant skills
- justification: Why this role is needed

Return ONLY valid JSON array of role objects. NO markdown, NO code blocks, ONLY the JSON array.`;

    const response = await aiClients.callWithFallback({
      systemPrompt: 'You are an HR and resource planning expert. Generate ONLY valid JSON matching the requested format. NO markdown code blocks. The roles MUST match the specific business being described.',
      userMessage: prompt,
      maxTokens: 2000,
    });
    
    const content = response.content;
    
    // Parse JSON response
    try {
      const roles = JSON.parse(content);
      if (Array.isArray(roles) && roles.length > 0) {
        console.log(`[Resource Generation] ✅ Successfully generated ${roles.length} context-appropriate roles`);
        return roles;
      }
    } catch (parseError) {
      console.error('[Resource Generation] Failed to parse LLM response:', parseError);
      console.error('[Resource Generation] Raw response:', content);
    }
    
    return [];
  }
  
  /**
   * Fallback role templates for each initiative type
   * Ensures we ALWAYS get contextually appropriate roles
   */
  private getFallbackRoles(
    initiativeType: string,
    estimatedFTEs: number,
    workstreams: Workstream[]
  ): any[] {
    const timeline = workstreams[0]?.endMonth || 12;
    const justification = `Required for ${workstreams.length} workstreams across ${timeline} months`;
    
    const templates: Record<string, any[]> = {
      physical_business_launch: [
        { role: 'Operations Manager', allocation: 100, months: timeline, skills: ['Business operations', 'Team leadership', 'Resource management'], justification },
        { role: 'Program Manager', allocation: 100, months: timeline, skills: ['Program planning', 'Stakeholder management', 'Project coordination'], justification },
        { role: 'Operations Coordinator', allocation: 75, months: Math.floor(timeline * 0.8), skills: ['Logistics', 'Vendor management', 'Process optimization'], justification },
        { role: 'Business Development Lead', allocation: 75, months: Math.floor(timeline * 0.7), skills: ['Strategy', 'Partnership development', 'Market analysis'], justification },
        { role: 'Marketing Coordinator', allocation: 50, months: Math.floor(timeline * 0.5), skills: ['Local marketing', 'Social media', 'Community engagement'], justification },
      ],
      
      software_development: [
        { role: 'Product Manager', allocation: 100, months: timeline, skills: ['Product strategy', 'Roadmap planning', 'Stakeholder management'], justification },
        { role: 'Tech Lead/Architect', allocation: 100, months: timeline, skills: ['System architecture', 'Technical leadership', 'Code review'], justification },
        { role: 'Software Engineer', allocation: 100, months: timeline, skills: ['Full-stack development', 'API design', 'Database design'], justification },
        { role: 'DevOps Engineer', allocation: 75, months: Math.floor(timeline * 0.8), skills: ['CI/CD', 'Infrastructure', 'Deployment automation'], justification },
        { role: 'QA Engineer', allocation: 75, months: Math.floor(timeline * 0.7), skills: ['Test automation', 'Quality assurance', 'Bug tracking'], justification },
        { role: 'UX/UI Designer', allocation: 50, months: Math.floor(timeline * 0.6), skills: ['User research', 'Interface design', 'Prototyping'], justification },
      ],
      
      digital_transformation: [
        { role: 'Digital Transformation Lead', allocation: 100, months: timeline, skills: ['Change leadership', 'Digital strategy', 'Stakeholder alignment'], justification },
        { role: 'Business Process Analyst', allocation: 100, months: timeline, skills: ['Process mapping', 'Gap analysis', 'Requirements gathering'], justification },
        { role: 'Integration Specialist', allocation: 100, months: Math.floor(timeline * 0.8), skills: ['Systems integration', 'API development', 'Data migration'], justification },
        { role: 'Change Manager', allocation: 75, months: timeline, skills: ['Change management', 'Training delivery', 'Communication'], justification },
        { role: 'Technical Consultant', allocation: 75, months: Math.floor(timeline * 0.7), skills: ['Platform implementation', 'Configuration', 'Technical training'], justification },
      ],
      
      market_expansion: [
        { role: 'Market Expansion Lead', allocation: 100, months: timeline, skills: ['Market entry strategy', 'Partnership development', 'Regional planning'], justification },
        { role: 'Market Research Analyst', allocation: 100, months: Math.floor(timeline * 0.6), skills: ['Market analysis', 'Competitive research', 'Customer insights'], justification },
        { role: 'Regional Manager', allocation: 100, months: Math.floor(timeline * 0.8), skills: ['Regional operations', 'Team building', 'Local execution'], justification },
        { role: 'Business Development Manager', allocation: 75, months: timeline, skills: ['Partnership development', 'Sales strategy', 'Relationship management'], justification },
        { role: 'Localization Specialist', allocation: 50, months: Math.floor(timeline * 0.5), skills: ['Cultural adaptation', 'Translation', 'Local compliance'], justification },
      ],
      
      product_launch: [
        { role: 'Product Launch Manager', allocation: 100, months: timeline, skills: ['Launch planning', 'Cross-functional coordination', 'Go-to-market'], justification },
        { role: 'Product Marketing Manager', allocation: 100, months: Math.floor(timeline * 0.8), skills: ['Positioning', 'Messaging', 'Campaign management'], justification },
        { role: 'Supply Chain Coordinator', allocation: 75, months: Math.floor(timeline * 0.7), skills: ['Inventory planning', 'Vendor management', 'Logistics'], justification },
        { role: 'Sales Enablement Specialist', allocation: 75, months: Math.floor(timeline * 0.6), skills: ['Sales training', 'Collateral development', 'Channel support'], justification },
        { role: 'Customer Success Manager', allocation: 50, months: Math.floor(timeline * 0.5), skills: ['Customer onboarding', 'Support', 'Feedback collection'], justification },
      ],
      
      service_launch: [
        { role: 'Service Design Lead', allocation: 100, months: timeline, skills: ['Service design', 'Process definition', 'Quality standards'], justification },
        { role: 'Operations Manager', allocation: 100, months: timeline, skills: ['Service delivery', 'Resource allocation', 'Performance management'], justification },
        { role: 'Training Specialist', allocation: 75, months: Math.floor(timeline * 0.7), skills: ['Training program design', 'Delivery', 'Certification'], justification },
        { role: 'Service Coordinator', allocation: 75, months: Math.floor(timeline * 0.8), skills: ['Scheduling', 'Client communication', 'Service tracking'], justification },
        { role: 'Quality Assurance Manager', allocation: 50, months: Math.floor(timeline * 0.6), skills: ['Quality monitoring', 'Process improvement', 'Auditing'], justification },
      ],
      
      process_improvement: [
        { role: 'Process Improvement Lead', allocation: 100, months: timeline, skills: ['Lean Six Sigma', 'Process mapping', 'Change leadership'], justification },
        { role: 'Business Analyst', allocation: 100, months: timeline, skills: ['Requirements analysis', 'Data analysis', 'Process documentation'], justification },
        { role: 'Operations Analyst', allocation: 75, months: Math.floor(timeline * 0.8), skills: ['Metrics analysis', 'Bottleneck identification', 'Efficiency optimization'], justification },
        { role: 'Change Manager', allocation: 75, months: Math.floor(timeline * 0.7), skills: ['Stakeholder engagement', 'Training', 'Adoption tracking'], justification },
        { role: 'Process Automation Specialist', allocation: 50, months: Math.floor(timeline * 0.6), skills: ['RPA', 'Workflow automation', 'Tool implementation'], justification },
      ],
      
      other: [
        { role: 'Program Manager', allocation: 100, months: timeline, skills: ['Program management', 'Stakeholder management', 'Risk management'], justification },
        { role: 'Business Analyst', allocation: 100, months: Math.floor(timeline * 0.8), skills: ['Requirements analysis', 'Process mapping', 'Documentation'], justification },
        { role: 'Project Coordinator', allocation: 75, months: timeline, skills: ['Coordination', 'Tracking', 'Communication'], justification },
        { role: 'Subject Matter Expert', allocation: 75, months: Math.floor(timeline * 0.7), skills: ['Domain expertise', 'Advisory', 'Validation'], justification },
        { role: 'Change Manager', allocation: 50, months: Math.floor(timeline * 0.6), skills: ['Change management', 'Training', 'Support'], justification },
      ],
    };
    
    const roles = templates[initiativeType] || templates.other;
    return roles.slice(0, Math.min(estimatedFTEs, roles.length));
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
