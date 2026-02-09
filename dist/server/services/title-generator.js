import { aiClients } from '../ai-clients.js';
/**
 * Generate a concise title (5-8 words) from a strategic statement
 */
export async function generateTitle(statement) {
    const systemPrompt = `You are a strategic summarization expert. Your job is to create concise, descriptive titles for strategic questions and business scenarios.

Rules:
- Generate a title that is 5-8 words long
- Capture the core essence of the strategic question
- Use clear, professional language
- Focus on the key decision or scenario
- Return ONLY the title text, nothing else
- Do not use quotes around the title
- Make it actionable and specific`;
    const userMessage = `Create a concise 5-8 word title for this strategic statement:\n\n"${statement}"`;
    try {
        const response = await aiClients.callWithFallback({
            systemPrompt,
            userMessage,
            maxTokens: 100,
        });
        // Clean up the response - remove quotes if present
        let title = response.content.trim();
        title = title.replace(/^["']|["']$/g, '');
        // Truncate if too long (max 200 chars for DB)
        if (title.length > 200) {
            title = title.substring(0, 197) + '...';
        }
        return title;
    }
    catch (error) {
        console.error('[TitleGenerator] Failed to generate title:', error);
        // Fallback: create a simple truncated title
        const fallbackTitle = statement.substring(0, 60).trim();
        return fallbackTitle.length < statement.length ? fallbackTitle + '...' : fallbackTitle;
    }
}
//# sourceMappingURL=title-generator.js.map