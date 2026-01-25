/**
 * VRIO Analyzer Module Manifest
 * Resource-based view analysis for sustainable competitive advantage
 */

import type { ModuleManifest } from '../manifest';

export const vrioAnalyzerManifest: ModuleManifest = {
  id: 'vrio-analyzer',
  name: 'VRIO Framework Analyzer',
  version: '1.0.0',
  description: 'Evaluates resources and capabilities using the VRIO framework (Valuable, Rare, Inimitable, Organized) to identify sources of sustainable competitive advantage.',
  type: 'analyzer',
  category: 'analysis',
  icon: 'gem',
  status: 'implemented',
  inputs: [
    {
      id: 'business_context',
      name: 'businessContext',
      type: 'any',
      required: true,
      description: 'Business context including resources, capabilities, and core competencies',
    },
    {
      id: 'swot_analysis',
      name: 'swotAnalysis',
      type: 'swot_output',
      required: false,
      description: 'Optional SWOT analysis to inform resource evaluation',
    },
  ],
  outputs: [
    {
      id: 'output',
      name: 'vrioAnalysis',
      type: 'vrio_output',
      required: true,
      description: 'Complete VRIO analysis with resource classification and strategic implications',
    },
  ],
  requires: [],
  serviceClass: 'VRIOAnalyzer',
  uiComponent: 'VRIOPage',
  tags: ['strategic-analysis', 'vrio', 'resources', 'competitive-advantage'],
  estimatedDuration: 4,
  isActive: true,
};
