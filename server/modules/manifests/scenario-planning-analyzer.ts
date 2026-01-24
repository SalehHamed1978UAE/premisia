/**
 * Scenario Planning Analyzer Module Manifest
 * Future scenario development and strategic preparedness
 */

import type { ModuleManifest } from '../manifest';

export const scenarioPlanningAnalyzerManifest: ModuleManifest = {
  id: 'scenario-planning-analyzer',
  name: 'Scenario Planning Analyzer',
  version: '1.0.0',
  description: 'Develops multiple future scenarios based on key uncertainties and macro-environmental factors to prepare strategic responses and build organizational resilience.',
  type: 'analyzer',
  category: 'strategy',
  icon: 'git-branch',
  status: 'stub',
  inputs: [
    {
      id: 'business_context',
      name: 'businessContext',
      type: 'any',
      required: true,
      description: 'Business context including strategic objectives and key uncertainties',
    },
    {
      id: 'macro_factors',
      name: 'macroFactors',
      type: 'pestle_output',
      required: false,
      description: 'Optional PESTLE analysis to inform scenario development',
    },
  ],
  outputs: [
    {
      id: 'output',
      name: 'scenarioAnalysis',
      type: 'scenario_planning_output',
      required: true,
      description: 'Complete scenario analysis with multiple future scenarios and strategic implications',
    },
  ],
  requires: [],
  serviceClass: 'ScenarioPlanningAnalyzer',
  uiComponent: 'ScenarioPlanningPage',
  tags: ['strategic-analysis', 'scenario-planning', 'futures', 'uncertainty'],
  estimatedDuration: 6,
  isActive: true,
};
