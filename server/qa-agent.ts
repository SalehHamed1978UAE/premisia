/**
 * QA Specialist Agent - Adversarial code reviewer for EPM system
 * 
 * Responsibilities:
 * - Review BuilderResponse against original requirements
 * - Actively search for gaps, bugs, edge cases, security issues
 * - Default stance: REJECT unless proven complete
 * - Only approve when ALL requirements verifiably satisfied
 * - Log all review decisions with detailed rationale
 */

import { executiveAgent } from "./executive-agent";
import type { BuilderResponse } from "./builder-agent";

export interface QAReviewRequest {
  builderResponse: BuilderResponse;
  originalRequirements: string[];
  context?: {
    securityLevel?: 'standard' | 'high' | 'critical';
    performanceRequired?: boolean;
    productionReady?: boolean;
  };
}

export interface QAIssue {
  severity: 'critical' | 'major' | 'minor';
  category: 'gap' | 'bug' | 'edge-case' | 'security' | 'quality';
  requirement?: string;
  description: string;
  evidence: string;
  recommendation?: string;
}

export interface QAReview {
  verdict: 'PASS' | 'FAIL';
  overallConfidence: number; // 0-100, QA's confidence in the verdict
  requirementsVerification: {
    requirement: string;
    satisfied: boolean;
    evidence: string;
    gaps?: string[];
  }[];
  issues: QAIssue[];
  criticalBlockers: string[]; // Issues that MUST be fixed
  recommendations: string[];
  reviewSummary: string;
  decisions: {
    decision: string;
    rationale: string;
  }[];
}

export class QAAgent {
  /**
   * Review BuilderResponse with adversarial stance
   * Default: REJECT unless proven complete
   */
  async reviewCode(request: QAReviewRequest): Promise<QAReview> {
    console.log('[QAAgent] Starting adversarial code review');

    // Start ExecutiveAgent session
    const reviewCriteria = [
      'Verify all requirements are satisfied',
      'Identify gaps in implementation',
      'Find potential bugs and edge cases',
      'Check for security vulnerabilities',
      'Assess code quality and completeness',
      'Make final verdict (PASS/FAIL)',
    ];

    await executiveAgent.startSession({
      goal: 'QA Review: Adversarial assessment of BuilderResponse',
      successCriteria: reviewCriteria,
      currentPhase: 'Planning',
    });

    await executiveAgent.updatePhase('Requirements Verification');

    // Verify each requirement - ADVERSARIAL by default
    const requirementsVerification = await this.verifyRequirements(
      request.builderResponse,
      request.originalRequirements
    );

    await executiveAgent.completeCriterion(0); // Verify requirements

    await executiveAgent.updatePhase('Gap Analysis');

    // Find gaps in implementation
    const gaps = await this.findGaps(
      request.builderResponse,
      request.originalRequirements
    );

    await executiveAgent.completeCriterion(1); // Identify gaps

    await executiveAgent.updatePhase('Bug Detection');

    // Find potential bugs
    const bugs = await this.findBugs(request.builderResponse);

    await executiveAgent.completeCriterion(2); // Find bugs

    await executiveAgent.updatePhase('Security Analysis');

    // Check security issues
    const securityIssues = await this.findSecurityIssues(
      request.builderResponse,
      request.context?.securityLevel || 'standard'
    );

    await executiveAgent.completeCriterion(3); // Check security

    await executiveAgent.updatePhase('Quality Assessment');

    // Check code quality
    const qualityIssues = await this.assessQuality(request.builderResponse);

    await executiveAgent.completeCriterion(4); // Assess quality

    // Collect all issues
    const allIssues: QAIssue[] = [...gaps, ...bugs, ...securityIssues, ...qualityIssues];

    // Identify critical blockers
    const criticalBlockers = allIssues
      .filter(i => i.severity === 'critical')
      .map(i => i.description);

    // Count unsatisfied requirements
    const unsatisfiedRequirements = requirementsVerification.filter(
      r => !r.satisfied
    );

    await executiveAgent.updatePhase('Verdict Decision');

    // ADVERSARIAL DECISION LOGIC
    // Default: FAIL unless ALL requirements satisfied AND no critical issues
    let verdict: 'PASS' | 'FAIL' = 'FAIL';
    let verdictRationale = '';

    if (unsatisfiedRequirements.length > 0) {
      verdict = 'FAIL';
      verdictRationale = `REJECTED: ${unsatisfiedRequirements.length} requirement(s) not satisfied. All requirements must be met.`;
    } else if (criticalBlockers.length > 0) {
      verdict = 'FAIL';
      verdictRationale = `REJECTED: ${criticalBlockers.length} critical blocker(s) found. Must fix before approval.`;
    } else if (allIssues.filter(i => i.severity === 'major').length > 0) {
      verdict = 'FAIL';
      verdictRationale = `REJECTED: Major issues found that compromise quality or functionality.`;
    } else {
      // Only approve if truly complete
      verdict = 'PASS';
      verdictRationale = `APPROVED: All requirements satisfied, no critical or major issues found.`;
    }

    // Log verdict decision
    await executiveAgent.logDecision({
      decision: `Verdict: ${verdict}`,
      rationale: verdictRationale,
      confidence: verdict === 'FAIL' ? 'high' : 'medium',
    });

    await executiveAgent.completeCriterion(5); // Make verdict

    // Calculate confidence in verdict (high confidence in rejections)
    const overallConfidence = this.calculateVerdictConfidence(
      verdict,
      requirementsVerification,
      allIssues
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      allIssues,
      unsatisfiedRequirements
    );

    // Generate summary
    const reviewSummary = this.generateSummary(
      verdict,
      requirementsVerification,
      allIssues,
      criticalBlockers
    );

    // Collect all decisions made during review
    const decisions: QAReview['decisions'] = [];

    const review: QAReview = {
      verdict,
      overallConfidence,
      requirementsVerification,
      issues: allIssues,
      criticalBlockers,
      recommendations,
      reviewSummary,
      decisions,
    };

    console.log('[QAAgent] Review complete');
    console.log('[QAAgent] Verdict:', verdict);
    console.log('[QAAgent] Issues found:', allIssues.length);
    console.log('[QAAgent] Critical blockers:', criticalBlockers.length);

    await executiveAgent.endSession();

    return review;
  }

  /**
   * Verify each requirement with adversarial stance
   * Assumption: NOT satisfied until proven otherwise
   */
  private async verifyRequirements(
    response: BuilderResponse,
    requirements: string[]
  ): Promise<QAReview['requirementsVerification']> {
    const verification: QAReview['requirementsVerification'] = [];

    for (const requirement of requirements) {
      // Check if BuilderResponse claims it's fulfilled
      const builderClaim = response.requirementsFulfilled.find(
        r => r.requirement === requirement
      );

      // ADVERSARIAL: Don't trust builder's self-assessment
      // Verify independently
      const actuallyMet = this.independentlyVerifyRequirement(
        requirement,
        response,
        builderClaim
      );

      const gaps: string[] = [];

      if (!actuallyMet) {
        gaps.push('Implementation not found in code artifacts');

        if (builderClaim?.met) {
          gaps.push('Builder claims fulfilled but code does not demonstrate it');
        }
      }

      verification.push({
        requirement,
        satisfied: actuallyMet,
        evidence: actuallyMet
          ? `Verified in ${response.code.length} code artifact(s)`
          : 'No evidence found in implementation',
        gaps: gaps.length > 0 ? gaps : undefined,
      });

      // Log each verification decision
      await executiveAgent.logDecision({
        decision: `Requirement "${requirement}": ${actuallyMet ? 'SATISFIED' : 'NOT SATISFIED'}`,
        rationale: actuallyMet
          ? 'Code artifacts demonstrate implementation'
          : gaps.join('; '),
        confidence: actuallyMet ? 'medium' : 'high',
      });
    }

    return verification;
  }

  /**
   * Independently verify requirement (don't trust builder)
   */
  private independentlyVerifyRequirement(
    requirement: string,
    response: BuilderResponse,
    builderClaim?: BuilderResponse['requirementsFulfilled'][0]
  ): boolean {
    // If builder explicitly says it's unmet, believe that
    if (builderClaim && !builderClaim.met) {
      return false;
    }

    // If no code generated, requirement cannot be met
    if (response.code.length === 0) {
      return false;
    }

    // Check if requirement keywords appear in code
    const requirementKeywords = this.extractKeywords(requirement);
    const codeContent = response.code.map(c => c.content).join('\n').toLowerCase();

    // ADVERSARIAL: Require strong evidence
    const hasEvidence = requirementKeywords.some(keyword =>
      codeContent.includes(keyword.toLowerCase())
    );

    // If builder has low confidence, be skeptical
    if (response.confidenceLevel < 70) {
      return false;
    }

    return hasEvidence;
  }

  /**
   * Extract keywords from requirement
   */
  private extractKeywords(requirement: string): string[] {
    const words = requirement.toLowerCase().split(/\s+/);
    // Filter out common words, keep technical terms
    return words.filter(
      w => w.length > 3 && !['the', 'and', 'with', 'from', 'that', 'this'].includes(w)
    );
  }

  /**
   * Find gaps in implementation
   */
  private async findGaps(
    response: BuilderResponse,
    requirements: string[]
  ): Promise<QAIssue[]> {
    const gaps: QAIssue[] = [];

    // Check for unmet requirements
    for (const unmet of response.unmetRequirements) {
      gaps.push({
        severity: 'critical',
        category: 'gap',
        requirement: unmet,
        description: `Requirement not implemented: ${unmet}`,
        evidence: `Builder explicitly reported as unmet`,
        recommendation: 'Implement missing requirement before approval',
      });

      await executiveAgent.logDecision({
        decision: `Gap identified: ${unmet}`,
        rationale: 'Builder reported requirement as unmet',
        confidence: 'high',
      });
    }

    // Check for incomplete code
    if (response.code.length === 0) {
      gaps.push({
        severity: 'critical',
        category: 'gap',
        description: 'No code artifacts generated',
        evidence: 'BuilderResponse.code array is empty',
        recommendation: 'Generate actual implementation code',
      });
    }

    // Check for placeholder/stub code
    for (const artifact of response.code) {
      if (
        artifact.content.includes('placeholder') ||
        artifact.content.includes('TODO') ||
        artifact.content.includes('stub') ||
        artifact.content.includes('// Implementation')
      ) {
        gaps.push({
          severity: 'major',
          category: 'gap',
          description: `Incomplete implementation in ${artifact.filePath}`,
          evidence: 'Code contains placeholders or TODOs',
          recommendation: 'Replace placeholders with working implementation',
        });
      }
    }

    return gaps;
  }

  /**
   * Find potential bugs
   */
  private async findBugs(response: BuilderResponse): Promise<QAIssue[]> {
    const bugs: QAIssue[] = [];

    for (const artifact of response.code) {
      const content = artifact.content;

      // Check for common bug patterns
      if (content.includes('any') && content.includes('type')) {
        bugs.push({
          severity: 'minor',
          category: 'quality',
          description: `Weak typing detected in ${artifact.filePath}`,
          evidence: 'Use of "any" type reduces type safety',
          recommendation: 'Use specific types instead of "any"',
        });
      }

      // Check for missing error handling
      if (content.includes('async') && !content.includes('try') && !content.includes('catch')) {
        bugs.push({
          severity: 'major',
          category: 'bug',
          description: `Missing error handling in ${artifact.filePath}`,
          evidence: 'Async function without try-catch',
          recommendation: 'Add proper error handling for async operations',
        });
      }

      // Check for hardcoded values
      if (content.match(/["']\d+["']/) || content.match(/=\s*\d{3,}/)) {
        bugs.push({
          severity: 'minor',
          category: 'quality',
          description: `Potential magic numbers in ${artifact.filePath}`,
          evidence: 'Hardcoded numeric values found',
          recommendation: 'Use named constants for magic numbers',
        });
      }
    }

    return bugs;
  }

  /**
   * Find security issues
   */
  private async findSecurityIssues(
    response: BuilderResponse,
    securityLevel: 'standard' | 'high' | 'critical'
  ): Promise<QAIssue[]> {
    const issues: QAIssue[] = [];

    for (const artifact of response.code) {
      const content = artifact.content.toLowerCase();

      // Check for SQL injection risks
      if (content.includes('sql') && content.includes('${')) {
        issues.push({
          severity: 'critical',
          category: 'security',
          description: `SQL injection risk in ${artifact.filePath}`,
          evidence: 'String interpolation in SQL query',
          recommendation: 'Use parameterized queries',
        });
      }

      // Check for eval usage
      if (content.includes('eval(')) {
        issues.push({
          severity: 'critical',
          category: 'security',
          description: `Dangerous eval() usage in ${artifact.filePath}`,
          evidence: 'eval() can execute arbitrary code',
          recommendation: 'Remove eval() and use safe alternatives',
        });
      }

      // Check for exposed secrets
      if (content.match(/api[_-]?key|secret|password|token/i) && content.includes('=')) {
        issues.push({
          severity: 'critical',
          category: 'security',
          description: `Potential hardcoded secret in ${artifact.filePath}`,
          evidence: 'Keywords suggesting secret/key assignment',
          recommendation: 'Use environment variables for secrets',
        });
      }

      // High security level checks
      if (securityLevel === 'high' || securityLevel === 'critical') {
        // Check for missing input validation
        if (!content.includes('validate') && !content.includes('zod') && !content.includes('schema')) {
          issues.push({
            severity: 'major',
            category: 'security',
            description: `Missing input validation in ${artifact.filePath}`,
            evidence: 'No validation keywords found',
            recommendation: 'Add input validation using Zod schemas',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Assess code quality
   */
  private async assessQuality(response: BuilderResponse): Promise<QAIssue[]> {
    const issues: QAIssue[] = [];

    // Check confidence level
    if (response.confidenceLevel < 80) {
      issues.push({
        severity: 'major',
        category: 'quality',
        description: `Builder has low confidence: ${response.confidenceLevel}%`,
        evidence: 'Confidence below 80% threshold',
        recommendation: 'Address uncertainty before approval',
      });
    }

    // Check for missing documentation
    for (const artifact of response.code) {
      const hasDocumentation = artifact.content.includes('/**') || artifact.content.includes('//');

      if (!hasDocumentation && artifact.content.split('\n').length > 20) {
        issues.push({
          severity: 'minor',
          category: 'quality',
          description: `Missing documentation in ${artifact.filePath}`,
          evidence: 'No comments found in substantial code file',
          recommendation: 'Add JSDoc comments for functions and complex logic',
        });
      }
    }

    return issues;
  }

  /**
   * Calculate confidence in verdict
   * High confidence in rejections, medium confidence in approvals
   */
  private calculateVerdictConfidence(
    verdict: 'PASS' | 'FAIL',
    verification: QAReview['requirementsVerification'],
    issues: QAIssue[]
  ): number {
    if (verdict === 'FAIL') {
      // High confidence in rejections (found clear problems)
      const criticalIssues = issues.filter(i => i.severity === 'critical').length;
      if (criticalIssues > 0) return 95;

      const unsatisfied = verification.filter(r => !r.satisfied).length;
      if (unsatisfied > 0) return 90;

      return 85; // Major issues
    } else {
      // Medium confidence in approvals (harder to be certain)
      const minorIssues = issues.filter(i => i.severity === 'minor').length;
      if (minorIssues > 2) return 70;
      if (minorIssues > 0) return 80;
      return 85; // Clean code
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    issues: QAIssue[],
    unsatisfiedRequirements: QAReview['requirementsVerification']
  ): string[] {
    const recommendations: string[] = [];

    // Recommendations for unsatisfied requirements
    for (const req of unsatisfiedRequirements) {
      recommendations.push(`Implement missing requirement: ${req.requirement}`);
    }

    // Recommendations from critical issues
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    for (const issue of criticalIssues) {
      if (issue.recommendation) {
        recommendations.push(`[CRITICAL] ${issue.recommendation}`);
      }
    }

    // General recommendations
    const majorIssues = issues.filter(i => i.severity === 'major');
    if (majorIssues.length > 0) {
      recommendations.push(`Address ${majorIssues.length} major issue(s) before resubmission`);
    }

    return recommendations;
  }

  /**
   * Generate review summary
   */
  private generateSummary(
    verdict: 'PASS' | 'FAIL',
    verification: QAReview['requirementsVerification'],
    issues: QAIssue[],
    criticalBlockers: string[]
  ): string {
    const satisfied = verification.filter(r => r.satisfied).length;
    const total = verification.length;

    let summary = `QA Review Result: ${verdict}\n\n`;
    summary += `Requirements: ${satisfied}/${total} satisfied\n`;
    summary += `Issues found: ${issues.length} (${issues.filter(i => i.severity === 'critical').length} critical, ${issues.filter(i => i.severity === 'major').length} major, ${issues.filter(i => i.severity === 'minor').length} minor)\n\n`;

    if (verdict === 'FAIL') {
      summary += 'REJECTION REASONS:\n';
      if (satisfied < total) {
        summary += `- ${total - satisfied} requirement(s) not satisfied\n`;
      }
      if (criticalBlockers.length > 0) {
        summary += `- ${criticalBlockers.length} critical blocker(s)\n`;
      }
      summary += '\nWork must be revised before approval.';
    } else {
      summary += 'APPROVAL: All requirements verified, no blocking issues.';
    }

    return summary;
  }
}

// Singleton instance
export const qaAgent = new QAAgent();
