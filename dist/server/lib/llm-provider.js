import { aiClients } from '../ai-clients';
/**
 * LLM Provider Adapter
 * Wraps aiClients.callWithFallback() for journey services
 */
export function getLLMProvider() {
    return {
        async generateStructuredResponse(prompt, schema) {
            try {
                const response = await aiClients.callWithFallback({
                    systemPrompt: 'You are a strategic planning expert. Return ONLY valid JSON matching the requested format. Do not include markdown code blocks or explanations.',
                    userMessage: prompt,
                    maxTokens: 2000,
                });
                // Parse JSON from response
                const parsed = JSON.parse(response.content);
                return parsed;
            }
            catch (error) {
                console.error('[LLM Provider] Failed to parse JSON response:', error);
                // Return safe defaults based on schema
                if (schema.recommendations) {
                    return { recommendations: [] };
                }
                throw error;
            }
        }
    };
}
//# sourceMappingURL=llm-provider.js.map