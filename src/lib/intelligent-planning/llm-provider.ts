/**
 * @module planning/llm/openai
 * OpenAI LLM provider implementation
 */

import OpenAI from 'openai';
import { LLMProvider } from './interfaces';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;
  private maxRetries: number;
  
  constructor(config: { apiKey: string; model?: string; maxRetries?: number }) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || 'gpt-4-turbo-preview';
    this.maxRetries = config.maxRetries ?? 3;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async generate(prompt: string): Promise<string> {
    console.log('[LLM Provider] Starting OpenAI call...');
    console.log('[LLM Provider] Using API key:', process.env.OPENAI_API_KEY ? 'Found ✓' : 'MISSING! ✗');
    console.log('[LLM Provider] Model:', this.model);
    
    console.time('ACTUAL_OPENAI_CALL');
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        // GPT-5 only supports default temperature (1.0), custom values not allowed
        max_completion_tokens: 4000  // GPT-5 requires max_completion_tokens instead of max_tokens
      });
      
      console.timeEnd('ACTUAL_OPENAI_CALL');
      console.log('[LLM Provider] Success - response received');
      
      return response.choices[0].message.content || '';
    } catch (error: any) {
      console.timeEnd('ACTUAL_OPENAI_CALL');
      console.error('[LLM Provider] OpenAI API error:', error.message);
      throw new Error(`LLM generation failed: ${error.message}`);
    }
  }
  
  async generateStructured<T>(config: {
    prompt: string;
    schema: any;
  }): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`[LLM Provider] Starting STRUCTURED OpenAI call (attempt ${attempt}/${this.maxRetries})...`);
      console.log('[LLM Provider] Using API key:', process.env.OPENAI_API_KEY ? 'Found ✓' : 'MISSING! ✗');
      console.log('[LLM Provider] Model:', this.model);
      
      const startTime = Date.now();
      let response: OpenAI.Chat.Completions.ChatCompletion | null = null;
      let content: string | null = null;
      let shouldRetry = false;
      
      try {
        response = await this.client.chat.completions.create({
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
          // GPT-5 only supports default temperature (1.0), custom values not allowed
          response_format: { type: 'json_object' },
          max_completion_tokens: 4000  // GPT-5 requires max_completion_tokens instead of max_tokens
        });
        
        content = response.choices[0].message.content;
      } catch (apiError: any) {
        // API call itself failed - don't retry, fail immediately
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`[LLM Provider] OpenAI API error after ${elapsed}s: ${apiError.message}`);
        throw new Error(`Structured generation failed: ${apiError.message}`);
      }
      
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
      
      // Handle retry with exponential backoff
      if (shouldRetry && attempt < this.maxRetries) {
        const backoffMs = 1000 * attempt;
        console.log(`[LLM Provider] Retrying in ${backoffMs}ms...`);
        await this.delay(backoffMs);
        continue;
      }
      
      // Final attempt or no more retries
      if (shouldRetry) {
        throw new Error(`Structured generation failed after ${this.maxRetries} retries: ${lastError?.message}`);
      }
    }
    
    // Should not reach here, but safety net
    throw new Error(`Structured generation failed after ${this.maxRetries} retries: ${lastError?.message || 'Unknown error'}`);
  }
}

export function createOpenAIProvider(config: {
  apiKey: string;
  model?: string;
  maxRetries?: number;
}): LLMProvider {
  return new OpenAIProvider(config);
}
