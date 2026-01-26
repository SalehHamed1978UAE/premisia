/**
 * OKR Generator Module Manifest
 * Objectives and Key Results generation from strategic analysis
 */

import type { ModuleManifest } from '../manifest';

export const okrGeneratorManifest: ModuleManifest = {
  id: 'okr-generator',
  name: 'OKR Generator',
  version: '1.0.0',
  description: 'Generates Objectives and Key Results (OKRs) from strategic analysis outputs, creating measurable goals aligned with strategic priorities.',
  type: 'generator',
  moduleType: 'generator',
  category: 'execution',
  icon: 'flag',
  status: 'implemented',
  inputs: [
    {
      id: 'strategic_analysis',
      name: 'strategicAnalysis',
      type: 'any',
      required: true,
      description: 'Strategic analysis output from SWOT, Ansoff, or other strategy frameworks',
    },
    {
      id: 'business_context',
      name: 'businessContext',
      type: 'any',
      required: false,
      description: 'Optional additional business context for OKR generation',
    },
  ],
  outputs: [
    {
      id: 'output',
      name: 'okrs',
      type: 'okr_output',
      required: true,
      description: 'Complete set of Objectives and Key Results aligned with strategic priorities',
    },
  ],
  requires: [],
  serviceClass: 'OKRGenerator',
  uiComponent: 'OKRGeneratorPage',
  tags: ['execution', 'okr', 'goals', 'measurement'],
  estimatedDuration: 3,
  isActive: true,
};
