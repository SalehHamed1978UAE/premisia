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
    
    try {
      // Step 0: Extract strategy signals from BMC insights (with fallback)
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
      const analysisInput: AnalysisInput = { insights, context, strategyProfile };
      const intent = await this.analyzer.process(analysisInput);
      
      // Step 2: Select work breakdown pattern
      let pattern = await this.patternProvider.process(intent);
      
      // Step 2.5: Apply strategy-based adjustments to pattern (if available)
      if (strategyProfile) {
        const { AdaptivePatternWeighter } = await import('../providers/adaptive-pattern-weighter');
        pattern = AdaptivePatternWeighter.adjustPattern(pattern, strategyProfile);
      } else {
        console.log('[WBS Builder] No strategy profile, using base pattern as-is');
      }
      
      // Step 3: Optimize pattern into concrete workstreams
      const optimizationInput: OptimizationInput = { pattern, context, insights };
      const workstreams = await this.optimizer.process(optimizationInput);
      
      // Step 4: Validate semantic coherence
      const validationInput: ValidationInput = {
        objective: context.business.description,
        context,
        workstreams
      };
      const validationReport = await this.validator.process(validationInput);
      
      // Calculate overall confidence
      const confidence = this.calculateConfidence(
        intent.confidence,
        validationReport.coherenceScore,
        workstreams
      );
      
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
      
    } catch (error) {
      console.error('[WBS Builder] Error during WBS generation:', error);
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
