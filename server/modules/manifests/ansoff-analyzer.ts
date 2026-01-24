/**
 * Ansoff Matrix Analyzer Module Manifest
 * Growth strategy analysis framework
 */

import type { ModuleManifest } from '../manifest';

export const ansoffAnalyzerManifest: ModuleManifest = {
  id: 'ansoff-analyzer',
  name: 'Ansoff Growth Matrix Analyzer',
  version: '1.0.0',
  description: 'Analyzes growth opportunities using the Ansoff Matrix framework: market penetration, market development, product development, and diversification strategies.',
  type: 'analyzer',
  category: 'strategy',
  icon: 'grid',
  status: 'stub',
  inputs: [
    {
      id: 'business_context',
      name: 'businessContext',
      type: 'any',
      required: true,
      description: 'Business context including current products, markets, and growth objectives',
    },
    {
      id: 'swot_analysis',
      name: 'swotAnalysis',
      type: 'swot_output',
      required: false,
      description: 'Optional SWOT analysis to inform growth strategy recommendations',
    },
  ],
  outputs: [
    {
      id: 'output',
      name: 'ansoffAnalysis',
      type: 'ansoff_output',
      required: true,
      description: 'Complete Ansoff Matrix analysis with growth strategy recommendations',
    },
  ],
  requires: [],
  serviceClass: 'AnsoffAnalyzer',
  uiComponent: 'AnsoffMatrixPage',
  tags: ['strategic-analysis', 'growth-strategy', 'ansoff'],
  estimatedDuration: 4,
  isActive: true,
};
