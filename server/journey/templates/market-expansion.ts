/**
 * Market Expansion Journey Template
 * 
 * For geographic or market segment expansion.
 * Focuses on market analysis, entry strategy, and localization.
 */

import type { JourneyTemplate } from './template-types';

export const marketExpansionTemplate: JourneyTemplate = {
  id: 'market-expansion',
  name: 'Market Expansion Journey',
  description: 'Strategic analysis for market or geographic expansion',

  analysisFrameworks: ['pestle', 'porters', 'ansoff'],

  epmModules: [
    { moduleId: 'executive-summary', required: true },
    { moduleId: 'workstreams', required: true },
    { moduleId: 'market-analysis', required: true },
    { moduleId: 'competitive-landscape', required: true },
    { moduleId: 'entry-strategy', required: true },
    { moduleId: 'timeline', required: true },
    { moduleId: 'resource-plan', required: true },
    { moduleId: 'financial-plan', required: true },
    { moduleId: 'risk-register', required: true },
    { moduleId: 'benefits-realization', required: true },
    { moduleId: 'kpis', required: true },
    { moduleId: 'stage-gates', required: true },
    { moduleId: 'stakeholder-map', required: true },
  ],

  industryHints: ['expansion', 'international', 'market entry', 'geographic', 'new market', 'region'],

  defaultTimeline: { min: 6, max: 24 },
  defaultBudget: { min: 200000, max: 5000000 },
};
