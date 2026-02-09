export class RequestThrottler {
    options;
    constructor(options) {
        this.options = {
            maxConcurrent: options?.maxConcurrent || 5,
            delayBetweenBatches: options?.delayBetweenBatches || 200,
            maxRetries: options?.maxRetries || 3,
            initialRetryDelay: options?.initialRetryDelay || 1000,
        };
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async executeWithRetry(fn, retryCount = 0) {
        try {
            return await fn();
        }
        catch (error) {
            const is429 = error?.status === 429 ||
                error?.message?.includes('429') ||
                error?.message?.includes('Too Many Requests');
            if (is429 && retryCount < this.options.maxRetries) {
                const delayMs = this.options.initialRetryDelay * Math.pow(2, retryCount);
                console.log(`Rate limit hit, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${this.options.maxRetries})`);
                await this.delay(delayMs);
                return this.executeWithRetry(fn, retryCount + 1);
            }
            throw error;
        }
    }
    async throttleAll(tasks, fallbackFactory) {
        const results = [];
        for (let i = 0; i < tasks.length; i += this.options.maxConcurrent) {
            const batch = tasks.slice(i, i + this.options.maxConcurrent);
            const batchStartIndex = i;
            const batchResults = await Promise.all(batch.map(async (task, batchIndex) => {
                try {
                    return await this.executeWithRetry(task);
                }
                catch (error) {
                    console.error('Task failed after retries:', error.message);
                    if (fallbackFactory) {
                        const taskIndex = batchStartIndex + batchIndex;
                        return fallbackFactory(taskIndex);
                    }
                    throw error;
                }
            }));
            results.push(...batchResults);
            if (i + this.options.maxConcurrent < tasks.length) {
                await this.delay(this.options.delayBetweenBatches);
            }
        }
        return results;
    }
}
//# sourceMappingURL=request-throttler.js.map