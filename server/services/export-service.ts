import { Writable } from 'stream';
import archiver from 'archiver';
import { marked } from 'marked';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import puppeteer from 'puppeteer';
import { format } from 'date-fns';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
// @ts-ignore - no type declarations available
import HTMLtoDOCX from 'html-docx-js';
import { getStrategicUnderstandingBySession } from './secure-data-service';
import { db } from '../db';
import { storage } from '../storage';
import {
  journeySessions,
  strategyVersions,
  epmPrograms,
  taskAssignments,
  frameworkInsights,
  strategicUnderstanding,
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Cached Chromium executable path (to avoid repeated execSync calls)
 */
let cachedChromiumPath: string | undefined | null = null;

/**
 * Find the Chromium/Chrome executable path (cached)
 */
function findChromiumExecutable(): string | undefined {
  // Return cached value if already discovered
  if (cachedChromiumPath !== null) {
    return cachedChromiumPath || undefined;
  }

  try {
    const path = execSync('command -v chromium-browser || command -v chromium || command -v google-chrome', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    cachedChromiumPath = path || undefined;
    
    if (cachedChromiumPath) {
      console.log('[Export Service] Chromium executable found:', cachedChromiumPath);
    } else {
      console.warn('[Export Service] Chromium executable not found - PDF generation will be skipped');
    }
    
    return cachedChromiumPath;
  } catch (error) {
    console.warn('[Export Service] Failed to locate Chromium executable:', error instanceof Error ? error.message : String(error));
    cachedChromiumPath = undefined;
    return undefined;
  }
}

export interface ExportRequest {
  sessionId: string;
  versionNumber?: number;
  programId?: string;
  userId: string;
}

export interface FullExportPackage {
  metadata: {
    exportedAt: string;
    sessionId: string;
    versionNumber?: number;
    programId?: string;
    exportedBy: string;
  };
  strategy: {
    understanding?: any;
    journeySession?: any;
    strategyVersion?: any;
    decisions?: any[];
    fiveWhysTree?: any;  // Complete Five Whys tree with all branches
    whysPath?: any[];    // The actual chosen path through the tree
    clarifications?: {   // Strategic input clarifications
      questions?: any[];
      answers?: Record<string, string>;
    };
  };
  epm?: {
    program?: any;
    assignments?: any[];
  };
}

/**
 * Generates a full-pass export bundle containing Markdown, PDF, DOCX, JSON, and CSV files
 * Streams the result as a ZIP archive
 */
export async function generateFullPassExport(
  request: ExportRequest,
  outputStream: Writable
): Promise<void> {
  const { sessionId, versionNumber, programId, userId } = request;

  console.log('[Export Service] Starting export generation:', { sessionId, versionNumber, programId, userId });

  // Load all required data
  console.log('[Export Service] Loading export data...');
  const exportPackage = await loadExportData(sessionId, versionNumber, programId, userId);
  console.log('[Export Service] Data loaded successfully. Version:', exportPackage.metadata.versionNumber);

  // Track which files were included/skipped during generation
  const skippedFiles: string[] = [];
  
  // Generate report content in various formats
  console.log('[Export Service] Generating Markdown report...');
  const markdown = generateMarkdownReport(exportPackage);
  
  console.log('[Export Service] Converting Markdown to HTML...');
  const html = await generateHtmlFromMarkdown(markdown);
  
  // Try to generate PDF from HTML - skip if Puppeteer fails
  console.log('[Export Service] Generating PDF from HTML...');
  let pdf: Buffer | null = null;
  try {
    pdf = await generatePdfFromHtml(html);
    console.log('[Export Service] PDF generated successfully');
  } catch (error) {
    const err = error as Error;
    const errorMsg = err?.message || String(error);
    const isChromiumMissing = errorMsg.toLowerCase().includes('executable') || errorMsg.toLowerCase().includes('browser');
    
    if (isChromiumMissing) {
      console.warn('[Export Service] PDF generation skipped - Chromium not available. Install chromium to enable PDF exports.');
    } else {
      console.warn('[Export Service] PDF generation failed:', errorMsg);
    }
    
    skippedFiles.push(`report.pdf (${isChromiumMissing ? 'Chromium not available' : 'generation failed'})`);
  }
  
  console.log('[Export Service] Generating DOCX report...');
  const docx = await generateDocxReport(exportPackage);
  
  console.log('[Export Service] Generating JSON and CSV exports...');
  const strategyJson = JSON.stringify(exportPackage.strategy, null, 2);
  const epmJson = exportPackage.epm?.program ? JSON.stringify(exportPackage.epm, null, 2) : null;
  const assignmentsCsv = exportPackage.epm?.assignments ? generateAssignmentsCsv(exportPackage.epm.assignments) : null;
  const workstreamsCsv = exportPackage.epm?.program?.workstreams ? generateWorkstreamsCsv(exportPackage.epm.program.workstreams) : null;
  
  // Optional CSVs - generate if data available
  const resourcesCsv = exportPackage.epm?.program?.resourcePlan ? generateResourcesCsv(exportPackage.epm.program.resourcePlan) : null;
  const risksCsv = exportPackage.epm?.program?.riskRegister ? generateRisksCsv(exportPackage.epm.program.riskRegister) : null;
  const benefitsCsv = exportPackage.epm?.program?.benefitsRealization ? generateBenefitsCsv(exportPackage.epm.program.benefitsRealization) : null;

  // Generate UI-styled exports
  console.log('[Export Service] Generating UI-styled HTML...');
  const uiHtml = generateUiStyledHtml(exportPackage);
  
  // Try to generate UI-styled PDF - skip if Puppeteer fails
  console.log('[Export Service] Generating UI-styled PDF...');
  let uiPdf: Buffer | null = null;
  try {
    uiPdf = await generatePdfFromUiHtml(uiHtml);
    console.log('[Export Service] UI-styled PDF generated successfully');
  } catch (error) {
    const err = error as Error;
    const errorMsg = err?.message || String(error);
    const isChromiumMissing = errorMsg.toLowerCase().includes('executable') || errorMsg.toLowerCase().includes('browser');
    
    if (isChromiumMissing) {
      console.warn('[Export Service] UI-styled PDF generation skipped - Chromium not available. Install chromium to enable PDF exports.');
    } else {
      console.warn('[Export Service] UI-styled PDF generation failed:', errorMsg);
    }
    
    skippedFiles.push(`report-ui.pdf (${isChromiumMissing ? 'Chromium not available' : 'generation failed'})`);
  }
  
  console.log('[Export Service] Generating UI-styled DOCX...');
  const uiDocx = await generateDocxFromHtml(uiHtml);

  // Create ZIP archive
  console.log('[Export Service] Creating ZIP archive...');
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  // Handle archive events
  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn('[Export Service] Archive warning:', err);
    } else {
      throw err;
    }
  });

  archive.on('error', (err) => {
    console.error('[Export Service] Archive error:', err);
    throw err;
  });

  // Pipe archive to output stream
  archive.pipe(outputStream);

  // Add files to archive
  console.log('[Export Service] Adding files to archive...');
  
  // Track which files were included
  const includedFiles: string[] = [];
  
  // Always add these core files
  archive.append(markdown, { name: 'report.md' });
  includedFiles.push('report.md');
  
  archive.append(docx, { name: 'report.docx' });
  includedFiles.push('report.docx');
  
  archive.append(uiHtml, { name: 'report-ui.html' });
  includedFiles.push('report-ui.html');
  
  archive.append(uiDocx, { name: 'report-ui.docx' });
  includedFiles.push('report-ui.docx');
  
  // Add PDFs only if successfully generated (skipped files already tracked in catch blocks above)
  if (pdf) {
    archive.append(pdf, { name: 'report.pdf' });
    includedFiles.push('report.pdf');
  }
  
  if (uiPdf) {
    archive.append(uiPdf, { name: 'report-ui.pdf' });
    includedFiles.push('report-ui.pdf');
  }
  
  archive.append(strategyJson, { name: 'data/strategy.json' });
  includedFiles.push('data/strategy.json');
  
  if (epmJson) {
    console.log('[Export Service] Adding EPM data...');
    archive.append(epmJson, { name: 'data/epm.json' });
    includedFiles.push('data/epm.json');
  }
  if (assignmentsCsv) {
    archive.append(assignmentsCsv, { name: 'data/assignments.csv' });
    includedFiles.push('data/assignments.csv');
  }
  if (workstreamsCsv) {
    archive.append(workstreamsCsv, { name: 'data/workstreams.csv' });
    includedFiles.push('data/workstreams.csv');
  }
  if (resourcesCsv) {
    archive.append(resourcesCsv, { name: 'data/resources.csv' });
    includedFiles.push('data/resources.csv');
  }
  if (risksCsv) {
    archive.append(risksCsv, { name: 'data/risks.csv' });
    includedFiles.push('data/risks.csv');
  }
  if (benefitsCsv) {
    archive.append(benefitsCsv, { name: 'data/benefits.csv' });
    includedFiles.push('data/benefits.csv');
  }

  // Create README to inform user about export contents
  const readmeContent = `# Export Package Contents

This ZIP archive contains your strategic analysis and EPM program data in multiple formats.

## Included Files (${includedFiles.length}):

${includedFiles.map(f => `- ${f}`).join('\n')}

${skippedFiles.length > 0 ? `## Note: Some Files Skipped

The following files could not be generated in this environment:

${skippedFiles.map(f => `- ${f}`).join('\n')}

PDF files require Puppeteer (headless Chrome) which may not be available on mobile devices or certain environments. All other formats (Markdown, Word, HTML, JSON, CSV) are included.
` : ''}

## File Descriptions:

- **report.md** - Full Markdown report with all sections
- **report.docx** - Comprehensive Word document
- **report-ui.html** - HTML report with styled cards and tables
- **report-ui.docx** - Word document with styled layout
- **report.pdf** - PDF version (if available)
- **report-ui.pdf** - Styled PDF version (if available)
- **data/strategy.json** - Strategic analysis data in JSON
- **data/epm.json** - EPM program data (if generated)
- **data/*.csv** - Detailed data exports for assignments, workstreams, resources, risks, and benefits

Generated on: ${new Date(exportPackage.metadata.exportedAt).toLocaleString()}
Session ID: ${exportPackage.metadata.sessionId}
${exportPackage.metadata.versionNumber ? `Version: ${exportPackage.metadata.versionNumber}` : ''}
`;

  archive.append(readmeContent, { name: 'README.txt' });

  // Finalize the archive
  console.log('[Export Service] Finalizing archive...');
  console.log(`[Export Service] Archive contains ${includedFiles.length + 1} files (including README)`);
  if (skippedFiles.length > 0) {
    console.log(`[Export Service] ${skippedFiles.length} files were skipped due to Puppeteer unavailability`);
  }
  await archive.finalize();
  console.log('[Export Service] Export package created successfully');
}

/**
 * Load all data needed for the export
 */
async function loadExportData(
  sessionId: string,
  versionNumber: number | undefined,
  programId: string | undefined,
  userId: string
): Promise<FullExportPackage> {
  console.log('[Export Service] loadExportData - Loading strategic understanding for sessionId:', sessionId);
  // Load strategic understanding
  const understanding = await getStrategicUnderstandingBySession(sessionId);
  console.log('[Export Service] loadExportData - Understanding loaded:', understanding ? 'Yes' : 'No');
  
  // Debug: Check if userInput is still encrypted
  if (understanding?.userInput) {
    const isEncrypted = understanding.userInput.includes(':') && understanding.userInput.split(':').length === 3;
    console.log('[Export Service] userInput encryption status:', {
      isEncrypted,
      firstChars: understanding.userInput.substring(0, 50),
      length: understanding.userInput.length
    });
  }

  // Load journey session
  console.log('[Export Service] loadExportData - Loading journey session...');
  const [journeySession] = await db.select()
    .from(journeySessions)
    .where(eq(journeySessions.understandingId, understanding?.id || sessionId))
    .limit(1);
  console.log('[Export Service] loadExportData - Journey session loaded:', journeySession ? 'Yes' : 'No');

  // Load strategy version (using storage layer to ensure decryption)
  console.log('[Export Service] loadExportData - Loading strategy version. Requested version:', versionNumber);
  let strategyVersion;
  if (versionNumber !== undefined) {
    strategyVersion = await storage.getStrategyVersion(sessionId, versionNumber);
    console.log('[Export Service] loadExportData - Loaded specific version:', versionNumber);
  } else {
    // Get latest version
    const versions = await storage.getStrategyVersionsBySession(sessionId);
    strategyVersion = versions[0]; // Already sorted by descending version number
    console.log('[Export Service] loadExportData - Loaded latest version:', strategyVersion?.versionNumber);
  }

  // Load EPM program if programId provided
  let epmProgram;
  let assignments: any[] = [];
  
  if (programId) {
    [epmProgram] = await db.select()
      .from(epmPrograms)
      .where(eq(epmPrograms.id, programId))
      .limit(1);

    if (epmProgram) {
      assignments = await db.select()
        .from(taskAssignments)
        .where(eq(taskAssignments.epmProgramId, programId));
    }
  }

  // Load Five Whys complete tree from framework_insights
  console.log('[Export Service] loadExportData - Fetching Five Whys tree from framework_insights...');
  let fiveWhysTree;
  let whysPath;
  if (journeySession) {
    const [fiveWhysInsight] = await db.select()
      .from(frameworkInsights)
      .where(
        and(
          eq(frameworkInsights.sessionId, journeySession.id),
          eq(frameworkInsights.frameworkName, 'five_whys')
        )
      )
      .orderBy(desc(frameworkInsights.createdAt))
      .limit(1);
    
    if (fiveWhysInsight?.insights) {
      const insights = typeof fiveWhysInsight.insights === 'string' 
        ? JSON.parse(fiveWhysInsight.insights) 
        : fiveWhysInsight.insights;
      fiveWhysTree = insights.tree;
      whysPath = insights.whysPath || [];
      console.log('[Export Service] Five Whys tree loaded:', fiveWhysTree ? 'Yes' : 'No');
      console.log('[Export Service] Five Whys path loaded:', whysPath?.length || 0, 'steps');
    }
  }

  // Load clarifications from strategic_understanding.strategyMetadata
  console.log('[Export Service] loadExportData - Fetching clarifications from strategic understanding...');
  let clarifications;
  if (understanding) {
    const metadata = typeof (understanding as any).strategyMetadata === 'string'
      ? JSON.parse((understanding as any).strategyMetadata)
      : (understanding as any).strategyMetadata;
    
    console.log('[Export Service] strategyMetadata keys:', metadata ? Object.keys(metadata) : 'null');
    
    // Try multiple field paths to find clarification questions
    let questions = null;
    let answers = null;
    
    // Try path 1: metadata.clarificationQuestions
    if (metadata?.clarificationQuestions) {
      questions = metadata.clarificationQuestions;
      console.log('[Export Service] Found clarificationQuestions in metadata');
    }
    
    // Try path 2: metadata.clarificationContext.questions
    if (!questions && metadata?.clarificationContext?.questions) {
      questions = metadata.clarificationContext.questions;
      console.log('[Export Service] Found clarificationContext.questions in metadata');
    }
    
    // Try path 3: metadata.questions
    if (!questions && metadata?.questions) {
      questions = metadata.questions;
      console.log('[Export Service] Found questions in metadata');
    }
    
    // Try to find answers
    if (metadata?.clarificationsProvided) {
      answers = metadata.clarificationsProvided;
      console.log('[Export Service] Found clarificationsProvided');
    } else if (metadata?.clarificationContext?.answers) {
      answers = metadata.clarificationContext.answers;
      console.log('[Export Service] Found clarificationContext.answers');
    } else if (metadata?.answers) {
      answers = metadata.answers;
      console.log('[Export Service] Found answers');
    }
    
    // Only create clarifications object if we found both questions and answers
    if (questions && answers) {
      clarifications = {
        questions: Array.isArray(questions) ? questions : [],
        answers: typeof answers === 'object' ? answers : {},
      };
      console.log('[Export Service] Clarifications loaded:', clarifications.questions?.length || 0, 'questions');
    } else {
      console.log('[Export Service] No clarifications found. Questions:', !!questions, 'Answers:', !!answers);
    }
  }

  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      sessionId,
      versionNumber: versionNumber ?? strategyVersion?.versionNumber,
      programId,
      exportedBy: userId,
    },
    strategy: {
      understanding,
      journeySession,
      strategyVersion,
      decisions: strategyVersion?.decisions as any[] ?? [],
      fiveWhysTree,
      whysPath,
      clarifications,
    },
    epm: epmProgram ? {
      program: epmProgram,
      assignments,
    } : undefined,
  };
}

/**
 * Generate markdown for complete Five Whys tree with all branches
 */
function generateFiveWhysTreeMarkdown(tree: any, whysPath?: any[]): string {
  if (!tree) return '';
  
  const lines: string[] = [];
  lines.push('## Five Whys - Complete Analysis Tree\n');
  lines.push(`**Root Question:** ${tree.rootQuestion}\n`);
  lines.push(`**Maximum Depth:** ${tree.maxDepth} levels\n`);
  
  // Helper function to check if a node is in the chosen path
  const isNodeInPath = (nodeOption: string, nodeQuestion?: string): boolean => {
    if (!whysPath || whysPath.length === 0) return false;
    
    // Check if the node's option or question matches any entry in whysPath
    return whysPath.some((pathStep: any) => {
      if (typeof pathStep === 'string') {
        // Direct string comparison
        return pathStep === nodeOption || pathStep === nodeQuestion;
      } else if (pathStep && typeof pathStep === 'object') {
        // Check against various possible fields
        const stepText = pathStep.option || pathStep.question || pathStep.why || pathStep.answer || '';
        return stepText === nodeOption || stepText === nodeQuestion;
      }
      return false;
    });
  };
  
  // Helper function to render a node and its branches recursively
  const renderNode = (node: any, level: number): void => {
    const indent = '  '.repeat(level);
    const isChosen = isNodeInPath(node.option, node.question);
    const chosenMarker = isChosen ? ' ✓ (Chosen path)' : '';
    
    lines.push(`${indent}${level + 1}. **${node.option}**${chosenMarker}`);
    
    if (node.supporting_evidence && node.supporting_evidence.length > 0) {
      lines.push(`${indent}   - **Supporting Evidence:**`);
      node.supporting_evidence.forEach((evidence: string) => {
        lines.push(`${indent}     - ${evidence}`);
      });
    }
    
    if (node.counter_arguments && node.counter_arguments.length > 0) {
      lines.push(`${indent}   - **Counter Arguments:**`);
      node.counter_arguments.forEach((counter: string) => {
        lines.push(`${indent}     - ${counter}`);
      });
    }
    
    if (node.consideration) {
      lines.push(`${indent}   - **Consideration:** ${node.consideration}`);
    }
    
    if (node.question && node.branches && node.branches.length > 0) {
      lines.push(`${indent}   - **Next Question:** ${node.question}\n`);
    }
    
    lines.push('');
  };
  
  // Render each depth level showing all alternatives
  if (tree.branches && tree.branches.length > 0) {
    lines.push('### Level 1 Options:\n');
    
    tree.branches.forEach((branch: any) => {
      renderNode(branch, 0);
      
      // Recursively render sub-branches
      if (branch.branches && branch.branches.length > 0) {
        lines.push(`### Level 2 Options (from "${branch.option}"):\n`);
        branch.branches.forEach((subBranch: any) => {
          renderNode(subBranch, 1);
          
          // Level 3
          if (subBranch.branches && subBranch.branches.length > 0) {
            lines.push(`### Level 3 Options (from "${subBranch.option}"):\n`);
            subBranch.branches.forEach((subSubBranch: any) => {
              renderNode(subSubBranch, 2);
              
              // Level 4
              if (subSubBranch.branches && subSubBranch.branches.length > 0) {
                lines.push(`### Level 4 Options (from "${subSubBranch.option}"):\n`);
                subSubBranch.branches.forEach((level4: any) => {
                  renderNode(level4, 3);
                  
                  // Level 5
                  if (level4.branches && level4.branches.length > 0) {
                    lines.push(`### Level 5 Options (from "${level4.option}"):\n`);
                    level4.branches.forEach((level5: any) => {
                      renderNode(level5, 4);
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }
  
  lines.push('\n---\n');
  return lines.join('\n');
}

/**
 * Generate markdown for strategic input clarifications
 */
function generateClarificationsMarkdown(clarifications: any): string {
  if (!clarifications || !clarifications.questions || clarifications.questions.length === 0) {
    return '';
  }
  
  const lines: string[] = [];
  lines.push('## Strategic Input Clarifications\n');
  lines.push('During initial analysis, you provided the following clarifications:\n');
  
  clarifications.questions.forEach((q: any) => {
    lines.push(`**${q.question}**\n`);
    
    if (q.options && Array.isArray(q.options)) {
      q.options.forEach((option: any) => {
        const isChosen = clarifications.answers && clarifications.answers[q.id] === option.value;
        const chosenMarker = isChosen ? ' ✓ (You chose this)' : '';
        lines.push(`- **${option.label}**${chosenMarker}`);
        if (option.description) {
          lines.push(`  - ${option.description}`);
        }
      });
    }
    
    lines.push('');
  });
  
  lines.push('\n---\n');
  return lines.join('\n');
}

/**
 * Generate comprehensive Markdown report covering all strategic analysis and EPM components
 */
function generateMarkdownReport(pkg: FullExportPackage): string {
  const lines: string[] = [];
  
  // Parse JSONB fields safely with error handling
  const parseField = (field: any) => {
    if (!field) return null;
    if (typeof field === 'object') return field;
    
    // Handle string JSONB fields
    try {
      return JSON.parse(field);
    } catch (err) {
      console.warn('[Export] Failed to parse JSONB field:', err);
      return null;
    }
  };

  // Header
  lines.push('# Premisia Strategic Analysis & EPM Program Report\n');
  lines.push(`**Generated:** ${format(new Date(pkg.metadata.exportedAt), 'PPpp')}\n`);
  lines.push(`**Session ID:** ${pkg.metadata.sessionId}`);
  if (pkg.metadata.versionNumber) {
    lines.push(`**Version:** ${pkg.metadata.versionNumber}`);
  }
  lines.push('\n---\n');

  // ======================
  // STRATEGIC UNDERSTANDING
  // ======================
  if (pkg.strategy.understanding) {
    const u = pkg.strategy.understanding;
    lines.push('## Strategic Understanding\n');
    lines.push(`**Title:** ${u.title || 'Untitled Initiative'}\n`);
    lines.push(`**Initiative Type:** ${u.initiativeType || 'Not classified'}\n`);
    if (u.classificationConfidence) {
      lines.push(`**Classification Confidence:** ${(parseFloat(u.classificationConfidence as any) * 100).toFixed(0)}%\n`);
    }
    
    if (u.initiativeDescription) {
      lines.push(`\n**Description:**\n${u.initiativeDescription}\n`);
    }
    
    if (u.userInput) {
      lines.push(`\n**Original User Input:**\n${u.userInput}\n`);
    }
    
    lines.push('\n---\n');
  }

  // ======================
  // STRATEGIC INPUT CLARIFICATIONS
  // ======================
  if (pkg.strategy.clarifications) {
    const clarificationsMarkdown = generateClarificationsMarkdown(pkg.strategy.clarifications);
    if (clarificationsMarkdown) {
      lines.push(clarificationsMarkdown);
    }
  }

  // ======================
  // STRATEGIC JOURNEY
  // ======================
  if (pkg.strategy.journeySession) {
    const j = pkg.strategy.journeySession;
    lines.push('## Strategic Journey\n');
    lines.push(`**Journey Type:** ${j.journeyType || 'Custom'}\n`);
    lines.push(`**Status:** ${j.status}\n`);
    
    if (j.completedFrameworks && j.completedFrameworks.length > 0) {
      lines.push(`\n**Completed Frameworks:**\n`);
      j.completedFrameworks.forEach((fw: string) => lines.push(`- ${fw}`));
      lines.push('');
    }
    
    lines.push('\n---\n');
    
    // Extract framework analysis from accumulated context
    const context = parseField(j.accumulatedContext);
    const insights = context?.insights || {};
    
    // ======================
    // FIVE WHYS ANALYSIS - COMPLETE TREE
    // ======================
    // First, try to include the complete Five Whys tree with all branches
    if (pkg.strategy.fiveWhysTree) {
      const treeMarkdown = generateFiveWhysTreeMarkdown(pkg.strategy.fiveWhysTree, pkg.strategy.whysPath);
      if (treeMarkdown) {
        lines.push(treeMarkdown);
      }
    }
    
    // ======================
    // FIVE WHYS ANALYSIS - CHOSEN PATH SUMMARY
    // ======================
    // Then include the chosen path summary for quick reference
    if (insights.rootCauses || insights.whysPath || insights.strategicImplications) {
      lines.push('## Five Whys - Chosen Path Summary\n');
      
      if (insights.whysPath && insights.whysPath.length > 0) {
        lines.push('\n**Analysis Path (Chosen):**\n');
        insights.whysPath.forEach((step: any, idx: number) => {
          if (typeof step === 'string') {
            lines.push(`${idx + 1}. ${step}`);
          } else {
            lines.push(`${idx + 1}. **Why?** ${step.question || step.why || step}`);
            if (step.answer) {
              lines.push(`   **Answer:** ${step.answer}\n`);
            }
          }
        });
        lines.push('');
      }
      
      if (insights.rootCauses && insights.rootCauses.length > 0) {
        lines.push('\n**Identified Root Causes:**\n');
        insights.rootCauses.forEach((cause: string) => {
          lines.push(`- ${cause}`);
        });
        lines.push('');
      }
      
      if (insights.strategicImplications && insights.strategicImplications.length > 0) {
        lines.push('\n**Strategic Implications:**\n');
        insights.strategicImplications.forEach((imp: string) => {
          lines.push(`- ${imp}`);
        });
        lines.push('');
      }
      
      lines.push('---\n');
    }
    
    // ======================
    // BUSINESS MODEL CANVAS ANALYSIS
    // ======================
    if (insights.bmcBlocks) {
      const bmc = insights.bmcBlocks;
      lines.push('## Business Model Canvas Analysis\n');
      
      if (bmc.customerSegments) {
        lines.push('\n### Customer Segments\n');
        if (typeof bmc.customerSegments === 'string') {
          lines.push(`${bmc.customerSegments}\n`);
        } else if (Array.isArray(bmc.customerSegments)) {
          bmc.customerSegments.forEach((seg: string) => lines.push(`- ${seg}`));
          lines.push('');
        } else if (bmc.customerSegments.segments) {
          bmc.customerSegments.segments.forEach((seg: any) => {
            lines.push(`- **${seg.name || 'Segment'}:** ${seg.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (bmc.valuePropositions) {
        lines.push('\n### Value Propositions\n');
        if (typeof bmc.valuePropositions === 'string') {
          lines.push(`${bmc.valuePropositions}\n`);
        } else if (Array.isArray(bmc.valuePropositions)) {
          bmc.valuePropositions.forEach((vp: string) => lines.push(`- ${vp}`));
          lines.push('');
        } else if (bmc.valuePropositions.propositions) {
          bmc.valuePropositions.propositions.forEach((vp: any) => {
            lines.push(`- **${vp.title || 'Value Proposition'}:** ${vp.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (bmc.channels) {
        lines.push('\n### Channels\n');
        if (typeof bmc.channels === 'string') {
          lines.push(`${bmc.channels}\n`);
        } else if (Array.isArray(bmc.channels)) {
          bmc.channels.forEach((ch: string) => lines.push(`- ${ch}`));
          lines.push('');
        } else if (bmc.channels.channels) {
          bmc.channels.channels.forEach((ch: any) => {
            lines.push(`- **${ch.name || 'Channel'}:** ${ch.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (bmc.customerRelationships) {
        lines.push('\n### Customer Relationships\n');
        if (typeof bmc.customerRelationships === 'string') {
          lines.push(`${bmc.customerRelationships}\n`);
        } else if (Array.isArray(bmc.customerRelationships)) {
          bmc.customerRelationships.forEach((rel: string) => lines.push(`- ${rel}`));
          lines.push('');
        } else if (bmc.customerRelationships.relationships) {
          bmc.customerRelationships.relationships.forEach((rel: any) => {
            lines.push(`- **${rel.type || 'Relationship'}:** ${rel.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (bmc.revenueStreams) {
        lines.push('\n### Revenue Streams\n');
        if (typeof bmc.revenueStreams === 'string') {
          lines.push(`${bmc.revenueStreams}\n`);
        } else if (Array.isArray(bmc.revenueStreams)) {
          bmc.revenueStreams.forEach((rev: string) => lines.push(`- ${rev}`));
          lines.push('');
        } else if (bmc.revenueStreams.streams) {
          bmc.revenueStreams.streams.forEach((rev: any) => {
            lines.push(`- **${rev.name || 'Revenue Stream'}:** ${rev.description || ''}`);
            if (rev.pricingModel) lines.push(`  - Pricing: ${rev.pricingModel}`);
          });
          lines.push('');
        }
      }
      
      if (bmc.keyResources) {
        lines.push('\n### Key Resources\n');
        if (typeof bmc.keyResources === 'string') {
          lines.push(`${bmc.keyResources}\n`);
        } else if (Array.isArray(bmc.keyResources)) {
          bmc.keyResources.forEach((res: string) => lines.push(`- ${res}`));
          lines.push('');
        } else if (bmc.keyResources.resources) {
          bmc.keyResources.resources.forEach((res: any) => {
            lines.push(`- **${res.name || 'Resource'}:** ${res.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (bmc.keyActivities) {
        lines.push('\n### Key Activities\n');
        if (typeof bmc.keyActivities === 'string') {
          lines.push(`${bmc.keyActivities}\n`);
        } else if (Array.isArray(bmc.keyActivities)) {
          bmc.keyActivities.forEach((act: string) => lines.push(`- ${act}`));
          lines.push('');
        } else if (bmc.keyActivities.activities) {
          bmc.keyActivities.activities.forEach((act: any) => {
            lines.push(`- **${act.name || 'Activity'}:** ${act.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (bmc.keyPartnerships) {
        lines.push('\n### Key Partnerships\n');
        if (typeof bmc.keyPartnerships === 'string') {
          lines.push(`${bmc.keyPartnerships}\n`);
        } else if (Array.isArray(bmc.keyPartnerships)) {
          bmc.keyPartnerships.forEach((part: string) => lines.push(`- ${part}`));
          lines.push('');
        } else if (bmc.keyPartnerships.partnerships) {
          bmc.keyPartnerships.partnerships.forEach((part: any) => {
            lines.push(`- **${part.partner || 'Partner'}:** ${part.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (bmc.costStructure) {
        lines.push('\n### Cost Structure\n');
        if (typeof bmc.costStructure === 'string') {
          lines.push(`${bmc.costStructure}\n`);
        } else if (Array.isArray(bmc.costStructure)) {
          bmc.costStructure.forEach((cost: string) => lines.push(`- ${cost}`));
          lines.push('');
        } else if (bmc.costStructure.costs) {
          bmc.costStructure.costs.forEach((cost: any) => {
            lines.push(`- **${cost.category || 'Cost'}:** ${cost.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (insights.bmcContradictions && insights.bmcContradictions.length > 0) {
        lines.push('\n### Identified Contradictions\n');
        insights.bmcContradictions.forEach((cont: any) => {
          if (typeof cont === 'string') {
            lines.push(`- ${cont}`);
          } else {
            lines.push(`- **${cont.title || 'Contradiction'}:** ${cont.description || cont.issue || ''}`);
            if (cont.recommendation) lines.push(`  - *Recommendation:* ${cont.recommendation}`);
          }
        });
        lines.push('');
      }
      
      if (insights.businessModelGaps && insights.businessModelGaps.length > 0) {
        lines.push('\n### Critical Gaps\n');
        insights.businessModelGaps.forEach((gap: any) => {
          if (typeof gap === 'string') {
            lines.push(`- ${gap}`);
          } else {
            lines.push(`- **${gap.area || 'Gap'}:** ${gap.description || ''}`);
            if (gap.impact) lines.push(`  - *Impact:* ${gap.impact}`);
          }
        });
        lines.push('');
      }
      
      lines.push('---\n');
    }
    
    // ======================
    // PORTER'S FIVE FORCES ANALYSIS
    // ======================
    if (insights.portersForces) {
      lines.push('## Porter\'s Five Forces Analysis\n');
      const forces = insights.portersForces;
      
      if (forces.competitiveRivalry || forces.competitive_rivalry) {
        const rivalry = forces.competitiveRivalry || forces.competitive_rivalry;
        lines.push('\n### Competitive Rivalry\n');
        if (typeof rivalry === 'string') {
          lines.push(`${rivalry}\n`);
        } else {
          if (rivalry.intensity) lines.push(`**Intensity:** ${rivalry.intensity}\n`);
          if (rivalry.factors && Array.isArray(rivalry.factors)) {
            rivalry.factors.forEach((f: string) => lines.push(`- ${f}`));
            lines.push('');
          }
        }
      }
      
      if (forces.threatOfNewEntrants || forces.threat_of_new_entrants) {
        const threat = forces.threatOfNewEntrants || forces.threat_of_new_entrants;
        lines.push('\n### Threat of New Entrants\n');
        if (typeof threat === 'string') {
          lines.push(`${threat}\n`);
        } else {
          if (threat.level) lines.push(`**Threat Level:** ${threat.level}\n`);
          if (threat.barriers && Array.isArray(threat.barriers)) {
            lines.push('**Entry Barriers:**\n');
            threat.barriers.forEach((b: string) => lines.push(`- ${b}`));
            lines.push('');
          }
        }
      }
      
      if (forces.bargainingPowerOfSuppliers || forces.supplier_power) {
        const power = forces.bargainingPowerOfSuppliers || forces.supplier_power;
        lines.push('\n### Bargaining Power of Suppliers\n');
        if (typeof power === 'string') {
          lines.push(`${power}\n`);
        } else {
          if (power.power) lines.push(`**Power Level:** ${power.power}\n`);
          if (power.factors && Array.isArray(power.factors)) {
            power.factors.forEach((f: string) => lines.push(`- ${f}`));
            lines.push('');
          }
        }
      }
      
      if (forces.bargainingPowerOfBuyers || forces.buyer_power) {
        const power = forces.bargainingPowerOfBuyers || forces.buyer_power;
        lines.push('\n### Bargaining Power of Buyers\n');
        if (typeof power === 'string') {
          lines.push(`${power}\n`);
        } else {
          if (power.power) lines.push(`**Power Level:** ${power.power}\n`);
          if (power.factors && Array.isArray(power.factors)) {
            power.factors.forEach((f: string) => lines.push(`- ${f}`));
            lines.push('');
          }
        }
      }
      
      if (forces.threatOfSubstitutes || forces.threat_of_substitutes) {
        const threat = forces.threatOfSubstitutes || forces.threat_of_substitutes;
        lines.push('\n### Threat of Substitutes\n');
        if (typeof threat === 'string') {
          lines.push(`${threat}\n`);
        } else {
          if (threat.level) lines.push(`**Threat Level:** ${threat.level}\n`);
          if (threat.substitutes && Array.isArray(threat.substitutes)) {
            threat.substitutes.forEach((s: string) => lines.push(`- ${s}`));
            lines.push('');
          }
        }
      }
      
      lines.push('---\n');
    }
    
    // ======================
    // PESTLE ANALYSIS
    // ======================
    if (insights.trendFactors || insights.externalForces) {
      lines.push('## PESTLE Analysis\n');
      const factors = insights.trendFactors ?? insights.externalForces ?? {};
      
      ['political', 'economic', 'social', 'technological', 'legal', 'environmental'].forEach((category: string) => {
        if (factors[category]) {
          lines.push(`\n### ${category.charAt(0).toUpperCase() + category.slice(1)} Factors\n`);
          const catData = factors[category];
          
          if (typeof catData === 'string') {
            lines.push(`${catData}\n`);
          } else if (Array.isArray(catData)) {
            catData.forEach((item: string) => lines.push(`- ${item}`));
            lines.push('');
          } else {
            if (catData.trends && Array.isArray(catData.trends)) {
              lines.push('**Trends:**\n');
              catData.trends.forEach((t: string) => lines.push(`- ${t}`));
              lines.push('');
            }
            if (catData.opportunities && Array.isArray(catData.opportunities)) {
              lines.push('**Opportunities:**\n');
              catData.opportunities.forEach((o: string) => lines.push(`- ${o}`));
              lines.push('');
            }
            if (catData.risks && Array.isArray(catData.risks)) {
              lines.push('**Risks:**\n');
              catData.risks.forEach((r: string) => lines.push(`- ${r}`));
              lines.push('');
            }
          }
        }
      });
      
      lines.push('---\n');
    }
  }

  // ======================
  // STRATEGIC DECISIONS
  // ======================
  if (pkg.strategy.strategyVersion) {
    const sv = pkg.strategy.strategyVersion;
    lines.push('## Strategic Decisions\n');
    
    if (sv.versionLabel) {
      lines.push(`**Version:** ${sv.versionLabel}\n`);
    }
    
    if (sv.inputSummary) {
      lines.push(`\n**Summary:**\n${sv.inputSummary}\n`);
    }
    
    if (pkg.strategy.decisions && pkg.strategy.decisions.length > 0) {
      lines.push('\n### Selected Decisions\n');
      pkg.strategy.decisions.forEach((decision: any, idx: number) => {
        const decType = decision.type || decision.category || 'Decision';
        const decValue = decision.value || decision.description || decision.choice || 'Not specified';
        lines.push(`${idx + 1}. **${decType}:** ${decValue}`);
        if (decision.rationale) {
          lines.push(`   - *Rationale:* ${decision.rationale}`);
        }
      });
      lines.push('');
    }
    
    lines.push('\n---\n');
  }

  // ======================
  // EPM PROGRAM - 14 COMPONENTS
  // ======================
  if (pkg.epm?.program) {
    const program = pkg.epm.program;
    const execSummary = parseField(program.executiveSummary);
    const workstreams = parseField(program.workstreams);
    const timeline = parseField(program.timeline);
    const resourcePlan = parseField(program.resourcePlan);
    const financialPlan = parseField(program.financialPlan);
    const benefits = parseField(program.benefitsRealization);
    const risks = parseField(program.riskRegister);
    const stageGates = parseField(program.stageGates);
    const kpis = parseField(program.kpis);
    const stakeholders = parseField(program.stakeholderMap);
    const governance = parseField(program.governance);
    const qaPlan = parseField(program.qaPlan);
    const procurement = parseField(program.procurement);
    const exitStrategy = parseField(program.exitStrategy);

    lines.push('# Enterprise Program Management (EPM) Program\n');
    lines.push(`**Framework:** ${program.frameworkType || 'Not specified'}\n`);
    lines.push(`**Status:** ${program.status}\n`);
    
    // Format overall confidence with guards
    const confidenceValue = program.overallConfidence ? parseFloat(program.overallConfidence as any) : null;
    const confidenceText = (confidenceValue !== null && !isNaN(confidenceValue)) 
      ? `${(confidenceValue * 100).toFixed(1)}%`
      : 'Not calculated';
    lines.push(`**Overall Confidence:** ${confidenceText}\n`);
    lines.push('\n---\n');

    // 1. EXECUTIVE SUMMARY
    if (execSummary) {
      lines.push('## 1. Executive Summary\n');
      
      if (execSummary.title) {
        lines.push(`**Program Title:** ${execSummary.title}\n`);
      }
      
      if (execSummary.overview || execSummary.summary) {
        lines.push(`\n${execSummary.overview || execSummary.summary}\n`);
      }
      
      if (execSummary.objectives && execSummary.objectives.length > 0) {
        lines.push('\n**Strategic Objectives:**\n');
        execSummary.objectives.forEach((obj: string, idx: number) => {
          lines.push(`${idx + 1}. ${obj}`);
        });
        lines.push('');
      }
      
      if (execSummary.scope) {
        lines.push(`\n**Scope:** ${execSummary.scope}\n`);
      }
      
      if (execSummary.successCriteria && execSummary.successCriteria.length > 0) {
        lines.push('\n**Success Criteria:**\n');
        execSummary.successCriteria.forEach((criteria: string) => {
          lines.push(`- ${criteria}`);
        });
        lines.push('');
      }
      
      lines.push('\n---\n');
    }

    // 2. WORKSTREAMS
    if (workstreams && workstreams.length > 0) {
      lines.push('## 2. Workstreams\n');
      
      workstreams.forEach((ws: any, idx: number) => {
        lines.push(`### ${idx + 1}. ${ws.name || `Workstream ${idx + 1}`}\n`);
        
        if (ws.description) {
          lines.push(`${ws.description}\n`);
        }
        
        if (ws.owner) {
          lines.push(`**Owner:** ${ws.owner}`);
        }
        
        if (ws.startMonth !== undefined && ws.endMonth !== undefined) {
          lines.push(`**Duration:** Month ${ws.startMonth} to Month ${ws.endMonth}`);
        }
        
        if (ws.dependencies && ws.dependencies.length > 0) {
          lines.push(`**Dependencies:** ${ws.dependencies.join(', ')}`);
        }
        
        if (ws.deliverables && ws.deliverables.length > 0) {
          lines.push('\n**Key Deliverables:**');
          ws.deliverables.forEach((d: any) => {
            const delName = typeof d === 'string' ? d : (d.name || d.title || 'Deliverable');
            lines.push(`- ${delName}`);
          });
        }
        
        if (ws.tasks && ws.tasks.length > 0) {
          lines.push(`\n**Tasks:** ${ws.tasks.length} tasks defined`);
        }
        
        lines.push('');
      });
      
      lines.push('---\n');
    }

    // 3. TIMELINE & CRITICAL PATH
    if (timeline) {
      lines.push('## 3. Timeline & Critical Path\n');
      
      if (timeline.totalDuration) {
        lines.push(`**Total Program Duration:** ${timeline.totalDuration} months\n`);
      }
      
      if (timeline.phases && timeline.phases.length > 0) {
        lines.push('\n**Program Phases:**\n');
        timeline.phases.forEach((phase: any) => {
          lines.push(`- **${phase.name}:** Month ${phase.startMonth} to Month ${phase.endMonth}`);
          if (phase.milestones && phase.milestones.length > 0) {
            lines.push(`  - Milestones: ${phase.milestones.join(', ')}`);
          }
        });
        lines.push('');
      }
      
      if (timeline.criticalPath && timeline.criticalPath.length > 0) {
        lines.push('\n**Critical Path:**\n');
        timeline.criticalPath.forEach((item: string) => {
          lines.push(`- ${item}`);
        });
        lines.push('');
      }
      
      if (timeline.milestones && timeline.milestones.length > 0) {
        lines.push('\n**Key Milestones:**\n');
        timeline.milestones.forEach((m: any) => {
          const mName = typeof m === 'string' ? m : (m.name || m.title);
          const mDate = m.date || m.month ? ` (${m.date || `Month ${m.month}`})` : '';
          lines.push(`- ${mName}${mDate}`);
        });
        lines.push('');
      }
      
      lines.push('---\n');
    }

    // 4. RESOURCE PLAN
    if (resourcePlan) {
      lines.push('## 4. Resource Plan\n');
      
      if (resourcePlan.internalTeam && resourcePlan.internalTeam.length > 0) {
        lines.push('\n### Internal Team\n');
        lines.push('| Role | FTE | Responsibilities |');
        lines.push('|------|-----|------------------|');
        resourcePlan.internalTeam.forEach((r: any) => {
          const role = r.role || r.title || 'Not specified';
          const fte = r.fte || r.allocation || 'TBD';
          const resp = r.responsibilities || r.description || '-';
          lines.push(`| ${role} | ${fte} | ${resp} |`);
        });
        lines.push('');
      }
      
      if (resourcePlan.externalResources && resourcePlan.externalResources.length > 0) {
        lines.push('\n### External Resources\n');
        lines.push('| Type | Quantity | Skills Required |');
        lines.push('|------|----------|-----------------|');
        resourcePlan.externalResources.forEach((r: any) => {
          const type = r.type || r.role || 'Contractor';
          const qty = r.quantity || r.count || '1';
          const skills = r.skills || r.requirements || '-';
          lines.push(`| ${type} | ${qty} | ${skills} |`);
        });
        lines.push('');
      }
      
      if (resourcePlan.totalFTE) {
        lines.push(`\n**Total FTE Required:** ${resourcePlan.totalFTE}\n`);
      }
      
      lines.push('---\n');
    }

    // 5. FINANCIAL PLAN
    if (financialPlan) {
      lines.push('## 5. Financial Plan\n');
      
      if (financialPlan.totalBudget) {
        const budget = typeof financialPlan.totalBudget === 'number' 
          ? `$${financialPlan.totalBudget.toLocaleString()}`
          : financialPlan.totalBudget;
        lines.push(`**Total Program Budget:** ${budget}\n`);
      }
      
      if (financialPlan.costBreakdown && financialPlan.costBreakdown.length > 0) {
        lines.push('\n### Cost Breakdown\n');
        lines.push('| Category | Amount | Percentage |');
        lines.push('|----------|--------|------------|');
        financialPlan.costBreakdown.forEach((item: any) => {
          const category = item.category || item.name || 'Other';
          const amount = typeof item.amount === 'number' ? `$${item.amount.toLocaleString()}` : item.amount;
          const pct = item.percentage || '-';
          lines.push(`| ${category} | ${amount} | ${pct} |`);
        });
        lines.push('');
      }
      
      if (financialPlan.cashFlow && financialPlan.cashFlow.length > 0) {
        lines.push('\n### Cash Flow Projection\n');
        financialPlan.cashFlow.forEach((cf: any) => {
          lines.push(`- **${cf.period || `Period ${cf.month || cf.quarter}`}:** $${cf.amount?.toLocaleString() || '0'}`);
        });
        lines.push('');
      }
      
      lines.push('---\n');
    }

    // 6. BENEFITS REALIZATION
    if (benefits) {
      lines.push('## 6. Benefits Realization\n');
      
      if (benefits.benefits && benefits.benefits.length > 0) {
        lines.push('\n### Expected Benefits\n');
        benefits.benefits.forEach((b: any, idx: number) => {
          lines.push(`${idx + 1}. **${b.name || b.benefit}**`);
          if (b.description) {
            lines.push(`   - ${b.description}`);
          }
          if (b.metric) {
            lines.push(`   - **Metric:** ${b.metric}`);
          }
          if (b.target) {
            lines.push(`   - **Target:** ${b.target}`);
          }
          if (b.timeframe) {
            lines.push(`   - **Timeframe:** ${b.timeframe}`);
          }
        });
        lines.push('');
      }
      
      if (benefits.realizationPlan) {
        lines.push(`\n**Realization Plan:** ${benefits.realizationPlan}\n`);
      }
      
      lines.push('---\n');
    }

    // 7. RISK REGISTER
    if (risks) {
      lines.push('## 7. Risk Register\n');
      
      const riskArray = risks.risks || risks;
      if (Array.isArray(riskArray) && riskArray.length > 0) {
        lines.push('| Risk | Probability | Impact | Mitigation |');
        lines.push('|------|-------------|--------|------------|');
        riskArray.forEach((r: any) => {
          const name = r.risk || r.name || r.description || 'Unnamed risk';
          const prob = r.probability || r.likelihood || '-';
          const impact = r.impact || r.severity || '-';
          const mit = r.mitigation || r.response || '-';
          lines.push(`| ${name} | ${prob} | ${impact} | ${mit} |`);
        });
        lines.push('');
      }
      
      lines.push('---\n');
    }

    // 8. STAGE GATES
    if (stageGates) {
      lines.push('## 8. Stage Gates & Milestones\n');
      
      const gates = stageGates.gates || stageGates;
      if (Array.isArray(gates) && gates.length > 0) {
        gates.forEach((gate: any, idx: number) => {
          lines.push(`### Gate ${idx + 1}: ${gate.name || gate.title}\n`);
          if (gate.timing) {
            lines.push(`**Timing:** ${gate.timing}`);
          }
          if (gate.criteria && gate.criteria.length > 0) {
            lines.push('\n**Approval Criteria:**');
            gate.criteria.forEach((c: string) => lines.push(`- ${c}`));
          }
          if (gate.deliverables && gate.deliverables.length > 0) {
            lines.push('\n**Required Deliverables:**');
            gate.deliverables.forEach((d: string) => lines.push(`- ${d}`));
          }
          lines.push('');
        });
      }
      
      lines.push('---\n');
    }

    // 9. KPIs
    if (kpis) {
      lines.push('## 9. Key Performance Indicators (KPIs)\n');
      
      const kpiArray = kpis.kpis || kpis.metrics || kpis;
      if (Array.isArray(kpiArray) && kpiArray.length > 0) {
        lines.push('| KPI | Target | Measurement Frequency |');
        lines.push('|-----|--------|----------------------|');
        kpiArray.forEach((kpi: any) => {
          const name = kpi.name || kpi.metric || kpi.kpi || 'KPI';
          const target = kpi.target || kpi.goal || '-';
          const freq = kpi.frequency || kpi.measurementFrequency || 'Monthly';
          lines.push(`| ${name} | ${target} | ${freq} |`);
        });
        lines.push('');
      }
      
      lines.push('---\n');
    }

    // 10. STAKEHOLDER MAP
    if (stakeholders) {
      lines.push('## 10. Stakeholder Map\n');
      
      const stakeholderArray = stakeholders.stakeholders || stakeholders;
      if (Array.isArray(stakeholderArray) && stakeholderArray.length > 0) {
        lines.push('| Stakeholder | Role | Interest Level | Engagement Strategy |');
        lines.push('|-------------|------|----------------|---------------------|');
        stakeholderArray.forEach((s: any) => {
          const name = s.name || s.stakeholder || 'Stakeholder';
          const role = s.role || s.position || '-';
          const interest = s.interest || s.interestLevel || '-';
          const strategy = s.engagement || s.strategy || '-';
          lines.push(`| ${name} | ${role} | ${interest} | ${strategy} |`);
        });
        lines.push('');
      }
      
      lines.push('---\n');
    }

    // 11. GOVERNANCE
    if (governance) {
      lines.push('## 11. Governance Structure\n');
      
      if (governance.structure) {
        lines.push(`**Governance Model:** ${governance.structure}\n`);
      }
      
      if (governance.decisionMaking) {
        lines.push(`\n**Decision-Making Framework:** ${governance.decisionMaking}\n`);
      }
      
      if (governance.roles && governance.roles.length > 0) {
        lines.push('\n**Key Governance Roles:**\n');
        governance.roles.forEach((r: any) => {
          const role = typeof r === 'string' ? r : (r.role || r.name);
          const resp = r.responsibilities || '';
          lines.push(`- **${role}**${resp ? `: ${resp}` : ''}`);
        });
        lines.push('');
      }
      
      if (governance.meetings) {
        lines.push(`\n**Meeting Cadence:** ${governance.meetings}\n`);
      }
      
      lines.push('---\n');
    }

    // 12. QA PLAN
    if (qaPlan) {
      lines.push('## 12. Quality Assurance Plan\n');
      
      if (qaPlan.approach) {
        lines.push(`**QA Approach:** ${qaPlan.approach}\n`);
      }
      
      if (qaPlan.standards && qaPlan.standards.length > 0) {
        lines.push('\n**Quality Standards:**\n');
        qaPlan.standards.forEach((std: string) => lines.push(`- ${std}`));
        lines.push('');
      }
      
      if (qaPlan.reviews && qaPlan.reviews.length > 0) {
        lines.push('\n**Review Gates:**\n');
        qaPlan.reviews.forEach((rev: any) => {
          const name = typeof rev === 'string' ? rev : (rev.name || rev.type);
          lines.push(`- ${name}`);
        });
        lines.push('');
      }
      
      lines.push('---\n');
    }

    // 13. PROCUREMENT
    if (procurement) {
      lines.push('## 13. Procurement Plan\n');
      
      if (procurement.strategy) {
        lines.push(`**Procurement Strategy:** ${procurement.strategy}\n`);
      }
      
      const vendors = procurement.vendors || procurement.suppliers || [];
      if (vendors.length > 0) {
        lines.push('\n**Vendor Requirements:**\n');
        vendors.forEach((v: any) => {
          const name = typeof v === 'string' ? v : (v.name || v.vendor || v.type);
          const req = v.requirements || v.details || '';
          lines.push(`- **${name}**${req ? `: ${req}` : ''}`);
        });
        lines.push('');
      }
      
      lines.push('---\n');
    }

    // 14. EXIT STRATEGY
    if (exitStrategy) {
      lines.push('## 14. Exit Strategy\n');
      
      if (exitStrategy.approach) {
        lines.push(`**Exit Approach:** ${exitStrategy.approach}\n`);
      }
      
      if (exitStrategy.criteria && exitStrategy.criteria.length > 0) {
        lines.push('\n**Exit Criteria:**\n');
        exitStrategy.criteria.forEach((c: string) => lines.push(`- ${c}`));
        lines.push('');
      }
      
      if (exitStrategy.transitionPlan) {
        lines.push(`\n**Transition Plan:** ${exitStrategy.transitionPlan}\n`);
      }
      
      lines.push('---\n');
    }
  }

  // ======================
  // TASK ASSIGNMENTS
  // ======================
  if (pkg.epm?.assignments && pkg.epm.assignments.length > 0) {
    lines.push('## Task Assignments Overview\n');
    lines.push(`**Total Assignments:** ${pkg.epm.assignments.length}\n`);
    
    const resourceCounts = pkg.epm.assignments.reduce((acc: any, a: any) => {
      acc[a.resourceName] = (acc[a.resourceName] || 0) + 1;
      return acc;
    }, {});
    
    lines.push('\n**Assignments by Resource:**\n');
    Object.entries(resourceCounts).forEach(([name, count]) => {
      lines.push(`- **${name}:** ${count} task(s)`);
    });
    lines.push('\n');
    
    lines.push('*Detailed assignment data available in assignments.csv*\n');
    lines.push('\n---\n');
  }

  // Footer
  lines.push('\n*Report generated by Premisia Intelligent Strategic EPM*\n');
  lines.push(`*Export Date: ${format(new Date(pkg.metadata.exportedAt), 'PPPPpp')}*`);

  return lines.join('\n');
}

/**
 * Convert Markdown to HTML using marked
 */
async function generateHtmlFromMarkdown(markdown: string): Promise<string> {
  const content = await marked.parse(markdown);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Premisia Strategic Analysis Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }
    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    p { margin-bottom: 16px; }
    code { 
      background: #f6f8fa; 
      padding: 2px 6px; 
      border-radius: 3px; 
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 85%;
    }
    pre {
      background: #f6f8fa;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }
    th, td {
      border: 1px solid #dfe2e5;
      padding: 6px 13px;
    }
    th {
      background: #f6f8fa;
      font-weight: 600;
    }
    hr {
      height: 0.25em;
      padding: 0;
      margin: 24px 0;
      background-color: #e1e4e8;
      border: 0;
    }
    ul, ol {
      padding-left: 2em;
      margin-bottom: 16px;
    }
    li + li {
      margin-top: 0.25em;
    }
    strong {
      font-weight: 600;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>
  `.trim();
}

/**
 * Generate PDF from HTML using Puppeteer
 */
async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const chromiumPath = findChromiumExecutable();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: chromiumPath,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      printBackground: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * Generate comprehensive DOCX document using docx package
 * Mirrors the Markdown report structure with all strategic and EPM components
 */
async function generateDocxReport(pkg: FullExportPackage): Promise<Buffer> {
  const sections: (Paragraph | Table)[] = [];

  // Safe JSONB parser
  const parseField = (field: any) => {
    if (!field) return null;
    if (typeof field === 'object') return field;
    try {
      return JSON.parse(field);
    } catch (err) {
      console.warn('[DOCX Export] Failed to parse JSONB field:', err);
      return null;
    }
  };

  // === HEADER ===
  sections.push(
    new Paragraph({
      text: 'Premisia Strategic Analysis & EPM Program Report',
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Generated: ', bold: true }),
        new TextRun(format(new Date(pkg.metadata.exportedAt), 'PPpp')),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Session ID: ', bold: true }),
        new TextRun(pkg.metadata.sessionId),
      ],
    })
  );

  if (pkg.metadata.versionNumber) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Version: ', bold: true }),
          new TextRun(pkg.metadata.versionNumber.toString()),
        ],
      })
    );
  }

  sections.push(new Paragraph({ text: '' }));

  // === STRATEGIC UNDERSTANDING ===
  if (pkg.strategy.understanding) {
    const u = pkg.strategy.understanding;
    sections.push(
      new Paragraph({
        text: 'Strategic Understanding',
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Title: ', bold: true }),
          new TextRun(u.title || 'Untitled Initiative'),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Initiative Type: ', bold: true }),
          new TextRun(u.initiativeType || 'Not classified'),
        ],
      })
    );

    if (u.classificationConfidence) {
      const conf = parseFloat(u.classificationConfidence as any);
      if (!isNaN(conf)) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Classification Confidence: ', bold: true }),
              new TextRun(`${(conf * 100).toFixed(0)}%`),
            ],
          })
        );
      }
    }

    if (u.initiativeDescription) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: 'Description', bold: true })],
        }),
        new Paragraph({ text: u.initiativeDescription })
      );
    }

    if (u.userInput) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: 'Original User Input', bold: true })],
        }),
        new Paragraph({ text: u.userInput })
      );
    }

    sections.push(new Paragraph({ text: '' }));
  }

  // === STRATEGIC JOURNEY ===
  if (pkg.strategy.journeySession) {
    const j = pkg.strategy.journeySession;
    sections.push(
      new Paragraph({
        text: 'Strategic Journey',
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Journey Type: ', bold: true }),
          new TextRun(j.journeyType || 'Custom'),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Status: ', bold: true }),
          new TextRun(j.status),
        ],
      })
    );

    if (j.completedFrameworks && j.completedFrameworks.length > 0) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: 'Completed Frameworks', bold: true })],
        })
      );
      j.completedFrameworks.forEach((fw: string) => {
        sections.push(
          new Paragraph({
            text: `• ${fw}`,
            bullet: { level: 0 },
          })
        );
      });
    }

    sections.push(new Paragraph({ text: '' }));
  }

  // === STRATEGIC DECISIONS ===
  if (pkg.strategy.strategyVersion) {
    const sv = pkg.strategy.strategyVersion;
    sections.push(
      new Paragraph({
        text: 'Strategic Decisions',
        heading: HeadingLevel.HEADING_2,
      })
    );

    if (sv.versionLabel) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Version: ', bold: true }),
            new TextRun(sv.versionLabel),
          ],
        })
      );
    }

    if (sv.inputSummary) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: 'Summary', bold: true })],
        }),
        new Paragraph({ text: sv.inputSummary })
      );
    }

    if (pkg.strategy.decisions && pkg.strategy.decisions.length > 0) {
      sections.push(
        new Paragraph({
          text: 'Selected Decisions',
          heading: HeadingLevel.HEADING_3,
        })
      );
      pkg.strategy.decisions.forEach((decision: any, idx: number) => {
        const decType = decision.type || decision.category || 'Decision';
        const decValue = decision.value || decision.description || decision.choice || 'Not specified';
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${idx + 1}. ${decType}: `, bold: true }),
              new TextRun(decValue),
            ],
          })
        );
        if (decision.rationale) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({ text: `   Rationale: ${decision.rationale}`, italics: true }),
              ],
            })
          );
        }
      });
    }

    sections.push(new Paragraph({ text: '' }));
  }

  // === EPM PROGRAM (14 COMPONENTS) ===
  if (pkg.epm?.program) {
    const program = pkg.epm.program;
    const execSummary = parseField(program.executiveSummary);
    const workstreams = parseField(program.workstreams);
    const timeline = parseField(program.timeline);
    const resourcePlan = parseField(program.resourcePlan);
    const financialPlan = parseField(program.financialPlan);
    const benefits = parseField(program.benefitsRealization);
    const risks = parseField(program.riskRegister);
    const stageGates = parseField(program.stageGates);
    const kpis = parseField(program.kpis);
    const stakeholders = parseField(program.stakeholderMap);
    const governance = parseField(program.governance);
    const qaPlan = parseField(program.qaPlan);
    const procurement = parseField(program.procurement);
    const exitStrategy = parseField(program.exitStrategy);

    sections.push(
      new Paragraph({
        text: 'Enterprise Program Management (EPM) Program',
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Framework: ', bold: true }),
          new TextRun(program.frameworkType || 'Not specified'),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Status: ', bold: true }),
          new TextRun(program.status),
        ],
      })
    );

    // Overall Confidence
    const confidenceValue = program.overallConfidence ? parseFloat(program.overallConfidence as any) : null;
    const confidenceText = (confidenceValue !== null && !isNaN(confidenceValue)) 
      ? `${(confidenceValue * 100).toFixed(1)}%`
      : 'Not calculated';
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Overall Confidence: ', bold: true }),
          new TextRun(confidenceText),
        ],
      }),
      new Paragraph({ text: '' })
    );

    // 1. EXECUTIVE SUMMARY
    if (execSummary) {
      sections.push(
        new Paragraph({
          text: '1. Executive Summary',
          heading: HeadingLevel.HEADING_2,
        })
      );

      if (execSummary.title) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Program Title: ', bold: true }),
              new TextRun(execSummary.title),
            ],
          })
        );
      }

      if (execSummary.overview || execSummary.summary) {
        sections.push(
          new Paragraph({ text: execSummary.overview || execSummary.summary })
        );
      }

      if (execSummary.objectives && execSummary.objectives.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Strategic Objectives', bold: true })],
          })
        );
        execSummary.objectives.forEach((obj: string, idx: number) => {
          sections.push(
            new Paragraph({
              text: `${idx + 1}. ${obj}`,
              numbering: { reference: 'objectives', level: 0 },
            })
          );
        });
      }

      if (execSummary.scope) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Scope: ', bold: true }),
              new TextRun(execSummary.scope),
            ],
          })
        );
      }

      if (execSummary.successCriteria && execSummary.successCriteria.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Success Criteria', bold: true })],
          })
        );
        execSummary.successCriteria.forEach((criteria: string) => {
          sections.push(
            new Paragraph({
              text: `• ${criteria}`,
              bullet: { level: 0 },
            })
          );
        });
      }

      sections.push(new Paragraph({ text: '' }));
    }

    // 2. WORKSTREAMS
    if (workstreams && workstreams.length > 0) {
      sections.push(
        new Paragraph({
          text: '2. Workstreams',
          heading: HeadingLevel.HEADING_2,
        })
      );

      workstreams.forEach((ws: any, idx: number) => {
        sections.push(
          new Paragraph({
            text: `${idx + 1}. ${ws.name || `Workstream ${idx + 1}`}`,
            heading: HeadingLevel.HEADING_3,
          })
        );

        if (ws.description) {
          sections.push(new Paragraph({ text: ws.description }));
        }

        if (ws.owner) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Owner: ', bold: true }),
                new TextRun(ws.owner),
              ],
            })
          );
        }

        if (ws.startMonth !== undefined && ws.endMonth !== undefined) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Duration: ', bold: true }),
                new TextRun(`Month ${ws.startMonth} to Month ${ws.endMonth}`),
              ],
            })
          );
        }

        if (ws.dependencies && ws.dependencies.length > 0) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Dependencies: ', bold: true }),
                new TextRun(ws.dependencies.join(', ')),
              ],
            })
          );
        }

        if (ws.deliverables && ws.deliverables.length > 0) {
          sections.push(
            new Paragraph({
              children: [new TextRun({ text: 'Key Deliverables', bold: true })],
            })
          );
          ws.deliverables.forEach((d: any) => {
            const delName = typeof d === 'string' ? d : (d.name || d.title || 'Deliverable');
            sections.push(
              new Paragraph({
                text: `• ${delName}`,
                bullet: { level: 0 },
              })
            );
          });
        }

        if (ws.tasks && ws.tasks.length > 0) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Tasks: ', bold: true }),
                new TextRun(`${ws.tasks.length} tasks defined`),
              ],
            })
          );
        }

        sections.push(new Paragraph({ text: '' }));
      });
    }

    // 3. TIMELINE & CRITICAL PATH
    if (timeline) {
      sections.push(
        new Paragraph({
          text: '3. Timeline & Critical Path',
          heading: HeadingLevel.HEADING_2,
        })
      );

      if (timeline.totalDuration) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Total Program Duration: ', bold: true }),
              new TextRun(`${timeline.totalDuration} months`),
            ],
          })
        );
      }

      if (timeline.phases && timeline.phases.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Program Phases', bold: true })],
          })
        );
        timeline.phases.forEach((phase: any) => {
          sections.push(
            new Paragraph({
              text: `• ${phase.name}: Month ${phase.startMonth} to Month ${phase.endMonth}`,
              bullet: { level: 0 },
            })
          );
          if (phase.milestones && phase.milestones.length > 0) {
            sections.push(
              new Paragraph({
                text: `  Milestones: ${phase.milestones.join(', ')}`,
              })
            );
          }
        });
      }

      if (timeline.criticalPath && timeline.criticalPath.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Critical Path', bold: true })],
          })
        );
        timeline.criticalPath.forEach((item: string) => {
          sections.push(
            new Paragraph({
              text: `• ${item}`,
              bullet: { level: 0 },
            })
          );
        });
      }

      sections.push(new Paragraph({ text: '' }));
    }

    // 4. RESOURCE PLAN
    if (resourcePlan) {
      sections.push(
        new Paragraph({
          text: '4. Resource Plan',
          heading: HeadingLevel.HEADING_2,
        })
      );

      if (resourcePlan.internalTeam && resourcePlan.internalTeam.length > 0) {
        sections.push(
          new Paragraph({
            text: 'Internal Team',
            heading: HeadingLevel.HEADING_3,
          })
        );

        // Create table for internal team
        const internalTeamRows: TableRow[] = [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Role', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'FTE', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Responsibilities', bold: true })] })] }),
            ],
          }),
        ];

        resourcePlan.internalTeam.forEach((r: any) => {
          internalTeamRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(r.role || r.title || 'Not specified')] }),
                new TableCell({ children: [new Paragraph(String(r.fte || r.allocation || 'TBD'))] }),
                new TableCell({ children: [new Paragraph(r.responsibilities || r.description || '-')] }),
              ],
            })
          );
        });

        sections.push(
          new Table({
            rows: internalTeamRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
      }

      if (resourcePlan.externalResources && resourcePlan.externalResources.length > 0) {
        sections.push(
          new Paragraph({
            text: 'External Resources',
            heading: HeadingLevel.HEADING_3,
          })
        );

        const externalResourcesRows: TableRow[] = [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Type', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Quantity', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Skills Required', bold: true })] })] }),
            ],
          }),
        ];

        resourcePlan.externalResources.forEach((r: any) => {
          externalResourcesRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(r.type || r.role || 'Contractor')] }),
                new TableCell({ children: [new Paragraph(String(r.quantity || r.count || '1'))] }),
                new TableCell({ children: [new Paragraph(r.skills || r.requirements || '-')] }),
              ],
            })
          );
        });

        sections.push(
          new Table({
            rows: externalResourcesRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
      }

      if (resourcePlan.totalFTE) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Total FTE Required: ', bold: true }),
              new TextRun(String(resourcePlan.totalFTE)),
            ],
          })
        );
      }

      sections.push(new Paragraph({ text: '' }));
    }

    // 5. FINANCIAL PLAN
    if (financialPlan) {
      sections.push(
        new Paragraph({
          text: '5. Financial Plan',
          heading: HeadingLevel.HEADING_2,
        })
      );

      if (financialPlan.totalBudget) {
        const budget = typeof financialPlan.totalBudget === 'number' 
          ? `$${financialPlan.totalBudget.toLocaleString()}`
          : financialPlan.totalBudget;
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Total Program Budget: ', bold: true }),
              new TextRun(budget),
            ],
          })
        );
      }

      if (financialPlan.costBreakdown && financialPlan.costBreakdown.length > 0) {
        sections.push(
          new Paragraph({
            text: 'Cost Breakdown',
            heading: HeadingLevel.HEADING_3,
          })
        );

        const costBreakdownRows: TableRow[] = [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Category', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Amount', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Percentage', bold: true })] })] }),
            ],
          }),
        ];

        financialPlan.costBreakdown.forEach((item: any) => {
          const category = item.category || item.name || 'Other';
          const amount = typeof item.amount === 'number' ? `$${item.amount.toLocaleString()}` : item.amount;
          const pct = item.percentage || '-';
          costBreakdownRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(category)] }),
                new TableCell({ children: [new Paragraph(amount)] }),
                new TableCell({ children: [new Paragraph(String(pct))] }),
              ],
            })
          );
        });

        sections.push(
          new Table({
            rows: costBreakdownRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
      }

      if (financialPlan.cashFlow && financialPlan.cashFlow.length > 0) {
        sections.push(
          new Paragraph({
            text: 'Cash Flow Projection',
            heading: HeadingLevel.HEADING_3,
          })
        );
        financialPlan.cashFlow.forEach((cf: any) => {
          sections.push(
            new Paragraph({
              text: `• ${cf.period || `Period ${cf.month || cf.quarter}`}: $${cf.amount?.toLocaleString() || '0'}`,
              bullet: { level: 0 },
            })
          );
        });
      }

      sections.push(new Paragraph({ text: '' }));
    }

    // 6. BENEFITS REALIZATION
    if (benefits) {
      sections.push(
        new Paragraph({
          text: '6. Benefits Realization',
          heading: HeadingLevel.HEADING_2,
        })
      );

      if (benefits.benefits && benefits.benefits.length > 0) {
        sections.push(
          new Paragraph({
            text: 'Expected Benefits',
            heading: HeadingLevel.HEADING_3,
          })
        );
        benefits.benefits.forEach((b: any, idx: number) => {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${idx + 1}. `, bold: true }),
                new TextRun({ text: b.name || b.benefit, bold: true }),
              ],
            })
          );
          if (b.description) {
            sections.push(new Paragraph({ text: `   ${b.description}` }));
          }
          if (b.metric) {
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({ text: '   Metric: ', bold: true }),
                  new TextRun(b.metric),
                ],
              })
            );
          }
          if (b.target) {
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({ text: '   Target: ', bold: true }),
                  new TextRun(b.target),
                ],
              })
            );
          }
          if (b.timeframe) {
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({ text: '   Timeframe: ', bold: true }),
                  new TextRun(b.timeframe),
                ],
              })
            );
          }
        });
      }

      if (benefits.realizationPlan) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Realization Plan: ', bold: true }),
              new TextRun(benefits.realizationPlan),
            ],
          })
        );
      }

      sections.push(new Paragraph({ text: '' }));
    }

    // 7. RISK REGISTER
    if (risks) {
      sections.push(
        new Paragraph({
          text: '7. Risk Register',
          heading: HeadingLevel.HEADING_2,
        })
      );

      const riskArray = risks.risks || risks;
      if (Array.isArray(riskArray) && riskArray.length > 0) {
        const riskRows = [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Risk', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Probability', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Impact', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Mitigation', bold: true })] })] }),
            ],
          }),
        ];

        riskArray.forEach((r: any) => {
          const name = r.risk || r.name || r.description || 'Unnamed risk';
          const prob = r.probability || r.likelihood || '-';
          const impact = r.impact || r.severity || '-';
          const mit = r.mitigation || r.response || '-';

          riskRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: name })] }),
                new TableCell({ children: [new Paragraph({ text: prob })] }),
                new TableCell({ children: [new Paragraph({ text: impact })] }),
                new TableCell({ children: [new Paragraph({ text: mit })] }),
              ],
            })
          );
        });

        sections.push(
          new Table({
            rows: riskRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
      }

      sections.push(new Paragraph({ text: '' }));
    }

    // 8. STAGE GATES & MILESTONES
    if (stageGates) {
      sections.push(
        new Paragraph({
          text: '8. Stage Gates & Milestones',
          heading: HeadingLevel.HEADING_2,
        })
      );

      const gates = stageGates.gates || stageGates;
      if (Array.isArray(gates) && gates.length > 0) {
        gates.forEach((gate: any, idx: number) => {
          sections.push(
            new Paragraph({
              text: `Gate ${idx + 1}: ${gate.name || gate.title}`,
              heading: HeadingLevel.HEADING_3,
            })
          );

          if (gate.timing) {
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({ text: 'Timing: ', bold: true }),
                  new TextRun(gate.timing),
                ],
              })
            );
          }

          if (gate.criteria && gate.criteria.length > 0) {
            sections.push(
              new Paragraph({
                children: [new TextRun({ text: 'Approval Criteria', bold: true })],
              })
            );
            gate.criteria.forEach((c: string) => {
              sections.push(
                new Paragraph({
                  text: `• ${c}`,
                  bullet: { level: 0 },
                })
              );
            });
          }

          if (gate.deliverables && gate.deliverables.length > 0) {
            sections.push(
              new Paragraph({
                children: [new TextRun({ text: 'Required Deliverables', bold: true })],
              })
            );
            gate.deliverables.forEach((d: string) => {
              sections.push(
                new Paragraph({
                  text: `• ${d}`,
                  bullet: { level: 0 },
                })
              );
            });
          }

          sections.push(new Paragraph({ text: '' }));
        });
      }

      sections.push(new Paragraph({ text: '' }));
    }

    // 9. KEY PERFORMANCE INDICATORS (KPIs)
    if (kpis) {
      sections.push(
        new Paragraph({
          text: '9. Key Performance Indicators (KPIs)',
          heading: HeadingLevel.HEADING_2,
        })
      );

      const kpiArray = kpis.kpis || kpis.metrics || kpis;
      if (Array.isArray(kpiArray) && kpiArray.length > 0) {
        const kpiRows = [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'KPI', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Target', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Measurement Frequency', bold: true })] })] }),
            ],
          }),
        ];

        kpiArray.forEach((kpi: any) => {
          const name = kpi.name || kpi.metric || kpi.kpi || 'KPI';
          const target = kpi.target || kpi.goal || '-';
          const freq = kpi.frequency || kpi.measurementFrequency || 'Monthly';

          kpiRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: name })] }),
                new TableCell({ children: [new Paragraph({ text: target })] }),
                new TableCell({ children: [new Paragraph({ text: freq })] }),
              ],
            })
          );
        });

        sections.push(
          new Table({
            rows: kpiRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
      }

      sections.push(new Paragraph({ text: '' }));
    }

    // 10. STAKEHOLDER MAP
    if (stakeholders) {
      sections.push(
        new Paragraph({
          text: '10. Stakeholder Map',
          heading: HeadingLevel.HEADING_2,
        })
      );

      const stakeholderArray = stakeholders.stakeholders || stakeholders;
      if (Array.isArray(stakeholderArray) && stakeholderArray.length > 0) {
        const stakeholderRows = [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Stakeholder', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Role', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Interest Level', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Engagement Strategy', bold: true })] })] }),
            ],
          }),
        ];

        stakeholderArray.forEach((s: any) => {
          const name = s.name || s.stakeholder || 'Stakeholder';
          const role = s.role || s.position || '-';
          const interest = s.interest || s.interestLevel || '-';
          const strategy = s.engagement || s.strategy || '-';

          stakeholderRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: name })] }),
                new TableCell({ children: [new Paragraph({ text: role })] }),
                new TableCell({ children: [new Paragraph({ text: interest })] }),
                new TableCell({ children: [new Paragraph({ text: strategy })] }),
              ],
            })
          );
        });

        sections.push(
          new Table({
            rows: stakeholderRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
      }

      sections.push(new Paragraph({ text: '' }));
    }

    // 11. GOVERNANCE STRUCTURE
    if (governance) {
      sections.push(
        new Paragraph({
          text: '11. Governance Structure',
          heading: HeadingLevel.HEADING_2,
        })
      );

      if (governance.structure) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Governance Model: ', bold: true }),
              new TextRun(governance.structure),
            ],
          })
        );
      }

      if (governance.decisionMaking) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Decision-Making Framework: ', bold: true }),
              new TextRun(governance.decisionMaking),
            ],
          })
        );
      }

      if (governance.roles && governance.roles.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Key Governance Roles', bold: true })],
          })
        );
        governance.roles.forEach((r: any) => {
          const role = typeof r === 'string' ? r : (r.role || r.name);
          const resp = r.responsibilities || '';
          const text = resp ? `${role}: ${resp}` : role;
          sections.push(
            new Paragraph({
              text: `• ${text}`,
              bullet: { level: 0 },
            })
          );
        });
      }

      if (governance.meetings) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Meeting Cadence: ', bold: true }),
              new TextRun(governance.meetings),
            ],
          })
        );
      }

      sections.push(new Paragraph({ text: '' }));
    }

    // 12. QUALITY ASSURANCE PLAN
    if (qaPlan) {
      sections.push(
        new Paragraph({
          text: '12. Quality Assurance Plan',
          heading: HeadingLevel.HEADING_2,
        })
      );

      if (qaPlan.approach) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'QA Approach: ', bold: true }),
              new TextRun(qaPlan.approach),
            ],
          })
        );
      }

      if (qaPlan.standards && qaPlan.standards.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Quality Standards', bold: true })],
          })
        );
        qaPlan.standards.forEach((std: string) => {
          sections.push(
            new Paragraph({
              text: `• ${std}`,
              bullet: { level: 0 },
            })
          );
        });
      }

      if (qaPlan.reviews && qaPlan.reviews.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Review Gates', bold: true })],
          })
        );
        qaPlan.reviews.forEach((rev: any) => {
          const name = typeof rev === 'string' ? rev : (rev.name || rev.type);
          sections.push(
            new Paragraph({
              text: `• ${name}`,
              bullet: { level: 0 },
            })
          );
        });
      }

      sections.push(new Paragraph({ text: '' }));
    }

    // 13. PROCUREMENT PLAN
    if (procurement) {
      sections.push(
        new Paragraph({
          text: '13. Procurement Plan',
          heading: HeadingLevel.HEADING_2,
        })
      );

      if (procurement.strategy) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Procurement Strategy: ', bold: true }),
              new TextRun(procurement.strategy),
            ],
          })
        );
      }

      const vendors = procurement.vendors || procurement.suppliers || [];
      if (vendors.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Vendor Requirements', bold: true })],
          })
        );
        vendors.forEach((v: any) => {
          const name = typeof v === 'string' ? v : (v.name || v.vendor || v.type);
          const req = v.requirements || v.details || '';
          const text = req ? `${name}: ${req}` : name;
          sections.push(
            new Paragraph({
              text: `• ${text}`,
              bullet: { level: 0 },
            })
          );
        });
      }

      sections.push(new Paragraph({ text: '' }));
    }

    // 14. EXIT STRATEGY
    if (exitStrategy) {
      sections.push(
        new Paragraph({
          text: '14. Exit Strategy',
          heading: HeadingLevel.HEADING_2,
        })
      );

      if (exitStrategy.approach) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Exit Approach: ', bold: true }),
              new TextRun(exitStrategy.approach),
            ],
          })
        );
      }

      if (exitStrategy.criteria && exitStrategy.criteria.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Exit Criteria', bold: true })],
          })
        );
        exitStrategy.criteria.forEach((c: string) => {
          sections.push(
            new Paragraph({
              text: `• ${c}`,
              bullet: { level: 0 },
            })
          );
        });
      }

      if (exitStrategy.transitionPlan) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Transition Plan: ', bold: true }),
              new TextRun(exitStrategy.transitionPlan),
            ],
          })
        );
      }

      sections.push(new Paragraph({ text: '' }));
    }
  }

  // ======================
  // TASK ASSIGNMENTS OVERVIEW
  // ======================
  if (pkg.epm?.assignments && pkg.epm.assignments.length > 0) {
    sections.push(
      new Paragraph({
        text: 'Task Assignments Overview',
        heading: HeadingLevel.HEADING_2,
      })
    );

    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Total Assignments: ', bold: true }),
          new TextRun(pkg.epm.assignments.length.toString()),
        ],
      })
    );

    const resourceCounts = pkg.epm.assignments.reduce((acc: any, a: any) => {
      acc[a.resourceName] = (acc[a.resourceName] || 0) + 1;
      return acc;
    }, {});

    sections.push(
      new Paragraph({
        children: [new TextRun({ text: 'Assignments by Resource', bold: true })],
      })
    );

    Object.entries(resourceCounts).forEach(([name, count]) => {
      sections.push(
        new Paragraph({
          text: `• ${name}: ${count} task(s)`,
          bullet: { level: 0 },
        })
      );
    });

    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Detailed assignment data available in assignments.csv',
            italics: true,
          }),
        ],
      })
    );

    sections.push(new Paragraph({ text: '' }));
  }

  // Footer
  sections.push(
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Report generated by Premisia Intelligent Strategic EPM',
          italics: true,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Export Date: ${format(new Date(pkg.metadata.exportedAt), 'PPPPpp')}`,
          italics: true,
        }),
      ],
    })
  );

  // Create document
  const doc = new Document({
    sections: [{
      properties: {},
      children: sections,
    }],
  });

  return await Packer.toBuffer(doc);
}

/**
 * Generate CSV for assignments
 */
function generateAssignmentsCsv(assignments: any[]): string {
  const headers = ['Task ID', 'Task Name', 'Resource ID', 'Resource Name', 'Resource Role', 'Resource Type', 'Status', 'Allocation %', 'Assigned From', 'Assigned To'];
  const rows = [headers.join(',')];

  assignments.forEach(assignment => {
    const row = [
      escapeCsvField(assignment.taskId),
      escapeCsvField(assignment.taskName),
      escapeCsvField(assignment.resourceId),
      escapeCsvField(assignment.resourceName),
      escapeCsvField(assignment.resourceRole || ''),
      escapeCsvField(assignment.resourceType),
      escapeCsvField(assignment.status),
      assignment.allocationPercent?.toString() || '100',
      assignment.assignedFrom ? format(new Date(assignment.assignedFrom), 'yyyy-MM-dd') : '',
      assignment.assignedTo ? format(new Date(assignment.assignedTo), 'yyyy-MM-dd') : '',
    ];
    rows.push(row.join(','));
  });

  return rows.join('\n');
}

/**
 * Generate CSV for workstreams
 */
function generateWorkstreamsCsv(workstreams: any[]): string {
  const headers = ['Workstream ID', 'Name', 'Description', 'Owner', 'Start Date', 'End Date', 'Status', 'Task Count', 'Progress'];
  const rows = [headers.join(',')];

  const workstreamsArray = typeof workstreams === 'string' ? JSON.parse(workstreams) : workstreams;

  workstreamsArray.forEach((ws: any) => {
    const row = [
      escapeCsvField(ws.id),
      escapeCsvField(ws.name),
      escapeCsvField(ws.description || ''),
      escapeCsvField(ws.owner || ''),
      ws.startDate || '',
      ws.endDate || '',
      ws.status || 'planned',
      ws.tasks?.length?.toString() || '0',
      ws.progress?.toString() || '0',
    ];
    rows.push(row.join(','));
  });

  return rows.join('\n');
}

/**
 * Generate CSV for resources (internal team and external resources)
 */
function generateResourcesCsv(resourcePlan: any): string {
  const headers = ['Resource Type', 'Role/Title', 'FTE/Quantity', 'Skills/Responsibilities', 'Category'];
  const rows = [headers.join(',')];

  const plan = typeof resourcePlan === 'string' ? JSON.parse(resourcePlan) : resourcePlan;
  if (!plan) return rows.join('\n');

  // Internal team
  if (plan.internalTeam && plan.internalTeam.length > 0) {
    plan.internalTeam.forEach((r: any) => {
      const row = [
        'Internal',
        escapeCsvField(r.role || r.title || 'Not specified'),
        r.fte || r.allocation || 'TBD',
        escapeCsvField(r.responsibilities || r.description || '-'),
        'Core Team'
      ];
      rows.push(row.join(','));
    });
  }

  // External resources
  if (plan.externalResources && plan.externalResources.length > 0) {
    plan.externalResources.forEach((r: any) => {
      const row = [
        'External',
        escapeCsvField(r.type || r.role || 'Contractor'),
        r.quantity || r.count || '1',
        escapeCsvField(r.skills || r.requirements || '-'),
        'External/Vendor'
      ];
      rows.push(row.join(','));
    });
  }

  return rows.join('\n');
}

/**
 * Generate CSV for risks
 */
function generateRisksCsv(riskRegister: any): string {
  const headers = ['Risk ID', 'Risk Description', 'Probability', 'Impact', 'Severity', 'Mitigation Strategy', 'Owner'];
  const rows = [headers.join(',')];

  const risks = typeof riskRegister === 'string' ? JSON.parse(riskRegister) : riskRegister;
  if (!risks) return rows.join('\n');

  const riskArray = risks.risks || risks;
  if (Array.isArray(riskArray)) {
    riskArray.forEach((r: any, idx: number) => {
      const row = [
        `RISK-${idx + 1}`,
        escapeCsvField(r.risk || r.name || r.description || 'Unnamed risk'),
        r.probability || r.likelihood || '-',
        r.impact || r.severity || '-',
        r.level || r.rating || '-',
        escapeCsvField(r.mitigation || r.response || r.strategy || '-'),
        escapeCsvField(r.owner || '-')
      ];
      rows.push(row.join(','));
    });
  }

  return rows.join('\n');
}

/**
 * Generate CSV for benefits
 */
function generateBenefitsCsv(benefitsRealization: any): string {
  const headers = ['Benefit ID', 'Benefit Name', 'Description', 'Category', 'Metric', 'Target', 'Timeframe', 'Responsible Party'];
  const rows = [headers.join(',')];

  const benefits = typeof benefitsRealization === 'string' ? JSON.parse(benefitsRealization) : benefitsRealization;
  if (!benefits) return rows.join('\n');

  const benefitArray = benefits.benefits || [];
  if (Array.isArray(benefitArray)) {
    benefitArray.forEach((b: any, idx: number) => {
      const row = [
        `BEN-${idx + 1}`,
        escapeCsvField(b.name || b.benefit || 'Unnamed benefit'),
        escapeCsvField(b.description || '-'),
        escapeCsvField(b.category || b.type || '-'),
        escapeCsvField(b.metric || '-'),
        escapeCsvField(b.target || b.goal || '-'),
        escapeCsvField(b.timeframe || b.timeline || '-'),
        escapeCsvField(b.owner || b.responsible || '-')
      ];
      rows.push(row.join(','));
    });
  }

  return rows.join('\n');
}

/**
 * Escape CSV field (handle commas and quotes)
 */
function escapeCsvField(field: string): string {
  if (field === null || field === undefined) {
    return '';
  }
  const str = field.toString();
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate UI-styled HTML report with cards, badges, and tables
 */
function generateUiStyledHtml(pkg: FullExportPackage): string {
  // Parse JSONB fields safely with error handling (reuse existing pattern)
  const parseField = (field: any) => {
    if (!field) return null;
    if (typeof field === 'object') return field;
    
    try {
      return JSON.parse(field);
    } catch (err) {
      console.warn('[Export] Failed to parse JSONB field:', err);
      return null;
    }
  };

  // Helper to generate confidence badge
  const getConfidenceBadge = (confidence: number | string): string => {
    const conf = typeof confidence === 'number' ? confidence : parseFloat(confidence as string);
    if (isNaN(conf)) return '<span class="badge badge-secondary">N/A</span>';
    
    const percentage = conf * 100;
    let badgeClass = 'badge-warning';
    if (percentage >= 75) badgeClass = 'badge-success';
    else if (percentage < 50) badgeClass = 'badge-destructive';
    
    return `<span class="badge ${badgeClass}">${percentage.toFixed(0)}%</span>`;
  };

  // Helper to escape HTML - handles all data types safely
  const escapeHtml = (str: any): string => {
    if (str === null || str === undefined) return '';
    
    // Convert to string if not already
    let stringValue: string;
    if (typeof str === 'object') {
      // For objects/arrays, use JSON representation
      stringValue = JSON.stringify(str);
    } else {
      stringValue = String(str);
    }
    
    return stringValue
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const contentParts: string[] = [];
  
  // Header
  const title = pkg.strategy.understanding?.title || 'Strategic Analysis Report';
  contentParts.push(`
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">Generated: ${format(new Date(pkg.metadata.exportedAt), 'PPpp')}</p>
      <p class="subtitle">Session ID: ${pkg.metadata.sessionId}</p>
      ${pkg.metadata.versionNumber ? `<p class="subtitle">Version: ${pkg.metadata.versionNumber}</p>` : ''}
    </div>
  `);

  // ======================
  // STRATEGIC UNDERSTANDING
  // ======================
  if (pkg.strategy.understanding) {
    const u = pkg.strategy.understanding;
    contentParts.push(`
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Strategic Understanding</h2>
        </div>
        <div class="card-content">
          <div class="key-value">
            <div class="key-value-label">Title:</div>
            <div class="key-value-value">${escapeHtml(u.title || 'Untitled Initiative')}</div>
          </div>
          <div class="key-value">
            <div class="key-value-label">Initiative Type:</div>
            <div class="key-value-value">${escapeHtml(u.initiativeType || 'Not classified')}</div>
          </div>
          ${u.classificationConfidence ? `
          <div class="key-value">
            <div class="key-value-label">Classification Confidence:</div>
            <div class="key-value-value">${getConfidenceBadge(u.classificationConfidence)}</div>
          </div>
          ` : ''}
          ${u.initiativeDescription ? `
          <div class="mt-4">
            <h3>Description</h3>
            <p>${escapeHtml(u.initiativeDescription)}</p>
          </div>
          ` : ''}
          ${u.userInput ? `
          <div class="mt-4">
            <h3>Original User Input</h3>
            <p>${escapeHtml(u.userInput)}</p>
          </div>
          ` : ''}
        </div>
      </div>
    `);
  }

  // ======================
  // STRATEGIC JOURNEY
  // ======================
  if (pkg.strategy.journeySession) {
    const j = pkg.strategy.journeySession;
    contentParts.push(`
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Strategic Journey</h2>
        </div>
        <div class="card-content">
          <div class="key-value">
            <div class="key-value-label">Journey Type:</div>
            <div class="key-value-value">${escapeHtml(j.journeyType || 'Custom')}</div>
          </div>
          <div class="key-value">
            <div class="key-value-label">Status:</div>
            <div class="key-value-value"><span class="badge badge-default">${escapeHtml(j.status)}</span></div>
          </div>
          ${j.completedFrameworks && j.completedFrameworks.length > 0 ? `
          <div class="mt-4">
            <h3>Completed Frameworks</h3>
            <ul>
              ${j.completedFrameworks.map((fw: string) => `<li>${escapeHtml(fw)}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
        </div>
      </div>
    `);
    
    // Extract framework analysis from accumulated context
    const context = parseField(j.accumulatedContext);
    const insights = context?.insights || {};
    
    // ======================
    // FIVE WHYS ANALYSIS
    // ======================
    if (insights.rootCauses || insights.whysPath || insights.strategicImplications) {
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Five Whys Analysis</h2>
          </div>
          <div class="card-content">
            ${insights.whysPath && insights.whysPath.length > 0 ? `
            <div class="mb-4">
              <h3>Analysis Path</h3>
              <ol>
                ${insights.whysPath.map((step: any, idx: number) => `
                  <li class="mb-2">
                    <strong>Why?</strong> ${escapeHtml(step.question || step.why || 'Not specified')}
                    <br><strong>Answer:</strong> ${escapeHtml(step.answer || 'Not specified')}
                  </li>
                `).join('')}
              </ol>
            </div>
            ` : ''}
            ${insights.rootCauses && insights.rootCauses.length > 0 ? `
            <div class="mb-4">
              <h3>Identified Root Causes</h3>
              <ul>
                ${insights.rootCauses.map((cause: string) => `<li>${escapeHtml(cause)}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
            ${insights.strategicImplications && insights.strategicImplications.length > 0 ? `
            <div>
              <h3>Strategic Implications</h3>
              <ul>
                ${insights.strategicImplications.map((imp: string) => `<li>${escapeHtml(imp)}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
          </div>
        </div>
      `);
    }
    
    // ======================
    // BUSINESS MODEL CANVAS ANALYSIS
    // ======================
    if (insights.bmcBlocks) {
      const bmc = insights.bmcBlocks;
      
      const renderBmcBlock = (title: string, data: any) => {
        if (!data) return '';
        
        if (typeof data === 'string') {
          return `<div class="mb-3"><h4>${title}</h4><p>${escapeHtml(data)}</p></div>`;
        } else if (Array.isArray(data)) {
          return `<div class="mb-3"><h4>${title}</h4><ul>${data.map((item: string) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`;
        } else if (data.segments) {
          return `<div class="mb-3"><h4>${title}</h4><ul>${data.segments.map((seg: any) => `<li><strong>${escapeHtml(seg.name || 'Segment')}:</strong> ${escapeHtml(seg.description || '')}</li>`).join('')}</ul></div>`;
        } else if (data.propositions) {
          return `<div class="mb-3"><h4>${title}</h4><ul>${data.propositions.map((vp: any) => `<li><strong>${escapeHtml(vp.title || 'Value Proposition')}:</strong> ${escapeHtml(vp.description || '')}</li>`).join('')}</ul></div>`;
        } else if (data.channels) {
          return `<div class="mb-3"><h4>${title}</h4><ul>${data.channels.map((ch: any) => `<li><strong>${escapeHtml(ch.name || 'Channel')}:</strong> ${escapeHtml(ch.description || '')}</li>`).join('')}</ul></div>`;
        } else if (data.relationships) {
          return `<div class="mb-3"><h4>${title}</h4><ul>${data.relationships.map((rel: any) => `<li><strong>${escapeHtml(rel.type || 'Relationship')}:</strong> ${escapeHtml(rel.description || '')}</li>`).join('')}</ul></div>`;
        } else if (data.streams) {
          return `<div class="mb-3"><h4>${title}</h4><ul>${data.streams.map((rev: any) => `<li><strong>${escapeHtml(rev.name || 'Revenue Stream')}:</strong> ${escapeHtml(rev.description || '')}${rev.pricingModel ? `<br><em>Pricing: ${escapeHtml(rev.pricingModel)}</em>` : ''}</li>`).join('')}</ul></div>`;
        } else if (data.resources) {
          return `<div class="mb-3"><h4>${title}</h4><ul>${data.resources.map((res: any) => `<li><strong>${escapeHtml(res.name || 'Resource')}:</strong> ${escapeHtml(res.description || '')}</li>`).join('')}</ul></div>`;
        } else if (data.activities) {
          return `<div class="mb-3"><h4>${title}</h4><ul>${data.activities.map((act: any) => `<li><strong>${escapeHtml(act.name || 'Activity')}:</strong> ${escapeHtml(act.description || '')}</li>`).join('')}</ul></div>`;
        } else if (data.partnerships) {
          return `<div class="mb-3"><h4>${title}</h4><ul>${data.partnerships.map((part: any) => `<li><strong>${escapeHtml(part.partner || 'Partner')}:</strong> ${escapeHtml(part.description || '')}</li>`).join('')}</ul></div>`;
        } else if (data.costs) {
          return `<div class="mb-3"><h4>${title}</h4><ul>${data.costs.map((cost: any) => `<li><strong>${escapeHtml(cost.category || 'Cost')}:</strong> ${escapeHtml(cost.description || '')}</li>`).join('')}</ul></div>`;
        }
        return '';
      };
      
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Business Model Canvas Analysis</h2>
          </div>
          <div class="card-content">
            ${renderBmcBlock('Customer Segments', bmc.customerSegments)}
            ${renderBmcBlock('Value Propositions', bmc.valuePropositions)}
            ${renderBmcBlock('Channels', bmc.channels)}
            ${renderBmcBlock('Customer Relationships', bmc.customerRelationships)}
            ${renderBmcBlock('Revenue Streams', bmc.revenueStreams)}
            ${renderBmcBlock('Key Resources', bmc.keyResources)}
            ${renderBmcBlock('Key Activities', bmc.keyActivities)}
            ${renderBmcBlock('Key Partnerships', bmc.keyPartnerships)}
            ${renderBmcBlock('Cost Structure', bmc.costStructure)}
            
            ${insights.bmcContradictions && insights.bmcContradictions.length > 0 ? `
            <div class="mb-3">
              <h4>Identified Contradictions</h4>
              <ul>
                ${insights.bmcContradictions.map((cont: any) => {
                  if (typeof cont === 'string') {
                    return `<li>${escapeHtml(cont)}</li>`;
                  } else {
                    return `<li><strong>${escapeHtml(cont.title || 'Contradiction')}:</strong> ${escapeHtml(cont.description || cont.issue || '')}${cont.recommendation ? `<br><em>Recommendation: ${escapeHtml(cont.recommendation)}</em>` : ''}</li>`;
                  }
                }).join('')}
              </ul>
            </div>
            ` : ''}
            
            ${insights.businessModelGaps && insights.businessModelGaps.length > 0 ? `
            <div>
              <h4>Critical Gaps</h4>
              <ul>
                ${insights.businessModelGaps.map((gap: any) => {
                  if (typeof gap === 'string') {
                    return `<li>${escapeHtml(gap)}</li>`;
                  } else {
                    return `<li><strong>${escapeHtml(gap.area || 'Gap')}:</strong> ${escapeHtml(gap.description || '')}${gap.impact ? `<br><em>Impact: ${escapeHtml(gap.impact)}</em>` : ''}</li>`;
                  }
                }).join('')}
              </ul>
            </div>
            ` : ''}
          </div>
        </div>
      `);
    }
    
    // ======================
    // PORTER'S FIVE FORCES ANALYSIS
    // ======================
    if (insights.portersForces) {
      const forces = insights.portersForces;
      
      const renderForce = (title: string, force: any) => {
        if (!force) return '';
        
        if (typeof force === 'string') {
          return `<div class="mb-3"><h4>${title}</h4><p>${escapeHtml(force)}</p></div>`;
        } else {
          let html = `<div class="mb-3"><h4>${title}</h4>`;
          if (force.intensity) html += `<p><strong>Intensity:</strong> ${escapeHtml(force.intensity)}</p>`;
          if (force.level) html += `<p><strong>Level:</strong> ${escapeHtml(force.level)}</p>`;
          if (force.power) html += `<p><strong>Power:</strong> ${escapeHtml(force.power)}</p>`;
          if (force.factors && Array.isArray(force.factors)) {
            html += `<ul>${force.factors.map((f: string) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`;
          }
          if (force.barriers && Array.isArray(force.barriers)) {
            html += `<p><strong>Entry Barriers:</strong></p><ul>${force.barriers.map((b: string) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`;
          }
          if (force.substitutes && Array.isArray(force.substitutes)) {
            html += `<ul>${force.substitutes.map((s: string) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
          }
          html += '</div>';
          return html;
        }
      };
      
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Porter's Five Forces Analysis</h2>
          </div>
          <div class="card-content">
            ${renderForce('Competitive Rivalry', forces.competitiveRivalry || forces.competitive_rivalry)}
            ${renderForce('Threat of New Entrants', forces.threatOfNewEntrants || forces.threat_of_new_entrants)}
            ${renderForce('Bargaining Power of Suppliers', forces.bargainingPowerOfSuppliers || forces.supplier_power)}
            ${renderForce('Bargaining Power of Buyers', forces.bargainingPowerOfBuyers || forces.buyer_power)}
            ${renderForce('Threat of Substitutes', forces.threatOfSubstitutes || forces.threat_of_substitutes)}
          </div>
        </div>
      `);
    }
    
    // ======================
    // PESTLE ANALYSIS
    // ======================
    if (insights.trendFactors || insights.externalForces) {
      const factors = insights.trendFactors ?? insights.externalForces ?? {};
      
      const renderPestleCategory = (category: string, data: any) => {
        if (!data) return '';
        
        const title = category.charAt(0).toUpperCase() + category.slice(1);
        let html = `<div class="mb-3"><h4>${title} Factors</h4>`;
        
        if (typeof data === 'string') {
          html += `<p>${escapeHtml(data)}</p>`;
        } else if (Array.isArray(data)) {
          html += `<ul>${data.map((item: string) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
        } else {
          if (data.trends && Array.isArray(data.trends)) {
            html += `<p><strong>Trends:</strong></p><ul>${data.trends.map((t: string) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
          }
          if (data.opportunities && Array.isArray(data.opportunities)) {
            html += `<p><strong>Opportunities:</strong></p><ul>${data.opportunities.map((o: string) => `<li>${escapeHtml(o)}</li>`).join('')}</ul>`;
          }
          if (data.risks && Array.isArray(data.risks)) {
            html += `<p><strong>Risks:</strong></p><ul>${data.risks.map((r: string) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`;
          }
        }
        html += '</div>';
        return html;
      };
      
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">PESTLE Analysis</h2>
          </div>
          <div class="card-content">
            ${renderPestleCategory('political', factors.political)}
            ${renderPestleCategory('economic', factors.economic)}
            ${renderPestleCategory('social', factors.social)}
            ${renderPestleCategory('technological', factors.technological)}
            ${renderPestleCategory('legal', factors.legal)}
            ${renderPestleCategory('environmental', factors.environmental)}
          </div>
        </div>
      `);
    }
  }

  // ======================
  // STRATEGIC DECISIONS
  // ======================
  if (pkg.strategy.strategyVersion) {
    const sv = pkg.strategy.strategyVersion;
    contentParts.push(`
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Strategic Decisions</h2>
          ${sv.versionLabel ? `<p class="card-description">Version: ${escapeHtml(sv.versionLabel)}</p>` : ''}
        </div>
        <div class="card-content">
          ${sv.inputSummary ? `
          <div class="mb-4">
            <h3>Summary</h3>
            <p>${escapeHtml(sv.inputSummary)}</p>
          </div>
          ` : ''}
          ${pkg.strategy.decisions && pkg.strategy.decisions.length > 0 ? `
          <div>
            <h3>Selected Decisions</h3>
            <ol>
              ${pkg.strategy.decisions.map((decision: any) => {
                const decType = decision.type || decision.category || 'Decision';
                const decValue = decision.value || decision.description || decision.choice || 'Not specified';
                return `
                  <li>
                    <strong>${escapeHtml(decType)}:</strong> ${escapeHtml(decValue)}
                    ${decision.rationale ? `<br><em class="text-muted">Rationale: ${escapeHtml(decision.rationale)}</em>` : ''}
                  </li>
                `;
              }).join('')}
            </ol>
          </div>
          ` : ''}
        </div>
      </div>
    `);
  }

  // ======================
  // EPM PROGRAM - 14 COMPONENTS
  // ======================
  if (pkg.epm?.program) {
    const program = pkg.epm.program;
    const execSummary = parseField(program.executiveSummary);
    const workstreams = parseField(program.workstreams);
    const timeline = parseField(program.timeline);
    const resourcePlan = parseField(program.resourcePlan);
    const financialPlan = parseField(program.financialPlan);
    const benefits = parseField(program.benefitsRealization);
    const risks = parseField(program.riskRegister);
    const stageGates = parseField(program.stageGates);
    const kpis = parseField(program.kpis);
    const stakeholders = parseField(program.stakeholderMap);
    const governance = parseField(program.governance);
    const qaPlan = parseField(program.qaPlan);
    const procurement = parseField(program.procurement);
    const exitStrategy = parseField(program.exitStrategy);

    // EPM Header Card
    const confidenceValue = program.overallConfidence ? parseFloat(program.overallConfidence as any) : null;
    contentParts.push(`
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Enterprise Program Management (EPM) Program</h2>
        </div>
        <div class="card-content">
          <div class="key-value">
            <div class="key-value-label">Framework:</div>
            <div class="key-value-value">${escapeHtml(program.frameworkType || 'Not specified')}</div>
          </div>
          <div class="key-value">
            <div class="key-value-label">Status:</div>
            <div class="key-value-value"><span class="badge badge-default">${escapeHtml(program.status)}</span></div>
          </div>
          ${confidenceValue !== null && !isNaN(confidenceValue) ? `
          <div class="key-value">
            <div class="key-value-label">Overall Confidence:</div>
            <div class="key-value-value">${getConfidenceBadge(confidenceValue)}</div>
          </div>
          ` : ''}
        </div>
      </div>
    `);

    // 1. EXECUTIVE SUMMARY
    if (execSummary) {
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">1. Executive Summary</h2>
          </div>
          <div class="card-content">
            ${execSummary.title ? `<h3 class="mb-2">${escapeHtml(execSummary.title)}</h3>` : ''}
            ${execSummary.overview || execSummary.summary ? `<p class="mb-4">${escapeHtml(execSummary.overview || execSummary.summary)}</p>` : ''}
            ${execSummary.objectives && execSummary.objectives.length > 0 ? `
            <div class="mb-4">
              <h3>Strategic Objectives</h3>
              <ol>
                ${execSummary.objectives.map((obj: string) => `<li>${escapeHtml(obj)}</li>`).join('')}
              </ol>
            </div>
            ` : ''}
            ${execSummary.scope ? `
            <div class="mb-4">
              <h3>Scope</h3>
              <p>${escapeHtml(execSummary.scope)}</p>
            </div>
            ` : ''}
            ${execSummary.successCriteria && execSummary.successCriteria.length > 0 ? `
            <div>
              <h3>Success Criteria</h3>
              <ul>
                ${execSummary.successCriteria.map((criteria: string) => `<li>${escapeHtml(criteria)}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
          </div>
        </div>
      `);
    }

    // 2. WORKSTREAMS
    if (workstreams && workstreams.length > 0) {
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">2. Workstreams</h2>
          </div>
          <div class="card-content">
            <div class="grid grid-cols-2">
              ${workstreams.map((ws: any, idx: number) => `
                <div class="card" style="background: hsl(var(--secondary)); margin-bottom: 1rem;">
                  <div class="card-header">
                    <h3 class="card-title">${idx + 1}. ${escapeHtml(ws.name || `Workstream ${idx + 1}`)}</h3>
                  </div>
                  <div class="card-content">
                    ${ws.description ? `<p class="mb-2">${escapeHtml(ws.description)}</p>` : ''}
                    ${ws.owner ? `<p class="mb-1"><strong>Owner:</strong> ${escapeHtml(ws.owner)}</p>` : ''}
                    ${ws.startMonth !== undefined && ws.endMonth !== undefined ? `<p class="mb-1"><strong>Duration:</strong> Month ${ws.startMonth} to Month ${ws.endMonth}</p>` : ''}
                    ${ws.dependencies && ws.dependencies.length > 0 ? `<p class="mb-2"><strong>Dependencies:</strong> ${ws.dependencies.map(escapeHtml).join(', ')}</p>` : ''}
                    ${ws.deliverables && ws.deliverables.length > 0 ? `
                    <div class="mt-2">
                      <strong>Key Deliverables:</strong>
                      <ul>
                        ${ws.deliverables.map((d: any) => {
                          const delName = typeof d === 'string' ? d : (d.name || d.title || 'Deliverable');
                          return `<li>${escapeHtml(delName)}</li>`;
                        }).join('')}
                      </ul>
                    </div>
                    ` : ''}
                    ${ws.tasks && ws.tasks.length > 0 ? `<p class="mt-2"><span class="badge badge-outline">${ws.tasks.length} tasks</span></p>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `);
    }

    // 3. TIMELINE & CRITICAL PATH
    if (timeline) {
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">3. Timeline & Critical Path</h2>
          </div>
          <div class="card-content">
            ${timeline.totalDuration ? `<p class="mb-4"><strong>Total Program Duration:</strong> ${timeline.totalDuration} months</p>` : ''}
            ${timeline.phases && timeline.phases.length > 0 ? `
            <div class="mb-4">
              <h3>Program Phases</h3>
              <ul>
                ${timeline.phases.map((phase: any) => `
                  <li>
                    <strong>${escapeHtml(phase.name)}:</strong> Month ${phase.startMonth} to Month ${phase.endMonth}
                    ${phase.milestones && phase.milestones.length > 0 ? `<br><em class="text-muted">Milestones: ${phase.milestones.map(escapeHtml).join(', ')}</em>` : ''}
                  </li>
                `).join('')}
              </ul>
            </div>
            ` : ''}
            ${timeline.criticalPath && timeline.criticalPath.length > 0 ? `
            <div>
              <h3>Critical Path</h3>
              <ul>
                ${timeline.criticalPath.map((item: string) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
          </div>
        </div>
      `);
    }

    // 4. RESOURCE PLAN
    if (resourcePlan) {
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">4. Resource Plan</h2>
          </div>
          <div class="card-content">
            ${resourcePlan.internalTeam && resourcePlan.internalTeam.length > 0 ? `
            <div class="mb-4">
              <h3>Internal Team</h3>
              <table>
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>FTE</th>
                    <th>Responsibilities</th>
                  </tr>
                </thead>
                <tbody>
                  ${resourcePlan.internalTeam.map((r: any) => `
                    <tr>
                      <td>${escapeHtml(r.role || r.title || 'Not specified')}</td>
                      <td>${escapeHtml(String(r.fte || r.allocation || 'TBD'))}</td>
                      <td>${escapeHtml(r.responsibilities || r.description || '-')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ` : ''}
            ${resourcePlan.externalResources && resourcePlan.externalResources.length > 0 ? `
            <div>
              <h3>External Resources</h3>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Skills Required</th>
                  </tr>
                </thead>
                <tbody>
                  ${resourcePlan.externalResources.map((r: any) => `
                    <tr>
                      <td>${escapeHtml(r.type || r.role || 'Contractor')}</td>
                      <td>${escapeHtml(String(r.quantity || r.count || '1'))}</td>
                      <td>${escapeHtml(r.skills || r.requirements || '-')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ` : ''}
            ${resourcePlan.totalFTE ? `<p class="mt-4"><strong>Total FTE Required:</strong> ${resourcePlan.totalFTE}</p>` : ''}
          </div>
        </div>
      `);
    }

    // 5. FINANCIAL PLAN
    if (financialPlan) {
      const budget = typeof financialPlan.totalBudget === 'number' 
        ? `$${financialPlan.totalBudget.toLocaleString()}`
        : financialPlan.totalBudget;
      
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">5. Financial Plan</h2>
          </div>
          <div class="card-content">
            ${financialPlan.totalBudget ? `<p class="mb-4"><strong>Total Program Budget:</strong> ${escapeHtml(budget)}</p>` : ''}
            ${financialPlan.costBreakdown && financialPlan.costBreakdown.length > 0 ? `
            <div class="mb-4">
              <h3>Cost Breakdown</h3>
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  ${financialPlan.costBreakdown.map((item: any) => {
                    const category = item.category || item.name || 'Other';
                    const amount = typeof item.amount === 'number' ? `$${item.amount.toLocaleString()}` : item.amount;
                    const pct = item.percentage || '-';
                    return `
                      <tr>
                        <td>${escapeHtml(category)}</td>
                        <td>${escapeHtml(amount)}</td>
                        <td>${escapeHtml(String(pct))}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
            ` : ''}
            ${financialPlan.cashFlow && financialPlan.cashFlow.length > 0 ? `
            <div>
              <h3>Cash Flow Projection</h3>
              <ul>
                ${financialPlan.cashFlow.map((cf: any) => `
                  <li><strong>${escapeHtml(cf.period || `Period ${cf.month || cf.quarter}`)}:</strong> $${cf.amount?.toLocaleString() || '0'}</li>
                `).join('')}
              </ul>
            </div>
            ` : ''}
          </div>
        </div>
      `);
    }

    // 6. BENEFITS REALIZATION
    if (benefits && benefits.benefits && benefits.benefits.length > 0) {
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">6. Benefits Realization</h2>
          </div>
          <div class="card-content">
            <h3>Expected Benefits</h3>
            <ol>
              ${benefits.benefits.map((b: any) => `
                <li>
                  <strong>${escapeHtml(b.name || b.benefit)}</strong>
                  ${b.description ? `<br>${escapeHtml(b.description)}` : ''}
                  ${b.metric ? `<br><strong>Metric:</strong> ${escapeHtml(b.metric)}` : ''}
                  ${b.target ? `<br><strong>Target:</strong> ${escapeHtml(b.target)}` : ''}
                  ${b.timeframe ? `<br><strong>Timeframe:</strong> ${escapeHtml(b.timeframe)}` : ''}
                </li>
              `).join('')}
            </ol>
            ${benefits.realizationPlan ? `
            <div class="mt-4">
              <h3>Realization Plan</h3>
              <p>${escapeHtml(benefits.realizationPlan)}</p>
            </div>
            ` : ''}
          </div>
        </div>
      `);
    }

    // 7. RISK REGISTER
    if (risks) {
      const riskArray = risks.risks || risks;
      if (Array.isArray(riskArray) && riskArray.length > 0) {
        contentParts.push(`
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">7. Risk Register</h2>
            </div>
            <div class="card-content">
              <table>
                <thead>
                  <tr>
                    <th>Risk</th>
                    <th>Probability</th>
                    <th>Impact</th>
                    <th>Mitigation</th>
                  </tr>
                </thead>
                <tbody>
                  ${riskArray.map((r: any) => {
                    const name = r.risk || r.name || r.description || 'Unnamed risk';
                    const prob = r.probability || r.likelihood || '-';
                    const impact = r.impact || r.severity || '-';
                    const mit = r.mitigation || r.response || '-';
                    return `
                      <tr>
                        <td>${escapeHtml(name)}</td>
                        <td>${escapeHtml(prob)}</td>
                        <td>${escapeHtml(impact)}</td>
                        <td>${escapeHtml(mit)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `);
      }
    }

    // 8. STAGE GATES
    if (stageGates) {
      const gates = stageGates.gates || stageGates;
      if (Array.isArray(gates) && gates.length > 0) {
        contentParts.push(`
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">8. Stage Gates & Milestones</h2>
            </div>
            <div class="card-content">
              ${gates.map((gate: any, idx: number) => `
                <div class="mb-4">
                  <h3>Gate ${idx + 1}: ${escapeHtml(gate.name || gate.title)}</h3>
                  ${gate.timing ? `<p><strong>Timing:</strong> ${escapeHtml(gate.timing)}</p>` : ''}
                  ${gate.criteria && gate.criteria.length > 0 ? `
                  <div class="mt-2">
                    <strong>Approval Criteria:</strong>
                    <ul>
                      ${gate.criteria.map((c: string) => `<li>${escapeHtml(c)}</li>`).join('')}
                    </ul>
                  </div>
                  ` : ''}
                  ${gate.deliverables && gate.deliverables.length > 0 ? `
                  <div class="mt-2">
                    <strong>Required Deliverables:</strong>
                    <ul>
                      ${gate.deliverables.map((d: string) => `<li>${escapeHtml(d)}</li>`).join('')}
                    </ul>
                  </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `);
      }
    }

    // 9. KPIs
    if (kpis) {
      const kpiArray = kpis.kpis || kpis.metrics || kpis;
      if (Array.isArray(kpiArray) && kpiArray.length > 0) {
        contentParts.push(`
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">9. Key Performance Indicators (KPIs)</h2>
            </div>
            <div class="card-content">
              <table>
                <thead>
                  <tr>
                    <th>KPI</th>
                    <th>Target</th>
                    <th>Measurement Frequency</th>
                  </tr>
                </thead>
                <tbody>
                  ${kpiArray.map((kpi: any) => {
                    const name = kpi.name || kpi.metric || kpi.kpi || 'KPI';
                    const target = kpi.target || kpi.goal || '-';
                    const freq = kpi.frequency || kpi.measurementFrequency || 'Monthly';
                    return `
                      <tr>
                        <td>${escapeHtml(name)}</td>
                        <td>${escapeHtml(target)}</td>
                        <td>${escapeHtml(freq)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `);
      }
    }

    // 10. STAKEHOLDER MAP
    if (stakeholders) {
      const stakeholderArray = stakeholders.stakeholders || stakeholders;
      if (Array.isArray(stakeholderArray) && stakeholderArray.length > 0) {
        contentParts.push(`
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">10. Stakeholder Map</h2>
            </div>
            <div class="card-content">
              <table>
                <thead>
                  <tr>
                    <th>Stakeholder</th>
                    <th>Role</th>
                    <th>Interest Level</th>
                    <th>Engagement Strategy</th>
                  </tr>
                </thead>
                <tbody>
                  ${stakeholderArray.map((s: any) => {
                    const name = s.name || s.stakeholder || 'Stakeholder';
                    const role = s.role || s.position || '-';
                    const interest = s.interest || s.interestLevel || '-';
                    const strategy = s.engagement || s.strategy || '-';
                    return `
                      <tr>
                        <td>${escapeHtml(name)}</td>
                        <td>${escapeHtml(role)}</td>
                        <td>${escapeHtml(interest)}</td>
                        <td>${escapeHtml(strategy)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `);
      }
    }

    // 11. GOVERNANCE
    if (governance) {
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">11. Governance Structure</h2>
          </div>
          <div class="card-content">
            ${governance.structure ? `<p class="mb-2"><strong>Governance Model:</strong> ${escapeHtml(governance.structure)}</p>` : ''}
            ${governance.decisionMaking ? `<p class="mb-2"><strong>Decision-Making Framework:</strong> ${escapeHtml(governance.decisionMaking)}</p>` : ''}
            ${governance.roles && governance.roles.length > 0 ? `
            <div class="mb-2">
              <strong>Key Governance Roles:</strong>
              <ul>
                ${governance.roles.map((r: any) => {
                  const role = typeof r === 'string' ? r : (r.role || r.name);
                  const resp = r.responsibilities || '';
                  const text = resp ? `${role}: ${resp}` : role;
                  return `<li>${escapeHtml(text)}</li>`;
                }).join('')}
              </ul>
            </div>
            ` : ''}
            ${governance.meetings ? `<p><strong>Meeting Cadence:</strong> ${escapeHtml(governance.meetings)}</p>` : ''}
          </div>
        </div>
      `);
    }

    // 12. QA PLAN
    if (qaPlan) {
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">12. Quality Assurance Plan</h2>
          </div>
          <div class="card-content">
            ${qaPlan.approach ? `<p class="mb-4"><strong>QA Approach:</strong> ${escapeHtml(qaPlan.approach)}</p>` : ''}
            ${qaPlan.standards && qaPlan.standards.length > 0 ? `
            <div class="mb-4">
              <strong>Quality Standards:</strong>
              <ul>
                ${qaPlan.standards.map((std: string) => `<li>${escapeHtml(std)}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
            ${qaPlan.reviews && qaPlan.reviews.length > 0 ? `
            <div>
              <strong>Review Gates:</strong>
              <ul>
                ${qaPlan.reviews.map((rev: any) => {
                  const name = typeof rev === 'string' ? rev : (rev.name || rev.type);
                  return `<li>${escapeHtml(name)}</li>`;
                }).join('')}
              </ul>
            </div>
            ` : ''}
          </div>
        </div>
      `);
    }

    // 13. PROCUREMENT
    if (procurement) {
      const vendors = procurement.vendors || procurement.suppliers || [];
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">13. Procurement Plan</h2>
          </div>
          <div class="card-content">
            ${procurement.strategy ? `<p class="mb-4"><strong>Procurement Strategy:</strong> ${escapeHtml(procurement.strategy)}</p>` : ''}
            ${vendors.length > 0 ? `
            <div>
              <strong>Vendor Requirements:</strong>
              <ul>
                ${vendors.map((v: any) => {
                  const name = typeof v === 'string' ? v : (v.name || v.vendor || v.type);
                  const req = v.requirements || v.details || '';
                  const text = req ? `${name}: ${req}` : name;
                  return `<li>${escapeHtml(text)}</li>`;
                }).join('')}
              </ul>
            </div>
            ` : ''}
          </div>
        </div>
      `);
    }

    // 14. EXIT STRATEGY
    if (exitStrategy) {
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">14. Exit Strategy</h2>
          </div>
          <div class="card-content">
            ${exitStrategy.approach ? `<p class="mb-4"><strong>Exit Approach:</strong> ${escapeHtml(exitStrategy.approach)}</p>` : ''}
            ${exitStrategy.criteria && exitStrategy.criteria.length > 0 ? `
            <div class="mb-4">
              <strong>Exit Criteria:</strong>
              <ul>
                ${exitStrategy.criteria.map((c: string) => `<li>${escapeHtml(c)}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
            ${exitStrategy.transitionPlan ? `
            <div>
              <strong>Transition Plan:</strong>
              <p>${escapeHtml(exitStrategy.transitionPlan)}</p>
            </div>
            ` : ''}
          </div>
        </div>
      `);
    }
  }

  // ======================
  // TASK ASSIGNMENTS
  // ======================
  if (pkg.epm?.assignments && pkg.epm.assignments.length > 0) {
    const resourceCounts = pkg.epm.assignments.reduce((acc: any, a: any) => {
      acc[a.resourceName] = (acc[a.resourceName] || 0) + 1;
      return acc;
    }, {});

    contentParts.push(`
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Task Assignments Overview</h2>
        </div>
        <div class="card-content">
          <p class="mb-4"><strong>Total Assignments:</strong> ${pkg.epm.assignments.length}</p>
          <h3>Assignments by Resource</h3>
          <ul>
            ${Object.entries(resourceCounts).map(([name, count]) => `
              <li><strong>${escapeHtml(name)}:</strong> ${count} task(s)</li>
            `).join('')}
          </ul>
          <p class="mt-4 text-muted"><em>Detailed assignment data available in assignments.csv</em></p>
        </div>
      </div>
    `);
  }

  // Footer
  contentParts.push(`
    <div class="card" style="background: hsl(var(--muted)); border: none;">
      <div class="card-content" style="text-align: center;">
        <p class="text-muted"><em>Report generated by Premisia Intelligent Strategic EPM</em></p>
        <p class="text-muted"><em>Export Date: ${format(new Date(pkg.metadata.exportedAt), 'PPPPpp')}</em></p>
      </div>
    </div>
  `);

  // Read template and replace placeholders
  // Use process.cwd() for production compatibility (works in both dev and deployed environments)
  const templatePath = join(process.cwd(), 'server/export/templates/report-ui.html');
  
  try {
    const template = readFileSync(templatePath, 'utf-8');
    console.log('[Export] Successfully loaded HTML template from:', templatePath);
    
    return template
      .replace('{{TITLE}}', escapeHtml(title))
      .replace('{{CONTENT}}', contentParts.join('\n'));
  } catch (error) {
    console.error('[Export] Failed to read HTML template');
    console.error('[Export] Template path:', templatePath);
    console.error('[Export] process.cwd():', process.cwd());
    console.error('[Export] Error:', error);
    throw new Error(`Failed to load HTML template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate PDF from UI-styled HTML using Puppeteer
 */
async function generatePdfFromUiHtml(html: string): Promise<Buffer> {
  const chromiumPath = findChromiumExecutable();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: chromiumPath,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      printBackground: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * Generate DOCX from HTML using html-docx-js
 */
async function generateDocxFromHtml(html: string): Promise<Buffer> {
  // html-docx-js exports an object with asBlob method
  const docxBlob = HTMLtoDOCX.asBlob(html, {
    orientation: 'portrait',
    margins: {
      top: 720,
      right: 720,
      bottom: 720,
      left: 720,
    },
  });
  
  // Convert Blob to Buffer (Blob.arrayBuffer returns Promise<ArrayBuffer>)
  const arrayBuffer = await docxBlob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
