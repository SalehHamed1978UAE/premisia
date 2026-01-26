/**
 * PESTLE Analyzer Module Manifest
 * Macro-environmental trend analysis
 */

import type { ModuleManifest } from '../manifest';

export const pestleAnalyzerManifest: ModuleManifest = {
  id: 'pestle-analyzer',
  name: 'PESTLE Trend Analyzer',
  version: '1.0.0',
  description: 'Analyzes macro-environmental trends across Political, Economic, Social, Technological, Legal, and Environmental dimensions with evidence-first research.',
  type: 'analyzer',
  moduleType: 'ai_analyzer',
  category: 'analysis',
  icon: 'globe',
  status: 'implemented',
  inputs: [
    {
      id: 'strategic_context',
      name: 'strategicContext',
      type: 'StrategicContext',
      required: true,
      description: 'The accumulated strategic context including business description and industry',
    },
    {
      id: 'geographic_scope',
      name: 'geographicScope',
      type: 'GeographicScope',
      required: false,
      description: 'Optional geographic scope to focus trend analysis on specific regions',
    },
  ],
  outputs: [
    {
      id: 'pestle_results',
      name: 'pestleResults',
      type: 'PESTLEResults',
      required: true,
      description: 'Complete PESTLE analysis with factors, trends, and impact assessments',
    },
    {
      id: 'external_forces',
      name: 'externalForces',
      type: 'ExternalForce[]',
      required: true,
      description: 'Identified external forces impacting strategic options',
    },
    {
      id: 'strategy_insights',
      name: 'strategyInsights',
      type: 'StrategyInsights',
      required: true,
      description: 'Extracted EPM-mappable insights from environmental analysis',
    },
  ],
  requires: [],
  serviceClass: 'PESTLEAnalyzer',
  uiComponent: 'PESTLEAnalysisPage',
  tags: ['strategic-analysis', 'macro-environment', 'pestle', 'trends'],
  estimatedDuration: 6,
  isActive: true,
};
