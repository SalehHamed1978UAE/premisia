/**
 * Framework Executor Registry
 * Plugin system for registering and executing strategic analysis frameworks
 */
class FrameworkExecutorRegistry {
    executors = new Map();
    /**
     * Register a framework executor
     */
    register(executor) {
        if (this.executors.has(executor.name)) {
            console.warn(`[FrameworkRegistry] Overwriting existing executor for ${executor.name}`);
        }
        this.executors.set(executor.name, executor);
        console.log(`[FrameworkRegistry] ✓ Registered executor: ${executor.name}`);
    }
    /**
     * Execute a framework by name
     */
    async execute(frameworkName, context) {
        const startTime = Date.now();
        try {
            const executor = this.executors.get(frameworkName);
            if (!executor) {
                throw new Error(`No executor registered for framework: ${frameworkName}`);
            }
            // Optional validation
            if (executor.validate) {
                const validation = await executor.validate(context);
                if (!validation.valid) {
                    throw new Error(`Framework validation failed: ${validation.errors?.join(', ')}`);
                }
            }
            // Execute framework
            console.log(`[FrameworkRegistry] Executing ${frameworkName}...`);
            const data = await executor.execute(context);
            console.log(`[FrameworkRegistry] ✓ ${frameworkName} completed`);
            return {
                frameworkName,
                executedAt: new Date(),
                duration: Date.now() - startTime,
                data,
            };
        }
        catch (error) {
            console.error(`[FrameworkRegistry] ❌ ${frameworkName} failed:`, error);
            return {
                frameworkName,
                executedAt: new Date(),
                duration: Date.now() - startTime,
                data: {},
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            };
        }
    }
    /**
     * Check if a framework executor is registered
     */
    has(frameworkName) {
        return this.executors.has(frameworkName);
    }
    /**
     * Get all registered framework names
     */
    getRegisteredFrameworks() {
        return Array.from(this.executors.keys());
    }
}
// Export singleton registry
export const frameworkRegistry = new FrameworkExecutorRegistry();
//# sourceMappingURL=framework-executor-registry.js.map