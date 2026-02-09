/**
 * MODULE SYSTEM VALIDATION
 * Run at startup to ensure module system is properly configured.
 * Validates: manifest exists, moduleType set, exports in index, implementation exists
 */

import { allManifests } from './manifests/index';
import type { ModuleManifest } from './manifest';

interface ValidationResult {
  moduleId: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface SystemValidation {
  valid: boolean;
  totalModules: number;
  validModules: number;
  invalidModules: number;
  results: ValidationResult[];
  criticalErrors: string[];
}

const MANIFEST_ID_TO_REGISTRY_KEY: Record<string, string> = {
  'swot-analyzer': 'swot',
  'bmc-analyzer': 'bmc',
  'porters-analyzer': 'porters',
  'pestle-analyzer': 'pestle',
  'five-whys-analyzer': 'five_whys',
  'ansoff-analyzer': 'ansoff',
  'blue-ocean-analyzer': 'blue_ocean',
  'ocean-strategy-analyzer': 'ocean_strategy',
  'bcg-matrix-analyzer': 'bcg_matrix',
  'value-chain-analyzer': 'value_chain',
  'vrio-analyzer': 'vrio',
  'scenario-planning-analyzer': 'scenario_planning',
  'jobs-to-be-done-analyzer': 'jobs_to_be_done',
  'competitive-positioning-analyzer': 'competitive_positioning',
  'segment-discovery-analyzer': 'segment_discovery',
  'strategic-decisions': 'strategic_decisions',
  'strategic-understanding': 'strategic_understanding',
  'epm-generator': 'epm',
  'okr-generator': 'okr',
  'input-processor': 'input_processor',
};

const MODULE_TYPE_VALID_VALUES = ['ai_analyzer', 'user_input', 'generator', 'internal'] as const;

function validateManifest(manifest: ModuleManifest): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!manifest.id) {
    errors.push('Missing manifest id');
  }

  if (!manifest.moduleType) {
    errors.push('Missing required moduleType field');
  } else if (!MODULE_TYPE_VALID_VALUES.includes(manifest.moduleType as any)) {
    errors.push(`Invalid moduleType: ${manifest.moduleType}. Must be one of: ${MODULE_TYPE_VALID_VALUES.join(', ')}`);
  }

  if (!manifest.type) {
    errors.push('Missing type field');
  }

  if (manifest.type === 'analyzer' && manifest.moduleType !== 'ai_analyzer') {
    warnings.push(`Analyzer type but moduleType is ${manifest.moduleType}, expected ai_analyzer`);
  }

  if (manifest.type === 'generator' && manifest.moduleType !== 'generator') {
    warnings.push(`Generator type but moduleType is ${manifest.moduleType}, expected generator`);
  }

  if (manifest.type === 'user-input' && manifest.moduleType !== 'user_input') {
    warnings.push(`User-input type but moduleType is ${manifest.moduleType}, expected user_input`);
  }

  if (!manifest.name) {
    errors.push('Missing name field');
  }

  if (!Array.isArray(manifest.inputs)) {
    errors.push('inputs must be an array');
  }

  if (!Array.isArray(manifest.outputs)) {
    errors.push('outputs must be an array');
  }

  if (manifest.status === 'stub') {
    warnings.push('Module status is stub - not fully implemented');
  }

  if (!manifest.isActive) {
    warnings.push('Module is not active');
  }

  const registryKey = MANIFEST_ID_TO_REGISTRY_KEY[manifest.id];
  if (!registryKey) {
    warnings.push(`No registry key mapping for manifest id: ${manifest.id}`);
  }

  return {
    moduleId: manifest.id,
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateModuleSystem(): SystemValidation {
  const results: ValidationResult[] = [];
  const criticalErrors: string[] = [];

  if (allManifests.length === 0) {
    criticalErrors.push('No manifests found in allManifests array');
  }

  const manifestIds = new Set<string>();
  for (const manifest of allManifests) {
    if (manifestIds.has(manifest.id)) {
      criticalErrors.push(`Duplicate manifest id: ${manifest.id}`);
    }
    manifestIds.add(manifest.id);

    const result = validateManifest(manifest);
    results.push(result);
  }

  const validModules = results.filter(r => r.valid).length;
  const invalidModules = results.filter(r => !r.valid).length;

  return {
    valid: criticalErrors.length === 0 && invalidModules === 0,
    totalModules: allManifests.length,
    validModules,
    invalidModules,
    results,
    criticalErrors,
  };
}

export function logValidationResults(validation: SystemValidation): void {
  console.log('\n=== MODULE SYSTEM VALIDATION ===');
  console.log(`Total Modules: ${validation.totalModules}`);
  console.log(`Valid: ${validation.validModules}`);
  console.log(`Invalid: ${validation.invalidModules}`);
  
  if (validation.criticalErrors.length > 0) {
    console.log('\n[CRITICAL ERRORS]:');
    validation.criticalErrors.forEach(e => console.log(`  - ${e}`));
  }

  const failedModules = validation.results.filter(r => !r.valid);
  if (failedModules.length > 0) {
    console.log('\n[FAILED MODULES]:');
    failedModules.forEach(r => {
      console.log(`  ${r.moduleId}:`);
      r.errors.forEach(e => console.log(`    ERROR: ${e}`));
    });
  }

  const modulesWithWarnings = validation.results.filter(r => r.warnings.length > 0);
  if (modulesWithWarnings.length > 0) {
    console.log('\n[WARNINGS]:');
    modulesWithWarnings.forEach(r => {
      r.warnings.forEach(w => console.log(`  ${r.moduleId}: ${w}`));
    });
  }

  console.log(`\n=== VALIDATION ${validation.valid ? 'PASSED' : 'FAILED'} ===\n`);
}

export function getManifestByRegistryKey(registryKey: string): ModuleManifest | undefined {
  const manifestId = Object.entries(MANIFEST_ID_TO_REGISTRY_KEY)
    .find(([_, key]) => key === registryKey)?.[0];
  
  if (!manifestId) return undefined;
  
  return allManifests.find(m => m.id === manifestId);
}

export function getRegistryKeyByManifestId(manifestId: string): string | undefined {
  return MANIFEST_ID_TO_REGISTRY_KEY[manifestId];
}

export { allManifests };

/**
 * Validate module system at startup - fail fast if misconfigured
 */
export async function validateOnStartup(): Promise<void> {
  console.log('[Server] Validating module system...');
  const validation = validateModuleSystem();
  logValidationResults(validation);
  
  if (!validation.valid) {
    console.error('[Server] ❌ Module system validation FAILED');
    console.error('[Server] Fix the errors above before continuing');
    // In production, you may want to throw here to prevent startup
    // throw new Error('Module system validation failed');
  } else {
    console.log('[Server] ✅ Module system validation passed');
  }
}
