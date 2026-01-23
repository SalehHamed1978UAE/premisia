/**
 * EPM Generator Module Manifest
 * Converts strategic analysis into EPM program structures
 */

import type { ModuleManifest } from '../manifest';

export const epmGeneratorManifest: ModuleManifest = {
  id: 'epm-generator',
  name: 'EPM Program Generator',
  version: '1.0.0',
  description: 'Synthesizes strategic framework results into executable Enterprise Program Management structures including workstreams, tasks, resources, risks, and timelines.',
  type: 'generator',
  inputs: [
    {
      name: 'strategicContext',
      type: 'StrategicContext',
      required: true,
      description: 'Complete strategic context with all framework results',
    },
    {
      name: 'strategyInsights',
      type: 'StrategyInsights[]',
      required: true,
      description: 'Aggregated insights from all completed frameworks',
    },
    {
      name: 'strategicDecisions',
      type: 'StrategicDecision[]',
      required: true,
      description: 'User-prioritized strategic decisions',
    },
  ],
  outputs: [
    {
      name: 'epmProgram',
      type: 'EPMProgram',
      required: true,
      description: 'Complete EPM program structure ready for execution',
    },
    {
      name: 'workstreams',
      type: 'Workstream[]',
      required: true,
      description: 'Generated workstreams with tasks and dependencies',
    },
    {
      name: 'timeline',
      type: 'ProgramTimeline',
      required: true,
      description: 'Optimized program timeline with milestones',
    },
    {
      name: 'resourcePlan',
      type: 'ResourcePlan',
      required: true,
      description: 'Resource allocation plan across workstreams',
    },
  ],
  requires: ['five-whys-analyzer', 'bmc-analyzer'],
  serviceClass: 'EPMSynthesizer',
  uiComponent: 'EPMProgramView',
  tags: ['generation', 'epm', 'program-management', 'execution'],
  estimatedDuration: 3,
  isActive: true,
};
