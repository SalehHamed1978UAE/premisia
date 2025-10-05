import type { IStorage } from "./storage";
import type { 
  OrchestratorTask, 
  OrchestratorResponse, 
  BuilderResponse, 
  QAReview,
  AIProvider,
} from "@shared/schema";
import { aiClients } from "./ai-clients";
import { ExecutiveAgent } from "./executive-agent";
import { ontologyService } from "./ontology-service";

export class Orchestrator {
  private storage: IStorage;
  private executiveAgent: ExecutiveAgent;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.executiveAgent = new ExecutiveAgent();
  }

  async processTask(task: OrchestratorTask): Promise<OrchestratorResponse> {
    // 1. START: Create executive session for orchestration
    const session = await this.executiveAgent.startSession({
      goal: `Orchestrate AI task: ${task.taskDescription}`,
      successCriteria: [
        "Select appropriate AI provider",
        ...task.requirements.map(r => `Builder satisfies: ${r}`),
        ...task.requirements.map(r => `QA verifies: ${r}`),
        "QA verdict is PASS"
      ],
      currentPhase: "Provider Selection"
    });

    try {
      // 2. SELECT PROVIDER: Choose AI provider
      const provider = aiClients.selectProvider(task.preferredProvider);
      await this.executiveAgent.logDecision({
        decision: `Selected AI provider: ${provider}`,
        rationale: `Provider ${provider} is available and ${task.preferredProvider ? 'matches user preference' : 'selected by default priority'}`,
        alternatives: task.preferredProvider ? [`Use ${task.preferredProvider}`] : ['Use OpenAI', 'Use Anthropic', 'Use Gemini'],
        confidence: 'high',
        ontologyRulesChecked: []
      });
      await this.executiveAgent.completeCriterion(0); // "Select appropriate AI provider"

      // 3. QUERY ONTOLOGY: Get validation rules if entity context provided
      let ontologyContext = "";
      if (task.entity) {
        await this.executiveAgent.updatePhase("Ontology Query");
        const validationRules = await ontologyService.getValidationRules({ entity: task.entity as any });
        const completeness = await ontologyService.getCompletenessChecks({ entity: task.entity as any });
        
        ontologyContext = `\n\nONTOLOGY CONTEXT for ${task.entity}:\n`;
        ontologyContext += `Validation Rules: ${JSON.stringify(validationRules, null, 2)}\n`;
        ontologyContext += `Completeness Criteria: ${JSON.stringify(completeness, null, 2)}`;
      }

      // 4. BUILDER → QA LOOP with retry logic
      let iteration = 0;
      let builderResponse: BuilderResponse | null = null;
      let qaReview: QAReview | null = null;

      while (iteration <= task.maxRetries) {
        iteration++;
        await this.executiveAgent.updatePhase(`Iteration ${iteration}: Builder`);

        // BUILDER: Generate code
        builderResponse = await this.runBuilder(
          provider,
          task,
          ontologyContext,
          qaReview // Pass previous QA feedback for retry
        );

        // Mark builder requirements in executive session
        const currentSession = await this.executiveAgent.getActiveSession();
        if (currentSession) {
          for (let i = 0; i < builderResponse.requirements.length; i++) {
            const req = builderResponse.requirements[i];
            if (req.satisfied) {
              const criterionIndex = currentSession.successCriteria.findIndex(
                c => c.includes(`Builder satisfies: ${req.requirement}`)
              );
              if (criterionIndex !== -1) {
                await this.executiveAgent.completeCriterion(criterionIndex);
              }
            }
          }
        }

        await this.executiveAgent.updatePhase(`Iteration ${iteration}: QA Review`);

        // QA: Review code
        qaReview = await this.runQA(
          provider,
          task.requirements,
          builderResponse
        );

        // Mark QA verification in executive session
        const sessionAfterQA = await this.executiveAgent.getActiveSession();
        if (sessionAfterQA) {
          for (let i = 0; i < qaReview.requirementsVerification.length; i++) {
            const verification = qaReview.requirementsVerification[i];
            if (verification.satisfied) {
              const criterionIndex = sessionAfterQA.successCriteria.findIndex(
                c => c.includes(`QA verifies: ${verification.requirement}`)
              );
              if (criterionIndex !== -1) {
                await this.executiveAgent.completeCriterion(criterionIndex);
              }
            }
          }
        }

        // Check if PASS
        if (qaReview.verdict === "PASS") {
          const passSession = await this.executiveAgent.getActiveSession();
          if (passSession) {
            const passCriterionIndex = passSession.successCriteria.findIndex(
              c => c.includes("QA verdict is PASS")
            );
            if (passCriterionIndex !== -1) {
              await this.executiveAgent.completeCriterion(passCriterionIndex);
            }
          }
          
          await this.executiveAgent.logDecision({
            decision: `QA approved code on iteration ${iteration}`,
            rationale: `All requirements verified with ${qaReview.confidence}% confidence`,
            alternatives: [`Retry up to ${task.maxRetries} times`],
            confidence: qaReview.confidence >= 80 ? 'high' : qaReview.confidence >= 50 ? 'medium' : 'low',
            ontologyRulesChecked: []
          });
          break;
        }

        // If FAIL and no more retries, stop
        if (iteration > task.maxRetries) {
          await this.executiveAgent.logDecision({
            decision: `QA rejected code after ${iteration} iterations - max retries exceeded`,
            rationale: `Critical blockers: ${qaReview.criticalBlockers.join(", ")}`,
            alternatives: [`Continue retrying`],
            confidence: 'high',
            ontologyRulesChecked: []
          });
          break;
        }

        // Log retry decision
        await this.executiveAgent.logDecision({
          decision: `QA rejected code on iteration ${iteration} - retrying`,
          rationale: `Issues found: ${qaReview.issues.length} (${qaReview.criticalBlockers.length} critical). Retrying with QA feedback.`,
          alternatives: [`Accept code anyway`, `Stop and report failure`],
          confidence: 'medium',
          ontologyRulesChecked: []
        });
      }

      // 5. FINALIZE: Prepare response
      const response: OrchestratorResponse = {
        taskId: session.id,
        builderResponse: builderResponse!,
        qaReview: qaReview!,
        verdict: qaReview!.verdict,
        iterations: iteration,
        finalCode: qaReview!.verdict === "PASS" ? builderResponse!.artifacts : undefined,
        provider,
        timestamp: new Date().toISOString(),
      };

      // 6. END SESSION: Validate completion
      const validation = await this.executiveAgent.validateCompletion();
      if (validation.allCriteriaMet) {
        await this.executiveAgent.endSession();
      }

      return response;

    } catch (error) {
      // Log error and end session
      await this.executiveAgent.logDecision({
        decision: `Orchestration failed with error`,
        rationale: error instanceof Error ? error.message : String(error),
        alternatives: [],
        confidence: 'high',
        ontologyRulesChecked: []
      });

      // Return error response
      return {
        taskId: session.id,
        builderResponse: {
          approach: "",
          artifacts: [],
          confidence: 0,
          requirements: task.requirements.map(r => ({
            requirement: r,
            satisfied: false,
            notes: "Error occurred before builder execution"
          })),
          unmetRequirements: task.requirements,
          decisions: []
        },
        qaReview: {
          verdict: "FAIL",
          confidence: 100,
          requirementsVerification: task.requirements.map(r => ({
            requirement: r,
            satisfied: false,
            notes: "Error occurred"
          })),
          issues: [{
            category: "gap",
            severity: "critical",
            description: error instanceof Error ? error.message : String(error),
            recommendation: "Fix the error and try again"
          }],
          criticalBlockers: ["System error occurred"],
          recommendations: [],
          summary: "Orchestration failed due to system error"
        },
        verdict: "FAIL",
        iterations: 0,
        provider: task.preferredProvider || "openai",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async runBuilder(
    provider: AIProvider,
    task: OrchestratorTask,
    ontologyContext: string,
    previousQA?: QAReview | null
  ): Promise<BuilderResponse> {
    // Construct Builder prompt
    const systemPrompt = `You are a code generation specialist. Your task is to:
1. Analyze requirements thoroughly
2. Generate clean, production-ready code
3. Provide clear explanations
4. Track requirement fulfillment

${ontologyContext}

Return your response as JSON matching this schema:
{
  "approach": "string - your implementation strategy",
  "artifacts": [{
    "filePath": "string",
    "content": "string - actual code",
    "description": "string"
  }],
  "confidence": number (0-100),
  "requirements": [{
    "requirement": "string",
    "satisfied": boolean,
    "notes": "string"
  }],
  "unmetRequirements": ["string"],
  "decisions": [{
    "decision": "string",
    "rationale": "string",
    "alternatives": ["string"],
    "confidence": number (0-100)
  }]
}`;

    let userMessage = `TASK: ${task.taskDescription}\n\nREQUIREMENTS:\n`;
    task.requirements.forEach((req, i) => {
      userMessage += `${i + 1}. ${req}\n`;
    });

    if (task.constraints && task.constraints.length > 0) {
      userMessage += `\nCONSTRAINTS:\n`;
      task.constraints.forEach((constraint, i) => {
        userMessage += `${i + 1}. ${constraint}\n`;
      });
    }

    if (previousQA) {
      userMessage += `\n\nPREVIOUS QA FEEDBACK (iteration failed, fix these issues):\n`;
      userMessage += `Verdict: ${previousQA.verdict}\n`;
      userMessage += `Critical Blockers:\n${previousQA.criticalBlockers.map(b => `- ${b}`).join('\n')}\n`;
      userMessage += `Issues:\n${previousQA.issues.map(i => `- [${i.severity}] ${i.description}: ${i.recommendation}`).join('\n')}`;
    }

    userMessage += `\n\nGenerate the code now. Return valid JSON only.`;

    // Call AI
    const response = await aiClients.call(provider, {
      systemPrompt,
      userMessage,
      maxTokens: 8192,
    });

    // Parse JSON response
    const builderResponse: BuilderResponse = JSON.parse(response.content);
    return builderResponse;
  }

  private async runQA(
    provider: AIProvider,
    originalRequirements: string[],
    builderResponse: BuilderResponse
  ): Promise<QAReview> {
    // Construct QA prompt with adversarial stance
    const systemPrompt = `You are an adversarial code reviewer. Your job is to:
1. DEFAULT TO REJECTION - Assume code is incomplete until proven otherwise
2. Independently verify EVERY requirement with strong evidence
3. Search for gaps, bugs, edge cases, security issues
4. Apply strict criteria: FAIL if ANY requirement unsatisfied OR critical/major issues exist
5. PASS only if ALL requirements verified AND no critical/major issues

Return your response as JSON matching this schema:
{
  "verdict": "PASS" | "FAIL",
  "confidence": number (0-100),
  "requirementsVerification": [{
    "requirement": "string",
    "satisfied": boolean,
    "notes": "string - evidence or reason"
  }],
  "issues": [{
    "category": "gap" | "bug" | "edge-case" | "security" | "quality",
    "severity": "critical" | "major" | "minor",
    "description": "string",
    "location": "string - optional",
    "recommendation": "string"
  }],
  "criticalBlockers": ["string - list of must-fix issues"],
  "recommendations": ["string"],
  "summary": "string - detailed rationale for verdict"
}`;

    const userMessage = `ORIGINAL REQUIREMENTS:\n${originalRequirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

BUILDER'S RESPONSE:
Approach: ${builderResponse.approach}
Confidence: ${builderResponse.confidence}%
Builder's Requirement Assessment: ${JSON.stringify(builderResponse.requirements, null, 2)}

CODE ARTIFACTS:
${builderResponse.artifacts.map(a => `File: ${a.filePath}\n${a.content}\n---`).join('\n')}

Review this code with an adversarial mindset. Do NOT trust the builder's self-assessment. Independently verify each requirement. Return valid JSON only.`;

    // Call AI
    const response = await aiClients.call(provider, {
      systemPrompt,
      userMessage,
      maxTokens: 8192,
    });

    // Parse JSON response
    const qaReview: QAReview = JSON.parse(response.content);
    return qaReview;
  }
}
