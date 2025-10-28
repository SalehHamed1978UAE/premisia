import { aiClients } from '../ai-clients.js';

export interface SanityCheckRequest {
  userInput: string;
}

export interface SanityIssue {
  type: 'legal_impossibility' | 'logical_contradiction' | 'unrealistic_claim' | 'critical_missing_info';
  severity: 'critical' | 'warning';
  message: string;
  suggestion?: string;
}

export interface SanityCheckResult {
  isValid: boolean;
  issues: SanityIssue[];
  reasoning: string;
  improvedFormulation?: string;
}

export class InitialSanityChecker {
  /**
   * Validate user's initial strategic input for obvious impossibilities and contradictions
   */
  async checkInput(request: SanityCheckRequest): Promise<SanityCheckResult> {
    const { userInput } = request;

    const prompt = this.buildSanityCheckPrompt(userInput);

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a strategic business advisor helping validate business ideas for feasibility. Always return valid JSON.',
        userMessage: prompt,
        maxTokens: 1500,
      });

      const result = this.parseResponse(response.content);
      
      console.log(`[InitialSanityChecker] Validated input:`, {
        isValid: result.isValid,
        issueCount: result.issues.length,
        provider: response.provider
      });

      return result;
    } catch (error) {
      console.error('[InitialSanityChecker] Validation error:', error);
      // On error, allow progression - don't block users
      return {
        isValid: true,
        issues: [],
        reasoning: 'Sanity check temporarily unavailable'
      };
    }
  }

  private buildSanityCheckPrompt(userInput: string): string {
    return `You are a strategic business advisor conducting an initial sanity check on a business idea.

**User's Business Idea:**
${userInput}

Check this idea for obvious red flags:

1. **Legal/Geographic Impossibilities**: Activities prohibited by law in the specified region (e.g., gambling in Saudi Arabia, cannabis in most countries, etc.)
2. **Logical Contradictions**: Mutually exclusive goals or internally contradictory statements
3. **Unrealistic Claims**: Physically impossible, technologically infeasible, or economically absurd scenarios
4. **Critical Missing Information**: So vague it's impossible to proceed (e.g., "I want to start a business")

**Classification Guidelines:**
- **Valid (isValid: true)**: Idea is feasible, even if challenging or risky. Let them proceed.
- **Invalid (isValid: false)**: ONLY for obvious impossibilities that make analysis pointless

**Important Notes:**
- Be permissive - most ideas should be valid even if ambitious
- Don't flag normal business risks or competition concerns
- Don't require perfect market research upfront
- Focus only on OBVIOUS impossibilities that would waste the user's time

Return your evaluation in this JSON format:
\`\`\`json
{
  "isValid": true | false,
  "issues": [
    {
      "type": "legal_impossibility" | "logical_contradiction" | "unrealistic_claim" | "critical_missing_info",
      "severity": "critical" | "warning",
      "message": "Brief explanation of the issue",
      "suggestion": "How they could reformulate this (optional)"
    }
  ],
  "reasoning": "Brief explanation of your assessment",
  "improvedFormulation": "A better way to frame their idea (optional, only for critical issues)"
}
\`\`\`

Be supportive but honest. Help them succeed by catching obvious problems early.`;
  }

  private parseResponse(content: string): SanityCheckResult {
    try {
      // Extract JSON from code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      
      const parsed = JSON.parse(jsonStr.trim());

      // Validate structure
      if (typeof parsed.isValid !== 'boolean') {
        throw new Error('Invalid isValid in response');
      }

      return {
        isValid: parsed.isValid,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        reasoning: parsed.reasoning || 'No reasoning provided',
        improvedFormulation: parsed.improvedFormulation || undefined
      };
    } catch (error) {
      console.error('[InitialSanityChecker] Failed to parse response:', error);
      console.error('[InitialSanityChecker] Response content:', content);
      
      // Fallback: allow progression
      return {
        isValid: true,
        issues: [],
        reasoning: 'Failed to parse sanity check response'
      };
    }
  }
}

export const initialSanityChecker = new InitialSanityChecker();
