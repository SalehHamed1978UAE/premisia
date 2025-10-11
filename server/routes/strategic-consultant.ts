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

    res.json({
      success: true,
      version: {
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

    let targetVersionNumber: number;
    if (versionNumber) {
      targetVersionNumber = versionNumber;
    } else {
      const versions = await storage.getStrategyVersionsBySession(sessionId);
      if (versions.length === 0) {
        return res.status(404).json({ error: 'No versions found for this session' });
      }
      targetVersionNumber = versions[versions.length - 1].versionNumber;
    }

    const version = await storage.getStrategyVersion(sessionId, targetVersionNumber);
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const insights = await whysTreeGenerator.analyzePathInsights(input, selectedPath.map((option: string, index: number) => ({
      id: `node-${index}`,
      question: '',
      option,
      depth: index + 1,
      isLeaf: false,
    })));

    const existingAnalysisData = version.analysisData as any || {};
    await storage.updateStrategyVersion(version.id, {
      analysisData: {
        ...existingAnalysisData,
        whysPath: selectedPath,
        rootCause,
        strategicImplications: insights.strategic_implications,
        recommendedActions: insights.recommended_actions,
      },
    });

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

    const validation = whysTreeGenerator.validateRootCause(rootCauseText);

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
  req.socket.setTimeout(600000);
  
  try {
    const { input, sessionId, versionNumber } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Input text is required' });
    }

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Timer-based progress messages: 420s / 8 categories = 52.5s per category
    // Emit message every 5s = 10.5 messages per category
    // 4 categories with 11 messages + 4 categories with 10 messages = 84 total × 5s = 420s
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

    // Start timer: emit message every 5 seconds
    progressInterval = setInterval(() => {
      if (messageIndex < progressMessages.length) {
        const msg = progressMessages[messageIndex];
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
        messageIndex++;
      }
    }, 5000);

    // Send initial message immediately
    res.write(`data: ${JSON.stringify(progressMessages[0])}\n\n`);
    messageIndex = 1;

    // Conduct research WITHOUT progress callback
    const result = await bmcResearcher.conductBMCResearch(input, sessionId);

    // Stop timer
    if (progressInterval) {
      clearInterval(progressInterval);
    }

    // Save to version if provided
    if (sessionId && versionNumber) {
      const version = await storage.getStrategyVersion(sessionId, versionNumber);
      
      if (version) {
        const existingAnalysisData = version.analysisData as any || {};
        await storage.updateStrategyVersion(version.id, {
          analysisData: {
            ...existingAnalysisData,
            bmc_research: result,
          },
        });
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

router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Strategic Consultant API is healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
