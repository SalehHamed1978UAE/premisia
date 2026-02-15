// Blueprint references: javascript_openai, javascript_anthropic, javascript_gemini
import OpenAI from "openai";
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from "@google/genai";
import type { AIProvider } from "@shared/schema";
import { tryNormalizeJsonText } from "./utils/parse-ai-json";

// Default to GPT-5.2 and keep reasoning disabled for deterministic token usage.
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.2";

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
  maxTokens?: number;
  expectJson?: boolean;
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
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not set");
      }
      this.gemini = new GoogleGenAI({ apiKey });
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

  async callOpenAI(request: AIClientRequest): Promise<AIClientResponse> {
    const { systemPrompt, userMessage, maxTokens = 8192, responseSchema, expectJson } = request;

    const openai = this.getOpenAI();

    const combinedPrompt = `${systemPrompt}\n${userMessage}`.toLowerCase();
    const inferredJsonExpectation = combinedPrompt.includes('json');
    const shouldForceJson = expectJson ?? Boolean(responseSchema || inferredJsonExpectation);

    const payload: any = {
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_completion_tokens: maxTokens,
      reasoning_effort: "none",
    };

    if (shouldForceJson) {
      payload.response_format = { type: "json_object" };
    }

    // OpenAI gpt-5 doesn't support temperature parameter
    // Use max_completion_tokens instead of max_tokens for gpt-5
    const response = await openai.chat.completions.create(payload);

    const content = response.choices[0].message.content || "";
    const finishReason = response.choices[0].finish_reason || "unknown";
    if (finishReason === "length") {
      console.warn(
        `[AIClients] OpenAI response truncated (finish_reason=length). Content length=${content.length}.`,
      );
    }

    if (!content.trim()) {
      throw new Error(`OpenAI returned empty content (finish_reason=${finishReason})`);
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

    return {
      content,
      provider: "anthropic",
      model: ANTHROPIC_MODEL,
    };
  }

  async callGemini(request: AIClientRequest): Promise<AIClientResponse> {
    const { systemPrompt, userMessage, responseSchema } = request;

    const gemini = this.getGemini();

    // Build config with optional schema enforcement
    const config: any = {
      systemInstruction: systemPrompt,
    };

    // Add JSON schema enforcement if provided
    if (responseSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = responseSchema;
    }

    // Generate content using the @google/genai API
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: userMessage,
      config,
    });

    return {
      content: response.text || "",
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
        return !!process.env.GEMINI_API_KEY;
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
    if (this.isProviderAvailable("gemini")) providers.push("gemini");
    if (this.isProviderAvailable("anthropic")) providers.push("anthropic");
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

    // Default priority: OpenAI > Gemini > Anthropic
    if (this.isProviderAvailable("openai")) return "openai";
    if (this.isProviderAvailable("gemini")) return "gemini";
    return "anthropic";
  }

  private normalizeResponseContent(response: AIClientResponse): AIClientResponse {
    if (!response.content || typeof response.content !== 'string') {
      return response;
    }

    const normalized = tryNormalizeJsonText(
      response.content,
      `ai-clients ${response.provider}`,
    );

    if (!normalized) {
      return response;
    }

    return {
      ...response,
      content: normalized,
    };
  }

  private shouldExpectJson(request: AIClientRequest): boolean {
    if (typeof request.expectJson === 'boolean') {
      return request.expectJson;
    }

    const combinedPrompt = `${request.systemPrompt}\n${request.userMessage}`.toLowerCase();
    return Boolean(request.responseSchema) || combinedPrompt.includes('json');
  }

  async callWithFallback(request: AIClientRequest, preferredProvider?: AIProvider): Promise<AIClientResponse> {
    // Priority order: Ollama (free local) → OpenAI (GPT-5.2) → Gemini → Anthropic
    // When USE_OLLAMA=true, Ollama is first; otherwise skip it
    const defaultOrder: AIProvider[] = process.env.USE_OLLAMA === "true"
      ? ["ollama" as AIProvider, "openai", "gemini", "anthropic"]
      : ["openai", "gemini", "anthropic"];

    // Global policy: if OpenAI is available, ignore non-OpenAI explicit preference unless opt-out is set.
    const allowNonOpenAIPreference = process.env.ALLOW_NON_OPENAI_PREFERRED === "true";
    const effectivePreferred =
      preferredProvider &&
      !(preferredProvider !== "openai" && this.isProviderAvailable("openai") && !allowNonOpenAIPreference)
        ? preferredProvider
        : undefined;
    
    const providerOrder: AIProvider[] = effectivePreferred
      ? [effectivePreferred, ...defaultOrder.filter(p => p !== effectivePreferred)]
      : defaultOrder;
    const expectJson = this.shouldExpectJson(request);

    const errors: { provider: AIProvider; error: string }[] = [];

    for (const provider of providerOrder) {
      if (!this.isProviderAvailable(provider)) {
        continue;
      }

      try {
        console.log(`[AIClients] Attempting provider: ${provider}`);
        const response = this.normalizeResponseContent(await this.call(provider, request));

        if (expectJson) {
          const normalizedCandidate = tryNormalizeJsonText(
            response.content,
            `ai-clients-json-check ${provider}`,
          );
          if (!normalizedCandidate) {
            throw new Error('Provider returned non-JSON content for JSON-expected request');
          }
        }

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
