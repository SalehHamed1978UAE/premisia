/**
 * @module planning/llm/openai
 * OpenAI LLM provider implementation
 */

import OpenAI from 'openai';

export interface LLMProvider {
  generate(prompt: string): Promise<string>;
  generateStructured<T>(config: {
    prompt: string;
    schema: any;
  }): Promise<T>;
}

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  
  constructor(config: { apiKey: string; model?: string }) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || 'gpt-4-turbo-preview';
  }
  
  async generate(prompt: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4000
      });
      
      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`LLM generation failed: ${error.message}`);
    }
  }
  
  async generateStructured<T>(config: {
    prompt: string;
    schema: any;
  }): Promise<T> {
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
      
      const content = response.choices[0].message.content;
      if (!content) throw new Error('Empty response from LLM');
      
      return JSON.parse(content) as T;
    } catch (error) {
      console.error('OpenAI structured generation error:', error);
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
