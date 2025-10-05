import { Router, Request, Response } from 'express';
import multer from 'multer';
import { InputProcessor } from '../strategic-consultant/input-processor';
import { StrategyAnalyzer } from '../strategic-consultant/strategy-analyzer';
import { DecisionGenerator } from '../strategic-consultant/decision-generator';
import { VersionManager } from '../strategic-consultant/version-manager';
import { EPMConverter } from '../strategic-consultant/epm-converter';
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

    const userId = req.user?.id || 'anonymous';
    const version = await versionManager.createVersion(sessionId, analysis, decisions, userId);

    res.json({
      success: true,
      analysis,
      decisions,
      version: {
        version_number: version.version_number,
        status: version.status,
        created_at: version.created_at,
      },
      metadata: processedInput.metadata,
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
        version_number: updated.version_number,
        status: updated.status,
        selected_decisions: updated.selected_decisions,
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
        version_number: finalized.version_number,
        status: finalized.status,
        finalized_at: finalized.finalized_at,
      },
    });
  } catch (error: any) {
    console.error('Error in /convert-to-epm:', error);
    res.status(500).json({ error: error.message || 'EPM conversion failed' });
  }
});

router.get('/versions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const versions = await versionManager.listVersions(sessionId);

    res.json({
      success: true,
      versions: versions.map(v => ({
        version_number: v.version_number,
        status: v.status,
        created_at: v.created_at,
        finalized_at: v.finalized_at,
        has_selected_decisions: !!v.selected_decisions,
        has_program: !!v.program_structure,
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
        version_number: version.versionNumber,
        status: version.status,
        analysis: version.analysisData,
        decisions: version.decisionsData,
        selected_decisions: version.selectedDecisions,
        program: version.programStructure,
        created_at: version.createdAt,
        finalized_at: version.finalizedAt,
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

router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Strategic Consultant API is healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
