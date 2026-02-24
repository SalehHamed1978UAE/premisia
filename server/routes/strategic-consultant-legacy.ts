import { Router, Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { InputProcessor } from '../strategic-consultant-legacy/input-processor';
import { StrategyAnalyzer } from '../strategic-consultant-legacy/strategy-analyzer';
import { DecisionGenerator } from '../strategic-consultant-legacy/decision-generator';
import { VersionManager } from '../strategic-consultant-legacy/version-manager';
import { EPMConverter } from '../strategic-consultant-legacy/epm-converter';
import { EPMIntegrator } from '../strategic-consultant-legacy/epm-integrator';
import { epmAdapter } from '../strategic-consultant-v2/epm-adapter';
import { WhysTreeGenerator } from '../strategic-consultant-legacy/whys-tree-generator';
import { MarketResearcher } from '../strategic-consultant-legacy/market-researcher';
import { FrameworkSelector } from '../strategic-consultant-legacy/framework-selector';
import { BMCResearcher } from '../strategic-consultant-legacy/bmc-researcher';
import { storage } from '../storage';
import { unlink } from 'fs/promises';
import { refreshTokenProactively } from '../supabaseAuth';
import { db } from '../db';
import { strategicUnderstanding, journeySessions, strategyVersions, epmPrograms, bmcAnalyses, strategicEntities, strategicRelationships, frameworkInsights } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { strategicUnderstandingService } from '../strategic-understanding-service';
import { JourneyOrchestrator } from '../journey/journey-orchestrator';
import { journeyRegistry } from '../journey/journey-registry';
import type { JourneyType } from '@shared/journey-types';
import { InitiativeClassifier } from '../strategic-consultant-legacy/initiative-classifier';
import { isJourneyRegistryV2Enabled, isKnowledgeGraphEnabled } from '../config';
import { ambiguityDetector } from '../services/ambiguity-detector.js';
import { locationResolver } from '../services/location-resolver.js';
import { getStrategicUnderstanding, getStrategicUnderstandingBySession, updateStrategicUnderstanding, getJourneySession, getJourneySessionByUnderstandingSessionId } from '../services/secure-data-service';
import { fiveWhysCoach } from '../services/five-whys-coach.js';
import { buildStrategicSummary } from '../services/strategic-summary-builder';
import { referenceService } from '../services/reference-service';
import { journeySummaryService } from '../services/journey-summary-service';
import { decryptKMS } from '../utils/kms-encryption';
import { buildLinearWhysTree, normalizeWhysPathSteps, whysPathToText } from '../utils/whys-path';
import { deriveConstraintMode, normalizeConstraintMode } from '../intelligence/epm/constraint-policy';
import { extractUserConstraintsFromText } from '../intelligence/epm/constraint-utils';

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
const shouldBlockClarificationConflicts = () => process.env.CLARIFICATION_CONFLICTS_BLOCK === 'true';

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
 * Integrates geographic disambiguation using OpenStreetMap Nominatim API
 */
router.post('/check-ambiguities', async (req: Request, res: Response) => {
  try {
    const { userInput, journeyType } = req.body;

    if (!userInput) {
      return res.status(400).json({ error: 'userInput is required' });
    }

    const textForLocationCheck = typeof userInput === 'string' ? userInput : (userInput.text || '');
    const fullInputForAmbiguity = typeof userInput === 'string' ? userInput : (userInput.fullInput || userInput.text || userInput);

    console.log('[Ambiguity Check] Running location resolution and ambiguity detection in parallel...', { journeyType: journeyType || 'not specified' });
    
    const locationPromise = (async () => {
      try {
        const locationResult = await locationResolver.resolveAll(textForLocationCheck);
        for (const location of locationResult.autoResolved) {
          await storage.createLocation({
            rawQuery: location.rawQuery,
            displayName: location.displayName,
            lat: location.lat.toString(),
            lon: location.lon.toString(),
            countryCode: location.countryCode,
            adminLevels: location.adminLevels,
          });
          console.log(`[Ambiguity Check] Auto-resolved location: ${location.rawQuery} → ${location.displayName}`);
        }
        return locationResult;
      } catch (locationError: any) {
        console.warn('[Ambiguity Check] Geographic resolution failed, continuing without location data:', locationError.message);
        return { autoResolved: [], questions: [] };
      }
    })();

    const ambiguityPromise = ambiguityDetector.detectAmbiguities(fullInputForAmbiguity, [], journeyType || undefined);

    const [locationResult, aiResult] = await Promise.all([locationPromise, ambiguityPromise]);

    const mergedQuestions = [...(locationResult.questions || []), ...(aiResult.questions || [])];
    const result = {
      hasAmbiguities: mergedQuestions.length > 0,
      questions: mergedQuestions,
      reasoning: aiResult.reasoning || 'Questions require clarification',
    };
    
    console.log(`[Ambiguity Check] ✓ Complete: ${mergedQuestions.length} questions (${locationResult.questions?.length || 0} location, ${aiResult.questions?.length || 0} AI)`);
    res.json(result);
  } catch (error: any) {
    console.error('[Strategic Consultant] Error checking ambiguities:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/strategic-consultant/validate-manual-location
 * Validate user-provided manual location entry
 */
router.post('/validate-manual-location', async (req: Request, res: Response) => {
  try {
    const { userInput } = req.body;

    if (!userInput || typeof userInput !== 'string' || !userInput.trim()) {
      return res.status(400).json({ error: 'userInput is required and must be a non-empty string' });
    }

    console.log(`[Manual Location Validation] Validating user input: "${userInput}"`);
    
    // Use LocationResolver to geocode the manual entry
    const locations = await locationResolver.extractAndResolveLocations(userInput);
    
    if (locations.length > 0) {
      console.log(`[Manual Location Validation] Found ${locations.length} validated location(s)`);
      res.json({
        validated: true,
        suggestions: locations,
        originalInput: userInput
      });
    } else {
      console.log(`[Manual Location Validation] No locations found, allowing unvalidated entry`);
      res.json({
        validated: false,
        originalInput: userInput
      });
    }
  } catch (error: any) {
    console.error('[Manual Location Validation] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/understanding', async (req: Request, res: Response) => {
  try {
    const { input, clarifications, fileMetadata, budgetConstraint, constraintMode } = req.body;

    if (!input || !input.trim()) {
      return res.status(400).json({ error: 'Input text is required' });
    }

    const parseConstraintNumber = (value: unknown): number | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      if (typeof value === 'number') {
        if (!Number.isFinite(value) || value <= 0) return undefined;
        return Math.round(value);
      }
      if (typeof value === 'string') {
        const normalized = value.replace(/[$,\s]/g, '');
        if (!normalized) return undefined;
        const parsed = Number(normalized);
        if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
        return Math.round(parsed);
      }
      return undefined;
    };

    let normalizedBudgetConstraint: { amount?: number; timeline?: number } | null = null;
    if (budgetConstraint !== undefined && budgetConstraint !== null) {
      if (typeof budgetConstraint !== 'object' || Array.isArray(budgetConstraint)) {
        return res.status(400).json({
          error: 'budgetConstraint must be an object with optional amount and timeline fields',
        });
      }

      const amount = parseConstraintNumber((budgetConstraint as any).amount);
      const timeline = parseConstraintNumber((budgetConstraint as any).timeline);

      if ((budgetConstraint as any).amount !== undefined && amount === undefined) {
        return res.status(400).json({ error: 'budgetConstraint.amount must be a positive number' });
      }
      if ((budgetConstraint as any).timeline !== undefined && timeline === undefined) {
        return res.status(400).json({ error: 'budgetConstraint.timeline must be a positive number' });
      }

      normalizedBudgetConstraint = {};
      if (amount !== undefined) normalizedBudgetConstraint.amount = amount;
      if (timeline !== undefined) normalizedBudgetConstraint.timeline = timeline;

      if (Object.keys(normalizedBudgetConstraint).length === 0) {
        normalizedBudgetConstraint = null;
      }
    }

    // Infer explicit budget/timeline constraints from free text when present.
    const inferredFromText = extractUserConstraintsFromText(input.trim());
    let inferredConstraintApplied = false;
    if (inferredFromText.budget || inferredFromText.timeline) {
      const merged = { ...(normalizedBudgetConstraint || {}) } as { amount?: number; timeline?: number };
      if (merged.amount === undefined && inferredFromText.budget?.max) {
        merged.amount = inferredFromText.budget.max;
        inferredConstraintApplied = true;
      }
      if (merged.timeline === undefined && inferredFromText.timeline?.max) {
        merged.timeline = inferredFromText.timeline.max;
        inferredConstraintApplied = true;
      }
      normalizedBudgetConstraint = Object.keys(merged).length > 0 ? merged : null;
    }

    const requestedConstraintMode = normalizeConstraintMode(constraintMode);
    if (constraintMode !== undefined && requestedConstraintMode === undefined) {
      return res.status(400).json({
        error: 'constraintMode must be one of: auto, discovery, constrained',
      });
    }
    const hasExplicitConstraint = Boolean(
      normalizedBudgetConstraint?.amount || normalizedBudgetConstraint?.timeline
    );
    const effectiveConstraintMode = deriveConstraintMode(requestedConstraintMode, hasExplicitConstraint);

    // If clarifications provided, incorporate them into the input + detect conflicts
    const clarificationResult = clarifications
      ? ambiguityDetector.buildClarifiedInputWithConflicts(input.trim(), clarifications)
      : { clarifiedInput: input.trim(), conflicts: [] };

    if (clarificationResult.conflicts.length > 0 && shouldBlockClarificationConflicts()) {
      return res.status(409).json({
        error: 'Clarification conflicts detected',
        conflicts: clarificationResult.conflicts,
      });
    }

    const finalInput = clarificationResult.clarifiedInput;

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
      budgetConstraint: normalizedBudgetConstraint,
    });

    if (clarificationResult.conflicts.length > 0 || requestedConstraintMode !== undefined || hasExplicitConstraint) {
      const [existingMeta] = await db.select({ strategyMetadata: strategicUnderstanding.strategyMetadata })
        .from(strategicUnderstanding)
        .where(eq(strategicUnderstanding.id, result.understandingId))
        .limit(1);

      const baseMetadata = (existingMeta?.strategyMetadata && typeof existingMeta.strategyMetadata === 'object')
        ? existingMeta.strategyMetadata as Record<string, any>
        : {};

      const updatedMetadata: Record<string, any> = {
        ...baseMetadata,
      };

      if (requestedConstraintMode !== undefined || hasExplicitConstraint) {
        updatedMetadata.constraintPolicy = {
          mode: effectiveConstraintMode,
          source: inferredConstraintApplied ? 'strategic-input-inferred' : 'strategic-input',
          updatedAt: new Date().toISOString(),
          hasExplicitConstraint,
          inferredConstraintApplied,
        };
      }

      if (clarificationResult.conflicts.length > 0) {
        updatedMetadata.clarificationConflicts = clarificationResult.conflicts;
        updatedMetadata.requiresApproval = {
          ...(baseMetadata.requiresApproval || {}),
          clarifications: true,
        };
      }

      await db.update(strategicUnderstanding)
        .set({
          strategyMetadata: updatedMetadata,
          updatedAt: new Date(),
        })
        .where(eq(strategicUnderstanding.id, result.understandingId));
    }

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

// GET /api/strategic-consultant/journey-sessions/:sessionId
// Fetch journey session by UUID
router.get('/journey-sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Use secure service to get decrypted journey session data
    const session = await getJourneySession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Journey session not found' });
    }

    res.json({
      id: session.id,
      understandingId: session.understandingId,
      journeyType: session.journeyType,
      currentFrameworkIndex: session.currentFrameworkIndex,
      completedFrameworks: session.completedFrameworks,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error: any) {
    console.error('Error in /journey-sessions/:sessionId:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch journey session' });
  }
});

// GET /api/strategic-consultant/journey-sessions/by-session/:sessionId
// Fetch journey session by understanding sessionId (session-xxx format)
router.get('/journey-sessions/by-session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Use secure service to get decrypted journey session data
    const session = await getJourneySessionByUnderstandingSessionId(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Journey session not found' });
    }

    // Get the journey definition to include pageSequence for dynamic navigation
    let pageSequence: string[] = [];
    let frameworks: string[] = [];
    if (session.journeyType) {
      const journeyDef = journeyRegistry.getJourney(session.journeyType as JourneyType);
      if (journeyDef) {
        pageSequence = journeyDef.pageSequence || [];
        frameworks = journeyDef.frameworks || [];
      }
    }

    res.json({
      id: session.id,
      understandingId: session.understandingId,
      journeyType: session.journeyType,
      currentFrameworkIndex: session.currentFrameworkIndex,
      completedFrameworks: session.completedFrameworks,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      pageSequence,  // Added for dynamic navigation
      frameworks,    // Added for dynamic navigation
    });
  } catch (error: any) {
    console.error('Error in /journey-sessions/by-session/:sessionId:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch journey session' });
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

    // Create journey session to track progress and get version number
    const { journeySessionId, versionNumber } = await journeyOrchestrator.startJourney(
      understanding.id!,
      journeyType as JourneyType,
      userId
    );

    // Return the first actual journey page (skip input page at index 0)
    const firstPage = (journey as any).pageSequence?.[1] || '/strategic-consultant/whys-tree/:understandingId';
    console.log(`[JourneyExecute] journeyType=${journeyType}, pageSequence[1]=${firstPage}`);
    const navigationUrl = firstPage
      .replace(':understandingId', understandingId)
      .replace(':sessionId', understanding.sessionId)
      .replace(':versionNumber', String(versionNumber));
    console.log(`[JourneyExecute] Final navigationUrl=${navigationUrl}`);

    res.json({
      success: true,
      journeySessionId,
      sessionId: understanding.sessionId, // Session ID used in navigation URLs
      versionNumber, // Version number for this journey session
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

// Execute a specific journey session (for custom/wizard journeys)
router.post('/journeys/:sessionId/execute', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Fetch journey session to verify it exists
    const journeySession = await getJourneySession(sessionId);

    if (!journeySession) {
      return res.status(404).json({ error: 'Journey session not found' });
    }

    // Execute the journey in background (don't block the response)
    console.log(`[Journey API] Triggering execution for session: ${sessionId}`);
    
    // Execute asynchronously
    journeyOrchestrator.executeJourney(sessionId, (progress) => {
      console.log(`[Journey Progress] ${sessionId}: ${progress.status} (${progress.percentComplete}%)`);
    }).then(() => {
      console.log(`[Journey API] ✓ Journey ${sessionId} completed successfully`);
    }).catch((error) => {
      console.error(`[Journey API] ✗ Journey ${sessionId} failed:`, error.message);
    });

    res.json({
      success: true,
      message: 'Journey execution started',
      sessionId,
      status: 'in_progress',
    });
  } catch (error: any) {
    console.error('Error in /journeys/:sessionId/execute:', error);
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
      metadata: journeySession.metadata, // Custom journey metadata (frameworks, templateId)
    });
  } catch (error: any) {
    console.error('Error in /journeys/:sessionId/results:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch journey results' });
  }
});

router.post('/journeys/summary', async (req: Request, res: Response) => {
  try {
    const { understandingId, journeyType } = req.body;

    if (!understandingId || !journeyType) {
      return res.status(400).json({ 
        error: 'Both understandingId and journeyType are required' 
      });
    }

    // If Journey Registry V2 is disabled, return empty summary
    if (!isJourneyRegistryV2Enabled()) {
      console.log('[Strategic Consultant] Journey Registry V2 disabled, returning empty summary');
      return res.json({ success: true, summary: null });
    }

    const summary = await journeySummaryService.getLatestSummary(understandingId, journeyType as JourneyType);

    if (!summary) {
      return res.json({ success: true, summary: null });
    }

    res.json({
      success: true,
      summary: {
        completedAt: summary.completedAt,
        versionNumber: summary.versionNumber,
        keyInsights: summary.keyInsights.slice(0, 3),
        strategicImplications: summary.strategicImplications.slice(0, 2),
      },
    });
  } catch (error: any) {
    console.error('Error in /journeys/summary:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch journey summary' });
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

    console.log(`[Decisions] Saved decisions for session ${sessionId} v${versionNumber}. Frontend will auto-trigger EPM conversion.`);

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
    const { sessionId, versionNumber, useLegacyEngine } = req.body;
    const userId = (req as any).user?.claims?.sub;

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

    let program: any;
    let engineUsed: 'v2' | 'legacy';

    const useV2Engine = !useLegacyEngine && process.env.USE_EPM_V2_ENGINE !== 'false';
    
    if (useV2Engine) {
      console.log('[convert-to-epm] Using V2 EPM engine (EPMSynthesizer via Journey Builder)');
      engineUsed = 'v2';
      
      try {
        program = await epmAdapter.convertToEPM({
          analysisData: version.analysisData as any,
          decisionsData: version.decisionsData as any,
          selectedDecisions: version.selectedDecisions as Record<string, string>,
          sessionId,
          versionNumber,
          userId,
          // Sprint 6.1: Pass DB-stored constraints so generators respect budget/timeline
          costMin: version.costMin,
          costMax: version.costMax,
          timelineMonths: version.timelineMonths,
        });
      } catch (v2Error: any) {
        console.error('[convert-to-epm] V2 engine failed, falling back to legacy:', v2Error.message);
        console.error('[convert-to-epm] V2 error details:', v2Error.stack);
        engineUsed = 'legacy';
        program = await epmConverter.convertToEPM(
          version.analysisData as any,
          version.decisionsData as any,
          version.selectedDecisions as Record<string, string>
        );
        (program as any)._v2FallbackReason = v2Error.message;
      }
    } else {
      console.log('[convert-to-epm] Using legacy EPM engine (EPMConverter)');
      engineUsed = 'legacy';
      program = await epmConverter.convertToEPM(
        version.analysisData as any,
        version.decisionsData as any,
        version.selectedDecisions as Record<string, string>
      );
    }

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
      engineUsed,
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
        decisions: v.decisions,  // Include AI-generated decisions for DecisionSummaryPage
        analysis: v.analysis,    // Include analysis data for frontend access
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

    // Merge framework insights from journey-based flows
    let analysisData = version.analysisData || {};
    
    // Try to find journey session and its framework insights
    // First resolve URL sessionId to understanding
    const understanding = await db.query.strategicUnderstanding.findFirst({
      where: eq(strategicUnderstanding.sessionId, sessionId),
    });
    
    if (understanding) {
      // Find the journey session for this understanding
      const journeySession = await db.query.journeySessions.findFirst({
        where: eq(journeySessions.understandingId, understanding.id!),
        orderBy: (js, { desc }) => [desc(js.updatedAt)],
      });
      
      if (journeySession) {
        console.log(`[GET /versions] Found journeySession ${journeySession.id} for understanding ${understanding.id}`);
        
        // Fetch framework insights for this journey session
        const insights = await db.query.frameworkInsights.findMany({
          where: eq(frameworkInsights.sessionId, journeySession.id),
          orderBy: (fi, { asc }) => [asc(fi.createdAt)],
        });
        
        if (insights.length > 0) {
          console.log(`[GET /versions] Found ${insights.length} framework insights`);
          
          // Convert framework insights to the expected format
          const frameworkResults = insights.map(insight => ({
            framework: insight.frameworkName,
            ...(insight.insights as object || {}),
          }));
          
          // Merge with existing analysis data
          analysisData = {
            ...analysisData,
            frameworks: frameworkResults,
          };
        }
      }
    }

    res.json({
      success: true,
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
        analysis: analysisData,
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
    
    // Provide graceful fallback - return a minimal tree structure
    // This allows the flow to continue even if AI generation fails
    const fallbackTree = {
      rootQuestion: "Why is this strategic initiative important?",
      branches: [
        {
          id: randomUUID(),
          question: "Why is this strategic initiative important?",
          option: "It aligns with our business goals",
          depth: 1,
          isLeaf: false,
          branches: [],
          supporting_evidence: [],
          counter_arguments: [],
          consideration: "Generated fallback due to AI service unavailability"
        }
      ],
      maxDepth: 5,
      sessionId: req.body.sessionId,
      warning: 'AI service unavailable - using fallback tree structure'
    };
    
    console.warn('[WhysTreeGenerator] Returning fallback tree due to AI failure');
    res.json({
      tree: fallbackTree,
      estimatedTime: '0s',
      warning: 'AI service temporarily unavailable. You can skip this step and proceed with your analysis.'
    });
  }
});

router.post('/whys-tree/expand', async (req: Request, res: Response) => {
  try {
    const {
      sessionId,
      nodeId,
      selectedPath,
      currentDepth,
      parentQuestion,
      input,
      isCustom,
      customOption,
      allSiblings
    } = req.body;

    if (!sessionId || !nodeId || !selectedPath || currentDepth === undefined || !parentQuestion || !input) {
      return res.status(400).json({
        error: 'sessionId, nodeId, selectedPath, currentDepth, parentQuestion, and input are required'
      });
    }

    let expandedBranches;
    let fromCache = false;
    let prefetchStarted = false;
    let prefetchCount = 0;

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
      // Check cache first
      const cached = whysTreeGenerator.getCachedBranches(sessionId, nodeId, currentDepth);

      if (cached) {
        console.log('[API] Cache HIT - returning cached branches');
        expandedBranches = cached;
        fromCache = true;
      } else {
        // Use prefetch-enabled expansion
        const result = await whysTreeGenerator.expandBranchWithPrefetch(
          nodeId,
          selectedPath,
          input,
          sessionId,
          currentDepth,
          parentQuestion,
          allSiblings
        );

        expandedBranches = result.expandedBranches;

        // Determine if prefetch was triggered
        if (allSiblings && allSiblings.length > 1 && currentDepth <= 3) {
          prefetchStarted = true;
          prefetchCount = allSiblings.length - 1;
          console.log(`[API] Prefetch initiated for ${prefetchCount} siblings at depth ${currentDepth}`);
        }
      }
    }

    res.json({
      expandedBranches,
      fromCache,
      prefetchStarted,
      prefetchCount
    });
  } catch (error: any) {
    console.error('Error in /whys-tree/expand:', error);
    res.status(500).json({ error: error.message || 'Branch expansion failed' });
  }
});

router.post('/whys-tree/finalize', async (req: Request, res: Response) => {
  try {
    const { sessionId, selectedPath, rootCause, versionNumber, input, tree } = req.body;

    if (!sessionId || !selectedPath || !rootCause || !input) {
      return res.status(400).json({ 
        error: 'sessionId, selectedPath, rootCause, and input are required' 
      });
    }

    const canonicalPath = normalizeWhysPathSteps(selectedPath || []);
    const whysPathText = whysPathToText(canonicalPath);

    const sanitizeTree = (rawTree: any) => {
      if (!rawTree || typeof rawTree.rootQuestion !== 'string' || !Array.isArray(rawTree.branches)) {
        return null;
      }

      const cleanNode = (node: any): any | null => {
        if (!node || typeof node.option !== 'string' || !node.option.trim()) return null;
        const cleaned = {
          id: node.id,
          option: node.option,
          question: typeof node.question === 'string' ? node.question : '',
          branches: [] as any[],
          supporting_evidence: Array.isArray(node.supporting_evidence) ? node.supporting_evidence : [],
          counter_arguments: Array.isArray(node.counter_arguments) ? node.counter_arguments : [],
          consideration: typeof node.consideration === 'string' ? node.consideration : '',
        };
        if (Array.isArray(node.branches)) {
          cleaned.branches = node.branches.map(cleanNode).filter(Boolean);
        }
        return cleaned;
      };

      const cleanedBranches = rawTree.branches.map(cleanNode).filter(Boolean);
      if (cleanedBranches.length === 0) return null;

      return {
        rootQuestion: rawTree.rootQuestion,
        branches: cleanedBranches,
        maxDepth: rawTree.maxDepth || 5,
        sessionId: rawTree.sessionId || sessionId,
      };
    };

    const canonicalTree = sanitizeTree(tree) || buildLinearWhysTree(canonicalPath);

    console.log('[FiveWhys] Finalize received:', {
      sessionId,
      versionNumber,
      selectedPathLength: Array.isArray(selectedPath) ? selectedPath.length : 0,
      normalizedPathLength: canonicalPath.length,
      rootCausePreview: rootCause?.slice(0, 120),
    });

    const insights = await whysTreeGenerator.analyzePathInsights(
      input,
      whysPathText.map((option: string, index: number) => ({
        id: `node-${index}`,
        question: canonicalPath[index]?.question || '',
        option,
        depth: index + 1,
        isLeaf: false,
        supporting_evidence: [],
        counter_arguments: [],
        consideration: '',
      })));

    // Structure Five Whys data to match FiveWhysAnalysis interface expected by renderer
    // Renderer expects: why_1.question, why_1.answer, etc.
    const analysisData = {
      five_whys: {
        problem_statement: input,
        why_1: {
          question: canonicalPath[0]?.question || "Why is this happening?",
          answer: canonicalPath[0]?.answer || ""
        },
        why_2: {
          question: canonicalPath[1]?.question || "Why does that occur?",
          answer: canonicalPath[1]?.answer || ""
        },
        why_3: {
          question: canonicalPath[2]?.question || "Why is that the case?",
          answer: canonicalPath[2]?.answer || ""
        },
        why_4: {
          question: canonicalPath[3]?.question || "Why does that matter?",
          answer: canonicalPath[3]?.answer || ""
        },
        why_5: {
          question: canonicalPath[4]?.question || "What's the underlying cause?",
          answer: canonicalPath[4]?.answer || ""
        },
        root_cause: rootCause,
        strategic_implications: insights.strategic_implications,
        // Keep whysPath for backward compatibility
        whysPath: canonicalPath,
        tree: canonicalTree,
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

    // Determine target version number (authoritative: journey session if available)
    let targetVersionNumber: number | undefined = versionNumber;

    const understanding = await db.query.strategicUnderstanding.findFirst({
      where: eq(strategicUnderstanding.sessionId, sessionId),
    });

    if (understanding?.id) {
      const journeySession = await db.query.journeySessions.findFirst({
        where: eq(journeySessions.understandingId, understanding.id),
      });
      if (journeySession?.versionNumber) {
        targetVersionNumber = journeySession.versionNumber;
        console.log(`[FiveWhys] Using journey session versionNumber=${targetVersionNumber} (authoritative)`);
      }
    }

    if (!targetVersionNumber) {
      const versions = await storage.getStrategyVersionsBySession(sessionId);
      if (versions.length > 0) {
        const maxVersion = Math.max(...versions.map(v => v.versionNumber));
        targetVersionNumber = maxVersion;
        console.log(`[FiveWhys] No versionNumber provided, using latest=${targetVersionNumber}`);
      } else {
        targetVersionNumber = 1;
        console.log(`[FiveWhys] No existing versions, using version 1`);
      }
    }

    // Check if version already exists
    const existingVersion = await storage.getStrategyVersion(sessionId, targetVersionNumber);
    
    if (existingVersion) {
      // Update existing version
      console.log(`[FiveWhys] Updating existing version ${targetVersionNumber} for session ${sessionId}`);
      const existingAnalysisData = existingVersion.analysisData as any || {};
      await storage.updateStrategyVersion(existingVersion.id, {
        analysisData: {
          ...existingAnalysisData,
          ...analysisData,
        },
      });
      version = existingVersion;
    } else {
      // Create new version
      console.log(`[FiveWhys] Creating new version ${targetVersionNumber} for session ${sessionId}`);
      
      // Safeguard: double-check version doesn't exist (race condition protection)
      const doubleCheck = await storage.getStrategyVersion(sessionId, targetVersionNumber);
      if (doubleCheck) {
        // Collision detected, increment and retry
        targetVersionNumber++;
        console.warn(`[FiveWhys] Version collision detected, incremented to ${targetVersionNumber}`);
      }
      
      const initiativeDescription = await storage.getInitiativeDescriptionForSession(sessionId);
      const inputSummary = initiativeDescription || 'Strategic Analysis';
      
      version = await storage.createStrategyVersion({
        sessionId,
        versionNumber: targetVersionNumber,
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

    // Persist to frameworkInsights for export/report consistency
    try {
      if (understanding?.id) {
        const journeySession = await db.query.journeySessions.findFirst({
          where: eq(journeySessions.understandingId, understanding.id),
        });
        if (journeySession?.id) {
          await db.insert(frameworkInsights).values({
            understandingId: understanding.id,
            sessionId: journeySession.id,
            frameworkName: 'five_whys',
            insights: {
              whysPath: canonicalPath,
              rootCauses: rootCause ? [rootCause] : [],
              strategicImplications: insights.strategic_implications || [],
              tree: canonicalTree,
            },
          });
        }
      }
    } catch (insightsError: any) {
      console.warn('[FiveWhys] Failed to persist frameworkInsights:', insightsError?.message || insightsError);
    }

    // Update journey session status to completed if possible
    try {
      if (understanding?.id) {
        await db.update(journeySessions)
          .set({ status: 'completed', completedAt: new Date() })
          .where(eq(journeySessions.understandingId, understanding.id));
      }
    } catch (statusError: any) {
      console.warn('[FiveWhys] Failed to update journey status:', statusError?.message || statusError);
    }

    // Trace: read back analysisData from the version we wrote
    try {
      const writtenVersion = await storage.getStrategyVersion(sessionId, targetVersionNumber);
      const analysisData = typeof writtenVersion?.analysisData === 'string'
        ? JSON.parse(writtenVersion?.analysisData as any)
        : writtenVersion?.analysisData || {};
      const five = analysisData?.five_whys || {};
      console.log('[FiveWhys] Finalize write verification:', {
        targetVersionNumber,
        fiveWhysKeys: five ? Object.keys(five) : [],
        whysPathLength: Array.isArray(five?.whysPath) ? five.whysPath.length : 0,
        rootCause: five?.root_cause || null,
      });
    } catch (verifyError: any) {
      console.warn('[FiveWhys] Finalize verification failed:', verifyError?.message || verifyError);
    }

    res.json({
      rootCause,
      fullPath: canonicalPath,
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

// Debug endpoint: inspect Five Whys persistence for a session
router.get('/whys-tree/debug/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const understanding = await db.query.strategicUnderstanding.findFirst({
      where: eq(strategicUnderstanding.sessionId, sessionId),
    });
    const journeySession = understanding?.id
      ? await db.query.journeySessions.findFirst({
          where: eq(journeySessions.understandingId, understanding.id),
        })
      : null;

    const versions = await storage.getStrategyVersionsBySession(sessionId);
    const versionSummaries = versions.map(v => {
      const analysisData = typeof v.analysisData === 'string' ? JSON.parse(v.analysisData as any) : v.analysisData || {};
      const five = analysisData?.five_whys || {};
      return {
        versionNumber: v.versionNumber,
        status: v.status,
        fiveWhysKeys: five ? Object.keys(five) : [],
        whysPathLength: Array.isArray(five?.whysPath) ? five.whysPath.length : 0,
        rootCause: five?.root_cause || null,
      };
    });

    res.json({
      sessionId,
      understandingId: understanding?.id || null,
      journeySession: journeySession ? {
        id: journeySession.id,
        versionNumber: journeySession.versionNumber,
        status: journeySession.status,
        completedFrameworks: journeySession.completedFrameworks,
      } : null,
      versions: versionSummaries,
    });
  } catch (error: any) {
    console.error('[FiveWhys Debug] Error:', error);
    res.status(500).json({ error: error.message || 'Debug endpoint failed' });
  }
});

router.get('/research/stream/:sessionId', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sessionId = req.params.sessionId;
  const rootCause = req.query.rootCause as string;
  const whysPath = JSON.parse(req.query.whysPath as string || '[]');
  const whysPathText = whysPathToText(whysPath);
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

    const queries = await marketResearcher.generateResearchQueries(rootCause, input, whysPathText);
    
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

    // Persist research references to the knowledge graph
    try {
      const understanding = await getStrategicUnderstandingBySession(sessionId);
      if (understanding && req.user?.id) {
        const userId = req.user.id;
        
        // Normalize each source with proper metadata
        const normalizedReferences = findingsWithValidation.sources.map((source: any) => 
          referenceService.normalizeReference(
            source,
            userId,
            { component: 'research.pestle', claim: source.description || source.title },
            { understandingId: understanding.id, sessionId }
          )
        );
        
        // Persist all references
        await referenceService.persistReferences(normalizedReferences, { 
          understandingId: understanding.id, 
          sessionId 
        });
        
        console.log(`[PESTLE Research] ✅ Persisted ${normalizedReferences.length} references to knowledge graph`);
      }
    } catch (refError) {
      console.error('[PESTLE Research] ⚠️ Failed to persist references:', refError);
      // Don't fail the entire request if reference persistence fails
    }

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
        nextUrl: `/strategic-consultant/results/${sessionId}/${targetVersionNumber}`,
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
        
        // Handle both journey session IDs and legacy understanding session IDs
        let understanding;
        let journeySession = await getJourneySession(sessionId);
        
        if (journeySession && journeySession.understandingId) {
          // This is a journey session ID, get understanding via understandingId
          understanding = await getStrategicUnderstanding(journeySession.understandingId);
        } else {
          // Fall back to old behavior for base session IDs
          understanding = await getStrategicUnderstandingBySession(sessionId);
          // Get journey session for legacy flows
          journeySession = await getJourneySessionByUnderstandingSessionId(sessionId);
        }
        
        if (understanding) {
          console.log(`[BMC-RESEARCH] Persisting ${result.references.length} references to knowledge graph...`);
          
          // Get userId from journey session instead of falling back to "system"
          const userId = journeySession?.userId || (req.user as any)?.claims?.sub;
          
          if (!userId) {
            throw new Error('Cannot persist research references without a user');
          }
          
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
      // Handle both journey session IDs and legacy understanding session IDs
      let journeySession = await getJourneySession(sessionId);
      
      if (!journeySession) {
        // Fall back to old behavior for base session IDs
        journeySession = await getJourneySessionByUnderstandingSessionId(sessionId);
      }
      
      const userId = journeySession?.userId || (req.user as any)?.claims?.sub;
      
      if (!userId) {
        throw new Error('Cannot persist version without a user');
      }
      
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
            status: 'draft',
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
            status: 'draft',
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
  
  // Declare keepalive outside try block so it's accessible in catch
  let keepaliveInterval: NodeJS.Timeout | null = null;
  
  try {
    // Proactively refresh token before long-running operation to prevent mid-operation auth failures
    const tokenValid = await refreshTokenProactively(req, 600); // Refresh if expiring within 10 minutes
    if (!tokenValid) {
      return res.status(401).json({ 
        error: 'Session expired', 
        message: 'Please log in again to continue' 
      });
    }
    
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
    
    // First try to get journey session to find understandingId
    let understanding;
    const journeySession = await getJourneySession(sessionId);
    
    if (journeySession && journeySession.understandingId) {
      // This is a journey session ID, get understanding via understandingId
      console.log('[BMC-RESEARCH-STREAM] Found journey session, fetching understanding via understandingId:', journeySession.understandingId);
      understanding = await getStrategicUnderstanding(journeySession.understandingId);
    } else {
      // Fall back to old behavior for base session IDs
      console.log('[BMC-RESEARCH-STREAM] No journey session found, trying as base session ID');
      understanding = await getStrategicUnderstandingBySession(sessionId);
    }
    
    if (!understanding || !understanding.userInput) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Strategic understanding not found for this session' })}\n\n`);
      res.end();
      return;
    }
    
    const input = understanding.userInput;
    console.log('[BMC-RESEARCH-STREAM] Input fetched from understanding, length:', input.length);

    // Create streaming sink that writes to SSE response
    const sink = {
      emitContext: (inputPreview: string) => {
        res.write(`data: ${JSON.stringify({ type: 'context', message: `Analyzing: "${inputPreview}..."`, progress: 5 })}\n\n`);
      },
      emitQuery: (query: string, purpose: string, queryType: string) => {
        res.write(`data: ${JSON.stringify({ type: 'query', query, purpose, queryType, progress: 30 })}\n\n`);
      },
      emitSynthesis: (block: string, message: string) => {
        res.write(`data: ${JSON.stringify({ type: 'synthesis', block, message, progress: 70 })}\n\n`);
      },
      emitProgress: (message: string, progress: number) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', message, progress })}\n\n`);
      },
      emitComplete: (data: any) => {
        res.write(`data: ${JSON.stringify({ type: 'complete', data })}\n\n`);
      },
      emitError: (error: string) => {
        res.write(`data: ${JSON.stringify({ type: 'error', error })}\n\n`);
      },
    };

    // Send initial message immediately
    console.log('[BMC-RESEARCH-STREAM] Sending initial message');
    res.write(`data: ${JSON.stringify({ type: 'progress', message: '🚀 Starting BMC research...', progress: 0 })}\n\n`);
    
    // Send debugInput for QA verification
    res.write(`data: ${JSON.stringify({ type: 'debug', debugInput: input.slice(0, 200) })}\n\n`);

    // Start SSE keepalive to prevent connection timeout during long-running research
    // Sends a heartbeat comment every 15 seconds to keep the connection alive
    keepaliveInterval = setInterval(() => {
      try {
        // SSE comment format (colon prefix) - keeps connection alive without triggering event handlers
        res.write(`: keepalive ${Date.now()}\n\n`);
      } catch (e) {
        // Connection closed, stop keepalive
        if (keepaliveInterval) clearInterval(keepaliveInterval);
      }
    }, 15000);
    
    // Clean up keepalive if client disconnects
    res.on('close', () => {
      if (keepaliveInterval) {
        clearInterval(keepaliveInterval);
        keepaliveInterval = null;
      }
    });

    let result;
    let decisions;
    let researchError = false;

    try {
      // Conduct research with streaming sink - this is the main operation
      console.log('[BMC-RESEARCH-STREAM] Starting BMC research with real-time streaming...');
      result = await bmcResearcher.conductBMCResearch(input, sessionId, sink);
      console.log('[BMC-RESEARCH-STREAM] BMC research completed successfully');

      // Send 100% progress before trying other operations
      res.write(`data: ${JSON.stringify({ type: 'progress', message: '✅ Research complete, processing results...', progress: 100 })}\n\n`);

    } catch (error: any) {
      console.error('[BMC-RESEARCH-STREAM] Research failed:', error);
      researchError = true;
      
      // Re-throw to be caught by outer catch
      throw error;
    }

    // Try to generate decisions with timeout protection
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      console.log('[BMC-RESEARCH-STREAM] Generating strategic decisions from BMC analysis...');
      
      // Add 60-second timeout for decision generation to prevent hanging
      const decisionPromise = decisionGenerator.generateDecisionsFromBMC(result, input);
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('Decision generation timeout after 60s')), 60000);
      });
      
      decisions = await Promise.race([decisionPromise, timeoutPromise]) as any;
      console.log(`[BMC-RESEARCH-STREAM] Generated ${decisions.decisions.length} strategic decisions`);
    } catch (error: any) {
      console.error('[BMC-RESEARCH-STREAM] Decision generation failed (non-critical):', error);
      // Continue with empty decisions rather than failing
      decisions = { decisions: [] };
    } finally {
      // Always clear timeout to prevent unhandled rejection
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }

    // Persist references from BMC research
    try {
      if (result.references && result.references.length > 0 && understanding) {
        const { referenceService } = await import('../services/reference-service.js');
        
        // Get userId from journey session instead of falling back to "system"
        const journeySession = await getJourneySessionByUnderstandingSessionId(sessionId);
        const userId = journeySession?.userId || (req.user as any)?.claims?.sub;
        
        if (!userId) {
          throw new Error('Cannot persist BMC references without a user');
        }
        
        // Normalize all references with userId and context
        // Note: Only pass understandingId, not sessionId, to avoid foreign key constraint issues
        const normalized = result.references.map((reference: any) => 
          referenceService.normalizeReference(
            reference,
            userId,
            { 
              component: `bmc.${reference.topics?.[1] || 'general'}`,
              claim: reference.description || reference.snippet || ''
            },
            { understandingId: understanding.id }
          )
        );
        
        const persistResult = await referenceService.persistReferences(normalized, {
          understandingId: understanding.id,
        });
        
        console.log(`[BMC-RESEARCH-STREAM] ✓ Persisted ${persistResult.created.length} new references, updated ${persistResult.updated.length} existing`);
      }
    } catch (error: any) {
      console.error('[BMC-RESEARCH-STREAM] Reference persistence failed (non-critical):', error);
      // Continue - we still have the results to send to frontend
    }

    // Try to save to database, but don't fail the stream if this fails
    let targetVersionNumber = 1; // Default version number
    let version: any = null; // Declare version at outer scope
    
    try {
      // Get userId from journey session with robust fallback logic
      const journeySession = await getJourneySessionByUnderstandingSessionId(sessionId);
      
      // Try multiple sources for userId with system fallback
      let userId = journeySession?.userId || (req.user as any)?.claims?.sub;
      
      if (!userId) {
        console.warn(`[BMC-RESEARCH-STREAM] ⚠️  No authenticated user found for session ${sessionId}, using system fallback`);
        userId = 'system';  // Fallback to system user to ensure version is created
      }
      
      // Determine version number with fallback logic
      const versionNumberFromQuery = req.query.versionNumber ? parseInt(req.query.versionNumber as string) : undefined;
      
      if (versionNumberFromQuery) {
        targetVersionNumber = versionNumberFromQuery;
      } else if (journeySession && journeySession.versionNumber) {
        targetVersionNumber = journeySession.versionNumber;
      } else {
        // Fallback: query max version and increment
        const versions = await storage.getStrategyVersionsBySession(sessionId);
        if (versions.length > 0) {
          const maxVersion = Math.max(...versions.map(v => v.versionNumber));
          targetVersionNumber = maxVersion + 1;
          console.log(`[BMC-RESEARCH-STREAM] No versionNumber provided, computed max+1: ${targetVersionNumber}`);
        } else {
          targetVersionNumber = 1;
          console.log(`[BMC-RESEARCH-STREAM] No existing versions, using version 1`);
        }
      }
      
      // Get descriptive title from strategic understanding
      const initiativeDescription = await storage.getInitiativeDescriptionForSession(sessionId);
      const inputSummary = initiativeDescription || 'Strategic Analysis';
      
      // Check if version exists
      version = await storage.getStrategyVersion(sessionId, targetVersionNumber);
      
      if (!version) {
        // Safeguard: double-check version doesn't exist (race condition protection)
        const doubleCheck = await storage.getStrategyVersion(sessionId, targetVersionNumber);
        if (doubleCheck) {
          // Collision detected, increment and retry
          targetVersionNumber++;
          console.warn(`[BMC-RESEARCH-STREAM] Version collision detected, incremented to ${targetVersionNumber}`);
        }
        
        // Create new version
        version = await storage.createStrategyVersion({
          sessionId,
          versionNumber: targetVersionNumber,
          status: 'draft',
          analysisData: { bmc_research: result },
          decisionsData: decisions,
          userId,
          createdBy: userId,
          inputSummary,
        });
        
        // VALIDATION GATE: Verify the strategy_versions row was created before proceeding
        if (!version || !version.id) {
          console.error(`[BMC-RESEARCH-STREAM] VALIDATION FAILED: strategy_versions not created for session=${sessionId}, version=${targetVersionNumber}`);
          throw new Error(`Failed to create strategy version ${targetVersionNumber} for session ${sessionId}`);
        }
        console.log(`[BMC-RESEARCH-STREAM] ✓ VALIDATION PASSED: strategy_versions row (id=${version.id}, session=${sessionId}, version=${targetVersionNumber}) verified`);
        console.log(`[BMC-RESEARCH-STREAM] Created new version ${targetVersionNumber}`);
      } else {
        // Update existing version
        const existingAnalysisData = version.analysisData as any || {};
        await storage.updateStrategyVersion(version.id, {
          analysisData: {
            ...existingAnalysisData,
            bmc_research: result,
          },
          decisionsData: decisions,
        });
        console.log(`[BMC-RESEARCH-STREAM] Updated existing version ${targetVersionNumber}`);
      }
      
      console.log(`[BMC-RESEARCH-STREAM] ✓ Saved BMC results and ${decisions.decisions.length} decisions to version ${version.versionNumber}`);
    } catch (error: any) {
      console.error('[BMC-RESEARCH-STREAM] ⚠️  CRITICAL: Database save failed - decisions will NOT be persisted!');
      console.error('[BMC-RESEARCH-STREAM] Error details:', error.message || error);
      console.error('[BMC-RESEARCH-STREAM] This means the frontend will show the legacy wizard instead of AI decisions');
      // Continue - we still have the results to send to frontend, but warn about missing persistence
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
    
    const finalVersionNumber = version?.versionNumber || targetVersionNumber;
    
    // Stop keepalive before ending stream
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    
    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      data: {
        findings,
        searchQueriesUsed: [],
        versionNumber: finalVersionNumber,
        sourcesAnalyzed: findings.sources.length || 9,
        timeElapsed: '~2 minutes',
        nextUrl: `/strategy-workspace/decisions/${sessionId}/${finalVersionNumber}`,
        // Include full BMC analysis for 9-block canvas display
        bmcAnalysis: result,
      }
    })}\n\n`);
    res.end();
    console.log('[BMC-RESEARCH-STREAM] Stream ended successfully, nextUrl: /strategy-workspace/decisions/' + sessionId + '/' + finalVersionNumber);
  } catch (error: any) {
    // Stop keepalive on error
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    
    console.error('Error in /bmc-research/stream:', error);
    // Ensure error has type field for frontend handling
    const errorMessage = error.message || 'BMC research failed';
    res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
    res.end();
  }
});

// =============================================================================
// UNIFIED JOURNEY RESEARCH STREAM
// Single endpoint that handles ALL journey types using the executor + bridge pattern
// =============================================================================
router.get('/journey-research/stream/:sessionId', async (req: Request, res: Response) => {
  console.log('[JOURNEY-RESEARCH] Unified endpoint called! sessionId:', req.params.sessionId);
  req.socket.setTimeout(600000);

  let keepaliveInterval: NodeJS.Timeout | null = null;

  try {
    // Proactively refresh token before long-running operation
    const tokenValid = await refreshTokenProactively(req, 600);
    if (!tokenValid) {
      return res.status(401).json({
        error: 'Session expired',
        message: 'Please log in again to continue'
      });
    }

    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Get journey session to determine journey type and get understandingId
    // Try direct lookup first, then fall back to understanding session ID lookup
    let journeySession = await getJourneySession(sessionId);
    
    if (!journeySession) {
      // Fallback: sessionId might be an understanding session ID
      console.log(`[JOURNEY-RESEARCH] Direct lookup failed, trying understanding session lookup for: ${sessionId}`);
      journeySession = await getJourneySessionByUnderstandingSessionId(sessionId);
    }

    if (!journeySession) {
      console.error(`[JOURNEY-RESEARCH] Journey session not found for sessionId: ${sessionId}`);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Journey session not found' })}\n\n`);
      res.end();
      return;
    }
    
    console.log(`[JOURNEY-RESEARCH] Found journey session: ${journeySession.id}, type: ${journeySession.journeyType}`)

    const journeyType = journeySession.journeyType as JourneyType;
    console.log(`[JOURNEY-RESEARCH] Journey type: ${journeyType}`);

    // Get journey definition from registry
    const journeyDef = journeyRegistry.getJourney(journeyType);
    if (!journeyDef) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: `Unknown journey type: ${journeyType}` })}\n\n`);
      res.end();
      return;
    }

    console.log(`[JOURNEY-RESEARCH] Framework sequence: ${journeyDef.frameworks.join(' → ')}`);

    // Get strategic understanding
    let understanding;
    if (journeySession.understandingId) {
      understanding = await getStrategicUnderstanding(journeySession.understandingId);
    } else {
      understanding = await getStrategicUnderstandingBySession(sessionId);
    }

    if (!understanding || !understanding.userInput) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Strategic understanding not found' })}\n\n`);
      res.end();
      return;
    }

    const input = understanding.userInput;
    console.log(`[JOURNEY-RESEARCH] Input length: ${input.length}`);

    // Send initial message
    res.write(`data: ${JSON.stringify({
      type: 'progress',
      message: `🚀 Starting ${journeyDef.name}...`,
      progress: 0,
      journeyType,
      frameworks: journeyDef.frameworks
    })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'debug', debugInput: input.slice(0, 200) })}\n\n`);

    // Start SSE keepalive
    keepaliveInterval = setInterval(() => {
      try {
        res.write(`: keepalive ${Date.now()}\n\n`);
      } catch (e) {
        if (keepaliveInterval) clearInterval(keepaliveInterval);
      }
    }, 15000);

    res.on('close', () => {
      if (keepaliveInterval) clearInterval(keepaliveInterval);
    });

    // Import framework executors and bridges
    const { frameworkRegistry: fwRegistry } = await import('../journey/framework-executor-registry');
    const { getBridge } = await import('@shared/contracts/bridge.contract');

    // Build initial strategic context
    const strategicContext: any = {
      userInput: input,
      understandingId: understanding.id,
      sessionId,
      journeyType,
      previousResults: {},
      bridgeEnhancements: {},
    };

    // Execute frameworks in sequence
    const frameworkResults: Record<string, any> = {};
    const totalFrameworks = journeyDef.frameworks.length;

    for (let i = 0; i < totalFrameworks; i++) {
      const frameworkName = journeyDef.frameworks[i];
      const progressPercent = Math.round(((i) / totalFrameworks) * 80) + 10;

      // Skip user input frameworks (strategic_decisions, prioritization) - these pause the journey
      if (['strategic_decisions', 'prioritization'].includes(frameworkName)) {
        console.log(`[JOURNEY-RESEARCH] Skipping user input framework: ${frameworkName}`);
        continue;
      }

      res.write(`data: ${JSON.stringify({
        type: 'progress',
        message: `📊 Running ${frameworkName.replace(/_/g, ' ').toUpperCase()} analysis...`,
        progress: progressPercent,
        currentFramework: frameworkName
      })}\n\n`);

      console.log(`[JOURNEY-RESEARCH] Executing ${frameworkName}...`);

      // Check for bridge from previous framework
      if (i > 0) {
        const prevFramework = journeyDef.frameworks[i - 1];
        const bridge = getBridge(prevFramework, frameworkName);

        if (bridge) {
          console.log(`[JOURNEY-RESEARCH] Applying bridge: ${prevFramework} → ${frameworkName}`);
          try {
            const bridgeContext = {
              positioning: understanding.strategyMetadata?.positioning || {},
              allPriorOutputs: frameworkResults,
              sessionId,
              journeyType,
            };
            const enhancement = await bridge.transform(frameworkResults[prevFramework], bridgeContext);
            strategicContext.bridgeEnhancements[frameworkName] = enhancement;
            console.log(`[JOURNEY-RESEARCH] ✓ Bridge applied: ${prevFramework} → ${frameworkName}`);
          } catch (bridgeError: any) {
            console.warn(`[JOURNEY-RESEARCH] Bridge failed (${prevFramework} → ${frameworkName}):`, bridgeError.message);
            // Continue without bridge - not fatal
          }
        }
      }

      // Update context with previous results
      strategicContext.previousResults = frameworkResults;

      // Execute framework
      let result;
      try {
        result = await fwRegistry.execute(frameworkName as any, strategicContext);
        frameworkResults[frameworkName] = result.data;
        console.log(`[JOURNEY-RESEARCH] ✓ ${frameworkName} complete`);

        res.write(`data: ${JSON.stringify({
          type: 'progress',
          message: `✓ ${frameworkName.replace(/_/g, ' ').toUpperCase()} complete`,
          progress: progressPercent + Math.round(80 / totalFrameworks),
          completedFramework: frameworkName
        })}\n\n`);

        // Save to frameworkInsights
        // Use journeySession.id (not URL sessionId) as FK to journey_sessions table
        try {
          await db.insert(frameworkInsights).values({
            understandingId: understanding.id!,
            sessionId: journeySession.id,  // Use journey session primary key for FK
            frameworkName,
            frameworkVersion: '1.0',
            insights: result.data,
            telemetry: {
              duration: result.duration,
              executedAt: result.executedAt.toISOString(),
              source: 'unified_journey_research',
            } as any,
          }).onConflictDoNothing();
          console.log(`[JOURNEY-RESEARCH] ✓ Saved ${frameworkName} to frameworkInsights for session ${journeySession.id}`);
        } catch (saveError: any) {
          console.warn(`[JOURNEY-RESEARCH] Failed to save ${frameworkName} insight:`, saveError.message);
        }

      } catch (error: any) {
        console.error(`[JOURNEY-RESEARCH] ${frameworkName} failed:`, error.message);
        res.write(`data: ${JSON.stringify({
          type: 'progress',
          message: `⚠️ ${frameworkName} had issues, continuing...`,
          progress: progressPercent + Math.round(80 / totalFrameworks)
        })}\n\n`);
        frameworkResults[frameworkName] = { error: error.message };
      }
    }

    // Generate decisions from final framework output
    res.write(`data: ${JSON.stringify({ type: 'progress', message: '💾 Generating strategic decisions...', progress: 90 })}\n\n`);

    const generator = new DecisionGenerator();
    let decisions: any;
    const finalFramework = journeyDef.frameworks[journeyDef.frameworks.length - 1];
    const finalResult = frameworkResults[finalFramework];

    // Extract the actual data from framework result
    const finalData = finalResult?.output || finalResult?.data || finalResult;

    try {
      // Route to appropriate decision generator based on final framework
      if (finalFramework === 'swot' && finalData && !finalData.error) {
        decisions = await generator.generateDecisionsFromSWOT(finalData, input);
      } else if (finalFramework === 'bmc' && finalData && !finalData.error) {
        decisions = await generator.generateDecisionsFromBMC(finalData, input);
      } else if (finalData && !finalData.error) {
        // Generic decision generation from any framework
        decisions = await generator.generateDecisions(finalData, input);
      } else {
        // Fallback decisions
        decisions = {
          decisions: [{
            id: 'review_analysis',
            title: 'Review Analysis Results',
            question: 'Based on the analysis, what strategic direction should we pursue?',
            options: [
              { id: 'growth', label: 'Growth Strategy', description: 'Focus on expansion' },
              { id: 'consolidate', label: 'Consolidation', description: 'Optimize current operations' },
              { id: 'transform', label: 'Transformation', description: 'Significant change' },
            ],
          }],
        };
      }
      console.log(`[JOURNEY-RESEARCH] ✓ Generated ${decisions?.decisions?.length || 0} decision points`);
    } catch (decisionError: any) {
      console.error('[JOURNEY-RESEARCH] Decision generation failed:', decisionError.message);
      decisions = { decisions: [], error: decisionError.message };
    }

    // Save strategy version with decisions
    res.write(`data: ${JSON.stringify({ type: 'progress', message: '💾 Saving results...', progress: 95 })}\n\n`);

    const userId = (req.user as any)?.claims?.sub || 'system';

    const targetVersionNumber = journeySession.versionNumber || 1;
    const existingVersion = await storage.getStrategyVersion(sessionId, targetVersionNumber);

    const mergeAnalysis = (existingAnalysis: any, newAnalysis: any) => {
      const merged = { ...newAnalysis, ...existingAnalysis };
      const existingWhys = existingAnalysis?.five_whys;
      const hasFinalizedWhys =
        existingWhys?.root_cause ||
        (Array.isArray(existingWhys?.whysPath) && existingWhys.whysPath.length >= 4);
      if (hasFinalizedWhys) {
        merged.five_whys = existingWhys;
      } else if (newAnalysis?.five_whys) {
        merged.five_whys = newAnalysis.five_whys;
      }
      return merged;
    };

    if (existingVersion) {
      const existingAnalysis =
        typeof existingVersion.analysisData === 'string'
          ? JSON.parse(existingVersion.analysisData as any)
          : existingVersion.analysisData || {};

      const mergedAnalysis = mergeAnalysis(existingAnalysis, frameworkResults);

      await storage.updateStrategyVersion(existingVersion.id, {
        analysisData: mergedAnalysis,
        decisionsData: decisions,
        versionLabel: existingVersion.versionLabel || `${journeyDef.name} v${targetVersionNumber}`,
        status: 'draft',
      });
      const existingWhys = existingAnalysis?.five_whys;
      const mergedWhys = mergedAnalysis?.five_whys;
      console.log('[JOURNEY-RESEARCH] Five Whys merge check:', {
        targetVersionNumber,
        existingWhysKeys: existingWhys ? Object.keys(existingWhys) : [],
        mergedWhysKeys: mergedWhys ? Object.keys(mergedWhys) : [],
        mergedWhysPathLength: Array.isArray(mergedWhys?.whysPath) ? mergedWhys.whysPath.length : 0,
        mergedRootCause: mergedWhys?.root_cause || null,
      });
      console.log(`[JOURNEY-RESEARCH] ✓ Updated strategy version ${targetVersionNumber}`);
    } else {
      await storage.createStrategyVersion({
        sessionId,
        versionNumber: targetVersionNumber,
        versionLabel: `${journeyDef.name} v${targetVersionNumber}`,
        analysisData: frameworkResults,
        decisionsData: decisions,
        status: 'draft',
        createdBy: userId,
        userId,
      });
      console.log(`[JOURNEY-RESEARCH] ✓ Created strategy version ${targetVersionNumber}`);
    }

    // Build next URL based on journey page sequence.
    // This route always completes the research phase, so prefer the page that
    // immediately follows research in the configured journey sequence.
    const resolvePageUrl = (pathPattern: string): string =>
      pathPattern
        .replace(':sessionId', sessionId)
        .replace(':versionNumber', targetVersionNumber.toString());

    let nextUrl = `/strategy-workspace/decisions/${sessionId}/${targetVersionNumber}`;
    const researchPageIndex = journeyDef.pageSequence.findIndex((p) => p.includes('/research/:sessionId'));
    if (researchPageIndex >= 0 && researchPageIndex + 1 < journeyDef.pageSequence.length) {
      nextUrl = resolvePageUrl(journeyDef.pageSequence[researchPageIndex + 1]);
    } else {
      const decisionPageIndex = journeyDef.pageSequence.findIndex((p) => p.includes('decisions'));
      if (decisionPageIndex >= 0) {
        nextUrl = resolvePageUrl(journeyDef.pageSequence[decisionPageIndex]);
      }
    }

    // Clear keepalive
    if (keepaliveInterval) {
      clearInterval(keepaliveInterval);
      keepaliveInterval = null;
    }

    // Send completion
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      data: {
        findings: frameworkResults,
        decisions,
        versionNumber: targetVersionNumber,
        nextUrl,
        bmcAnalysis: frameworkResults.bmc,
        sourcesAnalyzed: Object.keys(frameworkResults).length,
        timeElapsed: 'completed',
        journeyType,
      }
    })}\n\n`);

    console.log(`[JOURNEY-RESEARCH] ✓ Journey complete for ${sessionId}`);
    res.end();

  } catch (error: any) {
    if (keepaliveInterval) clearInterval(keepaliveInterval);

    console.error('[JOURNEY-RESEARCH] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Journey research failed' })}\n\n`);
    res.end();
  }
});

// Market Entry research stream - runs PESTLE → Porter's → SWOT analysis
// Similar to BMC research stream but for market_entry journey type
// DEPRECATED: Use /journey-research/stream/:sessionId instead
router.get('/market-entry-research/stream/:sessionId', async (req: Request, res: Response) => {
  console.log('[MARKET-ENTRY-RESEARCH] GET endpoint called! sessionId:', req.params.sessionId);
  req.socket.setTimeout(600000);
  
  let keepaliveInterval: NodeJS.Timeout | null = null;
  
  try {
    // Proactively refresh token before long-running operation
    const tokenValid = await refreshTokenProactively(req, 600);
    if (!tokenValid) {
      return res.status(401).json({ 
        error: 'Session expired', 
        message: 'Please log in again to continue' 
      });
    }
    
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    console.log('[MARKET-ENTRY-RESEARCH] Starting SSE stream for session:', sessionId);

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    
    // Get journey session to find understandingId
    let understanding;
    const journeySession = await getJourneySession(sessionId);
    
    if (journeySession && journeySession.understandingId) {
      console.log('[MARKET-ENTRY-RESEARCH] Found journey session, fetching understanding via understandingId:', journeySession.understandingId);
      understanding = await getStrategicUnderstanding(journeySession.understandingId);
    } else {
      console.log('[MARKET-ENTRY-RESEARCH] No journey session found, trying as base session ID');
      understanding = await getStrategicUnderstandingBySession(sessionId);
    }
    
    if (!understanding || !understanding.userInput) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Strategic understanding not found for this session' })}\n\n`);
      res.end();
      return;
    }
    
    const input = understanding.userInput;
    console.log('[MARKET-ENTRY-RESEARCH] Input fetched from understanding, length:', input.length);

    // Send initial message
    res.write(`data: ${JSON.stringify({ type: 'progress', message: '🚀 Starting Market Entry analysis...', progress: 0 })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'debug', debugInput: input.slice(0, 200) })}\n\n`);

    // Start SSE keepalive
    keepaliveInterval = setInterval(() => {
      try {
        res.write(`: keepalive ${Date.now()}\n\n`);
      } catch (e) {
        if (keepaliveInterval) clearInterval(keepaliveInterval);
      }
    }, 15000);
    
    res.on('close', () => {
      if (keepaliveInterval) clearInterval(keepaliveInterval);
    });

    // Import framework executors
    const { frameworkRegistry } = await import('../journey/framework-executor-registry');
    
    // Build strategic context for executors
    const strategicContext: any = {
      userInput: input,
      understandingId: understanding.id,
      sessionId,
    };
    
    // Execute PESTLE analysis
    res.write(`data: ${JSON.stringify({ type: 'progress', message: '📊 Running PESTLE analysis (macro-environmental factors)...', progress: 10 })}\n\n`);
    console.log('[MARKET-ENTRY-RESEARCH] Executing PESTLE analysis...');
    
    let pestleResult;
    try {
      pestleResult = await frameworkRegistry.execute('pestle', strategicContext);
      console.log('[MARKET-ENTRY-RESEARCH] ✓ PESTLE analysis complete');
      res.write(`data: ${JSON.stringify({ type: 'progress', message: '✓ PESTLE analysis complete', progress: 30 })}\n\n`);
    } catch (error: any) {
      console.error('[MARKET-ENTRY-RESEARCH] PESTLE analysis failed:', error.message);
      res.write(`data: ${JSON.stringify({ type: 'progress', message: '⚠️ PESTLE analysis had issues, continuing...', progress: 30 })}\n\n`);
      pestleResult = { error: error.message };
    }
    
    // Execute Porter's Five Forces analysis
    res.write(`data: ${JSON.stringify({ type: 'progress', message: '🏢 Running Porter\'s Five Forces analysis (competitive forces)...', progress: 35 })}\n\n`);
    console.log('[MARKET-ENTRY-RESEARCH] Executing Porter\'s analysis...');
    
    let portersResult;
    try {
      portersResult = await frameworkRegistry.execute('porters', strategicContext);
      console.log('[MARKET-ENTRY-RESEARCH] ✓ Porter\'s analysis complete');
      res.write(`data: ${JSON.stringify({ type: 'progress', message: '✓ Porter\'s Five Forces complete', progress: 55 })}\n\n`);
    } catch (error: any) {
      console.error('[MARKET-ENTRY-RESEARCH] Porter\'s analysis failed:', error.message);
      res.write(`data: ${JSON.stringify({ type: 'progress', message: '⚠️ Porter\'s analysis had issues, continuing...', progress: 55 })}\n\n`);
      portersResult = { error: error.message };
    }
    
    // Execute SWOT analysis (synthesizes PESTLE and Porter's)
    res.write(`data: ${JSON.stringify({ type: 'progress', message: '📋 Running SWOT analysis (synthesizing insights)...', progress: 60 })}\n\n`);
    console.log('[MARKET-ENTRY-RESEARCH] Executing SWOT analysis...');
    
    // Enhance context with previous framework results for SWOT
    const swotContext = {
      ...strategicContext,
      previousResults: {
        pestle: pestleResult,
        porters: portersResult,
      },
    };
    
    let swotResult;
    try {
      swotResult = await frameworkRegistry.execute('swot', swotContext);
      console.log('[MARKET-ENTRY-RESEARCH] ✓ SWOT analysis complete');
      res.write(`data: ${JSON.stringify({ type: 'progress', message: '✓ SWOT analysis complete', progress: 80 })}\n\n`);
    } catch (error: any) {
      console.error('[MARKET-ENTRY-RESEARCH] SWOT analysis failed:', error.message);
      res.write(`data: ${JSON.stringify({ type: 'progress', message: '⚠️ SWOT analysis had issues', progress: 80 })}\n\n`);
      swotResult = { error: error.message };
    }

    res.write(`data: ${JSON.stringify({ type: 'progress', message: '💾 Generating strategic decisions...', progress: 85 })}\n\n`);

    // Generate decisions from SWOT analysis
    const generator = new DecisionGenerator();
    let decisions: any;
    try {
      // Extract SWOT data from framework result
      // frameworkRegistry.execute() returns { data: { framework: 'swot', output: swotOutput, summary: {...} } }
      // So the actual SWOT data is at swotResult.data.output
      const swotDataForDecisions = (swotResult as any)?.data?.output || 
                                    (swotResult as any)?.output || 
                                    (swotResult as any)?.data || 
                                    swotResult;
      
      // Validate SWOT data before calling DecisionGenerator
      const hasValidSwot = swotDataForDecisions && 
                           !swotDataForDecisions.error &&
                           Array.isArray(swotDataForDecisions.strengths) && 
                           Array.isArray(swotDataForDecisions.weaknesses);
      
      console.log('[MARKET-ENTRY-RESEARCH] SWOT data for decisions:', {
        hasData: !!swotDataForDecisions,
        isError: swotDataForDecisions?.error,
        hasStrengths: Array.isArray(swotDataForDecisions?.strengths),
        hasWeaknesses: Array.isArray(swotDataForDecisions?.weaknesses),
        valid: hasValidSwot,
      });
      
      if (!hasValidSwot) {
        console.warn('[MARKET-ENTRY-RESEARCH] Invalid SWOT data, using placeholder decisions');
        decisions = { decisions: [], decision_flow: 'SWOT data unavailable', estimated_completion_time_minutes: 30 };
      } else {
        decisions = await generator.generateDecisionsFromSWOT(
          swotDataForDecisions,
          input
        );
      }
      console.log(`[MARKET-ENTRY-RESEARCH] Generated ${decisions?.decisions?.length || 0} decisions`);
    } catch (error: any) {
      console.error('[MARKET-ENTRY-RESEARCH] Decision generation failed:', error.message);
      decisions = { decisions: [], decision_flow: {}, estimated_completion_time_minutes: 30 };
    }

    res.write(`data: ${JSON.stringify({ type: 'progress', message: '💾 Saving analysis results...', progress: 90 })}\n\n`);

    // Save results to strategy_versions
    const userId = (req.user as any)?.claims?.sub || 'system';
    let targetVersionNumber = journeySession?.versionNumber || 1;
    let version;
    
    try {
      const versions = await storage.getStrategyVersionsBySession(sessionId);
      
      if (versions.length === 0) {
        // Create new version
        version = await storage.createStrategyVersion({
          sessionId,
          versionNumber: targetVersionNumber,
          status: 'draft',
          analysisData: { 
            pestle: pestleResult,
            porters: portersResult,
            swot: swotResult,
            market_entry_research: true,
          },
          decisionsData: decisions,
          userId,
          createdBy: userId,
          inputSummary: input.slice(0, 200),
        });
        console.log(`[MARKET-ENTRY-RESEARCH] Created new version ${targetVersionNumber}`);
      } else {
        // Update existing version
        version = versions[versions.length - 1];
        targetVersionNumber = version.versionNumber;
        const existingAnalysisData = version.analysisData as any || {};
        await storage.updateStrategyVersion(version.id, {
          analysisData: {
            ...existingAnalysisData,
            pestle: pestleResult,
            porters: portersResult,
            swot: swotResult,
            market_entry_research: true,
          },
          decisionsData: decisions,
        });
        console.log(`[MARKET-ENTRY-RESEARCH] Updated existing version ${targetVersionNumber}`);
      }
    } catch (error: any) {
      console.error('[MARKET-ENTRY-RESEARCH] Database save failed:', error.message);
    }

    // Build findings object for frontend compatibility
    const findings: any = {
      market_dynamics: [],
      competitive_landscape: [],
      language_preferences: [],
      buyer_behavior: [],
      regulatory_factors: [],
      sources: [],
    };
    
    // Cast to any for safe property access on framework results
    const pestleData = (pestleResult as any)?.data || pestleResult;
    const portersData = (portersResult as any)?.data || portersResult;
    const swotData = (swotResult as any)?.data || swotResult;
    
    // Extract findings from framework results
    if (pestleData && !(pestleData as any).errors) {
      // Map PESTLE factors to findings
      if (pestleData?.political?.trends) {
        findings.regulatory_factors = pestleData.political.trends.map((t: any) => ({
          fact: t.description || t,
          citation: 'PESTLE Analysis',
          confidence: 'high',
        }));
      }
      if (pestleData?.economic?.trends) {
        findings.market_dynamics = [...findings.market_dynamics, ...pestleData.economic.trends.map((t: any) => ({
          fact: t.description || t,
          citation: 'PESTLE Analysis',
          confidence: 'high',
        }))];
      }
    }
    
    if (portersData && !(portersData as any).errors) {
      // Map Porter's forces to competitive landscape
      const forces = ['new_entrants', 'supplier_power', 'buyer_power', 'substitutes', 'rivalry'];
      forces.forEach((force: string) => {
        if (portersData?.[force]) {
          findings.competitive_landscape.push({
            fact: `${force.replace('_', ' ')}: ${portersData[force]?.summary || portersData[force]?.description || ''}`,
            citation: 'Porter\'s Five Forces Analysis',
            confidence: 'high',
          });
        }
      });
    }
    
    if (swotData && !(swotData as any).errors) {
      // Map SWOT to buyer behavior
      if (swotData?.opportunities) {
        findings.buyer_behavior = swotData.opportunities.slice(0, 3).map((o: any) => ({
          fact: o.description || o,
          citation: 'SWOT Analysis',
          confidence: 'high',
        }));
      }
    }

    const finalVersionNumber = version?.versionNumber || targetVersionNumber;
    
    // Stop keepalive before ending stream
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    
    // For Market Entry journey, redirect to results review page (PESTLE → Porter's → SWOT)
    // User reviews all analysis before proceeding to strategic decisions
    const nextUrl = `/strategic-consultant/market-entry-results/${sessionId}/${finalVersionNumber}`;
    
    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      data: {
        findings,
        searchQueriesUsed: [],
        versionNumber: finalVersionNumber,
        sourcesAnalyzed: 3,
        timeElapsed: '~2 minutes',
        nextUrl,
        // Include framework analysis results
        marketEntryAnalysis: {
          pestle: pestleResult,
          porters: portersResult,
          swot: swotResult,
        },
      }
    })}\n\n`);
    res.end();
    console.log('[MARKET-ENTRY-RESEARCH] Stream ended successfully, nextUrl:', nextUrl);
  } catch (error: any) {
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    console.error('Error in /market-entry-research/stream:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Market Entry research failed' })}\n\n`);
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

    // Start journey session (initializing state)
    const { journeySessionId, versionNumber } = await journeyOrchestrator.startJourney(
      targetUnderstandingId,
      journeyType as JourneyType,
      userId
    );

    // Create background job record with session ID
    const { backgroundJobService } = await import('../services/background-job-service');
    const jobId = await backgroundJobService.createJob({
      userId,
      jobType: journeyType ? 'strategic_understanding' : 'web_research',
      inputData: {
        sessionId: journeySessionId, // CRITICAL: Worker needs session ID
        understandingId: targetUnderstandingId,
        versionNumber, // Include version number for background worker
        journeyType,
        frameworks,
        mode: 'background',
        isFollowOn,
        baseUnderstandingId: isFollowOn ? understandingId : undefined,
      },
      relatedEntityId: targetUnderstandingId,
      relatedEntityType: 'strategic_understanding',
    });

    // Background worker will execute the journey and update job status
    console.log(`[execute-background] Journey session ${journeySessionId} (v${versionNumber}) queued for background execution by worker`);
    
    res.json({
      success: true,
      jobId,
      journeySessionId,
      versionNumber, // Return version number to client
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
    const { understandingId, journeyType } = req.body;
    const userId = (req.user as any)?.claims?.sub || null;

    if (!understandingId) {
      return res.status(400).json({ error: 'understandingId is required' });
    }

    if (!journeyType) {
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

    // Check if there are existing journey sessions (follow-on journey)
    const existingSessions = await db.query.journeySessions.findMany({
      where: (sessions, { eq }) => eq(sessions.understandingId, understandingId),
    });

    // If follow-on journey, build strategic summary and update the understanding's input
    if (existingSessions.length > 0) {
      try {
        const strategicSummary = await buildStrategicSummary(understandingId);
        
        // Update the existing understanding with the strategic summary as the new input
        await updateStrategicUnderstanding(understandingId, {
          userInput: strategicSummary,
          initiativeDescription: strategicSummary, // Show the actual summary, not a technical message
        });

        console.log(`[Run Now] Follow-on journey detected. Updated understanding ${understandingId} with strategic summary`);
      } catch (summaryError: any) {
        console.warn('[Run Now] Failed to build strategic summary, using existing input:', summaryError.message);
      }
    }

    // Start journey session and navigate to first page (interactive wizard mode)
    const { journeySessionId, versionNumber } = await journeyOrchestrator.startJourney(
      understandingId,
      journeyType as JourneyType,
      userId
    );

    // Get the first page of the journey to redirect to (skip input page at index 0)
    const firstPageUrl = journey.pageSequence?.[1]?.replace(':understandingId', understandingId).replace(':sessionId', journeySessionId);

    console.log(`[Run Now] Journey session ${journeySessionId} created (v${versionNumber}), redirecting to wizard`);

    res.json({
      success: true,
      journeySessionId,
      versionNumber, // Version number for this journey session
      understandingId,
      message: `Journey "${journeyType}" started${existingSessions.length > 0 ? ' using strategic summary from previous analysis' : ''}`,
      navigationUrl: firstPageUrl || `/strategic-consultant/whys-tree/${journeySessionId}`,
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
    
    // Get readiness thresholds based on feature flag
    let minReferences: number;
    let minEntities: number;

    if (isJourneyRegistryV2Enabled()) {
      // Use dynamic thresholds from journey registry
      const journey = journeyRegistry.getJourney(journeyType as JourneyType);
      if (!journey) {
        return res.status(400).json({ error: 'Invalid journey type' });
      }
      ({ minReferences, minEntities } = journey.defaultReadiness);
      console.log('[Strategic Consultant] Using registry thresholds:', { minReferences, minEntities });
    } else {
      // Use legacy hardcoded thresholds
      const readinessConfig: Record<string, { minReferences: number; minEntities: number }> = {
        business_model_innovation: { minReferences: 0, minEntities: 0 },
        business_model_canvas: { minReferences: 0, minEntities: 0 },
      };
      const config = readinessConfig[journeyType as string] ?? { minReferences: 3, minEntities: 5 };
      minReferences = config.minReferences;
      minEntities = config.minEntities;
      console.log('[Strategic Consultant] Using legacy thresholds:', { minReferences, minEntities });
    }
    
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

/**
 * GET /api/strategic-consultant/config/features
 * Return feature flag configuration for client-side feature gating
 */
router.get('/config/features', (req: Request, res: Response) => {
  res.json({
    journeyRegistryV2: isJourneyRegistryV2Enabled(),
    knowledgeGraph: isKnowledgeGraphEnabled()
  });
});

/**
 * GET /api/strategic-consultant/bmc-knowledge/:programId
 * Retrieve BMC knowledge graph data for an EPM program
 * Query chain: EPM Program → Strategy Version → Strategic Understanding → Entities/Relationships
 */
router.get('/bmc-knowledge/:programId', async (req: Request, res: Response) => {
  try {
    const { programId } = req.params;
    const userId = (req.user as any)?.claims?.sub;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // STEP 1: Get EPM program and verify ownership
    const [program] = await db
      .select()
      .from(epmPrograms)
      .where(and(
        eq(epmPrograms.id, programId),
        eq(epmPrograms.userId, userId)
      ))
      .limit(1);

    if (!program) {
      return res.status(404).json({ error: 'EPM program not found' });
    }

    // STEP 2: Get strategy version to find sessionId
    const [strategyVersion] = await db
      .select()
      .from(strategyVersions)
      .where(eq(strategyVersions.id, program.strategyVersionId))
      .limit(1);

    if (!strategyVersion || !strategyVersion.sessionId) {
      // No session ID means no knowledge graph data available
      return res.json({
        userAssumptions: [],
        researchFindings: [],
        contradictions: [],
        criticalGaps: []
      });
    }

    // STEP 3: Get strategic understanding
    const understanding = await getStrategicUnderstandingBySession(strategyVersion.sessionId);

    if (!understanding || !understanding.id) {
      return res.json({
        userAssumptions: [],
        researchFindings: [],
        contradictions: [],
        criticalGaps: []
      });
    }

    // STEP 4: Get all entities (automatically decrypted by service)
    const allEntities = await strategicUnderstandingService.getEntitiesByUnderstanding(understanding.id);

    // STEP 5: Filter entities by discoveredBy
    const userAssumptions = allEntities.filter(e => e.discoveredBy === 'user_input');
    const researchFindings = allEntities.filter(e => e.discoveredBy === 'bmc_agent');

    // STEP 6: Get contradictions from relationships - FILTER BY CURRENT UNDERSTANDING
    // Security: Only get contradictions where BOTH entities belong to this understanding
    const entityIds = allEntities.map(e => e.id);
    
    const contradictionRelationships = entityIds.length > 0 
      ? await db
          .select()
          .from(strategicRelationships)
          .where(and(
            eq(strategicRelationships.relationshipType, 'contradicts'),
            inArray(strategicRelationships.fromEntityId, entityIds),
            inArray(strategicRelationships.toEntityId, entityIds)
          ))
          .orderBy(strategicRelationships.discoveredAt)
      : [];

    // Map contradictions with full entity details
    const contradictions = await Promise.all(
      contradictionRelationships.map(async (rel) => {
        const fromEntity = allEntities.find(e => e.id === rel.fromEntityId);
        const toEntity = allEntities.find(e => e.id === rel.toEntityId);

        // Determine which is user claim and which is research claim
        const isFromUser = fromEntity?.discoveredBy === 'user_input';
        
        // Decrypt relationship evidence if encrypted
        let decryptedEvidence = rel.evidence || '';
        if (decryptedEvidence) {
          try {
            decryptedEvidence = await decryptKMS(decryptedEvidence) || decryptedEvidence;
          } catch (e) {
            // If decryption fails, it might already be plaintext
            console.warn('Evidence decryption failed, using as-is:', e);
          }
        }
        
        return {
          userClaim: isFromUser ? fromEntity : toEntity,
          researchClaim: isFromUser ? toEntity : fromEntity,
          evidence: decryptedEvidence
        };
      })
    );

    // Filter out any contradictions with missing entities
    const validContradictions = contradictions.filter(c => c.userClaim && c.researchClaim);

    // STEP 7: Get critical gaps from BMC analyses
    const bmcAnalysisRecords = await db
      .select()
      .from(bmcAnalyses)
      .where(eq(bmcAnalyses.strategyVersionId, program.strategyVersionId))
      .limit(1);

    const criticalGaps = bmcAnalysisRecords[0]?.criticalGaps || [];

    // Return the knowledge graph data
    res.json({
      userAssumptions,
      researchFindings,
      contradictions: validContradictions,
      criticalGaps
    });
  } catch (error: any) {
    console.error('Error in /bmc-knowledge/:programId:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to retrieve BMC knowledge data' 
    });
  }
});

/**
 * GET /api/strategic-consultant/context-foundry/status
 * Check Context Foundry integration status
 */
router.get('/context-foundry/status', async (req: Request, res: Response) => {
  try {
    const { validateContextFoundryConnection, isContextFoundryConfigured } = await import('../services/grounded-analysis-service');
    
    const status = await validateContextFoundryConnection();
    
    res.json({
      configured: status.configured,
      connected: status.connected,
      error: status.error,
      message: status.connected 
        ? 'Context Foundry is connected and ready for grounded analysis'
        : status.configured 
          ? 'Context Foundry is configured but connection failed'
          : 'Context Foundry API key not configured'
    });
  } catch (error: any) {
    res.status(500).json({
      configured: false,
      connected: false,
      error: error.message
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

// GET /api/strategic-consultant/framework-insights/:sessionId/:frameworkName
// Fetch framework insights for a journey session
router.get('/framework-insights/:sessionId/:frameworkName', async (req: Request, res: Response) => {
  try {
    const { sessionId, frameworkName } = req.params;
    
    console.log(`[Framework Insights] Fetching ${frameworkName} insights for session ${sessionId}`);
    
    // First get the journey session to get the understanding ID
    const session = await db.query.journeySessions.findFirst({
      where: eq(journeySessions.id, sessionId),
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Journey session not found' });
    }
    
    // Fetch the framework insight for this session
    const insight = await db.query.frameworkInsights.findFirst({
      where: and(
        eq(frameworkInsights.sessionId, sessionId),
        eq(frameworkInsights.frameworkName, frameworkName)
      ),
    });
    
    if (!insight) {
      // Check if the framework hasn't run yet
      console.log(`[Framework Insights] No insight found for ${frameworkName} in session ${sessionId}`);
      return res.status(404).json({ 
        error: 'Framework insight not found', 
        message: `The ${frameworkName} analysis hasn't been completed yet for this session` 
      });
    }
    
    console.log(`[Framework Insights] ✓ Found ${frameworkName} insight for session ${sessionId}`);
    
    // Get next step redirect URL from session metadata (persisted by JourneyOrchestrator)
    const metadata = session.metadata as { frameworks?: string[]; nextStepRedirectUrl?: string } | null;
    let nextStepRedirectUrl: string | null = metadata?.nextStepRedirectUrl || null;
    
    // If not in metadata, try to compute it
    if (!nextStepRedirectUrl) {
      const frameworks = metadata?.frameworks || [];
      
      // Normalize framework names for comparison (underscore <-> hyphen)
      const normalizeFrameworkName = (name: string) => name.toLowerCase().replace(/_/g, '-');
      const normalizedFrameworkName = normalizeFrameworkName(frameworkName);
      
      // Find current index using normalized comparison
      const currentIndex = frameworks.findIndex(f => normalizeFrameworkName(f) === normalizedFrameworkName);
      
      if (currentIndex >= 0 && currentIndex < frameworks.length - 1) {
        const nextFramework = frameworks[currentIndex + 1];
        const normalizedNext = normalizeFrameworkName(nextFramework);
        
        // Check if next step is strategic_decisions (user-input type)
        if (normalizedNext === 'strategic-decisions') {
          // Query for the latest strategy version
          const versions = await db.query.strategyVersions.findMany({
            where: eq(strategyVersions.sessionId, session.understandingId || ''),
            orderBy: (sv, { desc }) => [desc(sv.versionNumber)],
            limit: 1,
          });
          
          // Only provide redirect URL if a version actually exists
          if (versions.length > 0) {
            nextStepRedirectUrl = `/strategic-consultant/decisions/${session.understandingId}/${versions[0].versionNumber}`;
          }
        }
      }
    }
    
    res.json({
      success: true,
      insight: {
        id: insight.id,
        sessionId: insight.sessionId,
        frameworkName: insight.frameworkName,
        frameworkVersion: insight.frameworkVersion,
        insights: insight.insights,
        telemetry: insight.telemetry,
        createdAt: insight.createdAt,
      },
      session: {
        id: session.id,
        journeyType: session.journeyType,
        status: session.status,
        currentFrameworkIndex: session.currentFrameworkIndex,
        completedFrameworks: session.completedFrameworks,
        understandingId: session.understandingId,
        metadata: session.metadata,
      },
      nextStepRedirectUrl,
    });
  } catch (error: any) {
    console.error('[Framework Insights] Error fetching framework insights:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch framework insights' });
  }
});

// GET /api/strategic-consultant/framework-insights/:sessionId
// Fetch all framework insights for a journey session
router.get('/framework-insights/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    console.log(`[Framework Insights] Fetching all insights for session ${sessionId}`);
    
    const insights = await db.query.frameworkInsights.findMany({
      where: eq(frameworkInsights.sessionId, sessionId),
      orderBy: (fi, { asc }) => [asc(fi.createdAt)],
    });
    
    res.json({
      success: true,
      insights: insights.map(i => ({
        id: i.id,
        frameworkName: i.frameworkName,
        frameworkVersion: i.frameworkVersion,
        insights: i.insights,
        telemetry: i.telemetry,
        createdAt: i.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('[Framework Insights] Error fetching all insights:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch framework insights' });
  }
});

// ============================================================================
// INDIVIDUAL FRAMEWORK EXECUTION ENDPOINTS (Sequential Page Flow)
// ============================================================================
// These endpoints execute ONE framework at a time, storing results in strategy_versions.
// Used by the sequential page flow: PESTLE page → Porter's page → SWOT page → Decisions

/**
 * Execute PESTLE analysis for a session
 * POST /api/strategic-consultant/frameworks/pestle/execute/:sessionId
 */
router.post('/frameworks/pestle/execute/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    console.log('[PESTLE Execute] Starting for session:', sessionId);

    // Get understanding data
    const journeySession = await getJourneySession(sessionId);
    let understanding;
    
    if (journeySession?.understandingId) {
      understanding = await getStrategicUnderstanding(journeySession.understandingId);
    } else {
      understanding = await getStrategicUnderstandingBySession(sessionId);
    }

    if (!understanding?.userInput) {
      return res.status(404).json({ error: 'Strategic understanding not found' });
    }

    // Import and execute PESTLE
    const { frameworkRegistry } = await import('../journey/framework-executor-registry');
    const strategicContext = {
      userInput: understanding.userInput,
      understandingId: understanding.id,
      sessionId,
      insights: {},
    };

    const pestleResult = await frameworkRegistry.execute('pestle', strategicContext);
    console.log('[PESTLE Execute] ✓ Analysis complete');

    // Get or create strategy version
    const userId = (req.user as any)?.claims?.sub || 'system';
    let versions = await storage.getStrategyVersionsBySession(sessionId);
    let version;
    const versionNumber = journeySession?.versionNumber || 1;

    if (versions.length === 0) {
      version = await storage.createStrategyVersion({
        sessionId,
        versionNumber,
        status: 'draft',
        analysisData: { pestle: pestleResult },
        userId,
        createdBy: userId,
        inputSummary: understanding.userInput.slice(0, 200),
      });
    } else {
      version = versions[versions.length - 1];
      const existingData = (version.analysisData as any) || {};
      await storage.updateStrategyVersion(version.id, {
        analysisData: { ...existingData, pestle: pestleResult },
      });
    }

    res.json({
      success: true,
      framework: 'pestle',
      data: pestleResult,
      versionNumber: version?.versionNumber || versionNumber,
    });
  } catch (error: any) {
    console.error('[PESTLE Execute] Error:', error);
    res.status(500).json({ error: error.message || 'PESTLE analysis failed' });
  }
});

/**
 * Execute Porter's Five Forces analysis for a session
 * POST /api/strategic-consultant/frameworks/porters/execute/:sessionId
 */
router.post('/frameworks/porters/execute/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    console.log('[Porters Execute] Starting for session:', sessionId);

    // Get understanding data
    const journeySession = await getJourneySession(sessionId);
    let understanding;
    
    if (journeySession?.understandingId) {
      understanding = await getStrategicUnderstanding(journeySession.understandingId);
    } else {
      understanding = await getStrategicUnderstandingBySession(sessionId);
    }

    if (!understanding?.userInput) {
      return res.status(404).json({ error: 'Strategic understanding not found' });
    }

    // Get existing analysis data (PESTLE should already be there)
    const versions = await storage.getStrategyVersionsBySession(sessionId);
    const existingData = versions.length > 0 ? (versions[versions.length - 1].analysisData as any) || {} : {};

    // Import and execute Porter's
    const { frameworkRegistry } = await import('../journey/framework-executor-registry');
    const strategicContext = {
      userInput: understanding.userInput,
      understandingId: understanding.id,
      sessionId,
      insights: {},
      previousResults: { pestle: existingData.pestle },
    };

    const portersResult = await frameworkRegistry.execute('porters', strategicContext);
    console.log('[Porters Execute] ✓ Analysis complete');

    // Update strategy version
    const userId = (req.user as any)?.claims?.sub || 'system';
    const versionNumber = journeySession?.versionNumber || 1;
    let version;

    if (versions.length === 0) {
      version = await storage.createStrategyVersion({
        sessionId,
        versionNumber,
        status: 'draft',
        analysisData: { ...existingData, porters: portersResult },
        userId,
        createdBy: userId,
        inputSummary: understanding.userInput.slice(0, 200),
      });
    } else {
      version = versions[versions.length - 1];
      await storage.updateStrategyVersion(version.id, {
        analysisData: { ...existingData, porters: portersResult },
      });
    }

    res.json({
      success: true,
      framework: 'porters',
      data: portersResult,
      versionNumber: version?.versionNumber || versionNumber,
    });
  } catch (error: any) {
    console.error('[Porters Execute] Error:', error);
    res.status(500).json({ error: error.message || 'Porter\'s analysis failed' });
  }
});

/**
 * Execute SWOT analysis for a session
 * POST /api/strategic-consultant/frameworks/swot/execute/:sessionId
 */
router.post('/frameworks/swot/execute/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    console.log('[SWOT Execute] Starting for session:', sessionId);

    // Get understanding data
    const journeySession = await getJourneySession(sessionId);
    let understanding;
    
    if (journeySession?.understandingId) {
      understanding = await getStrategicUnderstanding(journeySession.understandingId);
    } else {
      understanding = await getStrategicUnderstandingBySession(sessionId);
    }

    if (!understanding?.userInput) {
      return res.status(404).json({ error: 'Strategic understanding not found' });
    }

    // Get existing analysis data (PESTLE + Porter's should be there)
    const versions = await storage.getStrategyVersionsBySession(sessionId);
    const existingData = versions.length > 0 ? (versions[versions.length - 1].analysisData as any) || {} : {};

    // Import and execute SWOT
    const { frameworkRegistry } = await import('../journey/framework-executor-registry');
    const strategicContext = {
      userInput: understanding.userInput,
      understandingId: understanding.id,
      sessionId,
      insights: existingData, // Pass previous results for context
      previousResults: { 
        pestle: existingData.pestle, 
        porters: existingData.porters 
      },
    };

    const swotResult = await frameworkRegistry.execute('swot', strategicContext);
    console.log('[SWOT Execute] ✓ Analysis complete');

    // Generate decisions from SWOT
    const generator = new DecisionGenerator();
    let decisions;
    try {
      // frameworkRegistry.execute() returns { data: { framework: 'swot', output: swotOutput, summary: {...} } }
      // So the actual SWOT data is at swotResult.data.output
      const swotData = (swotResult as any)?.data?.output || 
                       (swotResult as any)?.output || 
                       (swotResult as any)?.data || 
                       swotResult;
      
      // Validate SWOT data before calling DecisionGenerator
      const hasValidSwot = swotData && 
                           !swotData.error &&
                           Array.isArray(swotData.strengths) && 
                           Array.isArray(swotData.weaknesses);
      
      console.log('[SWOT Execute] SWOT data for decisions:', {
        hasData: !!swotData,
        isError: swotData?.error,
        hasStrengths: Array.isArray(swotData?.strengths),
        hasWeaknesses: Array.isArray(swotData?.weaknesses),
        valid: hasValidSwot,
      });
      
      if (!hasValidSwot) {
        console.warn('[SWOT Execute] Invalid SWOT data, using placeholder decisions');
        decisions = { decisions: [], decision_flow: 'SWOT data unavailable', estimated_completion_time_minutes: 30 };
      } else {
        decisions = await generator.generateDecisionsFromSWOT(swotData, understanding.userInput);
      }
      console.log(`[SWOT Execute] Generated ${decisions?.decisions?.length || 0} decisions`);
    } catch (decisionError: any) {
      console.error('[SWOT Execute] Decision generation failed:', decisionError.message);
      decisions = { decisions: [], decision_flow: {}, estimated_completion_time_minutes: 30 };
    }

    // Update strategy version
    const userId = (req.user as any)?.claims?.sub || 'system';
    const versionNumber = journeySession?.versionNumber || 1;
    let version;

    if (versions.length === 0) {
      version = await storage.createStrategyVersion({
        sessionId,
        versionNumber,
        status: 'draft',
        analysisData: { ...existingData, swot: swotResult },
        decisionsData: decisions,
        userId,
        createdBy: userId,
        inputSummary: understanding.userInput.slice(0, 200),
      });
    } else {
      version = versions[versions.length - 1];
      await storage.updateStrategyVersion(version.id, {
        analysisData: { ...existingData, swot: swotResult },
        decisionsData: decisions,
      });
    }

    res.json({
      success: true,
      framework: 'swot',
      data: swotResult,
      decisions,
      versionNumber: version?.versionNumber || versionNumber,
    });
  } catch (error: any) {
    console.error('[SWOT Execute] Error:', error);
    res.status(500).json({ error: error.message || 'SWOT analysis failed' });
  }
});

/**
 * Get framework results for a session (for page refresh/back navigation)
 * GET /api/strategic-consultant/frameworks/:framework/:sessionId
 */
router.get('/frameworks/:framework/:sessionId', async (req: Request, res: Response) => {
  try {
    const { framework, sessionId } = req.params;
    console.log(`[Framework Get] Fetching ${framework} for session:`, sessionId);

    const versions = await storage.getStrategyVersionsBySession(sessionId);
    if (versions.length === 0) {
      return res.status(404).json({ error: 'No analysis data found for this session' });
    }

    const version = versions[versions.length - 1];
    const analysisData = (version.analysisData as any) || {};
    const frameworkData = analysisData[framework];

    if (!frameworkData) {
      return res.status(404).json({ error: `${framework} analysis not found` });
    }

    res.json({
      success: true,
      framework,
      data: frameworkData,
      versionNumber: version.versionNumber,
    });
  } catch (error: any) {
    console.error('[Framework Get] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch framework data' });
  }
});

export default router;
