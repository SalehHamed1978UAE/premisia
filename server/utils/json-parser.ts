/**
 * JSON Parser Utility
 * 
 * Handles extraction of JSON from AI responses that may be wrapped in markdown code blocks.
 * Returns structured results with success/error state and raw output for debugging.
 */

export interface JsonParseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  rawOutput: string;
}

/**
 * Extracts and parses JSON from a string that may be wrapped in markdown code blocks.
 * 
 * Handles common AI response patterns:
 * - ```json\n{...}\n```
 * - ```\n{...}\n```
 * - Raw JSON without wrappers
 * 
 * @param input - The raw string from AI response
 * @returns JsonParseResult with success/error state and parsed data or raw output
 */
export function extractJsonFromMarkdown<T = any>(input: string): JsonParseResult<T> {
  const rawOutput = input;
  
  if (!input || typeof input !== 'string') {
    console.error('[JSON Parser] Invalid input:', typeof input, input?.slice?.(0, 100));
    return {
      success: false,
      error: 'Invalid input: expected string',
      rawOutput: String(input || ''),
    };
  }

  let cleaned = input.trim();
  
  // Strip markdown code fences if present
  // Pattern 1: ```json\n...\n```
  // Pattern 2: ```\n...\n```
  const jsonCodeBlockRegex = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
  const match = cleaned.match(jsonCodeBlockRegex);
  
  if (match) {
    cleaned = match[1].trim();
    console.log('[JSON Parser] Stripped markdown fences, content length:', cleaned.length);
  }

  // Also handle case where there are leading/trailing backticks without full fence
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\n?```$/, '');
  }
  
  cleaned = cleaned.trim();

  try {
    const data = JSON.parse(cleaned) as T;
    return {
      success: true,
      data,
      rawOutput,
    };
  } catch (parseError: any) {
    // Log the failure with raw output for debugging
    console.error('[JSON Parser] Parse failed:', parseError.message);
    console.error('[JSON Parser] Raw output (first 500 chars):', rawOutput.slice(0, 500));
    console.error('[JSON Parser] Cleaned output (first 500 chars):', cleaned.slice(0, 500));
    
    return {
      success: false,
      error: `JSON parse error: ${parseError.message}`,
      rawOutput,
    };
  }
}

/**
 * Creates an error structure for failed framework analysis.
 * This should be saved to framework_insights instead of throwing,
 * so the UI can show "Analysis failed" instead of 404.
 */
export function createAnalysisErrorResult(
  frameworkName: string,
  errorMessage: string,
  rawOutput: string,
  parseError?: string
) {
  return {
    error: true,
    framework: frameworkName,
    message: errorMessage,
    rawOutput: rawOutput.slice(0, 5000), // Limit size for DB storage
    parseError: parseError || null,
    failedAt: new Date().toISOString(),
  };
}
