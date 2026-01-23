/**
 * Module Manifest Types
 * Defines the structure for modular analyzers, generators, processors, and exporters
 * that can be composed into journeys via configuration
 */

export type ModuleType = 'analyzer' | 'generator' | 'processor' | 'exporter';

export interface PortDefinition {
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
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  requires: string[];
  serviceClass: string;
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
  
  if (!manifest.type || !['analyzer', 'generator', 'processor', 'exporter'].includes(manifest.type)) {
    errors.push('Module manifest must have a valid type (analyzer, generator, processor, exporter)');
  }
  
  if (!manifest.serviceClass || typeof manifest.serviceClass !== 'string') {
    errors.push('Module manifest must have a valid serviceClass');
  }
  
  if (!Array.isArray(manifest.inputs)) {
    errors.push('Module manifest must have an inputs array');
  }
  
  if (!Array.isArray(manifest.outputs)) {
    errors.push('Module manifest must have an outputs array');
  }
  
  if (!Array.isArray(manifest.requires)) {
    errors.push('Module manifest must have a requires array');
  }
  
  return { valid: errors.length === 0, errors };
}
