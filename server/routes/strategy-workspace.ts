import { Router, Request, Response } from 'express';
import { db } from '../db';
import { strategyDecisions, epmPrograms, journeySessions, strategyVersions, strategicUnderstanding } from '@shared/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { BMCAnalyzer, PortersAnalyzer, PESTLEAnalyzer, EPMSynthesizer } from '../intelligence';
import type { BMCResults, PortersResults, PESTLEResults } from '../intelligence/types';
import { storage } from '../storage';
import { createOpenAIProvider } from '../../src/lib/intelligent-planning/llm-provider';

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

// Create LLM provider for intelligent planning
const llm = createOpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY || '',
  model: 'gpt-5'
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
  
  try {
    // Send initial progress event
    sendSSEEvent(progressId, {
      type: 'step-start',
      step: 'initialization',
      progress: 5,
      description: 'Preparing strategic analysis...'
    });

    // Fetch strategy version to get BMC analysis
    const [version] = await db.select()
      .from(strategyVersions)
      .where(eq(strategyVersions.id, strategyVersionId))
      .limit(1);

    if (!version) {
      throw new Error('Strategy version not found');
    }

    const analysisData = version.analysisData as any;
    const bmcAnalysis = analysisData?.bmc_research;

    if (!bmcAnalysis) {
      throw new Error('No BMC analysis found for this version');
    }

    // Prepare context for intelligent program naming
    const namingContext = {
      bmcKeyInsights: bmcAnalysis.keyInsights || [],
      bmcRecommendations: bmcAnalysis.recommendations || [],
      selectedDecisions: version.selectedDecisions || null,
      decisionsData: version.decisionsData || null,
      framework: 'bmc',
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

    // Convert BMC blocks to BMCResults format
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

    // Run through BMC analyzer
    sendSSEEvent(progressId, {
      type: 'step-start',
      step: 'analyze',
      progress: 10,
      description: 'Analyzing strategic framework...'
    });
    
    const insights = await bmcAnalyzer.analyze(bmcResults);
    
    // Include prioritized order and sessionId in user decisions context
    const decisionsWithPriority = userDecisions ? {
      ...userDecisions,
      prioritizedOrder: prioritizedOrder || [],
      sessionId: version.sessionId,  // Pass sessionId for initiative type lookup
    } : { 
      prioritizedOrder: prioritizedOrder || [],
      sessionId: version.sessionId,  // Pass sessionId for initiative type lookup
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
        }
      }
    );

    const userId = (req.user as any)?.claims?.sub || null;

    // Extract component-level confidence scores
    const componentConfidence = extractComponentConfidence(epmProgram);
    const finalConfidence = boostConfidenceWithDecisions(componentConfidence, userDecisions);
    const overallConfidence = calculateOverallConfidence(finalConfidence);

    // Save EPM program to database
    const [savedProgram] = await db.insert(epmPrograms).values({
      strategyVersionId,
      strategyDecisionId: decisionId || null,
      userId,
      frameworkType: 'bmc',
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
    }).returning();

    // Verify program was saved and ID exists
    if (!savedProgram || !savedProgram.id) {
      console.error('[EPM Generation] ❌ Program save failed - no ID returned:', savedProgram);
      throw new Error('Failed to save EPM program - no ID returned from database');
    }

    const programId = savedProgram.id;
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`[EPM Generation] ✅ Program saved with ID: ${programId}`);
    console.log(`[EPM Generation] Total elapsed time: ${elapsedSeconds}s`);
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
    
    // Close SSE stream
    const stream = progressStreams.get(progressId);
    if (stream) {
      stream.res.end();
      progressStreams.delete(progressId);
    }
  } catch (error: any) {
    console.error('Error in processEPMGeneration:', error);
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

    res.json({ success: true, data: programs });
  } catch (error: any) {
    console.error('Error batch exporting EPM programs:', error);
    res.status(500).json({ error: error.message || 'Failed to export EPM programs' });
  }
});

export default router;
