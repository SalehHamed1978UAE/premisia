/**
 * Value Chain Analyzer Module Manifest
 * Internal activity analysis for competitive advantage
 */

import type { ModuleManifest } from '../manifest';

export const valueChainAnalyzerManifest: ModuleManifest = {
  id: 'value-chain-analyzer',
  name: 'Value Chain Analyzer',
  version: '1.0.0',
  description: 'Analyzes primary and support activities in the value chain to identify sources of competitive advantage and optimization opportunities.',
  type: 'analyzer',
  category: 'analysis',
  icon: 'link',
  status: 'stub',
  inputs: [
    {
      id: 'business_context',
      name: 'businessContext',
      type: 'any',
      required: true,
      description: 'Business context including operations, processes, and activities',
    },
    {
      id: 'customer_context',
      name: 'customerContext',
      type: 'segment_discovery_output',
      required: false,
      description: 'Optional customer segment data to align value chain with customer needs',
    },
  ],
  outputs: [
    {
      id: 'output',
      name: 'valueChainAnalysis',
      type: 'value_chain_output',
      required: true,
      description: 'Complete value chain analysis with activity mapping and optimization recommendations',
    },
  ],
  requires: [],
  serviceClass: 'ValueChainAnalyzer',
  uiComponent: 'ValueChainPage',
  tags: ['strategic-analysis', 'value-chain', 'operations', 'competitive-advantage'],
  estimatedDuration: 5,
  isActive: true,
};
