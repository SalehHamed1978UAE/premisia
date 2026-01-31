/**
 * Analysis Aggregator
 * Reads all framework insights for a session and normalizes them into StrategyInsights.
 * This enables EPM generation from ANY strategic framework, not just BMC.
 */

import { db } from '../db';
import { frameworkInsights, journeySessions } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { decryptJSONKMS } from '../utils/kms-encryption';
import { BMCAnalyzer } from './bmc-analyzer';
import { PortersAnalyzer } from './porters-analyzer';
import { PESTLEAnalyzer } from './pestle-analyzer';
import type { StrategyInsights, StrategyInsight, BMCResults, PortersResults, PESTLEResults } from './types';
import type { SWOTOutput, SWOTFactor } from './swot-analyzer';

const bmcAnalyzer = new BMCAnalyzer();
const portersAnalyzer = new PortersAnalyzer();
const pestleAnalyzer = new PESTLEAnalyzer();

export interface AggregatedAnalysis {
  insights: StrategyInsights | null;
  availableFrameworks: string[];
  primaryFramework: string | null;
}

/**
 * Get all available analyses for a session and normalize to StrategyInsights
 *
 * ARCHITECTURE FIX: Now checks BOTH sources:
 * 1. framework_insights table (legacy framework runs)
 * 2. journey_sessions table (journey-based analysis)
 */
export async function getAggregatedAnalysis(sessionId: string): Promise<AggregatedAnalysis> {
  console.log(`[AnalysisAggregator] Fetching insights for understandingId: ${sessionId}`);

  const analyses: Record<string, any> = {};
  const availableFrameworks: string[] = [];

  // SOURCE 1: Query framework_insights table (legacy)
  const frameworkInsightsData = await db.select()
    .from(frameworkInsights)
    .where(eq(frameworkInsights.understandingId, sessionId));

  if (frameworkInsightsData && frameworkInsightsData.length > 0) {
    console.log(`[AnalysisAggregator] Found ${frameworkInsightsData.length} framework insights`);
    for (const insight of frameworkInsightsData) {
      try {
        const decrypted = await decryptJSONKMS(insight.insights as string);
        const data = (decrypted as any)?.output || decrypted;
        const frameworkName = insight.frameworkName.toLowerCase();
        analyses[frameworkName] = data;
        availableFrameworks.push(frameworkName);
        console.log(`[AnalysisAggregator] Found ${frameworkName} from framework_insights`);
      } catch (err) {
        console.error(`[AnalysisAggregator] Failed to decrypt ${insight.frameworkName}:`, err);
      }
    }
  }

  // SOURCE 2: Query journey_sessions table (journey-based analysis)
  // This is where Market Entry and other journey analysis data is stored
  const journeyData = await db.select()
    .from(journeySessions)
    .where(eq(journeySessions.understandingId, sessionId))
    .orderBy(desc(journeySessions.updatedAt))
    .limit(1);

  if (journeyData && journeyData.length > 0 && journeyData[0].analysisData) {
    console.log(`[AnalysisAggregator] Found journey session analysis data`);
    const analysisData = journeyData[0].analysisData as any;

    // Extract SWOT from journey
    const swotData = analysisData?.swot?.data?.output ||
                     analysisData?.swot?.output ||
                     analysisData?.swot;
    if (swotData?.strengths && !analyses.swot) {
      analyses.swot = swotData;
      if (!availableFrameworks.includes('swot')) availableFrameworks.push('swot');
      console.log(`[AnalysisAggregator] Found swot from journey_sessions`);
    }

    // Extract PESTLE from journey
    const pestleData = analysisData?.pestle?.data?.pestleResults ||
                       analysisData?.pestle?.pestleResults ||
                       analysisData?.pestle;
    if (pestleData && !analyses.pestle) {
      analyses.pestle = pestleData;
      if (!availableFrameworks.includes('pestle')) availableFrameworks.push('pestle');
      console.log(`[AnalysisAggregator] Found pestle from journey_sessions`);
    }

    // Extract Porter's from journey
    const portersData = analysisData?.porters?.data?.portersResults ||
                        analysisData?.porters?.portersResults ||
                        analysisData?.porters;
    if (portersData && !analyses.porters) {
      analyses.porters = portersData;
      if (!availableFrameworks.includes('porters')) availableFrameworks.push('porters');
      console.log(`[AnalysisAggregator] Found porters from journey_sessions`);
    }

    // Extract BMC from journey
    const bmcData = analysisData?.bmc?.data?.output ||
                    analysisData?.bmc?.output ||
                    analysisData?.bmc;
    if (bmcData && !analyses.bmc) {
      analyses.bmc = bmcData;
      if (!availableFrameworks.includes('bmc')) availableFrameworks.push('bmc');
      console.log(`[AnalysisAggregator] Found bmc from journey_sessions`);
    }

    // Extract Five Whys from journey
    const fiveWhysData = analysisData?.five_whys?.data?.output ||
                         analysisData?.five_whys?.output ||
                         analysisData?.five_whys;
    if (fiveWhysData && !analyses.five_whys) {
      analyses.five_whys = fiveWhysData;
      if (!availableFrameworks.includes('five_whys')) availableFrameworks.push('five_whys');
      console.log(`[AnalysisAggregator] Found five_whys from journey_sessions`);
    }
  }

  if (availableFrameworks.length === 0) {
    console.log('[AnalysisAggregator] No analysis found in either framework_insights or journey_sessions');
    return { insights: null, availableFrameworks: [], primaryFramework: null };
  }

  console.log(`[AnalysisAggregator] Total frameworks available: ${availableFrameworks.join(', ')}`);

  let normalizedInsights: StrategyInsights | null = null;
  let primaryFramework: string | null = null;

  // Priority: BMC > SWOT > Porters > PESTLE (BMC has most business context)
  if (analyses.bmc || analyses.business_model_canvas) {
    const bmcData = analyses.bmc || analyses.business_model_canvas;
    normalizedInsights = await normalizeBMC(bmcData);
    primaryFramework = 'bmc';
  } else if (analyses.swot) {
    normalizedInsights = await normalizeSWOT(analyses.swot);
    primaryFramework = 'swot';
  } else if (analyses.porters || analyses.porters_five_forces) {
    const portersData = analyses.porters || analyses.porters_five_forces;
    normalizedInsights = await portersAnalyzer.analyze(portersData as PortersResults);
    primaryFramework = 'porters';
  } else if (analyses.pestle) {
    normalizedInsights = await pestleAnalyzer.analyze(analyses.pestle as PESTLEResults);
    primaryFramework = 'pestle';
  } else {
    const firstKey = availableFrameworks[0];
    primaryFramework = firstKey;
    normalizedInsights = createMinimalInsights(analyses[firstKey], firstKey);
  }

  if (normalizedInsights && availableFrameworks.length > 1) {
    normalizedInsights = await mergeAdditionalInsights(normalizedInsights, analyses, primaryFramework!);
  }

  console.log(`[AnalysisAggregator] Primary framework: ${primaryFramework}, total frameworks: ${availableFrameworks.length}`);

  return {
    insights: normalizedInsights,
    availableFrameworks,
    primaryFramework,
  };
}

export async function normalizeBMC(bmcData: any): Promise<StrategyInsights> {
  const blocks = bmcData.blocks || [];
  const findBlock = (name: string) => blocks.find((b: any) =>
    b.blockName?.toLowerCase().includes(name.toLowerCase())
  )?.description || '';

  const bmcResults: BMCResults = {
    customerSegments: findBlock('Customer Segments'),
    valuePropositions: findBlock('Value Propositions'),
    channels: findBlock('Channels'),
    customerRelationships: findBlock('Customer Relationships'),
    revenueStreams: findBlock('Revenue Streams'),
    keyActivities: findBlock('Key Activities'),
    keyResources: findBlock('Key Resources'),
    keyPartnerships: findBlock('Key Partnerships'),
    costStructure: findBlock('Cost Structure'),
    contradictions: bmcData.contradictions || [],
    recommendations: bmcData.recommendations || [],
    executiveSummary: (bmcData.keyInsights || []).join('. '),
  };

  return bmcAnalyzer.analyze(bmcResults);
}

export async function normalizeSWOT(swotData: any): Promise<StrategyInsights> {
  const data = swotData.output || swotData;
  const insights: StrategyInsight[] = [];

  // Extract from strengths (resources)
  const strengths = data.strengths || [];
  for (let idx = 0; idx < strengths.length; idx++) {
    const s = strengths[idx];
    const factor = normalizeFactor(s);
    insights.push({
      type: 'resource',
      source: `SWOT.strengths[${idx}]`,
      content: factor.factor,
      confidence: 0.85,
      reasoning: 'Strength indicates existing capability',
      metadata: { impact: factor.impact },
    });
  }

  // Extract from weaknesses (risks)
  const weaknesses = data.weaknesses || [];
  for (let idx = 0; idx < weaknesses.length; idx++) {
    const w = weaknesses[idx];
    const factor = normalizeFactor(w);
    insights.push({
      type: 'risk',
      source: `SWOT.weaknesses[${idx}]`,
      content: `Internal weakness: ${factor.factor}`,
      confidence: 0.85,
      reasoning: 'Weakness indicates internal risk',
      metadata: { severity: factor.impact === 'high' ? 'High' : 'Medium', category: 'Internal' },
    });
  }

  // Extract from opportunities (workstreams + benefits)
  const opportunities = data.opportunities || [];
  for (let idx = 0; idx < opportunities.length; idx++) {
    const o = opportunities[idx];
    const factor = normalizeFactor(o);
    insights.push({
      type: 'workstream',
      source: `SWOT.opportunities[${idx}]`,
      content: `Capitalize on: ${factor.factor}`,
      confidence: 0.80,
      reasoning: 'Opportunity suggests strategic initiative',
      metadata: { category: 'Growth', priority: factor.impact },
    });
    insights.push({
      type: 'benefit',
      source: `SWOT.opportunities[${idx}]`,
      content: factor.factor,
      confidence: 0.75,
      reasoning: 'Opportunity represents potential value',
      metadata: { category: 'Strategic' },
    });
  }

  // Extract from threats (risks)
  const threats = data.threats || [];
  for (let idx = 0; idx < threats.length; idx++) {
    const t = threats[idx];
    const factor = normalizeFactor(t);
    insights.push({
      type: 'risk',
      source: `SWOT.threats[${idx}]`,
      content: `External threat: ${factor.factor}`,
      confidence: 0.85,
      reasoning: 'Threat indicates external risk',
      metadata: { severity: factor.impact === 'high' ? 'High' : 'Medium', category: 'External' },
    });
  }

  // Extract strategic options if available
  const strategicOptions = data.strategicOptions || data.strategic_options;
  if (strategicOptions) {
    const addOptions = (arr: string[] | undefined, source: string, reasoning: string, priority: string) => {
      arr?.forEach((strategy, idx) => {
        insights.push({
          type: 'workstream',
          source: `SWOT.strategicOptions.${source}[${idx}]`,
          content: strategy,
          confidence: 0.80,
          reasoning,
          metadata: { category: 'Strategic', priority },
        });
      });
    };

    addOptions(strategicOptions.so || strategicOptions.soStrategies, 'SO', 'Leverage strengths to pursue opportunities', 'high');
    addOptions(strategicOptions.wo || strategicOptions.woStrategies, 'WO', 'Address weaknesses to pursue opportunities', 'medium');
    addOptions(strategicOptions.st || strategicOptions.stStrategies, 'ST', 'Use strengths to mitigate threats', 'medium');
    addOptions(strategicOptions.wt || strategicOptions.wtStrategies, 'WT', 'Minimize weaknesses and avoid threats', 'low');
  }

  // Infer timeline
  const totalFactors = strengths.length + weaknesses.length + opportunities.length + threats.length;
  const months = totalFactors > 16 ? 18 : totalFactors < 8 ? 6 : 12;
  insights.push({
    type: 'timeline',
    source: 'SWOT.inference',
    content: `Recommended timeline: ${months} months`,
    confidence: 0.70,
    reasoning: `Based on ${totalFactors} strategic factors`,
    metadata: { estimatedMonths: months },
  });

  // Infer urgency and risk tolerance
  const highThreats = threats.filter((t: any) => normalizeFactor(t).impact === 'high').length;
  const urgency: 'ASAP' | 'Strategic' | 'Exploratory' = highThreats > 2 ? 'ASAP' : highThreats > 0 ? 'Strategic' : 'Exploratory';
  
  const risks = weaknesses.length + threats.length;
  const riskTolerance: 'Conservative' | 'Moderate' | 'Aggressive' = 
    risks > strengths.length + 3 ? 'Conservative' : 
    strengths.length > risks + 2 ? 'Aggressive' : 'Moderate';

  const overallConfidence = insights.length > 0 
    ? Math.max(0.5, Math.min(0.95, insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length))
    : 0.5;

  return {
    frameworkType: 'swot',
    frameworkRunId: `swot-${Date.now()}`,
    insights,
    references: [],
    marketContext: {
      urgency,
      riskTolerance,
    },
    overallConfidence,
  };
}

function normalizeFactor(factor: any): { factor: string; impact: 'high' | 'medium' | 'low' } {
  if (typeof factor === 'string') {
    return { factor, impact: 'medium' };
  }
  return {
    factor: factor.factor || factor.description || String(factor),
    impact: factor.impact || factor.importance || 'medium',
  };
}

function createMinimalInsights(data: any, frameworkName: string): StrategyInsights {
  return {
    frameworkType: 'swot', // default
    frameworkRunId: `${frameworkName}-run`,
    insights: [{
      type: 'other',
      source: frameworkName,
      content: JSON.stringify(data).substring(0, 500),
      confidence: 0.6,
      reasoning: `Extracted from ${frameworkName} analysis`,
    }],
    references: [],
    marketContext: {
      urgency: 'Strategic',
    },
    overallConfidence: 0.6,
  };
}

async function mergeAdditionalInsights(
  primary: StrategyInsights,
  analyses: Record<string, any>,
  primaryFramework: string
): Promise<StrategyInsights> {
  for (const [framework, data] of Object.entries(analyses)) {
    if (framework === primaryFramework) continue;

    try {
      let additionalInsights: StrategyInsight[] = [];

      if (framework === 'swot' && data) {
        const swotInsights = await normalizeSWOT(data);
        additionalInsights = swotInsights.insights.slice(0, 5);
      } else if ((framework === 'porters' || framework === 'porters_five_forces') && data) {
        const portersInsights = await portersAnalyzer.analyze(data as PortersResults);
        additionalInsights = portersInsights.insights.filter(i => i.type === 'risk').slice(0, 3);
      } else if (framework === 'pestle' && data) {
        const pestleInsights = await pestleAnalyzer.analyze(data as PESTLEResults);
        additionalInsights = pestleInsights.insights.filter(i => i.type === 'risk').slice(0, 3);
      }

      additionalInsights.forEach(i => {
        i.source = `[Supplementary:${framework}] ${i.source}`;
        i.confidence = i.confidence * 0.9;
      });

      primary.insights.push(...additionalInsights);
    } catch (err) {
      console.error(`[AnalysisAggregator] Failed to merge ${framework}:`, err);
    }
  }

  return primary;
}
