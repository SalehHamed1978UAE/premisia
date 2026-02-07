import { Writable } from 'stream';
import archiver from 'archiver';
import { loadExportData, type ExportRequest, type FullExportPackage, type ExportResult, type IExporter } from './base-exporter';
import { MarkdownExporter, generateMarkdownReport, generateFiveWhysTreeMarkdown, generateClarificationsMarkdown } from './markdown-exporter';
import { HtmlExporter, generateHtmlFromMarkdown, generateUiStyledHtml } from './html-exporter';
import { PdfExporter, findChromiumExecutable, generatePdfFromHtml, generatePdfFromUiHtml } from './pdf-exporter';
import { DocxExporter, generateDocxReport, generateDocxFromHtml } from './docx-exporter';
import { CsvExporter, generateAssignmentsCsv, generateWorkstreamsCsv, generateResourcesCsv, generateRisksCsv, generateBenefitsCsv } from './csv-exporter';
import { ExcelExporter, generateExcelWorkbook } from './excel-exporter';
import { escapeCsvField } from './base-exporter';
import { buildStrategyJsonPayload, buildEpmJsonPayload } from './json-payloads';
import { validateExportAcceptance } from './acceptance-gates';

export { loadExportData, escapeCsvField };
export type { ExportRequest, FullExportPackage, ExportResult, IExporter };

export { MarkdownExporter, generateMarkdownReport, generateFiveWhysTreeMarkdown, generateClarificationsMarkdown };
export { HtmlExporter, generateHtmlFromMarkdown, generateUiStyledHtml };
export { PdfExporter, findChromiumExecutable, generatePdfFromHtml, generatePdfFromUiHtml };
export { DocxExporter, generateDocxReport, generateDocxFromHtml };
export { CsvExporter, generateAssignmentsCsv, generateWorkstreamsCsv, generateResourcesCsv, generateRisksCsv, generateBenefitsCsv };
export { ExcelExporter, generateExcelWorkbook };

export async function generateFullPassExport(
  request: ExportRequest,
  outputStream: Writable
): Promise<void> {
  const { sessionId, versionNumber, programId, userId } = request;

  console.log('[Export Service] Starting export generation:', { sessionId, versionNumber, programId, userId });

  console.log('[Export Service] Loading export data...');
  const exportPackage = await loadExportData(sessionId, versionNumber, programId, userId);
  console.log('[Export Service] Data loaded successfully. Version:', exportPackage.metadata.versionNumber);

  const skippedFiles: string[] = [];
  
  console.log('[Export Service] Generating Markdown report...');
  const markdown = generateMarkdownReport(exportPackage);
  
  console.log('[Export Service] Converting Markdown to HTML...');
  const html = await generateHtmlFromMarkdown(markdown);
  
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
  const strategyJson = JSON.stringify(buildStrategyJsonPayload(exportPackage.strategy), null, 2);
  const epmJson = exportPackage.epm?.program
    ? JSON.stringify(buildEpmJsonPayload(exportPackage.epm), null, 2)
    : null;
  
  const parseField = (field: any) => {
    if (!field) return null;
    if (typeof field === 'object') return field;
    try { return JSON.parse(field); } catch { return null; }
  };
  
  const workstreams = parseField(exportPackage.epm?.program?.workstreams);
  const assignmentsCsv = exportPackage.epm?.assignments
    ? generateAssignmentsCsv(exportPackage.epm.assignments, workstreams || [])
    : null;
  const workstreamsCsv = workstreams && workstreams.length > 0 ? generateWorkstreamsCsv(workstreams) : null;
  
  const resourcePlan = parseField(exportPackage.epm?.program?.resourcePlan);
  const resourcesCsv = resourcePlan ? generateResourcesCsv(resourcePlan, exportPackage.epm?.assignments || []) : null;
  
  const riskRegister = parseField(exportPackage.epm?.program?.riskRegister);
  const risksCsv = riskRegister ? generateRisksCsv(riskRegister) : null;
  
  const benefitsRealization = parseField(exportPackage.epm?.program?.benefitsRealization);
  const benefitsCsv = benefitsRealization ? generateBenefitsCsv(benefitsRealization) : null;

  console.log('[Export Service] Running acceptance gates...');
  const acceptanceReport = validateExportAcceptance({
    strategyJson,
    epmJson,
    assignmentsCsv,
    workstreamsCsv,
    resourcesCsv,
    risksCsv,
    benefitsCsv,
    reportMarkdown: markdown,
    reportHtml: html,
  });
  if (!acceptanceReport.passed) {
    acceptanceReport.criticalIssues.forEach((issue) => {
      console.error(`[Export Acceptance] ${issue.code}: ${issue.message}`);
      if (issue.details) {
        console.error('[Export Acceptance] Details:', issue.details);
      }
    });
    throw new Error(
      `Export acceptance gates failed with ${acceptanceReport.criticalIssues.length} critical issue(s)`
    );
  }
  console.log('[Export Service] Acceptance gates passed');
  if (acceptanceReport.warnings.length > 0) {
    acceptanceReport.warnings.forEach((warning) =>
      console.warn(`[Export Acceptance] ${warning.code}: ${warning.message}`)
    );
  }

  console.log('[Export Service] Generating UI-styled HTML...');
  const uiHtml = generateUiStyledHtml(exportPackage);
  
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

  console.log('[Export Service] Generating Excel workbook...');
  let excelBuffer: Buffer | null = null;
  try {
    excelBuffer = await generateExcelWorkbook(exportPackage);
    console.log('[Export Service] Excel workbook generated successfully');
  } catch (error) {
    console.warn('[Export Service] Excel generation failed:', error instanceof Error ? error.message : error);
    skippedFiles.push('epm-program.xlsx (generation failed)');
  }

  console.log('[Export Service] Creating ZIP archive...');
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

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

  archive.pipe(outputStream);

  console.log('[Export Service] Adding files to archive...');
  
  const includedFiles: string[] = [];
  
  archive.append(markdown, { name: 'report.md' });
  includedFiles.push('report.md');
  
  archive.append(docx, { name: 'report.docx' });
  includedFiles.push('report.docx');
  
  archive.append(uiHtml, { name: 'report-ui.html' });
  includedFiles.push('report-ui.html');
  
  archive.append(uiDocx, { name: 'report-ui.docx' });
  includedFiles.push('report-ui.docx');
  
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
  
  if (excelBuffer) {
    archive.append(excelBuffer, { name: 'data/epm-program.xlsx' });
    includedFiles.push('data/epm-program.xlsx');
  }

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
- **data/epm-program.xlsx** - Excel workbook with 8 sheets (Summary, WBS, Schedule, Resources, Budget, RACI, Risks, Assumptions)
- **data/*.csv** - Detailed data exports for assignments, workstreams, resources, risks, and benefits

Generated on: ${new Date(exportPackage.metadata.exportedAt).toLocaleString()}
Session ID: ${exportPackage.metadata.sessionId}
${exportPackage.metadata.versionNumber ? `Version: ${exportPackage.metadata.versionNumber}` : ''}
`;

  archive.append(readmeContent, { name: 'README.txt' });

  console.log('[Export Service] Finalizing archive...');
  console.log(`[Export Service] Archive contains ${includedFiles.length + 1} files (including README)`);
  if (skippedFiles.length > 0) {
    console.log(`[Export Service] ${skippedFiles.length} files were skipped due to Puppeteer unavailability`);
  }
  await archive.finalize();
  console.log('[Export Service] Export package created successfully');
}
