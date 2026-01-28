/**
 * Strategic Consultant V2
 * 
 * Thin entry point that gathers context and then delegates to Journey Builder.
 * This unifies the codebase so all EPM generation goes through one pipeline.
 */

import { ContextGatherer } from './context-gatherer';
import { JourneySelector } from './journey-selector';
import { templateRegistry, type JourneyTemplate } from '../journey/templates';
import { JourneyOrchestrator } from '../journey/journey-orchestrator';
import type { StrategicContext, JourneyInput, V2RunResult } from './types';

export class StrategicConsultantV2 {
  private contextGatherer: ContextGatherer;
  private journeySelector: JourneySelector;

  constructor() {
    this.contextGatherer = new ContextGatherer();
    this.journeySelector = new JourneySelector();
  }

  async gatherContext(userInput: string, sessionId: string): Promise<StrategicContext> {
    console.log('[SC-V2] Phase 1: Gathering strategic context...');
    
    const clarifications = await this.contextGatherer.askClarifications(userInput);
    
    const analysis = await this.contextGatherer.runAnalysis(userInput, {});
    
    await this.contextGatherer.saveContext(sessionId, {
      userInput,
      clarifications: {},
      analysis,
    });

    return {
      sessionId,
      userInput,
      clarifications: {},
      analysis,
      industry: analysis.detectedIndustry,
      businessType: analysis.detectedBusinessType,
    };
  }

  async executeJourney(
    context: StrategicContext,
    templateId?: string
  ): Promise<V2RunResult> {
    console.log('[SC-V2] Phase 2: Executing journey...');
    
    const template = templateId
      ? templateRegistry.get(templateId)
      : this.journeySelector.selectBestTemplate(context);

    console.log(`[SC-V2] Using template: ${template.name}`);
    console.log(`[SC-V2] Industry detected: ${context.industry}`);
    console.log(`[SC-V2] Analysis frameworks: ${template.analysisFrameworks.join(', ')}`);

    try {
      const journeyType = this.mapTemplateToJourneyType(template);
      
      const orchestrator = new JourneyOrchestrator();
      
      console.log(`[SC-V2] Starting journey type: ${journeyType}`);
      const journeySession = await orchestrator.startJourney(
        journeyType,
        context.sessionId,
        context.userInput
      );

      return {
        success: true,
        sessionId: context.sessionId,
        templateUsed: template.id,
        epmProgramId: journeySession.id,
      };
    } catch (error) {
      console.error('[SC-V2] Journey execution failed:', error);
      return {
        success: false,
        sessionId: context.sessionId,
        templateUsed: template.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async run(userInput: string, sessionId: string, templateId?: string): Promise<V2RunResult> {
    console.log('[SC-V2] Starting full flow...');
    console.log(`[SC-V2] Session: ${sessionId}`);
    console.log(`[SC-V2] Input: ${userInput.substring(0, 100)}...`);

    const context = await this.gatherContext(userInput, sessionId);
    
    return this.executeJourney(context, templateId);
  }

  private mapTemplateToJourneyType(template: JourneyTemplate): string {
    const templateToJourneyMap: Record<string, string> = {
      'standard-epm': 'business_model_innovation',
      'bmc-journey': 'business_model_innovation',
      'digital-transformation': 'digital_transformation',
      'product-launch': 'product_launch',
      'market-expansion': 'market_entry',
    };

    return templateToJourneyMap[template.id] || 'business_model_innovation';
  }

  listTemplates(): JourneyTemplate[] {
    return templateRegistry.list();
  }
}

export const strategicConsultantV2 = new StrategicConsultantV2();
export type { StrategicContext, JourneyInput, V2RunResult } from './types';
