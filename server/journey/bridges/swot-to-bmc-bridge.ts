/**
 * SWOT → BMC Bridge
 * 
 * Transforms SWOT analysis into Business Model Canvas design inputs.
 * 
 * Key transformations:
 * - Strengths → Key Resources, Key Activities
 * - Weaknesses → Gaps to address in Value Proposition
 * - Opportunities → Customer Segments, Channels, Revenue Streams
 * - Threats → Cost considerations, Risk factors in design
 */

import type { StrategicContext } from '@shared/journey-types';

export interface SwotToBmcEnhancement {
  strategicInsights: {
    leverageStrengths: Array<{ name: string; description: string }>;
    addressWeaknesses: Array<{ name: string; description: string }>;
    pursueOpportunities: Array<{ name: string; description: string }>;
    mitigateThreats: Array<{ name: string; description: string }>;
  };
  bmcGuidance: {
    keyResourcesHints: string[];
    keyActivitiesHints: string[];
    valuePropositionHints: string[];
    customerSegmentHints: string[];
    channelHints: string[];
    revenueStreamHints: string[];
    costStructureHints: string[];
  };
  swotSummary: string;
  swotConfidence: string;
}

/**
 * Transform SWOT output into BMC design context
 */
export function transformSwotToBmc(rawSwotOutput: any, context?: StrategicContext): SwotToBmcEnhancement {
  const swotOutput = normalizeSwotOutput(rawSwotOutput);

  const result: SwotToBmcEnhancement = {
    strategicInsights: {
      leverageStrengths: [],
      addressWeaknesses: [],
      pursueOpportunities: [],
      mitigateThreats: [],
    },
    bmcGuidance: {
      keyResourcesHints: [],
      keyActivitiesHints: [],
      valuePropositionHints: [],
      customerSegmentHints: [],
      channelHints: [],
      revenueStreamHints: [],
      costStructureHints: [],
    },
    swotSummary: '',
    swotConfidence: 'medium',
  };

  if (!swotOutput) return result;

  const strengths = swotOutput.strengths || [];
  const weaknesses = swotOutput.weaknesses || [];
  const opportunities = swotOutput.opportunities || [];
  const threats = swotOutput.threats || [];

  // Process Strengths → Key Resources & Key Activities
  for (const s of strengths.slice(0, 5)) {
    const item = normalizeSwotItem(s);
    if (item.name) {
      result.strategicInsights.leverageStrengths.push(item);
      result.bmcGuidance.keyResourcesHints.push(`Leverage: ${item.name}`);
      result.bmcGuidance.keyActivitiesHints.push(`Build on strength: ${item.name}`);
    }
  }

  // Process Weaknesses → Value Proposition gaps & Cost considerations
  for (const w of weaknesses.slice(0, 5)) {
    const item = normalizeSwotItem(w);
    if (item.name) {
      result.strategicInsights.addressWeaknesses.push(item);
      result.bmcGuidance.valuePropositionHints.push(`Address gap: ${item.name}`);
      result.bmcGuidance.costStructureHints.push(`Investment needed: ${item.name}`);
    }
  }

  // Process Opportunities → Customer Segments, Channels, Revenue Streams
  for (const o of opportunities.slice(0, 5)) {
    const item = normalizeSwotItem(o);
    if (item.name) {
      result.strategicInsights.pursueOpportunities.push(item);
      result.bmcGuidance.customerSegmentHints.push(`Target opportunity: ${item.name}`);
      result.bmcGuidance.channelHints.push(`Channel for: ${item.name}`);
      result.bmcGuidance.revenueStreamHints.push(`Revenue from: ${item.name}`);
    }
  }

  // Process Threats → Cost Structure & Risk mitigation
  for (const t of threats.slice(0, 5)) {
    const item = normalizeSwotItem(t);
    if (item.name) {
      result.strategicInsights.mitigateThreats.push(item);
      result.bmcGuidance.costStructureHints.push(`Mitigate: ${item.name}`);
    }
  }

  // Build SWOT summary
  result.swotSummary = buildSwotSummary(strengths, weaknesses, opportunities, threats);
  result.swotConfidence = swotOutput.confidence || swotOutput.confidenceLevel || 'medium';

  console.log(`[Bridge] swot-to-bmc: Transformed SWOT (${strengths.length}S/${weaknesses.length}W/${opportunities.length}O/${threats.length}T) → BMC guidance`);

  return result;
}

/**
 * Normalize various SWOT output formats
 */
function normalizeSwotOutput(raw: any): any {
  if (!raw) return null;

  // Handle wrapped output
  if (raw.data?.output) return raw.data.output;
  if (raw.output) return raw.output;
  if (raw.data) return raw.data;

  return raw;
}

/**
 * Normalize SWOT item to consistent format
 */
function normalizeSwotItem(item: any): { name: string; description: string } {
  if (typeof item === 'string') {
    return { name: item, description: '' };
  }

  return {
    name: item.name || item.title || item.factor || '',
    description: item.description || item.detail || item.explanation || '',
  };
}

/**
 * Build summary of SWOT analysis
 */
function buildSwotSummary(strengths: any[], weaknesses: any[], opportunities: any[], threats: any[]): string {
  const summarize = (items: any[], label: string) => {
    const names = items.slice(0, 3).map(i => {
      const item = normalizeSwotItem(i);
      return item.name;
    }).filter(Boolean);
    return names.length > 0 ? `${label}: ${names.join(', ')}` : '';
  };

  const parts = [
    summarize(strengths, 'Key Strengths'),
    summarize(weaknesses, 'Key Weaknesses'),
    summarize(opportunities, 'Key Opportunities'),
    summarize(threats, 'Key Threats'),
  ].filter(Boolean);

  return parts.join('\n');
}

export default { transformSwotToBmc };
