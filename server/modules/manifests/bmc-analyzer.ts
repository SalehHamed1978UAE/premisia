/**
 * BMC Analyzer Module Manifest
 * Business Model Canvas strategic analysis
 */

import type { ModuleManifest } from '../manifest';

export const bmcAnalyzerManifest: ModuleManifest = {
  id: 'bmc-analyzer',
  name: 'Business Model Canvas Analyzer',
  version: '1.0.0',
  description: 'Analyzes business model using the 9-block BMC framework with research-backed insights, cross-block consistency validation, and contradiction detection.',
  type: 'analyzer',
  inputs: [
    {
      name: 'strategicContext',
      type: 'StrategicContext',
      required: true,
      description: 'The accumulated strategic context including user input and previous framework results',
    },
    {
      name: 'designConstraints',
      type: 'BMCDesignConstraints',
      required: false,
      description: 'Optional constraints from Five Whys analysis to guide BMC block design',
    },
  ],
  outputs: [
    {
      name: 'bmcResults',
      type: 'BMCResults',
      required: true,
      description: 'Complete 9-block BMC analysis with scores, research, and recommendations',
    },
    {
      name: 'contradictions',
      type: 'Contradiction[]',
      required: false,
      description: 'Detected contradictions between BMC blocks',
    },
    {
      name: 'strategyInsights',
      type: 'StrategyInsights',
      required: true,
      description: 'Extracted EPM-mappable insights from BMC analysis',
    },
  ],
  requires: [],
  serviceClass: 'BMCAnalyzer',
  uiComponent: 'BMCResearchPage',
  tags: ['strategic-analysis', 'business-model', 'bmc'],
  estimatedDuration: 8,
  isActive: true,
};
