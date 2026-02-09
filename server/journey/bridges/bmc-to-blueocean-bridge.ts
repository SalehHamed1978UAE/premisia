/**
 * BMC → Blue Ocean Bridge
 * 
 * Transforms Business Model Canvas analysis into Blue Ocean Strategy inputs.
 * 
 * Key transformations:
 * - Current value proposition → Industry value curve baseline
 * - Cost structure → Candidates for Eliminate/Reduce
 * - Customer segments pain points → Candidates for Raise/Create
 * - Key activities → Current factors to evaluate
 */

import type { StrategicContext } from '@shared/journey-types';

export interface BmcToBlueOceanEnhancement {
  currentValueCurve: Array<{
    factor: string;
    currentLevel: 'high' | 'medium' | 'low';
    source: string;
    investmentLevel: 'high' | 'medium' | 'low';
  }>;
  eliminateCandidates: Array<{
    factor: string;
    rationale: string;
    costSavingPotential: 'high' | 'medium' | 'low';
  }>;
  reduceCandidates: Array<{
    factor: string;
    rationale: string;
    currentOverInvestment: string;
  }>;
  raiseCandidates: Array<{
    factor: string;
    rationale: string;
    customerBenefit: string;
  }>;
  createCandidates: Array<{
    factor: string;
    rationale: string;
    differentiationPotential: 'high' | 'medium' | 'low';
  }>;
  nonCustomerInsights: Array<{
    segment: string;
    reason: string;
    opportunity: string;
  }>;
  businessModelContext: string;
}

/**
 * Transform BMC output into Blue Ocean context
 */
export function transformBmcToBlueOcean(rawBmcOutput: any, context?: StrategicContext): BmcToBlueOceanEnhancement {
  const bmcOutput = normalizeBmcOutput(rawBmcOutput);

  const result: BmcToBlueOceanEnhancement = {
    currentValueCurve: [],
    eliminateCandidates: [],
    reduceCandidates: [],
    raiseCandidates: [],
    createCandidates: [],
    nonCustomerInsights: [],
    businessModelContext: '',
  };

  if (!bmcOutput) return result;

  const canvas = bmcOutput.canvas || bmcOutput.bmcResults || bmcOutput;

  // Value Proposition → Current value factors
  const valueProps = canvas.valuePropositions || canvas.value_propositions || canvas.valueProposition || [];
  for (const vp of normalizeToArray(valueProps)) {
    const proposition = extractText(vp, ['proposition', 'value', 'title', 'name']);
    if (proposition) {
      result.currentValueCurve.push({
        factor: proposition,
        currentLevel: 'medium',
        source: 'BMC Value Proposition',
        investmentLevel: 'medium',
      });
    }
  }

  // Cost Structure → Eliminate/Reduce candidates
  const costs = canvas.costStructure || canvas.cost_structure || canvas.costs || [];
  for (const cost of normalizeToArray(costs)) {
    const costItem = extractText(cost, ['cost', 'item', 'name', 'category']);
    const isFixed = (typeof cost === 'object') && (cost.type === 'fixed' || cost.isFixed);
    
    if (costItem) {
      // High fixed costs are candidates for reduction
      if (isFixed || costItem.toLowerCase().includes('overhead') || costItem.toLowerCase().includes('infrastructure')) {
        result.reduceCandidates.push({
          factor: costItem,
          rationale: 'Fixed/overhead cost may be reduced through innovation',
          currentOverInvestment: 'Consider if industry-standard or excessive',
        });
      }

      // Legacy or traditional costs may be eliminated
      if (costItem.toLowerCase().includes('traditional') || costItem.toLowerCase().includes('legacy')) {
        result.eliminateCandidates.push({
          factor: costItem,
          rationale: 'Legacy cost structure may be unnecessary',
          costSavingPotential: 'medium',
        });
      }
    }
  }

  // Key Activities → Current factors to evaluate
  const activities = canvas.keyActivities || canvas.key_activities || canvas.activities || [];
  for (const activity of normalizeToArray(activities)) {
    const activityText = extractText(activity, ['activity', 'name', 'title']);
    if (activityText) {
      result.currentValueCurve.push({
        factor: activityText,
        currentLevel: 'medium',
        source: 'BMC Key Activities',
        investmentLevel: 'medium',
      });
    }
  }

  // Customer Relationships → Raise candidates (enhance what matters)
  const relationships = canvas.customerRelationships || canvas.customer_relationships || canvas.relationships || [];
  for (const rel of normalizeToArray(relationships)) {
    const relText = extractText(rel, ['relationship', 'type', 'name']);
    if (relText) {
      result.raiseCandidates.push({
        factor: `Customer ${relText}`,
        rationale: 'Customer relationship factor to potentially enhance',
        customerBenefit: 'Improved customer experience and loyalty',
      });
    }
  }

  // Customer Segments → Non-customer insights
  const segments = canvas.customerSegments || canvas.customer_segments || canvas.segments || [];
  const segmentList = normalizeToArray(segments);
  
  // Look for gaps in segments (potential non-customers)
  if (segmentList.length > 0) {
    result.nonCustomerInsights.push({
      segment: 'Adjacent market segments',
      reason: 'Not currently served by existing value proposition',
      opportunity: 'Potential new demand through value innovation',
    });
  }

  // Channels → Potential Create candidates
  const channels = canvas.channels || [];
  const channelList = normalizeToArray(channels);
  
  const hasDigital = channelList.some(c => {
    const text = extractText(c, ['channel', 'name', 'type']);
    return text && (text.toLowerCase().includes('digital') || text.toLowerCase().includes('online'));
  });

  if (!hasDigital) {
    result.createCandidates.push({
      factor: 'Digital/online channel presence',
      rationale: 'No digital channels identified in current BMC',
      differentiationPotential: 'high',
    });
  }

  // Key Resources → Potential unique factors
  const resources = canvas.keyResources || canvas.key_resources || canvas.resources || [];
  for (const res of normalizeToArray(resources)) {
    const resText = extractText(res, ['resource', 'name', 'type']);
    if (resText && (resText.toLowerCase().includes('unique') || resText.toLowerCase().includes('proprietary'))) {
      result.createCandidates.push({
        factor: resText,
        rationale: 'Unique resource could be leveraged for differentiation',
        differentiationPotential: 'high',
      });
    }
  }

  // Revenue Streams analysis
  const revenues = canvas.revenueStreams || canvas.revenue_streams || canvas.revenues || [];
  const revenueList = normalizeToArray(revenues);
  
  if (revenueList.length === 1) {
    result.createCandidates.push({
      factor: 'Diversified revenue model',
      rationale: 'Single revenue stream identified - opportunity to create new models',
      differentiationPotential: 'medium',
    });
  }

  // Build context summary
  result.businessModelContext = buildBmcContext(canvas, result);

  console.log(`[Bridge] bmc-to-blueocean: Generated ${result.eliminateCandidates.length} eliminate, ${result.reduceCandidates.length} reduce, ${result.raiseCandidates.length} raise, ${result.createCandidates.length} create candidates`);

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
 * Build BMC context summary for Blue Ocean
 */
function buildBmcContext(canvas: any, enhancement: BmcToBlueOceanEnhancement): string {
  const sections: string[] = [];
  
  sections.push('Business Model Summary for Blue Ocean Analysis:');
  sections.push(`- Value curve factors identified: ${enhancement.currentValueCurve.length}`);
  sections.push(`- Cost reduction opportunities: ${enhancement.reduceCandidates.length + enhancement.eliminateCandidates.length}`);
  sections.push(`- Value enhancement opportunities: ${enhancement.raiseCandidates.length + enhancement.createCandidates.length}`);
  
  return sections.join('\n');
}

/**
 * Format BMC context as text for inclusion in Blue Ocean prompt
 */
export function formatBmcContextForBlueOcean(enhancement: BmcToBlueOceanEnhancement): string {
  const sections: string[] = [];
  
  sections.push('**Current Value Curve (from BMC):**');
  for (const factor of enhancement.currentValueCurve.slice(0, 5)) {
    sections.push(`- ${factor.factor} [${factor.currentLevel}]`);
  }
  
  if (enhancement.eliminateCandidates.length > 0) {
    sections.push('\n**Eliminate Candidates:**');
    for (const c of enhancement.eliminateCandidates) {
      sections.push(`- ${c.factor}: ${c.rationale}`);
    }
  }
  
  if (enhancement.reduceCandidates.length > 0) {
    sections.push('\n**Reduce Candidates:**');
    for (const c of enhancement.reduceCandidates) {
      sections.push(`- ${c.factor}: ${c.rationale}`);
    }
  }
  
  if (enhancement.raiseCandidates.length > 0) {
    sections.push('\n**Raise Candidates:**');
    for (const c of enhancement.raiseCandidates) {
      sections.push(`- ${c.factor}: ${c.customerBenefit}`);
    }
  }
  
  if (enhancement.createCandidates.length > 0) {
    sections.push('\n**Create Candidates:**');
    for (const c of enhancement.createCandidates) {
      sections.push(`- ${c.factor} [${c.differentiationPotential}]: ${c.rationale}`);
    }
  }
  
  return sections.join('\n');
}

export default { transformBmcToBlueOcean, formatBmcContextForBlueOcean };
