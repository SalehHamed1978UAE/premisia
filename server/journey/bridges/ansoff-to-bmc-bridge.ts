/**
 * Ansoff Matrix → BMC Bridge
 * 
 * Transforms Ansoff Matrix growth analysis into BMC framework inputs.
 * 
 * Key transformations:
 * - Market Penetration → Customer Relationships focus
 * - Market Development → New Customer Segments & Channels
 * - Product Development → Value Proposition evolution
 * - Diversification → Key Partnerships & new Revenue Streams
 */

import type { StrategicContext } from '@shared/journey-types';

export interface AnsoffToBmcEnhancement {
  customerSegmentHints: Array<{
    segment: string;
    quadrant: 'penetration' | 'development' | 'product' | 'diversification';
    rationale: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  valuePropositionHints: Array<{
    hint: string;
    quadrant: string;
    rationale: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  channelHints: Array<{
    channel: string;
    quadrant: string;
    rationale: string;
  }>;
  customerRelationshipHints: Array<{
    relationship: string;
    quadrant: string;
    rationale: string;
  }>;
  revenueStreamHints: Array<{
    stream: string;
    quadrant: string;
    rationale: string;
  }>;
  keyPartnershipHints: Array<{
    partner: string;
    quadrant: string;
    rationale: string;
  }>;
  keyActivityHints: Array<{
    activity: string;
    quadrant: string;
    rationale: string;
  }>;
  keyResourceHints: Array<{
    resource: string;
    quadrant: string;
    rationale: string;
  }>;
  growthStrategyContext: string;
  recommendedQuadrant: string;
}

/**
 * Transform Ansoff output into BMC context
 */
export function transformAnsoffToBmc(rawAnsoffOutput: any, context?: StrategicContext): AnsoffToBmcEnhancement {
  const ansoffOutput = normalizeAnsoffOutput(rawAnsoffOutput);

  const result: AnsoffToBmcEnhancement = {
    customerSegmentHints: [],
    valuePropositionHints: [],
    channelHints: [],
    customerRelationshipHints: [],
    revenueStreamHints: [],
    keyPartnershipHints: [],
    keyActivityHints: [],
    keyResourceHints: [],
    growthStrategyContext: '',
    recommendedQuadrant: 'penetration',
  };

  if (!ansoffOutput) return result;

  const matrix = ansoffOutput.ansoffResults || ansoffOutput.matrix || ansoffOutput;

  // Determine recommended quadrant based on scores
  let bestQuadrant = 'penetration';
  let bestScore = 0;
  
  const quadrants: Array<{key: string, name: string, bmcFocus: string[]}> = [
    { key: 'marketPenetration', name: 'penetration', bmcFocus: ['relationships', 'channels'] },
    { key: 'marketDevelopment', name: 'development', bmcFocus: ['segments', 'channels'] },
    { key: 'productDevelopment', name: 'product', bmcFocus: ['value_prop', 'activities'] },
    { key: 'diversification', name: 'diversification', bmcFocus: ['partnerships', 'revenue'] },
  ];

  for (const q of quadrants) {
    const quadrantData = matrix[q.key] || matrix[q.name];
    if (quadrantData) {
      const score = quadrantData.score || quadrantData.attractiveness || 0;
      if (score > bestScore) {
        bestScore = score;
        bestQuadrant = q.name;
      }
    }
  }
  
  result.recommendedQuadrant = bestQuadrant;

  // Market Penetration → Customer Relationships & Channels
  const penetration = matrix.marketPenetration || matrix.market_penetration || matrix.penetration;
  if (penetration) {
    const strategies = penetration.strategies || penetration.actions || [];
    
    result.customerRelationshipHints.push({
      relationship: 'Enhanced loyalty programs',
      quadrant: 'Market Penetration',
      rationale: 'Deepen relationships with existing customers',
    });
    
    result.channelHints.push({
      channel: 'Existing channels optimization',
      quadrant: 'Market Penetration',
      rationale: 'Maximize reach through current distribution',
    });
    
    for (const s of normalizeToArray(strategies).slice(0, 2)) {
      const strategyText = extractText(s, ['strategy', 'action', 'name', 'description']);
      if (strategyText) {
        result.keyActivityHints.push({
          activity: strategyText,
          quadrant: 'Market Penetration',
          rationale: 'Activity to increase market share',
        });
      }
    }
  }

  // Market Development → New Customer Segments & Channels
  const development = matrix.marketDevelopment || matrix.market_development || matrix.development;
  if (development) {
    const segments = development.targetMarkets || development.segments || development.markets || [];
    const strategies = development.strategies || development.actions || [];
    
    for (const seg of normalizeToArray(segments).slice(0, 2)) {
      const segText = extractText(seg, ['market', 'segment', 'name', 'description']);
      if (segText) {
        result.customerSegmentHints.push({
          segment: segText,
          quadrant: 'development',
          rationale: 'New market segment identified through Ansoff analysis',
          priority: 'high',
        });
      }
    }
    
    if (normalizeToArray(strategies).length > 0 || normalizeToArray(segments).length > 0) {
      result.channelHints.push({
        channel: 'New distribution channels',
        quadrant: 'Market Development',
        rationale: 'Reach new market segments',
      });
    }
  }

  // Product Development → Value Proposition & Key Activities
  const productDev = matrix.productDevelopment || matrix.product_development || matrix.product;
  if (productDev) {
    const products = productDev.products || productDev.offerings || productDev.ideas || [];
    const strategies = productDev.strategies || productDev.actions || [];
    
    for (const prod of normalizeToArray(products).slice(0, 2)) {
      const prodText = extractText(prod, ['product', 'name', 'offering', 'description']);
      if (prodText) {
        result.valuePropositionHints.push({
          hint: prodText,
          quadrant: 'Product Development',
          rationale: 'New product/service identified through Ansoff analysis',
          priority: 'high',
        });
      }
    }
    
    for (const s of normalizeToArray(strategies).slice(0, 2)) {
      const strategyText = extractText(s, ['strategy', 'action', 'name', 'description']);
      if (strategyText) {
        result.keyActivityHints.push({
          activity: strategyText,
          quadrant: 'Product Development',
          rationale: 'R&D or innovation activity',
        });
      }
    }
    
    result.keyResourceHints.push({
      resource: 'R&D capabilities',
      quadrant: 'Product Development',
      rationale: 'Support new product/service development',
    });
  }

  // Diversification → Key Partnerships & Revenue Streams
  const diversification = matrix.diversification || matrix.diversify;
  if (diversification) {
    const opportunities = diversification.opportunities || diversification.options || [];
    const strategies = diversification.strategies || diversification.actions || [];
    
    result.keyPartnershipHints.push({
      partner: 'Strategic M&A or JV partners',
      quadrant: 'Diversification',
      rationale: 'Enable entry into new markets/products',
    });
    
    for (const opp of normalizeToArray(opportunities).slice(0, 2)) {
      const oppText = extractText(opp, ['opportunity', 'option', 'name', 'description']);
      if (oppText) {
        result.revenueStreamHints.push({
          stream: oppText,
          quadrant: 'Diversification',
          rationale: 'New revenue opportunity from diversification',
        });
        
        result.customerSegmentHints.push({
          segment: `New segment: ${oppText}`,
          quadrant: 'diversification',
          rationale: 'Diversification target segment',
          priority: 'medium',
        });
      }
    }
  }

  // Build growth strategy context
  result.growthStrategyContext = buildGrowthContext(result, bestQuadrant);

  console.log(`[Bridge] ansoff-to-bmc: Generated hints for ${result.customerSegmentHints.length} segments, ${result.valuePropositionHints.length} VP, ${result.keyPartnershipHints.length} partnerships. Recommended: ${bestQuadrant}`);

  return result;
}

/**
 * Normalize Ansoff output from various formats
 */
function normalizeAnsoffOutput(raw: any): any {
  if (!raw) return null;

  if (raw.data?.output) return raw.data.output;
  if (raw.data?.ansoffResults) return raw.data;
  if (raw.output?.ansoffResults) return raw.output;
  if (raw.ansoffResults) return raw;
  if (raw.matrix) return raw;
  if (raw.data) return raw.data;
  if (raw.output) return raw.output;

  return raw;
}

/**
 * Normalize input to array
 */
function normalizeToArray(input: any): any[] {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (typeof input === 'object' && input.items) return input.items;
  if (typeof input === 'string') return [input];
  return [input];
}

/**
 * Extract text from various object formats
 */
function extractText(item: any, keys: string[]): string {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';
  
  for (const key of keys) {
    if (item[key] && typeof item[key] === 'string') {
      return item[key];
    }
  }
  
  return item.description || item.text || item.value || '';
}

/**
 * Build growth strategy context summary
 */
function buildGrowthContext(enhancement: AnsoffToBmcEnhancement, quadrant: string): string {
  const quadrantNames: Record<string, string> = {
    penetration: 'Market Penetration',
    development: 'Market Development',
    product: 'Product Development',
    diversification: 'Diversification',
  };
  
  const focus = quadrantNames[quadrant] || 'Market Penetration';
  
  return `Growth Strategy Focus: ${focus}. BMC should be optimized to support this growth direction with appropriate customer segments, value propositions, and resource allocation.`;
}

/**
 * Format Ansoff context as text for inclusion in BMC prompt
 */
export function formatAnsoffContextForBmc(enhancement: AnsoffToBmcEnhancement): string {
  const sections: string[] = [];
  
  sections.push('**Growth Strategy Context (from Ansoff Matrix):**');
  sections.push(enhancement.growthStrategyContext);
  sections.push(`Recommended Quadrant: ${enhancement.recommendedQuadrant}`);
  
  if (enhancement.customerSegmentHints.length > 0) {
    sections.push('\n**Customer Segment Recommendations:**');
    for (const h of enhancement.customerSegmentHints.slice(0, 3)) {
      sections.push(`- ${h.segment} [${h.priority}] (${h.quadrant})`);
    }
  }
  
  if (enhancement.valuePropositionHints.length > 0) {
    sections.push('\n**Value Proposition Guidance:**');
    for (const h of enhancement.valuePropositionHints.slice(0, 2)) {
      sections.push(`- ${h.hint} [${h.priority}]`);
    }
  }
  
  if (enhancement.channelHints.length > 0) {
    sections.push('\n**Channel Recommendations:**');
    for (const h of enhancement.channelHints.slice(0, 2)) {
      sections.push(`- ${h.channel}: ${h.rationale}`);
    }
  }
  
  if (enhancement.keyPartnershipHints.length > 0) {
    sections.push('\n**Key Partnership Suggestions:**');
    for (const h of enhancement.keyPartnershipHints.slice(0, 2)) {
      sections.push(`- ${h.partner}: ${h.rationale}`);
    }
  }
  
  return sections.join('\n');
}

export default { transformAnsoffToBmc, formatAnsoffContextForBmc };
