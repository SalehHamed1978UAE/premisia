/**
 * Ocean Strategy Analyzer Module Manifest
 * Red Ocean vs Blue Ocean strategic analysis
 */

import type { ModuleManifest } from '../manifest';

export const oceanStrategyAnalyzerManifest: ModuleManifest = {
  id: 'ocean-strategy-analyzer',
  name: 'Ocean Strategy Analyzer',
  version: '1.0.0',
  description: 'Analyzes the competitive landscape to determine whether to compete in red ocean (existing market) or create blue ocean (new market space) strategies.',
  type: 'analyzer',
  category: 'strategy',
  icon: 'navigation',
  status: 'implemented',
  inputs: [
    {
      id: 'business_context',
      name: 'businessContext',
      type: 'any',
      required: true,
      description: 'Business context including current market position and strategic objectives',
    },
    {
      id: 'industry_analysis',
      name: 'industryAnalysis',
      type: 'porters_output',
      required: false,
      description: 'Optional Porter\'s analysis to understand current competitive intensity',
    },
    {
      id: 'swot_analysis',
      name: 'swotAnalysis',
      type: 'swot_output',
      required: false,
      description: 'Optional SWOT analysis to inform ocean strategy selection',
    },
  ],
  outputs: [
    {
      id: 'output',
      name: 'oceanStrategyAnalysis',
      type: 'ocean_strategy_output',
      required: true,
      description: 'Complete ocean strategy analysis with red/blue ocean recommendations',
    },
  ],
  requires: [],
  serviceClass: 'OceanStrategyAnalyzer',
  uiComponent: 'OceanStrategyPage',
  tags: ['strategic-analysis', 'ocean-strategy', 'market-creation', 'competition'],
  estimatedDuration: 5,
  isActive: true,
};
