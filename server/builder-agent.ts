/**
 * Builder Specialist Agent - Code generation agent for EPM system
 * 
 * Responsibilities:
 * - Accept tasks from Executive with explicit requirements
 * - Generate code solutions with explanations
 * - Report confidence level on solution quality
 * - Identify unmet requirements
 * - Log all decisions with rationale
 */

import { executiveAgent } from "./executive-agent";
import type { EPMEntity } from "@shared/ontology";

export interface BuilderTask {
  description: string;
  requirements: string[];
  context?: {
    entity?: EPMEntity;
    relatedFiles?: string[];
    constraints?: string[];
  };
}

export interface BuilderResponse {
  approach: string;
  code: {
    filePath: string;
    content: string;
    description: string;
  }[];
  confidenceLevel: number; // 0-100
  requirementsFulfilled: {
    requirement: string;
    met: boolean;
    notes?: string;
  }[];
  unmetRequirements: string[];
  decisions: {
    decision: string;
    rationale: string;
    alternatives?: string[];
  }[];
}

export class BuilderAgent {
  /**
   * Process a task from the Executive Agent
   */
  async processTask(task: BuilderTask): Promise<BuilderResponse> {
    console.log('[BuilderAgent] Processing task:', task.description);

    // Start session with ExecutiveAgent
    await executiveAgent.startSession({
      goal: task.description,
      successCriteria: task.requirements,
      currentPhase: 'Planning',
    });

    // Query ontology if entity context provided
    if (task.context?.entity) {
      await executiveAgent.updatePhase('Querying Ontology');
      await executiveAgent.queryOntologyForDecision(
        task.context.entity,
        task.description
      );
    }

    // Implementation phase
    await executiveAgent.updatePhase('Implementation');

    // This is a meta-agent that coordinates code generation
    // In production, this would integrate with actual AI code generation
    const response: BuilderResponse = {
      approach: '',
      code: [],
      confidenceLevel: 0,
      requirementsFulfilled: [],
      unmetRequirements: [],
      decisions: [],
    };

    console.log('[BuilderAgent] Task processing complete');

    return response;
  }

  /**
   * Log a decision to the active ExecutiveAgent session
   */
  async logDecision(
    decision: string,
    rationale: string,
    alternatives?: string[],
    confidence?: 'low' | 'medium' | 'high'
  ): Promise<void> {
    await executiveAgent.logDecision({
      decision,
      rationale,
      alternatives,
      confidence,
    });
  }

  /**
   * Mark a requirement as fulfilled
   */
  async fulfillRequirement(requirementIndex: number): Promise<void> {
    await executiveAgent.completeCriterion(requirementIndex);
  }

  /**
   * Calculate confidence level based on requirements fulfillment
   */
  calculateConfidence(requirementsFulfilled: number, totalRequirements: number): number {
    if (totalRequirements === 0) return 100;
    
    const fulfillmentRate = requirementsFulfilled / totalRequirements;
    
    if (fulfillmentRate === 1.0) return 95; // High confidence
    if (fulfillmentRate >= 0.8) return 75; // Medium-high confidence
    if (fulfillmentRate >= 0.6) return 60; // Medium confidence
    if (fulfillmentRate >= 0.4) return 40; // Low-medium confidence
    return 25; // Low confidence
  }

  /**
   * Validate task completion
   */
  async validateCompletion(): Promise<{
    allRequirementsMet: boolean;
    summary: string;
  }> {
    const validation = await executiveAgent.validateCompletion();
    const summary = await executiveAgent.getSessionSummary();

    return {
      allRequirementsMet: validation.allCriteriaMet,
      summary,
    };
  }

  /**
   * End the current task session
   */
  async endTask(): Promise<void> {
    await executiveAgent.endSession();
  }
}

// Singleton instance
export const builderAgent = new BuilderAgent();
