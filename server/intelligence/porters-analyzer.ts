/**
 * Porter's Five Forces Analyzer
 * 
 * Extracts strategic insights from Porter's Five Forces analysis using documented
 * mappings from docs/journey-to-epm-mappings.md
 * 
 * Key Porter's → EPM Mappings:
 * - Each Force (score 0-10) → Risk assessment (higher score = higher competitive pressure)
 * - Barriers to entry → Defensive workstreams to reinforce
 * - Competitive weaknesses → Offensive workstreams to exploit
 * - Supplier/Buyer power → Stakeholder management priorities
 * - Substitutes threat → Innovation/differentiation workstreams
 * - Strategic implications → Benefits and timeline urgency
 */

import type {
  FrameworkAnalyzer,
  PortersResults,
  PortersForce,
  StrategyInsights,
  StrategyInsight,
  RawReference,
} from './types';

export class PortersAnalyzer implements FrameworkAnalyzer<PortersResults> {
  
  /**
   * Generate references from Porter's Five Forces analysis
   */
  private generateReferences(frameworkResults: PortersResults): RawReference[] {
    const references: RawReference[] = [];
    
    // Create references for each force analysis
    const forces: Array<{ name: string; force: PortersForce }> = [
      { name: "Threat of New Entrants", force: frameworkResults.threatOfNewEntrants },
      { name: "Bargaining Power of Suppliers", force: frameworkResults.bargainingPowerOfSuppliers },
      { name: "Bargaining Power of Buyers", force: frameworkResults.bargainingPowerOfBuyers },
      { name: "Threat of Substitutes", force: frameworkResults.threatOfSubstitutes },
      { name: "Competitive Rivalry", force: frameworkResults.competitiveRivalry },
    ];
    
    forces.forEach(({ name, force }) => {
      references.push({
        title: `Porter's Five Forces: ${name}`,
        sourceType: 'internal_doc',
        description: force.analysis.substring(0, 200),
        topics: ["porter's five forces", name.toLowerCase(), 'competitive analysis'],
        confidence: force.score / 10, // Normalize 0-10 to 0-1
        snippet: force.analysis,
        origin: 'llm_generation',
      });
    });
    
    // Add overall attractiveness summary
    if (frameworkResults.overallAttractiveness?.summary) {
      references.push({
        title: "Porter's Five Forces: Market Attractiveness Summary",
        sourceType: 'internal_doc',
        description: frameworkResults.overallAttractiveness.summary.substring(0, 200),
        topics: ["porter's five forces", 'market attractiveness', 'strategic recommendations'],
        confidence: frameworkResults.overallAttractiveness.score / 10,
        snippet: frameworkResults.overallAttractiveness.summary,
        origin: 'llm_generation',
      });
    }
    
    return references;
  }
  
  async analyze(frameworkResults: PortersResults): Promise<StrategyInsights> {
    const insights: StrategyInsight[] = [];

    // Extract insights from each force
    insights.push(...await this.extractWorkstreams(frameworkResults));
    insights.push(...await this.extractResources(frameworkResults));
    insights.push(...await this.extractRisks(frameworkResults));
    insights.push(...await this.extractStakeholders(frameworkResults));
    insights.push(...await this.extractBenefits(frameworkResults));
    insights.push(...await this.extractCosts(frameworkResults));
    
    const timelineInsight = await this.inferTimeline(frameworkResults);
    insights.push(timelineInsight);

    // Add strategic implications as insights
    if (frameworkResults.strategicImplications) {
      frameworkResults.strategicImplications.forEach((implication, idx) => {
        insights.push({
          type: 'other',
          source: `Porters.strategicImplications[${idx}]`,
          content: implication,
          confidence: 0.85,
          reasoning: 'Strategic implication from Five Forces analysis',
        });
      });
    }

    // Add overall attractiveness summary
    if (frameworkResults.overallAttractiveness) {
      insights.push({
        type: 'other',
        source: 'Porters.overallAttractiveness',
        content: frameworkResults.overallAttractiveness.summary,
        confidence: 0.90,
        reasoning: 'Overall market attractiveness assessment',
      });
    }

    const overallConfidence = this.calculateConfidence(insights);
    const references = this.generateReferences(frameworkResults);

    return {
      frameworkType: 'porters',
      frameworkRunId: 'porters-run-id', // Will be set by caller
      insights,
      references,
      marketContext: {
        urgency: this.inferUrgency(frameworkResults),
        riskTolerance: this.inferRiskTolerance(frameworkResults),
      },
      overallConfidence,
    };
  }

  async extractWorkstreams(frameworkResults: PortersResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // 1. DEFENSIVE workstreams from barriers to entry
    if (frameworkResults.threatOfNewEntrants.barriers && frameworkResults.threatOfNewEntrants.barriers.length > 0) {
      frameworkResults.threatOfNewEntrants.barriers.forEach((barrier, idx) => {
        insights.push({
          type: 'workstream',
          source: `Porters.threatOfNewEntrants.barriers[${idx}]`,
          content: `Barrier Reinforcement: ${barrier}`,
          confidence: 0.80,
          reasoning: 'Strengthen existing barrier to entry',
          metadata: { category: 'Defensive', force: 'New Entrants' },
        });
      });
    }

    // 2. OFFENSIVE workstreams from competitive strategies
    if (frameworkResults.competitiveRivalry.strategies && frameworkResults.competitiveRivalry.strategies.length > 0) {
      frameworkResults.competitiveRivalry.strategies.forEach((strategy, idx) => {
        insights.push({
          type: 'workstream',
          source: `Porters.competitiveRivalry.strategies[${idx}]`,
          content: `Competitive Strategy: ${strategy}`,
          confidence: 0.85,
          reasoning: 'Offensive strategy to gain competitive advantage',
          metadata: { category: 'Offensive', force: 'Competitive Rivalry' },
        });
      });
    }

    // 3. SUPPLIER MANAGEMENT workstream
    if (frameworkResults.bargainingPowerOfSuppliers.score > 5) {
      insights.push({
        type: 'workstream',
        source: 'Porters.bargainingPowerOfSuppliers',
        content: `Supplier Diversification & Relationship Management\nReduce supplier power through multi-sourcing and strategic partnerships`,
        confidence: 0.75,
        reasoning: `High supplier power (score: ${frameworkResults.bargainingPowerOfSuppliers.score}/10) requires mitigation`,
        metadata: { category: 'Risk Mitigation', force: 'Supplier Power' },
      });

      // Add mitigations as workstreams
      if (frameworkResults.bargainingPowerOfSuppliers.mitigations) {
        frameworkResults.bargainingPowerOfSuppliers.mitigations.forEach((mitigation, idx) => {
          insights.push({
            type: 'workstream',
            source: `Porters.bargainingPowerOfSuppliers.mitigations[${idx}]`,
            content: `Supplier Mitigation: ${mitigation}`,
            confidence: 0.70,
            reasoning: 'Mitigation strategy for supplier power',
            metadata: { category: 'Risk Mitigation', force: 'Supplier Power' },
          });
        });
      }
    }

    // 4. BUYER RELATIONSHIP workstream
    if (frameworkResults.bargainingPowerOfBuyers.score > 5) {
      insights.push({
        type: 'workstream',
        source: 'Porters.bargainingPowerOfBuyers',
        content: `Customer Retention & Value Enhancement\nIncrease switching costs and strengthen buyer relationships`,
        confidence: 0.75,
        reasoning: `High buyer power (score: ${frameworkResults.bargainingPowerOfBuyers.score}/10) requires customer loyalty focus`,
        metadata: { category: 'Customer Management', force: 'Buyer Power' },
      });
    }

    // 5. INNOVATION/DIFFERENTIATION workstream (from substitutes threat)
    if (frameworkResults.threatOfSubstitutes.score > 5 || frameworkResults.threatOfSubstitutes.substitutes) {
      insights.push({
        type: 'workstream',
        source: 'Porters.threatOfSubstitutes',
        content: `Product Differentiation & Innovation\nDevelop unique value propositions to combat substitute threats`,
        confidence: 0.80,
        reasoning: `Substitutes threat (score: ${frameworkResults.threatOfSubstitutes.score}/10) requires differentiation`,
        metadata: { category: 'Innovation', force: 'Substitutes' },
      });

      // Add specific substitute defenses
      if (frameworkResults.threatOfSubstitutes.substitutes && frameworkResults.threatOfSubstitutes.substitutes.length > 0) {
        frameworkResults.threatOfSubstitutes.substitutes.forEach((substitute, idx) => {
          insights.push({
            type: 'workstream',
            source: `Porters.threatOfSubstitutes.substitutes[${idx}]`,
            content: `Substitute Defense: Counter ${substitute}`,
            confidence: 0.70,
            reasoning: 'Specific workstream to address substitute threat',
            metadata: { category: 'Defensive', force: 'Substitutes' },
          });
        });
      }
    }

    // 6. MARKET POSITIONING workstream (from recommendations)
    if (frameworkResults.overallAttractiveness?.recommendations) {
      frameworkResults.overallAttractiveness.recommendations.slice(0, 3).forEach((rec, idx) => {
        insights.push({
          type: 'workstream',
          source: `Porters.recommendations[${idx}]`,
          content: rec,
          confidence: 0.75,
          reasoning: 'Strategic recommendation from Five Forces analysis',
          metadata: { category: 'Strategic' },
        });
      });
    }

    return insights;
  }

  async extractResources(frameworkResults: PortersResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // Infer resources based on competitive intensity
    const avgForceScore = this.calculateAverageForceScore(frameworkResults);
    
    if (avgForceScore > 6) {
      // High competitive pressure = need strong execution team
      insights.push({
        type: 'resource',
        source: 'Porters.inference',
        content: 'Competitive Intelligence Team: Market analysts, competitive researchers',
        confidence: 0.75,
        reasoning: 'High competitive intensity requires dedicated market intelligence',
        metadata: { category: 'Competitive' },
      });
    }

    // If supplier power is high, need procurement expertise
    if (frameworkResults.bargainingPowerOfSuppliers.score > 6) {
      insights.push({
        type: 'resource',
        source: 'Porters.bargainingPowerOfSuppliers',
        content: 'Procurement & Supplier Relations: Sourcing specialists, vendor managers',
        confidence: 0.70,
        reasoning: 'High supplier power requires strong procurement capabilities',
        metadata: { category: 'Procurement' },
      });
    }

    // If innovation/differentiation needed, require R&D
    if (frameworkResults.threatOfSubstitutes.score > 5 || frameworkResults.competitiveRivalry.score > 7) {
      insights.push({
        type: 'resource',
        source: 'Porters.inference',
        content: 'Innovation Team: Product developers, R&D, design thinking experts',
        confidence: 0.70,
        reasoning: 'Differentiation requirements need innovation capabilities',
        metadata: { category: 'Innovation' },
      });
    }

    // Marketing resources for competitive positioning
    if (frameworkResults.competitiveRivalry.score > 5) {
      insights.push({
        type: 'resource',
        source: 'Porters.competitiveRivalry',
        content: 'Marketing & Brand: Brand strategists, marketing analysts, content creators',
        confidence: 0.70,
        reasoning: 'Competitive rivalry requires strong market positioning',
        metadata: { category: 'Marketing' },
      });
    }

    return insights;
  }

  async extractRisks(frameworkResults: PortersResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // Each force with score >5 is a risk
    const forces: Array<{ name: string; force: PortersForce; type: string }> = [
      { name: 'New Entrants', force: frameworkResults.threatOfNewEntrants, type: 'Market Entry' },
      { name: 'Supplier Power', force: frameworkResults.bargainingPowerOfSuppliers, type: 'Supply Chain' },
      { name: 'Buyer Power', force: frameworkResults.bargainingPowerOfBuyers, type: 'Customer' },
      { name: 'Substitutes', force: frameworkResults.threatOfSubstitutes, type: 'Product' },
      { name: 'Competitive Rivalry', force: frameworkResults.competitiveRivalry, type: 'Competitive' },
    ];

    forces.forEach(({ name, force, type }) => {
      // Direct risks from force analysis
      if (force.risks && force.risks.length > 0) {
        force.risks.forEach((risk, idx) => {
          insights.push({
            type: 'risk',
            source: `Porters.${name.replace(' ', '')}.risks[${idx}]`,
            content: risk,
            confidence: 0.85,
            reasoning: `Identified risk from ${name} force analysis`,
            metadata: { 
              severity: this.scoreToSeverity(force.score),
              category: type,
              forceScore: force.score,
            },
          });
        });
      }

      // Infer risk from high force scores
      if (force.score > 6 && (!force.risks || force.risks.length === 0)) {
        insights.push({
          type: 'risk',
          source: `Porters.${name.replace(' ', '')}`,
          content: `${name} Risk: High competitive pressure from ${name.toLowerCase()} (score: ${force.score}/10)`,
          confidence: 0.80,
          reasoning: 'High force score indicates significant competitive risk',
          metadata: {
            severity: this.scoreToSeverity(force.score),
            category: type,
            forceScore: force.score,
          },
        });
      }
    });

    // Competitive ecosystem risk if multiple forces are high
    const highForceCount = forces.filter(f => f.force.score > 6).length;
    if (highForceCount >= 3) {
      insights.push({
        type: 'risk',
        source: 'Porters.inference',
        content: `Hostile Competitive Environment: ${highForceCount} of 5 forces scoring high creates challenging market conditions`,
        confidence: 0.85,
        reasoning: 'Multiple high forces indicate difficult competitive landscape',
        metadata: {
          severity: 'High',
          category: 'Strategic',
          highForceCount,
        },
      });
    }

    // Low attractiveness overall is a strategic risk
    if (frameworkResults.overallAttractiveness.score < 5) {
      insights.push({
        type: 'risk',
        source: 'Porters.overallAttractiveness',
        content: `Market Attractiveness Risk: Overall industry attractiveness score of ${frameworkResults.overallAttractiveness.score}/10 suggests challenging market conditions`,
        confidence: 0.90,
        reasoning: 'Low overall attractiveness indicates strategic market risk',
        metadata: {
          severity: 'High',
          category: 'Strategic',
          attractivenessScore: frameworkResults.overallAttractiveness.score,
        },
      });
    }

    return insights;
  }

  async extractStakeholders(frameworkResults: PortersResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // 1. Competitors as stakeholders
    if (frameworkResults.competitiveRivalry.competitors && frameworkResults.competitiveRivalry.competitors.length > 0) {
      frameworkResults.competitiveRivalry.competitors.forEach((competitor, idx) => {
        insights.push({
          type: 'stakeholder',
          source: `Porters.competitiveRivalry.competitors[${idx}]`,
          content: `Competitor: ${competitor}`,
          confidence: 0.85,
          reasoning: 'Key competitor requiring monitoring and response',
          metadata: {
            power: 'High',
            interest: 'High',
            group: 'Competitors',
          },
        });
      });
    } else if (frameworkResults.competitiveRivalry.score > 5) {
      // Generic competitor stakeholder if specific ones not listed
      insights.push({
        type: 'stakeholder',
        source: 'Porters.competitiveRivalry',
        content: 'Competitive Landscape: Direct competitors requiring continuous monitoring',
        confidence: 0.75,
        reasoning: 'High competitive rivalry indicates significant competitor presence',
        metadata: {
          power: 'High',
          interest: 'High',
          group: 'Competitors',
        },
      });
    }

    // 2. Suppliers as stakeholders
    if (frameworkResults.bargainingPowerOfSuppliers.score > 4) {
      insights.push({
        type: 'stakeholder',
        source: 'Porters.bargainingPowerOfSuppliers',
        content: `Key Suppliers: Critical supply chain partners with ${frameworkResults.bargainingPowerOfSuppliers.score > 6 ? 'high' : 'moderate'} bargaining power`,
        confidence: 0.80,
        reasoning: 'Suppliers are key stakeholders based on their power',
        metadata: {
          power: frameworkResults.bargainingPowerOfSuppliers.score > 6 ? 'High' : 'Medium',
          interest: 'Medium',
          group: 'Suppliers',
        },
      });
    }

    // 3. Buyers/Customers as stakeholders
    if (frameworkResults.bargainingPowerOfBuyers.score > 4) {
      insights.push({
        type: 'stakeholder',
        source: 'Porters.bargainingPowerOfBuyers',
        content: `Customer Base: ${frameworkResults.bargainingPowerOfBuyers.score > 6 ? 'Powerful' : 'Influential'} buyers requiring value delivery`,
        confidence: 0.85,
        reasoning: 'Buyer power indicates customer stakeholder importance',
        metadata: {
          power: frameworkResults.bargainingPowerOfBuyers.score > 6 ? 'High' : 'Medium',
          interest: 'High',
          group: 'Customers',
        },
      });
    }

    // 4. Regulatory/Industry bodies (inferred from barriers)
    if (frameworkResults.threatOfNewEntrants.barriers) {
      const hasRegulatoryBarrier = frameworkResults.threatOfNewEntrants.barriers.some(b => 
        b.toLowerCase().includes('regulat') || b.toLowerCase().includes('compliance') || b.toLowerCase().includes('license')
      );
      
      if (hasRegulatoryBarrier) {
        insights.push({
          type: 'stakeholder',
          source: 'Porters.threatOfNewEntrants.barriers',
          content: 'Regulatory Bodies: Industry regulators and compliance authorities',
          confidence: 0.75,
          reasoning: 'Regulatory barriers indicate regulatory stakeholder importance',
          metadata: {
            power: 'High',
            interest: 'Medium',
            group: 'Regulatory',
          },
        });
      }
    }

    return insights;
  }

  async extractBenefits(frameworkResults: PortersResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // 1. Defensive positioning benefits (from low threat scores)
    if (frameworkResults.threatOfNewEntrants.score < 5) {
      insights.push({
        type: 'benefit',
        source: 'Porters.threatOfNewEntrants',
        content: `Barrier Protection: Low new entrant threat (${frameworkResults.threatOfNewEntrants.score}/10) provides sustainable competitive advantage`,
        confidence: 0.80,
        reasoning: 'Low entry threat is a strategic benefit',
        metadata: { category: 'Strategic', defensibility: true },
      });
    }

    // 2. Market position benefits
    if (frameworkResults.overallAttractiveness.score > 6) {
      insights.push({
        type: 'benefit',
        source: 'Porters.overallAttractiveness',
        content: `Attractive Market: Industry attractiveness score of ${frameworkResults.overallAttractiveness.score}/10 indicates favorable market conditions`,
        confidence: 0.85,
        reasoning: 'High market attractiveness represents strategic benefit',
        metadata: { category: 'Strategic' },
      });
    }

    // 3. Opportunities from force analysis
    const forces: Array<{ name: string; force: PortersForce }> = [
      { name: 'New Entrants', force: frameworkResults.threatOfNewEntrants },
      { name: 'Supplier Power', force: frameworkResults.bargainingPowerOfSuppliers },
      { name: 'Buyer Power', force: frameworkResults.bargainingPowerOfBuyers },
      { name: 'Substitutes', force: frameworkResults.threatOfSubstitutes },
      { name: 'Competitive Rivalry', force: frameworkResults.competitiveRivalry },
    ];

    forces.forEach(({ name, force }) => {
      if (force.opportunities && force.opportunities.length > 0) {
        force.opportunities.forEach((opportunity, idx) => {
          insights.push({
            type: 'benefit',
            source: `Porters.${name.replace(' ', '')}.opportunities[${idx}]`,
            content: opportunity,
            confidence: 0.75,
            reasoning: `Opportunity identified from ${name} analysis`,
            metadata: { category: 'Strategic' },
          });
        });
      }
    });

    // 4. Differentiation benefits
    if (frameworkResults.competitiveRivalry.score < 6) {
      insights.push({
        type: 'benefit',
        source: 'Porters.competitiveRivalry',
        content: 'Competitive Breathing Room: Moderate competitive rivalry allows for strategic positioning and differentiation',
        confidence: 0.70,
        reasoning: 'Lower competitive intensity provides strategic flexibility',
        metadata: { category: 'Strategic' },
      });
    }

    return insights;
  }

  async extractCosts(frameworkResults: PortersResults): Promise<StrategyInsight[]> {
    const insights: StrategyInsight[] = [];

    // Infer costs from competitive requirements
    const avgForceScore = this.calculateAverageForceScore(frameworkResults);
    
    if (avgForceScore > 6) {
      insights.push({
        type: 'cost',
        source: 'Porters.inference',
        content: 'Competitive Defense Budget: Marketing, sales, and product development to maintain position',
        confidence: 0.70,
        reasoning: 'High competitive pressure requires investment in market defense',
        metadata: { estimatedAmount: 300000 },
      });
    }

    if (frameworkResults.bargainingPowerOfSuppliers.score > 6) {
      insights.push({
        type: 'cost',
        source: 'Porters.bargainingPowerOfSuppliers',
        content: 'Supplier Premium Costs: Higher input costs due to supplier bargaining power',
        confidence: 0.75,
        reasoning: 'High supplier power typically increases procurement costs',
        metadata: { estimatedAmount: 200000 },
      });
    }

    if (frameworkResults.threatOfSubstitutes.score > 6) {
      insights.push({
        type: 'cost',
        source: 'Porters.threatOfSubstitutes',
        content: 'Innovation & Differentiation Investment: R&D and product development to counter substitutes',
        confidence: 0.70,
        reasoning: 'Substitute threats require investment in differentiation',
        metadata: { estimatedAmount: 250000 },
      });
    }

    return insights;
  }

  async inferTimeline(frameworkResults: PortersResults): Promise<StrategyInsight> {
    let urgency: 'ASAP' | 'Strategic' | 'Exploratory' = 'Strategic';
    let confidence = 0.70;
    let reasoning = 'Default strategic timeline based on competitive analysis';

    const avgForceScore = this.calculateAverageForceScore(frameworkResults);
    
    // High competitive pressure = faster action needed
    if (avgForceScore > 7 || frameworkResults.competitiveRivalry.score > 8) {
      urgency = 'ASAP';
      confidence = 0.80;
      reasoning = 'High competitive intensity requires urgent strategic response';
    } 
    // Low pressure = can take time to build position
    else if (avgForceScore < 4 && frameworkResults.overallAttractiveness.score > 6) {
      urgency = 'Exploratory';
      confidence = 0.75;
      reasoning = 'Favorable conditions allow for deliberate strategic development';
    }

    return {
      type: 'timeline',
      source: 'Porters.inference',
      content: `Recommended timeline: ${urgency === 'ASAP' ? '6' : urgency === 'Exploratory' ? '18' : '12'} months based on competitive urgency`,
      confidence,
      reasoning,
      metadata: {
        urgency,
        avgForceScore,
        competitiveIntensity: avgForceScore > 6 ? 'High' : avgForceScore > 4 ? 'Medium' : 'Low',
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

  private calculateAverageForceScore(frameworkResults: PortersResults): number {
    return (
      frameworkResults.threatOfNewEntrants.score +
      frameworkResults.bargainingPowerOfSuppliers.score +
      frameworkResults.bargainingPowerOfBuyers.score +
      frameworkResults.threatOfSubstitutes.score +
      frameworkResults.competitiveRivalry.score
    ) / 5;
  }

  private scoreToSeverity(score: number): string {
    if (score >= 8) return 'Critical';
    if (score >= 6) return 'High';
    if (score >= 4) return 'Medium';
    return 'Low';
  }

  private inferUrgency(frameworkResults: PortersResults): 'ASAP' | 'Strategic' | 'Exploratory' {
    const avgForceScore = this.calculateAverageForceScore(frameworkResults);
    
    if (avgForceScore > 7 || frameworkResults.competitiveRivalry.score > 8) {
      return 'ASAP';
    }
    
    if (avgForceScore < 4 && frameworkResults.overallAttractiveness.score > 6) {
      return 'Exploratory';
    }
    
    return 'Strategic';
  }

  private inferRiskTolerance(frameworkResults: PortersResults): 'Conservative' | 'Moderate' | 'Aggressive' | undefined {
    const avgForceScore = this.calculateAverageForceScore(frameworkResults);
    
    // Hostile environment = need conservative approach
    if (avgForceScore > 7) {
      return 'Conservative';
    }
    
    // Attractive environment = can be aggressive
    if (frameworkResults.overallAttractiveness.score > 7 && avgForceScore < 5) {
      return 'Aggressive';
    }
    
    return 'Moderate';
  }
}
