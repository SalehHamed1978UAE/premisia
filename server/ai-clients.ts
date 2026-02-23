// Blueprint references: javascript_openai, javascript_anthropic, javascript_gemini
import OpenAI from "openai";
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from "@google/genai";
import type { AIProvider } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const OPENAI_MODEL = "gpt-5";

// The newest Anthropic model is "claude-sonnet-4-20250514"
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

// The newest Gemini model series is "gemini-2.5-flash" or "gemini-2.5-pro"
const GEMINI_MODEL = "gemini-2.5-pro";

// Local Ollama model (free, runs on localhost:11434)
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";

interface AIClientRequest {
  systemPrompt: string;
  userMessage: string;
  responseSchema?: any;
  responseMimeType?: "application/json" | "text/plain";
  maxTokens?: number;
}

interface AIClientResponse {
  content: string;
  provider: AIProvider;
  model: string;
}

export class AIClients {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private gemini: GoogleGenAI | null = null;
  private ollama: OpenAI | null = null;

  constructor() {
    // Lazy initialization - only create clients when API keys are available
  }

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  private getAnthropic(): Anthropic {
    if (!this.anthropic) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY environment variable is not set");
      }
      this.anthropic = new Anthropic({ apiKey });
    }
    return this.anthropic;
  }

  private getGemini(): GoogleGenAI {
    if (!this.gemini) {
      const apiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not set");
      }
      const opts: any = { apiKey };
      if (!process.env.GEMINI_API_KEY && process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
        opts.httpOptions = {
          apiVersion: "",
          baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
        };
      }
      this.gemini = new GoogleGenAI(opts);
    }
    return this.gemini;
  }

  private getOllama(): OpenAI {
    if (!this.ollama) {
      // Ollama uses OpenAI-compatible API, no API key needed
      this.ollama = new OpenAI({ 
        baseURL: OLLAMA_BASE_URL,
        apiKey: "ollama" // Ollama doesn't need a real key
      });
    }
    return this.ollama;
  }

  async callOpenAI(request: AIClientRequest, retryCount = 0): Promise<AIClientResponse> {
    const { systemPrompt, userMessage, maxTokens = 8192 } = request;

    const openai = this.getOpenAI();

    const effectiveMaxTokens = maxTokens * Math.pow(2, retryCount);
    const cappedTokens = Math.min(effectiveMaxTokens, 32768);

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: cappedTokens,
    });

    const content = response.choices[0].message.content;
    const finishReason = response.choices[0].finish_reason;

    if (!content && finishReason === 'length' && retryCount < 2 && cappedTokens < 32768) {
      console.warn(`[AIClients] OpenAI truncated at ${cappedTokens} tokens, retrying with ${Math.min(cappedTokens * 2, 32768)}...`);
      return this.callOpenAI(request, retryCount + 1);
    }

    if (!content) {
      throw new Error(`OpenAI returned empty content (finish_reason: ${finishReason}, max_tokens: ${cappedTokens})`);
    }

    return {
      content,
      provider: "openai",
      model: OPENAI_MODEL,
    };
  }

  async callAnthropic(request: AIClientRequest): Promise<AIClientResponse> {
    const { systemPrompt, userMessage, maxTokens = 8192 } = request;

    const anthropic = this.getAnthropic();

    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      system: systemPrompt,
      max_tokens: maxTokens,
      messages: [
        { role: 'user', content: userMessage }
      ],
    });

    // Extract text content from response
    const textBlock = response.content.find(block => block.type === 'text');
    const content = textBlock && 'text' in textBlock ? textBlock.text : "";

    if (!content) {
      throw new Error(`Anthropic returned empty content (stop_reason: ${response.stop_reason})`);
    }

    return {
      content,
      provider: "anthropic",
      model: ANTHROPIC_MODEL,
    };
  }

  async callGemini(request: AIClientRequest, retryCount = 0): Promise<AIClientResponse> {
    const { systemPrompt, userMessage, maxTokens = 8192, responseSchema, responseMimeType } = request;

    const gemini = this.getGemini();

    const effectiveMaxTokens = Math.min(maxTokens * Math.pow(2, retryCount), 32768);

    const config: any = {
      systemInstruction: systemPrompt,
      maxOutputTokens: effectiveMaxTokens,
    };

    const shouldForceJson = Boolean(
      responseSchema ||
      responseMimeType === "application/json" ||
      /json/i.test(systemPrompt) ||
      /json/i.test(userMessage.slice(0, 400))
    );

    if (shouldForceJson) {
      config.responseMimeType = "application/json";
    }

    if (responseSchema) {
      config.responseSchema = responseSchema;
    }

    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: userMessage,
      config,
    });

    const content = response.text;
    if (!content) {
      if (retryCount < 2 && effectiveMaxTokens < 32768) {
        console.warn(`[AIClients] Gemini returned empty content, retrying with ${Math.min(effectiveMaxTokens * 2, 32768)} tokens...`);
        return this.callGemini(request, retryCount + 1);
      }
      throw new Error(`Gemini returned empty content (max_tokens: ${effectiveMaxTokens})`);
    }

    return {
      content,
      provider: "gemini",
      model: GEMINI_MODEL,
    };
  }

  async callOllama(request: AIClientRequest): Promise<AIClientResponse> {
    const { systemPrompt, userMessage, maxTokens = 8192 } = request;

    const ollama = this.getOllama();

    const response = await ollama.chat.completions.create({
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: maxTokens,
    });

    return {
      content: response.choices[0].message.content || "",
      provider: "ollama" as AIProvider,
      model: OLLAMA_MODEL,
    };
  }

  async call(provider: AIProvider, request: AIClientRequest): Promise<AIClientResponse> {
    switch (provider) {
      case "openai":
        return this.callOpenAI(request);
      case "anthropic":
        return this.callAnthropic(request);
      case "gemini":
        return this.callGemini(request);
      case "ollama" as AIProvider:
        return this.callOllama(request);
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }

  isProviderAvailable(provider: AIProvider): boolean {
    switch (provider) {
      case "openai":
        return !!process.env.OPENAI_API_KEY;
      case "anthropic":
        return !!process.env.ANTHROPIC_API_KEY;
      case "gemini":
        return !!(process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY);
      case "ollama" as AIProvider:
        // Ollama is available if USE_OLLAMA=true (local dev)
        return process.env.USE_OLLAMA === "true";
      default:
        return false;
    }
  }

  getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = [];
    if (this.isProviderAvailable("ollama" as AIProvider)) providers.push("ollama" as AIProvider);
    if (this.isProviderAvailable("openai")) providers.push("openai");
    if (this.isProviderAvailable("anthropic")) providers.push("anthropic");
    if (this.isProviderAvailable("gemini")) providers.push("gemini");
    return providers;
  }

  selectProvider(preferredProvider?: AIProvider): AIProvider {
    const available = this.getAvailableProviders();
    
    if (available.length === 0) {
      throw new Error("No AI providers available. Please configure at least one API key.");
    }

    if (preferredProvider && this.isProviderAvailable(preferredProvider)) {
      return preferredProvider;
    }

    // Default priority: OpenAI > Anthropic > Gemini
    if (this.isProviderAvailable("openai")) return "openai";
    if (this.isProviderAvailable("anthropic")) return "anthropic";
    return "gemini";
  }

  async callWithFallback(request: AIClientRequest, preferredProvider?: AIProvider): Promise<AIClientResponse> {
    // Priority order: Anthropic (Claude) → OpenAI (GPT-5) → Gemini
    // Claude is more concise and avoids the token truncation issues seen with GPT-5
    const defaultOrder: AIProvider[] = process.env.USE_OLLAMA === "true"
      ? ["ollama" as AIProvider, "anthropic", "openai", "gemini"]
      : ["anthropic", "openai", "gemini"];
    
    const providerOrder: AIProvider[] = preferredProvider 
      ? [preferredProvider, ...defaultOrder.filter(p => p !== preferredProvider)]
      : defaultOrder;

    const errors: { provider: AIProvider; error: string }[] = [];

    for (const provider of providerOrder) {
      if (!this.isProviderAvailable(provider)) {
        continue;
      }

      try {
        console.log(`[AIClients] Attempting provider: ${provider}`);
        const response = await this.call(provider, request);
        console.log(`[AIClients] ✓ Success with provider: ${provider} (model: ${response.model})`);
        return response;
      } catch (error: any) {
        const errorMsg = error.message || String(error);
        console.warn(`[AIClients] ✗ Provider ${provider} failed: ${errorMsg}`);
        errors.push({ provider, error: errorMsg });
        
        // Continue to next provider
        continue;
      }
    }

    // All providers failed
    const errorDetails = errors.map(e => `${e.provider}: ${e.error}`).join('; ');
    throw new Error(`All AI providers failed. Errors: ${errorDetails}`);
  }
}

export const aiClients = new AIClients();
