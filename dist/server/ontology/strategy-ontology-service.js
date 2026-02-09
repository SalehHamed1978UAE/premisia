import ontologyData from './strategy-ontology.json';
class StrategyOntologyService {
    ontology;
    constructor() {
        this.ontology = ontologyData;
    }
    getStrategicApproaches() {
        return this.ontology.strategic_approaches;
    }
    getStrategicApproach(approachId) {
        return this.ontology.strategic_approaches[approachId] || null;
    }
    getMarketContexts() {
        return this.ontology.market_contexts;
    }
    getMarketContext(marketId) {
        return this.ontology.market_contexts[marketId] || null;
    }
    getFrameworks() {
        return this.ontology.frameworks;
    }
    getFramework(frameworkId) {
        return this.ontology.frameworks[frameworkId] || null;
    }
    calculateCostEstimate(approachId, marketId, context) {
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
        const breakdown = {};
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
    calculateWorkstreamAllocations(approachId, marketId, context) {
        const approach = this.getStrategicApproach(approachId);
        const market = this.getMarketContext(marketId);
        if (!approach) {
            return [];
        }
        const workstreams = [];
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
    validateStrategicCoherence(approachId, marketId, context) {
        const warnings = [];
        const errors = [];
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
    getApplicableDecisionRules(context) {
        return this.ontology.decision_rules.filter(rule => {
            return Object.entries(rule.if).every(([key, value]) => context[key] === value);
        });
    }
    getDecisionOptions(approachId, marketId, context) {
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
            cost_estimate: costEstimate,
            workstreams,
            coherence
        };
    }
    allocateWorkstreams(approachId, marketId, context) {
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
//# sourceMappingURL=strategy-ontology-service.js.map