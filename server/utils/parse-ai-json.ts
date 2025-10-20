/**
 * Defensive JSON parsing for AI responses that may include markdown or malformed JSON
 */
export function parseAIJson(aiResponse: string, context: string = 'AI response'): any {
  try {
    // Step 1: Clean markdown code blocks
    let cleanJson = aiResponse
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    // Step 2: Try primary parsing
    return JSON.parse(cleanJson);
  } catch (primaryError) {
    console.error(`[parseAIJson] Primary JSON parsing failed for ${context}:`, primaryError);
    console.log(`[parseAIJson] Attempting fallback extraction...`);
    
    // Step 3: Fallback - extract JSON from response using regex
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const extracted = JSON.parse(jsonMatch[0]);
        console.log(`[parseAIJson] ✓ Fallback extraction succeeded for ${context}`);
        return extracted;
      } catch (fallbackError) {
        console.error(`[parseAIJson] Fallback parsing also failed for ${context}:`, fallbackError);
        console.log(`[parseAIJson] Raw response (first 500 chars):`, aiResponse.substring(0, 500));
      }
    } else {
      console.error(`[parseAIJson] No JSON object found in response for ${context}`);
      console.log(`[parseAIJson] Raw response (first 500 chars):`, aiResponse.substring(0, 500));
    }
    
    // Step 4: Throw error with detailed context
    throw new Error(`Failed to parse AI response for ${context}: ${primaryError instanceof Error ? primaryError.message : 'Unknown error'}`);
  }
}

/**
 * Safe JSON parsing that returns a default value instead of throwing
 */
export function parseAIJsonSafe<T>(
  aiResponse: string, 
  defaultValue: T,
  context: string = 'AI response'
): T {
  try {
    return parseAIJson(aiResponse, context);
  } catch (error) {
    console.error(`[parseAIJsonSafe] Returning default value for ${context}`);
    return defaultValue;
  }
}
