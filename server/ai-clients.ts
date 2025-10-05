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

interface AIClientRequest {
  systemPrompt: string;
  userMessage: string;
  responseSchema?: any;
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

  async callOpenAI(request: AIClientRequest): Promise<AIClientResponse> {
    const { systemPrompt, userMessage, maxTokens = 8192 } = request;

    const openai = this.getOpenAI();

    // OpenAI gpt-5 doesn't support temperature parameter
    // Use max_completion_tokens instead of max_tokens for gpt-5
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: maxTokens,
    });

    return {
      content: response.choices[0].message.content || "",
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

  async call(provider: AIProvider, request: AIClientRequest): Promise<AIClientResponse> {
    switch (provider) {
      case "openai":
        return this.callOpenAI(request);
      case "anthropic":
        return this.callAnthropic(request);
      case "gemini":
        return this.callGemini(request);
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
      default:
        return false;
    }
  }

  getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = [];
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
}

export const aiClients = new AIClients();
