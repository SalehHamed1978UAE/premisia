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
      const ontologyData = await executiveAgent.queryOntologyForDecision(
        task.context.entity,
        task.description
      );
      
      // Log ontology query as a decision
      await this.logDecision(
        `Queried ontology for ${task.context.entity} entity`,
        `Found ${ontologyData.rules.length} validation rules to guide implementation`,
        undefined,
        'high'
      );
    }

    // Analysis phase
    await executiveAgent.updatePhase('Analysis');
    const requirementsFulfilled: BuilderResponse['requirementsFulfilled'] = [];
    const decisions: BuilderResponse['decisions'] = [];
    
    // Analyze each requirement
    for (let i = 0; i < task.requirements.length; i++) {
      const requirement = task.requirements[i];
      
      // In production, this would use AI to determine if requirement can be met
      // For now, we simulate analysis
      const canMeet = this.analyzeRequirement(requirement, task.context);
      
      requirementsFulfilled.push({
        requirement,
        met: canMeet,
        notes: canMeet ? 'Implemented' : 'Requires additional context or capabilities',
      });

      if (canMeet) {
        await this.fulfillRequirement(i);
      }
    }

    // Implementation phase
    await executiveAgent.updatePhase('Implementation');

    // Generate approach description
    const metRequirements = requirementsFulfilled.filter(r => r.met);
    const unmetRequirements = requirementsFulfilled
      .filter(r => !r.met)
      .map(r => r.requirement);

    const approach = this.generateApproach(task, metRequirements.length, unmetRequirements);
    
    // Log approach decision
    const approachDecision = {
      decision: 'Selected implementation approach',
      rationale: approach,
    };
    decisions.push(approachDecision);
    await this.logDecision(
      approachDecision.decision,
      approachDecision.rationale,
      undefined,
      'high'
    );

    // Generate code artifacts
    const codeArtifacts = this.generateCode(task, metRequirements);
    
    // Log code generation decisions
    for (const artifact of codeArtifacts) {
      const codeDecision = {
        decision: `Created ${artifact.filePath}`,
        rationale: artifact.description,
      };
      decisions.push(codeDecision);
      await this.logDecision(
        codeDecision.decision,
        codeDecision.rationale,
        undefined,
        'medium'
      );
    }

    // Calculate confidence based on fulfillment
    const confidenceLevel = this.calculateConfidence(
      metRequirements.length,
      task.requirements.length
    );

    // Validation phase
    await executiveAgent.updatePhase('Validation');

    const response: BuilderResponse = {
      approach,
      code: codeArtifacts,
      confidenceLevel,
      requirementsFulfilled,
      unmetRequirements,
      decisions,
    };

    console.log('[BuilderAgent] Task processing complete');
    console.log('[BuilderAgent] Confidence:', confidenceLevel + '%');
    console.log('[BuilderAgent] Requirements met:', metRequirements.length, '/', task.requirements.length);

    return response;
  }

  /**
   * Analyze if a requirement can be met
   */
  private analyzeRequirement(requirement: string, context?: BuilderTask['context']): boolean {
    // In production, this would use AI to analyze feasibility
    // For demonstration, we use simple heuristics
    
    const lowerReq = requirement.toLowerCase();
    
    // Check for unsupported features
    if (lowerReq.includes('machine learning') || lowerReq.includes('ml model')) {
      return false;
    }
    
    if (lowerReq.includes('real-time streaming') && !context?.constraints?.includes('websocket')) {
      return false;
    }
    
    // Most standard requirements can be met
    return true;
  }

  /**
   * Generate approach description
   */
  private generateApproach(
    task: BuilderTask,
    metCount: number,
    unmet: string[]
  ): string {
    let approach = `Implementing ${task.description}. `;
    
    if (task.context?.constraints && task.context.constraints.length > 0) {
      approach += `Following constraints: ${task.context.constraints.join(', ')}. `;
    }
    
    approach += `Successfully addressed ${metCount} of ${task.requirements.length} requirements.`;
    
    if (unmet.length > 0) {
      approach += ` Deferred ${unmet.length} requirement(s) for future iteration.`;
    }
    
    return approach;
  }

  /**
   * Generate code artifacts based on fulfilled requirements
   */
  private generateCode(
    task: BuilderTask,
    metRequirements: BuilderResponse['requirementsFulfilled']
  ): BuilderResponse['code'] {
    // In production, this would use AI to generate actual code
    // For demonstration, we generate placeholder structure
    
    const artifacts: BuilderResponse['code'] = [];
    
    if (metRequirements.length > 0) {
      // Generate main implementation file
      const fileName = this.deriveFileName(task.description);
      
      artifacts.push({
        filePath: fileName,
        content: this.generatePlaceholderCode(task, metRequirements),
        description: `Implementation for ${task.description} addressing ${metRequirements.length} requirements`,
      });
      
      // If TypeScript types are required, generate types file
      if (task.requirements.some(r => r.toLowerCase().includes('typescript') || r.toLowerCase().includes('types'))) {
        artifacts.push({
          filePath: fileName.replace('.ts', '.types.ts'),
          content: '// TypeScript type definitions\n\nexport interface PlaceholderType {\n  // Generated types\n}\n',
          description: 'TypeScript type definitions',
        });
      }
    }
    
    return artifacts;
  }

  /**
   * Derive file name from task description
   */
  private deriveFileName(description: string): string {
    const normalized = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    return `shared/${normalized}.ts`;
  }

  /**
   * Generate placeholder code structure
   */
  private generatePlaceholderCode(
    task: BuilderTask,
    metRequirements: BuilderResponse['requirementsFulfilled']
  ): string {
    let code = '/**\n';
    code += ` * ${task.description}\n`;
    code += ' * \n';
    code += ' * Requirements implemented:\n';
    
    for (const req of metRequirements.filter(r => r.met)) {
      code += ` * - ${req.requirement}\n`;
    }
    
    code += ' */\n\n';
    code += '// Implementation placeholder\n';
    code += '// In production, AI would generate complete working code\n\n';
    code += 'export function placeholder() {\n';
    code += '  // Generated implementation\n';
    code += '}\n';
    
    return code;
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
