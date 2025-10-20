/**
 * Business Model Canvas Analyzer
 * 
 * Extracts strategic insights from BMC framework results using the documented
 * mappings from docs/journey-to-epm-mappings.md
 * 
 * Key BMC → EPM Mappings:
 * - Customer Segments → Target market, Stakeholders
 * - Value Propositions → Strategic objectives, Benefits
 * - Revenue Streams + Cost Structure → Financial envelope
 * - Key Activities → Workstreams
 * - Key Resources → Resource requirements
 * - Key Partnerships → External dependencies, Stakeholders
 * - Channels → Go-to-market workstream
 * - Contradictions → Risks
 * - Recommendations → Strategic imperatives
 */

import type {
  FrameworkAnalyzer,
  BMCResults,
  StrategyInsights,
  StrategyInsight,
} from './types';

export class BMCAnalyzer implements FrameworkAnalyzer<BMCResults> {
  
  async analyze(frameworkResults: BMCResults): Promise<StrategyInsights> {
    const insights: StrategyInsight[] = [];

    // Extract insights from each BMC component
    insights.push(...await this.extractWorkstreams(frameworkResults));
    insights.push(...await this.extractResources(frameworkResults));
    insights.push(...await this.extractRisks(frameworkResults));
    insights.push(...await this.extractStakeholders(frameworkResults));
    insights.push(...await this.extractBenefits(frameworkResults));
    insights.push(...await this.extractCosts(frameworkResults));
    
    const timelineInsight = await this.inferTimeline(frameworkResults);
    insights.push(timelineInsight);

    // Add executive summary insight
    if (frameworkResults.executiveSummary) {
      insights.push({
        type: 'other',
        source: 'BMC.executiveSummary',
        content: frameworkResults.executiveSummary,
        confidence: 0.95,
        reasoning: 'Direct extraction from BMC executive summary',
      });
    }

    // Add recommendations as strategic insights
    if (frameworkResults.recommendations) {
      frameworkResults.recommendations.forEach((rec, idx) => {
        insights.push({
          type: 'other',
          source: `BMC.recommendations[${idx}]`,
          content: rec,
          confidence: 0.85,
          reasoning: 'Strategic recommendation from BMC analysis',
        });
      });
    }

    const overallConfidence = this.calculateConfidence(insights);

    return {
      frameworkType: 'bmc',
      frameworkRunId: 'bmc-run-id', // This will be set by the caller
      insights,
      marketContext: {
        urgency: this.inferUrgency(frameworkResults),
        budgetRange: this.inferBudgetRange(frameworkResults),
        riskTolerance: this.inferRiskTolerance(frameworkResults),
      },
      overallConfidence,
    };
  }

  async extractWorkstreams(frameworkResults: BMCResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // 1. Extract from Key Activities (PRIMARY SOURCE)
    if (frameworkResults.keyActivities) {
      const activities = this.parseMultiLineContent(frameworkResults.keyActivities);
      activities.forEach((activity, idx) => {
        insights.push({
          type: 'workstream',
          source: `BMC.keyActivities[${idx}]`,
          content: activity,
          confidence: 0.85,
          reasoning: 'Direct extraction from Key Activities',
          metadata: { category: 'Core Operations' },
        });
      });
    }

    // 2. Extract from Channels (Go-to-Market workstream)
    if (frameworkResults.channels) {
      insights.push({
        type: 'workstream',
        source: 'BMC.channels',
        content: `Go-to-Market Strategy\n${frameworkResults.channels}`,
        confidence: 0.80,
        reasoning: 'Channels mapped to go-to-market workstream',
        metadata: { category: 'Market Access' },
      });
    }

    // 3. Extract from Customer Relationships (Customer Success workstream)
    if (frameworkResults.customerRelationships) {
      insights.push({
        type: 'workstream',
        source: 'BMC.customerRelationships',
        content: `Customer Success & Retention\n${frameworkResults.customerRelationships}`,
        confidence: 0.75,
        reasoning: 'Customer relationships mapped to success workstream',
        metadata: { category: 'Customer Management' },
      });
    }

    // 4. Infer Technology/Platform workstream if tech-related
    if (this.involvesTechnology(frameworkResults)) {
      insights.push({
        type: 'workstream',
        source: 'BMC.inference',
        content: 'Technology Platform Development\nBuild and maintain core platform capabilities',
        confidence: 0.70,
        reasoning: 'Inferred from technology-related key activities',
        metadata: { category: 'Technology' },
      });
    }

    return insights;
  }

  async extractResources(frameworkResults: BMCResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // Extract from Key Resources
    if (frameworkResults.keyResources) {
      const resources = this.parseMultiLineContent(frameworkResults.keyResources);
      resources.forEach((resource, idx) => {
        insights.push({
          type: 'resource',
          source: `BMC.keyResources[${idx}]`,
          content: resource,
          confidence: 0.80,
          reasoning: 'Direct extraction from Key Resources',
          metadata: {
            category: this.categorizeResource(resource),
          },
        });
      });
    }

    // Infer technical resources if technology workstream
    if (this.involvesTechnology(frameworkResults)) {
      insights.push({
        type: 'resource',
        source: 'BMC.inference',
        content: 'Software Engineers, DevOps, Technical Infrastructure',
        confidence: 0.70,
        reasoning: 'Inferred technical resources from technology-related activities',
        metadata: { category: 'Technical' },
      });
    }

    return insights;
  }

  async extractRisks(frameworkResults: BMCResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // 1. Extract from Contradictions (PRIMARY SOURCE for risks)
    if (frameworkResults.contradictions && frameworkResults.contradictions.length > 0) {
      frameworkResults.contradictions.forEach((contradiction, idx) => {
        insights.push({
          type: 'risk',
          source: `BMC.contradictions[${idx}]`,
          content: contradiction,
          confidence: 0.90, // HIGH confidence - explicit contradictions
          reasoning: 'Contradiction indicates strategic risk',
          metadata: {
            severity: this.assessContradictionSeverity(contradiction),
          },
        });
      });
    }

    // 2. Infer dependency risks from Key Partnerships
    if (frameworkResults.keyPartnerships) {
      const partners = this.parseMultiLineContent(frameworkResults.keyPartnerships);
      if (partners.length > 0) {
        insights.push({
          type: 'risk',
          source: 'BMC.keyPartnerships',
          content: `Partner dependency risk: Reliance on ${partners.length} key partner${partners.length > 1 ? 's' : ''} creates operational dependencies`,
          confidence: 0.75,
          reasoning: 'Multiple key partnerships introduce dependency risks',
          metadata: { severity: partners.length > 3 ? 'High' : 'Medium' },
        });
      }
    }

    // 3. Infer market risks from Customer Segments
    if (frameworkResults.customerSegments) {
      const segments = this.parseMultiLineContent(frameworkResults.customerSegments);
      if (segments.length > 3) {
        insights.push({
          type: 'risk',
          source: 'BMC.customerSegments',
          content: 'Market focus risk: Targeting multiple customer segments may dilute go-to-market effectiveness',
          confidence: 0.70,
          reasoning: 'Multiple customer segments increase execution complexity',
          metadata: { severity: 'Medium' },
        });
      }
    }

    // 4. Infer financial risks from Cost Structure
    if (frameworkResults.costStructure && frameworkResults.costStructure.toLowerCase().includes('high')) {
      insights.push({
        type: 'risk',
        source: 'BMC.costStructure',
        content: 'Financial risk: High cost structure requires strong revenue generation to achieve profitability',
        confidence: 0.65,
        reasoning: 'High costs mentioned in cost structure',
        metadata: { severity: 'High' },
      });
    }

    // 5. Technology execution risks
    if (this.involvesTechnology(frameworkResults)) {
      insights.push({
        type: 'risk',
        source: 'BMC.inference',
        content: 'Technical execution risk: Technology development timelines and complexity may exceed estimates',
        confidence: 0.70,
        reasoning: 'Technology projects commonly face execution risks',
        metadata: { severity: 'Medium' },
      });
    }

    return insights;
  }

  async extractStakeholders(frameworkResults: BMCResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // 1. Extract from Customer Segments
    if (frameworkResults.customerSegments) {
      const segments = this.parseMultiLineContent(frameworkResults.customerSegments);
      segments.forEach((segment, idx) => {
        insights.push({
          type: 'stakeholder',
          source: `BMC.customerSegments[${idx}]`,
          content: `Customer Segment: ${segment}`,
          confidence: 0.90,
          reasoning: 'Customer segments are key stakeholders',
          metadata: { 
            power: 'High', 
            interest: 'High',
            group: 'Customers',
          },
        });
      });
    }

    // 2. Extract from Key Partnerships
    if (frameworkResults.keyPartnerships) {
      const partners = this.parseMultiLineContent(frameworkResults.keyPartnerships);
      partners.forEach((partner, idx) => {
        insights.push({
          type: 'stakeholder',
          source: `BMC.keyPartnerships[${idx}]`,
          content: `Key Partner: ${partner}`,
          confidence: 0.85,
          reasoning: 'Key partnerships are critical stakeholders',
          metadata: {
            power: 'High',
            interest: 'Medium',
            group: 'Partners',
          },
        });
      });
    }

    // 3. Infer internal stakeholders
    insights.push({
      type: 'stakeholder',
      source: 'BMC.inference',
      content: 'Internal Team: Product, Engineering, Sales, Marketing',
      confidence: 0.80,
      reasoning: 'Internal teams required to execute business model',
      metadata: {
        power: 'Medium',
        interest: 'High',
        group: 'Internal',
      },
    });

    // 4. Infer investor stakeholders if revenue/financial focus
    if (frameworkResults.revenueStreams) {
      insights.push({
        type: 'stakeholder',
        source: 'BMC.revenueStreams',
        content: 'Investors/Board: Financial stakeholders requiring return on investment',
        confidence: 0.75,
        reasoning: 'Revenue model requires financial backing',
        metadata: {
          power: 'High',
          interest: 'High',
          group: 'Financial',
        },
      });
    }

    return insights;
  }

  async extractBenefits(frameworkResults: BMCResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // 1. Extract from Value Propositions (STRATEGIC BENEFITS)
    if (frameworkResults.valuePropositions) {
      const props = this.parseMultiLineContent(frameworkResults.valuePropositions);
      props.forEach((prop, idx) => {
        insights.push({
          type: 'benefit',
          source: `BMC.valuePropositions[${idx}]`,
          content: `Strategic benefit: ${prop}`,
          confidence: 0.85,
          reasoning: 'Value propositions deliver customer and strategic benefits',
          metadata: { category: 'Strategic' },
        });
      });
    }

    // 2. Extract from Revenue Streams (FINANCIAL BENEFITS)
    if (frameworkResults.revenueStreams) {
      insights.push({
        type: 'benefit',
        source: 'BMC.revenueStreams',
        content: `Revenue generation: ${frameworkResults.revenueStreams}`,
        confidence: 0.90,
        reasoning: 'Revenue streams represent financial benefits',
        metadata: { category: 'Financial' },
      });
    }

    // 3. Infer operational benefits from Key Activities
    if (frameworkResults.keyActivities) {
      if (frameworkResults.keyActivities.toLowerCase().includes('automat') ||
          frameworkResults.keyActivities.toLowerCase().includes('efficienc')) {
        insights.push({
          type: 'benefit',
          source: 'BMC.keyActivities',
          content: 'Operational efficiency: Automated processes reduce operational costs',
          confidence: 0.70,
          reasoning: 'Automation/efficiency mentioned in key activities',
          metadata: { category: 'Operational' },
        });
      }
    }

    // 4. Infer market benefits from Customer Segments
    if (frameworkResults.customerSegments) {
      const segments = this.parseMultiLineContent(frameworkResults.customerSegments);
      if (segments.length > 0) {
        insights.push({
          type: 'benefit',
          source: 'BMC.customerSegments',
          content: `Market expansion: Access to ${segments.length} customer segment${segments.length > 1 ? 's' : ''}`,
          confidence: 0.75,
          reasoning: 'Multiple customer segments provide market diversification',
          metadata: { category: 'Strategic' },
        });
      }
    }

    return insights;
  }

  async extractCosts(frameworkResults: BMCResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // Extract from Cost Structure
    if (frameworkResults.costStructure) {
      const costs = this.parseMultiLineContent(frameworkResults.costStructure);
      costs.forEach((cost, idx) => {
        insights.push({
          type: 'cost',
          source: `BMC.costStructure[${idx}]`,
          content: cost,
          confidence: 0.85,
          reasoning: 'Direct extraction from cost structure',
          metadata: {
            estimatedAmount: this.estimateCostAmount(cost),
          },
        });
      });
    }

    // Infer resource costs from Key Resources
    if (frameworkResults.keyResources) {
      const resources = this.parseMultiLineContent(frameworkResults.keyResources);
      const humanResources = resources.filter(r => 
        r.toLowerCase().includes('team') || 
        r.toLowerCase().includes('engineer') ||
        r.toLowerCase().includes('staff')
      );
      
      if (humanResources.length > 0) {
        insights.push({
          type: 'cost',
          source: 'BMC.keyResources',
          content: `Personnel costs: Team staffing and talent acquisition`,
          confidence: 0.80,
          reasoning: 'Human resources require personnel budget',
          metadata: { estimatedAmount: 500000 }, // Base estimate
        });
      }
    }

    return insights;
  }

  async inferTimeline(frameworkResults: BMCResults): Promise<StrategyInsight> {
    // Analyze urgency signals from BMC
    let urgency: 'ASAP' | 'Strategic' | 'Exploratory' = 'Strategic';
    let confidence = 0.65;
    let reasoning = 'Default strategic timeline (12 months)';

    // Check for urgency indicators
    const allText = Object.values(frameworkResults).join(' ').toLowerCase();
    
    if (allText.includes('urgent') || allText.includes('immediate') || allText.includes('asap')) {
      urgency = 'ASAP';
      confidence = 0.75;
      reasoning = 'Urgency keywords detected → 6-month timeline';
    } else if (allText.includes('exploration') || allText.includes('experiment') || allText.includes('test')) {
      urgency = 'Exploratory';
      confidence = 0.70;
      reasoning = 'Exploratory keywords detected → 18-month timeline';
    }

    // Count complexity factors
    const activityCount = this.parseMultiLineContent(frameworkResults.keyActivities || '').length;
    const segmentCount = this.parseMultiLineContent(frameworkResults.customerSegments || '').length;
    const partnerCount = this.parseMultiLineContent(frameworkResults.keyPartnerships || '').length;
    
    const complexity = activityCount + segmentCount + partnerCount;
    
    if (complexity > 10) {
      reasoning += '; High complexity may extend timeline';
    }

    return {
      type: 'timeline',
      source: 'BMC.inference',
      content: `Recommended timeline: ${urgency === 'ASAP' ? '6' : urgency === 'Exploratory' ? '18' : '12'} months based on ${urgency.toLowerCase()} urgency`,
      confidence,
      reasoning,
      metadata: { 
        urgency,
        complexity,
        estimatedMonths: urgency === 'ASAP' ? 6 : urgency === 'Exploratory' ? 18 : 12,
      },
    };
  }

  calculateConfidence(insights: StrategyInsight[]): number {
    if (insights.length === 0) return 0.50;
    
    const avgConfidence = insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length;
    
    // Penalize if too few insights
    const insightPenalty = insights.length < 10 ? 0.05 : 0;
    
    // Penalize if missing key types
    const types = new Set(insights.map(i => i.type));
    const requiredTypes: Array<'workstream' | 'risk' | 'stakeholder' | 'benefit'> = ['workstream', 'risk', 'stakeholder', 'benefit'];
    const missingTypes = requiredTypes.filter(t => !types.has(t));
    const typePenalty = missingTypes.length * 0.03;
    
    return Math.max(0.5, Math.min(0.95, avgConfidence - insightPenalty - typePenalty));
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private parseMultiLineContent(content: string): string[] {
    if (!content) return [];
    
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
      .map(line => line.replace(/^[-•*]\s*/, '')) // Remove bullet points
      .filter(line => line.length > 5); // Filter out very short lines
  }

  private involvesTechnology(frameworkResults: BMCResults): boolean {
    const allText = Object.values(frameworkResults).join(' ').toLowerCase();
    const techKeywords = ['software', 'platform', 'app', 'digital', 'technology', 'ai', 'ml', 'algorithm', 'api'];
    return techKeywords.some(keyword => allText.includes(keyword));
  }

  private categorizeResource(resource: string): string {
    const lower = resource.toLowerCase();
    if (lower.includes('engineer') || lower.includes('developer') || lower.includes('technical')) return 'Technical';
    if (lower.includes('infrastructure') || lower.includes('platform') || lower.includes('server')) return 'Infrastructure';
    if (lower.includes('team') || lower.includes('staff') || lower.includes('talent')) return 'Human';
    if (lower.includes('data') || lower.includes('ip') || lower.includes('intellectual')) return 'Intellectual Property';
    return 'Other';
  }

  private assessContradictionSeverity(contradiction: string): string {
    const lower = contradiction.toLowerCase();
    if (lower.includes('critical') || lower.includes('catastrophic') || lower.includes('fatal')) return 'Critical';
    if (lower.includes('high') || lower.includes('significant') || lower.includes('major')) return 'High';
    if (lower.includes('medium') || lower.includes('moderate')) return 'Medium';
    return 'Low';
  }

  private estimateCostAmount(cost: string): number {
    // Try to extract dollar amounts
    const match = cost.match(/\$([0-9,]+)/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''));
    }
    
    // Estimate based on keywords
    const lower = cost.toLowerCase();
    if (lower.includes('infrastructure') || lower.includes('platform')) return 300000;
    if (lower.includes('personnel') || lower.includes('team') || lower.includes('staff')) return 500000;
    if (lower.includes('marketing') || lower.includes('sales')) return 200000;
    if (lower.includes('technology') || lower.includes('software')) return 150000;
    
    return 100000; // Default estimate
  }

  private inferUrgency(frameworkResults: BMCResults): 'ASAP' | 'Strategic' | 'Exploratory' {
    const allText = Object.values(frameworkResults).join(' ').toLowerCase();
    
    if (allText.includes('urgent') || allText.includes('immediate')) return 'ASAP';
    if (allText.includes('exploration') || allText.includes('experiment')) return 'Exploratory';
    return 'Strategic';
  }

  private inferBudgetRange(frameworkResults: BMCResults): string | undefined {
    // Extract from cost structure or revenue streams
    const costMatch = frameworkResults.costStructure?.match(/\$([0-9,]+)/);
    const revenueMatch = frameworkResults.revenueStreams?.match(/\$([0-9,]+)/);
    
    if (costMatch || revenueMatch) {
      const amount = Math.max(
        costMatch ? parseInt(costMatch[1].replace(/,/g, '')) : 0,
        revenueMatch ? parseInt(revenueMatch[1].replace(/,/g, '')) : 0
      );
      
      if (amount < 500000) return '$250k - $500k';
      if (amount < 1000000) return '$500k - $1M';
      if (amount < 2000000) return '$1M - $2M';
      return '$2M+';
    }
    
    return undefined;
  }

  private inferRiskTolerance(frameworkResults: BMCResults): 'Conservative' | 'Moderate' | 'Aggressive' | undefined {
    const contradictionCount = frameworkResults.contradictions?.length || 0;
    const allText = Object.values(frameworkResults).join(' ').toLowerCase();
    
    if (allText.includes('innovati') || allText.includes('disrupt')) {
      return 'Aggressive';
    }
    
    if (contradictionCount > 5) {
      return 'Conservative'; // Many risks = conservative approach
    }
    
    if (contradictionCount > 2) {
      return 'Moderate';
    }
    
    return undefined;
  }
}
