/**
 * Strategy Signal Extractor - Analyzes BMC insights for digital transformation indicators
 * Extracts strategic recommendations about platform needs, digital channels, tech emphasis
 */

export interface StrategySignals {
  platformNeeds: string[];        // Evidence of platform/technology requirements
  digitalChannels: string[];      // Online channels, digital touchpoints
  digitalValueProps: string[];    // Technology-enabled value propositions
  techRevenue: string[];          // Tech-enabled revenue streams
  techResources: string[];        // Key technology resources identified
  customerTech: string[];         // Digital customer relationship mechanisms
  digitalIntensity: number;       // 0-100 score of digital emphasis
}

export class StrategySignalExtractor {
  /**
   * Extract digital transformation signals from BMC insights
   */
  static extract(insights: any): StrategySignals {
    console.log('[Strategy Signal Extractor] Analyzing BMC insights for digital signals...');
    
    const signals: StrategySignals = {
      platformNeeds: [],
      digitalChannels: [],
      digitalValueProps: [],
      techRevenue: [],
      techResources: [],
      customerTech: [],
      digitalIntensity: 0
    };
    
    // Analyze all insights for digital/technology indicators
    insights.insights.forEach((insight: any) => {
      const content = insight.content.toLowerCase();
      const category = insight.category?.toLowerCase() || '';
      
      // Platform/app development signals
      if (
        content.includes('platform') ||
        content.includes('mobile app') ||
        content.includes('web app') ||
        content.includes('digital platform') ||
        content.includes('software') ||
        content.includes('saas')
      ) {
        signals.platformNeeds.push(insight.content);
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
    console.log(`[Strategy Signal Extractor] Platform needs: ${signals.platformNeeds.length}`);
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
    return signals.platformNeeds.length > 0 || signals.digitalIntensity >= 40;
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
