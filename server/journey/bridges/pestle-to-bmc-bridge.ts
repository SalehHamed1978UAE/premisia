/**
 * PESTLE → BMC Bridge
 * 
 * Transforms PESTLE macro-environmental analysis into BMC framework inputs.
 * 
 * Key transformations:
 * - Political/Legal factors → Key Partnerships (regulatory compliance partners)
 * - Economic factors → Revenue Streams & Cost Structure context
 * - Social factors → Customer Segments & Channels
 * - Technological factors → Key Resources & Key Activities
 * - Environmental factors → Value Proposition sustainability angle
 */

import type { StrategicContext } from '@shared/journey-types';
import { normalizePESTLEOutput } from './output-normalizer';

export interface PestleToBmcEnhancement {
  customerSegmentHints: Array<{
    segment: string;
    rationale: string;
    source: string;
  }>;
  valuePropositionHints: Array<{
    hint: string;
    rationale: string;
    source: string;
  }>;
  channelHints: Array<{
    channel: string;
    rationale: string;
    source: string;
  }>;
  keyPartnershipHints: Array<{
    partner: string;
    rationale: string;
    source: string;
  }>;
  keyResourceHints: Array<{
    resource: string;
    rationale: string;
    source: string;
  }>;
  keyActivityHints: Array<{
    activity: string;
    rationale: string;
    source: string;
  }>;
  revenueStreamHints: Array<{
    stream: string;
    rationale: string;
    source: string;
  }>;
  costStructureHints: Array<{
    cost: string;
    rationale: string;
    source: string;
  }>;
  environmentalContext: string;
  pestleConfidence: string;
}

/**
 * Transform PESTLE output into BMC context
 */
export function transformPestleToBmc(rawPestleOutput: any, context?: StrategicContext): PestleToBmcEnhancement {
  const pestleOutput = normalizePESTLEOutput(rawPestleOutput);

  const result: PestleToBmcEnhancement = {
    customerSegmentHints: [],
    valuePropositionHints: [],
    channelHints: [],
    keyPartnershipHints: [],
    keyResourceHints: [],
    keyActivityHints: [],
    revenueStreamHints: [],
    costStructureHints: [],
    environmentalContext: '',
    pestleConfidence: pestleOutput?.confidenceLevel || 'medium',
  };

  if (!pestleOutput?.factors) return result;

  const factors = pestleOutput.factors;

  // Political factors → Key Partnerships (government relations, regulatory compliance)
  if (factors.political && Array.isArray(factors.political)) {
    for (const f of factors.political.slice(0, 3)) {
      if (f.impact === 'opportunity') {
        result.keyPartnershipHints.push({
          partner: 'Government/regulatory bodies',
          rationale: `Leverage: ${f.factor}`,
          source: 'PESTLE Political',
        });
      }
    }
  }

  // Legal factors → Key Partnerships & Key Activities
  if (factors.legal && Array.isArray(factors.legal)) {
    for (const f of factors.legal.slice(0, 3)) {
      result.keyPartnershipHints.push({
        partner: 'Legal/compliance consultants',
        rationale: `Navigate: ${f.factor}`,
        source: 'PESTLE Legal',
      });
      result.keyActivityHints.push({
        activity: 'Regulatory compliance management',
        rationale: `Ensure compliance with: ${f.factor}`,
        source: 'PESTLE Legal',
      });
    }
  }

  // Economic factors → Revenue Streams & Cost Structure
  if (factors.economic && Array.isArray(factors.economic)) {
    for (const f of factors.economic.slice(0, 3)) {
      const lower = (f.factor || '').toLowerCase();
      
      if (lower.includes('growth') || lower.includes('spending') || f.impact === 'opportunity') {
        result.revenueStreamHints.push({
          stream: 'Market expansion revenue',
          rationale: `Capitalize on: ${f.factor}`,
          source: 'PESTLE Economic',
        });
      }
      
      if (lower.includes('inflation') || lower.includes('cost') || f.impact === 'threat') {
        result.costStructureHints.push({
          cost: 'Variable costs management',
          rationale: `Monitor: ${f.factor}`,
          source: 'PESTLE Economic',
        });
      }
    }
  }

  // Social factors → Customer Segments & Value Proposition
  if (factors.social && Array.isArray(factors.social)) {
    for (const f of factors.social.slice(0, 3)) {
      result.customerSegmentHints.push({
        segment: 'Trend-aligned customer segment',
        rationale: `Target based on: ${f.factor}`,
        source: 'PESTLE Social',
      });
      
      if (f.impact === 'opportunity') {
        result.valuePropositionHints.push({
          hint: 'Align with social trends',
          rationale: `Address: ${f.factor}`,
          source: 'PESTLE Social',
        });
      }
    }
  }

  // Technological factors → Key Resources, Activities & Channels
  if (factors.technological && Array.isArray(factors.technological)) {
    for (const f of factors.technological.slice(0, 3)) {
      result.keyResourceHints.push({
        resource: 'Technology infrastructure',
        rationale: `Leverage: ${f.factor}`,
        source: 'PESTLE Technological',
      });
      
      const lower = (f.factor || '').toLowerCase();
      if (lower.includes('digital') || lower.includes('online') || lower.includes('platform')) {
        result.channelHints.push({
          channel: 'Digital channels',
          rationale: `Enabled by: ${f.factor}`,
          source: 'PESTLE Technological',
        });
      }
    }
  }

  // Environmental factors → Value Proposition sustainability
  if (factors.environmental && Array.isArray(factors.environmental)) {
    const envFactors = factors.environmental.slice(0, 3);
    for (const f of envFactors) {
      if (f.impact === 'opportunity') {
        result.valuePropositionHints.push({
          hint: 'Sustainability-focused value proposition',
          rationale: `Capitalize on: ${f.factor}`,
          source: 'PESTLE Environmental',
        });
      }
    }
    
    result.environmentalContext = envFactors.map((f: any) => f.factor || '').join('; ');
  }

  console.log(`[Bridge] pestle-to-bmc: Generated ${result.customerSegmentHints.length} segment hints, ${result.valuePropositionHints.length} VP hints`);

  return result;
}

/**
 * Format PESTLE context as text for inclusion in BMC prompt
 */
export function formatPestleContextForBmc(enhancement: PestleToBmcEnhancement): string {
  const sections: string[] = [];
  
  sections.push('**Macro-Environmental Context (from PESTLE):**');
  
  if (enhancement.customerSegmentHints.length > 0) {
    sections.push('\n**Customer Segment Insights:**');
    for (const h of enhancement.customerSegmentHints.slice(0, 3)) {
      sections.push(`- ${h.segment}: ${h.rationale}`);
    }
  }
  
  if (enhancement.valuePropositionHints.length > 0) {
    sections.push('\n**Value Proposition Guidance:**');
    for (const h of enhancement.valuePropositionHints.slice(0, 3)) {
      sections.push(`- ${h.hint}: ${h.rationale}`);
    }
  }
  
  if (enhancement.keyPartnershipHints.length > 0) {
    sections.push('\n**Key Partnership Suggestions:**');
    for (const h of enhancement.keyPartnershipHints.slice(0, 3)) {
      sections.push(`- ${h.partner}: ${h.rationale}`);
    }
  }
  
  if (enhancement.channelHints.length > 0) {
    sections.push('\n**Channel Opportunities:**');
    for (const h of enhancement.channelHints.slice(0, 2)) {
      sections.push(`- ${h.channel}: ${h.rationale}`);
    }
  }
  
  return sections.join('\n');
}

export default { transformPestleToBmc, formatPestleContextForBmc };
