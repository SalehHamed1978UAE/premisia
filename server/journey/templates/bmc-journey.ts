/**
 * Business Model Canvas Journey Template
 * 
 * BMC-focused analysis leading to strategic execution plan.
 * For rethinking business models, revenue streams, and value creation.
 */

import type { JourneyTemplate } from './template-types';

export const bmcJourneyTemplate: JourneyTemplate = {
  id: 'bmc-journey',
  name: 'Business Model Canvas Journey',
  description: 'BMC-focused analysis leading to strategic execution plan',

  analysisFrameworks: ['bmc', 'swot'],

  epmModules: [
    { moduleId: 'executive-summary', required: true },
    { moduleId: 'workstreams', required: true },
    { moduleId: 'value-proposition', required: true },
    { moduleId: 'customer-segments', required: true },
    { moduleId: 'channels', required: true },
    { moduleId: 'revenue-streams', required: true },
    { moduleId: 'timeline', required: true },
    { moduleId: 'resource-plan', required: true },
    { moduleId: 'financial-plan', required: true },
    { moduleId: 'risk-register', required: true },
    { moduleId: 'kpis', required: true },
  ],

  defaultTimeline: { min: 3, max: 12 },
};
