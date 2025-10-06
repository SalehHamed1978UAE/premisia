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

    const userId = req.user?.id || null;
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
    const userId = (req.user as any)?.id;

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
    const userId = (req.user as any)?.id;

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

router.post('/research', async (req: Request, res: Response) => {
  try {
    const { sessionId, rootCause, whysPath, input, versionNumber } = req.body;

    if (!sessionId || !rootCause || !whysPath || !input) {
      return res.status(400).json({ 
        error: 'sessionId, rootCause, whysPath, and input are required' 
      });
    }

    const startTime = Date.now();

    const findings = await marketResearcher.conductResearch(
      sessionId,
      rootCause,
      input,
      whysPath
    );

    const endTime = Date.now();
    const timeElapsedMs = endTime - startTime;
    const timeElapsed = `${(timeElapsedMs / 1000).toFixed(1)}s`;

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
        research: findings,
      },
    });

    const searchQueriesUsed = findings.sources.map(s => s.title);
    const sourcesAnalyzed = findings.sources.length;

    res.json({
      findings,
      searchQueriesUsed,
      sourcesAnalyzed,
      timeElapsed,
      versionNumber: targetVersionNumber,
    });
  } catch (error: any) {
    console.error('Error in /research:', error);
    res.status(500).json({ error: error.message || 'Research failed' });
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

router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Strategic Consultant API is healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
