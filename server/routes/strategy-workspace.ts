import { Router, Request, Response } from 'express';
import { db } from '../db';
import { strategyDecisions, epmPrograms, journeySessions, strategyVersions, strategicUnderstanding, taskAssignments, goldenRecords, frameworkInsights } from '@shared/schema';
import { eq, desc, inArray, and } from 'drizzle-orm';
import { BMCAnalyzer, PortersAnalyzer, PESTLEAnalyzer, EPMSynthesizer, getAggregatedAnalysis, normalizeSWOT } from '../intelligence';
import type { BMCResults, PortersResults, PESTLEResults } from '../intelligence/types';
import { deriveTeamSizeFromBudget, extractUserConstraintsFromText } from '../intelligence/epm/constraint-utils';
import { storage } from '../storage';
import { getEPMProgram, getStrategicUnderstandingBySession } from '../services/secure-data-service';
import { createOpenAIProvider } from '../../src/lib/intelligent-planning/llm-provider';
import { backgroundJobService } from '../services/background-job-service';
import { journeySummaryService } from '../services/journey-summary-service';
import { journeyRegistry } from '../journey/journey-registry';
import { isJourneyRegistryV2Enabled } from '../config';
import type { StrategicContext, JourneyType } from '@shared/journey-types';
import { container, getService } from '../services/container';
import { ServiceKeys } from '../types/interfaces';
import type { EPMRepository, StrategyRepository } from '../repositories';
import { refreshTokenProactively } from '../replitAuth';
import { ambiguityDetector } from '../services/ambiguity-detector';

const router = Router();

// In-memory store for SSE connections
interface ProgressStream {
  res: Response;
  lastEventId: number;
}

const progressStreams = new Map<string, ProgressStream>();

// Helper to send SSE event
function sendSSEEvent(progressId: string, data: any) {
  const stream = progressStreams.get(progressId);
  if (!stream) return;

  stream.lastEventId++;
  const eventData = JSON.stringify(data);
  stream.res.write(`id: ${stream.lastEventId}\n`);
  stream.res.write(`data: ${eventData}\n\n`);
}

function extractConflictLines(input: string): string[] {
  if (!input) return [];
  const lines = input.split('\n');
  const conflicts: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^clarification_conflicts:/i.test(trimmed)) {
      inBlock = true;
      continue;
    }
    if (!inBlock) continue;
    if (trimmed === '') continue;
    if (/^[-*]\s+/.test(trimmed)) {
      conflicts.push(trimmed.replace(/^[-*]\s+/, '').trim());
      continue;
    }
    inBlock = false;
  }

  return conflicts;
}

// Create LLM provider for intelligent planning
// CRITICAL: API key validation and correct model selection
if (!process.env.OPENAI_API_KEY) {
  console.warn('[strategy-workspace] OPENAI_API_KEY not set - EPM synthesis will fail if attempted');
}
const llm = createOpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_MODEL || 'gpt-4o'
});

const epmSynthesizer = new EPMSynthesizer(llm);
const bmcAnalyzer = new BMCAnalyzer();
const portersAnalyzer = new PortersAnalyzer();
const pestleAnalyzer = new PESTLEAnalyzer();

// Helper: Extract component confidence from EPM program
function extractComponentConfidence(epmProgram: any): Record<string, number> {
  return {
    executiveSummary: (epmProgram.executiveSummary as any).confidence || 0.75,
    workstreams: (epmProgram.workstreams as any).confidence || 0.75,
    timeline: (epmProgram.timeline as any).confidence || 0.75,
    resourcePlan: (epmProgram.resourcePlan as any).confidence || 0.75,
    financialPlan: (epmProgram.financialPlan as any).confidence || 0.75,
    benefitsRealization: (epmProgram.benefitsRealization as any).confidence || 0.75,
    riskRegister: (epmProgram.riskRegister as any).confidence || 0.75,
    stageGates: (epmProgram.stageGates as any).confidence || 0.75,
    kpis: (epmProgram.kpis as any).confidence || 0.75,
    stakeholderMap: (epmProgram.stakeholderMap as any).confidence || 0.75,
    governance: (epmProgram.governance as any).confidence || 0.75,
    qaPlan: (epmProgram.qaPlan as any).confidence || 0.75,
    procurement: (epmProgram.procurement as any).confidence || 0.75,
    exitStrategy: (epmProgram.exitStrategy as any).confidence || 0.75,
  };
}

// Helper: Boost confidence based on user decisions
// This fills the 22% automation gap by incorporating strategic choices
function boostConfidenceWithDecisions(
  baseConfidence: Record<string, number>,
  userDecisions: any
): Record<string, number> {
  if (!userDecisions) {
    return baseConfidence;
  }

  const boostedConfidence = { ...baseConfidence };
  
  // Decision completeness score (0-1)
  let decisionCompleteness = 0;
  let decisionFields = 0;
  let completedFields = 0;

  // Strategic Choices page (Page 1)
  if (userDecisions.primaryCustomerSegment) completedFields++;
  decisionFields++;
  if (userDecisions.revenueModel) completedFields++;
  decisionFields++;
  if (userDecisions.channelPriorities?.length > 0) completedFields++;
  decisionFields++;
  if (userDecisions.partnershipStrategy) completedFields++;
  decisionFields++;

  // Risk & Investment page (Page 2)
  if (userDecisions.riskTolerance) completedFields++;
  decisionFields++;
  if (userDecisions.investmentCapacityMin !== undefined) completedFields++;
  decisionFields++;
  if (userDecisions.timelinePreference) completedFields++;
  decisionFields++;

  // Assumptions page (Page 3)
  if (userDecisions.validatedAssumptions?.length > 0) completedFields++;
  decisionFields++;
  if (userDecisions.concerns?.length > 0) completedFields++;
  decisionFields++;

  // Priorities page (Page 4)
  if (userDecisions.topPriorities?.length > 0) completedFields++;
  decisionFields++;
  if (userDecisions.goDecision) completedFields++;
  decisionFields++;

  decisionCompleteness = completedFields / decisionFields;

  // Boost components based on relevant decisions
  // Max boost: +10% for complete decisions
  const maxBoost = 0.10;
  const actualBoost = maxBoost * decisionCompleteness;

  // Boost customer/stakeholder related components
  if (userDecisions.primaryCustomerSegment) {
    boostedConfidence.stakeholderMap = Math.min(1.0, boostedConfidence.stakeholderMap + actualBoost);
    boostedConfidence.benefitsRealization = Math.min(1.0, boostedConfidence.benefitsRealization + actualBoost * 0.5);
  }

  // Boost financial components
  if (userDecisions.revenueModel) {
    boostedConfidence.financialPlan = Math.min(1.0, boostedConfidence.financialPlan + actualBoost);
    boostedConfidence.benefitsRealization = Math.min(1.0, boostedConfidence.benefitsRealization + actualBoost * 0.5);
  }

  // Boost timeline based on timeline preference
  if (userDecisions.timelinePreference) {
    boostedConfidence.timeline = Math.min(1.0, boostedConfidence.timeline + actualBoost);
    boostedConfidence.stageGates = Math.min(1.0, boostedConfidence.stageGates + actualBoost * 0.7);
  }

  // Boost risk register based on risk tolerance
  if (userDecisions.riskTolerance) {
    boostedConfidence.riskRegister = Math.min(1.0, boostedConfidence.riskRegister + actualBoost);
    boostedConfidence.governance = Math.min(1.0, boostedConfidence.governance + actualBoost * 0.5);
  }

  // Boost resource/financial based on investment capacity
  if (userDecisions.investmentCapacityMin !== undefined || userDecisions.investmentCapacityMax !== undefined) {
    boostedConfidence.resourcePlan = Math.min(1.0, boostedConfidence.resourcePlan + actualBoost);
    boostedConfidence.financialPlan = Math.min(1.0, boostedConfidence.financialPlan + actualBoost * 0.7);
  }

  // Boost KPIs based on success metrics priority
  if (userDecisions.successMetricsPriority?.length > 0) {
    boostedConfidence.kpis = Math.min(1.0, boostedConfidence.kpis + actualBoost);
  }

  // Boost workstreams and priorities based on top priorities
  if (userDecisions.topPriorities?.length > 0) {
    boostedConfidence.workstreams = Math.min(1.0, boostedConfidence.workstreams + actualBoost);
    boostedConfidence.executiveSummary = Math.min(1.0, boostedConfidence.executiveSummary + actualBoost * 0.5);
  }

  // General boost to all components for decision completeness
  Object.keys(boostedConfidence).forEach(key => {
    boostedConfidence[key] = Math.min(1.0, boostedConfidence[key] + (actualBoost * 0.3));
  });

  return boostedConfidence;
}

// Helper: Calculate overall confidence from component scores
function calculateOverallConfidence(componentConfidence: Record<string, number>): number {
  const scores = Object.values(componentConfidence);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.round(average * 100) / 100;
}

// GET /api/strategy-workspace/epm/progress/:progressId
// SSE endpoint for real-time planning progress
router.get('/epm/progress/:progressId', (req: Request, res: Response) => {
  const { progressId } = req.params;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Store the connection
  progressStreams.set(progressId, {
    res,
    lastEventId: 0
  });

  // Send initial connection event
  sendSSEEvent(progressId, {
    type: 'connected',
    message: 'Planning progress stream connected'
  });

  // Clean up on client disconnect
  req.on('close', () => {
    progressStreams.delete(progressId);
  });
});

// POST /api/strategy-workspace/decisions
// Save user's strategic decisions
router.post('/decisions', async (req: Request, res: Response) => {
  try {
    const {
      strategyVersionId,
      primaryCustomerSegment,
      revenueModel,
      channelPriorities,
      partnershipStrategy,
      riskTolerance,
      investmentCapacityMin,
      investmentCapacityMax,
      timelinePreference,
      successMetricsPriority,
      validatedAssumptions,
      concerns,
      topPriorities,
      goDecision,
      decisionRationale,
    } = req.body;

    if (!strategyVersionId || !goDecision) {
      return res.status(400).json({ 
        error: 'strategyVersionId and goDecision are required' 
      });
    }

    const userId = (req.user as any)?.claims?.sub || null;

    const [decision] = await db.insert(strategyDecisions).values({
      strategyVersionId,
      userId,
      primaryCustomerSegment: primaryCustomerSegment || null,
      revenueModel: revenueModel || null,
      channelPriorities: channelPriorities || [],
      partnershipStrategy: partnershipStrategy || null,
      riskTolerance: riskTolerance || 'balanced',
      investmentCapacityMin: investmentCapacityMin || 0,
      investmentCapacityMax: investmentCapacityMax || 0,
      timelinePreference: timelinePreference || 'sustainable_pace',
      successMetricsPriority: successMetricsPriority || [],
      validatedAssumptions: validatedAssumptions || [],
      concerns: concerns || [],
      topPriorities: topPriorities || [],
      goDecision,
      decisionRationale: decisionRationale || null,
    }).returning();

    res.json({
      success: true,
      decisionId: decision.id,
      goDecision: decision.goDecision,
    });
  } catch (error: any) {
    console.error('Error in POST /decisions:', error);
    res.status(500).json({ error: error.message || 'Failed to save decisions' });
  }
});

// POST /api/strategy-workspace/epm/generate
// Generate EPM program from framework results + user decisions
router.post('/epm/generate', async (req: Request, res: Response) => {
  // Generate unique progress ID for this generation
  const progressId = `progress-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  try {
    // Proactively refresh token before long-running operation to prevent mid-operation auth failures
    const tokenValid = await refreshTokenProactively(req, 600); // Refresh if expiring within 10 minutes
    if (!tokenValid) {
      return res.status(401).json({ 
        error: 'Session expired', 
        message: 'Please log in again to continue' 
      });
    }
    
    const { strategyVersionId, decisionId, prioritizedOrder } = req.body;

    if (!strategyVersionId) {
      return res.status(400).json({ error: 'strategyVersionId is required' });
    }
    
    // Return progress ID immediately so client can connect to SSE
    res.json({
      success: true,
      progressId,
      message: 'EPM generation started. Connect to progress stream for updates.'
    });

    // Continue processing in background
    processEPMGeneration(strategyVersionId, decisionId, prioritizedOrder, progressId, req).catch(error => {
      console.error('Background EPM generation error:', error);
      sendSSEEvent(progressId, {
        type: 'error',
        message: error.message || 'EPM generation failed'
      });
      // Clean up stream
      const stream = progressStreams.get(progressId);
      if (stream) {
        stream.res.end();
        progressStreams.delete(progressId);
      }
    });
  } catch (error: any) {
    console.error('Error in POST /epm/generate:', error);
    sendSSEEvent(progressId, {
      type: 'error',
      message: error.message || 'EPM generation failed'
    });
  }
});

// Background processing function for EPM generation
async function processEPMGeneration(
  strategyVersionId: string,
  decisionId: string | undefined,
  prioritizedOrder: any,
  progressId: string,
  req: Request
) {
  const startTime = Date.now(); // Track elapsed time
  const userId = (req.user as any)?.claims?.sub || null;
  let jobId: string | null = null; // Declare outside try for catch block access
  
  try {
    // Send initial progress event
    sendSSEEvent(progressId, {
      type: 'step-start',
      step: 'initialization',
      progress: 5,
      description: 'Preparing strategic analysis...'
    });

    // Fetch strategy version (decrypted) from storage layer
    const version = await storage.getStrategyVersionById(strategyVersionId);

    if (!version) {
      throw new Error('Strategy version not found');
    }

    // Fetch initiative type and journey title from strategic_understanding table
    // This is the SINGLE SOURCE OF TRUTH - fetched once and passed explicitly
    // NOTE: version.sessionId is the session string (e.g., "session-1769898649296-uocxqo")
    // which matches strategic_understanding.sessionId (not id)
    let initiativeType: string | undefined = undefined;
    let journeyTitle: string | undefined = undefined;
    let clarificationConflicts: string[] = [];
    if (version.sessionId) {
      try {
        const understanding = await getStrategicUnderstandingBySession(version.sessionId);
        
        if (understanding?.initiativeType) {
          initiativeType = understanding.initiativeType;
          console.log(`[EPM Generation] ✅ Initiative type fetched: "${initiativeType}"`);
        }
        if (understanding?.title) {
          journeyTitle = understanding.title;
          console.log(`[EPM Generation] ✅ Journey title fetched: "${journeyTitle}"`);
        }
        if (understanding?.userInput) {
          const userConstraints = extractUserConstraintsFromText(understanding.userInput);
          if (userConstraints.budget || userConstraints.timeline) {
            const updates: any = {};
            if (userConstraints.budget) {
              if (version.costMin == null) updates.costMin = userConstraints.budget.min;
              if (version.costMax == null) updates.costMax = userConstraints.budget.max;
              if (version.teamSizeMin == null || version.teamSizeMax == null) {
                const teamSize = deriveTeamSizeFromBudget(userConstraints.budget);
                if (version.teamSizeMin == null) updates.teamSizeMin = teamSize.min;
                if (version.teamSizeMax == null) updates.teamSizeMax = teamSize.max;
              }
            }
            if (userConstraints.timeline) {
              if (version.timelineMonths == null) {
                updates.timelineMonths = userConstraints.timeline.max || userConstraints.timeline.min;
              }
            }
            if (Object.keys(updates).length > 0) {
              await db.update(strategyVersions)
                .set({ ...updates, updatedAt: new Date() })
                .where(eq(strategyVersions.id, strategyVersionId));
              console.log('[EPM Generation] ✅ Persisted user constraints to strategy_version:', updates);
            }
          }

          // Detect clarification conflicts in existing input and store in metadata
          const clarifiedInput = ambiguityDetector.buildClarifiedInput(understanding.userInput, {});
          clarificationConflicts = extractConflictLines(clarifiedInput);
          if (clarificationConflicts.length > 0) {
            const currentMeta = typeof (understanding as any).strategyMetadata === 'string'
              ? JSON.parse((understanding as any).strategyMetadata)
              : (understanding as any).strategyMetadata || {};
            const nextMeta = {
              ...currentMeta,
              clarificationConflicts,
              clarificationConflictsDetectedAt: new Date().toISOString(),
            };
            await db.update(strategicUnderstanding)
              .set({ strategyMetadata: nextMeta, updatedAt: new Date() })
              .where(eq(strategicUnderstanding.id, understanding.id));
            console.warn('[EPM Generation] ⚠️ Clarification conflicts detected:', clarificationConflicts);
          }
        }
        if (!understanding) {
          console.warn(`[EPM Generation] ⚠️ No strategic understanding found for id: ${version.sessionId}`);
        }
      } catch (error) {
        console.error('[EPM Generation] ❌ Error fetching strategic understanding:', error);
        // Continue without initiative type - will use fallback
      }
    } else {
      console.warn('[EPM Generation] ⚠️ No sessionId available - cannot fetch strategic context');
    }

    // Create background job record for tracking (after we have sessionId)
    try {
      jobId = await backgroundJobService.createJob({
        userId,
        jobType: 'epm_generation',
        inputData: { 
          strategyVersionId, 
          decisionId, 
          prioritizedOrder,
          progressId, // Store progressId for SSE reconnection
          // Store strategy context for meaningful job titles
          strategyName: version.inputSummary || version.strategicApproach || version.marketContext || `Strategy v${version.versionNumber}`,
          sessionId: version.sessionId,
          versionNumber: version.versionNumber,
        },
        sessionId: version.sessionId ?? undefined, // Store sessionId for session-based lookups
        relatedEntityId: strategyVersionId,
        relatedEntityType: 'strategy_version',
      });
      console.log('[EPM Generation] Background job created:', jobId, 'for session:', version.sessionId);
      
      // Update job to running status
      if (jobId) {
        await backgroundJobService.updateJob(jobId, {
          status: 'running',
          progress: 5,
          progressMessage: 'Preparing strategic analysis...'
        }).catch(err => console.error('[EPM Generation] Job update failed:', err));
      }
    } catch (jobError) {
      console.error('[EPM Generation] Failed to create background job:', jobError);
      // Continue without job tracking if it fails
    }

    // Use aggregator to get normalized insights from ANY framework (SWOT, BMC, Porters, PESTLE)
    const { insights: aggregatedInsights, availableFrameworks, primaryFramework } = 
      version.sessionId 
        ? await getAggregatedAnalysis(version.sessionId)
        : { insights: null, availableFrameworks: [], primaryFramework: null };

    // Fallback: Check for analysis data from multiple sources
    const analysisData = version.analysisData as any;
    const bmcAnalysis = analysisData?.bmc_research;
    
    // Journey-based analysis is stored directly in analysisData (swot, pestle, porters)
    // Check for journey framework analysis if aggregator returns nothing
    const journeySwotData = analysisData?.swot?.data?.output || analysisData?.swot?.output || analysisData?.swot;
    const journeyPestleData = analysisData?.pestle?.data?.pestleResults || analysisData?.pestle?.pestleResults;
    const journeyPortersData = analysisData?.porters?.data?.portersResults || analysisData?.porters?.portersResults;
    const hasJourneyAnalysis = !!(journeySwotData?.strengths || journeyPestleData || journeyPortersData);

    if (!aggregatedInsights && !bmcAnalysis && !hasJourneyAnalysis) {
      throw new Error('No strategic analysis available. Run at least one framework (SWOT, BMC, Porters, or PESTLE) before generating EPM.');
    }

    // Determine the actual primary framework being used
    let effectivePrimaryFramework = primaryFramework;
    if (!aggregatedInsights && hasJourneyAnalysis) {
      if (journeySwotData?.strengths) effectivePrimaryFramework = 'swot';
      else if (journeyPortersData) effectivePrimaryFramework = 'porters';
      else if (journeyPestleData) effectivePrimaryFramework = 'pestle';
    }

    console.log(`[EPM Generation] Using ${effectivePrimaryFramework || 'bmc'} as primary framework, ${availableFrameworks.length} aggregated + journey analysis available: ${hasJourneyAnalysis}`);

    // DUAL-PATH DECISION FETCHING:
    // 1. Legacy path: version.decisionsData / version.selectedDecisions
    // 2. Journey Builder path: frameworkInsights with frameworkName = 'strategic_decisions'
    let decisionsData = version.decisionsData;
    let selectedDecisions = version.selectedDecisions;
    let journeyBuilderSwot: any = null;

    // Check if legacy path has decisions
    const hasLegacyDecisions = decisionsData &&
      (decisionsData as any)?.decisions?.length > 0;

    if (!hasLegacyDecisions && version.sessionId) {
      console.log('[EPM Generation] Legacy decisionsData empty, checking Journey Builder path (frameworkInsights)...');

      try {
        // Look up the journey session to get the sessionId for frameworkInsights
        const [understanding] = await db
          .select()
          .from(strategicUnderstanding)
          .where(eq(strategicUnderstanding.sessionId, version.sessionId))
          .limit(1);

        if (understanding) {
          // Find the journey session
          const [journeySession] = await db
            .select()
            .from(journeySessions)
            .where(
              and(
                eq(journeySessions.understandingId, understanding.id),
                eq(journeySessions.versionNumber, version.versionNumber)
              )
            )
            .limit(1);

          if (journeySession) {
            // Fetch strategic_decisions from frameworkInsights
            const [decisionInsight] = await db
              .select()
              .from(frameworkInsights)
              .where(
                and(
                  eq(frameworkInsights.sessionId, journeySession.id),
                  eq(frameworkInsights.frameworkName, 'strategic_decisions')
                )
              )
              .orderBy(desc(frameworkInsights.createdAt))
              .limit(1);

            if (decisionInsight?.insights) {
              console.log('[EPM Generation] ✓ Found decisions in frameworkInsights (Journey Builder path)');
              decisionsData = decisionInsight.insights as any;
            }

            // Also fetch SWOT from frameworkInsights for better benefit generation
            const [swotInsight] = await db
              .select()
              .from(frameworkInsights)
              .where(
                and(
                  eq(frameworkInsights.sessionId, journeySession.id),
                  eq(frameworkInsights.frameworkName, 'swot')
                )
              )
              .orderBy(desc(frameworkInsights.createdAt))
              .limit(1);

            if (swotInsight?.insights) {
              console.log('[EPM Generation] ✓ Found SWOT in frameworkInsights (Journey Builder path)');
              journeyBuilderSwot = swotInsight.insights;
            }
          }
        }
      } catch (fbError) {
        console.warn('[EPM Generation] Failed to fetch from frameworkInsights:', fbError);
      }
    }

    // Prepare context for intelligent program naming
    // journeyTitle takes priority - use it directly instead of AI generation
    const namingContext = {
      journeyTitle: journeyTitle, // From strategic_understanding.title - USE THIS!
      bmcKeyInsights: bmcAnalysis?.keyInsights || [],
      bmcRecommendations: bmcAnalysis?.recommendations || [],
      selectedDecisions: selectedDecisions || null,
      decisionsData: decisionsData || null,
      framework: effectivePrimaryFramework || 'bmc',
      // Pass Journey Builder SWOT for benefit generation
      journeyBuilderSwot: journeyBuilderSwot,
    };

    // Fetch user decisions if provided
    let userDecisions: any = null;
    if (decisionId) {
      const [decision] = await db
        .select()
        .from(strategyDecisions)
        .where(eq(strategyDecisions.id, decisionId))
        .limit(1);
      
      if (decision) {
        // Validate decision completeness
        const missingFields: string[] = [];
        
        // Page 1: Strategic Choices (at least 2/4 required)
        let page1Fields = 0;
        if (decision.primaryCustomerSegment) page1Fields++;
        if (decision.revenueModel) page1Fields++;
        if (Array.isArray(decision.channelPriorities) && decision.channelPriorities.length > 0) page1Fields++;
        if (decision.partnershipStrategy) page1Fields++;
        if (page1Fields < 2) {
          missingFields.push('Strategic Choices (need at least 2 decisions)');
        }
        
        // Page 2: Risk & Investment (required)
        if (!decision.riskTolerance) missingFields.push('Risk Tolerance');
        if (!decision.timelinePreference) missingFields.push('Timeline Preference');
        
        // Page 3: Assumptions (at least 1 required)
        if ((!Array.isArray(decision.validatedAssumptions) || decision.validatedAssumptions.length === 0) && 
            (!Array.isArray(decision.concerns) || decision.concerns.length === 0)) {
          missingFields.push('Validated Assumptions or Concerns');
        }
        
        // Page 4: Priorities & Go Decision (required)
        if (!decision.topPriorities?.length) {
          missingFields.push('Top Priorities');
        }
        if (!decision.goDecision) {
          missingFields.push('Go/No-Go Decision');
        }
        
        if (missingFields.length > 0) {
          throw new Error(`Incomplete strategic decisions: ${missingFields.join(', ')}`);
        }
        
        userDecisions = decision;
      }
    }

    // Run through framework analyzer - use aggregated insights if available
    sendSSEEvent(progressId, {
      type: 'step-start',
      step: 'analyze',
      progress: 10,
      description: `Analyzing ${primaryFramework || 'strategic'} framework...`
    });
    
    // Use aggregated insights if available, otherwise fall back to BMC analyzer
    let insights;
    if (aggregatedInsights) {
      insights = aggregatedInsights;
      console.log(`[EPM Generation] Using aggregated insights from ${availableFrameworks.join(', ')}`);
    } else if (bmcAnalysis) {
      // Fallback: Convert BMC blocks to BMCResults format
      const blocks = bmcAnalysis.blocks || [];
      const findBlock = (name: string) => blocks.find((b: any) => b.blockName === name)?.description || '';
      
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
        contradictions: [],
        recommendations: bmcAnalysis.recommendations || [],
        executiveSummary: (bmcAnalysis.keyInsights || []).join('. '),
      };
      insights = await bmcAnalyzer.analyze(bmcResults);
      console.log('[EPM Generation] Using BMC analyzer fallback');
    } else if (journeySwotData?.strengths) {
      // Fallback: Use journey SWOT analysis
      console.log('[EPM Generation] Using journey SWOT analysis fallback');
      insights = await normalizeSWOT(journeySwotData);
    } else if (journeyPortersData) {
      // Fallback: Use journey Porter's analysis
      console.log('[EPM Generation] Using journey Porter\'s analysis fallback');
      const portersAnalyzer = new PortersAnalyzer();
      insights = await portersAnalyzer.analyze(journeyPortersData);
    } else if (journeyPestleData) {
      // Fallback: Use journey PESTLE analysis
      console.log('[EPM Generation] Using journey PESTLE analysis fallback');
      const pestleAnalyzer = new PESTLEAnalyzer();
      insights = await pestleAnalyzer.analyze(journeyPestleData);
    } else {
      throw new Error('No strategic analysis available');
    }
    
    // Include prioritized order and sessionId in user decisions context
    // Sprint 6.1: Inject constraints from strategyVersion so generators respect budget/timeline
    const versionBudgetRange = version.costMax ? { min: version.costMin || version.costMax, max: version.costMax } : undefined;
    const versionTimelineRange = version.timelineMonths ? { min: version.timelineMonths, max: version.timelineMonths } : undefined;
    const decisionsWithPriority = userDecisions ? {
      ...userDecisions,
      prioritizedOrder: prioritizedOrder || [],
      sessionId: version.sessionId,  // Pass sessionId for initiative type lookup
      clarificationConflicts,
      budgetRange: versionBudgetRange,
      timelineRange: versionTimelineRange,
    } : {
      prioritizedOrder: prioritizedOrder || [],
      sessionId: version.sessionId,  // Pass sessionId for initiative type lookup
      clarificationConflicts,
      budgetRange: versionBudgetRange,
      timelineRange: versionTimelineRange,
    };
    
    // Run through EPM synthesizer with naming context and real-time progress
    const epmProgram = await epmSynthesizer.synthesize(
      insights,
      decisionsWithPriority,
      namingContext,
      {
        onProgress: (event) => {
          // Forward intelligent planning events to SSE stream
          sendSSEEvent(progressId, event);
          
          // Update background job progress (alongside SSE)
          if (jobId && event.progress !== undefined) {
            backgroundJobService.updateJob(jobId, {
              progress: event.progress,
              progressMessage: event.description || event.message
            }).catch(err => console.error('[EPM Generation] Job progress update failed:', err));
          }
        },
        initiativeType: initiativeType  // EXPLICIT: Pass initiative type from database
      }
    );

    // VALIDATION GATE: Validate EPM output before saving
    console.log('[EPM Generation] 🔍 Running quality validation...');
    try {
      const { EPMPackageValidator } = await import('../../scripts/validate-export-package');
      const validator = new EPMPackageValidator();

      // Create a temporary package for validation
      const tempPackage = {
        workstreams: epmProgram.workstreams,
        timeline: epmProgram.timeline,
        resources: epmProgram.resourcePlan,
        stageGates: epmProgram.stageGates,
        metadata: {
          sessionId: version.sessionId,
          generatedAt: new Date().toISOString(),
          domain: namingContext?.businessSector || 'general',
          businessType: namingContext?.businessName || 'unknown',
        }
      };

      // Write temp file for validation
      const tempPath = `/tmp/epm-validation-${Date.now()}.json`;
      const fs = await import('fs');
      fs.writeFileSync(tempPath, JSON.stringify(tempPackage, null, 2));

      // Run validation
      const validationResult = validator.validate(tempPath);

      // Clean up temp file
      fs.unlinkSync(tempPath);

      // Log validation result — NEVER block generation, only warn
      // The export gate (acceptance-gates.ts) is the enforcement point, not here
      if (!validationResult.isValid) {
        console.warn('[EPM Generation] ⚠️  VALIDATION WARNINGS (non-blocking):');
        validationResult.errors.forEach(e => console.warn(`  - ${e}`));

        // Send validation info via SSE for visibility, but do NOT block
        sendSSEEvent(progressId, {
          type: 'validation_warning',
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          score: validationResult.score,
          message: `Quality validation flagged ${validationResult.errors.length} issues (score: ${validationResult.score}/100). Proceeding — export gate will enforce.`
        });
      }

      // Log warnings if any
      if (validationResult.warnings.length > 0) {
        console.warn('[EPM Generation] ⚠️  Validation warnings:');
        validationResult.warnings.forEach(w => console.warn(`  - ${w}`));
      }

      console.log(`[EPM Generation] ✅ Generation continuing (validation score: ${validationResult.score}/100)`);

    } catch (validationError: any) {
      // Validation process errors should never block generation
      console.error('[EPM Generation] ⚠️  Validation process error (continuing):', validationError.message);
    }

    // Extract component-level confidence scores
    const componentConfidence = extractComponentConfidence(epmProgram);
    const finalConfidence = boostConfidenceWithDecisions(componentConfidence, userDecisions);
    const overallConfidence = calculateOverallConfidence(finalConfidence);

    // Save EPM program to database using repository
    const epmRepo = getService<EPMRepository>(ServiceKeys.EPM_REPOSITORY);
    const savedProgram = await epmRepo.create({
      strategyVersionId,
      strategyDecisionId: decisionId || null,
      userId,
      frameworkType: effectivePrimaryFramework || 'bmc',
      executiveSummary: epmProgram.executiveSummary,
      workstreams: epmProgram.workstreams,
      timeline: epmProgram.timeline,
      resourcePlan: epmProgram.resourcePlan,
      financialPlan: epmProgram.financialPlan,
      benefitsRealization: epmProgram.benefitsRealization,
      riskRegister: epmProgram.riskRegister,
      stageGates: epmProgram.stageGates,
      kpis: epmProgram.kpis,
      stakeholderMap: epmProgram.stakeholderMap,
      governance: epmProgram.governance,
      qaPlan: epmProgram.qaPlan,
      procurement: epmProgram.procurement,
      exitStrategy: epmProgram.exitStrategy,
      componentConfidence: finalConfidence,
      overallConfidence: overallConfidence.toString(),
      editTracking: {},
      status: 'draft',
    });

    // Verify program was saved and ID exists
    if (!savedProgram || !savedProgram.id) {
      console.error('[EPM Generation] ❌ Program save failed - no ID returned:', savedProgram);
      throw new Error('Failed to save EPM program - no ID returned from database');
    }

    const programId = savedProgram.id;
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`[EPM Generation] ✅ Program saved with ID: ${programId}`);
    console.log(`[EPM Generation] Total elapsed time: ${elapsedSeconds}s`);
    
    // Generate and save task assignments
    try {
      console.log(`[EPM Generation] 📋 Generating task assignments...`);
      const assignments = await epmSynthesizer.generateAssignments(epmProgram, programId);
      
      if (assignments && assignments.length > 0) {
        // Bulk insert assignments into database using repository
        await epmRepo.createTaskAssignments(assignments);
        console.log(`[EPM Generation] ✅ Saved ${assignments.length} task assignments`);
      } else {
        console.log(`[EPM Generation] ℹ️  No assignments generated (program may lack resources or tasks)`);
      }
    } catch (assignmentError: any) {
      // Don't fail the entire EPM generation if assignments fail
      console.error(`[EPM Generation] ⚠️  Assignment generation failed (non-critical):`, assignmentError);
    }
    
    console.log(`[EPM Generation] Sending completion event with programId: ${programId}`);

    // Send completion event with program ID and elapsed time
    sendSSEEvent(progressId, {
      type: 'complete',
      progress: 100,
      epmProgramId: programId,
      overallConfidence: overallConfidence,
      componentsGenerated: 14,
      elapsedSeconds: elapsedSeconds,
      message: 'EPM program generation complete!'
    });
    
    // Mark background job as completed
    if (jobId) {
      await backgroundJobService.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        resultData: {
          programId,
          overallConfidence,
          elapsedSeconds
        }
      }).catch(err => console.error('[EPM Generation] Job completion update failed:', err));
    }
    
    // 🔥 JOURNEY REGISTRY V2 COMPLETION HOOK
    // Save journey summary if this EPM was generated from a BMI journey
    if (isJourneyRegistryV2Enabled() && version.sessionId) {
      try {
        // Look up journey session via understanding
        // version.sessionId -> strategicUnderstanding.sessionId -> journeySessions.understandingId
        const [understanding] = await db
          .select()
          .from(strategicUnderstanding)
          .where(eq(strategicUnderstanding.sessionId, version.sessionId))
          .limit(1);

        if (understanding) {
          const [journeySession] = await db
            .select()
            .from(journeySessions)
            .where(
              and(
                eq(journeySessions.understandingId, understanding.id),
                eq(journeySessions.versionNumber, version.versionNumber)
              )
            )
            .limit(1);

          if (journeySession && journeySession.journeyType === 'business_model_innovation') {
            console.log(`[EPM Completion Hook] Found BMI journey session ${journeySession.id}, saving summary...`);
            
            // Build strategic context from available data
            const context: StrategicContext = {
              understandingId: journeySession.understandingId!,
              sessionId: version.sessionId,
              userInput: version.inputSummary || version.marketContext || '',
              journeyType: journeySession.journeyType as JourneyType,
              currentFrameworkIndex: 2, // Completed Five Whys and BMC
              completedFrameworks: ['five_whys', 'bmc'],
              status: 'completed',
              insights: {
                rootCauses: [],
                bmcBlocks: bmcAnalysis || {},
                strategicImplications: [],
                businessModelGaps: [],
              },
              createdAt: new Date(journeySession.createdAt || new Date()),
              updatedAt: new Date(),
            };

            // Extract root causes from Five Whys if available
            const fiveWhysData = (analysisData as any)?.five_whys;
            if (fiveWhysData?.rootCauses) {
              context.insights.rootCauses = fiveWhysData.rootCauses;
            }

            // Get journey definition to find summary builder
            const journeyDef = journeyRegistry.getJourney('business_model_innovation');
            if (journeyDef?.summaryBuilder) {
              // Build and save summary
              const summary = journeySummaryService.buildSummary(
                journeyDef.summaryBuilder,
                context,
                {
                  versionNumber: journeySession.versionNumber || 1,
                  completedAt: new Date().toISOString(),
                }
              );

              await journeySummaryService.saveSummary(journeySession.id, summary);
              
              // Mark journey session as completed so it can be found by getLatestSummary
              await db
                .update(journeySessions)
                .set({ 
                  status: 'completed' as any,
                  completedAt: new Date()
                })
                .where(eq(journeySessions.id, journeySession.id));
              
              console.log(`[EPM Completion Hook] ✓ Journey summary saved and session marked as completed for version ${journeySession.versionNumber}`);
              
              // 🔥 GOLDEN RECORDS AUTO-CAPTURE HOOK
              // Trigger auto-capture for BMI journeys completing through the legacy flow
              const autoCaptureEnabled = process.env.AUTO_CAPTURE_GOLDEN === 'true';
              if (autoCaptureEnabled) {
                console.log(`[EPM Completion Hook] 🔄 Triggering golden records auto-capture for BMI journey ${journeySession.id}`);
                
                // Import and call the auto-capture function (async, non-blocking)
                setImmediate(async () => {
                  try {
                    const {
                      fetchJourneySessionData,
                      sanitizeGoldenRecordData,
                      saveGoldenRecordToFile,
                    } = await import('../utils/golden-records-service');
                    
                    const { screenshotCaptureService } = await import('../services/screenshot-capture-service');
                    
                    // Fetch journey data
                    const rawData = await fetchJourneySessionData(journeySession.id);
                    
                    if (!rawData) {
                      console.error('[EPM Completion Hook] Failed to fetch journey session data for auto-capture');
                      return;
                    }

                    // Sanitize data
                    let sanitizedData = await sanitizeGoldenRecordData(rawData);

                    // Determine next version
                    const existingRecords = await db
                      .select()
                      .from(goldenRecords)
                      .where(eq(goldenRecords.journeyType, 'business_model_innovation' as any))
                      .orderBy(desc(goldenRecords.version));

                    const maxVersion = existingRecords.length > 0 ? existingRecords[0].version : 0;
                    const nextVersion = maxVersion + 1;

                    // Update sanitized data with the correct golden record version
                    sanitizedData.versionNumber = nextVersion;

                    // Capture screenshots (AFTER determining version, without admin cookie)
                    try {
                      const stepsWithScreenshots = await screenshotCaptureService.captureStepScreenshots({
                        journeyType: 'business_model_innovation',
                        versionNumber: nextVersion,
                        steps: sanitizedData.steps,
                        adminSessionCookie: undefined,
                      });
                      
                      sanitizedData.steps = stepsWithScreenshots;
                      const screenshotCount = stepsWithScreenshots.filter((s: any) => s.screenshot).length;
                      console.log(`[EPM Completion Hook] ✓ Captured ${screenshotCount} screenshots for version ${nextVersion}`);
                    } catch (screenshotError) {
                      console.warn('[EPM Completion Hook] Screenshot capture failed (non-critical):', screenshotError);
                      // Continue without screenshots
                    }

                    // Save to file system
                    const filePath = await saveGoldenRecordToFile(sanitizedData);
                    
                    // Save to database
                    await db.insert(goldenRecords).values({
                      journeyType: 'business_model_innovation',
                      version: nextVersion,
                      filePath,
                      capturedAt: new Date(),
                      capturedBy: 'system',
                      status: 'captured',
                      metadata: {
                        autoCapture: true,
                        source: 'epm_completion_hook',
                        sessionId: journeySession.id,
                        versionNumber: journeySession.versionNumber,
                      },
                    });
                    
                    console.log(`[EPM Completion Hook] ✅ Auto-captured golden record v${nextVersion} for BMI journey`);
                  } catch (captureError) {
                    console.error('[EPM Completion Hook] Golden records auto-capture failed (non-critical):', captureError);
                  }
                });
              } else {
                console.log('[EPM Completion Hook] Golden records auto-capture disabled (AUTO_CAPTURE_GOLDEN=false)');
              }
            }
          } else if (journeySession) {
            console.log(`[EPM Completion Hook] Journey type is ${journeySession.journeyType}, not BMI - skipping summary`);
          } else {
            console.log(`[EPM Completion Hook] No journey session found for understanding ${understanding.id} v${version.versionNumber}`);
          }
        } else {
          console.log(`[EPM Completion Hook] No understanding found for sessionId ${version.sessionId}`);
        }
      } catch (summaryError: any) {
        // Don't fail EPM generation if summary saving fails
        console.error('[EPM Completion Hook] Failed to save journey summary (non-critical):', summaryError);
      }
    }
    
    // Close SSE stream
    const stream = progressStreams.get(progressId);
    if (stream) {
      stream.res.end();
      progressStreams.delete(progressId);
    }
  } catch (error: any) {
    console.error('Error in processEPMGeneration:', error);
    
    // Mark background job as failed
    if (jobId) {
      await backgroundJobService.failJob(jobId, error).catch(err => 
        console.error('[EPM Generation] Job failure update failed:', err)
      );
    }
    
    throw error; // Re-throw to be caught by outer catch in POST /epm/generate
  }
}

// GET /api/strategy-workspace/epm
// List all EPM programs for current user (framework-agnostic)
router.get('/epm', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const programs = await db
      .select({
        id: epmPrograms.id,
        frameworkType: epmPrograms.frameworkType,
        status: epmPrograms.status,
        overallConfidence: epmPrograms.overallConfidence,
        createdAt: epmPrograms.createdAt,
        updatedAt: epmPrograms.updatedAt,
        finalizedAt: epmPrograms.finalizedAt,
        executiveSummary: epmPrograms.executiveSummary,
        strategyVersionId: epmPrograms.strategyVersionId,
      })
      .from(epmPrograms)
      .where(eq(epmPrograms.userId, userId))
      .orderBy(desc(epmPrograms.createdAt));

    // Extract titles from executive summaries for list display
    const programsWithTitles = programs.map(prog => ({
      id: prog.id,
      title: (prog.executiveSummary as any)?.title || 'Untitled Program',
      frameworkType: prog.frameworkType,
      status: prog.status,
      overallConfidence: parseFloat(prog.overallConfidence || '0'),
      createdAt: prog.createdAt,
      updatedAt: prog.updatedAt,
      finalizedAt: prog.finalizedAt,
      strategyVersionId: prog.strategyVersionId,
    }));

    res.json({ programs: programsWithTitles });
  } catch (error: any) {
    console.error('Error in GET /epm:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch EPM programs' });
  }
});

// GET /api/strategy-workspace/epm/:id
// Fetch EPM program by ID
router.get('/epm/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [program] = await db
      .select()
      .from(epmPrograms)
      .where(eq(epmPrograms.id, id))
      .limit(1);

    if (!program) {
      return res.status(404).json({ error: 'EPM program not found' });
    }

    res.json({ program });
  } catch (error: any) {
    console.error('Error in GET /epm/:id:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch EPM program' });
  }
});

// GET /api/strategy-workspace/epm/:id/session
// Get understanding ID for an EPM program (for Knowledge Graph insights)
router.get('/epm/:id/session', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get the program
    const [program] = await db
      .select({
        strategyVersionId: epmPrograms.strategyVersionId,
      })
      .from(epmPrograms)
      .where(eq(epmPrograms.id, id))
      .limit(1);

    if (!program || !program.strategyVersionId) {
      return res.status(404).json({ error: 'EPM program not found or has no linked strategy version' });
    }

    // Get the session ID from the strategy version
    const [version] = await db
      .select({
        sessionId: strategyVersions.sessionId,
      })
      .from(strategyVersions)
      .where(eq(strategyVersions.id, program.strategyVersionId))
      .limit(1);

    if (!version || !version.sessionId) {
      return res.status(404).json({ error: 'Strategy version not found or has no session' });
    }

    // Look up the journey session to get the understanding ID
    // This works for both first-run and follow-on journeys
    const [journeySession] = await db
      .select({
        understandingId: journeySessions.understandingId,
      })
      .from(journeySessions)
      .where(eq(journeySessions.id, version.sessionId))
      .limit(1);

    if (!journeySession || !journeySession.understandingId) {
      return res.status(404).json({ error: 'Journey session not found or has no understanding' });
    }

    // Return the understanding ID (this is what the knowledge insights service expects)
    res.json({ sessionId: journeySession.understandingId });
  } catch (error: any) {
    console.error('Error in GET /epm/:id/session:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch session ID' });
  }
});

// PATCH /api/strategy-workspace/epm/:id
// Update EPM program components (for editing)
router.patch('/epm/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { component, value } = req.body;

    if (!component || !value) {
      return res.status(400).json({ error: 'component and value are required' });
    }

    // Validate component name
    const validComponents = [
      'executiveSummary', 'workstreams', 'timeline', 'resourcePlan',
      'financialPlan', 'benefitsRealization', 'riskRegister', 'stageGates',
      'kpis', 'stakeholderMap', 'governance', 'qaPlan', 'procurement', 'exitStrategy'
    ];

    if (!validComponents.includes(component)) {
      return res.status(400).json({ error: 'Invalid component name' });
    }

    // Fetch current program
    const [currentProgram] = await db
      .select()
      .from(epmPrograms)
      .where(eq(epmPrograms.id, id))
      .limit(1);

    if (!currentProgram) {
      return res.status(404).json({ error: 'EPM program not found' });
    }

    // Update edit tracking
    const editTracking = (currentProgram.editTracking as any) || {};
    editTracking[component] = {
      modified: true,
      modifiedAt: new Date().toISOString(),
      source: 'user',
    };

    // Update program
    const updateData: any = {
      [component]: value,
      editTracking,
      updatedAt: new Date(),
    };

    await db
      .update(epmPrograms)
      .set(updateData)
      .where(eq(epmPrograms.id, id));

    res.json({ success: true, component, updated: true });
  } catch (error: any) {
    console.error('Error in PATCH /epm/:id:', error);
    res.status(500).json({ error: error.message || 'Failed to update EPM program' });
  }
});

// POST /api/strategy-workspace/epm/:id/finalize
// Finalize EPM program (change status from draft to finalized)
router.post('/epm/:id/finalize', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [program] = await db
      .select()
      .from(epmPrograms)
      .where(eq(epmPrograms.id, id))
      .limit(1);

    if (!program) {
      return res.status(404).json({ error: 'EPM program not found' });
    }

    if (program.status === 'finalized') {
      return res.status(400).json({ error: 'Program already finalized' });
    }

    // Check confidence threshold
    const overallConfidence = parseFloat(program.overallConfidence);
    if (overallConfidence < 0.6) {
      return res.status(400).json({ 
        error: 'Confidence too low to finalize',
        overallConfidence,
        message: 'Please review and edit low-confidence components before finalizing'
      });
    }

    await db
      .update(epmPrograms)
      .set({
        status: 'finalized',
        finalizedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(epmPrograms.id, id));

    res.json({ 
      success: true, 
      status: 'finalized',
      finalizedAt: new Date(),
    });
  } catch (error: any) {
    console.error('Error in POST /epm/:id/finalize:', error);
    res.status(500).json({ error: error.message || 'Failed to finalize EPM program' });
  }
});

// Batch operations for EPM programs
router.post('/epm/batch-delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid request: ids array is required' });
    }

    // Clear foreign key references in strategy_versions before deleting
    await db
      .update(strategyVersions)
      .set({ convertedProgramId: null })
      .where(inArray(strategyVersions.convertedProgramId, ids));

    // Now delete the EPM programs
    await db.delete(epmPrograms).where(inArray(epmPrograms.id, ids));

    res.json({ success: true, count: ids.length });
  } catch (error: any) {
    console.error('Error batch deleting EPM programs:', error);
    res.status(500).json({ error: error.message || 'Failed to delete EPM programs' });
  }
});

router.post('/epm/batch-archive', async (req: Request, res: Response) => {
  try {
    const { ids, archive = true } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid request: ids array is required' });
    }

    await db
      .update(epmPrograms)
      .set({ archived: archive, updatedAt: new Date() })
      .where(inArray(epmPrograms.id, ids));

    res.json({ success: true, count: ids.length, archived: archive });
  } catch (error: any) {
    console.error('Error batch archiving EPM programs:', error);
    res.status(500).json({ error: error.message || 'Failed to archive EPM programs' });
  }
});

router.post('/epm/batch-export', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid request: ids array is required' });
    }

    const programs = await db
      .select()
      .from(epmPrograms)
      .where(inArray(epmPrograms.id, ids));

    const enriched = await Promise.all(programs.map(async (program) => {
      const decrypted = await getEPMProgram(program.id);
      const version = await storage.getStrategyVersionById(program.strategyVersionId);
      const understanding = version?.sessionId
        ? await getStrategicUnderstandingBySession(version.sessionId)
        : null;

      let frameworkRows: any[] = [];
      if (understanding?.id) {
        const [journeySession] = await db
          .select()
          .from(journeySessions)
          .where(eq(journeySessions.understandingId, understanding.id))
          .orderBy(desc(journeySessions.createdAt))
          .limit(1);

        if (journeySession?.id) {
          const bySession = await db
            .select()
            .from(frameworkInsights)
            .where(eq(frameworkInsights.sessionId, journeySession.id));
          frameworkRows = frameworkRows.concat(bySession);
        }

        const byUnderstanding = await db
          .select()
          .from(frameworkInsights)
          .where(eq(frameworkInsights.understandingId, understanding.id));
        if (byUnderstanding.length > 0) {
          const seen = new Set(frameworkRows.map((row) => row.id));
          byUnderstanding.forEach((row) => {
            if (!seen.has(row.id)) frameworkRows.push(row);
          });
        }
      }

      return {
        ...(decrypted || program),
        analysis: {
          strategyVersion: version || null,
          understanding: understanding || null,
          frameworkInsights: frameworkRows,
        },
      };
    }));

    res.json({ success: true, data: enriched });
  } catch (error: any) {
    console.error('Error batch exporting EPM programs:', error);
    res.status(500).json({ error: error.message || 'Failed to export EPM programs' });
  }
});

export default router;
