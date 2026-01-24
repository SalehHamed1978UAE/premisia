/**
 * Five Whys Analyzer Module Manifest
 * Root cause analysis framework
 */

import type { ModuleManifest } from '../manifest';

export const fiveWhysAnalyzerManifest: ModuleManifest = {
  id: 'five-whys-analyzer',
  name: 'Five Whys Root Cause Analyzer',
  version: '1.0.0',
  description: 'Interactive root cause analysis using the Five Whys technique with AI-coaching to uncover strategic problems and generate design constraints for downstream frameworks.',
  type: 'analyzer',
  category: 'analysis',
  icon: 'help-circle',
  status: 'implemented',
  inputs: [
    {
      id: 'strategic_context',
      name: 'strategicContext',
      type: 'StrategicContext',
      required: true,
      description: 'The strategic context including the initial problem statement',
    },
    {
      id: 'interactive_mode',
      name: 'interactiveMode',
      type: 'boolean',
      required: false,
      description: 'Whether to run in interactive mode with user input at each level',
    },
  ],
  outputs: [
    {
      id: 'five_whys_analysis',
      name: 'fiveWhysAnalysis',
      type: 'FiveWhysAnalysis',
      required: true,
      description: 'Complete Five Whys tree with questions, answers, and root cause',
    },
    {
      id: 'root_causes',
      name: 'rootCauses',
      type: 'string[]',
      required: true,
      description: 'Identified root causes from the analysis',
    },
    {
      id: 'design_constraints',
      name: 'designConstraints',
      type: 'BMCDesignConstraints',
      required: true,
      description: 'Design constraints to pass to BMC analyzer for guided analysis',
    },
    {
      id: 'strategic_implications',
      name: 'strategicImplications',
      type: 'string[]',
      required: true,
      description: 'Strategic implications derived from root cause analysis',
    },
  ],
  requires: [],
  serviceClass: 'StrategyAnalyzer',
  uiComponent: 'FiveWhysTreePage',
  tags: ['strategic-analysis', 'root-cause', 'five-whys', 'interactive'],
  estimatedDuration: 10,
  isActive: true,
};
