import { frameworkRegistry } from './framework-executor-registry';
import { FiveWhysExecutor } from './executors/five-whys-executor';
import { BMCExecutor } from './executors/bmc-executor';
/**
 * Register all framework executors
 * Call this at application startup to initialize the framework plugin system
 */
export function registerFrameworkExecutors() {
    console.log('[Framework Registration] Initializing framework executor registry...');
    // Register implemented frameworks
    frameworkRegistry.register(new FiveWhysExecutor());
    frameworkRegistry.register(new BMCExecutor());
    // Future frameworks can be registered here:
    // frameworkRegistry.register(new PortersExecutor());
    // frameworkRegistry.register(new PESTLEExecutor());
    // frameworkRegistry.register(new SWOTExecutor());
    const registered = frameworkRegistry.getRegisteredFrameworks();
    console.log(`[Framework Registration] ✓ Registered ${registered.length} framework executor(s): ${registered.join(', ')}`);
}
//# sourceMappingURL=register-frameworks.js.map