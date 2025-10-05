import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface StrategyOntology {
  strategic_approaches: Record<string, StrategicApproach>;
  market_contexts: Record<string, MarketContext>;
  frameworks: Record<string, Framework>;
  decision_rules: DecisionRule[];
}

interface StrategicApproach {
  label: string;
  requires: string[];
  implies?: Record<string, string>;
  workstreams: Record<string, number>;
  cost_range: { min: number; max: number };
  timeline_months: { min: number; max: number };
}

interface MarketContext {
  label: string;
  requirements: string[];
  mandatory_workstreams?: string[];
  setup_timeline_months: { min: number; max: number };
  setup_cost: { min: number; max: number };
}

interface Framework {
  label: string;
  analysis_areas?: string[];
  purpose?: string;
}

interface DecisionRule {
  if: Record<string, string>;
  then: Record<string, any>;
}

interface CostEstimate {
  min: number;
  max: number;
  breakdown: Record<string, number>;
  timeline_months: number;
  team_size: { min: number; max: number };
}

interface WorkstreamAllocation {
  name: string;
  allocation: number;
  estimated_cost: { min: number; max: number };
}

interface CoherenceValidation {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

class StrategyOntologyService {
  private ontology: StrategyOntology;

  constructor() {
    const ontologyPath = join(__dirname, 'strategy-ontology.json');
    const ontologyData = readFileSync(ontologyPath, 'utf-8');
    this.ontology = JSON.parse(ontologyData);
  }

  getStrategicApproaches(): Record<string, StrategicApproach> {
    return this.ontology.strategic_approaches;
  }

  getStrategicApproach(approachId: string): StrategicApproach | null {
    return this.ontology.strategic_approaches[approachId] || null;
  }

  getMarketContexts(): Record<string, MarketContext> {
    return this.ontology.market_contexts;
  }

  getMarketContext(marketId: string): MarketContext | null {
    return this.ontology.market_contexts[marketId] || null;
  }

  getFrameworks(): Record<string, Framework> {
    return this.ontology.frameworks;
  }

  getFramework(frameworkId: string): Framework | null {
    return this.ontology.frameworks[frameworkId] || null;
  }

  calculateCostEstimate(
    approachId: string,
    marketId: string,
    context?: Record<string, any>
  ): CostEstimate | null {
    const approach = this.getStrategicApproach(approachId);
    const market = this.getMarketContext(marketId);

    if (!approach) {
      return null;
    }

    let costMin = approach.cost_range.min;
    let costMax = approach.cost_range.max;
    let timelineMonths = Math.floor((approach.timeline_months.min + approach.timeline_months.max) / 2);

    if (market) {
      costMin += market.setup_cost.min;
      costMax += market.setup_cost.max;
      timelineMonths += Math.floor((market.setup_timeline_months.min + market.setup_timeline_months.max) / 2);
    }

    const applicableRules = this.getApplicableDecisionRules({
      approach: approachId,
      market: marketId,
      ...context
    });

    for (const rule of applicableRules) {
      if (rule.then.cost_adjustment) {
        const adjustment = rule.then.cost_adjustment;
        costMin = Math.floor(costMin * (1 + adjustment));
        costMax = Math.floor(costMax * (1 + adjustment));
      }
    }

    const workstreams = this.calculateWorkstreamAllocations(approachId, marketId, context);
    const breakdown: Record<string, number> = {};
    workstreams.forEach(ws => {
      breakdown[ws.name] = Math.floor((ws.estimated_cost.min + ws.estimated_cost.max) / 2);
    });

    const avgCost = (costMin + costMax) / 2;
    const teamSizeMin = Math.ceil(avgCost / 200000);
    const teamSizeMax = Math.ceil(avgCost / 120000);

    return {
      min: costMin,
      max: costMax,
      breakdown,
      timeline_months: timelineMonths,
      team_size: { min: teamSizeMin, max: teamSizeMax }
    };
  }

  calculateWorkstreamAllocations(
    approachId: string,
    marketId: string,
    context?: Record<string, any>
  ): WorkstreamAllocation[] {
    const approach = this.getStrategicApproach(approachId);
    const market = this.getMarketContext(marketId);

    if (!approach) {
      return [];
    }

    const workstreams: WorkstreamAllocation[] = [];
    const totalCostMin = approach.cost_range.min + (market?.setup_cost.min || 0);
    const totalCostMax = approach.cost_range.max + (market?.setup_cost.max || 0);

    for (const [wsName, allocation] of Object.entries(approach.workstreams)) {
      workstreams.push({
        name: wsName,
        allocation: allocation,
        estimated_cost: {
          min: Math.floor(totalCostMin * (allocation / 100)),
          max: Math.floor(totalCostMax * (allocation / 100))
        }
      });
    }

    if (market?.mandatory_workstreams) {
      for (const mandatoryWs of market.mandatory_workstreams) {
        const exists = workstreams.find(ws => ws.name === mandatoryWs);
        if (!exists) {
          workstreams.push({
            name: mandatoryWs,
            allocation: 10,
            estimated_cost: {
              min: Math.floor(totalCostMin * 0.1),
              max: Math.floor(totalCostMax * 0.1)
            }
          });
        }
      }
    }

    return workstreams;
  }

  validateStrategicCoherence(
    approachId: string,
    marketId: string,
    context?: Record<string, any>
  ): CoherenceValidation {
    const warnings: string[] = [];
    const errors: string[] = [];

    const approach = this.getStrategicApproach(approachId);
    const market = this.getMarketContext(marketId);

    if (!approach) {
      errors.push(`Unknown strategic approach: ${approachId}`);
      return { valid: false, warnings, errors };
    }

    if (!market) {
      errors.push(`Unknown market context: ${marketId}`);
      return { valid: false, warnings, errors };
    }

    const applicableRules = this.getApplicableDecisionRules({
      approach: approachId,
      market: marketId,
      ...context
    });

    for (const rule of applicableRules) {
      if (rule.then.mandatory_workstream) {
        const ws = rule.then.mandatory_workstream;
        if (!approach.workstreams[ws]) {
          warnings.push(`Recommended workstream '${ws}' is not included in approach`);
        }
      }
    }

    if (approach.requires && approach.requires.length > 0) {
      warnings.push(`This approach requires: ${approach.requires.join(', ')}`);
    }

    if (market.requirements && market.requirements.length > 0) {
      warnings.push(`Market requirements: ${market.requirements.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
  }

  getApplicableDecisionRules(context: Record<string, any>): DecisionRule[] {
    return this.ontology.decision_rules.filter(rule => {
      return Object.entries(rule.if).every(([key, value]) => context[key] === value);
    });
  }

  getDecisionOptions(
    approachId: string,
    marketId: string,
    context?: Record<string, any>
  ): {
    approach: StrategicApproach;
    market: MarketContext;
    cost_estimate: CostEstimate;
    workstreams: WorkstreamAllocation[];
    coherence: CoherenceValidation;
  } | null {
    const approach = this.getStrategicApproach(approachId);
    const market = this.getMarketContext(marketId);

    if (!approach || !market) {
      return null;
    }

    const costEstimate = this.calculateCostEstimate(approachId, marketId, context);
    const workstreams = this.calculateWorkstreamAllocations(approachId, marketId, context);
    const coherence = this.validateStrategicCoherence(approachId, marketId, context);

    return {
      approach,
      market,
      cost_estimate: costEstimate!,
      workstreams,
      coherence
    };
  }

  allocateWorkstreams(
    approachId: string,
    marketId: string,
    context?: Record<string, any>
  ): Array<{ id: string; label: string; cost_allocation: number; team_size: number }> {
    const workstreams = this.calculateWorkstreamAllocations(approachId, marketId, context);
    const costEstimate = this.calculateCostEstimate(approachId, marketId, context);
    
    const avgTeamSize = costEstimate ? Math.floor((costEstimate.team_size.min + costEstimate.team_size.max) / 2) : 5;
    
    return workstreams.map((ws, index) => {
      const avgCost = (ws.estimated_cost.min + ws.estimated_cost.max) / 2;
      const teamSize = Math.max(1, Math.floor((avgCost / 150000) * avgTeamSize / workstreams.length));
      
      return {
        id: `ws_${index + 1}`,
        label: ws.name,
        cost_allocation: Math.floor((ws.estimated_cost.min + ws.estimated_cost.max) / 2),
        team_size: teamSize
      };
    });
  }
}

export const strategyOntologyService = new StrategyOntologyService();
export type { CostEstimate, WorkstreamAllocation, StrategicApproach, MarketContext, Framework, CoherenceValidation };
