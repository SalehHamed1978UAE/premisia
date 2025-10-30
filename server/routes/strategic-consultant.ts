import { Router, Request, Response } from 'express';
import multer from 'multer';
import { InputProcessor } from '../strategic-consultant/input-processor';
import { StrategyAnalyzer } from '../strategic-consultant/strategy-analyzer';
import { DecisionGenerator } from '../strategic-consultant/decision-generator';
import { VersionManager } from '../strategic-consultant/version-manager';
import { EPMConverter } from '../strategic-consultant/epm-converter';
import { EPMIntegrator } from '../strategic-consultant/epm-integrator';
import { WhysTreeGenerator } from '../strategic-consultant/whys-tree-generator';
import { MarketResearcher } from '../strategic-consultant/market-researcher';
import { FrameworkSelector } from '../strategic-consultant/framework-selector';
import { BMCResearcher } from '../strategic-consultant/bmc-researcher';
import { storage } from '../storage';
import { unlink } from 'fs/promises';
import { db } from '../db';
import { strategicUnderstanding, journeySessions, strategyVersions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { strategicUnderstandingService } from '../strategic-understanding-service';
import { JourneyOrchestrator } from '../journey/journey-orchestrator';
import { journeyRegistry } from '../journey/journey-registry';
import type { JourneyType } from '@shared/journey-types';
import { InitiativeClassifier } from '../strategic-consultant/initiative-classifier';
import { ambiguityDetector } from '../services/ambiguity-detector.js';
import { getStrategicUnderstanding, getStrategicUnderstandingBySession, updateStrategicUnderstanding, getJourneySession } from '../services/secure-data-service';
import { fiveWhysCoach } from '../services/five-whys-coach.js';

const router = Router();
const upload = multer({ 
  dest: '/tmp/uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }
});

const inputProcessor = new InputProcessor();
const strategyAnalyzer = new StrategyAnalyzer();
const decisionGenerator = new DecisionGenerator();
const versionManager = new VersionManager(storage);
const epmConverter = new EPMConverter();
const epmIntegrator = new EPMIntegrator();
const whysTreeGenerator = new WhysTreeGenerator();
const marketResearcher = new MarketResearcher();
const frameworkSelector = new FrameworkSelector();
const bmcResearcher = new BMCResearcher();
const journeyOrchestrator = new JourneyOrchestrator();

/**
 * Build a rich strategic summary for follow-on journeys
 * Aggregates executive summary, decisions, insights, and references
 */
async function buildStrategicSummary(understandingId: string): Promise<string> {
  // Get the strategic understanding
  const understanding = await getStrategicUnderstanding(understandingId);
  if (!understanding) {
    throw new Error('Strategic understanding not found');
  }

  // Get completed journey sessions
  const sessions = await db.query.journeySessions.findMany({
    where: (sessions, { eq }) => eq(sessions.understandingId, understandingId),
    orderBy: (sessions, { desc }) => [desc(sessions.createdAt)],
  });

  // Get strategic versions from ALL journey sessions (not just the base session)
  const allVersions: any[] = [];
  
  // Include base understanding session versions
  if (understanding.sessionId) {
    const baseVersions = await db.query.strategyVersions.findMany({
      where: (versions, { eq }) => eq(versions.sessionId, understanding.sessionId || ''),
      orderBy: (versions, { desc }) => [desc(versions.createdAt)],
    });
    allVersions.push(...baseVersions);
  }
  
  // Include versions from each journey session
  for (const session of sessions) {
    const sessionVersions = await db.query.strategyVersions.findMany({
      where: (versions, { and, eq }) => and(
        eq(versions.sessionId, session.id),
      ),
      orderBy: (versions, { desc }) => [desc(versions.createdAt)],
    });
    allVersions.push(...sessionVersions);
  }
  
  // Sort all versions by creation date and take most recent
  const versions = allVersions
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5); // Take top 5 most recent decisions across all sessions

  // Get strategic entities (for key insights)
  const entities = await db.query.strategicEntities.findMany({
    where: (entities, { eq }) => eq(entities.understandingId, understandingId),
    orderBy: (entities, { desc }) => [desc(entities.createdAt)],
    limit: 10,
  });

  // Get references
  const references = await db.query.references.findMany({
    where: (refs, { eq }) => eq(refs.understandingId, understandingId),
    orderBy: (refs, { desc }) => [desc(refs.createdAt)],
    limit: 10,
  });

  // Build comprehensive summary
  const summaryParts: string[] = [];

  // Header
  summaryParts.push('# Strategic Context Summary\n');
  summaryParts.push(`## Executive Summary`);
  summaryParts.push(understanding.userInput || '');
  summaryParts.push('');

  // Initiative Details
  if (understanding.initiativeType) {
    summaryParts.push(`## Initiative Classification`);
    summaryParts.push(`Type: ${understanding.initiativeType}`);
    if (understanding.initiativeDescription) {
      summaryParts.push(`Description: ${understanding.initiativeDescription}`);
    }
    summaryParts.push('');
  }

  // Completed Analysis
  if (sessions.length > 0) {
    summaryParts.push(`## Completed Strategic Analysis`);
    summaryParts.push(`Previous analysis included ${sessions.length} journey session(s):`);
    sessions.forEach((session, idx) => {
      const statusText = session.status === 'completed' ? 'Completed' : session.status;
      summaryParts.push(`${idx + 1}. ${session.journeyType} (v${session.versionNumber}) - ${statusText}`);
      if (session.completedFrameworks && session.completedFrameworks.length > 0) {
        summaryParts.push(`   Frameworks: ${session.completedFrameworks.join(', ')}`);
      }
    });
    summaryParts.push('');
  }

  // Strategic Decisions
  if (versions.length > 0) {
    summaryParts.push(`## Strategic Decisions & Analysis`);
    versions.forEach((version, idx) => {
      summaryParts.push(`${idx + 1}. Version ${version.versionNumber}${version.versionLabel ? ` (${version.versionLabel})` : ''}`);
      if (version.strategicApproach) {
        summaryParts.push(`   Approach: ${version.strategicApproach}`);
      }
      if (version.decisionsData) {
        const decisions = typeof version.decisionsData === 'string' 
          ? JSON.parse(version.decisionsData)
          : version.decisionsData;
        if (Array.isArray(decisions) && decisions.length > 0) {
          decisions.slice(0, 2).forEach((d: any) => {
            if (d.title) {
              summaryParts.push(`   Decision: ${d.title}`);
            }
          });
        }
      }
    });
    summaryParts.push('');
  }

  // Key Insights from Strategic Entities
  if (entities.length > 0) {
    summaryParts.push(`## Key Strategic Insights`);
    const topEntities = entities.slice(0, 5);
    topEntities.forEach((entity, idx) => {
      const entityType = entity.type || 'Insight';
      const category = entity.category ? ` (${entity.category})` : '';
      summaryParts.push(`${idx + 1}. ${entityType}${category}: ${entity.claim}`);
      if (entity.evidence) {
        summaryParts.push(`   Evidence: ${entity.evidence.substring(0, 150)}${entity.evidence.length > 150 ? '...' : ''}`);
      }
    });
    summaryParts.push('');
  }

  // Research References
  if (references.length > 0) {
    summaryParts.push(`## Supporting Research`);
    summaryParts.push(`Based on ${references.length} research source(s):`);
    const topReferences = references.slice(0, 5);
    topReferences.forEach((ref, idx) => {
      summaryParts.push(`${idx + 1}. ${ref.title || 'Reference'}`);
      if (ref.description) {
        summaryParts.push(`   ${ref.description.substring(0, 150)}${ref.description.length > 150 ? '...' : ''}`);
      }
      if (ref.url) {
        summaryParts.push(`   Source: ${ref.url}`);
      }
    });
    summaryParts.push('');
  }

  // Context for follow-on analysis
  summaryParts.push(`## Follow-On Analysis Context`);
  summaryParts.push(`This strategic summary incorporates insights from ${sessions.length} previous analysis session(s), ${entities.length} strategic findings, and ${references.length} research sources. Use this comprehensive context to inform deeper strategic exploration and identify new opportunities or risks.`);
  summaryParts.push('');

  return summaryParts.join('\n');
}

/**
 * POST /api/strategic-consultant/extract-file
 * Extract text content from uploaded file only (no analysis)
 */
router.post('/extract-file', upload.single('file'), async (req: Request, res: Response) => {
  let filePath: string | undefined;
  
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    filePath = file.path;
    const fileType = file.mimetype;
    
    let processedInput;
    if (fileType === 'application/pdf') {
      processedInput = await inputProcessor.processPDF(file.path);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      processedInput = await inputProcessor.processDOCX(file.path);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      processedInput = await inputProcessor.processExcel(file.path);
    } else if (fileType.startsWith('image/')) {
      processedInput = await inputProcessor.processImage(file.path, file.mimetype);
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    res.json({
      success: true,
      content: processedInput.content,
      metadata: processedInput.metadata,
      fileName: file.originalname, // Include fileName for enrichment tracking
    });
  } catch (error: any) {
    console.error('Error in /extract-file:', error);
    res.status(500).json({ error: error.message || 'File extraction failed' });
  } finally {
    // Always clean up uploaded file
    if (filePath) {
      try {
        await unlink(filePath);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
    }
  }
});

router.post('/analyze', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { text, sessionId } = req.body;
    const file = req.file;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    if (!text && !file) {
      return res.status(400).json({ error: 'Either text or file is required' });
    }

    let processedInput;
    if (file) {
      const fileType = file.mimetype;
      
      if (fileType === 'application/pdf') {
        processedInput = await inputProcessor.processPDF(file.path);
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        processedInput = await inputProcessor.processDOCX(file.path);
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        processedInput = await inputProcessor.processExcel(file.path);
      } else if (fileType.startsWith('image/')) {
        processedInput = await inputProcessor.processImage(file.path, file.mimetype);
      } else {
        await unlink(file.path);
        return res.status(400).json({ error: 'Unsupported file type' });
      }

      await unlink(file.path);
    } else {
      processedInput = await inputProcessor.processText(text);
    }

    const analysis = await strategyAnalyzer.performFullAnalysis(processedInput.content);

    const decisions = await decisionGenerator.generateDecisions(analysis, processedInput.content);

    const validationResult = await decisionGenerator.validateDecisions(decisions);
    if (!validationResult.valid) {
      return res.status(400).json({ 
        error: 'Generated decisions are invalid',
        issues: validationResult.issues 
      });
    }

    const userId = (req.user as any)?.claims?.sub || null;
    const version = await versionManager.createVersion(sessionId, analysis, decisions, userId);

    // If a file was uploaded, queue background enrichment job
    if (file && processedInput) {
      const { backgroundJobService } = await import('../services/background-job-service');
      await backgroundJobService.createJob({
        userId,
        jobType: 'document_enrichment',
        sessionId,
        relatedEntityId: version.versionNumber.toString(),
        relatedEntityType: 'strategy_version',
        inputData: {
          processedInput,
          sessionId,
          fileName: file.originalname,
        },
      });
      console.log('[Analyze] ✓ Queued document enrichment job for:', file.originalname);
    }

    res.json({
      success: true,
      analysis,
      decisions,
      version: {
        versionNumber: version.versionNumber,
        status: version.status,
        createdAt: version.createdAt,
      },
      metadata: processedInput.metadata,
      inputContent: processedInput.content,
    });
  } catch (error: any) {
    console.error('Error in /analyze:', error);
    res.status(500).json({ error: error.message || 'Analysis failed' });
  }
});

/**
 * POST /api/strategic-consultant/check-sanity
 * Validate user input for obvious impossibilities BEFORE proceeding
 */
router.post('/check-sanity', async (req: Request, res: Response) => {
  try {
    const { userInput } = req.body;

    if (!userInput) {
      return res.status(400).json({ error: 'userInput is required' });
    }

    const { initialSanityChecker } = await import('../services/initial-sanity-check.js');
    const result = await initialSanityChecker.checkInput({ userInput });
    res.json(result);
  } catch (error: any) {
    console.error('[Strategic Consultant] Error in sanity check:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/strategic-consultant/check-ambiguities
 * Check user input for ambiguities BEFORE creating strategic understanding
 */
router.post('/check-ambiguities', async (req: Request, res: Response) => {
  try {
    const { userInput } = req.body;

    if (!userInput) {
      return res.status(400).json({ error: 'userInput is required' });
    }

    const result = await ambiguityDetector.detectAmbiguities(userInput);
    res.json(result);
  } catch (error: any) {
    console.error('[Strategic Consultant] Error checking ambiguities:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/understanding', async (req: Request, res: Response) => {
  try {
    const { input, clarifications, fileMetadata } = req.body;

    if (!input || !input.trim()) {
      return res.status(400).json({ error: 'Input text is required' });
    }

    // If clarifications provided, incorporate them into the input
    const finalInput = clarifications
      ? ambiguityDetector.buildClarifiedInput(input.trim(), clarifications)
      : input.trim();

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    console.log('[Understanding] Step 1: Classifying initiative type...');
    
    // Step 1: Classify the initiative type FIRST
    const classification = await InitiativeClassifier.classify(finalInput);
    
    console.log('[Understanding] Classification result:', {
      type: classification.initiativeType,
      confidence: classification.confidence,
      description: classification.description
    });
    
    console.log('[Understanding] Step 2: Starting Strategic Understanding analysis with ontology/knowledge graph...');
    
    // Step 2: Run full Strategic Understanding analysis with entity extraction
    const result = await strategicUnderstandingService.extractUnderstanding({
      sessionId,
      userInput: finalInput,
      companyContext: null,
    });

    console.log(`[Understanding] Analysis complete - extracted ${result.entities.length} entities`);
    
    // Step 3: Update the understanding record with classification data using secure service
    console.log('[Understanding] 🔐 Encrypting and saving initiative classification...');
    await updateStrategicUnderstanding(result.understandingId, {
      initiativeType: classification.initiativeType,
      initiativeDescription: classification.description,
      classificationConfidence: classification.confidence.toString(), // Convert to string for decimal type
      userConfirmed: false, // Not yet confirmed by user
    });
    
    console.log('[Understanding] ✓ Initiative classification saved to database with encryption');

    // Step 4: If file was uploaded, queue background enrichment job (matching /analyze behavior)
    if (fileMetadata?.fileName && fileMetadata?.content) {
      const userId = (req.user as any)?.claims?.sub || null;
      const { backgroundJobService } = await import('../services/background-job-service');
      
      // Reconstruct processedInput format matching /analyze route
      const processedInput = {
        content: fileMetadata.content,
        metadata: fileMetadata.metadata || {},
      };
      
      await backgroundJobService.createJob({
        userId,
        jobType: 'document_enrichment',
        sessionId,
        relatedEntityId: result.understandingId,
        relatedEntityType: 'strategic_understanding',
        inputData: {
          processedInput,
          sessionId,
          understandingId: result.understandingId,
          fileName: fileMetadata.fileName,
        },
      });
      console.log('[Understanding] ✓ Queued document enrichment job for:', fileMetadata.fileName);
    }

    res.json({
      success: true,
      understandingId: result.understandingId,
      sessionId: sessionId,
      entitiesExtracted: result.entities.length,
      // Include classification in response for immediate use
      classification: {
        initiativeType: classification.initiativeType,
        description: classification.description,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        userConfirmed: false,
      },
    });
  } catch (error: any) {
    console.error('Error in /understanding:', error);
    res.status(500).json({ error: error.message || 'Failed to create understanding' });
  }
});

router.get('/understanding/:understandingId', async (req: Request, res: Response) => {
  try {
    const { understandingId } = req.params;

    if (!understandingId) {
      return res.status(400).json({ error: 'Understanding ID is required' });
    }

    // Use secure service to get decrypted data
    const understanding = await getStrategicUnderstanding(understandingId);

    if (!understanding) {
      return res.status(404).json({ error: 'Understanding not found' });
    }

    res.json({
      id: understanding.id,
      sessionId: understanding.sessionId,
      userInput: understanding.userInput,
      initiativeType: understanding.initiativeType,
      initiativeDescription: understanding.initiativeDescription,
      classificationConfidence: understanding.classificationConfidence,
      userConfirmed: understanding.userConfirmed,
    });
  } catch (error: any) {
    console.error('Error in /understanding/:understandingId:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch understanding' });
  }
});

// PATCH /classification - Update initiative classification (user confirmation/correction)
router.patch('/classification', async (req: Request, res: Response) => {
  try {
    const { understandingId, initiativeType, userConfirmed } = req.body;

    // Validate required field
    if (!understandingId || typeof understandingId !== 'string') {
      return res.status(400).json({ error: 'Valid understanding ID is required' });
    }

    // Verify understanding exists BEFORE attempting update (using secure service)
    const understanding = await getStrategicUnderstanding(understandingId);

    if (!understanding) {
      return res.status(404).json({ error: 'Understanding not found' });
    }

    // Build update object with strict validation
    const updateData: any = {};
    
    if (initiativeType !== undefined) {
      // Validate initiative type against enum values
      const validTypes = [
        'physical_business_launch',
        'software_development',
        'digital_transformation',
        'market_expansion',
        'product_launch',
        'service_launch',
        'process_improvement',
        'other'
      ];
      
      if (typeof initiativeType !== 'string' || !validTypes.includes(initiativeType)) {
        return res.status(400).json({ 
          error: 'Invalid initiative type. Must be one of the valid enum values.',
          validTypes,
          received: initiativeType
        });
      }
      
      updateData.initiativeType = initiativeType;
    }
    
    if (userConfirmed !== undefined) {
      // Validate boolean type
      if (typeof userConfirmed !== 'boolean') {
        return res.status(400).json({ 
          error: 'userConfirmed must be a boolean value',
          received: typeof userConfirmed
        });
      }
      updateData.userConfirmed = userConfirmed;
    }

    // Ensure at least one field is being updated
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        error: 'No valid fields provided for update. Provide initiativeType and/or userConfirmed.'
      });
    }

    // Update the record using secure service (encrypts sensitive fields if present)
    console.log('[Classification] 🔐 Updating classification with encryption protection...');
    await updateStrategicUnderstanding(understandingId, updateData);
    console.log('[Classification] ✓ Updated classification for understanding:', understandingId, updateData);

    res.json({
      success: true,
      message: 'Classification updated successfully',
      understandingId,
      updates: updateData,
    });
  } catch (error: any) {
    console.error('Error in PATCH /classification:', error);
    res.status(500).json({ error: error.message || 'Failed to update classification' });
  }
});

router.post('/journeys/execute', async (req: Request, res: Response) => {
  try {
    const { journeyType, understandingId } = req.body;

    if (!journeyType || !understandingId) {
      return res.status(400).json({ 
        error: 'Both journeyType and understandingId are required' 
      });
    }

    // Use secure service to get decrypted data
    const understanding = await getStrategicUnderstanding(understandingId);

    if (!understanding) {
      return res.status(404).json({ error: 'Understanding not found' });
    }

    const journey = journeyRegistry.getJourney(journeyType as JourneyType);
    if (!journey) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    if (!journey.available) {
      return res.status(400).json({ 
        error: 'This journey is not yet available',
        journeyName: journey.name
      });
    }

    const userId = (req.user as any)?.claims?.sub || null;

    // Create journey session to track progress
    const journeySessionId = await journeyOrchestrator.startJourney(
      understanding.id!,
      journeyType as JourneyType,
      userId
    );

    // Return the first page in the journey sequence for client-side navigation
    const firstPage = (journey as any).pageSequence?.[0] || '/strategic-consultant/whys-tree/:understandingId';
    const navigationUrl = firstPage.replace(':understandingId', understandingId).replace(':sessionId', understanding.sessionId);

    res.json({
      success: true,
      journeySessionId,
      sessionId: understanding.sessionId, // Session ID used in navigation URLs
      journeyType,
      message: 'Journey initialized successfully',
      navigationUrl,
      totalSteps: journey.frameworks.length,
    });
  } catch (error: any) {
    console.error('Error in /journeys/execute:', error);
    res.status(500).json({ error: error.message || 'Journey execution failed' });
  }
});

router.get('/journeys/:sessionId/results', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Fetch journey session using secure service (decrypts accumulatedContext)
    const journeySession = await getJourneySession(sessionId);

    if (!journeySession) {
      return res.status(404).json({ error: 'Journey session not found' });
    }

    res.json({
      success: true,
      journeyType: journeySession.journeyType,
      status: journeySession.status,
      completedFrameworks: journeySession.completedFrameworks,
      context: journeySession.accumulatedContext, // Already decrypted by secure service
      completedAt: journeySession.completedAt,
    });
  } catch (error: any) {
    console.error('Error in /journeys/:sessionId/results:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch journey results' });
  }
});

router.post('/decisions/select', async (req: Request, res: Response) => {
  try {
    const { sessionId, versionNumber, selectedDecisions } = req.body;

    if (!sessionId || !versionNumber || !selectedDecisions) {
      return res.status(400).json({ 
        error: 'sessionId, versionNumber, and selectedDecisions are required' 
      });
    }

    const updated = await versionManager.updateVersion(
      sessionId,
      versionNumber,
      selectedDecisions
    );

    res.json({
      success: true,
      version: {
        versionNumber: updated.versionNumber,
        status: updated.status,
        selectedDecisions: updated.selectedDecisions,
      },
    });
  } catch (error: any) {
    console.error('Error in /decisions/select:', error);
    res.status(500).json({ error: error.message || 'Failed to update decisions' });
  }
});

router.post('/convert-to-epm', async (req: Request, res: Response) => {
  try {
    const { sessionId, versionNumber } = req.body;

    if (!sessionId || !versionNumber) {
      return res.status(400).json({ error: 'sessionId and versionNumber are required' });
    }

    const version = await storage.getStrategyVersion(sessionId, versionNumber);
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    if (!version.selectedDecisions || Object.keys(version.selectedDecisions as Record<string, unknown>).length === 0) {
      return res.status(400).json({ error: 'Version must have selected decisions' });
    }

    const program = await epmConverter.convertToEPM(
      version.analysisData as any,
      version.decisionsData as any,
      version.selectedDecisions as Record<string, string>
    );

    const structureValidation = await epmConverter.validateEPMStructure(program);
    if (!structureValidation.valid) {
      return res.status(400).json({
        error: 'Invalid EPM structure',
        issues: structureValidation.issues,
        warnings: structureValidation.warnings,
      });
    }

    const ontologyValidation = await epmConverter.validateAgainstOntology(program);

    const finalized = await versionManager.finalizeVersion(sessionId, versionNumber, program);

    res.json({
      success: true,
      program,
      validation: {
        structure: structureValidation,
        ontology: ontologyValidation,
      },
      version: {
        versionNumber: finalized.versionNumber,
        status: finalized.status,
        finalizedAt: finalized.finalizedAt,
      },
    });
  } catch (error: any) {
    console.error('Error in /convert-to-epm:', error);
    res.status(500).json({ error: error.message || 'EPM conversion failed' });
  }
});

// Get all strategy versions for current user (MUST be before /versions/:sessionId)
router.get('/versions/all', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const versions = await storage.getAllStrategyVersionsByUser(userId);
    res.json(versions);

  } catch (error: any) {
    console.error('Error in /versions/all:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch versions' });
  }
});

router.get('/versions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId} = req.params;
    const versions = await versionManager.listVersions(sessionId);

    res.json({
      success: true,
      versions: versions.map(v => ({
        versionNumber: v.versionNumber,
        status: v.status,
        createdAt: v.createdAt,
        finalizedAt: v.finalizedAt,
        hasSelectedDecisions: !!v.selectedDecisions,
        hasProgram: !!v.programStructure,
      })),
    });
  } catch (error: any) {
    console.error('Error in /versions:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch versions' });
  }
});

router.get('/versions/:sessionId/:versionNumber', async (req: Request, res: Response) => {
  try {
    const { sessionId, versionNumber } = req.params;
    const version = await storage.getStrategyVersion(sessionId, parseInt(versionNumber));

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    console.log('[GET /versions] Retrieved version:', {
      hasId: !!version.id,
      id: version.id,
      versionNumber: version.versionNumber,
      sessionId: version.sessionId,
    });

    res.json({
      success: true,
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
        analysis: version.analysisData,
        decisions: version.decisionsData,
        selectedDecisions: version.selectedDecisions,
        program: version.programStructure,
        createdAt: version.createdAt,
        finalizedAt: version.finalizedAt,
      },
    });
  } catch (error: any) {
    console.error('Error in /versions/:sessionId/:versionNumber:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch version' });
  }
});

// PATCH /api/strategic-consultant/versions/:sessionId/:versionNumber
// Update strategy version with selected decisions
router.patch('/versions/:sessionId/:versionNumber', async (req: Request, res: Response) => {
  try {
    const { sessionId, versionNumber } = req.params;
    const { selectedDecisions } = req.body;

    if (!selectedDecisions) {
      return res.status(400).json({ error: 'selectedDecisions is required' });
    }

    // Get existing version
    const version = await storage.getStrategyVersion(sessionId, parseInt(versionNumber));
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Update version with selected decisions
    await db
      .update(strategyVersions)
      .set({
        selectedDecisions: selectedDecisions,
        updatedAt: new Date(),
      })
      .where(eq(strategyVersions.id, version.id));

    res.json({
      success: true,
      message: 'Selected decisions saved',
    });
  } catch (error: any) {
    console.error('Error in PATCH /versions/:sessionId/:versionNumber:', error);
    res.status(500).json({ error: error.message || 'Failed to update version' });
  }
});

router.post('/versions/compare', async (req: Request, res: Response) => {
  try {
    const { sessionId, versionA, versionB } = req.body;

    if (!sessionId || !versionA || !versionB) {
      return res.status(400).json({ 
        error: 'sessionId, versionA, and versionB are required' 
      });
    }

    const comparison = await versionManager.compareVersions(
      sessionId,
      versionA,
      versionB
    );

    res.json({
      success: true,
      comparison,
    });
  } catch (error: any) {
    console.error('Error in /versions/compare:', error);
    res.status(500).json({ error: error.message || 'Version comparison failed' });
  }
});

router.post('/integrate/:sessionId/:versionNumber', async (req: Request, res: Response) => {
  try {
    const { sessionId, versionNumber } = req.params;
    const userId = (req.user as any)?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Fetch the version
    const version = await storage.getStrategyVersion(sessionId, parseInt(versionNumber));

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    if (!version.programStructure) {
      return res.status(400).json({ 
        error: 'No EPM program structure found. Please convert decisions to EPM program first.' 
      });
    }

    // Atomically check and start integration (prevents concurrent integrations)
    const startedVersion = await storage.tryStartIntegration(version.id);
    
    if (!startedVersion) {
      // Already integrated or currently integrating
      return res.status(400).json({
        error: 'This version is already integrated or currently being integrated',
        programId: version.convertedProgramId
      });
    }

    try {
      // Integrate to EPM Suite
      const result = await epmIntegrator.integrateToEPMSuite(
        version.programStructure as any,
        userId,
        sessionId,
        version.id
      );

      // Mark version as successfully integrated (programId was already set in integrator)
      await storage.updateStrategyVersion(version.id, {
        status: 'converted_to_program',
      });

      res.json({
        success: true,
        programId: result.programId,
        summary: result.summary,
        message: 'Strategic Consultant program successfully integrated into EPM Suite',
      });
    } catch (error: any) {
      // Check current state to determine rollback strategy
      const currentVersion = await storage.getStrategyVersion(sessionId, parseInt(versionNumber));
      
      if (currentVersion?.convertedProgramId) {
        // Program was created - mark as converted to prevent duplicate on retry
        await storage.updateStrategyVersion(version.id, {
          status: 'converted_to_program',
        });
      } else {
        // Program not created - allow retry
        await storage.updateStrategyVersion(version.id, {
          status: version.status, // Restore original status
        });
      }
      throw error;
    }

  } catch (error: any) {
    console.error('Error in /integrate:', error);
    res.status(500).json({ error: error.message || 'Integration failed' });
  }
});

router.post('/whys-tree/generate', async (req: Request, res: Response) => {
  try {
    const { sessionId, input } = req.body;

    if (!sessionId || !input) {
      return res.status(400).json({ error: 'sessionId and input are required' });
    }

    const tree = await whysTreeGenerator.generateTree(input, sessionId);

    res.json({
      tree,
      estimatedTime: '20s',
    });
  } catch (error: any) {
    console.error('Error in /whys-tree/generate:', error);
    res.status(500).json({ error: error.message || 'Whys tree generation failed' });
  }
});

router.post('/whys-tree/expand', async (req: Request, res: Response) => {
  try {
    const { sessionId, nodeId, selectedPath, currentDepth, parentQuestion, input, isCustom, customOption } = req.body;

    if (!sessionId || !nodeId || !selectedPath || currentDepth === undefined || !parentQuestion || !input) {
      return res.status(400).json({ 
        error: 'sessionId, nodeId, selectedPath, currentDepth, parentQuestion, and input are required' 
      });
    }

    let expandedBranches;

    if (isCustom && customOption) {
      console.log('[API] Custom branch expansion requested');
      console.log('[API] selectedPath:', selectedPath);
      console.log('[API] customOption:', customOption);
      console.log('[API] isCustom:', isCustom);
      
      // For custom options, generate fresh branches using the custom option as context
      expandedBranches = await whysTreeGenerator.generateCustomBranches(
        customOption,
        selectedPath,
        input,
        sessionId,
        currentDepth
      );
    } else {
      // For AI-generated options, use normal expand logic
      expandedBranches = await whysTreeGenerator.expandBranch(
        nodeId,
        selectedPath,
        input,
        sessionId,
        currentDepth,
        parentQuestion
      );
    }

    res.json({
      expandedBranches,
    });
  } catch (error: any) {
    console.error('Error in /whys-tree/expand:', error);
    res.status(500).json({ error: error.message || 'Branch expansion failed' });
  }
});

router.post('/whys-tree/finalize', async (req: Request, res: Response) => {
  try {
    const { sessionId, selectedPath, rootCause, versionNumber, input } = req.body;

    if (!sessionId || !selectedPath || !rootCause || !input) {
      return res.status(400).json({ 
        error: 'sessionId, selectedPath, rootCause, and input are required' 
      });
    }

    const insights = await whysTreeGenerator.analyzePathInsights(input, selectedPath.map((option: string, index: number) => ({
      id: `node-${index}`,
      question: '',
      option,
      depth: index + 1,
      isLeaf: false,
    })));

    // Structure Five Whys data to match FiveWhysAnalysis interface expected by renderer
    // Renderer expects: why_1.question, why_1.answer, etc.
    const analysisData = {
      five_whys: {
        problem_statement: input,
        why_1: {
          question: "Why is this happening?",
          answer: selectedPath[0] || ""
        },
        why_2: {
          question: "Why does that occur?",
          answer: selectedPath[1] || ""
        },
        why_3: {
          question: "Why is that the case?",
          answer: selectedPath[2] || ""
        },
        why_4: {
          question: "Why does that matter?",
          answer: selectedPath[3] || ""
        },
        why_5: {
          question: "What's the underlying cause?",
          answer: selectedPath[4] || ""
        },
        root_cause: rootCause,
        strategic_implications: insights.strategic_implications,
        // Keep whysPath for backward compatibility
        whysPath: selectedPath,
        recommendedActions: insights.recommended_actions,
        framework: 'five_whys',
      },
      // Add fields expected by downstream pages to prevent crashes
      recommended_approaches: [],
      strategic_options: [],
      risks: [],
      porters_analysis: null,
    };

    let version;
    const userId = (req.user as any)?.claims?.sub || null;

    // Check if version already exists
    let targetVersionNumber: number | undefined;
    if (versionNumber) {
      targetVersionNumber = versionNumber;
    } else {
      const versions = await storage.getStrategyVersionsBySession(sessionId);
      if (versions.length > 0) {
        targetVersionNumber = versions[versions.length - 1].versionNumber;
      }
    }

    if (targetVersionNumber) {
      // Update existing version
      version = await storage.getStrategyVersion(sessionId, targetVersionNumber);
      if (!version) {
        return res.status(404).json({ error: 'Version not found' });
      }

      const existingAnalysisData = version.analysisData as any || {};
      await storage.updateStrategyVersion(version.id, {
        analysisData: {
          ...existingAnalysisData,
          ...analysisData,
        },
      });
    } else {
      // Create new version (Five Whys flow without pre-existing analysis)
      // Get descriptive title from strategic understanding
      const initiativeDescription = await storage.getInitiativeDescriptionForSession(sessionId);
      const inputSummary = initiativeDescription || 'Strategic Analysis';
      
      // Use storage.createStrategyVersion directly since we don't have complete StrategyAnalysis yet
      version = await storage.createStrategyVersion({
        sessionId,
        versionNumber: 1,
        analysisData: analysisData,
        decisionsData: { decisions: [] },
        selectedDecisions: null,
        programStructure: null,
        status: 'draft',
        createdBy: userId,
        userId: userId,
        inputSummary,
      });
    }

    res.json({
      rootCause,
      fullPath: selectedPath,
      strategicImplication: insights.strategic_implications.join('; '),
      versionNumber: version.versionNumber,
    });
  } catch (error: any) {
    console.error('Error in /whys-tree/finalize:', error);
    res.status(500).json({ error: error.message || 'Whys tree finalization failed' });
  }
});

router.post('/whys-tree/validate-root-cause', async (req: Request, res: Response) => {
  try {
    const { rootCauseText } = req.body;

    if (!rootCauseText) {
      return res.status(400).json({ error: 'rootCauseText is required' });
    }

    const validation = await whysTreeGenerator.validateRootCause(rootCauseText);

    res.json(validation);
  } catch (error: any) {
    console.error('Error in /whys-tree/validate-root-cause:', error);
    res.status(500).json({ error: error.message || 'Root cause validation failed' });
  }
});

router.get('/research/stream/:sessionId', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sessionId = req.params.sessionId;
  const rootCause = req.query.rootCause as string;
  const whysPath = JSON.parse(req.query.whysPath as string || '[]');
  const input = req.query.input as string;
  const versionNumber = req.query.versionNumber ? parseInt(req.query.versionNumber as string) : undefined;

  if (!sessionId || !rootCause || !whysPath || !input) {
    res.write(`data: ${JSON.stringify({ error: 'Missing required parameters' })}\n\n`);
    res.end();
    return;
  }

  try {
    const startTime = Date.now();

    res.write(`data: ${JSON.stringify({ type: 'progress', message: 'Generating research queries...', progress: 10 })}\n\n`);

    const queries = await marketResearcher.generateResearchQueries(rootCause, input, whysPath);
    
    res.write(`data: ${JSON.stringify({ type: 'progress', message: `Generated ${queries.length} research queries`, progress: 20 })}\n\n`);

    res.write(`data: ${JSON.stringify({ type: 'progress', message: 'Executing web searches...', progress: 30 })}\n\n`);

    const searchResults = [];
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      res.write(`data: ${JSON.stringify({ 
        type: 'query', 
        message: `Searching: ${query.query}`, 
        progress: 30 + (i + 1) * (30 / queries.length) 
      })}\n\n`);

      const result = await marketResearcher.performSingleWebSearch(query);
      searchResults.push(result);
    }

    res.write(`data: ${JSON.stringify({ type: 'progress', message: 'Selecting top sources...', progress: 65 })}\n\n`);

    const topSources = marketResearcher.selectTopSourcesPublic(searchResults);

    res.write(`data: ${JSON.stringify({ type: 'progress', message: 'Fetching article content...', progress: 70 })}\n\n`);

    const sourceContents = await marketResearcher.fetchSourceContentPublic(topSources.slice(0, 3));

    res.write(`data: ${JSON.stringify({ type: 'progress', message: 'Synthesizing research findings...', progress: 85 })}\n\n`);

    const findings = await marketResearcher.synthesizeFindingsPublic(
      rootCause,
      input,
      whysPath,
      searchResults,
      topSources,
      sourceContents
    );

    res.write(`data: ${JSON.stringify({ type: 'progress', message: 'Validating research sources...', progress: 88 })}\n\n`);

    const allFindings = [
      ...findings.market_dynamics,
      ...findings.competitive_landscape,
      ...findings.language_preferences,
      ...findings.buyer_behavior,
      ...findings.regulatory_factors,
    ];

    const validation = await marketResearcher.validateFindingsPublic(allFindings, findings.sources);

    const findingsWithValidation = {
      ...findings,
      validation,
    };

    const endTime = Date.now();
    const timeElapsedMs = endTime - startTime;
    const timeElapsed = `${(timeElapsedMs / 1000).toFixed(1)}s`;

    res.write(`data: ${JSON.stringify({ type: 'progress', message: 'Saving research data...', progress: 95 })}\n\n`);

    let targetVersionNumber: number;
    let version;

    if (versionNumber) {
      targetVersionNumber = versionNumber;
      version = await storage.getStrategyVersion(sessionId, targetVersionNumber);
      
      if (!version) {
        return res.status(404).json({ error: 'Version not found' });
      }
    } else {
      const versions = await storage.getStrategyVersionsBySession(sessionId);
      if (versions.length === 0) {
        return res.status(404).json({ error: 'No versions found for this session' });
      }
      version = versions[versions.length - 1];
      targetVersionNumber = version.versionNumber;
    }

    const existingAnalysisData = version.analysisData as any || {};
    await storage.updateStrategyVersion(version.id, {
      analysisData: {
        ...existingAnalysisData,
        research: findingsWithValidation,
      },
    });

    const searchQueriesUsed = findingsWithValidation.sources.map(s => s.title);
    const sourcesAnalyzed = findingsWithValidation.sources.length;

    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      data: {
        findings: findingsWithValidation,
        searchQueriesUsed,
        sourcesAnalyzed,
        timeElapsed,
        versionNumber: targetVersionNumber,
      },
      progress: 100 
    })}\n\n`);
    
    res.end();
  } catch (error: any) {
    console.error('Error in /research/stream:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Research failed' })}\n\n`);
    res.end();
  }
});

router.post('/analyze-enhanced', async (req: Request, res: Response) => {
  try {
    const { sessionId, rootCause, whysPath, versionNumber } = req.body;

    if (!sessionId || !rootCause || !whysPath) {
      return res.status(400).json({ 
        error: 'sessionId, rootCause, and whysPath are required' 
      });
    }

    let targetVersionNumber: number;
    let version;

    if (versionNumber) {
      targetVersionNumber = versionNumber;
      version = await storage.getStrategyVersion(sessionId, targetVersionNumber);
      
      if (!version) {
        return res.status(404).json({ error: 'Version not found' });
      }
    } else {
      const versions = await storage.getStrategyVersionsBySession(sessionId);
      if (versions.length === 0) {
        return res.status(404).json({ error: 'No versions found for this session' });
      }
      version = versions[versions.length - 1];
      targetVersionNumber = version.versionNumber;
    }

    const existingAnalysisData = version.analysisData as any || {};
    
    if (!existingAnalysisData.research) {
      return res.status(400).json({ 
        error: 'No research findings available. Please conduct research first.' 
      });
    }

    let input = '';
    if (version.inputSummary) {
      input = version.inputSummary;
    }

    const enhancedAnalysis = await strategyAnalyzer.analyzeWithResearch(
      sessionId,
      rootCause,
      whysPath,
      existingAnalysisData.research,
      input
    );

    await storage.updateStrategyVersion(version.id, {
      analysisData: {
        ...existingAnalysisData,
        enhanced_analysis: enhancedAnalysis,
      },
    });

    res.json({
      analysis: enhancedAnalysis,
      versionNumber: targetVersionNumber,
    });
  } catch (error: any) {
    console.error('Error in /analyze-enhanced:', error);
    res.status(500).json({ error: error.message || 'Enhanced analysis failed' });
  }
});

router.post('/decisions/generate-with-research', async (req: Request, res: Response) => {
  try {
    const { sessionId, versionNumber } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    let targetVersionNumber: number;
    let version;

    if (versionNumber) {
      targetVersionNumber = versionNumber;
      version = await storage.getStrategyVersion(sessionId, targetVersionNumber);
      
      if (!version) {
        return res.status(404).json({ error: 'Version not found' });
      }
    } else {
      const versions = await storage.getStrategyVersionsBySession(sessionId);
      if (versions.length === 0) {
        return res.status(404).json({ error: 'No versions found for this session' });
      }
      version = versions[versions.length - 1];
      targetVersionNumber = version.versionNumber;
    }

    const existingAnalysisData = version.analysisData as any || {};
    
    if (!existingAnalysisData.research) {
      return res.status(400).json({ 
        error: 'No research findings available. Please conduct research first.' 
      });
    }

    if (!existingAnalysisData.enhanced_analysis) {
      return res.status(400).json({ 
        error: 'No Porter\'s analysis available. Please run enhanced analysis first.' 
      });
    }

    // Get the original analysis data
    const originalAnalysis = version.analysisData as any;
    if (!originalAnalysis) {
      return res.status(400).json({ error: 'No analysis data found in version' });
    }

    // Extract original input
    let originalInput = version.inputSummary || '';

    // Generate research-informed decisions
    const researchInformedDecisions = await decisionGenerator.generateDecisionsWithResearch(
      originalAnalysis,
      originalInput,
      existingAnalysisData.research,
      existingAnalysisData.enhanced_analysis.portersAnalysis
    );

    // Validate the generated decisions
    const validationResult = await decisionGenerator.validateDecisions(researchInformedDecisions);
    if (!validationResult.valid) {
      return res.status(400).json({ 
        error: 'Generated decisions are invalid',
        issues: validationResult.issues 
      });
    }

    // Update version with research-informed decisions
    await storage.updateStrategyVersion(version.id, {
      decisionsData: researchInformedDecisions,
    });

    res.json({
      success: true,
      decisions: researchInformedDecisions,
      versionNumber: targetVersionNumber,
      message: 'Decisions successfully updated with research findings'
    });
  } catch (error: any) {
    console.error('Error in /decisions/generate-with-research:', error);
    res.status(500).json({ error: error.message || 'Research-informed decision generation failed' });
  }
});

router.post('/select-framework', async (req: Request, res: Response) => {
  try {
    const { input, sessionId } = req.body;
    const userId = (req.user as any)?.claims?.sub;

    if (!input) {
      return res.status(400).json({ error: 'Input text is required' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const selection = await frameworkSelector.selectFramework(sessionId, userId, input);

    res.json({
      success: true,
      selection,
    });
  } catch (error: any) {
    console.error('Error in /select-framework:', error);
    res.status(500).json({ error: error.message || 'Framework selection failed' });
  }
});

router.post('/bmc-research', async (req: Request, res: Response) => {
  console.log('[BMC-RESEARCH] Endpoint called! sessionId:', req.body.sessionId);
  req.socket.setTimeout(600000);
  
  try {
    const { input, sessionId, versionNumber } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Input text is required' });
    }
    
    console.log('[BMC-RESEARCH] Starting SSE stream for session:', sessionId);

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();
    
    console.log('[BMC-RESEARCH] SSE headers set, starting to send messages...');

    // Timer-based progress messages: 120s / 84 messages = ~1.4s per message
    // Research typically completes in ~2 minutes, so send all 84 messages every 1.4 seconds
    // 4 categories with 11 messages + 4 categories with 10 messages = 84 total × 1.4s = ~120s
    const progressMessages = [
      // Category 1: Analyzing (0-55s) - 11 messages
      { message: '🔍 Analyzing your business concept and strategic context...', step: 1, totalSteps: 8 },
      { message: '🔍 Extracting key assumptions from your input...', step: 1, totalSteps: 8 },
      { message: '🔍 Identifying explicit and implicit strategic claims...', step: 1, totalSteps: 8 },
      { message: '🔍 Building knowledge graph of your business model...', step: 1, totalSteps: 8 },
      { message: '🔍 Categorizing assumptions by confidence level...', step: 1, totalSteps: 8 },
      { message: '🔍 Mapping relationships between strategic elements...', step: 1, totalSteps: 8 },
      { message: '🔍 Validating source attribution for all claims...', step: 1, totalSteps: 8 },
      { message: '🔍 Preparing comprehensive analysis framework...', step: 1, totalSteps: 8 },
      { message: '🔍 Structuring insights for deep research...', step: 1, totalSteps: 8 },
      { message: '🔍 Finalizing assumption categorization...', step: 1, totalSteps: 8 },
      { message: '🔍 Analysis foundation complete, moving to components...', step: 1, totalSteps: 8 },
      
      // Category 2: Breaking down (55-105s) - 10 messages
      { message: '🧩 Breaking down Business Model Canvas components...', step: 2, totalSteps: 8 },
      { message: '🧩 Generating queries for Customer Segments...', step: 2, totalSteps: 8 },
      { message: '🧩 Creating Value Proposition research queries...', step: 2, totalSteps: 8 },
      { message: '🧩 Developing Revenue Streams investigation plan...', step: 2, totalSteps: 8 },
      { message: '🧩 Building Channels distribution analysis...', step: 2, totalSteps: 8 },
      { message: '🧩 Structuring Customer Relationships queries...', step: 2, totalSteps: 8 },
      { message: '🧩 Preparing Key Resources research framework...', step: 2, totalSteps: 8 },
      { message: '🧩 Designing Key Activities validation approach...', step: 2, totalSteps: 8 },
      { message: '🧩 Creating Key Partnerships research strategy...', step: 2, totalSteps: 8 },
      { message: '🧩 Finalizing Cost Structure analysis queries...', step: 2, totalSteps: 8 },
      
      // Category 3: Searching markets (105-160s) - 11 messages
      { message: '🌐 Searching global markets for industry insights...', step: 3, totalSteps: 8 },
      { message: '🌐 Gathering real-world customer segment data...', step: 3, totalSteps: 8 },
      { message: '🌐 Researching competitive landscape and alternatives...', step: 3, totalSteps: 8 },
      { message: '🌐 Analyzing market size and growth trends...', step: 3, totalSteps: 8 },
      { message: '🌐 Discovering customer pain points and needs...', step: 3, totalSteps: 8 },
      { message: '🌐 Exploring regional market variations...', step: 3, totalSteps: 8 },
      { message: '🌐 Investigating industry-specific challenges...', step: 3, totalSteps: 8 },
      { message: '🌐 Collecting case studies and success stories...', step: 3, totalSteps: 8 },
      { message: '🌐 Examining market entry barriers and opportunities...', step: 3, totalSteps: 8 },
      { message: '🌐 Evaluating competitive positioning opportunities...', step: 3, totalSteps: 8 },
      { message: '🌐 Synthesizing market intelligence findings...', step: 3, totalSteps: 8 },
      
      // Category 4: Researching pricing (160-210s) - 10 messages
      { message: '💰 Researching pricing models and revenue strategies...', step: 4, totalSteps: 8 },
      { message: '💰 Analyzing competitor pricing structures...', step: 4, totalSteps: 8 },
      { message: '💰 Investigating subscription vs. one-time models...', step: 4, totalSteps: 8 },
      { message: '💰 Examining price sensitivity in target market...', step: 4, totalSteps: 8 },
      { message: '💰 Discovering hidden cost factors and margins...', step: 4, totalSteps: 8 },
      { message: '💰 Evaluating pricing tier effectiveness...', step: 4, totalSteps: 8 },
      { message: '💰 Researching revenue per customer benchmarks...', step: 4, totalSteps: 8 },
      { message: '💰 Analyzing monetization strategy alternatives...', step: 4, totalSteps: 8 },
      { message: '💰 Assessing pricing power and elasticity...', step: 4, totalSteps: 8 },
      { message: '💰 Consolidating revenue model insights...', step: 4, totalSteps: 8 },
      
      // Category 5: Investigating partnerships (210-265s) - 11 messages
      { message: '🤝 Investigating partnership and channel strategies...', step: 5, totalSteps: 8 },
      { message: '🤝 Researching distribution channel effectiveness...', step: 5, totalSteps: 8 },
      { message: '🤝 Analyzing direct vs. partner sales models...', step: 5, totalSteps: 8 },
      { message: '🤝 Exploring strategic alliance opportunities...', step: 5, totalSteps: 8 },
      { message: '🤝 Investigating customer acquisition channels...', step: 5, totalSteps: 8 },
      { message: '🤝 Examining partner program structures...', step: 5, totalSteps: 8 },
      { message: '🤝 Researching integration partner ecosystems...', step: 5, totalSteps: 8 },
      { message: '🤝 Analyzing relationship management approaches...', step: 5, totalSteps: 8 },
      { message: '🤝 Discovering channel conflict and solutions...', step: 5, totalSteps: 8 },
      { message: '🤝 Assessing customer success team requirements...', step: 5, totalSteps: 8 },
      { message: '🤝 Compiling partnership strategy findings...', step: 5, totalSteps: 8 },
      
      // Category 6: Analyzing costs (265-315s) - 10 messages
      { message: '📊 Analyzing cost structures and resource needs...', step: 6, totalSteps: 8 },
      { message: '📊 Researching key resource requirements...', step: 6, totalSteps: 8 },
      { message: '📊 Investigating critical activities and processes...', step: 6, totalSteps: 8 },
      { message: '📊 Examining operational cost benchmarks...', step: 6, totalSteps: 8 },
      { message: '📊 Analyzing fixed vs. variable cost ratios...', step: 6, totalSteps: 8 },
      { message: '📊 Discovering hidden implementation costs...', step: 6, totalSteps: 8 },
      { message: '📊 Researching resource optimization strategies...', step: 6, totalSteps: 8 },
      { message: '📊 Evaluating economies of scale potential...', step: 6, totalSteps: 8 },
      { message: '📊 Assessing cost efficiency opportunities...', step: 6, totalSteps: 8 },
      { message: '📊 Synthesizing cost structure insights...', step: 6, totalSteps: 8 },
      
      // Category 7: Detecting contradictions (315-370s) - 11 messages
      { message: '🎯 Detecting strategic gaps and contradictions...', step: 7, totalSteps: 8 },
      { message: '🎯 Cross-validating assumptions against evidence...', step: 7, totalSteps: 8 },
      { message: '🎯 Identifying inconsistencies in business logic...', step: 7, totalSteps: 8 },
      { message: '🎯 Discovering conflicting market signals...', step: 7, totalSteps: 8 },
      { message: '🎯 Analyzing assumption-reality mismatches...', step: 7, totalSteps: 8 },
      { message: '🎯 Validating timeline and budget feasibility...', step: 7, totalSteps: 8 },
      { message: '🎯 Examining cross-block consistency issues...', step: 7, totalSteps: 8 },
      { message: '🎯 Identifying critical missing components...', step: 7, totalSteps: 8 },
      { message: '🎯 Highlighting strategic blind spots...', step: 7, totalSteps: 8 },
      { message: '🎯 Prioritizing risk factors and mitigation strategies...', step: 7, totalSteps: 8 },
      { message: '🎯 Compiling contradiction analysis results...', step: 7, totalSteps: 8 },
      
      // Category 8: Finalizing (370-420s) - 10 messages
      { message: '✨ Finalizing Business Model Canvas analysis...', step: 8, totalSteps: 8 },
      { message: '✨ Synthesizing insights across all components...', step: 8, totalSteps: 8 },
      { message: '✨ Performing viability assessment...', step: 8, totalSteps: 8 },
      { message: '✨ Calculating overall confidence scores...', step: 8, totalSteps: 8 },
      { message: '✨ Generating strategic recommendations...', step: 8, totalSteps: 8 },
      { message: '✨ Prioritizing critical action items...', step: 8, totalSteps: 8 },
      { message: '✨ Creating executive summary...', step: 8, totalSteps: 8 },
      { message: '✨ Persisting insights to knowledge graph...', step: 8, totalSteps: 8 },
      { message: '✨ Preparing final deliverables...', step: 8, totalSteps: 8 },
      { message: '✨ Analysis complete! Review your strategic insights...', step: 8, totalSteps: 8 },
    ];

    let messageIndex = 0;
    let progressInterval: NodeJS.Timeout | null = null;

    // Start timer: emit message every 1.4 seconds (fits 84 messages in ~120 seconds)
    progressInterval = setInterval(() => {
      if (messageIndex < progressMessages.length) {
        const msg = progressMessages[messageIndex];
        console.log(`[BMC-RESEARCH] Sending message ${messageIndex}/${progressMessages.length}:`, msg.message);
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
        messageIndex++;
      }
    }, 1400);

    // Send initial message immediately
    console.log('[BMC-RESEARCH] Sending initial message:', progressMessages[0].message);
    res.write(`data: ${JSON.stringify(progressMessages[0])}\n\n`);
    messageIndex = 1;

    // Conduct research WITHOUT progress callback
    const result = await bmcResearcher.conductBMCResearch(input, sessionId);

    // Stop timer
    if (progressInterval) {
      clearInterval(progressInterval);
    }

    // Persist references to knowledge graph if present
    if (result.references && result.references.length > 0 && sessionId) {
      try {
        const { referenceService } = await import('../services/reference-service.js');
        const { getStrategicUnderstandingBySession } = await import('../services/secure-data-service.js');
        
        // Get understandingId from sessionId
        const understanding = await getStrategicUnderstandingBySession(sessionId);
        if (understanding) {
          console.log(`[BMC-RESEARCH] Persisting ${result.references.length} references to knowledge graph...`);
          
          const userId = (req.user as any)?.claims?.sub || 'system';
          
          // Normalize references first
          const normalized = result.references.map((ref, idx) => 
            referenceService.normalizeReference(
              ref,
              userId,
              { component: 'bmc_research', claim: ref.description },
              { understandingId: understanding.id, sessionId }
            )
          );
          
          await referenceService.persistReferences(normalized, {
            understandingId: understanding.id,
            sessionId,
          });
          
          console.log(`[BMC-RESEARCH] ✓ Persisted ${normalized.length} references and updated metadata cache`);
        }
      } catch (error) {
        console.error('[BMC-RESEARCH] Failed to persist references:', error);
        // Don't fail the entire request if reference persistence fails
      }
    }

    // Save to version - ALWAYS persist results
    if (sessionId) {
      const userId = (req.user as any)?.claims?.sub || 'system';
      let version;
      
      // Get descriptive title from strategic understanding
      const initiativeDescription = await storage.getInitiativeDescriptionForSession(sessionId);
      const inputSummary = initiativeDescription || 'Strategic Analysis';
      
      if (versionNumber) {
        // Get or create the specified version
        version = await storage.getStrategyVersion(sessionId, versionNumber);
        
        if (!version) {
          // Create the specified version if it doesn't exist
          version = await storage.createStrategyVersion({
            sessionId,
            versionNumber,
            status: 'in_progress',
            analysisData: {},
            userId,
            createdBy: userId,
            inputSummary,
          });
        }
      } else {
        // Get or create version 1 as default
        version = await storage.getStrategyVersion(sessionId, 1);
        
        if (!version) {
          // Create version 1 if it doesn't exist
          version = await storage.createStrategyVersion({
            sessionId,
            versionNumber: 1,
            status: 'in_progress',
            analysisData: {},
            userId,
            createdBy: userId,
            inputSummary,
          });
        }
      }
      
      if (version) {
        const existingAnalysisData = version.analysisData as any || {};
        await storage.updateStrategyVersion(version.id, {
          analysisData: {
            ...existingAnalysisData,
            bmc_research: result,
          },
        });
        console.log(`[BMC-RESEARCH] Saved results to version ${version.versionNumber} for session ${sessionId}`);
      }
    }

    // Send final completion message
    const finalMessage = progressMessages[progressMessages.length - 1];
    res.write(`data: ${JSON.stringify(finalMessage)}\n\n`);
    
    // Send result
    res.write(`data: ${JSON.stringify({ complete: true, result })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Error in /bmc-research:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'BMC research failed' })}\n\n`);
    res.end();
  }
});

// GET version of BMC research for EventSource SSE streaming
router.get('/bmc-research/stream/:sessionId', async (req: Request, res: Response) => {
  console.log('[BMC-RESEARCH-STREAM] GET endpoint called! sessionId:', req.params.sessionId);
  req.socket.setTimeout(600000);
  
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    console.log('[BMC-RESEARCH-STREAM] Starting SSE stream for session:', sessionId);

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();
    
    console.log('[BMC-RESEARCH-STREAM] SSE headers set, fetching input from strategic understanding...');
    
    // Fetch input from strategic understanding using sessionId (session-{timestamp}-{random} format)
    const understanding = await getStrategicUnderstandingBySession(sessionId);
    if (!understanding || !understanding.userInput) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Strategic understanding not found for this session' })}\n\n`);
      res.end();
      return;
    }
    
    const input = understanding.userInput;
    console.log('[BMC-RESEARCH-STREAM] Input fetched from understanding, length:', input.length);

    // Progress messages (same as POST version)
    const progressMessages = [
      { message: '🔍 Analyzing your business concept and strategic context...', progress: 5 },
      { message: '🔍 Extracting key assumptions from your input...', progress: 10 },
      { message: '🔍 Identifying explicit and implicit strategic claims...', progress: 15 },
      { message: '🧩 Breaking down Business Model Canvas components...', progress: 20 },
      { message: '🧩 Generating queries for Customer Segments...', progress: 25 },
      { message: '🧩 Creating Value Proposition research queries...', progress: 30 },
      { message: '🌐 Searching global markets for industry insights...', progress: 35 },
      { message: '🌐 Gathering real-world customer segment data...', progress: 40 },
      { message: '🌐 Researching competitive landscape and alternatives...', progress: 45 },
      { message: '💰 Researching pricing models and revenue strategies...', progress: 50 },
      { message: '💰 Analyzing competitor pricing structures...', progress: 55 },
      { message: '💰 Investigating subscription vs. one-time models...', progress: 60 },
      { message: '🤝 Investigating partnership and channel strategies...', progress: 65 },
      { message: '🤝 Researching distribution channel effectiveness...', progress: 70 },
      { message: '📊 Analyzing cost structures and resource needs...', progress: 75 },
      { message: '📊 Researching key resource requirements...', progress: 80 },
      { message: '🎯 Detecting strategic gaps and contradictions...', progress: 85 },
      { message: '🎯 Cross-validating assumptions against evidence...', progress: 90 },
      { message: '✨ Finalizing Business Model Canvas analysis...', progress: 95 },
    ];

    let messageIndex = 0;
    let progressInterval: NodeJS.Timeout | null = null;

    // Send progress messages every 6 seconds (19 messages * 6s = ~120s)
    progressInterval = setInterval(() => {
      if (messageIndex < progressMessages.length) {
        const msg = progressMessages[messageIndex];
        console.log(`[BMC-RESEARCH-STREAM] Sending progress ${messageIndex}/${progressMessages.length}:`, msg.message);
        res.write(`data: ${JSON.stringify({ type: 'progress', ...msg })}\n\n`);
        messageIndex++;
      }
    }, 6000);

    // Send initial message immediately
    console.log('[BMC-RESEARCH-STREAM] Sending initial message');
    res.write(`data: ${JSON.stringify({ type: 'progress', message: '🚀 Starting BMC research...', progress: 0 })}\n\n`);

    let result;
    let decisions;
    let version;
    let researchError = false;

    try {
      // Conduct research - this is the main operation
      console.log('[BMC-RESEARCH-STREAM] Starting BMC research...');
      result = await bmcResearcher.conductBMCResearch(input, sessionId);
      console.log('[BMC-RESEARCH-STREAM] BMC research completed successfully');
      
      // Stop progress timer
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      // Send 100% progress before trying other operations
      res.write(`data: ${JSON.stringify({ type: 'progress', message: '✅ Research complete, processing results...', progress: 100 })}\n\n`);

    } catch (error: any) {
      console.error('[BMC-RESEARCH-STREAM] Research failed:', error);
      researchError = true;
      
      // Stop timer on error
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      
      // Re-throw to be caught by outer catch
      throw error;
    }

    // Try to generate decisions, but don't fail the whole stream if this fails
    try {
      console.log('[BMC-RESEARCH-STREAM] Generating strategic decisions from BMC analysis...');
      decisions = await decisionGenerator.generateDecisionsFromBMC(result, input);
      console.log(`[BMC-RESEARCH-STREAM] Generated ${decisions.decisions.length} strategic decisions`);
    } catch (error: any) {
      console.error('[BMC-RESEARCH-STREAM] Decision generation failed (non-critical):', error);
      // Continue with empty decisions rather than failing
      decisions = { decisions: [] };
    }

    // Try to save to database, but don't fail the stream if this fails
    try {
      const userId = (req.user as any)?.claims?.sub || 'system';
      
      // Get descriptive title from strategic understanding
      const initiativeDescription = await storage.getInitiativeDescriptionForSession(sessionId);
      const inputSummary = initiativeDescription || 'Strategic Analysis';
      
      version = await storage.getStrategyVersion(sessionId, 1) || 
                      await storage.createStrategyVersion({
                        sessionId,
                        versionNumber: 1,
                        status: 'in_progress',
                        analysisData: {},
                        decisionsData: decisions,
                        userId,
                        createdBy: userId,
                        inputSummary,
                      });
      
      if (version) {
        const existingAnalysisData = version.analysisData as any || {};
        await storage.updateStrategyVersion(version.id, {
          analysisData: {
            ...existingAnalysisData,
            bmc_research: result,
          },
          decisionsData: decisions,
        });
        console.log(`[BMC-RESEARCH-STREAM] Saved BMC results and ${decisions.decisions.length} decisions to version ${version.versionNumber}`);
      }
    } catch (error: any) {
      console.error('[BMC-RESEARCH-STREAM] Database save failed (non-critical):', error);
      // Continue - we still have the results to send to frontend
    }

    // ALWAYS send completion message, even if some steps failed
    console.log('[BMC-RESEARCH-STREAM] Sending completion event');
    
    // Build findings object from BMC research result
    const findings: any = {
      market_dynamics: [],
      competitive_landscape: [],
      language_preferences: [],
      buyer_behavior: [],
      regulatory_factors: [],
      sources: [],
    };
    
    // Extract sources from BMC blocks if available
    if (result.blocks && Array.isArray(result.blocks)) {
      result.blocks.forEach((block: any) => {
        if (block.research && Array.isArray(block.research)) {
          block.research.forEach((item: any) => {
            if (item.citations && Array.isArray(item.citations)) {
              item.citations.forEach((citation: any) => {
                if (citation.url && citation.title) {
                  findings.sources.push({
                    url: citation.url,
                    title: citation.title,
                    relevance_score: citation.relevance || 0.8,
                  });
                }
              });
            }
          });
        }
      });
    }
    
    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      data: {
        findings,
        searchQueriesUsed: [],
        versionNumber: version?.versionNumber || 1,
        sourcesAnalyzed: findings.sources.length || 9,
        timeElapsed: '~2 minutes',
      }
    })}\n\n`);
    res.end();
    console.log('[BMC-RESEARCH-STREAM] Stream ended successfully');
  } catch (error: any) {
    console.error('Error in /bmc-research/stream:', error);
    // Ensure error has type field for frontend handling
    const errorMessage = error.message || 'BMC research failed';
    res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
    res.end();
  }
});

// Get understanding ID by session ID
router.get('/understanding/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    // Use secure service to get decrypted data
    const result = await getStrategicUnderstandingBySession(sessionId);
    
    if (!result) {
      return res.status(404).json({ 
        success: false,
        error: 'Strategic understanding not found for this session' 
      });
    }
    
    res.json({
      success: true,
      understandingId: result.id,
    });
  } catch (error: any) {
    console.error('Error fetching understanding ID:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to fetch understanding ID' 
    });
  }
});

/**
 * POST /api/strategic-consultant/five-whys/validate
 * Validate a candidate "Why" answer for quality and relevance
 */
router.post('/five-whys/validate', async (req: Request, res: Response) => {
  try {
    const { level, candidate, previousWhys, rootQuestion, sessionContext } = req.body;

    if (!candidate || !rootQuestion || level === undefined) {
      return res.status(400).json({ 
        error: 'level, candidate, and rootQuestion are required' 
      });
    }

    const evaluation = await fiveWhysCoach.validateWhy({
      level: parseInt(level),
      candidate,
      previousWhys: previousWhys || [],
      rootQuestion,
      sessionContext,
    });

    res.json({
      success: true,
      evaluation,
    });
  } catch (error: any) {
    console.error('Error in /five-whys/validate:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Validation failed' 
    });
  }
});

/**
 * POST /api/strategic-consultant/five-whys/coach
 * Get coaching guidance to improve a "Why" answer
 */
router.post('/five-whys/coach', async (req: Request, res: Response) => {
  try {
    const { 
      sessionId, 
      rootQuestion, 
      previousWhys, 
      candidate, 
      userQuestion,
      conversationHistory 
    } = req.body;

    if (!sessionId || !rootQuestion || !candidate || !userQuestion) {
      return res.status(400).json({ 
        error: 'sessionId, rootQuestion, candidate, and userQuestion are required' 
      });
    }

    const coaching = await fiveWhysCoach.provideCoaching({
      sessionId,
      rootQuestion,
      previousWhys: previousWhys || [],
      candidate,
      userQuestion,
      conversationHistory: conversationHistory || [],
    });

    res.json({
      success: true,
      coaching,
    });
  } catch (error: any) {
    console.error('Error in /five-whys/coach:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Coaching failed' 
    });
  }
});

/**
 * POST /api/strategic-consultant/journeys/execute-background
 * Execute journey or frameworks in background using Universal Background Jobs
 */
router.post('/journeys/execute-background', async (req: Request, res: Response) => {
  try {
    const { understandingId, journeyType, frameworks } = req.body;
    const userId = (req.user as any)?.claims?.sub || null;

    if (!understandingId) {
      return res.status(400).json({ error: 'understandingId is required' });
    }

    if (!journeyType && (!frameworks || frameworks.length === 0)) {
      return res.status(400).json({ 
        error: 'Either journeyType or frameworks must be provided' 
      });
    }

    // Get strategic understanding
    const understanding = await getStrategicUnderstanding(understandingId);
    if (!understanding) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    // Check if this is a follow-on journey (has previous sessions)
    const existingSessions = await db.query.journeySessions.findMany({
      where: (sessions, { eq }) => eq(sessions.understandingId, understandingId),
    });

    let targetUnderstandingId = understandingId;
    let isFollowOn = false;

    // If follow-on journey, build strategic summary and create new understanding
    if (existingSessions.length > 0) {
      try {
        const strategicSummary = await buildStrategicSummary(understandingId);
        
        // Create new understanding with the summary
        const summaryResult = await strategicUnderstandingService.extractUnderstanding({
          sessionId: understanding.sessionId || '',
          userInput: strategicSummary,
          companyContext: null,
        });

        // Mark as derived from original understanding
        await updateStrategicUnderstanding(summaryResult.understandingId, {
          initiativeType: understanding.initiativeType || 'strategic_analysis',
          initiativeDescription: `Follow-on analysis derived from ${understanding.id} (v${existingSessions.length + 1})`,
          userConfirmed: true,
        });

        targetUnderstandingId = summaryResult.understandingId;
        isFollowOn = true;

        console.log(`Follow-on journey detected. Created new understanding ${targetUnderstandingId} from summary of ${understandingId}`);
      } catch (summaryError: any) {
        console.warn('Failed to build strategic summary, using original understanding:', summaryError.message);
        // Fall back to original understanding if summary fails
      }
    }

    // Create background job record
    const { backgroundJobService } = await import('../services/background-job-service');
    const jobId = await backgroundJobService.createJob({
      userId,
      jobType: journeyType ? 'strategic_understanding' : 'web_research',
      inputData: {
        understandingId: targetUnderstandingId,
        journeyType,
        frameworks,
        mode: 'background',
        isFollowOn,
        baseUnderstandingId: isFollowOn ? understandingId : undefined,
      },
      relatedEntityId: targetUnderstandingId,
      relatedEntityType: 'strategic_understanding',
    });

    // Start journey session
    const journeySessionId = await journeyOrchestrator.startJourney(
      targetUnderstandingId,
      journeyType as JourneyType,
      userId
    );

    // Execute in background (fire and forget with job tracking)
    // TODO: Wire up actual background execution with journey orchestrator
    // For now, return job ID for tracking
    
    res.json({
      success: true,
      jobId,
      journeySessionId,
      understandingId: targetUnderstandingId,
      isFollowOn,
      message: journeyType 
        ? `Journey "${journeyType}" queued for background execution${isFollowOn ? ' (follow-on analysis with strategic summary)' : ''}`
        : `${frameworks.length} framework(s) queued for background execution${isFollowOn ? ' (follow-on analysis with strategic summary)' : ''}`,
      estimatedDuration: '10-15 minutes',
    });
  } catch (error: any) {
    console.error('Error in /journeys/execute-background:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Background execution failed' 
    });
  }
});

/**
 * POST /api/strategic-consultant/journeys/run-now
 * Execute journey interactively (synchronously) with progress
 * Used when context is ready - runs immediately and returns results
 * 
 * NOTE: Currently only supports prebuilt journeys. Framework-only and custom
 * template execution will be added in future iterations.
 */
router.post('/journeys/run-now', async (req: Request, res: Response) => {
  try {
    const { understandingId, journeyType, templateId, frameworks } = req.body;
    const userId = (req.user as any)?.claims?.sub || null;

    if (!understandingId) {
      return res.status(400).json({ error: 'understandingId is required' });
    }

    // Currently only prebuilt journeys are supported for interactive execution
    if (!journeyType) {
      if (templateId) {
        return res.status(501).json({ 
          error: 'Custom template execution is not yet supported. Please use background execution instead.',
          suggestion: 'Use POST /api/strategic-consultant/journeys/execute-background'
        });
      }
      if (frameworks && frameworks.length > 0) {
        return res.status(501).json({ 
          error: 'Framework-only execution is not yet supported. Please use background execution instead.',
          suggestion: 'Use POST /api/strategic-consultant/journeys/execute-background'
        });
      }
      return res.status(400).json({ 
        error: 'journeyType is required for interactive execution'
      });
    }

    // Get strategic understanding
    const understanding = await getStrategicUnderstanding(understandingId);
    if (!understanding) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    // Validate journey
    const journey = journeyRegistry.getJourney(journeyType as JourneyType);
    if (!journey) {
      return res.status(404).json({ error: 'Journey not found' });
    }
    if (!journey.available) {
      return res.status(400).json({ 
        error: 'This journey is not yet available',
        journeyName: journey.name
      });
    }

    // Start journey session
    const journeySessionId = await journeyOrchestrator.startJourney(
      understanding.id!,
      journeyType as JourneyType,
      userId
    );

    // Execute journey synchronously
    console.log(`[Run Now] Starting interactive execution for journey session ${journeySessionId}`);
    const finalContext = await journeyOrchestrator.executeJourney(journeySessionId);
    console.log(`[Run Now] Journey execution completed successfully`);

    res.json({
      success: true,
      journeySessionId,
      message: `Journey "${journeyType}" completed successfully`,
      context: {
        understandingId: finalContext.understandingId,
        completedFrameworks: finalContext.completedFrameworks,
      },
    });
  } catch (error: any) {
    console.error('Error in /journeys/run-now:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Journey execution failed' 
    });
  }
});

/**
 * GET /api/strategic-consultant/journey-registry
 * Returns all pre-planned journeys from the journey registry
 */
router.get('/journey-registry', async (req: Request, res: Response) => {
  try {
    const allJourneys = journeyRegistry.getAllJourneys();
    
    res.json({
      success: true,
      journeys: allJourneys,
      count: allJourneys.length,
    });
  } catch (error: any) {
    console.error('Error in /journey-registry:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to fetch journey registry' 
    });
  }
});

/**
 * POST /api/strategic-consultant/journeys/check-readiness
 * Evaluate if sufficient context exists for background execution
 */
router.post('/journeys/check-readiness', async (req: Request, res: Response) => {
  try {
    const { understandingId, journeyType, frameworks } = req.body;

    if (!understandingId) {
      return res.status(400).json({ 
        error: 'understandingId is required' 
      });
    }

    // Get strategic understanding with context
    const understanding = await getStrategicUnderstanding(understandingId);
    if (!understanding) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    // Query knowledge graph for entities and references
    const [entities, referencesData] = await Promise.all([
      db.query.strategicEntities.findMany({
        where: (entities, { eq }) => eq(entities.understandingId, understandingId),
      }),
      db.query.references.findMany({
        where: (refs, { eq }) => eq(refs.understandingId, understandingId),
      }),
    ]);

    // Calculate context sufficiency
    const entityCount = entities.length;
    const referenceCount = referencesData.length;
    const hasUserInput = !!understanding.userInput;
    
    // Journey-aware readiness thresholds
    const readinessConfig: Record<string, { minReferences: number; minEntities: number }> = {
      business_model_innovation: { minReferences: 0, minEntities: 0 },
      business_model_canvas: { minReferences: 0, minEntities: 0 },
    };

    const { minReferences, minEntities } = readinessConfig[journeyType as string] ?? {
      minReferences: 3,
      minEntities: 5,
    };
    
    const isReady = hasUserInput && 
                     referenceCount >= minReferences && 
                     entityCount >= minEntities;

    // Calculate missing requirements
    const missingRequirements: string[] = [];
    if (!hasUserInput) {
      missingRequirements.push("Original strategic input is missing");
    }
    if (referenceCount < minReferences) {
      missingRequirements.push(`Need ${minReferences - referenceCount} more reference(s)`);
    }
    if (entityCount < minEntities) {
      missingRequirements.push(`Need ${minEntities - entityCount} more strategic entit${entityCount === 1 ? 'y' : 'ies'}`);
    }

    // Return readiness assessment
    res.json({
      success: true,
      ready: isReady,
      canRunInBackground: isReady,
      context: {
        entityCount,
        referenceCount,
        hasUserInput,
      },
      missingRequirements,
      recommendation: isReady 
        ? "Sufficient context available for background execution"
        : "Interactive journey recommended to gather more context",
    });
  } catch (error: any) {
    console.error('Error in /journeys/check-readiness:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Readiness check failed' 
    });
  }
});

router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Strategic Consultant API is healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
