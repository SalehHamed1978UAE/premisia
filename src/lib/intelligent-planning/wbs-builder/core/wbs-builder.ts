/**
 * WBS Builder - Main orchestrator for work breakdown structure generation
 * Composes pipeline stages to generate semantically coherent workstreams
 */

import { IWBSBuilder, IAnalyzer, IPatternProvider, IOptimizer, IValidator, WBS, AnalysisInput, OptimizationInput, ValidationInput } from '../interfaces';
import { PlanningContext } from '../../types';
import { WBSPipeline } from './wbs-pipeline';

export class WBSBuilder implements IWBSBuilder {
  /**
   * Constructor uses dependency injection for all components
   */
  constructor(
    private analyzer: IAnalyzer,
    private patternProvider: IPatternProvider,
    private optimizer: IOptimizer,
    private validator: IValidator
  ) {
    console.log('[WBS Builder] Initialized with all components');
  }
  
  /**
   * Build complete WBS from insights and context
   * STRATEGY-AWARE: Extracts BMC strategic recommendations before analysis
   */
  async buildWBS(insights: any, context: PlanningContext): Promise<WBS> {
    console.log('[WBS Builder] Starting WBS generation...');
    console.log(`[WBS Builder] Business: ${context.business.name}`);
    console.log(`[WBS Builder] Scale: ${context.business.scale}`);
    console.log(`[WBS Builder] Input insights count: ${insights?.insights?.length || 0}`);
    
    let currentStep = 'initialization';
    let partialWorkstreams: any[] = [];
    let intent: any = null;
    let pattern: any = null;
    
    try {
      // Step 0: Extract strategy signals from BMC insights (with fallback)
      currentStep = 'strategy-extraction';
      let strategyProfile: any = undefined;
      
      try {
        const { StrategySignalExtractor } = await import('../analyzers/strategy-signal-extractor');
        const { StrategyProfiler } = await import('../analyzers/strategy-profiler');
        
        const signals = StrategySignalExtractor.extract(insights);
        strategyProfile = StrategyProfiler.buildProfile(signals);
        
        console.log('[WBS Builder] Strategy profile extracted:');
        console.log(`  - Archetype: ${strategyProfile.archetype}`);
        console.log(`  - Digital intensity: ${strategyProfile.digitalIntensity}%`);
        console.log(`  - Platform needed: ${strategyProfile.needsPlatform}`);
      } catch (error) {
        console.warn('[WBS Builder] Failed to extract strategy profile, using base patterns:', error);
        strategyProfile = undefined; // Continue without strategy profile
      }
      
      // Step 1: Analyze business intent (with strategy awareness)
      currentStep = 'business-analysis';
      console.log('[WBS Builder] Step 1: Analyzing business intent...');
      const analysisInput: AnalysisInput = { insights, context, strategyProfile };
      intent = await this.analyzer.process(analysisInput);
      console.log(`[WBS Builder] Step 1 complete: initiativeType=${intent.initiativeType}, confidence=${intent.confidence}`);
      
      // Step 2: Select work breakdown pattern
      currentStep = 'pattern-selection';
      console.log('[WBS Builder] Step 2: Selecting work breakdown pattern...');
      pattern = await this.patternProvider.process(intent);
      console.log(`[WBS Builder] Step 2 complete: patternId=${pattern.patternId}, streams=${pattern.streams?.length || 0}`);
      
      // Step 2.5: Apply strategy-based adjustments to pattern (if available)
      if (strategyProfile) {
        currentStep = 'pattern-adjustment';
        const { AdaptivePatternWeighter } = await import('../providers/adaptive-pattern-weighter');
        pattern = AdaptivePatternWeighter.adjustPattern(pattern, strategyProfile);
      } else {
        console.log('[WBS Builder] No strategy profile, using base pattern as-is');
      }
      
      // Step 3: Optimize pattern into concrete workstreams
      currentStep = 'stream-optimization';
      console.log('[WBS Builder] Step 3: Optimizing pattern into workstreams...');
      const optimizationInput: OptimizationInput = { pattern, context, insights };
      const workstreams = await this.optimizer.process(optimizationInput);
      partialWorkstreams = workstreams;
      console.log(`[WBS Builder] Step 3 complete: generated ${workstreams.length} workstreams`);
      workstreams.forEach((ws, i) => {
        console.log(`  [${i+1}] ${ws.name} (${ws.id}) - ${ws.deliverables?.length || 0} deliverables`);
      });
      
      // Step 4: Validate semantic coherence
      currentStep = 'semantic-validation';
      console.log('[WBS Builder] Step 4: Validating semantic coherence...');
      const validationInput: ValidationInput = {
        objective: context.business.description,
        context,
        workstreams
      };
      const validationReport = await this.validator.process(validationInput);
      console.log(`[WBS Builder] Step 4 complete: isValid=${validationReport.isValid}, coherenceScore=${validationReport.coherenceScore}`);
      
      // Calculate overall confidence
      currentStep = 'confidence-calculation';
      console.log('[WBS Builder] Step 5: Calculating confidence...');
      const confidence = this.calculateConfidence(
        intent.confidence,
        validationReport.coherenceScore,
        workstreams
      );
      console.log(`[WBS Builder] Step 5 complete: confidence=${confidence}`);
      
      const wbs: WBS = {
        intent,
        pattern,
        workstreams,
        confidence,
        validationReport
      };
      
      console.log('[WBS Builder] ✓ WBS generation complete');
      console.log(`[WBS Builder] Initiative type: ${intent.initiativeType}`);
      console.log(`[WBS Builder] Workstreams: ${workstreams.length}`);
      console.log(`[WBS Builder] Confidence: ${(confidence * 100).toFixed(1)}%`);
      console.log(`[WBS Builder] Validation: ${validationReport.isValid ? 'PASSED' : 'FAILED'}`);
      
      if (!validationReport.isValid) {
        console.warn('[WBS Builder] Validation issues detected:');
        validationReport.issues.forEach(issue => {
          console.warn(`  - ${issue.severity.toUpperCase()}: ${issue.message}`);
        });
      }
      
      return wbs;
      
    } catch (error: any) {
      console.error('╔════════════════════════════════════════════════════════════════════════════════╗');
      console.error('║ [WBS Builder] ❌ CRITICAL FAILURE - FULL DIAGNOSTIC                            ║');
      console.error('╠════════════════════════════════════════════════════════════════════════════════╣');
      console.error(`║ Failed at step: ${currentStep}`);
      console.error(`║ Error message: ${error?.message || 'Unknown error'}`);
      console.error(`║ Partial workstreams generated: ${partialWorkstreams.length}`);
      console.error(`║ Intent captured: ${intent ? 'Yes - ' + intent.initiativeType : 'No'}`);
      console.error(`║ Pattern captured: ${pattern ? 'Yes - ' + pattern.patternId : 'No'}`);
      console.error('╠════════════════════════════════════════════════════════════════════════════════╣');
      console.error('║ FULL STACK TRACE:');
      console.error('╚════════════════════════════════════════════════════════════════════════════════╝');
      console.error(error?.stack || error);
      throw error;
    }
  }
  
  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(
    intentConfidence: number,
    coherenceScore: number,
    workstreams: any[]
  ): number {
    const avgWorkstreamConfidence = workstreams.reduce((sum, ws) => sum + ws.confidence, 0) / workstreams.length;
    
    // Weighted average: 30% intent, 40% coherence, 30% workstreams
    const overall = (intentConfidence * 0.3) + (coherenceScore * 0.4) + (avgWorkstreamConfidence * 0.3);
    
    return Math.min(1, Math.max(0, overall));
  }
}
