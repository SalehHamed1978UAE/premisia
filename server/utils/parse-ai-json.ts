import { z } from 'zod';

const WRAPPER_KEYS = new Set(['data', 'result', 'output', 'response', 'content']);

const TEXT_KEYS = [
  'text',
  'description',
  'message',
  'assumption',
  'name',
  'value',
  'title',
  'claim',
  'content',
  'fact',
  'action',
  'rationale',
];

function logIfEnabled(silent: boolean, ...args: any[]) {
  if (!silent) {
    console.error(...args);
  }
}

function stripMarkdownCodeFences(input: string): string {
  return input
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();
}

function extractJsonCandidate(input: string): string | null {
  const objectMatch = input.match(/\{[\s\S]*\}/);
  const arrayMatch = input.match(/\[[\s\S]*\]/);

  if (!objectMatch && !arrayMatch) {
    return null;
  }

  if (objectMatch && !arrayMatch) return objectMatch[0];
  if (arrayMatch && !objectMatch) return arrayMatch[0];

  // Prefer the longer candidate when both are present.
  return (objectMatch![0].length >= arrayMatch![0].length)
    ? objectMatch![0]
    : arrayMatch![0];
}

function repairLikelyJson(input: string): string {
  let repaired = input.replace(/,\s*$/g, '');
  repaired = repaired.replace(/("[^"]*?)$/g, '$1"');

  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;

  for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
  for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';

  return repaired;
}

export function extractTextFromItem(item: any): string {
  if (typeof item === 'string') return item;
  if (item == null) return '';
  if (typeof item !== 'object') return String(item);

  for (const key of TEXT_KEYS) {
    if (key in item && typeof item[key] === 'string') {
      return item[key];
    }
  }

  return JSON.stringify(item);
}

export function coerceStringArray(arr: any): string[] {
  if (!Array.isArray(arr)) {
    if (arr == null) return [];
    if (typeof arr === 'string') return [arr];
    if (typeof arr === 'object') return [extractTextFromItem(arr)];
    return [String(arr)];
  }

  return arr.map((item: any) =>
    typeof item === 'string' ? item : extractTextFromItem(item),
  );
}

export function normalizeAIResponse(parsed: any): any {
  if (parsed == null || typeof parsed !== 'object') return parsed;

  if (Array.isArray(parsed)) {
    return parsed.map(normalizeAIResponse);
  }

  const keys = Object.keys(parsed);
  if (keys.length === 1 && WRAPPER_KEYS.has(keys[0])) {
    const inner = parsed[keys[0]];
    if (inner != null && typeof inner === 'object') {
      return normalizeAIResponse(inner);
    }
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (Array.isArray(value)) {
      result[key] = value.map((item: any) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return normalizeAIResponse(item);
        }
        return item;
      });
    } else if (value && typeof value === 'object') {
      result[key] = normalizeAIResponse(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function flexibleStringArray() {
  return z
    .array(z.union([z.string(), z.object({}).passthrough()]))
    .transform((items) => items.map((item) =>
      typeof item === 'string' ? item : extractTextFromItem(item),
    ));
}

/**
 * Defensive JSON parsing for AI responses that may include markdown or malformed JSON
 */
export function parseAIJson(
  aiResponse: string,
  context: string = 'AI response',
  options?: { silent?: boolean },
): any {
  const silent = options?.silent === true;

  try {
    // Step 1: Clean markdown code blocks
    const cleanJson = stripMarkdownCodeFences(aiResponse);
    
    // Step 2: Try primary parsing
    return JSON.parse(cleanJson);
  } catch (primaryError) {
    logIfEnabled(silent, `[parseAIJson] Primary JSON parsing failed for ${context}:`, primaryError);
    
    // Step 3: Fallback - extract JSON from response using regex
    const jsonCandidate = extractJsonCandidate(aiResponse);
    if (jsonCandidate) {
      try {
        const extracted = JSON.parse(jsonCandidate);
        if (!silent) {
          console.log(`[parseAIJson] ✓ Fallback extraction succeeded for ${context}`);
        }
        return extracted;
      } catch (fallbackError) {
        logIfEnabled(silent, `[parseAIJson] Fallback parsing also failed for ${context}:`, fallbackError);
        if (!silent) {
          console.log(`[parseAIJson] Raw response (first 1500 chars):`, aiResponse.substring(0, 1500));
          console.log(`[parseAIJson] Raw response (last 500 chars):`, aiResponse.substring(Math.max(0, aiResponse.length - 500)));
        }
        
        // Step 4: Advanced repair - try to fix common JSON issues
        try {
          const repaired = repairLikelyJson(jsonCandidate);
          const repairedObj = JSON.parse(repaired);
          if (!silent) {
            console.log(`[parseAIJson] ✓ Advanced repair succeeded for ${context}`);
          }
          return repairedObj;
        } catch (repairError) {
          logIfEnabled(silent, `[parseAIJson] Advanced repair also failed:`, repairError);
        }
      }
    } else {
      logIfEnabled(silent, `[parseAIJson] No JSON object found in response for ${context}`);
      if (!silent) {
        console.log(`[parseAIJson] Raw response (first 500 chars):`, aiResponse.substring(0, 500));
      }
    }
    
    // Step 5: Throw error with detailed context
    throw new Error(`Failed to parse AI response for ${context}: ${primaryError instanceof Error ? primaryError.message : 'Unknown error'}`);
  }
}

/**
 * Attempt to parse and normalize JSON text.
 * Returns null if content is not parseable JSON (without throwing/logging noise).
 */
export function tryNormalizeJsonText(aiResponse: string, context: string = 'AI response'): string | null {
  if (!aiResponse || typeof aiResponse !== 'string' || aiResponse.trim().length === 0) {
    return null;
  }

  try {
    const parsed = parseAIJson(aiResponse, context, { silent: true });
    const normalized = normalizeAIResponse(parsed);
    return JSON.stringify(normalized);
  } catch {
    return null;
  }
}

export function parseAndValidate<T>(
  response: string,
  schema: z.ZodType<T, any, any>,
  context: string,
): T {
  const parsed = parseAIJson(response, context);

  const first = schema.safeParse(parsed);
  if (first.success) return first.data;

  const normalized = normalizeAIResponse(parsed);
  const second = schema.safeParse(normalized);
  if (second.success) return second.data;

  const issues = first.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  console.error(`[parseAndValidate] Validation failed for ${context}: ${issues}`);
  console.error(
    `[parseAndValidate] Parsed payload (first 500 chars):`,
    JSON.stringify(parsed).substring(0, 500),
  );

  throw new Error(`AI response validation failed for ${context}: ${issues}`);
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
