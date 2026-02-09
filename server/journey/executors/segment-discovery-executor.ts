import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext } from '@shared/journey-types';
import { 
  segmentDiscoveryEngine, 
  type DiscoveryContext,
  type GeneLibrary,
  type Genome,
  type SegmentSynthesis 
} from '../../services/segment-discovery-engine';

/**
 * Segment Discovery Results returned by the executor
 */
export interface SegmentDiscoveryResults {
  geneLibrary: GeneLibrary;
  genomes: Genome[];
  synthesis: SegmentSynthesis;
  metadata: {
    totalGenomes: number;
    topScore: number;
    businessType: string;
  };
}

/**
 * Segment Discovery Executor
 * Wraps the segment-discovery-engine for use in the journey framework system
 * 
 * This executor enables Marketing Consultant functionality to be composed
 * with other strategic frameworks in multi-step journeys.
 */
export class SegmentDiscoveryExecutor implements FrameworkExecutor {
  name = 'segment_discovery' as const;

  async validate(context: StrategicContext): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];
    
    if (!context.userInput || context.userInput.trim().length < 10) {
      errors.push('Offering description required (minimum 10 characters)');
    }
    
    // Marketing context is required for segment discovery
    if (!context.marketingContext?.offeringType) {
      errors.push('Offering type classification required (e.g., b2b_saas, physical_product)');
    }
    
    return { 
      valid: errors.length === 0, 
      errors: errors.length > 0 ? errors : undefined 
    };
  }

  async execute(context: StrategicContext): Promise<SegmentDiscoveryResults> {
    console.log('[SegmentDiscoveryExecutor] Starting segment discovery...');
    console.log(`  Input: "${context.userInput?.substring(0, 50)}..."`);
    console.log(`  Offering Type: ${context.marketingContext?.offeringType || 'not set'}`);
    
    // Build discovery context from strategic context
    const discoveryContext: DiscoveryContext = {
      offeringDescription: context.userInput,
      offeringType: context.marketingContext?.offeringType || 'physical_product',
      stage: context.marketingContext?.stage || 'idea_stage',
      gtmConstraint: context.marketingContext?.gtmConstraint || 'small_team',
      salesMotion: context.marketingContext?.salesMotion || 'self_serve',
      existingHypothesis: context.marketingContext?.existingHypothesis,
    };
    
    // Run the discovery engine with progress callback
    const result = await segmentDiscoveryEngine.runDiscovery(
      discoveryContext,
      (step, progress) => {
        console.log(`[SegmentDiscoveryExecutor] ${step}: ${progress}%`);
        // If context has a progress callback, forward to it
        if (context.onProgress) {
          context.onProgress(step, progress);
        }
      }
    );
    
    console.log('[SegmentDiscoveryExecutor] Discovery complete');
    console.log(`  Beachhead: ${result.synthesis.beachhead?.genome?.id || 'N/A'}`);
    console.log(`  Total genomes: ${result.genomes.length}`);
    
    return {
      geneLibrary: result.geneLibrary,
      genomes: result.genomes,
      synthesis: result.synthesis,
      metadata: {
        totalGenomes: result.genomes.length,
        topScore: result.genomes[0]?.fitness?.totalScore || 0,
        businessType: discoveryContext.offeringType,
      },
    };
  }
}

export const segmentDiscoveryExecutor = new SegmentDiscoveryExecutor();
