/**
 * Digital Transformation Journey Template
 * 
 * For organizations undergoing digital modernization.
 * Focuses on technology adoption, process automation, and change management.
 */

import type { JourneyTemplate } from './template-types';

export const digitalTransformationTemplate: JourneyTemplate = {
  id: 'digital-transformation',
  name: 'Digital Transformation Journey',
  description: 'Strategic analysis for digital modernization initiatives',

  analysisFrameworks: ['five_whys', 'swot', 'value_chain'],

  epmModules: [
    { moduleId: 'executive-summary', required: true },
    { moduleId: 'workstreams', required: true },
    { moduleId: 'technology-roadmap', required: true },
    { moduleId: 'change-management', required: true },
    { moduleId: 'timeline', required: true },
    { moduleId: 'resource-plan', required: true },
    { moduleId: 'financial-plan', required: true },
    { moduleId: 'risk-register', required: true },
    { moduleId: 'benefits-realization', required: true },
    { moduleId: 'kpis', required: true },
    { moduleId: 'stage-gates', required: true },
    { moduleId: 'stakeholder-map', required: true },
    { moduleId: 'governance', required: true },
  ],

  industryHints: ['technology', 'software', 'IT', 'digital', 'automation', 'cloud'],

  defaultTimeline: { min: 12, max: 36 },
  defaultBudget: { min: 500000, max: 10000000 },
};
