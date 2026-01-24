/**
 * Blue Ocean Strategy Analyzer Module Manifest
 * Market creation and differentiation analysis
 */

import type { ModuleManifest } from '../manifest';

export const blueOceanAnalyzerManifest: ModuleManifest = {
  id: 'blue-ocean-analyzer',
  name: 'Blue Ocean Strategy Analyzer',
  version: '1.0.0',
  description: 'Applies Blue Ocean Strategy framework to identify uncontested market spaces and create new demand through value innovation.',
  type: 'analyzer',
  category: 'strategy',
  icon: 'waves',
  status: 'stub',
  inputs: [
    {
      id: 'business_context',
      name: 'businessContext',
      type: 'any',
      required: true,
      description: 'Current business context and competitive landscape',
    },
    {
      id: 'industry_analysis',
      name: 'industryAnalysis',
      type: 'porters_output',
      required: false,
      description: 'Optional Porter\'s Five Forces analysis to understand current red ocean',
    },
  ],
  outputs: [
    {
      id: 'output',
      name: 'blueOceanAnalysis',
      type: 'blue_ocean_output',
      required: true,
      description: 'Blue Ocean strategy canvas with eliminate-reduce-raise-create framework',
    },
  ],
  requires: [],
  serviceClass: 'BlueOceanAnalyzer',
  uiComponent: 'BlueOceanPage',
  tags: ['strategic-analysis', 'market-creation', 'blue-ocean', 'differentiation'],
  estimatedDuration: 5,
  isActive: true,
};
