/**
 * Strategic Understanding Module Manifest
 * User input module for collecting strategic context
 */

import type { ModuleManifest } from '../manifest';

export const strategicUnderstandingManifest: ModuleManifest = {
  id: 'strategic-understanding',
  name: 'Strategic Understanding',
  version: '1.0.0',
  description: 'Build strategic context and foundational knowledge graph through guided user input',
  type: 'user-input',
  moduleType: 'user_input',
  category: 'input',
  icon: 'lightbulb',
  status: 'implemented',
  inputs: [
    {
      id: 'user_description',
      name: 'userDescription',
      type: 'string',
      required: true,
      description: 'Raw business description from user',
    },
  ],
  outputs: [
    {
      id: 'output',
      name: 'strategicContext',
      type: 'strategic_context',
      required: true,
      description: 'Processed strategic understanding with entities and classification',
    },
  ],
  requires: [],
  serviceClass: null,
  uiComponent: 'InputPage',
  tags: ['foundation', 'input', 'knowledge-graph'],
  estimatedDuration: 5,
  isActive: true,
};
