/**
 * Input Processor Module Manifest
 * Processes strategic input and creates understanding context
 */

import type { ModuleManifest } from '../manifest';

export const inputProcessorManifest: ModuleManifest = {
  id: 'input-processor',
  name: 'Strategic Input Processor',
  version: '1.0.0',
  description: 'Processes user strategic input, performs entity extraction, geographic disambiguation, and creates the initial strategic understanding context for downstream frameworks.',
  type: 'processor',
  inputs: [
    {
      name: 'userInput',
      type: 'string',
      required: true,
      description: 'Raw strategic input from user describing their business challenge or opportunity',
    },
    {
      name: 'clarifications',
      type: 'Clarification[]',
      required: false,
      description: 'Optional clarifications gathered from user for ambiguous input',
    },
  ],
  outputs: [
    {
      name: 'strategicUnderstanding',
      type: 'StrategicUnderstanding',
      required: true,
      description: 'Structured understanding of the strategic context',
    },
    {
      name: 'entities',
      type: 'Entity[]',
      required: true,
      description: 'Extracted entities (companies, markets, products, locations)',
    },
    {
      name: 'initialContext',
      type: 'StrategicContext',
      required: true,
      description: 'Initial strategic context to pass to first framework',
    },
  ],
  requires: [],
  serviceClass: 'StrategicUnderstandingService',
  uiComponent: 'StrategicInputPage',
  tags: ['input', 'processing', 'entity-extraction', 'disambiguation'],
  estimatedDuration: 2,
  isActive: true,
};
