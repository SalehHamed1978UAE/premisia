import { domainExtractionService } from './domain-extraction-service.js';
import { pestleClaimsService, type PESTLEFactors } from './pestle-claims-service.js';
import { assumptionComparisonService, type AssumptionComparison } from './assumption-comparison-service.js';
import { trendSynthesisService, type TrendSynthesis, type TrendTelemetry } from './trend-synthesis-service.js';

// Trend analysis result
export interface TrendResult {
  understandingId: string;
  pestleFactors: PESTLEFactors;
  comparisons: AssumptionComparison[];
  synthesis: TrendSynthesis;
  telemetry: TrendTelemetry;
  completedAt: Date;
}

/**
 * Main orchestrator for trend analysis
 * Coordinates all sub-services to produce comprehensive PESTLE analysis
 */
export class TrendAnalysisAgent {
  /**
   * Analyze trends for a strategic understanding
   */
  async analyzeTrends(understandingId: string): Promise<TrendResult> {
    const startTime = Date.now();
    const telemetry = trendSynthesisService.createTelemetry();
    
    console.log(`[TrendAnalysis] Starting analysis for understanding ${understandingId}`);
    
    try {
      // Phase 1: Extract domain context
      console.log('[TrendAnalysis] Phase 1: Extracting domain context...');
      const phase1Start = Date.now();
      const domain = await domainExtractionService.extractDomain(understandingId);
      trendSynthesisService.addLatency(telemetry, Date.now() - phase1Start);
      
      console.log('[TrendAnalysis] Domain extracted:', {
        industry: domain.industry,
        geography: domain.geography,
        language: domain.language,
        assumptionCount: domain.assumptions.length
      });
      
      // Phase 2: Generate PESTLE claims
      console.log('[TrendAnalysis] Phase 2: Generating PESTLE claims...');
      const phase2Start = Date.now();
      const { claims: pestleFactors, provider: pestleProvider } = await pestleClaimsService.generateClaims(domain);
      const phase2Elapsed = Date.now() - phase2Start;
      trendSynthesisService.addLatency(telemetry, phase2Elapsed);
      trendSynthesisService.trackLLMCall(telemetry, pestleProvider);
      
      const totalClaims = this.countClaims(pestleFactors);
      console.log(`[TrendAnalysis] Generated ${totalClaims} PESTLE claims`);
      
      // Phase 3: Compare with assumptions
      console.log('[TrendAnalysis] Phase 3: Comparing with assumptions...');
      const phase3Start = Date.now();
      const flatClaims = pestleClaimsService.flattenClaims(pestleFactors);
      const { comparisons, providers: comparisonProviders } = await assumptionComparisonService.compareWithAssumptions(
        understandingId,
        flatClaims
      );
      const phase3Elapsed = Date.now() - phase3Start;
      trendSynthesisService.addLatency(telemetry, phase3Elapsed);
      
      // Track LLM calls for each assumption comparison
      for (const provider of comparisonProviders) {
        if (provider !== 'unknown') {
          trendSynthesisService.trackLLMCall(telemetry, provider);
        }
      }
      
      // Filter significant comparisons
      const significantComparisons = assumptionComparisonService.filterSignificantComparisons(
        comparisons,
        0.6 // 60% confidence threshold
      );
      
      const stats = assumptionComparisonService.getSummaryStats(significantComparisons);
      console.log('[TrendAnalysis] Comparison stats:', stats);
      
      // Phase 4: Generate synthesis
      console.log('[TrendAnalysis] Phase 4: Generating synthesis...');
      const synthesis = await trendSynthesisService.generateSynthesis(
        domain,
        pestleFactors,
        significantComparisons,
        telemetry
      );
      
      // Synthesis service already added its latency to telemetry
      // All phases have accumulated their latency, so telemetry.totalLatencyMs is complete
      
      console.log(`[TrendAnalysis] Analysis complete in ${telemetry.totalLatencyMs}ms`);
      console.log('[TrendAnalysis] Telemetry:', telemetry);
      
      return {
        understandingId,
        pestleFactors,
        comparisons: significantComparisons,
        synthesis,
        telemetry,
        completedAt: new Date()
      };
    } catch (error) {
      console.error('[TrendAnalysis] Error during analysis:', error);
      trendSynthesisService.trackRetry(telemetry);
      throw error;
    }
  }

  /**
   * Count total claims across all PESTLE domains
   */
  private countClaims(pestleFactors: PESTLEFactors): number {
    return (
      pestleFactors.political.length +
      pestleFactors.economic.length +
      pestleFactors.social.length +
      pestleFactors.technological.length +
      pestleFactors.legal.length +
      pestleFactors.environmental.length
    );
  }

  /**
   * Get analysis status summary
   */
  getStatusSummary(result: TrendResult) {
    const claimCount = this.countClaims(result.pestleFactors);
    const assumptionCount = result.comparisons.length;
    const stats = assumptionComparisonService.getSummaryStats(result.comparisons);
    
    return {
      claimCount,
      assumptionCount,
      validatedAssumptions: stats.validated,
      contradictedAssumptions: stats.contradicted,
      neutralAssumptions: stats.neutral,
      validationRate: stats.validationRate,
      contradictionRate: stats.contradictionRate,
      keyFindings: result.synthesis.keyFindings.length,
      recommendedActions: result.synthesis.recommendedActions.length,
      telemetry: result.telemetry
    };
  }
}

// Export singleton instance
export const trendAnalysisAgent = new TrendAnalysisAgent();
