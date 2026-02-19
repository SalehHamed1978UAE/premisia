import Anthropic from '@anthropic-ai/sdk';
import { aiClients } from '../ai-clients';

function normalizeSystemPrompt(system: unknown): string {
  if (typeof system === 'string') return system;
  if (Array.isArray(system)) {
    return system
      .map((item: any) => (typeof item?.text === 'string' ? item.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  return 'You are a helpful assistant.';
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part: any) => (part?.type === 'text' && typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n');
}

function hasImagePayload(messages: any[]): boolean {
  return messages.some((message) => {
    const content = message?.content;
    if (!Array.isArray(content)) return false;
    return content.some((part: any) => part?.type === 'image');
  });
}

function normalizeUserMessage(messages: any[]): string {
  return messages
    .map((message) => {
      const role = String(message?.role || 'user').toUpperCase();
      const text = extractTextFromContent(message?.content);
      if (!text) return '';
      return `${role}:\n${text}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

export function createAnthropicClientWithFallback(apiKey?: string): Anthropic {
  const anthropic = new Anthropic({
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY || 'missing-anthropic-key',
  });

  const originalCreate = anthropic.messages.create.bind(anthropic.messages);

  (anthropic.messages as any).create = async (params: any) => {
    try {
      return await originalCreate(params);
    } catch (error: any) {
      const messages = Array.isArray(params?.messages) ? params.messages : [];
      if (hasImagePayload(messages)) {
        throw error;
      }

      console.warn('[AnthropicFallback] Anthropic call failed, switching to provider fallback:', error?.message || error);

      const fallback = await aiClients.callWithFallback({
        systemPrompt: normalizeSystemPrompt(params?.system),
        userMessage: normalizeUserMessage(messages),
        maxTokens: typeof params?.max_tokens === 'number' ? params.max_tokens : 4096,
      });

      return {
        id: `fallback-${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: fallback.content }],
        model: fallback.model,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      } as any;
    }
  };

  return anthropic;
}
