/**
 * Product Launch Journey Template
 * 
 * For new product or service launches.
 * Focuses on market analysis, go-to-market strategy, and launch execution.
 */

import type { JourneyTemplate } from './template-types';

export const productLaunchTemplate: JourneyTemplate = {
  id: 'product-launch',
  name: 'Product Launch Journey',
  description: 'Strategic analysis for new product or service launches',

  analysisFrameworks: ['swot', 'segment_discovery', 'competitive_positioning'],

  epmModules: [
    { moduleId: 'executive-summary', required: true },
    { moduleId: 'workstreams', required: true },
    { moduleId: 'market-analysis', required: true },
    { moduleId: 'go-to-market', required: true },
    { moduleId: 'timeline', required: true },
    { moduleId: 'resource-plan', required: true },
    { moduleId: 'financial-plan', required: true },
    { moduleId: 'risk-register', required: true },
    { moduleId: 'benefits-realization', required: true },
    { moduleId: 'kpis', required: true },
    { moduleId: 'stage-gates', required: true },
  ],

  industryHints: ['product', 'launch', 'new', 'MVP', 'release', 'market entry'],

  defaultTimeline: { min: 3, max: 12 },
  defaultBudget: { min: 50000, max: 1000000 },
};
