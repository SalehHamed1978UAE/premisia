/**
 * Adaptive Pattern Weighter - Adjusts base patterns using strategy profile
 * Enables same business type to get different workstream mix based on BMC strategy
 */

import type { WorkStreamPattern, WorkStreamCategory } from '../interfaces';
import type { StrategyProfile } from '../interfaces';

export class AdaptivePatternWeighter {
  /**
   * Apply strategy-based adjustments to base pattern
   * 
   * Example: Coffee shop base pattern (35% physical, 10% tech)
   *   + Traditional strategy → No change (35% physical, 10% tech)
   *   + Hybrid strategy → Adjusted (20% physical, 35% platform, 25% operations)
   *   + Digital-first strategy → Adjusted (15% physical, 45% platform, 20% digital marketing)
   */
  static adjustPattern(
    basePattern: WorkStreamPattern,
    strategyProfile: StrategyProfile
  ): WorkStreamPattern {
    console.log('[Adaptive Pattern Weighter] Applying strategy adjustments...');
    console.log(`[Adaptive Pattern Weighter] Base pattern: ${basePattern.initiativeType}`);
    console.log(`[Adaptive Pattern Weighter] Strategy archetype: ${strategyProfile.archetype}`);
    
    // If traditional archetype, use base pattern as-is
    if (strategyProfile.archetype === 'traditional') {
      console.log('[Adaptive Pattern Weighter] Traditional strategy - using base pattern');
      return basePattern;
    }
    
    // Clone base pattern for modification
    const adjustedPattern: WorkStreamPattern = {
      initiativeType: basePattern.initiativeType,
      streams: basePattern.streams.map(s => ({ ...s })),
      totalWeight: 0
    };
    
    // Apply effort adjustments from strategy profile
    if (strategyProfile.effortAdjustments.size > 0) {
      console.log('[Adaptive Pattern Weighter] Applying strategy effort adjustments...');
      
      strategyProfile.effortAdjustments.forEach((targetEffort, category) => {
        const stream = adjustedPattern.streams.find(s => s.category === category);
        if (stream) {
          const oldEffort = stream.weight;
          stream.weight = targetEffort;
          console.log(`[Adaptive Pattern Weighter]   ${category}: ${oldEffort}% → ${targetEffort}%`);
        } else {
          // Strategy recommends a category not in base pattern - add it
          console.log(`[Adaptive Pattern Weighter]   Adding new category: ${category} (${targetEffort}%)`);
          adjustedPattern.streams.push({
            category,
            weight: targetEffort,
            priority: 'high',
            description: `Strategic ${category} workstream`
          });
        }
      });
    }
    
    // Normalize to ensure total is 100%
    const total = adjustedPattern.streams.reduce((sum, s) => sum + s.weight, 0);
    if (Math.abs(total - 100) > 1) {
      console.log(`[Adaptive Pattern Weighter] Normalizing total from ${total}% to 100%`);
      adjustedPattern.streams.forEach(s => {
        s.weight = (s.weight / total) * 100;
      });
    }
    
    adjustedPattern.totalWeight = 100;
    
    console.log('[Adaptive Pattern Weighter] ✓ Pattern adjusted for strategy');
    return adjustedPattern;
  }
  
  /**
   * Check if platform development should be included
   */
  static shouldIncludePlatform(strategyProfile: StrategyProfile): boolean {
    return strategyProfile.needsPlatform;
  }
}
