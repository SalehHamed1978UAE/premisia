/**
 * EPM Requirements - What data does EPM need to generate a quality plan?
 */

export interface EPMRequirement {
  id: string;
  name: string;
  description: string;
  importance: 'critical' | 'important' | 'optional';
  sourcedFrom: string[];
  fallbackQuestion: string;
  questionType: 'single_select' | 'multi_select' | 'scale' | 'timeline' | 'budget';
  canBeMultiple: boolean;
}

export const EPM_REQUIREMENTS: EPMRequirement[] = [
  {
    id: 'target_segments',
    name: 'Target Customer Segments',
    description: 'Who are the primary target customers?',
    importance: 'critical',
    sourcedFrom: ['segment-discovery', 'bmc-generator'],
    fallbackQuestion: 'Which customer segments should we target?',
    questionType: 'multi_select',
    canBeMultiple: true,
  },
  {
    id: 'value_proposition',
    name: 'Value Proposition',
    description: 'What unique value does the business offer?',
    importance: 'critical',
    sourcedFrom: ['bmc-generator', 'jtbd-analyzer'],
    fallbackQuestion: 'What is the core value proposition?',
    questionType: 'single_select',
    canBeMultiple: false,
  },
  {
    id: 'competitive_strategy',
    name: 'Competitive Strategy',
    description: 'How will we compete in the market?',
    importance: 'critical',
    sourcedFrom: ['porters-five-forces', 'swot-analyzer', 'competitive-positioning'],
    fallbackQuestion: 'What competitive strategy should we pursue?',
    questionType: 'multi_select',
    canBeMultiple: true,
  },

  {
    id: 'growth_strategy',
    name: 'Growth Strategy',
    description: 'How will the business grow?',
    importance: 'important',
    sourcedFrom: ['ansoff-analyzer', 'blue-ocean', 'ocean-strategy'],
    fallbackQuestion: 'Which growth strategies should we prioritize?',
    questionType: 'multi_select',
    canBeMultiple: true,
  },
  {
    id: 'timeline',
    name: 'Implementation Timeline',
    description: 'Target launch/completion timeframe',
    importance: 'important',
    sourcedFrom: [],
    fallbackQuestion: 'What is your target timeline?',
    questionType: 'timeline',
    canBeMultiple: false,
  },
  {
    id: 'budget_range',
    name: 'Budget Range',
    description: 'Available budget for implementation',
    importance: 'important',
    sourcedFrom: [],
    fallbackQuestion: 'What is your approximate budget?',
    questionType: 'budget',
    canBeMultiple: false,
  },
  {
    id: 'risk_tolerance',
    name: 'Risk Tolerance',
    description: 'How much risk is acceptable?',
    importance: 'important',
    sourcedFrom: [],
    fallbackQuestion: 'What is your risk tolerance?',
    questionType: 'scale',
    canBeMultiple: false,
  },

  {
    id: 'geographic_focus',
    name: 'Geographic Focus',
    description: 'Target markets/regions',
    importance: 'optional',
    sourcedFrom: ['pestle-analyzer', 'ansoff-analyzer'],
    fallbackQuestion: 'Which geographic markets should we target?',
    questionType: 'multi_select',
    canBeMultiple: true,
  },
  {
    id: 'key_partnerships',
    name: 'Key Partnerships',
    description: 'Strategic partners to pursue',
    importance: 'optional',
    sourcedFrom: ['bmc-generator', 'value-chain'],
    fallbackQuestion: 'What types of partnerships should we pursue?',
    questionType: 'multi_select',
    canBeMultiple: true,
  },
];

export function getRequirementsByImportance(importance: 'critical' | 'important' | 'optional'): EPMRequirement[] {
  return EPM_REQUIREMENTS.filter(r => r.importance === importance);
}

export function canModuleProvide(moduleId: string, requirementId: string): boolean {
  const requirement = EPM_REQUIREMENTS.find(r => r.id === requirementId);
  return requirement?.sourcedFrom.includes(moduleId) || false;
}

export function getRequirement(requirementId: string): EPMRequirement | undefined {
  return EPM_REQUIREMENTS.find(r => r.id === requirementId);
}

export function getCriticalRequirements(): EPMRequirement[] {
  return getRequirementsByImportance('critical');
}

export function getImportantRequirements(): EPMRequirement[] {
  return getRequirementsByImportance('important');
}

export function getOptionalRequirements(): EPMRequirement[] {
  return getRequirementsByImportance('optional');
}
