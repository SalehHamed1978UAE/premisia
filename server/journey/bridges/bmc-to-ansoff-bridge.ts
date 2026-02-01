/**
 * BMC → Ansoff Matrix Bridge
 * 
 * Transforms Business Model Canvas analysis into Ansoff Matrix inputs.
 * 
 * Key transformations:
 * - Current customer segments → Market Penetration focus
 * - Value proposition gaps → Product Development opportunities
 * - Channel analysis → Market Development potential
 * - Business model innovation ideas → Diversification candidates
 */

import type { StrategicContext } from '@shared/journey-types';

export interface BmcToAnsoffEnhancement {
  marketPenetrationFactors: Array<{
    factor: string;
    rationale: string;
    growthPotential: 'high' | 'medium' | 'low';
    source: string;
  }>;
  marketDevelopmentOpportunities: Array<{
    opportunity: string;
    targetMarket: string;
    rationale: string;
    riskLevel: 'high' | 'medium' | 'low';
  }>;
  productDevelopmentIdeas: Array<{
    idea: string;
    existingCapability: string;
    rationale: string;
    feasibility: 'high' | 'medium' | 'low';
  }>;
  diversificationCandidates: Array<{
    direction: string;
    rationale: string;
    riskLevel: 'high' | 'medium' | 'low';
    synergies: string;
  }>;
  currentPositionSummary: string;
  growthReadinessScore: number;
}

/**
 * Transform BMC output into Ansoff Matrix context
 */
export function transformBmcToAnsoff(rawBmcOutput: any, context?: StrategicContext): BmcToAnsoffEnhancement {
  const bmcOutput = normalizeBmcOutput(rawBmcOutput);

  const result: BmcToAnsoffEnhancement = {
    marketPenetrationFactors: [],
    marketDevelopmentOpportunities: [],
    productDevelopmentIdeas: [],
    diversificationCandidates: [],
    currentPositionSummary: '',
    growthReadinessScore: 3,
  };

  if (!bmcOutput) return result;

  const canvas = bmcOutput.canvas || bmcOutput.bmcResults || bmcOutput;

  // Customer Segments → Market Penetration base
  const segments = canvas.customerSegments || canvas.customer_segments || canvas.segments || [];
  const segmentList = normalizeToArray(segments);
  
  for (const seg of segmentList.slice(0, 3)) {
    const segmentText = extractText(seg, ['segment', 'name', 'title', 'description']);
    if (segmentText) {
      result.marketPenetrationFactors.push({
        factor: `Deepen engagement with: ${segmentText}`,
        rationale: 'Existing customer segment with established relationship',
        growthPotential: 'medium',
        source: 'BMC Customer Segments',
      });
    }
  }

  // Value Propositions → Product Development base
  const valueProps = canvas.valuePropositions || canvas.value_propositions || canvas.valueProposition || [];
  const vpList = normalizeToArray(valueProps);
  
  for (const vp of vpList.slice(0, 3)) {
    const vpText = extractText(vp, ['proposition', 'value', 'title', 'name']);
    if (vpText) {
      result.productDevelopmentIdeas.push({
        idea: `Enhance/extend: ${vpText}`,
        existingCapability: vpText,
        rationale: 'Build on proven value proposition with new features or variants',
        feasibility: 'medium',
      });
    }
  }

  // Channels → Market Development potential
  const channels = canvas.channels || [];
  const channelList = normalizeToArray(channels);
  
  const existingChannels = new Set<string>();
  for (const ch of channelList) {
    const chText = extractText(ch, ['channel', 'name', 'type']);
    if (chText) existingChannels.add(chText.toLowerCase());
  }

  // Suggest unexplored channels as market development
  const potentialChannels = ['digital', 'direct', 'partnerships', 'retail', 'online marketplace'];
  for (const potential of potentialChannels) {
    const hasChannel = Array.from(existingChannels).some(ch => ch.includes(potential));
    if (!hasChannel && existingChannels.size > 0) {
      result.marketDevelopmentOpportunities.push({
        opportunity: `Expand via ${potential} channel`,
        targetMarket: 'Adjacent customer segments',
        rationale: `${potential} channel not currently utilized in business model`,
        riskLevel: 'medium',
      });
      break; // Just one suggestion
    }
  }

  // Customer Relationships → Market Penetration via relationship deepening
  const relationships = canvas.customerRelationships || canvas.customer_relationships || canvas.relationships || [];
  const relList = normalizeToArray(relationships);
  
  if (relList.length > 0) {
    result.marketPenetrationFactors.push({
      factor: 'Enhance customer loyalty programs',
      rationale: `Build on existing ${relList.length} relationship type(s)`,
      growthPotential: 'medium',
      source: 'BMC Customer Relationships',
    });
  }

  // Key Resources → Product Development enablers
  const resources = canvas.keyResources || canvas.key_resources || canvas.resources || [];
  const resourceList = normalizeToArray(resources);
  
  for (const res of resourceList.slice(0, 2)) {
    const resText = extractText(res, ['resource', 'name', 'type']);
    if (resText) {
      result.productDevelopmentIdeas.push({
        idea: `Leverage ${resText} for new offerings`,
        existingCapability: resText,
        rationale: 'Existing resource can support product extension',
        feasibility: 'medium',
      });
    }
  }

  // Key Partners → Diversification through partnerships
  const partners = canvas.keyPartnerships || canvas.key_partnerships || canvas.partners || canvas.keyPartners || [];
  const partnerList = normalizeToArray(partners);
  
  if (partnerList.length > 0) {
    result.diversificationCandidates.push({
      direction: 'Strategic partnership expansion',
      rationale: `Leverage existing ${partnerList.length} partner relationship(s) for new ventures`,
      riskLevel: 'medium',
      synergies: 'Existing partner trust and collaboration frameworks',
    });
  }

  // Revenue Streams → Market Development through new revenue models
  const revenues = canvas.revenueStreams || canvas.revenue_streams || canvas.revenues || [];
  const revenueList = normalizeToArray(revenues);
  
  if (revenueList.length === 1) {
    result.marketDevelopmentOpportunities.push({
      opportunity: 'New revenue model exploration',
      targetMarket: 'Price-sensitive or premium segments',
      rationale: 'Single revenue stream suggests opportunity for model diversification',
      riskLevel: 'low',
    });
  }

  // Calculate growth readiness
  result.growthReadinessScore = calculateGrowthReadiness(canvas, result);
  
  // Build summary
  result.currentPositionSummary = buildPositionSummary(canvas, result);

  console.log(`[Bridge] bmc-to-ansoff: Generated ${result.marketPenetrationFactors.length} penetration, ${result.marketDevelopmentOpportunities.length} development, ${result.productDevelopmentIdeas.length} product, ${result.diversificationCandidates.length} diversification factors`);

  return result;
}

/**
 * Normalize BMC output from various formats
 */
function normalizeBmcOutput(raw: any): any {
  if (!raw) return null;

  if (raw.data?.output) return raw.data.output;
  if (raw.data?.canvas) return raw.data;
  if (raw.output?.canvas) return raw.output;
  if (raw.canvas) return raw;
  if (raw.bmcResults) return raw;
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
 * Calculate growth readiness score (1-5)
 */
function calculateGrowthReadiness(canvas: any, enhancement: BmcToAnsoffEnhancement): number {
  let score = 3; // Base score
  
  // More customer segments = better penetration potential
  const segments = normalizeToArray(canvas.customerSegments || canvas.customer_segments || []);
  if (segments.length >= 3) score += 0.5;
  
  // Strong partnerships = diversification capability
  const partners = normalizeToArray(canvas.keyPartnerships || canvas.key_partnerships || []);
  if (partners.length >= 2) score += 0.5;
  
  // Multiple revenue streams = market development readiness
  const revenues = normalizeToArray(canvas.revenueStreams || canvas.revenue_streams || []);
  if (revenues.length >= 2) score += 0.5;
  
  // Digital channels = market expansion capability
  const channels = normalizeToArray(canvas.channels || []);
  const hasDigital = channels.some(c => {
    const text = extractText(c, ['channel', 'name', 'type']);
    return text && (text.toLowerCase().includes('digital') || text.toLowerCase().includes('online'));
  });
  if (hasDigital) score += 0.5;
  
  return Math.min(5, Math.round(score));
}

/**
 * Build current position summary
 */
function buildPositionSummary(canvas: any, enhancement: BmcToAnsoffEnhancement): string {
  const segments = normalizeToArray(canvas.customerSegments || canvas.customer_segments || []);
  const valueProps = normalizeToArray(canvas.valuePropositions || canvas.value_propositions || []);
  
  return `Business Model Position: ${segments.length} customer segment(s), ${valueProps.length} value proposition(s). Growth Readiness: ${enhancement.growthReadinessScore}/5.`;
}

/**
 * Format BMC context as text for inclusion in Ansoff prompt
 */
export function formatBmcContextForAnsoff(enhancement: BmcToAnsoffEnhancement): string {
  const sections: string[] = [];
  
  sections.push('**Current Business Position (from BMC):**');
  sections.push(enhancement.currentPositionSummary);
  sections.push(`Growth Readiness Score: ${enhancement.growthReadinessScore}/5`);
  
  if (enhancement.marketPenetrationFactors.length > 0) {
    sections.push('\n**Market Penetration Opportunities:**');
    for (const f of enhancement.marketPenetrationFactors.slice(0, 3)) {
      sections.push(`- ${f.factor} [${f.growthPotential} potential]`);
    }
  }
  
  if (enhancement.marketDevelopmentOpportunities.length > 0) {
    sections.push('\n**Market Development Opportunities:**');
    for (const o of enhancement.marketDevelopmentOpportunities.slice(0, 2)) {
      sections.push(`- ${o.opportunity} → ${o.targetMarket} [${o.riskLevel} risk]`);
    }
  }
  
  if (enhancement.productDevelopmentIdeas.length > 0) {
    sections.push('\n**Product Development Ideas:**');
    for (const i of enhancement.productDevelopmentIdeas.slice(0, 2)) {
      sections.push(`- ${i.idea} [${i.feasibility} feasibility]`);
    }
  }
  
  if (enhancement.diversificationCandidates.length > 0) {
    sections.push('\n**Diversification Candidates:**');
    for (const d of enhancement.diversificationCandidates) {
      sections.push(`- ${d.direction} [${d.riskLevel} risk]: ${d.synergies}`);
    }
  }
  
  return sections.join('\n');
}

export default { transformBmcToAnsoff, formatBmcContextForAnsoff };
