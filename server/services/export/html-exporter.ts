import { marked } from 'marked';
import { format } from 'date-fns';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BaseExporter, type FullExportPackage, type ExportResult } from './base-exporter';

export class HtmlExporter extends BaseExporter {
  readonly name = 'HTML Exporter';
  readonly format = 'html';
  readonly mimeType = 'text/html';

  async export(pkg: FullExportPackage): Promise<ExportResult> {
    try {
      const html = generateUiStyledHtml(pkg);
      return {
        filename: 'report.html',
        content: Buffer.from(html, 'utf-8'),
        mimeType: this.mimeType,
        success: true,
      };
    } catch (error) {
      return {
        filename: 'report.html',
        content: Buffer.from(''),
        mimeType: this.mimeType,
        success: false,
        error: error instanceof Error ? error.message : 'HTML generation failed',
      };
    }
  }

  generateHtmlFromMarkdown(markdown: string): Promise<string> {
    return generateHtmlFromMarkdown(markdown);
  }

  generateUiStyledHtml(pkg: FullExportPackage): string {
    return generateUiStyledHtml(pkg);
  }
}

export async function generateHtmlFromMarkdown(markdown: string): Promise<string> {
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

export function generateUiStyledHtml(pkg: FullExportPackage): string {
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

  const getConfidenceBadge = (confidence: number | string): string => {
    const conf = typeof confidence === 'number' ? confidence : parseFloat(confidence as string);
    if (isNaN(conf)) return '<span class="badge badge-secondary">N/A</span>';
    
    const percentage = conf * 100;
    let badgeClass = 'badge-warning';
    if (percentage >= 75) badgeClass = 'badge-success';
    else if (percentage < 50) badgeClass = 'badge-destructive';
    
    return `<span class="badge ${badgeClass}">${percentage.toFixed(0)}%</span>`;
  };

  const escapeHtml = (str: any): string => {
    if (str === null || str === undefined) return '';
    
    let stringValue: string;
    if (typeof str === 'object') {
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
  
  const title = pkg.strategy.understanding?.title || 'Strategic Analysis Report';
  contentParts.push(`
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">Generated: ${format(new Date(pkg.metadata.exportedAt), 'PPpp')}</p>
      <p class="subtitle">Session ID: ${pkg.metadata.sessionId}</p>
      ${pkg.metadata.versionNumber ? `<p class="subtitle">Version: ${pkg.metadata.versionNumber}</p>` : ''}
    </div>
  `);

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
    
    const context = parseField(j.accumulatedContext);
    const insights = context?.insights || {};
    
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
          </div>
        </div>
      `);
    }
  }

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

  if (pkg.epm?.program) {
    const program = pkg.epm.program;
    const execSummary = parseField(program.executiveSummary);
    const workstreams = parseField(program.workstreams);
    const timeline = parseField(program.timeline);
    const resourcePlan = parseField(program.resourcePlan);
    const risks = parseField(program.riskRegister);
    const stageGates = parseField(program.stageGates);
    const kpis = parseField(program.kpis);

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
              <strong>Strategic Objectives:</strong>
              <ol>
                ${execSummary.objectives.map((obj: string) => `<li>${escapeHtml(obj)}</li>`).join('')}
              </ol>
            </div>
            ` : ''}
          </div>
        </div>
      `);
    }

    if (workstreams && workstreams.length > 0) {
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">2. Workstreams</h2>
          </div>
          <div class="card-content">
            ${workstreams.map((ws: any, idx: number) => `
              <div class="mb-4">
                <h3>${idx + 1}. ${escapeHtml(ws.name || `Workstream ${idx + 1}`)}</h3>
                ${ws.description ? `<p>${escapeHtml(ws.description)}</p>` : ''}
                ${ws.owner ? `<p><strong>Owner:</strong> ${escapeHtml(ws.owner)}</p>` : ''}
                ${ws.startMonth !== undefined && ws.endMonth !== undefined ? `<p><strong>Duration:</strong> Month ${ws.startMonth} to Month ${ws.endMonth}</p>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `);
    }

    if (timeline) {
      contentParts.push(`
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">3. Timeline & Critical Path</h2>
          </div>
          <div class="card-content">
            ${timeline.totalDuration ? `<p><strong>Total Duration:</strong> ${timeline.totalDuration} months</p>` : ''}
            ${timeline.phases && timeline.phases.length > 0 ? `
            <div class="mb-4">
              <strong>Program Phases:</strong>
              <ul>
                ${timeline.phases.map((phase: any) => `<li><strong>${escapeHtml(phase.name)}:</strong> Month ${phase.startMonth} to Month ${phase.endMonth}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
            ${timeline.criticalPath && timeline.criticalPath.length > 0 ? `
            <div>
              <strong>Critical Path:</strong>
              <ul>
                ${timeline.criticalPath.map((item: string) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </div>
            ` : ''}
          </div>
        </div>
      `);
    }

    if (risks) {
      const riskArray = risks.risks || risks;
      if (Array.isArray(riskArray) && riskArray.length > 0) {
        contentParts.push(`
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">7. Risk Register</h2>
            </div>
            <div class="card-content">
              <table class="table">
                <thead>
                  <tr>
                    <th>Risk</th>
                    <th>Probability</th>
                    <th>Impact</th>
                    <th>Mitigation</th>
                  </tr>
                </thead>
                <tbody>
                  ${riskArray.map((r: any) => `
                    <tr>
                      <td>${escapeHtml(r.risk || r.name || r.description || 'Unnamed risk')}</td>
                      <td>${escapeHtml(r.probability || r.likelihood || '-')}</td>
                      <td>${escapeHtml(r.impact || r.severity || '-')}</td>
                      <td>${escapeHtml(r.mitigation || r.response || '-')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `);
      }
    }
  }

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

  contentParts.push(`
    <div class="card" style="background: hsl(var(--muted)); border: none;">
      <div class="card-content" style="text-align: center;">
        <p class="text-muted"><em>Report generated by Premisia Intelligent Strategic EPM</em></p>
        <p class="text-muted"><em>Export Date: ${format(new Date(pkg.metadata.exportedAt), 'PPPPpp')}</em></p>
      </div>
    </div>
  `);

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
