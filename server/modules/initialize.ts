/**
 * Module System Initialization
 * Registers all modules and loads journey configs at startup
 */

import { moduleRegistry } from './registry';
import { allManifests } from './manifests';
import { loadJourneyConfigs } from './journey-loader';

let initialized = false;

export function initializeModuleSystem(): void {
  if (initialized) {
    console.log('[ModuleSystem] Already initialized, skipping');
    return;
  }
  
  console.log('[ModuleSystem] Initializing module catalog and journey config system...');
  
  for (const manifest of allManifests) {
    const result = moduleRegistry.registerModule(manifest);
    if (!result.success) {
      console.error(`[ModuleSystem] Failed to register ${manifest.id}: ${result.errors.join(', ')}`);
    }
  }
  
  const journeyConfigs = loadJourneyConfigs();
  for (const config of journeyConfigs) {
    const result = moduleRegistry.loadJourney(config);
    if (!result.success) {
      console.error(`[ModuleSystem] Failed to load journey ${config.id}: ${result.errors.join(', ')}`);
    }
  }
  
  const stats = moduleRegistry.getStats();
  console.log(`[ModuleSystem] ✓ Initialization complete: Registered ${stats.moduleCount} modules, loaded ${stats.journeyCount} journeys`);
  
  initialized = true;
}

export function isModuleSystemInitialized(): boolean {
  return initialized;
}
