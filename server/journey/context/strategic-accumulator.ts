/**
 * Strategic Context Accumulator
 * Builds up a comprehensive strategic context as journey executes
 * Each module adds its insights to the accumulator
 */

export interface StrategicContext {
  businessProfile: {
    name: string;
    description: string;
    industry: string;
    scale: string;
    geography: string;
    businessModel?: string;
  };

  analysisOutputs: {
    bmc?: any;
    swot?: any;
    pestle?: any;
    porters?: any;
    segments?: any;
    jtbd?: any;
    ansoff?: any;
    valueChain?: any;
    bcg?: any;
    vrio?: any;
    blueOcean?: any;
    oceanStrategy?: any;
    scenarioPlanning?: any;
    okr?: any;
  };

  synthesizedInsights: {
    keyStrengths: string[];
    keyWeaknesses: string[];
    opportunities: string[];
    threats: string[];
    targetSegments: string[];
    competitivePosition: string;
    growthStrategy: string;
    priorityActions: string[];
  };

  userDecisions: {
    targetMarkets?: string[];
    targetSegments?: string[];
    strategicPriorities?: string[];
    timeline?: string;
    budget?: string;
    riskTolerance?: string;
  };

  metadata: {
    journeyId: string;
    modulesExecuted: string[];
    lastUpdated: string;
    confidence: number;
  };
}

export class StrategicAccumulator {
  private context: StrategicContext;

  constructor(journeyId: string, initialBusinessProfile: any = {}) {
    this.context = {
      businessProfile: {
        name: initialBusinessProfile.name || 'Unknown Business',
        description: initialBusinessProfile.description || '',
        industry: initialBusinessProfile.industry || '',
        scale: initialBusinessProfile.scale || '',
        geography: initialBusinessProfile.geography || '',
      },
      analysisOutputs: {},
      synthesizedInsights: {
        keyStrengths: [],
        keyWeaknesses: [],
        opportunities: [],
        threats: [],
        targetSegments: [],
        competitivePosition: '',
        growthStrategy: '',
        priorityActions: [],
      },
      userDecisions: {},
      metadata: {
        journeyId,
        modulesExecuted: [],
        lastUpdated: new Date().toISOString(),
        confidence: 0.5,
      },
    };
  }

  addModuleOutput(moduleId: string, outputType: string, output: any): void {
    console.log(`[Accumulator] Adding output from ${moduleId} (${outputType})`);

    const outputKey = this.getOutputKey(outputType);
    if (outputKey) {
      this.context.analysisOutputs[outputKey] = output;
    }

    this.extractInsights(outputType, output);

    this.context.metadata.modulesExecuted.push(moduleId);
    this.context.metadata.lastUpdated = new Date().toISOString();
    this.context.metadata.confidence = this.calculateConfidence();
  }

  addUserDecision(decisionType: string, value: string | string[]): void {
    console.log(`[Accumulator] Adding user decision: ${decisionType}`);
    (this.context.userDecisions as any)[decisionType] = value;
    this.context.metadata.lastUpdated = new Date().toISOString();
  }

  getContext(): StrategicContext {
    return { ...this.context };
  }

  getEPMContext(): any {
    return {
      business: this.context.businessProfile,
      analyses: this.context.analysisOutputs,
      insights: this.context.synthesizedInsights,
      decisions: this.context.userDecisions,
      confidence: this.context.metadata.confidence,
    };
  }

  hasModuleOutput(moduleId: string): boolean {
    return this.context.metadata.modulesExecuted.includes(moduleId);
  }

  getModulesExecuted(): string[] {
    return [...this.context.metadata.modulesExecuted];
  }

  updateBusinessProfile(updates: Partial<StrategicContext['businessProfile']>): void {
    this.context.businessProfile = {
      ...this.context.businessProfile,
      ...updates,
    };
    this.context.metadata.lastUpdated = new Date().toISOString();
  }

  private getOutputKey(outputType: string): keyof StrategicContext['analysisOutputs'] | null {
    const mapping: Record<string, keyof StrategicContext['analysisOutputs']> = {
      'bmc_output': 'bmc',
      'swot_output': 'swot',
      'pestle_output': 'pestle',
      'porters_output': 'porters',
      'segment_output': 'segments',
      'jtbd_output': 'jtbd',
      'ansoff_output': 'ansoff',
      'value_chain_output': 'valueChain',
      'bcg_output': 'bcg',
      'vrio_output': 'vrio',
      'blue_ocean_output': 'blueOcean',
      'scenario_output': 'scenarioPlanning',
      'okr_output': 'okr',
    };
    return mapping[outputType] || null;
  }

  private extractInsights(outputType: string, output: any): void {
    const insights = this.context.synthesizedInsights;

    switch (outputType) {
      case 'swot_output':
        insights.keyStrengths = output.strengths?.slice(0, 3).map((s: any) => s.factor || s) || [];
        insights.keyWeaknesses = output.weaknesses?.slice(0, 3).map((w: any) => w.factor || w) || [];
        insights.opportunities = output.opportunities?.slice(0, 3).map((o: any) => o.factor || o) || [];
        insights.threats = output.threats?.slice(0, 3).map((t: any) => t.factor || t) || [];
        insights.priorityActions = output.priorityActions?.slice(0, 5) || [];
        break;

      case 'segment_output':
        insights.targetSegments = output.segments?.map((s: any) => s.name) || [];
        break;

      case 'porters_output':
        insights.competitivePosition = output.overallAssessment || '';
        break;

      case 'ansoff_output':
        insights.growthStrategy = output.recommendation?.primaryStrategy || '';
        break;

      case 'bmc_output':
        if (!this.context.businessProfile.businessModel) {
          this.context.businessProfile.businessModel = 
            output.valuePropositions?.join(', ') || '';
        }
        break;
    }
  }

  private calculateConfidence(): number {
    const executedCount = this.context.metadata.modulesExecuted.length;
    const hasUserDecisions = Object.keys(this.context.userDecisions).length > 0;

    let confidence = 0.4 + (executedCount * 0.08);
    if (hasUserDecisions) confidence += 0.1;

    return Math.min(0.95, confidence);
  }

  toJSON(): StrategicContext {
    return this.getContext();
  }

  static fromJSON(json: StrategicContext): StrategicAccumulator {
    const accumulator = new StrategicAccumulator(json.metadata.journeyId, json.businessProfile);
    accumulator.context = { ...json };
    return accumulator;
  }
}
