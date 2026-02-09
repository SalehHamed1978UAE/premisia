/**
 * Executive Agent - Behavioral workflow system for goal-driven task execution
 * 
 * This module provides utilities for:
 * - Creating and managing SessionContext
 * - Querying ontology before decisions
 * - Logging decisions with rationale
 * - Validating task completion against criteria
 */

import { storage } from "./storage";
import { ontologyService } from "./ontology-service";
import type { SessionContext } from "@shared/schema";
import type { EPMEntity } from "@shared/ontology";

interface ExecutiveDecision {
  decision: string;
  rationale: string;
  ontologyRulesChecked?: string[];
  alternatives?: string[];
  confidence?: 'low' | 'medium' | 'high';
}

interface TaskCriteria {
  goal: string;
  successCriteria: string[];
  currentPhase?: string;
}

export class ExecutiveAgent {
  private activeSessionId: string | null = null;

  /**
   * Start a new work session with explicit goal and success criteria
   */
  async startSession(criteria: TaskCriteria): Promise<SessionContext> {
    console.log('[ExecutiveAgent] Starting new session:', criteria.goal);
    
    const session = await storage.createSessionContext({
      goal: criteria.goal,
      successCriteria: criteria.successCriteria,
      currentPhase: criteria.currentPhase || 'Planning',
      decisionsLog: [],
    });

    this.activeSessionId = session.id;
    
    console.log('[ExecutiveAgent] Session created:', session.id);
    console.log('[ExecutiveAgent] Success criteria:', criteria.successCriteria);
    
    return session;
  }

  /**
   * Get the currently active session for this ExecutiveAgent instance
   */
  async getActiveSession(): Promise<SessionContext | undefined> {
    if (!this.activeSessionId) {
      return undefined;
    }
    // Get the specific session this agent is tracking by ID
    return await storage.getSessionContextById(this.activeSessionId);
  }

  /**
   * Update current phase of work
   */
  async updatePhase(phase: string): Promise<void> {
    if (!this.activeSessionId) {
      console.warn('[ExecutiveAgent] No active session to update phase');
      return;
    }

    await storage.updateSessionContext(this.activeSessionId, { currentPhase: phase });
    console.log('[ExecutiveAgent] Phase updated:', phase);
  }

  /**
   * Query ontology for relevant validation rules before making a decision
   */
  async queryOntologyForDecision(
    entity: EPMEntity,
    context: string
  ): Promise<{ rules: any[]; recommendations: string[] }> {
    console.log('[ExecutiveAgent] Querying ontology for:', entity, 'context:', context);
    
    // Get validation rules for the entity
    const rules = await ontologyService.getValidationRules({
      entity,
      enabled: true,
    });

    // Get completeness checks
    const completeness = await ontologyService.getCompletenessChecks({
      entity,
      enabled: true,
    });

    // Extract recommendations from rules
    const recommendations: string[] = [];
    
    for (const rule of rules) {
      if (rule.severity === 'error' || rule.severity === 'critical') {
        recommendations.push(`${rule.rule}: ${rule.validation}`);
      }
    }

    for (const check of completeness) {
      if (check.importance === 'critical' || check.importance === 'required') {
        recommendations.push(`Completeness: ${check.description}`);
      }
    }

    console.log('[ExecutiveAgent] Found', rules.length, 'rules and', recommendations.length, 'recommendations');
    
    return { rules, recommendations };
  }

  /**
   * Log a decision with rationale to the active session
   */
  async logDecision(decision: ExecutiveDecision): Promise<void> {
    if (!this.activeSessionId) {
      console.warn('[ExecutiveAgent] No active session to log decision');
      return;
    }

    console.log('[ExecutiveAgent] Logging decision:', decision.decision);
    
    await storage.addDecisionToContext(this.activeSessionId, {
      decision: decision.decision,
      rationale: decision.rationale,
      ontologyRulesChecked: decision.ontologyRulesChecked,
      alternatives: decision.alternatives,
      confidence: decision.confidence,
    });
  }

  /**
   * Mark a success criterion as complete
   */
  async completeCriterion(criterionIndex: number): Promise<void> {
    const session = await this.getActiveSession();
    if (!session || !this.activeSessionId) {
      console.warn('[ExecutiveAgent] No active session to complete criterion');
      return;
    }

    const updatedCriteria = [...session.successCriteria];
    if (criterionIndex >= 0 && criterionIndex < updatedCriteria.length) {
      const criterion = updatedCriteria[criterionIndex];
      if (!criterion.startsWith('✓ ')) {
        updatedCriteria[criterionIndex] = `✓ ${criterion}`;
        await storage.updateSessionContext(this.activeSessionId, { successCriteria: updatedCriteria });
        console.log('[ExecutiveAgent] Completed criterion:', criterion);
      }
    }
  }

  /**
   * Check if all success criteria are met before task completion
   */
  async validateCompletion(): Promise<{
    allCriteriaMet: boolean;
    totalCriteria: number;
    completedCriteria: number;
    remainingCriteria: string[];
  }> {
    const session = await this.getActiveSession();
    if (!session || !this.activeSessionId) {
      console.warn('[ExecutiveAgent] No active session for validation - treating as incomplete');
      return {
        allCriteriaMet: false, // No session = cannot validate
        totalCriteria: 0,
        completedCriteria: 0,
        remainingCriteria: ['No active session'],
      };
    }

    const completed = session.successCriteria.filter(c => c.startsWith('✓ '));
    const remaining = session.successCriteria.filter(c => !c.startsWith('✓ '));

    const result = {
      allCriteriaMet: remaining.length === 0,
      totalCriteria: session.successCriteria.length,
      completedCriteria: completed.length,
      remainingCriteria: remaining,
    };

    console.log('[ExecutiveAgent] Validation result:', result);
    
    return result;
  }

  /**
   * Query ontology to validate output quality before completion
   */
  async validateOutputQuality(
    entity: EPMEntity,
    outputData: any
  ): Promise<{ isValid: boolean; issues: string[]; warnings: string[] }> {
    console.log('[ExecutiveAgent] Validating output quality for:', entity);
    
    const validation = await ontologyService.validateEntityData(entity, outputData);
    
    const issues = validation.errors.map(e => e.message);
    const warnings = validation.warnings.map(w => w.message);

    console.log('[ExecutiveAgent] Validation:', {
      isValid: validation.isValid,
      issues: issues.length,
      warnings: warnings.length,
    });

    return {
      isValid: validation.isValid,
      issues,
      warnings,
    };
  }

  /**
   * End the current session
   */
  async endSession(): Promise<void> {
    if (!this.activeSessionId) {
      console.warn('[ExecutiveAgent] No active session to end');
      return;
    }

    const sessionId = this.activeSessionId;
    await storage.deactivateSessionContext(sessionId);
    this.activeSessionId = null;
    
    console.log('[ExecutiveAgent] Session ended:', sessionId);
  }

  /**
   * Get session summary for reporting
   */
  async getSessionSummary(): Promise<string> {
    const session = await this.getActiveSession();
    if (!session) {
      return 'No active session';
    }

    const completed = session.successCriteria.filter(c => c.startsWith('✓ ')).length;
    const total = session.successCriteria.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    const decisionsLog = (session.decisionsLog as any[]) || [];

    return `
Session: ${session.goal}
Progress: ${completed}/${total} criteria (${percentage}%)
Phase: ${session.currentPhase || 'Unknown'}
Decisions logged: ${decisionsLog.length}
Created: ${session.createdAt ? new Date(session.createdAt).toLocaleString() : 'Unknown'}
    `.trim();
  }
}

// Singleton instance
export const executiveAgent = new ExecutiveAgent();
