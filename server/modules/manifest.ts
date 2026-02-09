/**
 * Module Manifest Types
 * Defines the structure for modular analyzers, generators, processors, and exporters
 * that can be composed into journeys via configuration
 */

export type ModuleType = 'analyzer' | 'generator' | 'processor' | 'exporter' | 'user-input';

export type ModuleCategory = 'input' | 'analysis' | 'strategy' | 'customer' | 'execution' | 'output';

export type ModuleStatus = 'implemented' | 'stub';

export type ModuleExecutionType = 'ai_analyzer' | 'user_input' | 'generator' | 'internal';

export interface PortDefinition {
  id: string;
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  type: ModuleType;
  moduleType: ModuleExecutionType;
  category: ModuleCategory;
  icon: string;
  status: ModuleStatus;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  requires: string[];
  serviceClass: string | null;
  uiComponent?: string;
  tags?: string[];
  estimatedDuration?: number;
  isActive: boolean;
}

export interface ModuleInstance {
  moduleId: string;
  config?: Record<string, unknown>;
}

export function validateManifest(manifest: Partial<ModuleManifest>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!manifest.id || typeof manifest.id !== 'string') {
    errors.push('Module manifest must have a valid id');
  }
  
  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('Module manifest must have a valid name');
  }
  
  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('Module manifest must have a valid version');
  }
  
  if (!manifest.type || !['analyzer', 'generator', 'processor', 'exporter', 'user-input'].includes(manifest.type)) {
    errors.push('Module manifest must have a valid type (analyzer, generator, processor, exporter, user-input)');
  }
  
  if (!manifest.category || !['input', 'analysis', 'strategy', 'customer', 'execution', 'output'].includes(manifest.category)) {
    errors.push('Module manifest must have a valid category (input, analysis, strategy, customer, execution, output)');
  }
  
  if (!manifest.icon || typeof manifest.icon !== 'string') {
    errors.push('Module manifest must have a valid icon');
  }
  
  if (!manifest.status || !['implemented', 'stub'].includes(manifest.status)) {
    errors.push('Module manifest must have a valid status (implemented, stub)');
  }
  
  if (manifest.type !== 'user-input' && (!manifest.serviceClass || typeof manifest.serviceClass !== 'string')) {
    errors.push('Module manifest must have a valid serviceClass (except for user-input types)');
  }
  
  if (!Array.isArray(manifest.inputs)) {
    errors.push('Module manifest must have an inputs array');
  } else {
    manifest.inputs.forEach((input, index) => {
      if (!input.id || typeof input.id !== 'string') {
        errors.push(`Input port at index ${index} must have a valid id`);
      }
    });
  }
  
  if (!Array.isArray(manifest.outputs)) {
    errors.push('Module manifest must have an outputs array');
  } else {
    manifest.outputs.forEach((output, index) => {
      if (!output.id || typeof output.id !== 'string') {
        errors.push(`Output port at index ${index} must have a valid id`);
      }
    });
  }
  
  if (!Array.isArray(manifest.requires)) {
    errors.push('Module manifest must have a requires array');
  }
  
  return { valid: errors.length === 0, errors };
}
