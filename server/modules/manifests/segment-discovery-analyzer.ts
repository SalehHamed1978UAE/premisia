/**
 * Segment Discovery Analyzer Module Manifest
 * Customer segment identification and analysis
 */

import type { ModuleManifest } from '../manifest';

export const segmentDiscoveryAnalyzerManifest: ModuleManifest = {
  id: 'segment-discovery-analyzer',
  name: 'Customer Segment Discovery',
  version: '1.0.0',
  description: 'Identifies and analyzes customer segments to find beachhead and backup segments for market entry and expansion strategies.',
  type: 'analyzer',
  moduleType: 'ai_analyzer',
  category: 'customer',
  icon: 'users',
  status: 'implemented',
  inputs: [
    {
      id: 'offering',
      name: 'offering',
      type: 'string',
      required: true,
      description: 'Description of the product or service offering being analyzed',
    },
    {
      id: 'classification',
      name: 'classification',
      type: 'marketing_context',
      required: true,
      description: 'Business classification including B2B/B2C, stage, and market context',
    },
  ],
  outputs: [
    {
      id: 'output',
      name: 'segmentDiscovery',
      type: 'segment_discovery_output',
      required: true,
      description: 'Complete segment analysis with beachhead and backup segments',
    },
  ],
  requires: [],
  serviceClass: 'SegmentDiscoveryAnalyzer',
  uiComponent: 'SegmentDiscoveryPage',
  tags: ['customer-analysis', 'segmentation', 'market-entry'],
  estimatedDuration: 5,
  isActive: true,
};
