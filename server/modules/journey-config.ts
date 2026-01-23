/**
 * Journey Config Schema
 * Defines journey configurations that compose modules into executable workflows
 */

import type { ModuleInstance } from './manifest';

export interface PageSequenceEntry {
  path: string;
  module: string;
  condition?: string;
}

export interface JourneyTransition {
  from: string;
  to: string;
  condition?: string;
}

export interface JourneyReadinessConfig {
  minReferences?: number;
  minEntities?: number;
  requiredModules?: string[];
}

export interface JourneyInsightsConfig {
  requiresFiveWhys?: boolean;
  requiresBmc?: boolean;
  requiresPorters?: boolean;
  requiresPestle?: boolean;
}

export interface JourneyConfig {
  id: string;
  name: string;
  version: string;
  description: string;
  modules: ModuleInstance[];
  pageSequence: PageSequenceEntry[];
  transitions: JourneyTransition[];
  estimatedDuration?: string;
  available: boolean;
  summaryBuilder?: string;
  defaultReadiness?: JourneyReadinessConfig;
  insightsConfig?: JourneyInsightsConfig;
  tags?: string[];
}

export function validateJourneyConfig(
  config: Partial<JourneyConfig>,
  registeredModuleIds: string[]
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!config.id || typeof config.id !== 'string') {
    errors.push('Journey config must have a valid id');
  }
  
  if (!config.name || typeof config.name !== 'string') {
    errors.push('Journey config must have a valid name');
  }
  
  if (!config.version || typeof config.version !== 'string') {
    errors.push('Journey config must have a valid version');
  }
  
  if (!Array.isArray(config.modules)) {
    errors.push('Journey config must have a modules array');
  } else {
    for (const mod of config.modules) {
      if (!mod.moduleId) {
        errors.push('Each module instance must have a moduleId');
      } else if (!registeredModuleIds.includes(mod.moduleId)) {
        errors.push(`Module "${mod.moduleId}" is not registered in the module registry`);
      }
    }
  }
  
  if (!Array.isArray(config.pageSequence)) {
    errors.push('Journey config must have a pageSequence array');
  } else {
    for (const page of config.pageSequence) {
      if (!page.path) {
        errors.push('Each page sequence entry must have a path');
      }
      if (!page.module) {
        errors.push('Each page sequence entry must have a module');
      }
    }
  }
  
  if (!Array.isArray(config.transitions)) {
    errors.push('Journey config must have a transitions array');
  }
  
  if (config.available === undefined) {
    warnings.push('Journey config should have an "available" flag, defaulting to false');
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

export interface JourneyConfigYaml {
  id: string;
  name: string;
  version: string;
  description: string;
  modules: Array<{ id: string; config?: Record<string, unknown> }>;
  page_sequence: Array<{ path: string; module: string; condition?: string }>;
  transitions: Array<{ from: string; to: string; condition?: string }>;
  estimated_duration?: string;
  available: boolean;
  summary_builder?: string;
  default_readiness?: {
    min_references?: number;
    min_entities?: number;
    required_modules?: string[];
  };
  insights_config?: {
    requires_five_whys?: boolean;
    requires_bmc?: boolean;
    requires_porters?: boolean;
    requires_pestle?: boolean;
  };
  tags?: string[];
}

export function yamlToJourneyConfig(yaml: JourneyConfigYaml): JourneyConfig {
  return {
    id: yaml.id,
    name: yaml.name,
    version: yaml.version,
    description: yaml.description,
    modules: yaml.modules.map(m => ({ moduleId: m.id, config: m.config })),
    pageSequence: yaml.page_sequence.map(p => ({
      path: p.path,
      module: p.module,
      condition: p.condition,
    })),
    transitions: yaml.transitions.map(t => ({
      from: t.from,
      to: t.to,
      condition: t.condition,
    })),
    estimatedDuration: yaml.estimated_duration,
    available: yaml.available ?? false,
    summaryBuilder: yaml.summary_builder,
    defaultReadiness: yaml.default_readiness ? {
      minReferences: yaml.default_readiness.min_references,
      minEntities: yaml.default_readiness.min_entities,
      requiredModules: yaml.default_readiness.required_modules,
    } : undefined,
    insightsConfig: yaml.insights_config ? {
      requiresFiveWhys: yaml.insights_config.requires_five_whys,
      requiresBmc: yaml.insights_config.requires_bmc,
      requiresPorters: yaml.insights_config.requires_porters,
      requiresPestle: yaml.insights_config.requires_pestle,
    } : undefined,
    tags: yaml.tags,
  };
}
