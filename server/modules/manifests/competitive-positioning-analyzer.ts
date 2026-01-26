/**
 * Competitive Positioning Analyzer Module Manifest
 * Strategic positioning and differentiation analysis
 */

import type { ModuleManifest } from '../manifest';

export const competitivePositioningAnalyzerManifest: ModuleManifest = {
  id: 'competitive-positioning-analyzer',
  name: 'Competitive Positioning Analyzer',
  version: '1.0.0',
  description: 'Analyzes competitive positioning to identify differentiation opportunities and strategic positioning options in the market.',
  type: 'analyzer',
  moduleType: 'ai_analyzer',
  category: 'strategy',
  icon: 'crosshair',
  status: 'implemented',
  inputs: [
    {
      id: 'business_context',
      name: 'businessContext',
      type: 'any',
      required: true,
      description: 'Business context including current market position and competitors',
    },
    {
      id: 'competitive_forces',
      name: 'competitiveForces',
      type: 'porters_output',
      required: false,
      description: 'Optional Porter\'s Five Forces analysis for competitive context',
    },
    {
      id: 'customer_segments',
      name: 'customerSegments',
      type: 'segment_discovery_output',
      required: false,
      description: 'Optional customer segment data for positioning alignment',
    },
  ],
  outputs: [
    {
      id: 'output',
      name: 'positioningAnalysis',
      type: 'competitive_positioning_output',
      required: true,
      description: 'Complete competitive positioning analysis with differentiation recommendations',
    },
  ],
  requires: [],
  serviceClass: 'CompetitivePositioningAnalyzer',
  uiComponent: 'CompetitivePositioningPage',
  tags: ['strategic-analysis', 'positioning', 'differentiation', 'competition'],
  estimatedDuration: 5,
  isActive: true,
};
