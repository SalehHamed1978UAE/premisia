// Blueprint references: javascript_openai, javascript_anthropic, javascript_gemini
import OpenAI from "openai";
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from "@google/genai";
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const OPENAI_MODEL = "gpt-5";
// The newest Anthropic model is "claude-sonnet-4-20250514"
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
// The newest Gemini model series is "gemini-2.5-flash" or "gemini-2.5-pro"
const GEMINI_MODEL = "gemini-2.5-pro";
export class AIClients {
    openai = null;
    anthropic = null;
    gemini = null;
    constructor() {
        // Lazy initialization - only create clients when API keys are available
    }
    getOpenAI() {
        if (!this.openai) {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
                throw new Error("OPENAI_API_KEY environment variable is not set");
            }
            this.openai = new OpenAI({ apiKey });
        }
        return this.openai;
    }
    getAnthropic() {
        if (!this.anthropic) {
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) {
                throw new Error("ANTHROPIC_API_KEY environment variable is not set");
            }
            this.anthropic = new Anthropic({ apiKey });
        }
        return this.anthropic;
    }
    getGemini() {
        if (!this.gemini) {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("GEMINI_API_KEY environment variable is not set");
            }
            this.gemini = new GoogleGenAI({ apiKey });
        }
        return this.gemini;
    }
    async callOpenAI(request) {
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
    async callAnthropic(request) {
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
    async callGemini(request) {
        const { systemPrompt, userMessage, responseSchema } = request;
        const gemini = this.getGemini();
        // Build config with optional schema enforcement
        const config = {
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
    async call(provider, request) {
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
    isProviderAvailable(provider) {
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
    getAvailableProviders() {
        const providers = [];
        if (this.isProviderAvailable("openai"))
            providers.push("openai");
        if (this.isProviderAvailable("anthropic"))
            providers.push("anthropic");
        if (this.isProviderAvailable("gemini"))
            providers.push("gemini");
        return providers;
    }
    selectProvider(preferredProvider) {
        const available = this.getAvailableProviders();
        if (available.length === 0) {
            throw new Error("No AI providers available. Please configure at least one API key.");
        }
        if (preferredProvider && this.isProviderAvailable(preferredProvider)) {
            return preferredProvider;
        }
        // Default priority: OpenAI > Anthropic > Gemini
        if (this.isProviderAvailable("openai"))
            return "openai";
        if (this.isProviderAvailable("anthropic"))
            return "anthropic";
        return "gemini";
    }
    async callWithFallback(request, preferredProvider) {
        // Priority order: Anthropic (Claude) → OpenAI (GPT-4o) → Gemini
        const providerOrder = preferredProvider
            ? [preferredProvider, ...["anthropic", "openai", "gemini"].filter(p => p !== preferredProvider)]
            : ["anthropic", "openai", "gemini"];
        const errors = [];
        for (const provider of providerOrder) {
            if (!this.isProviderAvailable(provider)) {
                continue;
            }
            try {
                console.log(`[AIClients] Attempting provider: ${provider}`);
                const response = await this.call(provider, request);
                console.log(`[AIClients] ✓ Success with provider: ${provider} (model: ${response.model})`);
                return response;
            }
            catch (error) {
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
//# sourceMappingURL=ai-clients.js.map