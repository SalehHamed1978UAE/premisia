/**
 * Strategy Signal Extractor - Analyzes BMC insights for digital transformation indicators
 * Extracts strategic recommendations about platform needs, digital channels, tech emphasis
 */

export interface StrategySignals {
  platformNeeds: string[];        // Strong evidence of product/platform build requirements
  platformOperationalSignals: string[]; // Platform/software mentions used as delivery tools
  platformAmbiguousSignals: string[];   // Ambiguous mentions (neither clearly product nor clearly tool)
  digitalChannels: string[];      // Online channels, digital touchpoints
  digitalValueProps: string[];    // Technology-enabled value propositions
  techRevenue: string[];          // Tech-enabled revenue streams
  techResources: string[];        // Key technology resources identified
  customerTech: string[];         // Digital customer relationship mechanisms
  revenueDigitization: string[];  // Legacy compatibility
  digitalIntensity: number;       // 0-100 score of digital emphasis
}

export class StrategySignalExtractor {
  private static hasSoftwareProductSignal(content: string): boolean {
    return /(build|develop|create|engineer|design|ship|offer)\s+.*(saas|software|application|app|platform product|platform solution)/.test(content)
      || /launch\s+(an?\s+)?(saas|software|application|app|platform product)/.test(content)
      || /(saas\s+platform|software\s+product|ai\s+platform|digital\s+product|productized\s+software)/.test(content);
  }

  private static hasOperationalTechSignal(content: string): boolean {
    return /(pos|point of sale|crm|erp|inventory|booking|scheduling|automation tool|internal system|workflow tool|implementation tooling)/.test(content)
      || /(internal|delivery|operations)\s+.*(software|platform|application|app|tool)/.test(content)
      || /(support|enable|optimiz|streamlin|automate)\s+.*(operations|delivery|service|workflow|process)/.test(content);
  }

  private static isServiceLaunchContext(context?: { business?: { type?: string; industry?: string; description?: string; initiativeType?: string } }): boolean {
    const corpus = [
      context?.business?.type,
      context?.business?.industry,
      context?.business?.description,
      context?.business?.initiativeType,
    ]
      .filter((value) => typeof value === 'string' && value.trim().length > 0)
      .join(' ')
      .toLowerCase();

    if (!corpus) return false;
    return /(service_launch|consult(ing|ancy)?|agency|advisory|professional service|implementation service)/.test(corpus);
  }

  /**
   * Extract digital transformation signals from BMC insights
   */
  static extract(
    insights: any,
    context?: { business?: { type?: string; industry?: string; description?: string; initiativeType?: string } },
  ): StrategySignals {
    console.log('[Strategy Signal Extractor] Analyzing BMC insights for digital signals...');
    
    const signals: StrategySignals = {
      platformNeeds: [],
      platformOperationalSignals: [],
      platformAmbiguousSignals: [],
      digitalChannels: [],
      digitalValueProps: [],
      techRevenue: [],
      techResources: [],
      customerTech: [],
      revenueDigitization: [],
      digitalIntensity: 0
    };
    
    // Defensive null checks
    if (!insights || !insights.insights || !Array.isArray(insights.insights)) {
      console.warn('[Strategy Signal Extractor] Invalid insights structure, returning empty signals');
      console.warn('[Strategy Signal Extractor] Received:', JSON.stringify(insights, null, 2).substring(0, 200));
      return signals;
    }
    
    // Analyze all insights for digital/technology indicators
    insights.insights.forEach((insight: any) => {
      if (!insight || typeof insight.content !== 'string') {
        console.warn('[Strategy Signal Extractor] Skipping malformed insight:', insight);
        return; // Skip malformed insights
      }
      
      const content = insight.content.toLowerCase();
      const category = (insight.metadata?.category || insight.source || '').toLowerCase();
      
      // Platform/app development signals
      if (
        content.includes('platform') ||
        content.includes('mobile app') ||
        content.includes('web app') ||
        content.includes('digital platform') ||
        content.includes('software') ||
        content.includes('saas')
      ) {
        if (this.hasSoftwareProductSignal(content)) {
          signals.platformNeeds.push(insight.content);
        } else if (this.hasOperationalTechSignal(content) || this.isServiceLaunchContext(context)) {
          signals.platformOperationalSignals.push(insight.content);
        } else {
          signals.platformAmbiguousSignals.push(insight.content);
        }
      }
      
      // Digital channel signals (from Channels block)
      if (
        category.includes('channel') &&
        (content.includes('online') ||
         content.includes('digital') ||
         content.includes('website') ||
         content.includes('mobile') ||
         content.includes('app') ||
         content.includes('social media') ||
         content.includes('e-commerce'))
      ) {
        signals.digitalChannels.push(insight.content);
      }
      
      // Digital value proposition signals
      if (
        category.includes('value') &&
        (content.includes('digital') ||
         content.includes('online') ||
         content.includes('automated') ||
         content.includes('instant') ||
         content.includes('24/7') ||
         content.includes('real-time'))
      ) {
        signals.digitalValueProps.push(insight.content);
      }
      
      // Technology-enabled revenue signals
      if (
        category.includes('revenue') &&
        (content.includes('subscription') ||
         content.includes('digital') ||
         content.includes('online') ||
         content.includes('platform fee') ||
         content.includes('transaction fee') ||
         content.includes('freemium'))
      ) {
        signals.techRevenue.push(insight.content);
      }
      
      // Key technology resources
      if (
        category.includes('resource') &&
        (content.includes('technology') ||
         content.includes('platform') ||
         content.includes('software') ||
         content.includes('data') ||
         content.includes('algorithm') ||
         content.includes('api'))
      ) {
        signals.techResources.push(insight.content);
      }
      
      // Digital customer relationships
      if (
        category.includes('customer relationship') &&
        (content.includes('app') ||
         content.includes('digital') ||
         content.includes('automated') ||
         content.includes('self-service') ||
         content.includes('personalization') ||
         content.includes('crm'))
      ) {
        signals.customerTech.push(insight.content);
      }
    });
    
    // Calculate digital intensity (0-100)
    signals.digitalIntensity = this.calculateDigitalIntensity(signals);
    
    console.log(`[Strategy Signal Extractor] Digital intensity: ${signals.digitalIntensity}%`);
    console.log(`[Strategy Signal Extractor] Platform needs (strong): ${signals.platformNeeds.length}`);
    console.log(`[Strategy Signal Extractor] Platform needs (operational): ${signals.platformOperationalSignals.length}`);
    console.log(`[Strategy Signal Extractor] Platform needs (ambiguous): ${signals.platformAmbiguousSignals.length}`);
    console.log(`[Strategy Signal Extractor] Digital channels: ${signals.digitalChannels.length}`);
    
    return signals;
  }
  
  /**
   * Calculate digital intensity score from signals
   */
  private static calculateDigitalIntensity(signals: StrategySignals): number {
    let score = 0;
    
    // Each category contributes to digital intensity
    if (signals.platformNeeds.length > 0) score += 25;
    if (signals.platformAmbiguousSignals.length >= 2) score += 10;
    if (signals.platformOperationalSignals.length > 0) score += 5;
    if (signals.digitalChannels.length > 0) score += 20;
    if (signals.digitalValueProps.length > 0) score += 15;
    if (signals.techRevenue.length > 0) score += 15;
    if (signals.techResources.length > 0) score += 15;
    if (signals.customerTech.length > 0) score += 10;
    
    // Cap at 100
    return Math.min(100, score);
  }
  
  /**
   * Determine if strategy recommends platform development
   */
  static needsPlatform(signals: StrategySignals): boolean {
    if (signals.platformNeeds.length > 0) return true;

    const ambiguous = signals.platformAmbiguousSignals.length;
    const reinforcementSignals =
      signals.techRevenue.length +
      signals.techResources.length +
      signals.customerTech.length +
      signals.digitalChannels.length;

    return ambiguous >= 2 && signals.digitalIntensity >= 60 && reinforcementSignals >= 3;
  }
  
  /**
   * Determine strategic archetype
   */
  static getArchetype(signals: StrategySignals): 'traditional' | 'hybrid' | 'digital_first' {
    if (signals.digitalIntensity >= 70) return 'digital_first';
    if (signals.digitalIntensity >= 30) return 'hybrid';
    return 'traditional';
  }
}
