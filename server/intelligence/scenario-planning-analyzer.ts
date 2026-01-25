/**
 * Scenario Planning Analyzer
 * Generates plausible future business scenarios based on uncertainties
 */

import { aiClients } from '../ai-clients';

export interface ScenarioPlanningInput {
  businessContext: string;
  timeHorizon: string;
  uncertainties: string[];
}

export interface Scenario {
  name: string;
  description: string;
  probability: number;
  keyDrivers: string[];
  strategicImplications: {
    opportunities: string[];
    threats: string[];
  };
  earlyWarningSignals: string[];
  recommendedStrategies: string[];
}

export interface ScenarioPlanningOutput {
  scenarios: Scenario[];
  criticalUncertainties: {
    uncertainty: string;
    impact: 'high' | 'medium' | 'low';
    monitoringStrategy: string;
  }[];
  robustStrategies: string[];
  strategicOptions: string[];
  confidence: number;
  metadata: {
    timeHorizon: string;
    scenariosGenerated: number;
    generatedAt: string;
  };
}

export class ScenarioPlanningAnalyzer {
  async analyze(input: ScenarioPlanningInput): Promise<ScenarioPlanningOutput> {
    console.log('[Scenario Planning Analyzer] Starting scenario generation...');

    const prompt = `
Generate plausible business scenarios for the following context:

Business Context:
${input.businessContext}

Time Horizon: ${input.timeHorizon}

Key Uncertainties to Consider:
${input.uncertainties.map((u, i) => `${i + 1}. ${u}`).join('\n')}

Create 3-4 distinct, plausible future scenarios that represent different outcomes based on how the key uncertainties might resolve. Each scenario should be internally consistent and represent a coherent future state.

For each scenario, provide:

1. SCENARIO NAME - A memorable, descriptive name for this future state

2. DESCRIPTION - A detailed narrative description of the business environment, market conditions, and company position in this scenario

3. PROBABILITY - Your estimate of the likelihood of this scenario (0-1 scale, where 1 = certain)

4. KEY DRIVERS - The 3-5 most important factors that would drive this scenario to occur

5. STRATEGIC IMPLICATIONS:
   - Opportunities: What advantages would exist in this scenario?
   - Threats: What challenges would the business face?

6. EARLY WARNING SIGNALS - What indicators or events would signal that this scenario is becoming more likely?

7. RECOMMENDED STRATEGIES - How should the business adapt its strategy in this scenario?

Also identify:
- The 2-3 CRITICAL UNCERTAINTIES that have the most impact on scenario outcomes
- ROBUST STRATEGIES that would work across multiple scenarios
- STRATEGIC OPTIONS to prepare for different scenarios

Return as JSON:
{
  "scenarios": [
    {
      "name": "",
      "description": "",
      "probability": 0.3,
      "keyDrivers": [""],
      "strategicImplications": {
        "opportunities": [""],
        "threats": [""]
      },
      "earlyWarningSignals": [""],
      "recommendedStrategies": [""]
    }
  ],
  "criticalUncertainties": [
    {
      "uncertainty": "",
      "impact": "high|medium|low",
      "monitoringStrategy": ""
    }
  ],
  "robustStrategies": [""],
  "strategicOptions": [""]
}
    `.trim();

    try {
      const response = await aiClients.callWithFallback({
        systemPrompt: 'You are a strategic foresight expert specializing in scenario planning. Generate coherent, plausible scenarios and return only valid JSON.',
        userMessage: prompt,
        maxTokens: 4500,
      });

      const result = JSON.parse(response.content);

      console.log('[Scenario Planning Analyzer] Scenario generation complete');
      console.log(`  Scenarios created: ${result.scenarios?.length || 0}`);
      console.log(`  Critical uncertainties identified: ${result.criticalUncertainties?.length || 0}`);

      return {
        scenarios: result.scenarios || [],
        criticalUncertainties: result.criticalUncertainties || [],
        robustStrategies: result.robustStrategies || [],
        strategicOptions: result.strategicOptions || [],
        confidence: this.calculateConfidence(result),
        metadata: {
          timeHorizon: input.timeHorizon,
          scenariosGenerated: result.scenarios?.length || 0,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[Scenario Planning Analyzer] Scenario generation failed:', error);
      throw error;
    }
  }

  private calculateConfidence(result: any): number {
    let confidence = 0.6;

    const scenarioCount = result.scenarios?.length || 0;
    if (scenarioCount >= 4) confidence += 0.15;
    else if (scenarioCount >= 3) confidence += 0.1;

    const allScenariosComplete = result.scenarios?.every((s: Scenario) =>
      s.name && s.description && s.keyDrivers?.length > 0 && s.earlyWarningSignals?.length > 0
    ) ?? false;
    if (allScenariosComplete) confidence += 0.1;

    if (result.criticalUncertainties?.length > 0) confidence += 0.05;
    if (result.robustStrategies?.length > 0) confidence += 0.05;

    return Math.min(0.95, confidence);
  }
}

export const scenarioPlanningAnalyzer = new ScenarioPlanningAnalyzer();
