/**
 * SWOT Analyzer Module Manifest
 * Strengths, Weaknesses, Opportunities, Threats analysis
 */

import type { ModuleManifest } from '../manifest';

export const swotAnalyzerManifest: ModuleManifest = {
  id: 'swot-analyzer',
  name: 'SWOT Analyzer',
  version: '1.0.0',
  description: 'Analyzes internal strengths and weaknesses alongside external opportunities and threats to provide a comprehensive strategic position assessment.',
  type: 'analyzer',
  category: 'analysis',
  icon: 'compass',
  status: 'stub',
  inputs: [
    {
      id: 'business_context',
      name: 'businessContext',
      type: 'any',
      required: true,
      description: 'Business context from BMC, challenge description, or other strategic input',
    },
    {
      id: 'external_factors',
      name: 'externalFactors',
      type: 'pestle_output',
      required: false,
      description: 'Optional PESTLE analysis results to inform external opportunities and threats',
    },
  ],
  outputs: [
    {
      id: 'output',
      name: 'swotAnalysis',
      type: 'swot_output',
      required: true,
      description: 'Complete SWOT analysis with strengths, weaknesses, opportunities, and threats',
    },
  ],
  requires: [],
  serviceClass: 'SWOTAnalyzer',
  uiComponent: 'SWOTAnalysisPage',
  tags: ['strategic-analysis', 'swot', 'internal-external'],
  estimatedDuration: 4,
  isActive: true,
};
