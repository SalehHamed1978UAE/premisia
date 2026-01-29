import { frameworkRegistry } from './framework-executor-registry';
import { FiveWhysExecutor } from './executors/five-whys-executor';
import { BMCExecutor } from './executors/bmc-executor';
import { SegmentDiscoveryExecutor } from './executors/segment-discovery-executor';
import { PortersExecutor } from './executors/porters-executor';
import { PESTLEExecutor } from './executors/pestle-executor';
import { SWOTExecutor } from './executors/swot-executor';
import { CompetitivePositioningExecutor } from './executors/competitive-positioning-executor';
import { AnsoffExecutor } from './executors/ansoff-executor';
import { BlueOceanExecutor } from './executors/blue-ocean-executor';
import { BCGMatrixExecutor } from './executors/bcg-matrix-executor';
import { ValueChainExecutor } from './executors/value-chain-executor';
import { VRIOExecutor } from './executors/vrio-executor';
import { ScenarioPlanningExecutor } from './executors/scenario-planning-executor';
import { JTBDExecutor } from './executors/jtbd-executor';
import { OKRGeneratorExecutor } from './executors/okr-generator-executor';
import { OceanStrategyExecutor } from './executors/ocean-strategy-executor';
import { getAvailableJourneys } from './journey-registry';

/**
 * Register all framework executors
 * Call this at application startup to initialize the framework plugin system
 * 
 * Framework Status (as of Phase 9.6):
 * - IMPLEMENTED: All 16 frameworks now have real AI-powered executors
 * - No stubs remaining
 */
export function registerFrameworkExecutors(): void {
  console.log('[Framework Registration] Initializing framework executor registry...');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE FRAMEWORKS (fully implemented)
  // ═══════════════════════════════════════════════════════════════════════════
  frameworkRegistry.register(new FiveWhysExecutor());
  frameworkRegistry.register(new BMCExecutor());
  frameworkRegistry.register(new SegmentDiscoveryExecutor());
  
  // ═══════════════════════════════════════════════════════════════════════════
  // COMPETITIVE & MARKET ANALYSIS (implemented)
  // ═══════════════════════════════════════════════════════════════════════════
  frameworkRegistry.register(new PortersExecutor());
  frameworkRegistry.register(new PESTLEExecutor());
  frameworkRegistry.register(new SWOTExecutor());
  frameworkRegistry.register(new CompetitivePositioningExecutor());
  
  // ═══════════════════════════════════════════════════════════════════════════
  // GROWTH & INNOVATION STRATEGY (implemented)
  // ═══════════════════════════════════════════════════════════════════════════
  frameworkRegistry.register(new AnsoffExecutor());
  frameworkRegistry.register(new BlueOceanExecutor());
  frameworkRegistry.register(new OceanStrategyExecutor());
  frameworkRegistry.register(new BCGMatrixExecutor());
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL ANALYSIS (implemented)
  // ═══════════════════════════════════════════════════════════════════════════
  frameworkRegistry.register(new ValueChainExecutor());
  frameworkRegistry.register(new VRIOExecutor());
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FUTURE PLANNING (implemented)
  // ═══════════════════════════════════════════════════════════════════════════
  frameworkRegistry.register(new ScenarioPlanningExecutor());
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER & PRODUCT (implemented)
  // ═══════════════════════════════════════════════════════════════════════════
  frameworkRegistry.register(new JTBDExecutor());
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTION (implemented)
  // ═══════════════════════════════════════════════════════════════════════════
  frameworkRegistry.register(new OKRGeneratorExecutor());
  
  const registered = frameworkRegistry.getRegisteredFrameworks();
  
  console.log(`[Framework Registration] ✓ Registered ${registered.length} framework executor(s):`);
  console.log(`  All implemented: ${registered.join(', ')}`);
  
  // Validate journey integrity - ensure all available journeys have registered executors
  validateJourneyIntegrity();
}

/**
 * Validate that all available journeys have their required framework executors registered.
 * This prevents shipping broken journeys that would fail at runtime.
 * Should be called after registerFrameworkExecutors() during server startup.
 */
export function validateJourneyIntegrity(): void {
  console.log('[Journey Validation] Checking journey executor integrity...');
  
  const availableJourneys = getAvailableJourneys();
  const registeredFrameworks = new Set(frameworkRegistry.getRegisteredFrameworks());
  const errors: string[] = [];
  
  for (const journey of availableJourneys) {
    for (const framework of journey.frameworks) {
      if (!registeredFrameworks.has(framework)) {
        errors.push(
          `Journey "${journey.name}" (${journey.type}) requires framework "${framework}" but no executor is registered. ` +
          `Either register the executor or set available: false in journey-registry.ts`
        );
      }
    }
  }
  
  if (errors.length > 0) {
    console.error('[Journey Validation] ❌ STARTUP ERROR: Journey integrity check failed!');
    errors.forEach(err => console.error(`  - ${err}`));
    throw new Error(
      `STARTUP ERROR: ${errors.length} journey(s) have missing framework executors. ` +
      `See logs above for details.`
    );
  }
  
  console.log(`[Journey Validation] ✓ All ${availableJourneys.length} available journey(s) have registered executors`);
}
