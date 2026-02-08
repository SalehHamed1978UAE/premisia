/**
 * Strategy Profiler - Converts strategy signals into actionable WBS configuration
 * Determines how to adjust workstream patterns based on strategic recommendations
 */

import type { StrategySignals } from './strategy-signal-extractor';
import type { TechnologyRole, InitiativeType } from '../interfaces';

export interface StrategyProfile {
  digitalIntensity: number;           // 0-100
  archetype: 'traditional' | 'hybrid' | 'digital_first';
  needsPlatform: boolean;
  technologyRoleOverride?: TechnologyRole;  // Override from strategy
  recommendedCategories: string[];    // Workstream categories strategy suggests
  effortAdjustments: Map<string, number>;  // Category → effort % adjustment
}

export class StrategyProfiler {
  /**
   * Build strategy profile from signals
   */
  static buildProfile(signals: StrategySignals): StrategyProfile {
    console.log('[Strategy Profiler] Building strategy profile...');
    
    const archetype = this.determineArchetype(signals);
    const needsPlatform = this.assessPlatformNeed(signals);
    const technologyRoleOverride = this.determineTechRole(signals, archetype);
    const recommendedCategories = this.extractRecommendedCategories(signals);
    const effortAdjustments = this.calculateEffortAdjustments(signals, archetype);
    
    const profile: StrategyProfile = {
      digitalIntensity: signals.digitalIntensity,
      archetype,
      needsPlatform,
      technologyRoleOverride,
      recommendedCategories,
      effortAdjustments
    };
    
    console.log(`[Strategy Profiler] Archetype: ${archetype}`);
    console.log(`[Strategy Profiler] Needs platform: ${needsPlatform}`);
    console.log(`[Strategy Profiler] Tech role: ${technologyRoleOverride || 'none'}`);
    
    return profile;
  }
  
  /**
   * Determine strategic archetype
   */
  private static determineArchetype(signals: StrategySignals): 'traditional' | 'hybrid' | 'digital_first' {
    if (signals.digitalIntensity >= 70) return 'digital_first';
    if (signals.digitalIntensity >= 30) return 'hybrid';
    return 'traditional';
  }
  
  /**
   * Assess if platform development is needed
   */
  private static assessPlatformNeed(signals: StrategySignals): boolean {
    // Strong product/platform build evidence
    if (signals.platformNeeds.length > 0) return true;
    
    // Only infer platform builds from high-confidence converging signals.
    const ambiguousMentions = signals.platformAmbiguousSignals?.length || 0;
    const commercialTechSignals = signals.techRevenue.length + signals.techResources.length;
    const channelSignals = signals.digitalChannels.length + signals.customerTech.length;

    return ambiguousMentions >= 2
      && signals.digitalIntensity >= 70
      && commercialTechSignals >= 2
      && channelSignals >= 2;
  }
  
  /**
   * Determine technology role based on strategy
   */
  private static determineTechRole(
    signals: StrategySignals,
    archetype: 'traditional' | 'hybrid' | 'digital_first'
  ): TechnologyRole | undefined {
    // If strategy is digital-first, tech is likely core product
    if (archetype === 'digital_first') {
      return 'core_product';
    }
    
    // If strategy recommends platforms/apps, tech is operational tool (for hybrid)
    if (archetype === 'hybrid' && signals.platformNeeds.length > 0) {
      return 'operational_tool';
    }
    
    // Let business analyzer determine for traditional
    return undefined;
  }
  
  /**
   * Extract recommended workstream categories from signals
   */
  private static extractRecommendedCategories(signals: StrategySignals): string[] {
    const categories = new Set<string>();
    
    if (signals.platformNeeds.length > 0) {
      categories.add('technology_systems');
    }
    
    if (signals.digitalChannels.length > 0) {
      categories.add('marketing_sales'); // Digital marketing
      categories.add('technology_systems'); // Digital infrastructure
    }
    
    if (signals.customerTech.length > 0) {
      categories.add('technology_systems'); // CRM, customer platforms
    }
    
    return Array.from(categories);
  }
  
  /**
   * Calculate effort allocation adjustments based on strategy
   */
  private static calculateEffortAdjustments(
    signals: StrategySignals,
    archetype: 'traditional' | 'hybrid' | 'digital_first'
  ): Map<string, number> {
    const adjustments = new Map<string, number>();
    
    switch (archetype) {
      case 'traditional':
        // Minimal adjustments, use base pattern
        break;
        
      case 'hybrid':
        // Increase tech, decrease physical proportionally
        adjustments.set('technology_systems', 35); // Up from base 10%
        adjustments.set('physical_infrastructure', 20); // Down from base 35%
        adjustments.set('operations', 25); // Maintain
        adjustments.set('marketing_sales', 15); // Increase for digital marketing
        break;
        
      case 'digital_first':
        // Heavy tech emphasis
        adjustments.set('technology_systems', 50); // Major focus
        adjustments.set('physical_infrastructure', 10); // Minimal
        adjustments.set('operations', 15); // Reduced
        adjustments.set('marketing_sales', 20); // Digital marketing focus
        break;
    }
    
    return adjustments;
  }
}
