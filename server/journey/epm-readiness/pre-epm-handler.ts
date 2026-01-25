/**
 * Pre-EPM Handler - Orchestrates gap analysis and filling before EPM generation
 */

import { gapAnalyzer, GapAnalysis } from './gap-analyzer';
import { smartOptionGenerator, GapFillerQuestion } from './smart-options';
import { StrategicAccumulator, StrategicContext } from '../context/strategic-accumulator';
import { EPMRequirement } from './requirements';

export interface PreEPMResult {
  readiness: GapAnalysis;
  questions: GapFillerQuestion[];
  requiresUserInput: boolean;
  canProceedWithoutInput: boolean;
}

export class PreEPMHandler {
  async analyzeAndPrepare(accumulator: StrategicAccumulator): Promise<PreEPMResult> {
    const context = accumulator.getContext();
    const readiness = gapAnalyzer.analyze(context);

    if (readiness.overallReadiness === 'ready') {
      return {
        readiness,
        questions: [],
        requiresUserInput: false,
        canProceedWithoutInput: true,
      };
    }

    const gapsToFill = gapAnalyzer.getGapsForUserInput(readiness);
    const questions = await this.generateQuestions(gapsToFill, context);

    return {
      readiness,
      questions,
      requiresUserInput: readiness.criticalGaps.length > 0,
      canProceedWithoutInput: readiness.overallReadiness !== 'insufficient',
    };
  }

  private async generateQuestions(
    gaps: EPMRequirement[],
    context: StrategicContext
  ): Promise<GapFillerQuestion[]> {
    const questions: GapFillerQuestion[] = [];

    for (const gap of gaps) {
      try {
        const question = await smartOptionGenerator.generateOptions(gap, context);
        questions.push(question);
      } catch (error) {
        console.error(`[PreEPMHandler] Failed to generate options for ${gap.id}:`, error);
      }
    }

    return questions;
  }

  applyUserAnswers(
    accumulator: StrategicAccumulator,
    answers: Record<string, string | string[]>,
    questions: GapFillerQuestion[]
  ): void {
    console.log('[PreEPMHandler] Applying user answers to accumulator');

    for (const [requirementId, answer] of Object.entries(answers)) {
      const question = questions.find(q => q.requirementId === requirementId);
      if (!question) continue;

      let resolvedValue: string | string[];

      if (Array.isArray(answer)) {
        resolvedValue = answer.map(a => this.resolveAnswerValue(a, question));
      } else {
        resolvedValue = this.resolveAnswerValue(answer, question);
      }

      accumulator.addUserDecision(requirementId, resolvedValue);
    }
  }

  private resolveAnswerValue(answerId: string, question: GapFillerQuestion): string {
    if (answerId.startsWith('custom:')) {
      return answerId.substring(7);
    }

    const option = question.options.find(o => o.id === answerId);
    return option?.value || answerId;
  }

  getReadinessStatus(analysis: GapAnalysis): {
    status: 'green' | 'yellow' | 'red';
    message: string;
    score: number;
  } {
    if (analysis.overallReadiness === 'ready') {
      return {
        status: 'green',
        message: 'Ready for EPM generation',
        score: analysis.readinessScore,
      };
    }

    if (analysis.overallReadiness === 'needs_input') {
      return {
        status: 'yellow',
        message: `${analysis.criticalGaps.length} critical inputs needed`,
        score: analysis.readinessScore,
      };
    }

    return {
      status: 'red',
      message: 'More analysis frameworks recommended',
      score: analysis.readinessScore,
    };
  }
}

export const preEPMHandler = new PreEPMHandler();
