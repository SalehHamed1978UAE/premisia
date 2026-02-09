/**
 * Gap Analyzer - Identifies what EPM needs that the journey hasn't provided
 */

import { EPM_REQUIREMENTS, EPMRequirement } from './requirements';
import { StrategicContext } from '../context/strategic-accumulator';

export interface GapAnalysis {
  providedRequirements: string[];
  missingRequirements: EPMRequirement[];
  criticalGaps: EPMRequirement[];
  importantGaps: EPMRequirement[];
  optionalGaps: EPMRequirement[];
  overallReadiness: 'ready' | 'needs_input' | 'insufficient';
  readinessScore: number;
}

export class GapAnalyzer {
  analyze(context: StrategicContext): GapAnalysis {
    console.log('[Gap Analyzer] Analyzing EPM readiness...');
    console.log(`  Modules executed: ${context.metadata.modulesExecuted.join(', ')}`);

    const provided: string[] = [];
    const missing: EPMRequirement[] = [];

    for (const req of EPM_REQUIREMENTS) {
      if (this.isRequirementMet(req, context)) {
        provided.push(req.id);
      } else {
        missing.push(req);
      }
    }

    const criticalGaps = missing.filter(r => r.importance === 'critical');
    const importantGaps = missing.filter(r => r.importance === 'important');
    const optionalGaps = missing.filter(r => r.importance === 'optional');

    const totalWeight = EPM_REQUIREMENTS.reduce((sum, r) => {
      const weight = r.importance === 'critical' ? 3 : r.importance === 'important' ? 2 : 1;
      return sum + weight;
    }, 0);

    const providedWeight = provided.reduce((sum, id) => {
      const req = EPM_REQUIREMENTS.find(r => r.id === id);
      const weight = req?.importance === 'critical' ? 3 : req?.importance === 'important' ? 2 : 1;
      return sum + weight;
    }, 0);

    const readinessScore = Math.round((providedWeight / totalWeight) * 100);

    let overallReadiness: 'ready' | 'needs_input' | 'insufficient';
    if (criticalGaps.length === 0 && importantGaps.length <= 2) {
      overallReadiness = 'ready';
    } else if (criticalGaps.length <= 2) {
      overallReadiness = 'needs_input';
    } else {
      overallReadiness = 'insufficient';
    }

    console.log(`[Gap Analyzer] Readiness: ${overallReadiness} (${readinessScore}%)`);
    console.log(`  Critical gaps: ${criticalGaps.length}`);
    console.log(`  Important gaps: ${importantGaps.length}`);

    return {
      providedRequirements: provided,
      missingRequirements: missing,
      criticalGaps,
      importantGaps,
      optionalGaps,
      overallReadiness,
      readinessScore,
    };
  }

  private isRequirementMet(req: EPMRequirement, context: StrategicContext): boolean {
    const hasSourceModule = req.sourcedFrom.some(
      moduleId => context.metadata.modulesExecuted.includes(moduleId)
    );

    const hasUserDecision = (context.userDecisions as any)[req.id] !== undefined;

    switch (req.id) {
      case 'target_segments':
        return context.synthesizedInsights.targetSegments.length > 0 || hasUserDecision;
      case 'competitive_strategy':
        return context.synthesizedInsights.competitivePosition !== '' || hasUserDecision;
      case 'growth_strategy':
        return context.synthesizedInsights.growthStrategy !== '' || hasUserDecision;
      case 'value_proposition':
        return context.analysisOutputs.bmc?.valuePropositions?.length > 0 || hasUserDecision;
      default:
        return hasSourceModule || hasUserDecision;
    }
  }

  getGapsForUserInput(analysis: GapAnalysis): EPMRequirement[] {
    return [
      ...analysis.criticalGaps,
      ...analysis.importantGaps.slice(0, 3),
    ];
  }
}

export const gapAnalyzer = new GapAnalyzer();
