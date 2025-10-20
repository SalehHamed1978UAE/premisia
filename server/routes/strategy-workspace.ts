import { Router, Request, Response } from 'express';
import { db } from '../db';
import { strategyDecisions, epmPrograms, journeySessions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { BMCAnalyzer, PortersAnalyzer, PESTLEAnalyzer, EPMSynthesizer } from '../intelligence';
import type { BMCResults, PortersResults, PESTLEResults } from '../intelligence/types';

const router = Router();

const epmSynthesizer = new EPMSynthesizer();
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

// POST /api/strategy-workspace/decisions
// Save user's strategic decisions
router.post('/decisions', async (req: Request, res: Response) => {
  try {
    const {
      journeySessionId,
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

    if (!journeySessionId || !goDecision) {
      return res.status(400).json({ 
        error: 'journeySessionId and goDecision are required' 
      });
    }

    const userId = (req.user as any)?.claims?.sub || null;

    const [decision] = await db.insert(strategyDecisions).values({
      journeySessionId,
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
  try {
    const { journeySessionId, decisionId } = req.body;

    if (!journeySessionId) {
      return res.status(400).json({ error: 'journeySessionId is required' });
    }

    // Fetch journey session to get framework results
    const [session] = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.id, journeySessionId))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: 'Journey session not found' });
    }

    // Fetch user decisions if provided
    let userDecisions = null;
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
        if (decision.channelPriorities?.length > 0) page1Fields++;
        if (decision.partnershipStrategy) page1Fields++;
        if (page1Fields < 2) {
          missingFields.push('Strategic Choices (need at least 2 decisions)');
        }
        
        // Page 2: Risk & Investment (required)
        if (!decision.riskTolerance) missingFields.push('Risk Tolerance');
        if (!decision.timelinePreference) missingFields.push('Timeline Preference');
        
        // Page 3: Assumptions (at least 1 required)
        if (!decision.validatedAssumptions?.length && !decision.concerns?.length) {
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
          return res.status(400).json({ 
            error: 'Incomplete strategic decisions',
            missingFields,
            message: 'Please complete the Decision Summary to fill the 22% automation gap and boost EPM confidence'
          });
        }
        
        userDecisions = decision;
      }
    }

    const context = session.accumulatedContext as any;
    
    // Determine framework type from completed frameworks
    const completedFrameworks = session.completedFrameworks || [];
    let frameworkType: string = 'unknown';
    let frameworkResults: any = null;

    // Extract framework results from context
    if (completedFrameworks.includes('bmc')) {
      frameworkType = 'bmc';
      frameworkResults = context.insights?.bmcBlocks || {};
      
      // Convert to BMCResults format
      const bmcResults: BMCResults = {
        customerSegments: frameworkResults.customer_segments?.description || '',
        valuePropositions: frameworkResults.value_propositions?.description || '',
        channels: frameworkResults.channels?.description || '',
        customerRelationships: frameworkResults.customer_relationships?.description || '',
        revenueStreams: frameworkResults.revenue_streams?.description || '',
        keyActivities: frameworkResults.key_activities?.description || '',
        keyResources: frameworkResults.key_resources?.description || '',
        keyPartnerships: frameworkResults.key_partnerships?.description || '',
        costStructure: frameworkResults.cost_structure?.description || '',
        contradictions: context.insights?.bmcContradictions || [],
        recommendations: context.insights?.keyInsights || [],
        executiveSummary: context.insights?.executiveSummary || '',
      };

      // Run through BMC analyzer
      const insights = await bmcAnalyzer.analyze(bmcResults);
      
      // Run through EPM synthesizer
      const epmProgram = await epmSynthesizer.synthesize(insights, userDecisions);

      const userId = (req.user as any)?.claims?.sub || null;

      // Extract component-level confidence scores
      const componentConfidence = extractComponentConfidence(epmProgram);
      const finalConfidence = boostConfidenceWithDecisions(componentConfidence, userDecisions);

      // Save EPM program to database
      const [savedProgram] = await db.insert(epmPrograms).values({
        journeySessionId,
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
        overallConfidence: calculateOverallConfidence(finalConfidence).toString(),
        editTracking: {},
        status: 'draft',
      }).returning();

      res.json({
        success: true,
        epmProgramId: savedProgram.id,
        overallConfidence: calculateOverallConfidence(finalConfidence),
        componentsGenerated: 14,
      });
    } else if (completedFrameworks.includes('porters')) {
      frameworkType = 'porters';
      frameworkResults = context.insights?.porterAnalysis || {};
      
      // Convert to PortersResults format
      const portersResults: PortersResults = {
        competitiveRivalry: frameworkResults.competitive_rivalry || '',
        supplierPower: frameworkResults.supplier_power || '',
        buyerPower: frameworkResults.buyer_power || '',
        threatOfSubstitutes: frameworkResults.threat_of_substitutes || '',
        threatOfNewEntry: frameworkResults.threat_of_new_entry || '',
        overallAssessment: frameworkResults.overall_assessment || '',
        strategicRecommendations: frameworkResults.strategic_recommendations || [],
      };

      // Run through Porter's analyzer
      const insights = await portersAnalyzer.analyze(portersResults);
      
      // Run through EPM synthesizer
      const epmProgram = await epmSynthesizer.synthesize(insights, userDecisions);

      const userId = (req.user as any)?.claims?.sub || null;

      // Extract component-level confidence scores
      const componentConfidence = extractComponentConfidence(epmProgram);
      const finalConfidence = boostConfidenceWithDecisions(componentConfidence, userDecisions);

      // Save EPM program to database
      const [savedProgram] = await db.insert(epmPrograms).values({
        journeySessionId,
        strategyDecisionId: decisionId || null,
        userId,
        frameworkType: 'porters',
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
        overallConfidence: calculateOverallConfidence(finalConfidence).toString(),
        editTracking: {},
        status: 'draft',
      }).returning();

      res.json({
        success: true,
        epmProgramId: savedProgram.id,
        overallConfidence: calculateOverallConfidence(finalConfidence),
        componentsGenerated: 14,
      });
    } else if (completedFrameworks.includes('pestle')) {
      frameworkType = 'pestle';
      frameworkResults = context.insights?.pestleAnalysis || {};
      
      // Convert to PESTLEResults format
      const pestleResults: PESTLEResults = {
        political: frameworkResults.political || [],
        economic: frameworkResults.economic || [],
        social: frameworkResults.social || [],
        technological: frameworkResults.technological || [],
        legal: frameworkResults.legal || [],
        environmental: frameworkResults.environmental || [],
        overallAssessment: frameworkResults.overall_assessment || '',
        strategicImplications: frameworkResults.strategic_implications || [],
      };

      // Run through PESTLE analyzer
      const insights = await pestleAnalyzer.analyze(pestleResults);
      
      // Run through EPM synthesizer
      const epmProgram = await epmSynthesizer.synthesize(insights, userDecisions);

      const userId = (req.user as any)?.claims?.sub || null;

      // Extract component-level confidence scores
      const componentConfidence = extractComponentConfidence(epmProgram);
      const finalConfidence = boostConfidenceWithDecisions(componentConfidence, userDecisions);

      // Save EPM program to database
      const [savedProgram] = await db.insert(epmPrograms).values({
        journeySessionId,
        strategyDecisionId: decisionId || null,
        userId,
        frameworkType: 'pestle',
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
        overallConfidence: calculateOverallConfidence(finalConfidence).toString(),
        editTracking: {},
        status: 'draft',
      }).returning();

      res.json({
        success: true,
        epmProgramId: savedProgram.id,
        overallConfidence: calculateOverallConfidence(finalConfidence),
        componentsGenerated: 14,
      });
    } else {
      return res.status(400).json({ error: 'No supported framework found in journey' });
    }
  } catch (error: any) {
    console.error('Error in POST /epm/generate:', error);
    res.status(500).json({ error: error.message || 'EPM generation failed' });
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

export default router;
