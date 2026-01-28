/**
 * Journey Selector
 * 
 * Selects the most appropriate journey template based on strategic context.
 */

import { templateRegistry, type JourneyTemplate } from '../journey/templates';
import type { StrategicContext } from './types';

export class JourneySelector {
  selectBestTemplate(context: StrategicContext): JourneyTemplate {
    console.log('[JourneySelector] Selecting best template for context...');
    
    const userInput = context.userInput.toLowerCase();
    
    if (this.matchesBMC(userInput)) {
      console.log('[JourneySelector] Selected: BMC Journey');
      return templateRegistry.get('bmc-journey');
    }
    
    if (this.matchesDigitalTransformation(userInput)) {
      console.log('[JourneySelector] Selected: Digital Transformation');
      return templateRegistry.get('digital-transformation');
    }
    
    if (this.matchesProductLaunch(userInput)) {
      console.log('[JourneySelector] Selected: Product Launch');
      return templateRegistry.get('product-launch');
    }
    
    if (this.matchesMarketExpansion(userInput)) {
      console.log('[JourneySelector] Selected: Market Expansion');
      return templateRegistry.get('market-expansion');
    }
    
    const industryMatch = templateRegistry.getByIndustryHint(userInput);
    if (industryMatch) {
      console.log(`[JourneySelector] Selected by industry: ${industryMatch.name}`);
      return industryMatch;
    }
    
    console.log('[JourneySelector] Selected: Standard EPM (default)');
    return templateRegistry.getDefault();
  }

  private matchesBMC(input: string): boolean {
    const keywords = [
      'business model',
      'revenue stream',
      'value proposition',
      'customer segment',
      'bmc',
      'business canvas',
      'revenue model',
      'monetization',
    ];
    return keywords.some(kw => input.includes(kw));
  }

  private matchesDigitalTransformation(input: string): boolean {
    const keywords = [
      'digital transformation',
      'modernize',
      'automate',
      'cloud migration',
      'digital strategy',
      'technology upgrade',
      'system integration',
      'software implementation',
    ];
    return keywords.some(kw => input.includes(kw));
  }

  private matchesProductLaunch(input: string): boolean {
    const keywords = [
      'product launch',
      'new product',
      'launch strategy',
      'go to market',
      'go-to-market',
      'gtm',
      'mvp',
      'minimum viable',
      'release strategy',
    ];
    return keywords.some(kw => input.includes(kw));
  }

  private matchesMarketExpansion(input: string): boolean {
    const keywords = [
      'market expansion',
      'geographic expansion',
      'new market',
      'international',
      'enter market',
      'market entry',
      'expansion strategy',
      'new region',
      'new country',
    ];
    return keywords.some(kw => input.includes(kw));
  }
}

export const journeySelector = new JourneySelector();
