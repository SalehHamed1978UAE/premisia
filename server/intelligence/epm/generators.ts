/**
 * EPM Component Generators
 * 
 * Contains generators for all EPM components:
 * - Executive Summary
 * - Financial Plan
 * - Benefits Realization
 * - Risk Register
 * - Stage Gates
 * - KPIs
 * - Stakeholder Map
 * - Governance
 * - QA Plan
 * - Procurement
 * - Exit Strategy
 */

import type {
  StrategyInsights,
  StrategyInsight,
  UserContext,
  ResourcePlan,
  ResourceAllocation,
  Timeline,
  RiskRegister,
  StageGates,
  BenefitsRealization,
  Benefit,
  Risk,
  ExecutiveSummary,
  FinancialPlan,
  KPIs,
  StakeholderMap,
  Governance,
  QAPlan,
  Procurement,
  ExitStrategy,
  StrategyContext,
  RiskCategory,
} from '../types';
import { aiClients } from '../../ai-clients';
import {
  selectRoles,
  findRiskOwner,
  findBenefitOwner,
  ROLE_TEMPLATES,
  RISK_CATEGORY_OWNER_MAP,
  BENEFIT_CATEGORY_OWNER_MAP,
} from './role-templates';

/**
 * Executive Summary Generator
 */
export class ExecutiveSummaryGenerator {
  async generate(insights: StrategyInsights, programName: string): Promise<ExecutiveSummary> {
    const marketInsights = insights.insights.filter(i => i.type === 'other' && i.source.includes('summary'));
    const riskInsights = insights.insights.filter(i => i.type === 'risk');
    const benefitInsights = insights.insights.filter(i => i.type === 'benefit');

    return {
      title: programName,
      marketOpportunity: marketInsights[0]?.content || 
        'Strategic opportunity identified through framework analysis',
      strategicImperatives: insights.insights
        .filter(i => i.source.includes('recommendation') || i.source.includes('implication'))
        .slice(0, 5)
        .map(i => i.content),
      keySuccessFactors: insights.insights
        .filter(i => i.type === 'workstream')
        .slice(0, 4)
        .map(i => i.content.split('\n')[0]),
      riskSummary: `${riskInsights.length} risks identified, with ${riskInsights.filter(i => i.confidence > 0.8).length} high-priority risks requiring immediate mitigation.`,
      investmentRequired: this.estimateInvestmentFromInsights(insights),
      expectedOutcomes: this.summarizeExpectedOutcomes(benefitInsights),
      confidence: 0.90,
    };
  }

  private estimateInvestmentFromInsights(insights: StrategyInsights): string {
    const costInsights = insights.insights.filter(i => i.type === 'cost');
    if (costInsights.length > 0) {
      return `$${(costInsights.length * 200000).toLocaleString()} estimated`;
    }
    return insights.marketContext.budgetRange || '$500k - $1.5M';
  }

  private summarizeExpectedOutcomes(benefitInsights: StrategyInsight[]): string {
    if (benefitInsights.length === 0) {
      return 'Enhanced strategic positioning, operational efficiency, and competitive advantage';
    }
    return benefitInsights.slice(0, 3).map(i => i.content).join('; ');
  }
}

/**
 * Financial Plan Generator
 */
export class FinancialPlanGenerator {
  async generate(
    insights: StrategyInsights,
    resourcePlan: ResourcePlan,
    userContext?: UserContext
  ): Promise<FinancialPlan> {
    const costInsights = insights.insights.filter(i => i.type === 'cost');
    
    const personnelCost = resourcePlan.totalFTEs * 150000;
    const externalCost = resourcePlan.externalResources.reduce((sum, r) => sum + r.estimatedCost, 0);
    const overheadCost = (personnelCost + externalCost) * 0.15;
    const totalBudget = userContext?.budgetRange?.max || (personnelCost + externalCost + overheadCost);

    const costBreakdown = [
      { category: 'Personnel', amount: personnelCost, percentage: (personnelCost / totalBudget) * 100, description: 'Internal team costs' },
      { category: 'External Resources', amount: externalCost, percentage: (externalCost / totalBudget) * 100, description: 'Consultants, software, services' },
      { category: 'Overhead', amount: overheadCost, percentage: (overheadCost / totalBudget) * 100, description: 'Infrastructure, admin, facilities' },
    ];

    const contingency = totalBudget * 0.10;
    const cashFlow = this.generateCashFlow(totalBudget, 12);

    return {
      totalBudget: totalBudget + contingency,
      costBreakdown,
      cashFlow,
      contingency,
      contingencyPercentage: 10,
      assumptions: [
        `FTE cost: $150k/year`,
        `${resourcePlan.totalFTEs} FTEs for ${12} months`,
        `15% overhead for infrastructure and support`,
        `10% contingency for risks and unknowns`,
      ],
      confidence: costInsights.length > 0 ? 0.65 : 0.55,
    };
  }

  private generateCashFlow(totalBudget: number, months: number) {
    const quarters = Math.ceil(months / 3);
    const cashFlow = [];
    let cumulative = 0;

    for (let q = 1; q <= quarters; q++) {
      const percentage = q === 1 ? 0.40 : q === 2 ? 0.30 : q === 3 ? 0.20 : 0.10;
      const amount = -(totalBudget * percentage);
      cumulative += amount;
      
      cashFlow.push({
        quarter: q,
        amount,
        cumulative,
      });
    }

    return cashFlow;
  }
}

/**
 * Benefits Realization Generator
 *
 * ARCHITECTURE SPEC: Section 18 - Benefits Generator Contract
 * - Derives benefits from SWOT opportunities with specific, measurable targets
 * - Uses AI to generate contextual descriptions (not templates)
 * - Uses AI to assign owners based on actual resource list
 */
export class BenefitsGenerator {
  async generate(
    insights: StrategyInsights,
    timeline: Timeline,
    programContext?: { name: string; description?: string }
  ): Promise<BenefitsRealization> {
    const benefitInsights = insights.insights.filter(i => i.type === 'benefit');

    // Also look for strengths that can be leveraged as benefits
    const strengthInsights = insights.insights.filter(i =>
      i.source?.includes('strength') || i.type === 'other' && i.source?.includes('SWOT.strengths')
    );

    const benefits: Benefit[] = [];

    // Process opportunity-based benefits (primary source)
    benefitInsights.forEach((insight, idx) => {
      const analysis = this.analyzeOpportunity(insight.content);
      const estimatedValue = this.estimateBenefitValue(insight, analysis);

      benefits.push({
        id: `B${String(benefits.length + 1).padStart(3, '0')}`,
        name: analysis.name,
        category: analysis.category as any,
        description: insight.content, // Use original content, AI will enhance later
        target: analysis.target,
        realizationMonth: this.calculateRealizationMonth(idx, timeline, analysis.priority),
        estimatedValue,
        measurement: analysis.measurement,
        confidence: insight.confidence,
      });
    });

    // Add strength-based benefits (leverage existing capabilities)
    strengthInsights.slice(0, 2).forEach((insight, idx) => {
      if (benefits.length >= 6) return; // Cap at 6 benefits

      const analysis = this.analyzeStrength(insight.content);
      benefits.push({
        id: `B${String(benefits.length + 1).padStart(3, '0')}`,
        name: `Leverage: ${analysis.name}`,
        category: 'Strategic',
        description: insight.content, // Use original content, AI will enhance later
        target: analysis.target,
        realizationMonth: timeline.totalMonths - 1,
        estimatedValue: undefined,
        measurement: analysis.measurement,
        confidence: insight.confidence * 0.9,
      });
    });

    // Ensure minimum 3 benefits
    if (benefits.length < 3) {
      const defaultBenefits = this.generateContextualDefaults(insights, timeline, 3 - benefits.length);
      benefits.push(...defaultBenefits);
    }

    const totalFinancialValue = benefits
      .filter(b => b.estimatedValue)
      .reduce((sum, b) => sum + (b.estimatedValue || 0), 0);

    return {
      benefits,
      totalFinancialValue: totalFinancialValue > 0 ? totalFinancialValue : undefined,
      confidence: benefitInsights.length > 0 ? 0.75 : 0.60,
    };
  }

  /**
   * Analyze an opportunity to extract specific benefit details
   */
  private analyzeOpportunity(content: string): {
    name: string;
    category: string;
    target: string;
    measurement: string;
    priority: 'high' | 'medium' | 'low';
  } {
    const lower = content.toLowerCase();

    // Streetwear/Fashion/Culture benefits
    if (lower.includes('streetwear') || lower.includes('culture') || lower.includes('community')) {
      return {
        name: 'Community & Culture Engagement',
        category: 'Strategic',
        target: '+25% community engagement; 500+ loyalty members in Year 1',
        measurement: 'Community size, event attendance, social engagement (monthly)',
        priority: 'high',
      };
    }

    // Digital/Technology benefits
    if (lower.includes('digital') || lower.includes('technology') || lower.includes('integration') || lower.includes('online')) {
      return {
        name: 'Digital Channel Revenue',
        category: 'Financial',
        target: '15% of total revenue from digital channels by Month 6',
        measurement: 'E-commerce revenue, app downloads, digital conversion rate (weekly)',
        priority: 'high',
      };
    }

    // Product/Launch/Exclusive benefits
    if (lower.includes('exclusive') || lower.includes('launch') || lower.includes('product')) {
      return {
        name: 'Exclusive Product Premium',
        category: 'Financial',
        target: '+20% margin on exclusive releases; 3+ brand partnerships',
        measurement: 'Exclusive SKU margin, brand partnership count, release sell-through rate (monthly)',
        priority: 'high',
      };
    }

    // Partnership/Corporate benefits
    if (lower.includes('partnership') || lower.includes('corporate') || lower.includes('sponsor')) {
      return {
        name: 'Strategic Partnership Value',
        category: 'Strategic',
        target: '2+ corporate partnerships generating $50K+ annual revenue',
        measurement: 'Partnership revenue, contract value, renewal rate (quarterly)',
        priority: 'medium',
      };
    }

    // Expansion/Growth benefits
    if (lower.includes('expansion') || lower.includes('regional') || lower.includes('growth') || lower.includes('potential')) {
      return {
        name: 'Market Expansion Readiness',
        category: 'Strategic',
        target: 'Expansion-ready operations by Month 9; 2nd location feasibility complete',
        measurement: 'Expansion readiness score, location analysis, capital requirements (quarterly)',
        priority: 'medium',
      };
    }

    // Customer/Experience benefits
    if (lower.includes('customer') || lower.includes('experience') || lower.includes('service')) {
      return {
        name: 'Premium Customer Experience',
        category: 'Operational',
        target: 'NPS 60+; 40% repeat customer rate by Month 6',
        measurement: 'NPS score, repeat purchase rate, customer satisfaction surveys (monthly)',
        priority: 'high',
      };
    }

    // Revenue/Sales benefits
    if (lower.includes('revenue') || lower.includes('sales') || lower.includes('income')) {
      return {
        name: 'Revenue Growth',
        category: 'Financial',
        target: '+20% YoY revenue growth; break-even by Month 8',
        measurement: 'Monthly revenue, growth rate, gross margin (weekly)',
        priority: 'high',
      };
    }

    // Brand/Awareness benefits
    if (lower.includes('brand') || lower.includes('awareness') || lower.includes('recognition')) {
      return {
        name: 'Brand Recognition',
        category: 'Strategic',
        target: '70% brand awareness in target demographic within 6 months',
        measurement: 'Brand awareness surveys, social mentions, media coverage (monthly)',
        priority: 'medium',
      };
    }

    // Default: Use original content as name with contextual target
    return {
      name: this.extractBenefitName(content),
      category: 'Strategic',
      target: this.generateContextualTarget(content),
      measurement: 'Performance metrics and KPI tracking (quarterly)',
      priority: 'medium',
    };
  }

  /**
   * Analyze a strength to create leverage benefit
   */
  private analyzeStrength(content: string): {
    name: string;
    target: string;
    measurement: string;
  } {
    const lower = content.toLowerCase();

    if (lower.includes('location') || lower.includes('prime') || lower.includes('foot traffic')) {
      return {
        name: 'Prime Location Advantage',
        target: '+30% walk-in conversion vs market average',
        measurement: 'Foot traffic, conversion rate, avg transaction value',
      };
    }

    if (lower.includes('expertise') || lower.includes('knowledge') || lower.includes('team')) {
      return {
        name: 'Domain Expertise',
        target: '95% customer satisfaction on product advice',
        measurement: 'Customer feedback, upsell rate, return rate',
      };
    }

    // Default
    return {
      name: this.extractBenefitName(content),
      target: '+15% competitive advantage in key metrics',
      measurement: 'Competitive benchmarking (quarterly)',
    };
  }

  /**
   * Generate contextual default benefits when too few are identified
   */
  private generateContextualDefaults(
    insights: StrategyInsights,
    timeline: Timeline,
    count: number
  ): Benefit[] {
    const defaults: Benefit[] = [];
    const industry = insights.marketContext?.industry?.toLowerCase() || '';

    const templates = [
      {
        name: 'Operational Excellence',
        category: 'Operational' as const,
        description: 'Achieve operational efficiency through optimized processes',
        target: '-15% operational costs; 95% process compliance',
        measurement: 'Cost per transaction, process adherence (monthly)',
      },
      {
        name: 'Market Positioning',
        category: 'Strategic' as const,
        description: 'Establish strong market position in target segment',
        target: 'Top 3 position in local market segment',
        measurement: 'Market share surveys, competitive analysis (quarterly)',
      },
      {
        name: 'Customer Acquisition',
        category: 'Financial' as const,
        description: 'Build sustainable customer acquisition channels',
        target: '1000+ customers in database by Month 6',
        measurement: 'Customer count, CAC, LTV (monthly)',
      },
    ];

    for (let i = 0; i < count && i < templates.length; i++) {
      defaults.push({
        id: `B${String(defaults.length + 10).padStart(3, '0')}`,
        ...templates[i],
        realizationMonth: timeline.totalMonths - (count - i),
        estimatedValue: undefined,
        confidence: 0.65,
      });
    }

    return defaults;
  }

  private extractBenefitName(content: string): string {
    // Clean and extract meaningful name from content
    const cleaned = content.replace(/^(opportunity:|benefit:|strength:)/i, '').trim();
    const firstPhrase = cleaned.split(/[.!?,;]/)[0].trim();

    if (firstPhrase.length <= 50) return firstPhrase;

    // Truncate at word boundary
    const truncated = firstPhrase.substring(0, 50);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated;
  }

  private generateContextualTarget(content: string): string {
    const lower = content.toLowerCase();

    if (lower.includes('market') || lower.includes('position')) return '+15% market penetration in Year 1';
    if (lower.includes('efficien') || lower.includes('process')) return '+20% operational efficiency';
    if (lower.includes('quality') || lower.includes('premium')) return '95% quality score; <2% defect rate';
    if (lower.includes('innovat') || lower.includes('new')) return '3+ innovations implemented per year';

    return 'Measurable improvement vs baseline within 6 months';
  }

  private generateRichDescription(content: string, analysis: { name: string; category: string }): string {
    // Use the original content directly - it already contains the meaningful description
    // Don't add boilerplate - the metrics and targets provide the actionable context
    const cleaned = content.trim();

    // If content is short, it's likely just a title - expand it based on analysis
    if (cleaned.length < 50) {
      const expansions: Record<string, string> = {
        'Financial': `Capitalize on ${cleaned.toLowerCase()} to drive revenue growth and improve financial performance through targeted initiatives`,
        'Strategic': `Leverage ${cleaned.toLowerCase()} to strengthen market position and create sustainable competitive advantage`,
        'Operational': `Optimize ${cleaned.toLowerCase()} to enhance operational efficiency and reduce costs`,
        'Customer Experience': `Enhance ${cleaned.toLowerCase()} to improve customer satisfaction and loyalty`,
      };
      return expansions[analysis.category] || `Realize value from ${cleaned.toLowerCase()} through focused strategic execution`;
    }

    return cleaned;
  }

  private calculateRealizationMonth(idx: number, timeline: Timeline, priority: 'high' | 'medium' | 'low'): number {
    const baseMonth = priority === 'high' ? 3 : priority === 'medium' ? 6 : 9;
    return Math.min(baseMonth + idx, timeline.totalMonths);
  }

  private categorizeBenefit(content: string): 'Financial' | 'Strategic' | 'Operational' | 'Risk Mitigation' {
    const lower = content.toLowerCase();
    if (lower.includes('revenue') || lower.includes('cost') || lower.includes('$') || lower.includes('margin')) return 'Financial';
    if (lower.includes('risk') || lower.includes('mitigate') || lower.includes('compliance')) return 'Risk Mitigation';
    if (lower.includes('efficiency') || lower.includes('process') || lower.includes('operation')) return 'Operational';
    return 'Strategic';
  }

  private estimateBenefitValue(insight: StrategyInsight, analysis?: any): number | undefined {
    const match = insight.content.match(/\$([0-9,]+)/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''));
    }
    // Could estimate based on category in future
    return undefined;
  }

  private generateMeasurement(content: string): string {
    const lower = content.toLowerCase();
    if (lower.includes('revenue')) return 'Revenue tracking (monthly)';
    if (lower.includes('cost')) return 'Cost analysis (quarterly)';
    if (lower.includes('customer')) return 'Customer surveys (quarterly)';
    if (lower.includes('market')) return 'Market analysis (semi-annual)';
    return 'Performance metrics (quarterly)';
  }

  /**
   * Use AI to enhance benefits with contextual descriptions and assign owners
   * Makes ONE batch call for efficiency
   */
  async enhanceBenefitsWithAI(
    benefits: Benefit[],
    resources: ResourceAllocation[],
    programContext?: { name: string; description?: string }
  ): Promise<Benefit[]> {
    if (!resources || resources.length === 0 || benefits.length === 0) {
      console.log('[BenefitsGenerator] No resources or benefits, using defaults');
      return benefits.map(b => ({ ...b, responsibleParty: 'Program Director' }));
    }

    const availableRoles = resources.map(r => r.role);

    try {
      const prompt = `You are writing benefit descriptions for a strategic program. Each benefit needs a FULL PARAGRAPH description.

PROGRAM: "${programContext?.name || 'Strategic Program'}"
${programContext?.description ? `CONTEXT: ${programContext.description}` : ''}

TEAM MEMBERS (assign owners from this list ONLY):
${availableRoles.map((r, i) => `• ${r}`).join('\n')}

BENEFITS TO DESCRIBE:
${benefits.map((b, i) => `${i + 1}. "${b.name}" (Target: ${b.target || 'TBD'})`).join('\n')}

EXAMPLE of a GOOD description (this is the quality I need):
"By establishing partnerships with regional tourism boards and eco-tourism operators, the zoo will tap into the growing market of environmentally-conscious travelers. This will drive a projected 25% increase in international visitors within the first year, generating an estimated $500K in additional ticket revenue while positioning the zoo as a leading sustainable attraction in the Gulf region."

YOUR TASK: Write a description like the example above for EACH benefit. Each description must:
- Be 2-3 full sentences (40-80 words)
- Explain HOW the benefit will be achieved
- Include specific outcomes or metrics where possible
- Reference the actual program context

Return ONLY valid JSON:
{
  "enhancements": [
    {
      "benefitIndex": 0,
      "description": "Full paragraph description here (2-3 sentences, 40-80 words)...",
      "owner": "Exact role name from the team list"
    }
  ]
}

RULES:
- DO NOT write short phrases like "Regional Tourism Hub Development" - write FULL PARAGRAPHS
- DO NOT use boilerplate like "This benefit will be realized through..."
- Owners must EXACTLY match a team member name from the list
- Distribute ownership across different team members`;

      const result = await aiClients.callWithFallback({
        prompt,
        maxTokens: 2000,
        temperature: 0.7,
      });

      const responseText = result?.content || result?.text || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        if (parsed.enhancements && Array.isArray(parsed.enhancements)) {
          console.log(`[BenefitsGenerator] AI enhanced ${parsed.enhancements.length} benefits`);

          return benefits.map((benefit, idx) => {
            const enhancement = parsed.enhancements.find((e: any) => e.benefitIndex === idx);

            if (enhancement) {
              // Validate owner is in available roles
              const validOwner = availableRoles.find(r =>
                r.toLowerCase() === enhancement.owner?.toLowerCase()
              ) || availableRoles[idx % availableRoles.length];

              return {
                ...benefit,
                description: enhancement.description || benefit.description,
                responsibleParty: validOwner,
              };
            }

            return {
              ...benefit,
              responsibleParty: availableRoles[idx % availableRoles.length],
            };
          });
        }
      }

      console.log('[BenefitsGenerator] AI returned no valid enhancements, using fallback');
    } catch (error) {
      console.error('[BenefitsGenerator] AI enhancement failed:', error);
    }

    // Fallback: use existing method
    return this.assignBenefitOwners(benefits, resources);
  }

  /**
   * Assign responsible parties to benefits based on their category and content
   * Uses role-templates for context-aware owner assignment with round-robin fallback
   * NOTE: This is the fallback method - prefer enhanceBenefitsWithAI for better results
   */
  assignBenefitOwners(benefits: Benefit[], resources: ResourceAllocation[]): Benefit[] {
    if (!resources || resources.length === 0) {
      console.log('[BenefitsGenerator] No resources available, using default owner');
      return benefits.map(b => ({ ...b, responsibleParty: 'Program Director' }));
    }

    const availableRoles = resources.map(r => r.role);
    const usedOwners = new Map<string, number>();

    // Initialize usage counts
    availableRoles.forEach(role => usedOwners.set(role, 0));

    return benefits.map((benefit) => {
      // Determine effective category for owner mapping
      let effectiveCategory = benefit.category || 'Strategic';
      const lowerContent = benefit.description.toLowerCase();
      const lowerName = (benefit.name || '').toLowerCase();

      // Content-based category override for better matching
      if (lowerContent.includes('revenue') || lowerContent.includes('sales') || lowerName.includes('revenue')) {
        effectiveCategory = 'Revenue';
      } else if (lowerContent.includes('customer') || lowerContent.includes('experience') || lowerName.includes('customer')) {
        effectiveCategory = 'Customer Experience';
      } else if (lowerContent.includes('brand') || lowerContent.includes('marketing') || lowerName.includes('brand')) {
        effectiveCategory = 'Brand';
      }

      // Use centralized owner finder
      const owner = findBenefitOwner(effectiveCategory, availableRoles, usedOwners);

      // Track usage for round-robin
      usedOwners.set(owner, (usedOwners.get(owner) || 0) + 1);

      return {
        ...benefit,
        responsibleParty: owner
      };
    });
  }
}

/**
 * Risk Register Generator
 */
export class RiskGenerator {
  async generate(insights: StrategyInsights): Promise<RiskRegister> {
    const riskInsights = insights.insights.filter(i => i.type === 'risk');

    const risks: Risk[] = riskInsights.map((insight, idx) => {
      const category = this.categorizeRisk(insight);
      const probability = this.estimateRiskProbability(insight, idx); // Pass idx for variation
      const impact = this.estimateRiskImpact(insight);
      const impactMultiplier = impact === 'Critical' ? 4 : impact === 'High' ? 3 : impact === 'Medium' ? 2 : 1;

      return {
        id: `R${String(idx + 1).padStart(3, '0')}`,
        description: insight.content,
        category,
        probability,
        impact,
        severity: Math.round(probability * impactMultiplier / 10), // Normalized severity score
        mitigation: this.generateMitigation(insight, category),
        contingency: `Escalate to governance if probability exceeds ${Math.min(probability + 20, 90)}%`,
        confidence: insight.confidence,
      };
    });

    const topRisks = [...risks].sort((a, b) => b.severity - a.severity).slice(0, 5);

    return {
      risks,
      topRisks,
      mitigationBudget: risks.length * 25000,
      confidence: riskInsights.length > 0 ? 0.80 : 0.65,
    };
  }

  private categorizeRisk(insight: StrategyInsight): string {
    const lower = insight.content.toLowerCase();
    if (lower.includes('technology') || lower.includes('technical') || lower.includes('system') || lower.includes('integration')) return 'Technical';
    if (lower.includes('market') || lower.includes('competitive') || lower.includes('competition') || lower.includes('demand')) return 'Market';
    if (lower.includes('resource') || lower.includes('team') || lower.includes('talent') || lower.includes('hiring')) return 'Resource';
    if (lower.includes('regulatory') || lower.includes('compliance') || lower.includes('legal') || lower.includes('license')) return 'Regulatory';
    if (lower.includes('cost') || lower.includes('budget') || lower.includes('financial') || lower.includes('economic')) return 'Financial';
    if (lower.includes('operations') || lower.includes('supply') || lower.includes('inventory') || lower.includes('logistics')) return 'Operational';
    return 'Strategic';
  }

  /**
   * Estimate risk probability using multiple signals for variation:
   * - Base from confidence (inverted)
   * - Category adjustment (some risks inherently more likely)
   * - Content keywords (explicit indicators)
   * - Index-based variation (prevents all same value)
   */
  private estimateRiskProbability(insight: StrategyInsight, idx?: number): number {
    // Base probability: 25-45% range from confidence
    const baseProbability = 25 + Math.round((1 - insight.confidence) * 20);

    const lower = insight.content.toLowerCase();
    let adjustment = 0;

    // Category-based adjustments
    if (lower.includes('competition') || lower.includes('competitive')) adjustment += 15;
    else if (lower.includes('economic') || lower.includes('currency')) adjustment += 12;
    else if (lower.includes('market') || lower.includes('demand')) adjustment += 10;
    else if (lower.includes('technology') || lower.includes('system')) adjustment += 8;
    else if (lower.includes('cost') || lower.includes('budget')) adjustment += 5;
    else if (lower.includes('regulatory') || lower.includes('compliance')) adjustment += 3;
    else if (lower.includes('talent') || lower.includes('resource')) adjustment += 5;

    // Severity indicators
    if (lower.includes('high') || lower.includes('significant') || lower.includes('major')) adjustment += 10;
    if (lower.includes('limited') || lower.includes('single') || lower.includes('dependency')) adjustment += 8;
    if (lower.includes('changing') || lower.includes('volatile') || lower.includes('uncertain')) adjustment += 6;
    if (lower.includes('intense') || lower.includes('increasing')) adjustment += 5;

    // Mitigation indicators (reduce probability)
    if (lower.includes('manageable') || lower.includes('controllable')) adjustment -= 8;
    if (lower.includes('established') || lower.includes('proven')) adjustment -= 5;

    // Add small variation based on index to prevent identical values
    const indexVariation = idx !== undefined ? (idx % 5) * 3 - 6 : 0; // -6 to +6

    // Clamp to 20-75% range
    return Math.max(20, Math.min(75, baseProbability + adjustment + indexVariation));
  }

  private estimateRiskImpact(insight: StrategyInsight): 'Low' | 'Medium' | 'High' | 'Critical' {
    const lower = insight.content.toLowerCase();
    if (lower.includes('critical') || lower.includes('catastrophic')) return 'Critical';
    if (lower.includes('high') || lower.includes('significant')) return 'High';
    if (lower.includes('medium') || lower.includes('moderate')) return 'Medium';
    return 'Low';
  }

  private generateMitigation(insight: StrategyInsight, category: string): string {
    const lower = insight.content.toLowerCase();
    
    if (lower.includes('competition') || lower.includes('competitor')) {
      return 'Develop competitive differentiation strategy and monitor competitor movements weekly';
    }
    if (lower.includes('supply chain') || lower.includes('supplier')) {
      return 'Diversify supplier base and maintain 30-day inventory buffer for critical materials';
    }
    if (lower.includes('talent') || lower.includes('hiring') || lower.includes('recruitment')) {
      return 'Implement retention bonuses, accelerate hiring pipeline, and cross-train existing staff';
    }
    if (lower.includes('technology') || lower.includes('system') || lower.includes('integration')) {
      return 'Conduct technical proof-of-concept, establish rollback procedures, and schedule vendor support';
    }
    if (lower.includes('regulatory') || lower.includes('compliance') || lower.includes('legal')) {
      return 'Engage legal counsel, implement compliance monitoring, and establish regulatory liaison';
    }
    if (lower.includes('budget') || lower.includes('cost') || lower.includes('financial')) {
      return 'Establish contingency reserve (15% of budget), implement monthly cost reviews, and identify cost reduction levers';
    }
    if (lower.includes('timeline') || lower.includes('delay') || lower.includes('schedule')) {
      return 'Build 2-week buffer into critical path, identify fast-track options, and escalate blockers within 48 hours';
    }
    if (lower.includes('customer') || lower.includes('user') || lower.includes('adoption')) {
      return 'Conduct user research, implement feedback loops, and develop change management communication plan';
    }
    if (lower.includes('market') || lower.includes('demand') || lower.includes('economic')) {
      return 'Monitor market indicators monthly, develop scenario-based contingency plans, and maintain pricing flexibility';
    }
    if (lower.includes('quality') || lower.includes('defect') || lower.includes('performance')) {
      return 'Implement quality gates at each phase, establish acceptance criteria, and conduct regular testing';
    }
    if (lower.includes('security') || lower.includes('breach') || lower.includes('data')) {
      return 'Conduct security audit, implement access controls, and establish incident response procedures';
    }
    if (lower.includes('stakeholder') || lower.includes('sponsor') || lower.includes('executive')) {
      return 'Schedule bi-weekly stakeholder updates, document decisions formally, and maintain RACI clarity';
    }
    if (lower.includes('resource') || lower.includes('capacity') || lower.includes('bandwidth')) {
      return 'Prioritize workload, identify backup resources, and establish resource escalation path';
    }
    
    const categoryMitigations: Record<string, string> = {
      'Technical': 'Conduct technical review, establish fallback architecture, and maintain vendor support agreements',
      'Market': 'Monitor market trends quarterly, develop pivot scenarios, and maintain customer feedback channels',
      'Resource': 'Cross-train team members, maintain contractor relationships, and document key processes',
      'Regulatory': 'Engage compliance experts, monitor regulatory changes, and maintain audit documentation',
      'Strategic': 'Review strategy quarterly with leadership, maintain scenario plans, and track leading indicators',
    };
    
    return categoryMitigations[category] || 'Establish monitoring process, define escalation triggers, and review mitigation effectiveness monthly';
  }

  /**
   * Assign owners to risks based on their category and content
   * Uses role-templates for context-aware owner assignment with round-robin fallback
   */
  assignRiskOwners(risks: Risk[], resources: ResourceAllocation[]): Risk[] {
    if (!resources || resources.length === 0) {
      console.log('[RiskGenerator] No resources available, using default owner');
      return risks.map(r => ({ ...r, owner: 'Risk Manager' }));
    }

    const availableRoles = resources.map(r => r.role);
    const usedOwners = new Map<string, number>();

    // Initialize usage counts
    availableRoles.forEach(role => usedOwners.set(role, 0));

    return risks.map((risk) => {
      // Map risk category string to RiskCategory type
      const categoryMap: Record<string, RiskCategory> = {
        'technical': 'operational',
        'market': 'strategic',
        'resource': 'operational',
        'regulatory': 'compliance',
        'financial': 'financial',
        'operational': 'operational',
        'strategic': 'strategic',
        'reputational': 'reputational',
        'execution': 'execution',
      };

      const riskCategory: RiskCategory = categoryMap[risk.category.toLowerCase()] || 'operational';

      // Use centralized owner finder
      const owner = findRiskOwner(riskCategory, availableRoles, usedOwners);

      // Track usage for round-robin
      usedOwners.set(owner, (usedOwners.get(owner) || 0) + 1);

      return {
        ...risk,
        owner
      };
    });
  }
}

/**
 * Stage Gates Generator
 */
export class StageGateGenerator {
  async generate(timeline: Timeline, riskRegister: RiskRegister): Promise<StageGates> {
    const gates = timeline.phases.map((phase, idx) => ({
      gate: idx + 1,
      name: `Gate ${idx + 1}: ${phase.name} Complete`,
      month: phase.endMonth,
      goCriteria: [
        `All ${phase.name} deliverables completed`,
        `Phase objectives achieved`,
        `Budget within ±10% of plan`,
        `No critical risks unmitigated`,
      ],
      noGoTriggers: [
        `Critical deliverables >2 weeks late`,
        `Budget overrun >20%`,
        `${riskRegister.topRisks.slice(0, 2).map(r => `Risk ${r.id} realized`).join(' OR ')}`,
      ],
      deliverables: phase.workstreamIds,
      confidence: 0.85,
    }));

    return {
      gates,
      confidence: 0.85,
    };
  }
}

/**
 * KPI Generator
 */
export class KPIGenerator {
  async generate(insights: StrategyInsights, benefitsRealization: BenefitsRealization): Promise<KPIs> {
    const kpis = benefitsRealization.benefits.map((benefit, idx) => {
      let kpiCategory: 'Financial' | 'Operational' | 'Strategic' | 'Customer' = 'Strategic';
      if (benefit.category === 'Financial') kpiCategory = 'Financial';
      else if (benefit.category === 'Operational') kpiCategory = 'Operational';
      else if (benefit.category === 'Strategic') kpiCategory = 'Strategic';
      
      return {
        id: `KPI${String(idx + 1).padStart(3, '0')}`,
        name: this.generateKPIName(benefit.description),
        category: kpiCategory,
        baseline: 'Current state',
        target: benefit.estimatedValue ? `+${benefit.estimatedValue.toLocaleString()}` : this.generateMeasurableTarget(benefit),
        measurement: benefit.measurement,
        frequency: benefit.category === 'Financial' ? 'Monthly' as const : 'Quarterly' as const,
        linkedBenefitIds: [benefit.id],
        confidence: benefit.confidence,
      };
    });

    kpis.push({
      id: `KPI${String(kpis.length + 1).padStart(3, '0')}`,
      name: 'Program Progress',
      category: 'Operational',
      baseline: '0%',
      target: '100%',
      measurement: 'Percentage of deliverables completed',
      frequency: 'Monthly',
      linkedBenefitIds: [],
      confidence: 0.95,
    });

    return {
      kpis,
      confidence: 0.75,
    };
  }

  private generateKPIName(description: string): string {
    const words = description.split(' ').slice(0, 4).join(' ');
    return words.length > 40 ? words.substring(0, 37) + '...' : words;
  }

  private generateMeasurableTarget(benefit: { description: string; category: string; measurement?: string }): string {
    const lower = benefit.description.toLowerCase();
    const measurement = benefit.measurement?.toLowerCase() || '';
    
    if (lower.includes('revenue') || lower.includes('sales')) {
      return '+15% year-over-year';
    }
    if (lower.includes('cost') || lower.includes('expense') || lower.includes('savings')) {
      return '-20% reduction from baseline';
    }
    if (lower.includes('efficiency') || lower.includes('productivity')) {
      return '+25% improvement in throughput';
    }
    if (lower.includes('time') || lower.includes('speed') || lower.includes('faster')) {
      return '-30% reduction in cycle time';
    }
    if (lower.includes('customer') || lower.includes('satisfaction') || lower.includes('nps')) {
      return '+10 points NPS improvement';
    }
    if (lower.includes('quality') || lower.includes('defect') || lower.includes('error')) {
      return '-50% reduction in defect rate';
    }
    if (lower.includes('market') || lower.includes('share')) {
      return '+5% market share gain';
    }
    if (lower.includes('retention') || lower.includes('churn')) {
      return '+10% improvement in retention rate';
    }
    if (lower.includes('conversion') || lower.includes('lead')) {
      return '+20% conversion rate improvement';
    }
    if (lower.includes('engagement') || lower.includes('adoption')) {
      return '+30% increase in active users';
    }
    if (lower.includes('compliance') || lower.includes('audit')) {
      return '100% compliance score';
    }
    if (lower.includes('risk') || lower.includes('incident')) {
      return '-40% reduction in incidents';
    }
    
    if (benefit.category === 'Financial') {
      return '+10% improvement vs baseline';
    }
    if (benefit.category === 'Operational') {
      return '+15% operational improvement';
    }
    if (benefit.category === 'Customer') {
      return '+20% customer metric improvement';
    }
    
    return '+15% improvement vs current state';
  }
}

/**
 * Stakeholder Map Generator
 */
export class StakeholderGenerator {
  async generate(insights: StrategyInsights): Promise<StakeholderMap> {
    const stakeholderInsights = insights.insights.filter(i => i.type === 'stakeholder');
    
    const stakeholders = stakeholderInsights.map(insight => ({
      name: insight.content.split(':')[0] || 'Stakeholder',
      group: this.categorizeStakeholder(insight.content),
      power: this.assessStakeholderPower(insight) as any,
      interest: this.assessStakeholderInterest(insight) as any,
      engagement: `${this.assessStakeholderPower(insight)} power, ${this.assessStakeholderInterest(insight)} interest - ${this.getEngagementStrategy(insight)}`,
      communicationPlan: this.generateCommunicationPlan(insight),
    }));

    if (stakeholders.length < 3) {
      stakeholders.push(
        { name: 'Executive Sponsor', group: 'Leadership', power: 'High', interest: 'High', engagement: 'Manage closely', communicationPlan: 'Weekly updates' },
        { name: 'Program Team', group: 'Execution', power: 'Medium', interest: 'High', engagement: 'Keep informed', communicationPlan: 'Daily standups' },
        { name: 'End Users', group: 'Customers', power: 'Medium', interest: 'High', engagement: 'Keep informed', communicationPlan: 'Monthly updates' }
      );
    }

    const changeManagement = [
      { phase: 'Awareness', months: 'Months 0-2', activities: ['Stakeholder identification', 'Impact assessment', 'Communication planning'] },
      { phase: 'Mobilization', months: 'Months 2-4', activities: ['Training programs', 'Change champions', 'Feedback loops'] },
      { phase: 'Execution', months: 'Months 4-10', activities: ['Ongoing support', 'Resistance management', 'Progress tracking'] },
      { phase: 'Sustainment', months: 'Months 10-12+', activities: ['Reinforcement', 'Best practices', 'Continuous improvement'] },
    ];

    return {
      stakeholders,
      changeManagement,
      impactedGroups: stakeholders.length,
      confidence: stakeholderInsights.length > 0 ? 0.75 : 0.65,
    };
  }

  private categorizeStakeholder(content: string): string {
    const lower = content.toLowerCase();
    if (lower.includes('customer') || lower.includes('user')) return 'Customers';
    if (lower.includes('executive') || lower.includes('leadership')) return 'Leadership';
    if (lower.includes('team') || lower.includes('employee')) return 'Execution';
    if (lower.includes('partner') || lower.includes('supplier')) return 'Partners';
    return 'Other';
  }

  private assessStakeholderPower(insight: StrategyInsight): string {
    if (insight.confidence > 0.8) return 'High';
    if (insight.confidence > 0.6) return 'Medium';
    return 'Low';
  }

  private assessStakeholderInterest(insight: StrategyInsight): string {
    return 'High';
  }

  private getEngagementStrategy(insight: StrategyInsight): string {
    const power = this.assessStakeholderPower(insight);
    const interest = this.assessStakeholderInterest(insight);
    
    if (power === 'High' && interest === 'High') return 'Manage closely';
    if (power === 'High' && interest !== 'High') return 'Keep satisfied';
    if (power !== 'High' && interest === 'High') return 'Keep informed';
    return 'Monitor';
  }

  private generateCommunicationPlan(insight: StrategyInsight): string {
    const strategy = this.getEngagementStrategy(insight);
    if (strategy === 'Manage closely') return 'Weekly updates, monthly reviews';
    if (strategy === 'Keep satisfied') return 'Monthly updates';
    if (strategy === 'Keep informed') return 'Quarterly updates, newsletters';
    return 'As needed';
  }
}

/**
 * Governance Generator
 */
export class GovernanceGenerator {
  async generate(insights: StrategyInsights, stakeholderMap: StakeholderMap): Promise<Governance> {
    return {
      bodies: [
        {
          name: 'Steering Committee',
          level: 'Strategic',
          members: ['Executive Sponsor', 'Business Owners', 'Program Manager'],
          cadence: 'Monthly',
          responsibilities: ['Strategic direction', 'Budget approval', 'Risk escalation'],
          escalationPath: 'Board of Directors',
        },
        {
          name: 'Program Management Office',
          level: 'Tactical',
          members: ['Program Manager', 'Workstream Leads', 'Change Manager'],
          cadence: 'Weekly',
          responsibilities: ['Progress tracking', 'Issue resolution', 'Resource allocation'],
          escalationPath: 'Steering Committee',
        },
      ],
      decisionRights: [
        { decision: 'Budget Changes >10%', responsible: 'Program Manager', accountable: 'Steering Committee', consulted: 'Finance', informed: 'All Stakeholders' },
        { decision: 'Scope Changes', responsible: 'Workstream Leads', accountable: 'Program Manager', consulted: 'Business Owners', informed: 'Steering Committee' },
        { decision: 'Risk Mitigation', responsible: 'Risk Owner', accountable: 'Program Manager', consulted: 'PMO', informed: 'Steering Committee' },
      ],
      meetingCadence: {
        'Daily': 'Team standups',
        'Weekly': 'PMO sync, workstream reviews',
        'Monthly': 'Steering Committee, stakeholder updates',
      },
      confidence: 0.85,
    };
  }
}

/**
 * QA Plan Generator
 */
export class QAPlanGenerator {
  async generate(insights: StrategyInsights): Promise<QAPlan> {
    return {
      standards: [
        { area: 'Deliverables', standard: 'All deliverables reviewed and approved', acceptanceCriteria: ['Peer review completed', 'Stakeholder approval', 'Quality checklist passed'] },
        { area: 'Testing', standard: 'Comprehensive testing before deployment', acceptanceCriteria: ['Test plans executed', 'Defects resolved', 'User acceptance complete'] },
        { area: 'Documentation', standard: 'Complete and current documentation', acceptanceCriteria: ['User guides', 'Technical specs', 'Process documentation'] },
      ],
      processes: [
        { phase: 'Planning', activities: ['Quality plan development', 'Standards definition', 'Acceptance criteria'] },
        { phase: 'Execution', activities: ['Quality reviews', 'Testing', 'Defect tracking'] },
        { phase: 'Closure', activities: ['Final QA audit', 'Lessons learned', 'Quality metrics'] },
      ],
      acceptanceCriteria: [
        'All deliverables meet quality standards',
        'Testing complete with <5% defect rate',
        'Stakeholder sign-off received',
        'Documentation complete and approved',
      ],
      confidence: 0.80,
    };
  }
}

/**
 * Procurement Generator
 */
export class ProcurementGenerator {
  async generate(insights: StrategyInsights, financialPlan: FinancialPlan): Promise<Procurement> {
    const items = financialPlan.costBreakdown
      .filter(c => c.category === 'External Resources')
      .map((cost, idx) => ({
        id: `P${String(idx + 1).padStart(3, '0')}`,
        name: cost.description,
        type: 'Services' as const,
        estimatedValue: cost.amount,
        timing: 'Months 0-6',
        purpose: cost.description,
        approvalRequired: cost.amount > 100000 ? 'Steering Committee' : 'Program Manager',
      }));

    return {
      items,
      vendorManagement: [
        'Monthly vendor performance reviews',
        'Contract compliance monitoring',
        'Service level agreement tracking',
      ],
      policies: [
        'All procurement >$50k requires competitive bidding',
        'Vendor selection based on capability and cost',
        'Quarterly vendor portfolio review',
      ],
      totalProcurementValue: items.reduce((sum, i) => sum + i.estimatedValue, 0),
      confidence: 0.75,
    };
  }
}

/**
 * Exit Strategy Generator
 */
export class ExitStrategyGenerator {
  async generate(insights: StrategyInsights, riskRegister: RiskRegister): Promise<ExitStrategy> {
    return {
      failureConditions: riskRegister.topRisks.slice(0, 3).map(risk => ({
        trigger: risk.description,
        severity: (risk.impact === 'Low' ? 'Medium' : risk.impact) as 'Critical' | 'High' | 'Medium',
        responseTime: risk.impact === 'Critical' ? 'Immediate' : '30 days',
      })),
      rollbackProcedures: [
        {
          name: 'Program Pause',
          trigger: 'Critical risk realized or budget overrun >30%',
          actions: ['Pause all workstreams', 'Stakeholder notification', 'Impact assessment', 'Remediation plan'],
          estimatedCost: 100000,
          timeline: '2-4 weeks',
        },
        {
          name: 'Graceful Wind-Down',
          trigger: 'Strategic objectives no longer valid',
          actions: ['Complete in-flight deliverables', 'Knowledge transfer', 'Asset disposition', 'Team redeployment'],
          estimatedCost: 250000,
          timeline: '3 months',
        },
      ],
      pivotOptions: [
        { name: 'Reduce Scope', description: 'Focus on core deliverables only', conditions: ['Budget constraints', 'Timeline pressure'] },
        { name: 'Phased Approach', description: 'Deliver in multiple phases', conditions: ['Resource constraints', 'Risk mitigation'] },
      ],
      lessonsLearned: [
        'Conduct post-implementation review',
        'Document successes and challenges',
        'Update organizational playbooks',
      ],
      confidence: 0.75,
    };
  }
}

/**
 * Program Name Generator
 */
export class ProgramNameGenerator {
  async generate(
    insights: StrategyInsights,
    userContext?: UserContext,
    namingContext?: any
  ): Promise<string> {
    try {
      // Debug: Log what we received
      console.log(`[ProgramNameGenerator] Received namingContext:`, {
        hasNamingContext: !!namingContext,
        journeyTitle: namingContext?.journeyTitle || 'NOT SET',
        hasDecisions: !!namingContext?.selectedDecisions,
        hasBmcInsights: !!namingContext?.bmcKeyInsights?.length
      });
      
      // PRIORITY: Use journey title if available (from strategic_understanding)
      // This is the user-facing name they see in the journey, so use it directly
      if (namingContext?.journeyTitle && namingContext.journeyTitle.trim().length > 0) {
        console.log(`[ProgramNameGenerator] 🎯 Using journey title: "${namingContext.journeyTitle}"`);
        return namingContext.journeyTitle.trim();
      }
      
      const keyInsights = namingContext?.bmcKeyInsights || [];
      const recommendations = namingContext?.bmcRecommendations || [];
      const selectedDecisions = namingContext?.selectedDecisions || {};
      const decisionsData = namingContext?.decisionsData || {};
      const framework = namingContext?.framework || 'bmc';
      
      let contextSummary = '';
      
      if (keyInsights.length > 0) {
        contextSummary += `\nKey Strategic Insights:\n${keyInsights.slice(0, 3).join('\n')}`;
      }
      
      if (recommendations.length > 0) {
        const recs = recommendations.slice(0, 2).map((r: any) => 
          typeof r === 'object' ? r.action : r
        );
        contextSummary += `\n\nTop Recommendations:\n${recs.join('\n')}`;
      }
      
      if (decisionsData?.decisions && selectedDecisions) {
        const selectedOptions: string[] = [];
        decisionsData.decisions.forEach((decision: any) => {
          const selectedOptionId = selectedDecisions[decision.id];
          if (selectedOptionId) {
            const option = decision.options?.find((o: any) => o.id === selectedOptionId);
            if (option) {
              selectedOptions.push(`${decision.title}: ${option.label}`);
            }
          }
        });
        
        if (selectedOptions.length > 0) {
          contextSummary += `\n\nSelected Strategic Decisions:\n${selectedOptions.slice(0, 3).join('\n')}`;
        }
      }
      
      const prompt = `You are an expert program manager creating concise, descriptive program names.

Given the following strategic analysis and decisions, generate a professional program name that captures the essence of this initiative.

${contextSummary}

Framework Used: ${framework.toUpperCase()}

Requirements:
- 8-15 words maximum
- Clear and descriptive
- Professional tone
- Captures the core strategic approach
- Avoid generic terms like "Strategic Initiative"
- Focus on the unique strategic choices made

Examples of good program names:
- "Brooklyn Coffee Shop Community Hub with Diversified Revenue Strategy"
- "Premium Customer Segment Market Entry via Pop-up Testing"
- "Sustainable Pace Technology Integration for Local Market"

Generate ONLY the program name, nothing else.`;

      const result = await aiClients.callWithFallback({
        systemPrompt: 'You are a program naming expert. Generate concise, professional program names.',
        userMessage: prompt,
        maxTokens: 100,
      });
      
      const programName = result.content.trim();
      
      if (programName && programName.length > 0 && programName.length <= 150) {
        return programName;
      }
      
      return this.generateFallbackProgramName(selectedDecisions, decisionsData, framework);
      
    } catch (error) {
      console.error('[ProgramNameGenerator] Program name generation failed:', error);
      return this.generateFallbackProgramName(
        namingContext?.selectedDecisions,
        namingContext?.decisionsData,
        namingContext?.framework || 'bmc'
      );
    }
  }

  private generateFallbackProgramName(
    selectedDecisions: any,
    decisionsData: any,
    framework: string
  ): string {
    const parts: string[] = [];
    
    if (decisionsData?.decisions && selectedDecisions) {
      decisionsData.decisions.slice(0, 2).forEach((decision: any) => {
        const selectedOptionId = selectedDecisions[decision.id];
        if (selectedOptionId) {
          const option = decision.options?.find((o: any) => o.id === selectedOptionId);
          if (option) {
            parts.push(option.label);
          }
        }
      });
    }
    
    if (parts.length === 0) {
      return `${framework.toUpperCase()} Strategic Initiative`;
    }
    
    return parts.slice(0, 3).join(' - ') + ' Program';
  }
}

export default {
  ExecutiveSummaryGenerator,
  FinancialPlanGenerator,
  BenefitsGenerator,
  RiskGenerator,
  StageGateGenerator,
  KPIGenerator,
  StakeholderGenerator,
  GovernanceGenerator,
  QAPlanGenerator,
  ProcurementGenerator,
  ExitStrategyGenerator,
  ProgramNameGenerator,
};
