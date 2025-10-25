/**
 * @module planning/llm/openai
 * OpenAI LLM provider implementation
 */

import OpenAI from 'openai';
import { LLMProvider } from './interfaces';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;
  
  constructor(config: { apiKey: string; model?: string }) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || 'gpt-4-turbo-preview';
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
        temperature: 0.3,
        max_tokens: 4000
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
    console.log('[LLM Provider] Starting STRUCTURED OpenAI call...');
    console.log('[LLM Provider] Using API key:', process.env.OPENAI_API_KEY ? 'Found ✓' : 'MISSING! ✗');
    console.log('[LLM Provider] Model:', this.model);
    
    console.time('ACTUAL_OPENAI_STRUCTURED_CALL');
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
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: 4000
      });
      
      console.timeEnd('ACTUAL_OPENAI_STRUCTURED_CALL');
      console.log('[LLM Provider] Success - structured response received');
      
      const content = response.choices[0].message.content;
      if (!content) throw new Error('Empty response from LLM');
      
      return JSON.parse(content) as T;
    } catch (error: any) {
      console.timeEnd('ACTUAL_OPENAI_STRUCTURED_CALL');
      console.error('[LLM Provider] OpenAI structured generation error:', error.message);
      throw new Error(`Structured generation failed: ${error.message}`);
    }
  }
}

export function createOpenAIProvider(config: {
  apiKey: string;
  model?: string;
}): LLMProvider {
  return new OpenAIProvider(config);
}
