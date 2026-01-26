/**
 * Porter's Five Forces Analyzer Module Manifest
 * Competitive analysis framework
 */

import type { ModuleManifest } from '../manifest';

export const portersAnalyzerManifest: ModuleManifest = {
  id: 'porters-analyzer',
  name: "Porter's Five Forces Analyzer",
  version: '1.0.0',
  description: 'Analyzes competitive dynamics using Porter\'s Five Forces framework to identify threats, opportunities, and strategic positioning requirements.',
  type: 'analyzer',
  moduleType: 'ai_analyzer',
  category: 'analysis',
  icon: 'shield',
  status: 'implemented',
  inputs: [
    {
      id: 'strategic_context',
      name: 'strategicContext',
      type: 'StrategicContext',
      required: true,
      description: 'The accumulated strategic context including user input and market information',
    },
    {
      id: 'industry_context',
      name: 'industryContext',
      type: 'IndustryContext',
      required: false,
      description: 'Optional industry-specific context to enhance competitive analysis',
    },
  ],
  outputs: [
    {
      id: 'porters_results',
      name: 'portersResults',
      type: 'PortersResults',
      required: true,
      description: 'Complete Five Forces analysis with scores, drivers, and strategic implications',
    },
    {
      id: 'competitive_pressures',
      name: 'competitivePressures',
      type: 'CompetitivePressure[]',
      required: true,
      description: 'Identified competitive pressures requiring strategic response',
    },
    {
      id: 'strategy_insights',
      name: 'strategyInsights',
      type: 'StrategyInsights',
      required: true,
      description: 'Extracted EPM-mappable insights from competitive analysis',
    },
  ],
  requires: [],
  serviceClass: 'PortersAnalyzer',
  uiComponent: 'PortersAnalysisPage',
  tags: ['strategic-analysis', 'competitive-analysis', 'porters'],
  estimatedDuration: 5,
  isActive: true,
};
