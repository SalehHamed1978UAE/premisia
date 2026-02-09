/**
 * EPM Adapter for Strategic Consultant V2
 * 
 * Bridges the legacy Strategic Consultant input format to the new EPMSynthesizer.
 * This allows the existing frontend to use the improved EPM generation engine
 * without any UI changes.
 * 
 * Input: Legacy format (analysisData, decisionsData, selectedDecisions)
 * Output: EPMProgram via EPMSynthesizer
 */

import { EPMSynthesizer } from '../intelligence/epm-synthesizer';
import { createOpenAIProvider } from '../../src/lib/intelligent-planning/llm-provider';
import type { StrategyInsights, StrategyInsight } from '../intelligence/types';
import { randomUUID } from 'crypto';

function createLLMProvider() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[EPM-Adapter] No OPENAI_API_KEY - using default mode');
    return null;
  }
  return createOpenAIProvider({ apiKey, model: 'gpt-4o' });
}

interface LegacyEPMInput {
  analysisData: any;
  decisionsData: any;
  selectedDecisions: Record<string, string>;
  sessionId?: string;
  versionNumber?: number;
  userId?: string;
}

interface EPMAdapterOptions {
  onProgress?: (event: any) => void;
}

/**
 * Adapts legacy Strategic Consultant data to EPMSynthesizer format
 */
export class EPMAdapter {
  private synthesizer: EPMSynthesizer;

  constructor() {
    this.synthesizer = new EPMSynthesizer(createLLMProvider());
  }

  /**
   * Convert legacy Strategic Consultant data to EPM program using V2 engine
   */
  async convertToEPM(input: LegacyEPMInput, options?: EPMAdapterOptions): Promise<any> {
    console.log('[EPM-Adapter] Converting legacy input to V2 format');
    console.log('[EPM-Adapter] Session:', input.sessionId);
    console.log('[EPM-Adapter] Selected decisions:', Object.keys(input.selectedDecisions || {}).length);

    const insights = this.transformToInsights(input);
    
    const userContext = {
      sessionId: input.sessionId,
      userId: input.userId,
    };

    const namingContext = this.extractNamingContext(input);

    console.log('[EPM-Adapter] Calling EPMSynthesizer with transformed insights');
    
    const program = await this.synthesizer.synthesize(
      insights,
      userContext as any,
      namingContext,
      { onProgress: options?.onProgress }
    );

    console.log('[EPM-Adapter] EPM program generated successfully');
    return program;
  }

  /**
   * Transform legacy analysis/decisions format to StrategyInsights
   * Produces a fully compliant StrategyInsights object per the intelligence/types.ts schema
   */
  private transformToInsights(input: LegacyEPMInput): StrategyInsights {
    const insights: StrategyInsight[] = [];

    if (input.analysisData?.five_whys) {
      insights.push({
        type: 'other',
        source: 'five_whys.rootCause',
        content: this.extractFiveWhysContent(input.analysisData.five_whys),
        confidence: 0.8,
        reasoning: 'Root cause analysis from Five Whys framework',
      });
    }

    if (input.analysisData?.swot) {
      insights.push(...this.extractSWOTInsights(input.analysisData.swot));
    }

    if (input.analysisData?.porters) {
      insights.push(...this.extractPortersInsights(input.analysisData.porters));
    }

    if (input.analysisData?.pestle) {
      insights.push(...this.extractPESTLEInsights(input.analysisData.pestle));
    }

    if (input.decisionsData?.decisions) {
      const selectedDecisionIds = Object.keys(input.selectedDecisions || {});
      const filteredDecisions = input.decisionsData.decisions.filter(
        (d: any) => selectedDecisionIds.includes(d.id)
      );
      
      for (const decision of filteredDecisions) {
        insights.push({
          type: 'workstream',
          source: 'user.selectedDecision',
          content: decision.recommendation || decision.title || decision.description,
          confidence: 0.95,
          reasoning: 'User-selected strategic decision to implement',
          metadata: {
            decisionId: decision.id,
            priority: input.selectedDecisions[decision.id],
          },
        });
      }
    }

    const frameworkType = this.detectFrameworkType(input.analysisData);
    const industry = input.analysisData?.detectedIndustry || input.analysisData?.industry || 'general';

    return {
      frameworkType,
      frameworkRunId: input.sessionId || randomUUID(),
      insights,
      references: [],
      marketContext: {
        industry,
        urgency: this.detectUrgency(input.analysisData) as 'ASAP' | 'Strategic' | 'Exploratory',
        riskTolerance: 'Moderate',
      },
      overallConfidence: this.calculateOverallConfidence(insights),
      initiativeType: input.analysisData?.initiativeType || input.analysisData?.type || 'strategic',
    };
  }

  private detectUrgency(analysisData: any): string {
    if (analysisData?.urgency) return analysisData.urgency;
    if (analysisData?.timeline === 'immediate') return 'ASAP';
    if (analysisData?.timeline === 'long-term') return 'Exploratory';
    return 'Strategic';
  }

  private calculateOverallConfidence(insights: StrategyInsight[]): number {
    if (insights.length === 0) return 0.5;
    const sum = insights.reduce((acc, i) => acc + i.confidence, 0);
    return Math.round((sum / insights.length) * 100) / 100;
  }

  private extractFiveWhysContent(fiveWhys: any): string {
    if (!fiveWhys) return '';
    
    const parts: string[] = [];
    if (fiveWhys.problem) parts.push(`Problem: ${fiveWhys.problem}`);
    if (fiveWhys.rootCause) parts.push(`Root Cause: ${fiveWhys.rootCause}`);
    if (fiveWhys.whys) {
      fiveWhys.whys.forEach((why: any, i: number) => {
        parts.push(`Why ${i + 1}: ${why.question} - ${why.answer}`);
      });
    }
    return parts.join('\n');
  }

  private extractSWOTInsights(swot: any): StrategyInsight[] {
    const insights: StrategyInsight[] = [];
    
    if (swot.strengths) {
      for (const strength of swot.strengths) {
        insights.push({
          type: 'resource',
          source: 'swot.strengths',
          content: typeof strength === 'string' ? strength : strength.description,
          confidence: 0.75,
          reasoning: 'Internal strength identified via SWOT analysis',
        });
      }
    }
    
    if (swot.weaknesses) {
      for (const weakness of swot.weaknesses) {
        insights.push({
          type: 'risk',
          source: 'swot.weaknesses',
          content: typeof weakness === 'string' ? weakness : weakness.description,
          confidence: 0.7,
          reasoning: 'Internal weakness requiring mitigation via SWOT analysis',
        });
      }
    }
    
    if (swot.opportunities) {
      for (const opportunity of swot.opportunities) {
        insights.push({
          type: 'benefit',
          source: 'swot.opportunities',
          content: typeof opportunity === 'string' ? opportunity : opportunity.description,
          confidence: 0.8,
          reasoning: 'External opportunity identified via SWOT analysis',
        });
      }
    }
    
    if (swot.threats) {
      for (const threat of swot.threats) {
        insights.push({
          type: 'risk',
          source: 'swot.threats',
          content: typeof threat === 'string' ? threat : threat.description,
          confidence: 0.75,
          reasoning: 'External threat requiring mitigation via SWOT analysis',
        });
      }
    }
    
    return insights;
  }

  private extractPortersInsights(porters: any): StrategyInsight[] {
    const insights: StrategyInsight[] = [];
    
    const forceMapping: Record<string, { type: StrategyInsight['type']; reasoning: string }> = {
      competitiveRivalry: { type: 'risk', reasoning: 'Competitive intensity from Porter\'s Five Forces' },
      threatOfNewEntrants: { type: 'risk', reasoning: 'New entrant threat from Porter\'s Five Forces' },
      bargainingPowerOfSuppliers: { type: 'stakeholder', reasoning: 'Supplier dynamics from Porter\'s Five Forces' },
      bargainingPowerOfBuyers: { type: 'stakeholder', reasoning: 'Customer dynamics from Porter\'s Five Forces' },
      threatOfSubstitutes: { type: 'risk', reasoning: 'Substitute threat from Porter\'s Five Forces' },
    };
    
    for (const [force, meta] of Object.entries(forceMapping)) {
      if (porters[force]) {
        insights.push({
          type: meta.type,
          source: `porters.${force}`,
          content: typeof porters[force] === 'string' 
            ? porters[force] 
            : porters[force].analysis || JSON.stringify(porters[force]),
          confidence: 0.7,
          reasoning: meta.reasoning,
        });
      }
    }
    
    return insights;
  }

  private extractPESTLEInsights(pestle: any): StrategyInsight[] {
    const insights: StrategyInsight[] = [];
    
    const factorMapping: Record<string, { type: StrategyInsight['type']; reasoning: string }> = {
      political: { type: 'risk', reasoning: 'Political factor from PESTLE analysis' },
      economic: { type: 'cost', reasoning: 'Economic factor from PESTLE analysis' },
      social: { type: 'stakeholder', reasoning: 'Social/demographic factor from PESTLE analysis' },
      technological: { type: 'resource', reasoning: 'Technology factor from PESTLE analysis' },
      legal: { type: 'risk', reasoning: 'Legal/regulatory factor from PESTLE analysis' },
      environmental: { type: 'risk', reasoning: 'Environmental factor from PESTLE analysis' },
    };
    
    for (const [factor, meta] of Object.entries(factorMapping)) {
      if (pestle[factor]) {
        const content = Array.isArray(pestle[factor]) 
          ? pestle[factor].join('; ')
          : typeof pestle[factor] === 'string'
            ? pestle[factor]
            : JSON.stringify(pestle[factor]);
            
        insights.push({
          type: meta.type,
          source: `pestle.${factor}`,
          content,
          confidence: 0.7,
          reasoning: meta.reasoning,
        });
      }
    }
    
    return insights;
  }

  private detectFrameworkType(analysisData: any): 'bmc' | 'porters' | 'pestle' | 'swot' {
    if (analysisData?.bmc) return 'bmc';
    if (analysisData?.porters) return 'porters';
    if (analysisData?.pestle) return 'pestle';
    if (analysisData?.swot) return 'swot';
    if (analysisData?.five_whys) return 'swot';
    return 'swot';
  }

  private extractNamingContext(input: LegacyEPMInput): any {
    return {
      userInput: input.analysisData?.originalInput || input.analysisData?.userInput || '',
      industry: input.analysisData?.detectedIndustry || input.analysisData?.industry,
      businessType: input.analysisData?.businessType || input.analysisData?.type,
      companyName: input.analysisData?.companyName,
    };
  }
}

export const epmAdapter = new EPMAdapter();
