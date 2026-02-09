/**
 * @module planning/utils/retry-handler
 * Error handling and retry logic for planning system
 */

import { LLMProvider } from '../interfaces';

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export class RetryHandler {
  private static defaultConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'rate_limit_exceeded',
      'insufficient_quota'
    ]
  };
  
  /**
   * Retry a function with exponential backoff
   */
  static async retry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const cfg = { ...this.defaultConfig, ...config };
    let lastError: Error | undefined;
    let delay = cfg.initialDelay;
    
    for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${cfg.maxAttempts}...`);
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (!this.isRetryable(lastError, cfg.retryableErrors)) {
          throw lastError;
        }
        
        if (attempt === cfg.maxAttempts) {
          console.error(`Failed after ${cfg.maxAttempts} attempts`);
          throw lastError;
        }
        
        console.warn(`Attempt ${attempt} failed: ${lastError.message}`);
        console.log(`Retrying in ${delay}ms...`);
        
        await this.sleep(delay);
        delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelay);
      }
    }
    
    throw lastError || new Error('Retry failed');
  }
  
  /**
   * Check if an error is retryable
   */
  private static isRetryable(error: Error, retryableErrors?: string[]): boolean {
    if (!retryableErrors || retryableErrors.length === 0) return true;
    
    return retryableErrors.some(pattern => 
      error.message.includes(pattern) || 
      error.name === pattern
    );
  }
  
  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Wrapper for LLM provider with retry logic
 */
export class RetryableLLMProvider implements LLMProvider {
  constructor(
    private provider: LLMProvider,
    private retryConfig: Partial<RetryConfig> = {}
  ) {}
  
  async generate(prompt: string): Promise<string> {
    return RetryHandler.retry(
      () => this.provider.generate(prompt),
      this.retryConfig
    );
  }
  
  async generateStructured<T>(config: {
    prompt: string;
    schema: any;
  }): Promise<T> {
    return RetryHandler.retry(
      () => this.provider.generateStructured<T>(config),
      this.retryConfig
    );
  }
}

/**
 * Circuit breaker for preventing cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private resetTimeout: number = 30000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
        console.log('Circuit breaker: Attempting recovery (half-open)');
      } else {
        throw new Error('Circuit breaker is open - service unavailable');
      }
    }
    
    try {
      const result = await fn();
      
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
        console.log('Circuit breaker: Recovery successful (closed)');
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
      console.error(`Circuit breaker opened after ${this.failures} failures`);
      
      // Auto-reset after timeout
      setTimeout(() => {
        this.state = 'half-open';
        console.log('Circuit breaker: Auto-reset to half-open');
      }, this.resetTimeout);
    }
  }
  
  getState(): string {
    return this.state;
  }
  
  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    console.log('Circuit breaker: Manual reset');
  }
}

/**
 * Error classification and handling
 */
export class PlanningErrorHandler {
  static classifyError(error: Error): {
    type: 'transient' | 'permanent' | 'unknown';
    category: string;
    suggestion: string;
  } {
    const errorString = error.message.toLowerCase();
    
    // Transient errors (can be retried)
    if (errorString.includes('timeout') || errorString.includes('etimedout')) {
      return {
        type: 'transient',
        category: 'timeout',
        suggestion: 'Increase timeout or retry later'
      };
    }
    
    if (errorString.includes('rate_limit') || errorString.includes('too many requests')) {
      return {
        type: 'transient',
        category: 'rate_limit',
        suggestion: 'Wait before retrying or reduce request frequency'
      };
    }
    
    if (errorString.includes('connection') || errorString.includes('econnrefused')) {
      return {
        type: 'transient',
        category: 'connection',
        suggestion: 'Check network connectivity and retry'
      };
    }
    
    // Permanent errors (should not retry)
    if (errorString.includes('invalid api key') || errorString.includes('authentication')) {
      return {
        type: 'permanent',
        category: 'authentication',
        suggestion: 'Check API key configuration'
      };
    }
    
    if (errorString.includes('invalid request') || errorString.includes('bad request')) {
      return {
        type: 'permanent',
        category: 'validation',
        suggestion: 'Review request parameters'
      };
    }
    
    if (errorString.includes('insufficient') || errorString.includes('quota exceeded')) {
      return {
        type: 'permanent',
        category: 'quota',
        suggestion: 'Upgrade plan or wait for quota reset'
      };
    }
    
    // Unknown errors
    return {
      type: 'unknown',
      category: 'unknown',
      suggestion: 'Check logs for more details'
    };
  }
  
  static async handleError(error: Error, context: string): Promise<void> {
    const classification = this.classifyError(error);
    
    console.error(`[${context}] Error occurred:`, {
      message: error.message,
      type: classification.type,
      category: classification.category,
      suggestion: classification.suggestion,
      stack: error.stack
    });
    
    // Log to monitoring service
    if (process.env.MONITORING_ENABLED === 'true') {
      await this.logToMonitoring(error, context, classification);
    }
    
    // Send alert for critical errors
    if (classification.type === 'permanent') {
      await this.sendAlert(error, context, classification);
    }
  }
  
  private static async logToMonitoring(
    error: Error,
    context: string,
    classification: any
  ): Promise<void> {
    // Implementation would send to your monitoring service
    console.log('Would log to monitoring:', { error, context, classification });
  }
  
  private static async sendAlert(
    error: Error,
    context: string,
    classification: any
  ): Promise<void> {
    // Implementation would send alerts (email, Slack, etc.)
    console.log('Would send alert:', { error, context, classification });
  }
}
