/**
 * Module Registry
 * Central registry for modules and journeys, enabling config-based journey composition
 */

import { ModuleManifest, validateManifest } from './manifest';
import { JourneyConfig, validateJourneyConfig } from './journey-config';

export class ModuleRegistry {
  private modules = new Map<string, ModuleManifest>();
  private journeys = new Map<string, JourneyConfig>();
  
  registerModule(manifest: ModuleManifest): { success: boolean; errors: string[] } {
    const validation = validateManifest(manifest);
    if (!validation.valid) {
      console.warn(`[ModuleRegistry] Failed to register module: ${validation.errors.join(', ')}`);
      return { success: false, errors: validation.errors };
    }
    
    if (this.modules.has(manifest.id)) {
      console.warn(`[ModuleRegistry] Overwriting existing module: ${manifest.id}`);
    }
    
    this.modules.set(manifest.id, manifest);
    console.log(`[ModuleRegistry] Registered module: ${manifest.id} (${manifest.type})`);
    return { success: true, errors: [] };
  }
  
  loadJourney(config: JourneyConfig): { success: boolean; errors: string[]; warnings: string[] } {
    const registeredModuleIds = Array.from(this.modules.keys());
    const validation = validateJourneyConfig(config, registeredModuleIds);
    
    if (!validation.valid) {
      console.warn(`[ModuleRegistry] Failed to load journey: ${validation.errors.join(', ')}`);
      return { success: false, errors: validation.errors, warnings: validation.warnings };
    }
    
    if (validation.warnings.length > 0) {
      console.warn(`[ModuleRegistry] Journey warnings for ${config.id}: ${validation.warnings.join(', ')}`);
    }
    
    if (this.journeys.has(config.id)) {
      console.warn(`[ModuleRegistry] Overwriting existing journey: ${config.id}`);
    }
    
    this.journeys.set(config.id, config);
    console.log(`[ModuleRegistry] Loaded journey: ${config.id} with ${config.modules.length} modules`);
    return { success: true, errors: [], warnings: validation.warnings };
  }
  
  getModule(id: string): ModuleManifest | undefined {
    return this.modules.get(id);
  }
  
  listModules(): ModuleManifest[] {
    return Array.from(this.modules.values());
  }
  
  listModulesByType(type: ModuleManifest['type']): ModuleManifest[] {
    return Array.from(this.modules.values()).filter(m => m.type === type);
  }
  
  getJourney(id: string): JourneyConfig | undefined {
    return this.journeys.get(id);
  }
  
  listJourneys(): JourneyConfig[] {
    return Array.from(this.journeys.values());
  }
  
  listAvailableJourneys(): JourneyConfig[] {
    return Array.from(this.journeys.values()).filter(j => j.available);
  }
  
  hasModule(id: string): boolean {
    return this.modules.has(id);
  }
  
  hasJourney(id: string): boolean {
    return this.journeys.has(id);
  }
  
  getStats(): { moduleCount: number; journeyCount: number; availableJourneys: number } {
    return {
      moduleCount: this.modules.size,
      journeyCount: this.journeys.size,
      availableJourneys: this.listAvailableJourneys().length,
    };
  }
  
  clear(): void {
    this.modules.clear();
    this.journeys.clear();
    console.log('[ModuleRegistry] Registry cleared');
  }
}

export const moduleRegistry = new ModuleRegistry();
