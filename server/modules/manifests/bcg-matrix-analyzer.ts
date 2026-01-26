/**
 * BCG Matrix Analyzer Module Manifest
 * Portfolio analysis and resource allocation framework
 */

import type { ModuleManifest } from '../manifest';

export const bcgMatrixAnalyzerManifest: ModuleManifest = {
  id: 'bcg-matrix-analyzer',
  name: 'BCG Growth-Share Matrix Analyzer',
  version: '1.0.0',
  description: 'Analyzes product/business unit portfolio using the BCG Matrix framework to classify as Stars, Cash Cows, Question Marks, or Dogs for optimal resource allocation.',
  type: 'analyzer',
  moduleType: 'ai_analyzer',
  category: 'strategy',
  icon: 'pie-chart',
  status: 'implemented',
  inputs: [
    {
      id: 'business_context',
      name: 'businessContext',
      type: 'any',
      required: true,
      description: 'Business context including product portfolio and market positions',
    },
    {
      id: 'market_data',
      name: 'marketData',
      type: 'market_analysis',
      required: false,
      description: 'Optional market growth and share data for more accurate classification',
    },
  ],
  outputs: [
    {
      id: 'output',
      name: 'bcgAnalysis',
      type: 'bcg_matrix_output',
      required: true,
      description: 'Complete BCG Matrix with portfolio classification and investment recommendations',
    },
  ],
  requires: [],
  serviceClass: 'BCGMatrixAnalyzer',
  uiComponent: 'BCGMatrixPage',
  tags: ['strategic-analysis', 'portfolio', 'bcg-matrix', 'resource-allocation'],
  estimatedDuration: 4,
  isActive: true,
};
