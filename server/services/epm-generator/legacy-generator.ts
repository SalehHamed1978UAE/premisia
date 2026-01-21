/**
 * Legacy EPM Generator
 * 
 * Wraps the existing EPM generation pipeline (EPMSynthesizer, WBSBuilder, etc.)
 * to provide a consistent interface matching the multi-agent generator.
 */

import type { IEPMGenerator, EPMGeneratorInput, EPMGeneratorOutput, EPMProgram, Workstream, Risk, FinancialItem } from './types';

export class LegacyEPMGenerator implements IEPMGenerator {
  
  /**
   * Generate EPM program using the existing pipeline
   */
  async generate(input: EPMGeneratorInput): Promise<EPMGeneratorOutput> {
    const startTime = Date.now();
    console.log('[LegacyEPMGenerator] Starting legacy EPM generation');
    console.log(`[LegacyEPMGenerator] Session: ${input.sessionId}`);

    try {
      // Dynamically import existing modules to avoid circular dependencies
      const { EPMSynthesizer, ContextBuilder } = await import('../../intelligence/epm-synthesizer');
      const { aiClients } = await import('../../ai-clients');
      
      // Build planning context from inputs
      const strategyInsights = input.strategyInsights || this.buildInsightsFromBMC(input.bmcInsights);
      
      const planningContext = await ContextBuilder.fromJourneyInsights(
        strategyInsights,
        input.journeyType || 'strategy_workspace',
        input.sessionId
      );

      // Override with provided business context if available
      if (input.businessContext) {
        planningContext.business.name = input.businessContext.name;
        planningContext.business.type = input.businessContext.type;
        planningContext.business.scale = input.businessContext.scale;
        planningContext.business.description = input.businessContext.description;
        if (input.businessContext.industry) {
          planningContext.business.industry = input.businessContext.industry;
        }
      }

      // Apply constraints if provided
      if (input.constraints) {
        if (input.constraints.budget) {
          planningContext.execution.budget = {
            min: input.constraints.budget * 0.8,
            max: input.constraints.budget * 1.2,
          };
        }
        if (input.constraints.deadline) {
          const monthsToDeadline = Math.ceil(
            (input.constraints.deadline.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)
          );
          planningContext.execution.timeline = {
            min: Math.max(3, monthsToDeadline - 3),
            max: monthsToDeadline,
          };
        }
      }

      // Create LLM provider wrapper for WBS Builder
      const llmProvider = {
        async generateStructured<T>(request: { prompt: string; schema: any }): Promise<T> {
          console.log('[LegacyEPMGenerator] Using aiClients for structured generation');
          const response = await aiClients.callWithFallback({
            systemPrompt: 'You are a strategic business analyst. Return strictly valid JSON matching the provided schema. Do not include any markdown formatting or code blocks.',
            userMessage: `${request.prompt}\n\nRequired JSON schema:\n${JSON.stringify(request.schema, null, 2)}\n\nRespond with only valid JSON.`,
          });
          
          // Parse JSON from response, handling potential markdown code blocks
          let jsonStr = response.content.trim();
          if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.slice(7);
          } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.slice(3);
          }
          if (jsonStr.endsWith('```')) {
            jsonStr = jsonStr.slice(0, -3);
          }
          jsonStr = jsonStr.trim();
          
          return JSON.parse(jsonStr) as T;
        },
      };

      // Create synthesizer with LLM provider for proper WBS generation
      const synthesizer = new EPMSynthesizer(llmProvider);
      const legacyResult = await synthesizer.synthesize(
        strategyInsights,
        { id: input.userId } as any,
        planningContext
      );

      // Convert legacy format to new unified format
      const program = this.convertToUnifiedFormat(legacyResult, input);
      const generationTime = Date.now() - startTime;

      console.log('[LegacyEPMGenerator] Generation complete');
      console.log(`[LegacyEPMGenerator] Workstreams: ${program.workstreams.length}`);
      console.log(`[LegacyEPMGenerator] Generation time: ${(generationTime / 1000).toFixed(1)}s`);

      return {
        program,
        metadata: {
          generator: 'legacy',
          generatedAt: new Date().toISOString(),
          confidence: legacyResult.overallConfidence || 0.75,
          generationTimeMs: generationTime,
        },
      };

    } catch (error: any) {
      console.error('[LegacyEPMGenerator] Generation failed:', error);
      throw error;
    }
  }

  /**
   * Build minimal strategy insights from BMC data
   */
  private buildInsightsFromBMC(bmcInsights: any): any {
    const insights: any[] = [];
    
    if (bmcInsights?.blocks) {
      for (const [blockName, blockData] of Object.entries(bmcInsights.blocks)) {
        if (blockData && typeof blockData === 'object') {
          insights.push({
            id: `bmc-${blockName}`,
            type: 'strategic',
            content: JSON.stringify(blockData),
            source: 'bmc_analysis',
            confidence: 0.8,
          });
        }
      }
    }

    return {
      insights,
      marketContext: bmcInsights?.marketContext || {},
      overallConfidence: bmcInsights?.confidence || 0.75,
    };
  }

  /**
   * Convert legacy EPM format to unified format
   */
  private convertToUnifiedFormat(legacyResult: any, input: EPMGeneratorInput): EPMProgram {
    const workstreams: Workstream[] = (legacyResult.workstreams || []).map((ws: any, idx: number) => ({
      id: ws.id || `ws-${idx + 1}`,
      name: ws.name || ws.title || `Workstream ${idx + 1}`,
      description: ws.description || '',
      owner: ws.owner || 'TBD',
      deliverables: (ws.deliverables || ws.tasks || []).map((d: any, dIdx: number) => ({
        id: d.id || `${ws.id || `ws-${idx + 1}`}-del-${dIdx + 1}`,
        name: d.name || d.title || `Deliverable ${dIdx + 1}`,
        description: d.description || '',
        workstreamId: ws.id || `ws-${idx + 1}`,
        dueMonth: d.dueMonth || d.endMonth || undefined,
      })),
      dependencies: ws.dependencies || [],
      resourceRequirements: (ws.resources || ws.resourceRequirements || []).map((r: any) => ({
        role: r.role || r.name || 'Resource',
        skills: r.skills || [],
        allocation: r.allocation || r.fte || 1,
        costPerMonth: r.costPerMonth || r.monthlyCost,
      })),
      startMonth: ws.startMonth || ws.start_month || 1,
      endMonth: ws.endMonth || ws.end_month || 6,
      confidence: ws.confidence || 0.75,
    }));

    const risks: Risk[] = (legacyResult.riskRegister?.risks || legacyResult.risks || []).map((r: any, idx: number) => ({
      id: r.id || `risk-${idx + 1}`,
      description: r.description || r.name || '',
      probability: this.mapProbability(r.probability || r.likelihood),
      impact: this.mapImpact(r.impact || r.severity),
      mitigation: r.mitigation || r.mitigationStrategy || '',
      owner: r.owner,
      category: r.category,
    }));

    const totalMonths = legacyResult.timeline?.total_months || 
                        legacyResult.timeline?.totalMonths || 
                        Math.max(...workstreams.map(ws => ws.endMonth), 12);

    return {
      id: `epm-${input.sessionId}-${Date.now()}`,
      title: legacyResult.title || input.businessContext.name || 'EPM Program',
      description: legacyResult.description || input.businessContext.description || '',
      workstreams,
      timeline: {
        phases: (legacyResult.timeline?.phases || []).map((p: any, idx: number) => ({
          id: p.id || `phase-${idx + 1}`,
          name: p.name || `Phase ${idx + 1}`,
          startMonth: p.startMonth || p.start_month || 1,
          endMonth: p.endMonth || p.end_month || 3,
          workstreamIds: p.workstreamIds || p.workstreams || [],
          milestones: (p.milestones || []).map((m: any, mIdx: number) => ({
            id: m.id || `milestone-${idx + 1}-${mIdx + 1}`,
            name: m.name || m.title || '',
            dueMonth: m.dueMonth || m.month || 1,
            deliverableIds: m.deliverableIds || m.deliverables || [],
          })),
        })),
        totalMonths,
        criticalPath: legacyResult.timeline?.criticalPath || [],
      },
      resourcePlan: {
        roles: (legacyResult.resourcePlan?.resources || []).map((r: any) => ({
          role: r.role || r.name || 'Resource',
          skills: r.skills || [],
          allocation: r.allocation || r.fte || 1,
          costPerMonth: r.costPerMonth || r.monthlyCost,
        })),
        totalHeadcount: legacyResult.resourcePlan?.totalFTE || 
                        legacyResult.resourcePlan?.totalHeadcount || 
                        workstreams.reduce((sum, ws) => sum + ws.resourceRequirements.length, 0),
        totalCost: legacyResult.resourcePlan?.totalCost || 0,
      },
      riskRegister: {
        risks,
        overallRiskLevel: this.calculateOverallRisk(risks),
      },
      financialPlan: {
        capex: this.extractFinancialItems(legacyResult.financialPlan?.capex || [], 'one_time'),
        opex: this.extractFinancialItems(legacyResult.financialPlan?.opex || [], 'monthly'),
        totalBudget: legacyResult.financialPlan?.totalBudget || 
                     legacyResult.financialPlan?.total_budget || 0,
        contingency: legacyResult.financialPlan?.contingency || 
                     (legacyResult.financialPlan?.totalBudget || 0) * 0.15,
      },
      overallConfidence: legacyResult.overallConfidence || 0.75,
    };
  }

  private mapProbability(value: any): 'low' | 'medium' | 'high' {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower.includes('high') || lower.includes('likely')) return 'high';
      if (lower.includes('low') || lower.includes('unlikely')) return 'low';
    }
    if (typeof value === 'number') {
      if (value >= 0.7) return 'high';
      if (value <= 0.3) return 'low';
    }
    return 'medium';
  }

  private mapImpact(value: any): 'low' | 'medium' | 'high' {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower.includes('high') || lower.includes('severe') || lower.includes('critical')) return 'high';
      if (lower.includes('low') || lower.includes('minor')) return 'low';
    }
    if (typeof value === 'number') {
      if (value >= 0.7) return 'high';
      if (value <= 0.3) return 'low';
    }
    return 'medium';
  }

  private calculateOverallRisk(risks: Risk[]): 'low' | 'medium' | 'high' {
    if (risks.length === 0) return 'low';
    
    const highRisks = risks.filter(r => r.probability === 'high' && r.impact === 'high').length;
    const mediumHighRisks = risks.filter(r => 
      (r.probability === 'high' || r.impact === 'high') && 
      !(r.probability === 'high' && r.impact === 'high')
    ).length;

    if (highRisks >= 2) return 'high';
    if (highRisks >= 1 || mediumHighRisks >= 3) return 'medium';
    return 'low';
  }

  private extractFinancialItems(items: any[], defaultFrequency: FinancialItem['frequency']): FinancialItem[] {
    if (!Array.isArray(items)) return [];
    
    return items.map((item: any) => ({
      category: item.category || 'Other',
      description: item.description || item.name || '',
      amount: item.amount || item.cost || 0,
      frequency: item.frequency || defaultFrequency,
    }));
  }
}
