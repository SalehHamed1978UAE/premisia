import { aiClients } from './ai-clients.js';
// RTL languages that need special handling
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'yi', 'arc'];
class TranslationService {
    azureCircuitBreaker = {
        failures: 0,
        lastFailureTime: 0,
        isOpen: false,
    };
    rateLimit = {
        requests: [],
        currentMinute: Math.floor(Date.now() / 60000),
    };
    telemetry = {
        azureCalls: 0,
        azureFailures: 0,
        llmFallbacks: 0,
        circuitOpenCount: 0,
        rateLimitHits: 0,
    };
    // Circuit breaker thresholds
    FAILURE_THRESHOLD = 3;
    CIRCUIT_TIMEOUT = 60000; // 1 minute
    RATE_LIMIT = 30; // 30 requests per minute
    /**
     * Detect if a language code is RTL (Right-to-Left)
     */
    isRTLLanguage(languageCode) {
        const langCode = languageCode.toLowerCase().split('-')[0];
        return RTL_LANGUAGES.includes(langCode);
    }
    /**
     * Check if circuit breaker is open
     */
    isCircuitOpen() {
        if (!this.azureCircuitBreaker.isOpen)
            return false;
        const now = Date.now();
        if (now - this.azureCircuitBreaker.lastFailureTime > this.CIRCUIT_TIMEOUT) {
            // Reset circuit breaker after timeout
            this.azureCircuitBreaker.isOpen = false;
            this.azureCircuitBreaker.failures = 0;
            return false;
        }
        return true;
    }
    /**
     * Record Azure failure and potentially open circuit
     */
    recordAzureFailure() {
        this.azureCircuitBreaker.failures++;
        this.azureCircuitBreaker.lastFailureTime = Date.now();
        this.telemetry.azureFailures++;
        if (this.azureCircuitBreaker.failures >= this.FAILURE_THRESHOLD) {
            this.azureCircuitBreaker.isOpen = true;
            this.telemetry.circuitOpenCount++;
            console.warn('[Translation] Circuit breaker opened after 3 Azure failures');
        }
    }
    /**
     * Check rate limit and apply throttling
     */
    async checkRateLimit() {
        const currentMinute = Math.floor(Date.now() / 60000);
        if (currentMinute !== this.rateLimit.currentMinute) {
            // New minute, reset counter
            this.rateLimit.currentMinute = currentMinute;
            this.rateLimit.requests = [];
        }
        if (this.rateLimit.requests.length >= this.RATE_LIMIT) {
            // Rate limit exceeded, apply exponential backoff
            this.telemetry.rateLimitHits++;
            const backoffTime = Math.min(1000 * Math.pow(2, this.telemetry.rateLimitHits), 30000);
            console.warn(`[Translation] Rate limit hit, backing off for ${backoffTime}ms`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
        this.rateLimit.requests.push(Date.now());
    }
    /**
     * Translate using Azure Translator API
     */
    async translateWithAzure(text, targetLanguage) {
        const apiKey = process.env.AZURE_TRANSLATOR_KEY;
        const region = process.env.AZURE_TRANSLATOR_REGION || 'global';
        if (!apiKey) {
            throw new Error('AZURE_TRANSLATOR_KEY not configured');
        }
        await this.checkRateLimit();
        this.telemetry.azureCalls++;
        const response = await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${targetLanguage}`, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey,
                'Ocp-Apim-Subscription-Region': region,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([{ text }]),
        });
        if (!response.ok) {
            throw new Error(`Azure Translator failed: ${response.statusText}`);
        }
        const data = await response.json();
        const result = data[0];
        return {
            translatedText: result.translations[0].text,
            detectedLanguage: result.detectedLanguage?.language || 'unknown',
        };
    }
    /**
     * Fallback translation using LLM
     */
    async translateWithLLM(text, targetLanguage) {
        this.telemetry.llmFallbacks++;
        const systemPrompt = `You are a professional translator. Translate text accurately while preserving meaning and context. Always respond in JSON format.`;
        const userMessage = `Translate the following text to ${targetLanguage}.

Respond with a JSON object in this exact format:
{
  "translatedText": "the translated text here",
  "detectedLanguage": "xx"
}

Where "detectedLanguage" is the ISO 639-1 language code of the source text (e.g., "en" for English, "es" for Spanish, "ar" for Arabic).

Text to translate:
${text}`;
        const { content } = await aiClients.callWithFallback({
            systemPrompt,
            userMessage,
            maxTokens: 4096,
        }, 'openai');
        // Parse JSON response
        try {
            const parsed = JSON.parse(content);
            return {
                translatedText: parsed.translatedText || content,
                detectedLanguage: parsed.detectedLanguage || 'unknown',
            };
        }
        catch (error) {
            console.error('[Translation] Failed to parse LLM response:', error);
            // Fallback: assume content is the translation and detect language separately
            return {
                translatedText: content,
                detectedLanguage: 'unknown',
            };
        }
    }
    /**
     * Main translation method with circuit breaker and fallback
     */
    async translate(text, targetLanguage = 'en') {
        // If text is already in target language, no translation needed
        const sourceLanguage = await this.detectLanguage(text);
        if (sourceLanguage.toLowerCase().startsWith(targetLanguage.toLowerCase())) {
            return {
                translatedText: text,
                detectedLanguage: sourceLanguage,
                isRTL: this.isRTLLanguage(sourceLanguage),
                wasTranslated: false,
                provider: 'azure', // Doesn't matter, not translated
            };
        }
        let result;
        let provider = 'azure';
        // Try Azure first if circuit is closed and API key exists
        if (!this.isCircuitOpen() && process.env.AZURE_TRANSLATOR_KEY) {
            try {
                result = await this.translateWithAzure(text, targetLanguage);
            }
            catch (error) {
                console.error('[Translation] Azure failed:', error);
                this.recordAzureFailure();
                // Fallback to LLM
                provider = 'llm';
                result = await this.translateWithLLM(text, targetLanguage);
            }
        }
        else {
            // Circuit is open or no Azure key, use LLM directly
            provider = 'llm';
            result = await this.translateWithLLM(text, targetLanguage);
        }
        return {
            translatedText: result.translatedText,
            detectedLanguage: result.detectedLanguage,
            isRTL: this.isRTLLanguage(result.detectedLanguage),
            wasTranslated: true,
            provider,
        };
    }
    /**
     * Detect language of text using Azure or LLM
     */
    async detectLanguage(text) {
        // Try Azure first if available and circuit is closed
        if (!this.isCircuitOpen() && process.env.AZURE_TRANSLATOR_KEY) {
            try {
                const apiKey = process.env.AZURE_TRANSLATOR_KEY;
                const region = process.env.AZURE_TRANSLATOR_REGION || 'global';
                const response = await fetch('https://api.cognitive.microsofttranslator.com/detect?api-version=3.0', {
                    method: 'POST',
                    headers: {
                        'Ocp-Apim-Subscription-Key': apiKey,
                        'Ocp-Apim-Subscription-Region': region,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify([{ text: text.substring(0, 1000) }]),
                });
                if (response.ok) {
                    const data = await response.json();
                    return data[0]?.language || 'unknown';
                }
            }
            catch (error) {
                console.error('[Translation] Azure language detection failed:', error);
            }
        }
        // Fallback to LLM detection
        const systemPrompt = `You are a language detection expert. Always respond in JSON format.`;
        const userMessage = `Detect the language of this text.

Respond with a JSON object in this exact format:
{
  "languageCode": "xx"
}

Where "languageCode" is the ISO 639-1 language code (e.g., "en" for English, "es" for Spanish, "ar" for Arabic).

Text: ${text.substring(0, 500)}`;
        const { content } = await aiClients.callWithFallback({
            systemPrompt,
            userMessage,
            maxTokens: 100,
        }, 'openai');
        // Parse JSON response
        try {
            const parsed = JSON.parse(content);
            const langCode = parsed.languageCode || parsed.language;
            if (!langCode) {
                console.warn('[Translation] No language code in response, returning "unknown"');
                return 'unknown';
            }
            return langCode.toLowerCase().substring(0, 2);
        }
        catch (error) {
            console.error('[Translation] Failed to parse language detection response:', error);
            // Return "unknown" to force translation instead of assuming English
            return 'unknown';
        }
    }
    /**
     * Get translation telemetry
     */
    getTelemetry() {
        return { ...this.telemetry };
    }
    /**
     * Reset telemetry (useful for testing)
     */
    resetTelemetry() {
        this.telemetry = {
            azureCalls: 0,
            azureFailures: 0,
            llmFallbacks: 0,
            circuitOpenCount: 0,
            rateLimitHits: 0,
        };
    }
}
export const translationService = new TranslationService();
//# sourceMappingURL=translation-service.js.map