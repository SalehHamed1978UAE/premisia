import { frameworkRegistry } from './framework-executor-registry';
import { FiveWhysExecutor } from './executors/five-whys-executor';
import { BMCExecutor } from './executors/bmc-executor';
import { SegmentDiscoveryExecutor } from './executors/segment-discovery-executor';
import { createStubExecutor } from './executors/stub-executor-template';

/**
 * Register all framework executors
 * Call this at application startup to initialize the framework plugin system
 * 
 * Framework Status:
 * - IMPLEMENTED: five_whys, bmc, segment_discovery
 * - STUB: All others (throw "not yet implemented" on execute)
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
  // COMPETITIVE & MARKET ANALYSIS (stubs)
  // ═══════════════════════════════════════════════════════════════════════════
  frameworkRegistry.register(createStubExecutor('porters', "Porter's Five Forces"));
  frameworkRegistry.register(createStubExecutor('pestle', 'PESTLE Analysis'));
  frameworkRegistry.register(createStubExecutor('swot', 'SWOT Analysis'));
  frameworkRegistry.register(createStubExecutor('competitive_positioning', 'Competitive Positioning'));
  
  // ═══════════════════════════════════════════════════════════════════════════
  // GROWTH & INNOVATION STRATEGY (stubs)
  // ═══════════════════════════════════════════════════════════════════════════
  frameworkRegistry.register(createStubExecutor('ansoff', 'Ansoff Matrix'));
  frameworkRegistry.register(createStubExecutor('blue_ocean', 'Blue Ocean Strategy'));
  frameworkRegistry.register(createStubExecutor('ocean_strategy', 'Ocean Strategy Mapping'));
  frameworkRegistry.register(createStubExecutor('bcg_matrix', 'BCG Matrix'));
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL ANALYSIS (stubs)
  // ═══════════════════════════════════════════════════════════════════════════
  frameworkRegistry.register(createStubExecutor('value_chain', 'Value Chain Analysis'));
  frameworkRegistry.register(createStubExecutor('vrio', 'VRIO Analysis'));
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FUTURE PLANNING (stubs)
  // ═══════════════════════════════════════════════════════════════════════════
  frameworkRegistry.register(createStubExecutor('scenario_planning', 'Scenario Planning'));
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOMER & PRODUCT (stubs)
  // ═══════════════════════════════════════════════════════════════════════════
  frameworkRegistry.register(createStubExecutor('jobs_to_be_done', 'Jobs To Be Done'));
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTION (stubs)
  // ═══════════════════════════════════════════════════════════════════════════
  frameworkRegistry.register(createStubExecutor('okr_generator', 'OKR Generator'));
  
  const registered = frameworkRegistry.getRegisteredFrameworks();
  console.log(`[Framework Registration] ✓ Registered ${registered.length} framework executor(s):`);
  console.log(`  Core (implemented): five_whys, bmc, segment_discovery`);
  console.log(`  Stubs: ${registered.filter(f => !['five_whys', 'bmc', 'segment_discovery'].includes(f)).join(', ')}`);
}
