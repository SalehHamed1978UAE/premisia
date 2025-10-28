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

  console.log('[Export Service] Starting export generation:', { sessionId, versionNumber, programId, userId });

  // Load all required data
  console.log('[Export Service] Loading export data...');
  const exportPackage = await loadExportData(sessionId, versionNumber, programId, userId);
  console.log('[Export Service] Data loaded successfully. Version:', exportPackage.metadata.versionNumber);

  // Generate report content in various formats
  console.log('[Export Service] Generating Markdown report...');
  const markdown = generateMarkdownReport(exportPackage);
  
  console.log('[Export Service] Converting Markdown to HTML...');
  const html = await generateHtmlFromMarkdown(markdown);
  
  console.log('[Export Service] Generating PDF from HTML...');
  const pdf = await generatePdfFromHtml(html);
  
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
  archive.append(markdown, { name: 'report.md' });
  archive.append(pdf, { name: 'report.pdf' });
  archive.append(docx, { name: 'report.docx' });
  archive.append(strategyJson, { name: 'data/strategy.json' });
  
  if (epmJson) {
    console.log('[Export Service] Adding EPM data...');
    archive.append(epmJson, { name: 'data/epm.json' });
  }
  if (assignmentsCsv) {
    archive.append(assignmentsCsv, { name: 'data/assignments.csv' });
  }
  if (workstreamsCsv) {
    archive.append(workstreamsCsv, { name: 'data/workstreams.csv' });
  }
  if (resourcesCsv) {
    archive.append(resourcesCsv, { name: 'data/resources.csv' });
  }
  if (risksCsv) {
    archive.append(risksCsv, { name: 'data/risks.csv' });
  }
  if (benefitsCsv) {
    archive.append(benefitsCsv, { name: 'data/benefits.csv' });
  }

  // Finalize the archive
  console.log('[Export Service] Finalizing archive...');
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

  // Load journey session
  console.log('[Export Service] loadExportData - Loading journey session...');
  const [journeySession] = await db.select()
    .from(journeySessions)
    .where(eq(journeySessions.understandingId, understanding?.id || sessionId))
    .limit(1);
  console.log('[Export Service] loadExportData - Journey session loaded:', journeySession ? 'Yes' : 'No');

  // Load strategy version
  console.log('[Export Service] loadExportData - Loading strategy version. Requested version:', versionNumber);
  let strategyVersion;
  if (versionNumber !== undefined) {
    [strategyVersion] = await db.select()
      .from(strategyVersions)
      .where(and(
        eq(strategyVersions.sessionId, sessionId),
        eq(strategyVersions.versionNumber, versionNumber)
      ))
      .limit(1);
    console.log('[Export Service] loadExportData - Loaded specific version:', versionNumber);
  } else {
    // Get latest version (descending order)
    const versions = await db.select()
      .from(strategyVersions)
      .where(eq(strategyVersions.sessionId, sessionId))
      .orderBy(desc(strategyVersions.versionNumber))
      .limit(1);
    strategyVersion = versions[0];
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
  lines.push('# Qgentic Strategic Analysis & EPM Program Report\n');
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
  lines.push('\n*Report generated by Qgentic Intelligent Strategic EPM*\n');
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
    const programTitle = program.executiveSummary?.title || program.frameworkType || 'EPM Program';
    const programOverview = typeof program.executiveSummary === 'object' ? program.executiveSummary?.overview || '' : '';
    
    sections.push(
      new Paragraph({
        text: 'EPM Program',
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Program Title: ', bold: true }),
          new TextRun({ text: programTitle || 'EPM Program' }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Framework: ', bold: true }),
          new TextRun({ text: program.frameworkType || 'Not specified' }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Status: ', bold: true }),
          new TextRun({ text: program.status || 'draft' }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Overall Confidence: ', bold: true }),
          new TextRun({ text: (() => {
            const val = program.overallConfidence ? parseFloat(program.overallConfidence as any) : null;
            return (val !== null && !isNaN(val)) ? `${(val * 100).toFixed(1)}%` : 'Not calculated';
          })() }),
        ],
      })
    );

    if (programOverview) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: 'Overview: ', bold: true })],
        }),
        new Paragraph({
          text: programOverview,
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
