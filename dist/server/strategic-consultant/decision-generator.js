import Anthropic from '@anthropic-ai/sdk';
import { strategyOntologyService } from '../ontology/strategy-ontology-service';
export class DecisionGenerator {
    anthropic;
    constructor() {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY environment variable is required');
        }
        this.anthropic = new Anthropic({ apiKey });
    }
    async generateDecisions(analysis, originalInput) {
        const approaches = strategyOntologyService.getStrategicApproaches();
        const markets = strategyOntologyService.getMarketContexts();
        const approachOptions = analysis.recommended_approaches.map(id => {
            const approach = approaches[id];
            return {
                id,
                label: approach?.label || id,
                requires: approach?.requires || [],
                cost_range: approach?.cost_range,
                timeline: approach?.timeline_months
            };
        });
        const marketInfo = markets[analysis.recommended_market];
        const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 6000,
            temperature: 0.4,
            messages: [
                {
                    role: 'user',
                    content: `You are a strategic consultant creating decision points for executive review.

CONTEXT:
${analysis.executive_summary}

ROOT CAUSE: ${analysis.five_whys.root_cause}

RECOMMENDED APPROACHES: ${approachOptions.map(a => a.label).join(', ')}
RECOMMENDED MARKET: ${marketInfo?.label || analysis.recommended_market}

ORIGINAL INPUT SUMMARY:
${originalInput.substring(0, 1500)}

Create 2-4 strategic decision points that an executive must choose between. Each decision should:
1. Have 2-4 options to choose from
2. Include cost estimates where relevant (in dollars)
3. Include timeline estimates where relevant (in months)
4. Show pros and cons clearly
5. Mark one option as recommended

Decision points should cover:
- Strategic approach selection
- Market entry strategy
- Implementation priorities
- Resource allocation

Return ONLY valid JSON (no markdown, no explanation):

{
  "decisions": [
    {
      "id": "decision_1",
      "title": "Decision Title",
      "question": "Clear question for executive to answer",
      "context": "Why this decision matters (2-3 sentences)",
      "options": [
        {
          "id": "option_1",
          "label": "Option Label",
          "description": "Detailed description of this option",
          "estimated_cost": { "min": 1000000, "max": 2000000 },
          "estimated_timeline_months": 12,
          "pros": ["pro 1", "pro 2", "pro 3"],
          "cons": ["con 1", "con 2"],
          "recommended": true
        }
      ],
      "impact_areas": ["area 1", "area 2"]
    }
  ],
  "decision_flow": "Brief explanation of how these decisions build on each other",
  "estimated_completion_time_minutes": 5
}`,
                },
            ],
        });
        const textContent = response.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('\n');
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to extract JSON from decision generation response');
        }
        const generated = JSON.parse(jsonMatch[0]);
        return this.enrichWithOntologyData(generated, analysis);
    }
    async generateDecisionsWithResearch(analysis, originalInput, researchFindings, portersAnalysis) {
        const approaches = strategyOntologyService.getStrategicApproaches();
        const markets = strategyOntologyService.getMarketContexts();
        const approachOptions = analysis.recommended_approaches.map(id => {
            const approach = approaches[id];
            return {
                id,
                label: approach?.label || id,
                requires: approach?.requires || [],
                cost_range: approach?.cost_range,
                timeline: approach?.timeline_months
            };
        });
        const marketInfo = markets[analysis.recommended_market];
        // Build validation map keyed by exact claim text for precise matching
        const validationMap = new Map();
        if (researchFindings.validation) {
            for (const v of researchFindings.validation) {
                validationMap.set(v.claim, v);
            }
        }
        // Format findings with validation indicators - use exact text match
        const formatWithValidation = (findings) => findings.map(f => {
            const validation = validationMap.get(f.fact);
            if (validation && validation.strength !== 'STRONG') {
                return `${f.fact} [${validation.strength}: ${validation.details}]`;
            }
            return f.fact;
        }).join('; ');
        // Extract key research insights WITH validation indicators
        const languageInsights = formatWithValidation(researchFindings.language_preferences);
        const marketDynamics = formatWithValidation(researchFindings.market_dynamics);
        const competitiveInsights = formatWithValidation(researchFindings.competitive_landscape);
        const buyerBehavior = formatWithValidation(researchFindings.buyer_behavior);
        // Extract Porter's strategic responses
        const strategicResponses = [
            portersAnalysis.competitive_rivalry.strategic_response,
            portersAnalysis.supplier_power.strategic_response,
            portersAnalysis.buyer_power.strategic_response,
            portersAnalysis.threat_of_substitution.strategic_response,
            portersAnalysis.threat_of_new_entry.strategic_response
        ].filter(Boolean);
        const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8000,
            temperature: 0.4,
            messages: [
                {
                    role: 'user',
                    content: `You are a strategic consultant creating decision points for executive review.

CRITICAL CONSTRAINT: You must generate decisions that are CONSISTENT WITH RESEARCH FINDINGS.

CONTEXT:
${analysis.executive_summary}

ROOT CAUSE: ${analysis.five_whys.root_cause}

RECOMMENDED APPROACHES: ${approachOptions.map(a => a.label).join(', ')}
RECOMMENDED MARKET: ${marketInfo?.label || analysis.recommended_market}

ORIGINAL INPUT SUMMARY:
${originalInput.substring(0, 1000)}

RESEARCH FINDINGS:
Language Preferences: ${languageInsights || 'No specific insights'}
Market Dynamics: ${marketDynamics || 'No specific insights'}
Competitive Landscape: ${competitiveInsights || 'No specific insights'}
Buyer Behavior: ${buyerBehavior || 'No specific insights'}

PORTER'S FIVE FORCES STRATEGIC RESPONSES:
${strategicResponses.join('\n')}

CRITICAL VALIDATION RULES:

🔴 WEAK EVIDENCE HANDLING:
- NEVER use WEAK evidence as the PRIMARY reason to mark options as "❌ Not Recommended"
- If a strategic option conflicts with WEAK evidence, mark it as "⚠️ Requires validation" or "Approach with caution"
- In the reasoning field, explicitly state: "This recommendation is based on contested data [citation]. Further validation recommended before commitment."

Example (WRONG):
Finding: "95% AI pilots fail [WEAK: Single 2021 source, contradicted by recent studies]"
Decision: ❌ Not Recommended - High risk based on 95% failure rate

Example (CORRECT):
Finding: "95% AI pilots fail [WEAK: Single 2021 source, contradicted by recent studies]"
Decision: ⚠️ Approach with caution - Earlier studies suggested high failure rates, but this data is contested. Recent evidence shows 53-67% success rates with proper implementation. Recommend pilot program with clear success metrics.

🟡 MODERATE EVIDENCE:
- Use as supporting evidence, but acknowledge limitations
- Example: "Research suggests X [MODERATE: 2 sources, 18 months old], though conditions may have evolved"

🟢 STRONG EVIDENCE (no validation warning shown):
- Use confidently as primary decision basis
- Multiple recent sources, no contradictions

RULES FOR DECISION OPTIONS:
1. If research CONTRADICTS an assumption from the original input, DO NOT recommend options based on that assumption
2. Prioritize options that align with research findings and Porter's strategic responses
3. Mark as "recommended: true" ONLY options that are supported by research findings
4. If the input mentioned a strategy that research contradicted, include it as an option but mark "recommended: false" and add a "warning" field explaining why
5. Each option must include a "reasoning" field that cites specific research findings or Porter's analysis

EXAMPLE (Arabic language case):
If input said: "Arabic language differentiation"
But research found: "English dominates UAE business (78% of enterprises)"

CORRECT decision structure:
{
  "options": [
    {
      "id": "english_first",
      "label": "English-First Global Alternative",
      "description": "Position as premium English-based platform with optional multilingual support",
      "recommended": true,
      "reasoning": "Research shows English is dominant business language in 78% of UAE enterprises",
      "pros": ["Aligns with market reality", "Lower localization cost", "Faster time to market"],
      "cons": ["May miss niche Arabic-only opportunities"]
    },
    {
      "id": "arabic_focus",
      "label": "Arabic-First Cultural Pioneer",
      "description": "Differentiate through comprehensive Arabic language and cultural features",
      "recommended": false,
      "warning": "Not recommended - contradicts research findings",
      "reasoning": "Research shows English dominates UAE business communications; limited evidence of willingness-to-pay for Arabic-specific features",
      "pros": ["Potential niche differentiation"],
      "cons": ["Contradicts market research", "Higher development cost", "Smaller addressable market"]
    }
  ]
}

Create 2-4 strategic decision points that an executive must choose between. Each decision should:
1. Have 2-4 options to choose from
2. Include cost estimates where relevant (in dollars)
3. Include timeline estimates where relevant (in months)
4. Show pros and cons clearly
5. Mark one option as recommended (the one MOST ALIGNED with research findings)
6. Include reasoning field citing research findings or Porter's analysis
7. Add warning field for options contradicted by research

Decision points should cover:
- Strategic approach selection (informed by Porter's priorities)
- Market entry strategy (informed by research)
- Implementation priorities (informed by competitive landscape)
- Resource allocation (informed by buyer behavior)

Return ONLY valid JSON (no markdown, no explanation):

{
  "decisions": [
    {
      "id": "decision_1",
      "title": "Decision Title",
      "question": "Clear question for executive to answer",
      "context": "Why this decision matters (2-3 sentences)",
      "options": [
        {
          "id": "option_1",
          "label": "Option Label",
          "description": "Detailed description of this option",
          "estimated_cost": { "min": 1000000, "max": 2000000 },
          "estimated_timeline_months": 12,
          "pros": ["pro 1", "pro 2", "pro 3"],
          "cons": ["con 1", "con 2"],
          "recommended": true,
          "reasoning": "Cite specific research finding or Porter's analysis here"
        }
      ],
      "impact_areas": ["area 1", "area 2"]
    }
  ],
  "decision_flow": "Brief explanation of how these decisions build on each other",
  "estimated_completion_time_minutes": 5
}`,
                },
            ],
        });
        const textContent = response.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('\n');
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to extract JSON from research-informed decision generation response');
        }
        const generated = JSON.parse(jsonMatch[0]);
        // Validate against research before returning
        const validation = this.validateDecisionsAgainstResearch(generated, researchFindings);
        if (!validation.valid) {
            // If there are critical contradictions, throw an error to force regeneration
            const criticalIssues = validation.issues.filter(issue => issue.includes('recommends Arabic') ||
                issue.includes('contradicts research'));
            if (criticalIssues.length > 0) {
                throw new Error(`Decision generation contradicts research findings:\n${criticalIssues.join('\n')}\n\nPlease regenerate decisions that align with research.`);
            }
            // Non-critical issues just get logged as warnings
            console.warn('Decision validation warnings:', validation.issues);
        }
        return this.enrichWithOntologyData(generated, analysis);
    }
    validateDecisionsAgainstResearch(decisions, researchFindings) {
        const issues = [];
        // Extract key research facts for validation
        const languageFacts = researchFindings.language_preferences.map(f => f.fact.toLowerCase());
        const marketFacts = researchFindings.market_dynamics.map(f => f.fact.toLowerCase());
        // Check each decision for contradictions
        decisions.decisions.forEach(decision => {
            decision.options.forEach(option => {
                if (option.recommended) {
                    // Check for common contradictions
                    // Arabic language contradiction
                    const optionText = `${option.label} ${option.description}`.toLowerCase();
                    const emphasizesArabic = /arabic|multilingual.*arabic|arabic.*first/i.test(optionText);
                    const englishDominates = languageFacts.some(f => /english.*dominat|english.*preferre|english.*78%|english.*majority/i.test(f));
                    if (emphasizesArabic && englishDominates) {
                        issues.push(`Option "${option.label}" in decision "${decision.title}" recommends Arabic focus but research shows English dominates business communications`);
                    }
                    // Check if option lacks reasoning field
                    if (!option.reasoning) {
                        issues.push(`Option "${option.label}" in decision "${decision.title}" is recommended but lacks research-based reasoning`);
                    }
                }
                // Check that contradicted options have warnings
                if (option.recommended === false && !option.warning) {
                    issues.push(`Option "${option.label}" in decision "${decision.title}" is not recommended but lacks warning explanation`);
                }
            });
        });
        return {
            valid: issues.length === 0,
            issues
        };
    }
    enrichWithOntologyData(decisions, analysis) {
        const enrichedDecisions = decisions.decisions.map(decision => {
            const enrichedOptions = decision.options.map(option => {
                if (option.id.includes('approach') || analysis.recommended_approaches.some(a => option.label.includes(a))) {
                    const approachId = analysis.recommended_approaches.find(id => option.label.toLowerCase().includes(id.replace('_', ' ')));
                    if (approachId) {
                        const costEstimate = strategyOntologyService.calculateCostEstimate(approachId, analysis.recommended_market);
                        if (costEstimate && !option.estimated_cost) {
                            option.estimated_cost = { min: costEstimate.min, max: costEstimate.max };
                            option.estimated_timeline_months = costEstimate.timeline_months;
                        }
                    }
                }
                return option;
            });
            return {
                ...decision,
                options: enrichedOptions
            };
        });
        return {
            ...decisions,
            decisions: enrichedDecisions
        };
    }
    async generateDecisionsFromBMC(bmcResult, // BMCResearchResult type
    originalInput) {
        // Extract key insights from BMC blocks
        const bmcBlocks = bmcResult.blocks || [];
        const contradictions = bmcResult.contradictions || [];
        const recommendations = bmcResult.recommendations || [];
        const keyInsights = bmcResult.keyInsights || [];
        // Format BMC findings for AI
        const bmcSummary = bmcBlocks.map((block) => `${block.blockName}: ${block.description}\nFindings: ${block.findings.map((f) => f.fact).slice(0, 3).join('; ')}\nConfidence: ${block.confidence}`).join('\n\n');
        const contradictionsSummary = contradictions.length > 0
            ? `\n\nCONTRADICTIONS FOUND:\n${contradictions.map((c) => `- ${c.assumption}: ${c.contradictedBy.map((cb) => cb.fact).join('; ')}`).join('\n')}`
            : '';
        const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8000,
            temperature: 0.4,
            messages: [
                {
                    role: 'user',
                    content: `You are a strategic consultant creating decision points based on a Business Model Canvas analysis.

ORIGINAL INPUT:
${originalInput.substring(0, 1500)}

BUSINESS MODEL CANVAS ANALYSIS:
${bmcSummary}${contradictionsSummary}

KEY INSIGHTS:
${keyInsights.join('\n')}

RECOMMENDATIONS:
${recommendations.map((r) => `${r.priority}: ${r.action} - ${r.rationale}`).slice(0, 5).join('\n')}

Create 2-4 strategic decision points that an executive must choose between based on this BMC analysis. Each decision should:
1. Have 2-4 options to choose from
2. Include cost estimates where relevant (in dollars)
3. Include timeline estimates where relevant (in months)
4. Show pros and cons clearly
5. Mark one option as recommended
6. Address contradictions found in the analysis

Decision points should cover areas like:
- Customer segment prioritization
- Value proposition differentiation
- Revenue model selection
- Channel strategy
- Resource allocation priorities

Return ONLY valid JSON (no markdown, no explanation):

{
  "decisions": [
    {
      "id": "decision_1",
      "title": "Decision Title",
      "question": "Clear question for executive to answer",
      "context": "Why this decision matters based on BMC analysis (2-3 sentences)",
      "options": [
        {
          "id": "option_1",
          "label": "Option Label",
          "description": "Detailed description of this option",
          "estimated_cost": { "min": 100000, "max": 250000 },
          "estimated_timeline_months": 6,
          "pros": ["pro 1 based on BMC findings", "pro 2", "pro 3"],
          "cons": ["con 1", "con 2"],
          "recommended": true,
          "reasoning": "Why this option is recommended based on BMC analysis"
        }
      ],
      "impact_areas": ["Customer Segments", "Revenue Streams", "etc"]
    }
  ],
  "decision_flow": "Brief explanation of how these decisions build on the BMC analysis",
  "estimated_completion_time_minutes": 5
}`,
                },
            ],
        });
        const textContent = response.content.find((block) => block.type === 'text');
        if (!textContent) {
            throw new Error('No text content in AI response');
        }
        // Extract JSON from response (handle markdown code blocks)
        let responseText = textContent.text.trim();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('Invalid JSON response from AI:', responseText);
            throw new Error('AI did not return valid JSON for BMC decisions');
        }
        const generated = JSON.parse(jsonMatch[0]);
        // Basic validation
        const validation = await this.validateDecisions(generated);
        if (!validation.valid) {
            console.warn('BMC decision validation warnings:', validation.issues);
        }
        return generated;
    }
    async validateDecisions(decisions) {
        const issues = [];
        if (decisions.decisions.length < 2) {
            issues.push('Must have at least 2 decision points');
        }
        if (decisions.decisions.length > 4) {
            issues.push('Should have at most 4 decision points');
        }
        for (const decision of decisions.decisions) {
            if (decision.options.length < 2) {
                issues.push(`Decision "${decision.title}" must have at least 2 options`);
            }
            if (decision.options.length > 4) {
                issues.push(`Decision "${decision.title}" should have at most 4 options`);
            }
            const recommendedCount = decision.options.filter(o => o.recommended).length;
            if (recommendedCount === 0) {
                issues.push(`Decision "${decision.title}" should have one recommended option`);
            }
            if (recommendedCount > 1) {
                issues.push(`Decision "${decision.title}" should have only one recommended option`);
            }
        }
        return {
            valid: issues.length === 0,
            issues
        };
    }
}
//# sourceMappingURL=decision-generator.js.map