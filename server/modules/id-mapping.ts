/**
 * Framework Key to Module ID Mapping
 *
 * Registry uses keys like 'swot', manifests use IDs like 'swot-analyzer'.
 * This file is the single source of truth for this mapping.
 *
 * Design Notes:
 * - Some frameworks have aliases (e.g., 'bmc' and 'business_model_canvas' both map to 'bmc-analyzer')
 * - The reverse mapping (MODULE_ID_TO_FRAMEWORK_KEY) uses the LAST key for aliased modules
 * - This is acceptable since we only need one canonical key per module ID for reverse lookups
 * - When adding new aliases, place the canonical/preferred key AFTER aliases in the list
 */

export const FRAMEWORK_KEY_TO_MODULE_ID: Record<string, string> = {
  // User Input Modules
  'strategic_understanding': 'strategic-understanding',
  'strategic_decisions': 'strategic-decisions',
  'input_processor': 'input-processor',

  // AI Analyzer Modules
  'swot': 'swot-analyzer',
  'business_model_canvas': 'bmc-analyzer',
  'bmc': 'bmc-analyzer',
  'porters_five_forces': 'porters-analyzer',
  'porters': 'porters-analyzer',
  'pestle': 'pestle-analyzer',
  'five_whys': 'five-whys-analyzer',
  'ansoff': 'ansoff-analyzer',
  'blue_ocean': 'blue-ocean-analyzer',
  'ocean_strategy': 'ocean-strategy-analyzer',
  'bcg_matrix': 'bcg-matrix-analyzer',
  'value_chain': 'value-chain-analyzer',
  'vrio': 'vrio-analyzer',
  'scenario_planning': 'scenario-planning-analyzer',
  'jobs_to_be_done': 'jobs-to-be-done-analyzer',
  'competitive_positioning': 'competitive-positioning-analyzer',
  'segment_discovery': 'segment-discovery-analyzer',

  // Generator Modules
  'epm': 'epm-generator',
  'okr': 'okr-generator',
};

export const MODULE_ID_TO_FRAMEWORK_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(FRAMEWORK_KEY_TO_MODULE_ID).map(([k, v]) => [v, k])
);

export function getModuleId(frameworkKey: string): string {
  return FRAMEWORK_KEY_TO_MODULE_ID[frameworkKey] || frameworkKey;
}

export function getFrameworkKey(moduleId: string): string {
  return MODULE_ID_TO_FRAMEWORK_KEY[moduleId] || moduleId;
}
