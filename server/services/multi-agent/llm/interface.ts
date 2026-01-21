import { z } from 'zod';
import { aiClients } from '../../../ai-clients';

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  schema?: z.ZodSchema;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse<T = any> {
  content: T;
  tokensUsed: number;
  model: string;
  durationMs: number;
}

export class LLMInterface {
  private defaultMaxTokens = 4096;

  async generateStructured<T>(request: LLMRequest): Promise<LLMResponse<T>> {
    const startTime = Date.now();
    
    const schemaInstructions = request.schema 
      ? this.buildSchemaInstructions(request.schema)
      : '';
    
    const fullUserPrompt = schemaInstructions 
      ? `${request.userPrompt}\n\n${schemaInstructions}`
      : request.userPrompt;

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: request.systemPrompt,
        userMessage: fullUserPrompt,
        maxTokens: request.maxTokens || this.defaultMaxTokens,
      });

      const durationMs = Date.now() - startTime;
      const parsed = this.parseStructuredOutput<T>(response.content, request.schema);

      return {
        content: parsed,
        tokensUsed: this.estimateTokens(request.systemPrompt, fullUserPrompt, response.content),
        model: response.model || 'unknown',
        durationMs,
      };
    } catch (error) {
      console.error('[LLMInterface] Error calling LLM:', error);
      throw error;
    }
  }

  private estimateTokens(systemPrompt: string, userPrompt: string, response: string): number {
    const totalChars = systemPrompt.length + userPrompt.length + response.length;
    return Math.ceil(totalChars / 4);
  }

  private buildSchemaInstructions(schema: z.ZodSchema): string {
    const schemaDescription = this.extractSchemaDescription(schema);
    
    return `**IMPORTANT: Return your response as valid JSON only. No markdown code blocks, no explanatory text.**

The JSON must match this structure:
${schemaDescription}

Return ONLY the JSON object, nothing else.`;
  }

  private extractSchemaDescription(schema: z.ZodSchema): string {
    try {
      const zodToJsonSchema = (s: z.ZodSchema): any => {
        if (s instanceof z.ZodObject) {
          const shape = s._def.shape();
          const result: Record<string, string> = {};
          for (const [key, value] of Object.entries(shape)) {
            result[key] = this.getTypeDescription(value as z.ZodSchema);
          }
          return result;
        }
        return this.getTypeDescription(s);
      };
      
      return JSON.stringify(zodToJsonSchema(schema), null, 2);
    } catch {
      return '{ /* structured output matching the schema */ }';
    }
  }

  private getTypeDescription(schema: z.ZodSchema): string {
    if (schema instanceof z.ZodString) return 'string';
    if (schema instanceof z.ZodNumber) return 'number';
    if (schema instanceof z.ZodBoolean) return 'boolean';
    if (schema instanceof z.ZodArray) return 'array';
    if (schema instanceof z.ZodObject) return 'object';
    if (schema instanceof z.ZodOptional) return `${this.getTypeDescription(schema._def.innerType)} (optional)`;
    if (schema instanceof z.ZodEnum) return `enum: ${(schema._def.values as string[]).join(' | ')}`;
    return 'any';
  }

  private parseStructuredOutput<T>(content: string, schema?: z.ZodSchema): T {
    let jsonContent = content.trim();
    
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }
    
    const jsonStartIndex = jsonContent.indexOf('{');
    const jsonEndIndex = jsonContent.lastIndexOf('}');
    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
      jsonContent = jsonContent.slice(jsonStartIndex, jsonEndIndex + 1);
    }

    try {
      const parsed = JSON.parse(jsonContent);
      
      if (schema) {
        const result = schema.safeParse(parsed);
        if (result.success) {
          return result.data as T;
        } else {
          console.warn('[LLMInterface] Schema validation failed, returning raw parsed JSON:', result.error.issues);
          return parsed as T;
        }
      }
      
      return parsed as T;
    } catch (parseError) {
      console.error('[LLMInterface] Failed to parse JSON response:', parseError);
      console.error('[LLMInterface] Raw content:', content.slice(0, 500));
      
      return {
        observations: ['Failed to parse structured response'],
        recommendations: [],
        confidence: 0.5,
        error: 'JSON parsing failed',
        rawContent: content.slice(0, 1000),
      } as T;
    }
  }
}

export const llmInterface = new LLMInterface();
