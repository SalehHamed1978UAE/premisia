/**
 * Standard EPM Journey Template
 * 
 * Full strategic analysis to EPM program generation.
 * The default template for most business initiatives.
 */

import type { JourneyTemplate } from './template-types';

export const standardEPMTemplate: JourneyTemplate = {
  id: 'standard-epm',
  name: 'Standard EPM Journey',
  description: 'Full strategic analysis to EPM program generation',

  analysisFrameworks: ['five_whys', 'swot'],

  epmModules: [
    { moduleId: 'executive-summary', required: true },
    { moduleId: 'workstreams', required: true },
    { moduleId: 'timeline', required: true },
    { moduleId: 'resource-plan', required: true },
    { moduleId: 'financial-plan', required: true },
    { moduleId: 'risk-register', required: true },
    { moduleId: 'benefits-realization', required: true },
    { moduleId: 'kpis', required: true },
    { moduleId: 'stage-gates', required: true },
    { moduleId: 'stakeholder-map', required: true },
    { moduleId: 'governance', required: true },
    { moduleId: 'qa-plan', required: true },
    { moduleId: 'procurement', required: true },
    { moduleId: 'exit-strategy', required: true },
  ],

  defaultTimeline: { min: 6, max: 18 },
  defaultBudget: { min: 100000, max: 2000000 },
};
