/**
 * Strategic Decisions Module Manifest
 * User input step for capturing strategic decisions and priorities
 */

import type { ModuleManifest } from '../manifest';

export const strategicDecisionsManifest: ModuleManifest = {
  id: 'strategic-decisions',
  name: 'Strategic Decisions',
  version: '1.0.0',
  description: 'Pauses journey execution for user to input strategic decisions, priorities, and key choices. Captures executive decisions that drive downstream analysis and EPM program generation.',
  type: 'user-input',
  moduleType: 'user_input',
  category: 'input',
  icon: 'lightbulb',
  status: 'implemented',
  inputs: [
    {
      id: 'strategic_context',
      name: 'strategicContext',
      type: 'StrategicContext',
      required: true,
      description: 'Strategic context from prior analysis to inform decision-making',
    },
    {
      id: 'understanding_id',
      name: 'understandingId',
      type: 'string',
      required: true,
      description: 'The strategic understanding ID for this session',
    },
  ],
  outputs: [
    {
      id: 'decisions',
      name: 'decisions',
      type: 'StrategicDecision[]',
      required: true,
      description: 'Array of strategic decisions made by the user',
    },
    {
      id: 'priorities',
      name: 'priorities',
      type: 'Priority[]',
      required: false,
      description: 'Prioritized list of focus areas',
    },
  ],
  requires: [],
  serviceClass: null,
  uiComponent: 'DecisionPage',
  tags: ['input', 'decisions', 'user-input', 'priorities'],
  estimatedDuration: 7,
  isActive: true,
};
