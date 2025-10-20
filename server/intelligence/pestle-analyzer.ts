/**
 * PESTLE Analyzer
 * 
 * Extracts strategic insights from PESTLE macro-environmental analysis using
 * documented mappings from docs/journey-to-epm-mappings.md
 * 
 * Key PESTLE → EPM Mappings:
 * - Political: Regulatory compliance workstreams, government stakeholders, policy risks
 * - Economic: Financial planning, market opportunity benefits, economic risks
 * - Social: Customer engagement workstreams, demographic stakeholders, cultural risks
 * - Technological: Innovation workstreams, tech resources, digital transformation
 * - Legal: Compliance workstreams, legal risks, regulatory stakeholders
 * - Environmental: Sustainability workstreams, ESG benefits, climate risks
 */

import type {
  FrameworkAnalyzer,
  PESTLEResults,
  PESTLEFactor,
  StrategyInsights,
  StrategyInsight,
} from './types';

export class PESTLEAnalyzer implements FrameworkAnalyzer<PESTLEResults> {
  
  async analyze(frameworkResults: PESTLEResults): Promise<StrategyInsights> {
    const insights: StrategyInsight[] = [];

    // Extract insights from each PESTLE factor
    insights.push(...await this.extractWorkstreams(frameworkResults));
    insights.push(...await this.extractResources(frameworkResults));
    insights.push(...await this.extractRisks(frameworkResults));
    insights.push(...await this.extractStakeholders(frameworkResults));
    insights.push(...await this.extractBenefits(frameworkResults));
    insights.push(...await this.extractCosts(frameworkResults));
    
    const timelineInsight = await this.inferTimeline(frameworkResults);
    insights.push(timelineInsight);

    // Add strategic recommendations
    if (frameworkResults.strategicRecommendations) {
      frameworkResults.strategicRecommendations.forEach((rec, idx) => {
        insights.push({
          type: 'other',
          source: `PESTLE.strategicRecommendations[${idx}]`,
          content: rec,
          confidence: 0.85,
          reasoning: 'Strategic recommendation from PESTLE analysis',
        });
      });
    }

    // Add cross-factor insights
    if (frameworkResults.crossFactorInsights) {
      frameworkResults.crossFactorInsights.synergies?.forEach((synergy, idx) => {
        insights.push({
          type: 'other',
          source: `PESTLE.synergies[${idx}]`,
          content: `Synergy: ${synergy}`,
          confidence: 0.80,
          reasoning: 'Cross-factor synergy identified',
        });
      });

      frameworkResults.crossFactorInsights.conflicts?.forEach((conflict, idx) => {
        insights.push({
          type: 'risk',
          source: `PESTLE.conflicts[${idx}]`,
          content: `Factor Conflict: ${conflict}`,
          confidence: 0.75,
          reasoning: 'Cross-factor conflict creates strategic tension',
          metadata: { severity: 'Medium', category: 'Strategic' },
        });
      });
    }

    const overallConfidence = this.calculateConfidence(insights);

    return {
      frameworkType: 'pestle',
      frameworkRunId: 'pestle-run-id', // Will be set by caller
      insights,
      marketContext: {
        urgency: this.inferUrgency(frameworkResults),
        riskTolerance: this.inferRiskTolerance(frameworkResults),
      },
      overallConfidence,
    };
  }

  async extractWorkstreams(frameworkResults: PESTLEResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // 1. POLITICAL workstreams - Regulatory compliance and government relations
    if (frameworkResults.political.opportunities.length > 0) {
      frameworkResults.political.opportunities.forEach((opp, idx) => {
        insights.push({
          type: 'workstream',
          source: `PESTLE.political.opportunities[${idx}]`,
          content: `Policy Opportunity: ${opp.description}\nRequirements: ${opp.requirements.join(', ')}`,
          confidence: 0.75,
          reasoning: 'Political opportunity requires strategic workstream',
          metadata: { category: 'Political', factor: 'Political' },
        });
      });
    }

    if (frameworkResults.political.trends.some(t => t.strength > 6)) {
      insights.push({
        type: 'workstream',
        source: 'PESTLE.political',
        content: 'Regulatory Compliance & Government Affairs\nMonitor policy changes and ensure regulatory compliance',
        confidence: 0.80,
        reasoning: 'Strong political trends require proactive government relations',
        metadata: { category: 'Compliance', factor: 'Political' },
      });
    }

    // 2. ECONOMIC workstreams - Market adaptation and financial planning
    if (frameworkResults.economic.trends.some(t => t.strength > 6)) {
      insights.push({
        type: 'workstream',
        source: 'PESTLE.economic',
        content: 'Economic Adaptation & Financial Resilience\nAdapt pricing, costs, and investments to economic conditions',
        confidence: 0.75,
        reasoning: 'Strong economic trends require strategic financial adaptation',
        metadata: { category: 'Financial', factor: 'Economic' },
      });
    }

    frameworkResults.economic.opportunities.forEach((opp, idx) => {
      insights.push({
        type: 'workstream',
        source: `PESTLE.economic.opportunities[${idx}]`,
        content: `Economic Opportunity: ${opp.description}\nRequirements: ${opp.requirements.join(', ')}`,
        confidence: 0.70,
        reasoning: 'Economic opportunity workstream',
        metadata: { category: 'Market Expansion', factor: 'Economic' },
      });
    });

    // 3. SOCIAL workstreams - Customer engagement and cultural adaptation
    if (frameworkResults.social.trends.length > 0) {
      const strongSocialTrends = frameworkResults.social.trends.filter(t => t.strength > 6);
      if (strongSocialTrends.length > 0) {
        insights.push({
          type: 'workstream',
          source: 'PESTLE.social',
          content: `Social Trend Adaptation\nRespond to: ${strongSocialTrends.map(t => t.description).join('; ')}`,
          confidence: 0.75,
          reasoning: 'Strong social trends require market adaptation',
          metadata: { category: 'Customer Engagement', factor: 'Social' },
        });
      }
    }

    frameworkResults.social.opportunities.forEach((opp, idx) => {
      insights.push({
        type: 'workstream',
        source: `PESTLE.social.opportunities[${idx}]`,
        content: `Social Opportunity: ${opp.description}\nRequirements: ${opp.requirements.join(', ')}`,
        confidence: 0.70,
        reasoning: 'Social opportunity workstream',
        metadata: { category: 'Market Positioning', factor: 'Social' },
      });
    });

    // 4. TECHNOLOGICAL workstreams - Innovation and digital transformation
    if (frameworkResults.technological.trends.some(t => t.strength > 6)) {
      insights.push({
        type: 'workstream',
        source: 'PESTLE.technological',
        content: 'Digital Transformation & Technology Adoption\nLeverage emerging technologies for competitive advantage',
        confidence: 0.80,
        reasoning: 'Strong technology trends require innovation response',
        metadata: { category: 'Innovation', factor: 'Technological' },
      });
    }

    frameworkResults.technological.opportunities.forEach((opp, idx) => {
      insights.push({
        type: 'workstream',
        source: `PESTLE.technological.opportunities[${idx}]`,
        content: `Technology Opportunity: ${opp.description}\nRequirements: ${opp.requirements.join(', ')}`,
        confidence: 0.75,
        reasoning: 'Technology opportunity workstream',
        metadata: { category: 'Innovation', factor: 'Technological' },
      });
    });

    // 5. LEGAL workstreams - Compliance and legal risk management
    if (frameworkResults.legal.trends.some(t => t.strength > 5) || frameworkResults.legal.risks.length > 0) {
      insights.push({
        type: 'workstream',
        source: 'PESTLE.legal',
        content: 'Legal Compliance & Risk Management\nEnsure adherence to legal requirements and manage legal exposure',
        confidence: 0.85,
        reasoning: 'Legal trends/risks require dedicated compliance workstream',
        metadata: { category: 'Compliance', factor: 'Legal' },
      });
    }

    // 6. ENVIRONMENTAL workstreams - Sustainability and ESG
    if (frameworkResults.environmental.trends.some(t => t.strength > 5) || frameworkResults.environmental.opportunities.length > 0) {
      insights.push({
        type: 'workstream',
        source: 'PESTLE.environmental',
        content: 'Sustainability & ESG Initiative\nImplement environmental best practices and reduce carbon footprint',
        confidence: 0.75,
        reasoning: 'Environmental trends require sustainability focus',
        metadata: { category: 'Sustainability', factor: 'Environmental' },
      });
    }

    frameworkResults.environmental.opportunities.forEach((opp, idx) => {
      insights.push({
        type: 'workstream',
        source: `PESTLE.environmental.opportunities[${idx}]`,
        content: `Environmental Opportunity: ${opp.description}\nRequirements: ${opp.requirements.join(', ')}`,
        confidence: 0.70,
        reasoning: 'Environmental opportunity workstream',
        metadata: { category: 'Sustainability', factor: 'Environmental' },
      });
    });

    return insights;
  }

  async extractResources(frameworkResults: PESTLEResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // Political/Legal resources - Compliance and government affairs
    if (frameworkResults.political.trends.some(t => t.strength > 5) || frameworkResults.legal.trends.some(t => t.strength > 5)) {
      insights.push({
        type: 'resource',
        source: 'PESTLE.political+legal',
        content: 'Regulatory Affairs: Compliance officers, legal counsel, government relations',
        confidence: 0.75,
        reasoning: 'Political and legal trends require regulatory expertise',
        metadata: { category: 'Compliance' },
      });
    }

    // Technological resources - Tech talent and infrastructure
    if (frameworkResults.technological.trends.some(t => t.strength > 6)) {
      insights.push({
        type: 'resource',
        source: 'PESTLE.technological',
        content: 'Technology Team: Software engineers, data scientists, digital strategists',
        confidence: 0.80,
        reasoning: 'Strong technology trends require technical capabilities',
        metadata: { category: 'Technology' },
      });
    }

    // Social resources - Marketing and customer insights
    if (frameworkResults.social.trends.some(t => t.strength > 5)) {
      insights.push({
        type: 'resource',
        source: 'PESTLE.social',
        content: 'Customer Insights: Market researchers, customer experience, cultural advisors',
        confidence: 0.70,
        reasoning: 'Social trends require deep customer understanding',
        metadata: { category: 'Customer' },
      });
    }

    // Environmental resources - Sustainability expertise
    if (frameworkResults.environmental.trends.some(t => t.strength > 5)) {
      insights.push({
        type: 'resource',
        source: 'PESTLE.environmental',
        content: 'Sustainability Team: ESG specialists, environmental consultants, carbon auditors',
        confidence: 0.70,
        reasoning: 'Environmental trends require sustainability expertise',
        metadata: { category: 'Sustainability' },
      });
    }

    // Economic resources - Financial planning
    if (frameworkResults.economic.risks.some(r => r.probability > 0.5)) {
      insights.push({
        type: 'resource',
        source: 'PESTLE.economic',
        content: 'Financial Planning: Economists, financial analysts, risk managers',
        confidence: 0.75,
        reasoning: 'Economic risks require financial planning capabilities',
        metadata: { category: 'Financial' },
      });
    }

    return insights;
  }

  async extractRisks(frameworkResults: PESTLEResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // Extract risks from each factor
    const factors: Array<{ name: string; factor: PESTLEFactor; category: string }> = [
      { name: 'Political', factor: frameworkResults.political, category: 'Political' },
      { name: 'Economic', factor: frameworkResults.economic, category: 'Economic' },
      { name: 'Social', factor: frameworkResults.social, category: 'Social' },
      { name: 'Technological', factor: frameworkResults.technological, category: 'Technological' },
      { name: 'Legal', factor: frameworkResults.legal, category: 'Legal' },
      { name: 'Environmental', factor: frameworkResults.environmental, category: 'Environmental' },
    ];

    factors.forEach(({ name, factor, category }) => {
      factor.risks.forEach((risk, idx) => {
        insights.push({
          type: 'risk',
          source: `PESTLE.${name.toLowerCase()}.risks[${idx}]`,
          content: risk.description,
          confidence: 0.85,
          reasoning: `${name} risk from PESTLE analysis`,
          metadata: {
            severity: risk.impact,
            category,
            probability: Math.round(risk.probability * 100),
          },
        });
      });
    });

    // Infer systemic risks from multiple negative trends
    const negativeFactors = factors.filter(f => 
      f.factor.risks.length > 2 || f.factor.trends.some(t => t.strength > 7)
    );

    if (negativeFactors.length >= 3) {
      insights.push({
        type: 'risk',
        source: 'PESTLE.inference',
        content: `Macro-Environmental Headwinds: ${negativeFactors.length} of 6 PESTLE factors showing significant challenges`,
        confidence: 0.80,
        reasoning: 'Multiple environmental factors create systemic risk',
        metadata: {
          severity: 'High',
          category: 'Strategic',
          affectedFactors: negativeFactors.map(f => f.name),
        },
      });
    }

    return insights;
  }

  async extractStakeholders(frameworkResults: PESTLEResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // Political stakeholders - Government and regulators
    if (frameworkResults.political.trends.length > 0 || frameworkResults.political.risks.length > 0) {
      insights.push({
        type: 'stakeholder',
        source: 'PESTLE.political',
        content: 'Government & Regulatory Bodies: Policy makers, regulatory agencies',
        confidence: 0.80,
        reasoning: 'Political factor indicates government stakeholder importance',
        metadata: {
          power: 'High',
          interest: 'Medium',
          group: 'Regulatory',
        },
      });
    }

    // Social stakeholders - Communities and customers
    if (frameworkResults.social.trends.some(t => t.strength > 5)) {
      insights.push({
        type: 'stakeholder',
        source: 'PESTLE.social',
        content: 'Community & Social Groups: Customer segments, cultural communities, advocacy groups',
        confidence: 0.75,
        reasoning: 'Strong social trends indicate community stakeholder importance',
        metadata: {
          power: 'Medium',
          interest: 'High',
          group: 'Community',
        },
      });
    }

    // Environmental stakeholders - NGOs and activists
    if (frameworkResults.environmental.trends.some(t => t.strength > 5)) {
      insights.push({
        type: 'stakeholder',
        source: 'PESTLE.environmental',
        content: 'Environmental Stakeholders: NGOs, sustainability advocates, climate activists',
        confidence: 0.70,
        reasoning: 'Environmental trends indicate ESG stakeholder importance',
        metadata: {
          power: 'Medium',
          interest: 'High',
          group: 'Environmental',
        },
      });
    }

    // Technological stakeholders - Tech partners and providers
    if (frameworkResults.technological.opportunities.length > 0) {
      insights.push({
        type: 'stakeholder',
        source: 'PESTLE.technological',
        content: 'Technology Partners: Software vendors, tech consultants, innovation labs',
        confidence: 0.70,
        reasoning: 'Technology opportunities require tech partnership stakeholders',
        metadata: {
          power: 'Medium',
          interest: 'High',
          group: 'Technology',
        },
      });
    }

    // Legal stakeholders
    if (frameworkResults.legal.risks.length > 0) {
      insights.push({
        type: 'stakeholder',
        source: 'PESTLE.legal',
        content: 'Legal Authorities: Courts, legal regulators, compliance auditors',
        confidence: 0.75,
        reasoning: 'Legal risks indicate regulatory stakeholder importance',
        metadata: {
          power: 'High',
          interest: 'Medium',
          group: 'Legal',
        },
      });
    }

    // Economic stakeholders - Investors and financial partners
    if (frameworkResults.economic.risks.length > 0 || frameworkResults.economic.opportunities.length > 0) {
      insights.push({
        type: 'stakeholder',
        source: 'PESTLE.economic',
        content: 'Financial Stakeholders: Investors, lenders, financial partners',
        confidence: 0.75,
        reasoning: 'Economic factors indicate financial stakeholder importance',
        metadata: {
          power: 'High',
          interest: 'High',
          group: 'Financial',
        },
      });
    }

    return insights;
  }

  async extractBenefits(frameworkResults: PESTLEResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // Extract opportunities from each factor
    const factors: Array<{ name: string; factor: PESTLEFactor; category: string }> = [
      { name: 'Political', factor: frameworkResults.political, category: 'Strategic' },
      { name: 'Economic', factor: frameworkResults.economic, category: 'Financial' },
      { name: 'Social', factor: frameworkResults.social, category: 'Strategic' },
      { name: 'Technological', factor: frameworkResults.technological, category: 'Strategic' },
      { name: 'Legal', factor: frameworkResults.legal, category: 'Strategic' },
      { name: 'Environmental', factor: frameworkResults.environmental, category: 'Strategic' },
    ];

    factors.forEach(({ name, factor, category }) => {
      factor.opportunities.forEach((opp, idx) => {
        insights.push({
          type: 'benefit',
          source: `PESTLE.${name.toLowerCase()}.opportunities[${idx}]`,
          content: `${name} Benefit: ${opp.description} (Potential: ${opp.potential})`,
          confidence: 0.75,
          reasoning: `Opportunity from ${name} factor analysis`,
          metadata: { category },
        });
      });
    });

    // Favorable trend benefits
    factors.forEach(({ name, factor, category }) => {
      const strongPositiveTrends = factor.trends.filter(t => 
        t.strength > 6 && !t.description.toLowerCase().includes('threat')
      );
      
      if (strongPositiveTrends.length > 0) {
        insights.push({
          type: 'benefit',
          source: `PESTLE.${name.toLowerCase()}`,
          content: `${name} Advantage: Favorable trends in ${name.toLowerCase()} environment`,
          confidence: 0.70,
          reasoning: 'Strong positive trends create strategic advantage',
          metadata: { category },
        });
      }
    });

    return insights;
  }

  async extractCosts(frameworkResults: PESTLEResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // Compliance costs from legal/political
    if (frameworkResults.legal.trends.some(t => t.strength > 5) || frameworkResults.political.trends.some(t => t.strength > 5)) {
      insights.push({
        type: 'cost',
        source: 'PESTLE.legal+political',
        content: 'Regulatory Compliance Costs: Legal fees, compliance systems, audits',
        confidence: 0.75,
        reasoning: 'Legal and political requirements generate compliance costs',
        metadata: { estimatedAmount: 200000 },
      });
    }

    // Technology investment costs
    if (frameworkResults.technological.opportunities.length > 0 || frameworkResults.technological.trends.some(t => t.strength > 6)) {
      insights.push({
        type: 'cost',
        source: 'PESTLE.technological',
        content: 'Technology Investment: Software, infrastructure, digital transformation',
        confidence: 0.70,
        reasoning: 'Technology trends require investment in digital capabilities',
        metadata: { estimatedAmount: 300000 },
      });
    }

    // Sustainability costs
    if (frameworkResults.environmental.trends.some(t => t.strength > 5)) {
      insights.push({
        type: 'cost',
        source: 'PESTLE.environmental',
        content: 'Sustainability Investment: ESG programs, carbon reduction, environmental compliance',
        confidence: 0.70,
        reasoning: 'Environmental trends require sustainability investments',
        metadata: { estimatedAmount: 150000 },
      });
    }

    // Market adaptation costs
    if (frameworkResults.social.trends.some(t => t.strength > 6)) {
      insights.push({
        type: 'cost',
        source: 'PESTLE.social',
        content: 'Market Adaptation: Customer research, product adjustments, cultural training',
        confidence: 0.65,
        reasoning: 'Social trends require market adaptation investments',
        metadata: { estimatedAmount: 100000 },
      });
    }

    return insights;
  }

  async inferTimeline(frameworkResults: PESTLEResults): Promise<StrategyInsight> {
    let urgency: 'ASAP' | 'Strategic' | 'Exploratory' = 'Strategic';
    let confidence = 0.70;
    let reasoning = 'Default strategic timeline based on macro-environmental analysis';

    // Count high-urgency factors
    const urgentFactors = [
      frameworkResults.political,
      frameworkResults.economic,
      frameworkResults.social,
      frameworkResults.technological,
      frameworkResults.legal,
      frameworkResults.environmental,
    ].filter(factor => {
      // Urgent if: many risks OR very strong trends (>8)
      return factor.risks.length > 3 || factor.trends.some(t => t.strength > 8);
    });

    if (urgentFactors.length >= 3) {
      urgency = 'ASAP';
      confidence = 0.80;
      reasoning = `${urgentFactors.length} PESTLE factors showing urgent trends/risks requiring rapid response`;
    } else if (urgentFactors.length === 0) {
      // Stable environment = can take time
      urgency = 'Exploratory';
      confidence = 0.75;
      reasoning = 'Stable macro-environment allows for deliberate strategic planning';
    }

    return {
      type: 'timeline',
      source: 'PESTLE.inference',
      content: `Recommended timeline: ${urgency === 'ASAP' ? '6' : urgency === 'Exploratory' ? '18' : '12'} months based on environmental urgency`,
      confidence,
      reasoning,
      metadata: {
        urgency,
        urgentFactors: urgentFactors.length,
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

  private inferUrgency(frameworkResults: PESTLEResults): 'ASAP' | 'Strategic' | 'Exploratory' {
    const urgentFactors = [
      frameworkResults.political,
      frameworkResults.economic,
      frameworkResults.social,
      frameworkResults.technological,
      frameworkResults.legal,
      frameworkResults.environmental,
    ].filter(factor => factor.risks.length > 3 || factor.trends.some(t => t.strength > 8));

    if (urgentFactors.length >= 3) return 'ASAP';
    if (urgentFactors.length === 0) return 'Exploratory';
    return 'Strategic';
  }

  private inferRiskTolerance(frameworkResults: PESTLEResults): 'Conservative' | 'Moderate' | 'Aggressive' | undefined {
    const totalRisks = [
      frameworkResults.political,
      frameworkResults.economic,
      frameworkResults.social,
      frameworkResults.technological,
      frameworkResults.legal,
      frameworkResults.environmental,
    ].reduce((sum, factor) => sum + factor.risks.length, 0);

    const totalOpportunities = [
      frameworkResults.political,
      frameworkResults.economic,
      frameworkResults.social,
      frameworkResults.technological,
      frameworkResults.legal,
      frameworkResults.environmental,
    ].reduce((sum, factor) => sum + factor.opportunities.length, 0);

    // High risk environment = conservative
    if (totalRisks > 10) return 'Conservative';
    
    // Many opportunities + few risks = aggressive
    if (totalOpportunities > 5 && totalRisks < 5) return 'Aggressive';
    
    return 'Moderate';
  }
}
