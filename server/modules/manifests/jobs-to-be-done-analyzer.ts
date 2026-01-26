/**
 * Jobs-to-be-Done Analyzer Module Manifest
 * Customer job analysis for innovation and product development
 */

import type { ModuleManifest } from '../manifest';

export const jobsToBeDoneAnalyzerManifest: ModuleManifest = {
  id: 'jobs-to-be-done-analyzer',
  name: 'Jobs-to-be-Done Analyzer',
  version: '1.0.0',
  description: 'Identifies and analyzes customer jobs, pains, and gains using the Jobs-to-be-Done framework to uncover innovation opportunities and improve product-market fit.',
  type: 'analyzer',
  moduleType: 'ai_analyzer',
  category: 'customer',
  icon: 'target',
  status: 'implemented',
  inputs: [
    {
      id: 'business_context',
      name: 'businessContext',
      type: 'any',
      required: true,
      description: 'Business context including product/service and target market',
    },
    {
      id: 'target_segments',
      name: 'targetSegments',
      type: 'segment_discovery_output',
      required: false,
      description: 'Optional customer segment data to focus job analysis',
    },
  ],
  outputs: [
    {
      id: 'output',
      name: 'jtbdAnalysis',
      type: 'jobs_to_be_done_output',
      required: true,
      description: 'Complete JTBD analysis with functional, emotional, and social jobs',
    },
  ],
  requires: [],
  serviceClass: 'JobsToBeDoneAnalyzer',
  uiComponent: 'JobsToBeDonePage',
  tags: ['customer-analysis', 'jtbd', 'innovation', 'product-development'],
  estimatedDuration: 5,
  isActive: true,
};
