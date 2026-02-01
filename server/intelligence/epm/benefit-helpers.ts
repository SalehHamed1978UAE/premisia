/**
 * Benefit Helpers - Derive benefits from actual strategic data
 *
 * Instead of generating with AI or using templates, we extract
 * benefits directly from:
 * - Selected decisions (user's actual choices)
 * - SWOT opportunities (analyzed data)
 * - Workstream alignment (for owners)
 */

import type { ResourceAllocation } from '../types';

// Types for decision data
interface DecisionOption {
  id: string;
  label: string;
  description?: string;
  metric?: string;
  target?: string;
  timelineMonths?: number;
  estimated_timeline_months?: number;
  impactAreas?: string[];
  pros?: string[];
  cons?: string[];
  selected?: boolean;
}

interface Decision {
  id: string;
  title?: string;
  question?: string;
  selectedOptionId?: string;
  options: DecisionOption[];
  impactAreas?: string[];
}

interface Workstream {
  id: string;
  name: string;
  owner?: string;
  description?: string;
}

interface SWOTOpportunity {
  name?: string;
  description?: string;
  target?: string;
  content?: string;
}

export type BenefitCategory = 'Strategic' | 'Financial' | 'Operational' | 'Customer';

export interface BenefitSeed {
  id: string;
  name: string;
  description: string;
  category: BenefitCategory;
  metric: string;
  target: string;
  timeframe: string;
  responsibleParty: string;
}

/**
 * Summarize decision into a benefit name
 */
export function summarizeDecision(decision: Decision, option: DecisionOption): string {
  // Use decision title if available
  if (decision.title) {
    return decision.title.trim();
  }

  // Fall back to option label
  if (option.label) {
    return option.label.trim();
  }

  return `Strategic Initiative ${decision.id}`;
}

/**
 * Build a meaningful benefit description from decision data
 */
export function buildBenefitDescription(decision: Decision, option: DecisionOption): string {
  const question = decision.question?.trim() || '';
  const answer = option.description?.trim() || option.label?.trim() || '';

  if (question && answer) {
    // Combine the decision question context with the selected answer
    return `${answer}. This addresses the strategic question: ${question}`;
  }

  if (answer) {
    return answer;
  }

  if (question) {
    return `Strategic initiative to address: ${question}`;
  }

  return 'Strategic initiative aligned with program decisions.';
}

/**
 * Infer benefit category from impact areas
 */
export function inferCategory(impactAreas?: string[]): BenefitCategory {
  if (!impactAreas || impactAreas.length === 0) {
    return 'Strategic';
  }

  const area = impactAreas[0].toLowerCase();

  if (area.includes('revenue') || area.includes('financial') || area.includes('cost') || area.includes('profit')) {
    return 'Financial';
  }

  if (area.includes('efficiency') || area.includes('operations') || area.includes('process')) {
    return 'Operational';
  }

  if (area.includes('customer') || area.includes('experience') || area.includes('satisfaction')) {
    return 'Customer';
  }

  return 'Strategic';
}

/**
 * Derive metric from option data
 */
export function deriveMetric(option: DecisionOption, category: BenefitCategory): string {
  // Use explicit metric if available
  if (option.metric) {
    return option.metric;
  }

  // Derive from option label keywords
  const label = (option.label || '').toLowerCase();
  const desc = (option.description || '').toLowerCase();
  const text = `${label} ${desc}`;

  if (text.includes('revenue') || text.includes('sales')) {
    return 'Revenue growth rate (monthly)';
  }
  if (text.includes('market') || text.includes('share')) {
    return 'Market share percentage (quarterly)';
  }
  if (text.includes('partnership') || text.includes('partner')) {
    return 'Partnership revenue and contract value (quarterly)';
  }
  if (text.includes('customer') || text.includes('satisfaction')) {
    return 'Customer satisfaction score (NPS, monthly)';
  }
  if (text.includes('digital') || text.includes('online')) {
    return 'Digital channel revenue percentage (weekly)';
  }
  if (text.includes('cost') || text.includes('efficiency')) {
    return 'Cost reduction percentage (monthly)';
  }
  if (text.includes('expansion') || text.includes('growth')) {
    return 'Expansion readiness score (quarterly)';
  }

  // Default by category
  const categoryMetrics: Record<BenefitCategory, string> = {
    Financial: 'Financial performance metrics (monthly)',
    Strategic: 'Strategic KPI tracking (quarterly)',
    Operational: 'Operational efficiency metrics (monthly)',
    Customer: 'Customer satisfaction metrics (monthly)',
  };

  return categoryMetrics[category] || 'Performance metrics and KPI tracking (quarterly)';
}

/**
 * Derive target from option data
 */
export function deriveTarget(option: DecisionOption, category: BenefitCategory): string {
  // Use explicit target if available
  if (option.target) {
    return option.target;
  }

  // Look for percentage in description
  const desc = option.description || '';
  const percentMatch = desc.match(/(\d+)%/);
  if (percentMatch) {
    return `${percentMatch[1]}% improvement vs baseline`;
  }

  // Look for timeline in description
  const timeMatch = desc.match(/(\d+)\s*(months?|weeks?|days?)/i);
  if (timeMatch) {
    return `Complete within ${timeMatch[1]} ${timeMatch[2]}`;
  }

  // Default targets by category
  const categoryTargets: Record<BenefitCategory, string> = {
    Financial: '+15% revenue growth or -10% cost reduction within 6 months',
    Strategic: 'Measurable competitive advantage by Month 6',
    Operational: '+20% operational efficiency within 6 months',
    Customer: 'NPS 60+ and 40% repeat customer rate by Month 6',
  };

  return categoryTargets[category] || 'Measurable improvement vs baseline within 6 months';
}

/**
 * Derive timeframe from option data
 */
export function deriveTimeframe(option: DecisionOption, programTimeline?: number): string {
  // Use explicit timeline if available
  if (option.timelineMonths) {
    return `Month ${option.timelineMonths}`;
  }

  if (option.estimated_timeline_months) {
    return `Month ${option.estimated_timeline_months}`;
  }

  // Default based on program timeline
  const fallback = programTimeline ? Math.min(programTimeline, 6) : 4;
  return `Month ${fallback}`;
}

/**
 * Pick owner based on decision alignment with workstreams/resources
 */
export function pickOwner(
  decision: Decision,
  workstreams: Workstream[],
  resources: ResourceAllocation[]
): string {
  // Get keywords from decision
  const keywords = [
    ...(decision.impactAreas || []),
    decision.title || '',
    decision.question || '',
    ...(decision.options[0]?.label ? [decision.options[0].label] : []),
  ].map(k => k.toLowerCase()).filter(k => k.length > 0);

  // Try to match workstream by keywords
  for (const keyword of keywords) {
    const ws = workstreams.find(ws =>
      ws.name.toLowerCase().includes(keyword) ||
      (ws.description || '').toLowerCase().includes(keyword)
    );
    if (ws?.owner) {
      return ws.owner;
    }
  }

  // Try to match resource by keywords
  for (const keyword of keywords) {
    const resource = resources.find(r =>
      r.role.toLowerCase().includes(keyword)
    );
    if (resource?.role) {
      return resource.role;
    }
  }

  // Keyword-based fallback
  const keywordOwnerMap: Record<string, string[]> = {
    'marketing': ['Marketing', 'Digital', 'Brand'],
    'sales': ['Sales', 'Marketing', 'Business Development'],
    'digital': ['Digital', 'Technology', 'IT'],
    'operations': ['Operations', 'Manager'],
    'finance': ['Finance', 'CFO', 'Controller'],
    'compliance': ['Compliance', 'Legal', 'Regulatory'],
    'customer': ['Customer', 'Experience', 'Service'],
    'technology': ['Technology', 'IT', 'Tech', 'Platform', 'Engineer'],
  };

  for (const [area, roleKeywords] of Object.entries(keywordOwnerMap)) {
    if (keywords.some(k => k.includes(area))) {
      for (const roleKeyword of roleKeywords) {
        const resource = resources.find(r =>
          r.role.toLowerCase().includes(roleKeyword.toLowerCase())
        );
        if (resource?.role) {
          return resource.role;
        }
      }
    }
  }

  // Last resort: first operations role or first resource
  const ops = resources.find(r => r.role.toLowerCase().includes('operations'));
  return ops?.role || resources[0]?.role || 'Program Lead';
}

/**
 * Match owner to a SWOT opportunity
 */
export function matchOwnerToOpportunity(
  opportunity: SWOTOpportunity,
  workstreams: Workstream[],
  resources: ResourceAllocation[]
): string {
  const text = `${opportunity.name || ''} ${opportunity.description || ''} ${opportunity.content || ''}`.toLowerCase();

  if (!text.trim()) {
    return resources[0]?.role || 'Program Lead';
  }

  // Try to match workstream
  const ws = workstreams.find(ws =>
    text.includes(ws.name.toLowerCase()) ||
    ws.name.toLowerCase().split(' ').some(word => text.includes(word))
  );
  if (ws?.owner) {
    return ws.owner;
  }

  // Try to match resource by role keywords
  const resource = resources.find(r => {
    const roleWords = r.role.toLowerCase().split(' ');
    return roleWords.some(word => word.length > 3 && text.includes(word));
  });
  if (resource?.role) {
    return resource.role;
  }

  return resources[0]?.role || 'Program Lead';
}

/**
 * Truncate text for display
 */
export function truncate(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
