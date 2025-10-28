import { Writable } from 'stream';
import archiver from 'archiver';
import { marked } from 'marked';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import puppeteer from 'puppeteer';
import { format } from 'date-fns';
import { getStrategicUnderstandingBySession } from './secure-data-service';
import { db } from '../db';
import {
  journeySessions,
  strategyVersions,
  epmPrograms,
  taskAssignments,
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

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

  // Load all required data
  const exportPackage = await loadExportData(sessionId, versionNumber, programId, userId);

  // Generate report content in various formats
  const markdown = generateMarkdownReport(exportPackage);
  const html = await generateHtmlFromMarkdown(markdown);
  const pdf = await generatePdfFromHtml(html);
  const docx = await generateDocxReport(exportPackage);
  const strategyJson = JSON.stringify(exportPackage.strategy, null, 2);
  const epmJson = exportPackage.epm?.program ? JSON.stringify(exportPackage.epm, null, 2) : null;
  const assignmentsCsv = exportPackage.epm?.assignments ? generateAssignmentsCsv(exportPackage.epm.assignments) : null;
  const workstreamsCsv = exportPackage.epm?.program?.workstreams ? generateWorkstreamsCsv(exportPackage.epm.program.workstreams) : null;

  // Create ZIP archive
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  // Handle archive events
  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn('[Export] Archive warning:', err);
    } else {
      throw err;
    }
  });

  archive.on('error', (err) => {
    throw err;
  });

  // Pipe archive to output stream
  archive.pipe(outputStream);

  // Add files to archive
  archive.append(markdown, { name: 'report.md' });
  archive.append(pdf, { name: 'report.pdf' });
  archive.append(docx, { name: 'report.docx' });
  archive.append(strategyJson, { name: 'data/strategy.json' });
  
  if (epmJson) {
    archive.append(epmJson, { name: 'data/epm.json' });
  }
  if (assignmentsCsv) {
    archive.append(assignmentsCsv, { name: 'data/assignments.csv' });
  }
  if (workstreamsCsv) {
    archive.append(workstreamsCsv, { name: 'data/workstreams.csv' });
  }

  // Finalize the archive
  await archive.finalize();
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
  // Load strategic understanding
  const understanding = await getStrategicUnderstandingBySession(sessionId);

  // Load journey session
  const [journeySession] = await db.select()
    .from(journeySessions)
    .where(eq(journeySessions.understandingId, understanding?.id || sessionId))
    .limit(1);

  // Load strategy version
  let strategyVersion;
  if (versionNumber !== undefined) {
    [strategyVersion] = await db.select()
      .from(strategyVersions)
      .where(and(
        eq(strategyVersions.sessionId, sessionId),
        eq(strategyVersions.versionNumber, versionNumber)
      ))
      .limit(1);
  } else {
    // Get latest version (descending order)
    const versions = await db.select()
      .from(strategyVersions)
      .where(eq(strategyVersions.sessionId, sessionId))
      .orderBy(desc(strategyVersions.versionNumber))
      .limit(1);
    strategyVersion = versions[0];
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
    },
    epm: epmProgram ? {
      program: epmProgram,
      assignments,
    } : undefined,
  };
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(pkg: FullExportPackage): string {
  const lines: string[] = [];

  // Header
  lines.push('# Qgentic Strategic Analysis & EPM Program Report\n');
  lines.push(`**Generated:** ${format(new Date(pkg.metadata.exportedAt), 'PPpp')}\n`);
  lines.push(`**Session ID:** ${pkg.metadata.sessionId}`);
  if (pkg.metadata.versionNumber) {
    lines.push(`**Version:** ${pkg.metadata.versionNumber}`);
  }
  lines.push('\n---\n');

  // Strategic Understanding
  if (pkg.strategy.understanding) {
    lines.push('## Strategic Understanding\n');
    lines.push(`**Title:** ${pkg.strategy.understanding.title || 'Untitled Initiative'}\n`);
    lines.push(`**Initiative Type:** ${pkg.strategy.understanding.initiativeType || 'Not classified'}\n`);
    if (pkg.strategy.understanding.initiativeDescription) {
      lines.push(`\n**Description:**\n${pkg.strategy.understanding.initiativeDescription}\n`);
    }
    if (pkg.strategy.understanding.userInput) {
      lines.push(`\n**User Input:**\n${pkg.strategy.understanding.userInput}\n`);
    }
    lines.push('\n---\n');
  }

  // Journey Session
  if (pkg.strategy.journeySession) {
    lines.push('## Strategic Journey\n');
    lines.push(`**Journey Type:** ${pkg.strategy.journeySession.journeyType || 'Not specified'}\n`);
    lines.push(`**Status:** ${pkg.strategy.journeySession.status}\n`);
    if (pkg.strategy.journeySession.completedFrameworks && pkg.strategy.journeySession.completedFrameworks.length > 0) {
      lines.push(`**Completed Frameworks:** ${pkg.strategy.journeySession.completedFrameworks.join(', ')}\n`);
    }
    lines.push('\n---\n');
  }

  // Strategy Version & Decisions
  if (pkg.strategy.strategyVersion) {
    lines.push('## Strategic Decisions\n');
    if (pkg.strategy.strategyVersion.versionLabel) {
      lines.push(`**Version:** ${pkg.strategy.strategyVersion.versionLabel}\n`);
    }
    if (pkg.strategy.strategyVersion.inputSummary) {
      lines.push(`\n**Summary:**\n${pkg.strategy.strategyVersion.inputSummary}\n`);
    }
    
    if (pkg.strategy.decisions && pkg.strategy.decisions.length > 0) {
      lines.push('\n### Key Decisions\n');
      pkg.strategy.decisions.forEach((decision: any, idx: number) => {
        lines.push(`${idx + 1}. **${decision.type || 'Decision'}:** ${decision.value || decision.description || 'Not specified'}`);
      });
      lines.push('');
    }
    lines.push('\n---\n');
  }

  // EPM Program
  if (pkg.epm?.program) {
    const program = pkg.epm.program;
    lines.push('## EPM Program\n');
    lines.push(`**Program Name:** ${program.programName}\n`);
    lines.push(`**Status:** ${program.status}\n`);
    lines.push(`**Overall Confidence:** ${(parseFloat(program.overallConfidence) * 100).toFixed(1)}%\n`);
    
    if (program.executiveSummary) {
      lines.push(`\n**Executive Summary:**\n${program.executiveSummary}\n`);
    }

    // Timeline
    if (program.timeline) {
      lines.push('\n### Timeline\n');
      const timeline = typeof program.timeline === 'string' ? JSON.parse(program.timeline) : program.timeline;
      if (timeline.phases) {
        timeline.phases.forEach((phase: any) => {
          lines.push(`- **${phase.name}:** ${phase.startDate} to ${phase.endDate}`);
        });
      }
      lines.push('');
    }

    // Workstreams
    if (program.workstreams) {
      lines.push('\n### Workstreams\n');
      const workstreams = typeof program.workstreams === 'string' ? JSON.parse(program.workstreams) : program.workstreams;
      workstreams.forEach((ws: any, idx: number) => {
        lines.push(`${idx + 1}. **${ws.name}** (${ws.tasks?.length || 0} tasks)`);
        if (ws.description) {
          lines.push(`   - ${ws.description}`);
        }
      });
      lines.push('');
    }

    // Resource Plan
    if (program.resourcePlan) {
      lines.push('\n### Resources\n');
      const resourcePlan = typeof program.resourcePlan === 'string' ? JSON.parse(program.resourcePlan) : program.resourcePlan;
      if (resourcePlan.resources) {
        lines.push(`Total resources: ${resourcePlan.resources.length}\n`);
      }
    }

    // Risks
    if (program.risks) {
      lines.push('\n### Key Risks\n');
      const risks = typeof program.risks === 'string' ? JSON.parse(program.risks) : program.risks;
      if (Array.isArray(risks)) {
        risks.slice(0, 5).forEach((risk: any, idx: number) => {
          lines.push(`${idx + 1}. **${risk.name}** (${risk.level}): ${risk.description}`);
        });
      }
      lines.push('');
    }

    lines.push('\n---\n');
  }

  // Assignments Summary
  if (pkg.epm?.assignments && pkg.epm.assignments.length > 0) {
    lines.push('## Task Assignments Summary\n');
    lines.push(`Total assignments: ${pkg.epm.assignments.length}\n`);
    
    const resourceCounts = pkg.epm.assignments.reduce((acc: any, a: any) => {
      acc[a.resourceName] = (acc[a.resourceName] || 0) + 1;
      return acc;
    }, {});
    
    lines.push('\n### Assignments by Resource\n');
    Object.entries(resourceCounts).forEach(([name, count]) => {
      lines.push(`- **${name}:** ${count} tasks`);
    });
    lines.push('');
  }

  // Footer
  lines.push('\n---\n');
  lines.push('*Report generated by Qgentic Intelligent Strategic EPM*');

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
  <title>Qgentic Strategic Analysis Report</title>
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
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
 * Generate DOCX document using docx package
 */
async function generateDocxReport(pkg: FullExportPackage): Promise<Buffer> {
  const sections: Paragraph[] = [];

  // Title
  sections.push(
    new Paragraph({
      text: 'Qgentic Strategic Analysis & EPM Program Report',
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      text: `Generated: ${format(new Date(pkg.metadata.exportedAt), 'PPpp')}`,
    }),
    new Paragraph({
      text: `Session ID: ${pkg.metadata.sessionId}`,
    })
  );

  if (pkg.metadata.versionNumber) {
    sections.push(
      new Paragraph({
        text: `Version: ${pkg.metadata.versionNumber}`,
      })
    );
  }

  sections.push(new Paragraph({ text: '' }));

  // Strategic Understanding
  if (pkg.strategy.understanding) {
    sections.push(
      new Paragraph({
        text: 'Strategic Understanding',
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Title: ', bold: true }),
          new TextRun(pkg.strategy.understanding.title || 'Untitled Initiative'),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Initiative Type: ', bold: true }),
          new TextRun(pkg.strategy.understanding.initiativeType || 'Not classified'),
        ],
      })
    );

    if (pkg.strategy.understanding.initiativeDescription) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: 'Description: ', bold: true })],
        }),
        new Paragraph({
          text: pkg.strategy.understanding.initiativeDescription,
        })
      );
    }

    sections.push(new Paragraph({ text: '' }));
  }

  // EPM Program
  if (pkg.epm?.program) {
    const program = pkg.epm.program;
    sections.push(
      new Paragraph({
        text: 'EPM Program',
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Program Name: ', bold: true }),
          new TextRun(program.programName),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Status: ', bold: true }),
          new TextRun(program.status),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Overall Confidence: ', bold: true }),
          new TextRun(`${(parseFloat(program.overallConfidence) * 100).toFixed(1)}%`),
        ],
      })
    );

    if (program.executiveSummary) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: 'Executive Summary: ', bold: true })],
        }),
        new Paragraph({
          text: program.executiveSummary,
        })
      );
    }

    sections.push(new Paragraph({ text: '' }));
  }

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
