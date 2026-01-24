/**
 * @module planning/llm/openai
 * OpenAI LLM provider implementation with reliability improvements
 */

import OpenAI from 'openai';
import { LLMProvider } from './interfaces';

/**
 * Model selection by task complexity
 * Use cheaper/faster models for deterministic tasks, expensive models for heavy reasoning
 */
export const MODEL_CONFIG = {
  workstreamGeneration: 'gpt-5',           // Heavy reasoning - keep expensive model
  dependencyLinkage: 'gpt-4o-mini',        // Deterministic - use fast/cheap model
  riskAssessment: 'gpt-4-turbo',           // Medium complexity
  fallback: 'gpt-4-turbo-preview',         // Last resort
  default: 'gpt-4-turbo-preview',          // Standard operations
} as const;

/**
 * Default timeout for LLM calls (30 seconds)
 * This prevents burning 70-85s on hung calls
 */
export const DEFAULT_LLM_TIMEOUT_MS = 30000;

/**
 * Maximum total time for retry attempts (prevents 4+ minute burns)
 */
export const MAX_TOTAL_RETRY_MS = 45000;

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;
  private maxRetries: number;
  private timeoutMs: number;
  
  constructor(config: { apiKey: string; model?: string; maxRetries?: number; timeoutMs?: number }) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || 'gpt-4-turbo-preview';
    this.maxRetries = config.maxRetries ?? 3;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a provider with a specific model for targeted tasks
   */
  withModel(model: string): OpenAIProvider {
    return new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY || '',
      model,
      maxRetries: this.maxRetries,
      timeoutMs: this.timeoutMs
    });
  }

  /**
   * Create a provider with a specific timeout
   */
  withTimeout(timeoutMs: number): OpenAIProvider {
    return new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY || '',
      model: this.model,
      maxRetries: this.maxRetries,
      timeoutMs
    });
  }
  
  async generate(prompt: string): Promise<string> {
    console.log('[LLM Provider] Starting OpenAI call...');
    console.log('[LLM Provider] Using API key:', process.env.OPENAI_API_KEY ? 'Found ✓' : 'MISSING! ✗');
    console.log('[LLM Provider] Model:', this.model);
    console.log('[LLM Provider] Timeout:', `${this.timeoutMs}ms`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[LLM Provider] Aborting call after ${this.timeoutMs}ms timeout`);
      controller.abort();
    }, this.timeoutMs);
    
    const startTime = Date.now();
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 4000
      }, { signal: controller.signal });
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[LLM Provider] Success - response received in ${elapsed}s`);
      
      return response.choices[0].message.content || '';
    } catch (error: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        console.error(`[LLM Provider] Request timed out after ${elapsed}s`);
        throw new Error(`LLM request timed out after ${this.timeoutMs}ms`);
      }
      console.error(`[LLM Provider] OpenAI API error after ${elapsed}s:`, error.message);
      throw new Error(`LLM generation failed: ${error.message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  async generateStructured<T>(config: {
    prompt: string;
    schema: any;
  }): Promise<T> {
    let lastError: Error | null = null;
    const totalStartTime = Date.now();
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      // Check total time budget to prevent 4+ minute burns
      const totalElapsed = Date.now() - totalStartTime;
      if (totalElapsed > MAX_TOTAL_RETRY_MS) {
        console.warn(`[LLM Provider] Total retry time exceeded ${MAX_TOTAL_RETRY_MS}ms, giving up`);
        throw new Error(`Structured generation failed: total time budget exceeded (${(totalElapsed / 1000).toFixed(1)}s)`);
      }
      
      console.log(`[LLM Provider] Starting STRUCTURED OpenAI call (attempt ${attempt}/${this.maxRetries})...`);
      console.log('[LLM Provider] Using API key:', process.env.OPENAI_API_KEY ? 'Found ✓' : 'MISSING! ✗');
      console.log('[LLM Provider] Model:', this.model);
      console.log('[LLM Provider] Timeout:', `${this.timeoutMs}ms`);
      
      const startTime = Date.now();
      let content: string | null = null;
      let shouldRetry = false;
      
      // Set up abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(`[LLM Provider] Aborting structured call after ${this.timeoutMs}ms timeout`);
        controller.abort();
      }, this.timeoutMs);
      
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a project planning expert. Always return valid JSON matching the provided schema.'
            },
            {
              role: 'user',
              content: `${config.prompt}\n\nReturn as JSON matching this schema:\n${JSON.stringify(config.schema, null, 2)}`
            }
          ],
          response_format: { type: 'json_object' },
          max_completion_tokens: 4000
        }, { signal: controller.signal });
        
        content = response.choices[0].message.content;
      } catch (apiError: any) {
        clearTimeout(timeoutId);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        
        // Handle timeout separately - this is retriable
        if (apiError.name === 'AbortError' || apiError.message?.includes('aborted')) {
          lastError = new Error(`Request timed out after ${this.timeoutMs}ms`);
          shouldRetry = true;
          console.warn(`[LLM Provider] Timeout on attempt ${attempt}/${this.maxRetries} after ${elapsed}s`);
        } else {
          // Other API errors - might be transient, allow retry
          lastError = new Error(`API error: ${apiError.message}`);
          shouldRetry = true;
          console.warn(`[LLM Provider] API error on attempt ${attempt}/${this.maxRetries}: ${apiError.message}`);
        }
      } finally {
        clearTimeout(timeoutId);
      }
      
      if (!shouldRetry) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[LLM Provider] API call completed in ${elapsed}s`);
        
        // Check for empty/invalid content - this is retriable
        if (!content || content.trim().length === 0) {
          lastError = new Error('Empty response from LLM');
          shouldRetry = true;
          console.warn(`[LLM Provider] Empty response on attempt ${attempt}/${this.maxRetries}`);
        } else {
          // Try to parse JSON - invalid JSON is also retriable (transient LLM issue)
          try {
            const parsed = JSON.parse(content) as T;
            console.log('[LLM Provider] Success - structured response received');
            return parsed;
          } catch (parseError: any) {
            lastError = new Error(`Invalid JSON response: ${parseError.message}`);
            shouldRetry = true;
            console.warn(`[LLM Provider] JSON parse failed on attempt ${attempt}/${this.maxRetries}: ${parseError.message}`);
          }
        }
      }
      
      // Handle retry with exponential backoff (2s, 4s, 8s cap)
      if (shouldRetry && attempt < this.maxRetries) {
        const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 8000);
        console.log(`[LLM Provider] Retrying in ${backoffMs}ms...`);
        await this.delay(backoffMs);
        continue;
      }
      
      // Final attempt or no more retries
      if (shouldRetry) {
        const totalTime = ((Date.now() - totalStartTime) / 1000).toFixed(1);
        throw new Error(`Structured generation failed after ${attempt} attempts (${totalTime}s total): ${lastError?.message}`);
      }
    }
    
    // Should not reach here, but safety net
    const totalTime = ((Date.now() - totalStartTime) / 1000).toFixed(1);
    throw new Error(`Structured generation failed after ${this.maxRetries} retries (${totalTime}s total): ${lastError?.message || 'Unknown error'}`);
  }
}

export function createOpenAIProvider(config: {
  apiKey: string;
  model?: string;
  maxRetries?: number;
}): LLMProvider {
  return new OpenAIProvider(config);
}
