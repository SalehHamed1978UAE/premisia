import { aiClients } from '../ai-clients.js';

export interface WhyCandidate {
  level: number;
  candidate: string;
  previousWhys: string[];
  rootQuestion: string;
  sessionContext?: any;
}

export interface WhyIssue {
  type: 'causality' | 'relevance' | 'specificity' | 'evidence' | 'duplication' | 'contradiction' | 'circular';
  message: string;
  severity: 'critical' | 'warning';
}

export interface WhyEvaluation {
  verdict: 'acceptable' | 'needs_clarification' | 'invalid';
  issues: WhyIssue[];
  followUpQuestions: string[];
  improvedSuggestion?: string;
  reasoning: string;
}

export interface CoachingRequest {
  sessionId: string;
  rootQuestion: string;
  previousWhys: string[];
  candidate: string;
  userQuestion: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface CoachingResponse {
  guidance: string;
  suggestedRevision?: string;
}

export class FiveWhysCoach {
  /**
   * Validate a candidate "Why" statement
   */
  async validateWhy(request: WhyCandidate): Promise<WhyEvaluation> {
    const { level, candidate, previousWhys, rootQuestion } = request;

    const prompt = this.buildValidationPrompt(level, candidate, previousWhys, rootQuestion);

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a strategic thinking coach helping users conduct rigorous Five Whys root cause analysis. Always return valid JSON.',
        userMessage: prompt,
        maxTokens: 2000,
      });

      const evaluation = this.parseValidationResponse(response.content);
      
      console.log(`[FiveWhysCoach] Validated Why #${level}:`, {
        verdict: evaluation.verdict,
        issueCount: evaluation.issues.length,
        provider: response.provider
      });

      return evaluation;
    } catch (error) {
      console.error('[FiveWhysCoach] Validation error:', error);
      // On error, allow progression with warning
      return {
        verdict: 'needs_clarification',
        issues: [{
          type: 'evidence',
          message: 'Unable to fully validate this response. Please review it carefully.',
          severity: 'warning'
        }],
        followUpQuestions: ['Does this answer directly address the root cause?'],
        reasoning: 'Validation service temporarily unavailable'
      };
    }
  }

  /**
   * Provide interactive coaching to help user improve their answer
   */
  async provideCoaching(request: CoachingRequest): Promise<CoachingResponse> {
    const { rootQuestion, previousWhys, candidate, userQuestion, conversationHistory = [] } = request;

    const prompt = this.buildCoachingPrompt(
      rootQuestion,
      previousWhys,
      candidate,
      userQuestion,
      conversationHistory
    );

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a supportive strategic thinking coach. Help users improve their Five Whys analysis through conversational guidance. Always return valid JSON.',
        userMessage: prompt,
        maxTokens: 1500,
      });

      return this.parseCoachingResponse(response.content);
    } catch (error) {
      console.error('[FiveWhysCoach] Coaching error:', error);
      return {
        guidance: 'I\'m having trouble connecting right now. Try thinking about: What specific, controllable factor led to this situation? What evidence supports your answer?'
      };
    }
  }

  private buildValidationPrompt(
    level: number,
    candidate: string,
    previousWhys: string[],
    rootQuestion: string
  ): string {
    const previousContext = previousWhys.length > 0 
      ? `\n\nPrevious answers in this analysis:\n${previousWhys.map((w, i) => `Why #${i + 1}: ${w}`).join('\n')}`
      : '';

    return `You are a strategic thinking coach helping users conduct a rigorous Five Whys root cause analysis.

**Root Problem:** ${rootQuestion}${previousContext}

**Candidate Answer for Why #${level}:** ${candidate}

Evaluate this candidate answer against these criteria:

1. **Causality**: Does it identify a root CAUSE (not just restate the problem, describe a symptom, or jump to a solution)?
2. **Relevance**: Is it directly connected to ${previousWhys.length > 0 ? 'the previous answer' : 'the root problem'}?
3. **Specificity**: Is it concrete and specific (not vague like "bad management" or "lack of planning")?
4. **Evidence**: Is it grounded in reality (not pure speculation or wishful thinking)?
5. **Duplication**: Does it repeat what was already said in previous levels?
6. **Contradiction**: Does it contradict earlier answers in the chain?
7. **Circular Logic**: Does it create a circular loop (A causes B causes A)?

**Classification Guidelines:**
- **"acceptable"**: Advances the root cause analysis with a specific, causal, evidence-based answer
- **"needs_clarification"**: Could work but needs more detail, specificity, or evidence
- **"invalid"**: Off-topic, speculative, contradictory, circular, or just restating the problem/symptom

Return your evaluation in this JSON format:
\`\`\`json
{
  "verdict": "acceptable" | "needs_clarification" | "invalid",
  "issues": [
    {
      "type": "causality" | "relevance" | "specificity" | "evidence" | "duplication" | "contradiction" | "circular",
      "message": "Brief explanation of the issue",
      "severity": "critical" | "warning"
    }
  ],
  "followUpQuestions": [
    "Specific question to help user think deeper",
    "Another guiding question"
  ],
  "improvedSuggestion": "A better version of this answer (optional, only if you can suggest one)",
  "reasoning": "Brief explanation of your verdict"
}
\`\`\`

Focus on helping the user dig deeper into controllable, organizational root causes - not external factors or symptoms.`;
  }

  private buildCoachingPrompt(
    rootQuestion: string,
    previousWhys: string[],
    candidate: string,
    userQuestion: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): string {
    const previousContext = previousWhys.length > 0 
      ? `\nPrevious answers: ${previousWhys.map((w, i) => `Why #${i + 1}: ${w}`).join(' → ')}`
      : '';

    const historyContext = conversationHistory.length > 0
      ? `\n\nPrevious coaching conversation:\n${conversationHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Coach'}: ${msg.content}`).join('\n')}`
      : '';

    return `You are a strategic thinking coach helping a user refine their Five Whys analysis.

**Root Problem:** ${rootQuestion}${previousContext}

**Their current answer:** ${candidate}

**Their question to you:** ${userQuestion}${historyContext}

Provide helpful, conversational guidance that:
1. Addresses their specific question
2. Helps them think more deeply about root causes
3. Encourages evidence-based, specific thinking
4. Guides them toward controllable organizational factors
5. Keeps them on track (avoid letting them drift to symptoms or external factors)

If you can suggest a better phrasing of their answer, include it.

Return your response in this JSON format:
\`\`\`json
{
  "guidance": "Your conversational coaching response here",
  "suggestedRevision": "An improved version of their answer (optional)"
}
\`\`\`

Be supportive but direct. Keep responses concise (2-4 sentences).`;
  }

  private parseValidationResponse(content: string): WhyEvaluation {
    try {
      // Extract JSON from code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      
      const parsed = JSON.parse(jsonStr.trim());

      // Validate structure
      if (!parsed.verdict || !['acceptable', 'needs_clarification', 'invalid'].includes(parsed.verdict)) {
        throw new Error('Invalid verdict in response');
      }

      return {
        verdict: parsed.verdict,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions : [],
        improvedSuggestion: parsed.improvedSuggestion || undefined,
        reasoning: parsed.reasoning || 'No reasoning provided'
      };
    } catch (error) {
      console.error('[FiveWhysCoach] Failed to parse validation response:', error);
      console.error('[FiveWhysCoach] Response content:', content);
      
      // Fallback: allow with warning
      return {
        verdict: 'needs_clarification',
        issues: [{
          type: 'evidence',
          message: 'Unable to parse validation response. Please review carefully.',
          severity: 'warning'
        }],
        followUpQuestions: ['Is this answer specific and actionable?', 'What evidence supports this?'],
        reasoning: 'Failed to parse AI response'
      };
    }
  }

  private parseCoachingResponse(content: string): CoachingResponse {
    try {
      // Extract JSON from code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      
      const parsed = JSON.parse(jsonStr.trim());

      return {
        guidance: parsed.guidance || 'Try to be more specific about the root cause.',
        suggestedRevision: parsed.suggestedRevision || undefined
      };
    } catch (error) {
      console.error('[FiveWhysCoach] Failed to parse coaching response:', error);
      
      // Fallback: return content as-is if it's text
      if (typeof content === 'string' && content.trim().length > 0 && !content.includes('{')) {
        return { guidance: content.trim() };
      }

      return {
        guidance: 'Let me help you think this through: What specific factor within your organization\'s control led to this? What evidence do you have?'
      };
    }
  }
}

export const fiveWhysCoach = new FiveWhysCoach();
