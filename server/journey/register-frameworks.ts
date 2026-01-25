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
import { createStubExecutor } from './executors/stub-executor-template';

/**
 * Register all framework executors
 * Call this at application startup to initialize the framework plugin system
 * 
 * Framework Status (as of Phase 9.5):
 * - IMPLEMENTED: All 16 frameworks now have real AI-powered executors
 * - STUB: ocean_strategy only (rarely used variant of Blue Ocean)
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
  frameworkRegistry.register(createStubExecutor('ocean_strategy', 'Ocean Strategy Mapping'));
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
  const implemented = [
    'five_whys', 'bmc', 'segment_discovery', 
    'porters', 'pestle', 'swot', 'competitive_positioning',
    'ansoff', 'blue_ocean', 'bcg_matrix',
    'value_chain', 'vrio',
    'scenario_planning',
    'jobs_to_be_done',
    'okr_generator'
  ];
  const stubs = registered.filter(f => !implemented.includes(f));
  
  console.log(`[Framework Registration] ✓ Registered ${registered.length} framework executor(s):`);
  console.log(`  Implemented (${implemented.length}): ${implemented.join(', ')}`);
  if (stubs.length > 0) {
    console.log(`  Stubs (${stubs.length}): ${stubs.join(', ')}`);
  }
}
