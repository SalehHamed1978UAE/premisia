import * as XLSX from 'xlsx';
import { BaseExporter, type FullExportPackage, type ExportResult } from './base-exporter';

export class ExcelExporter extends BaseExporter {
  readonly name = 'ExcelExporter';
  readonly format = 'xlsx';
  readonly mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  async export(pkg: FullExportPackage): Promise<ExportResult> {
    try {
      const buffer = await generateExcelWorkbook(pkg);
      return {
        success: true,
        content: buffer,
        mimeType: this.mimeType,
        filename: `epm-program-${pkg.metadata.sessionId}.xlsx`,
      };
    } catch (error) {
      console.error('[ExcelExporter] Error:', error);
      return {
        success: false,
        content: '',
        mimeType: this.mimeType,
        filename: `epm-program-${pkg.metadata.sessionId}.xlsx`,
        error: error instanceof Error ? error.message : 'Excel generation failed',
      };
    }
  }
}

export async function generateExcelWorkbook(pkg: FullExportPackage): Promise<Buffer> {
  const workbook = XLSX.utils.book_new();
  const program = pkg.epm?.program;
  
  addSummarySheet(workbook, pkg);
  addWBSSheet(workbook, program);
  addScheduleSheet(workbook, program);
  addResourcesSheet(workbook, program);
  addBudgetSheet(workbook, program);
  addRACISheet(workbook, program, pkg.epm?.assignments);
  addRisksSheet(workbook, program);
  addAssumptionsSheet(workbook, pkg);
  
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  console.log('[ExcelExporter] Generated workbook with', workbook.SheetNames.length, 'sheets');
  return buffer;
}

function addSummarySheet(workbook: XLSX.WorkBook, pkg: FullExportPackage): void {
  const program = pkg.epm?.program;
  const understanding = pkg.strategy?.understanding;
  
  const data = [
    ['EPM PROGRAM SUMMARY'],
    [''],
    ['Program Name', program?.name || understanding?.title || 'Strategic Program'],
    ['Description', program?.description || understanding?.userInput || ''],
    [''],
    ['KEY METRICS'],
    ['Total Duration', program?.timeline ? `${parseField(program.timeline)?.totalMonths || 0} months` : 'N/A'],
    ['Total Workstreams', parseField(program?.workstreams)?.length || 0],
    ['Total Budget', formatCurrency(calculateTotalBudget(program))],
    ['Total FTE', calculateTotalFTE(program)],
    ['Risk Count', parseField(program?.riskRegister)?.risks?.length || 0],
    [''],
    ['EXPORT METADATA'],
    ['Exported At', pkg.metadata.exportedAt],
    ['Session ID', pkg.metadata.sessionId],
    ['Version', pkg.metadata.versionNumber || 'Latest'],
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  setColumnWidths(ws, [30, 60]);
  XLSX.utils.book_append_sheet(workbook, ws, 'Summary');
}

function addWBSSheet(workbook: XLSX.WorkBook, program: any): void {
  const workstreams = parseField(program?.workstreams) || [];
  
  const headers = ['ID', 'Workstream', 'Deliverable', 'Due Month', 'Acceptance Criteria'];
  const data = [headers];
  
  let rowNum = 1;
  for (const ws of workstreams) {
    const deliverables = ws.deliverables || [];
    if (deliverables.length === 0) {
      data.push([ws.id, ws.name, 'No deliverables', '', '']);
      rowNum++;
    } else {
      for (const del of deliverables) {
        data.push([
          ws.id,
          ws.name,
          del.name,
          `M${del.dueMonth}`,
          Array.isArray(del.acceptanceCriteria) ? del.acceptanceCriteria.join('; ') : (del.acceptanceCriteria || ''),
        ]);
        rowNum++;
      }
    }
  }
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  setColumnWidths(ws, [10, 30, 40, 12, 50]);
  XLSX.utils.book_append_sheet(workbook, ws, 'WBS');
}

function addScheduleSheet(workbook: XLSX.WorkBook, program: any): void {
  const workstreams = parseField(program?.workstreams) || [];
  const timeline = parseField(program?.timeline);
  const phases = timeline?.phases || [];
  
  const headers = ['Phase', 'Item', 'Start Month', 'End Month', 'Duration', 'Dependencies'];
  const data = [headers];
  
  for (const phase of phases) {
    data.push([
      phase.name || phase.phase,
      'Phase',
      `M${phase.startMonth}`,
      `M${phase.endMonth}`,
      `${phase.endMonth - phase.startMonth + 1} months`,
      '',
    ]);
    
    const phaseWs = workstreams.filter((ws: any) => ws.phase === phase.name || ws.startMonth >= phase.startMonth && ws.startMonth <= phase.endMonth);
    for (const ws of phaseWs) {
      data.push([
        '',
        ws.name,
        `M${ws.startMonth}`,
        `M${ws.endMonth}`,
        `${ws.endMonth - ws.startMonth + 1} months`,
        (ws.dependencies || []).join(', '),
      ]);
    }
  }
  
  if (phases.length === 0) {
    for (const ws of workstreams) {
      data.push([
        ws.phase || '',
        ws.name,
        `M${ws.startMonth}`,
        `M${ws.endMonth}`,
        `${ws.endMonth - ws.startMonth + 1} months`,
        (ws.dependencies || []).join(', '),
      ]);
    }
  }
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  setColumnWidths(ws, [20, 40, 12, 12, 12, 30]);
  XLSX.utils.book_append_sheet(workbook, ws, 'Schedule');
}

function addResourcesSheet(workbook: XLSX.WorkBook, program: any): void {
  const resourcePlan = parseField(program?.resourcePlan);
  const allocations = resourcePlan?.allocations || [];
  
  const headers = ['Role', 'Workstream', 'FTE', 'Start Month', 'End Month', 'Skill Requirements'];
  const data = [headers];
  
  for (const alloc of allocations) {
    data.push([
      alloc.role || alloc.resourceType,
      alloc.workstreamId || alloc.workstream || 'Program-wide',
      alloc.fte?.toFixed(2) || alloc.percentage?.toString() || '0',
      alloc.startMonth ? `M${alloc.startMonth}` : '',
      alloc.endMonth ? `M${alloc.endMonth}` : '',
      Array.isArray(alloc.skills) ? alloc.skills.join(', ') : (alloc.skillRequirements || ''),
    ]);
  }
  
  if (resourcePlan?.summary) {
    data.push(['']);
    data.push(['RESOURCE SUMMARY']);
    data.push(['Total FTE', '', resourcePlan.summary.totalFte?.toFixed(2) || '']);
    data.push(['Peak FTE', '', resourcePlan.summary.peakFte?.toFixed(2) || '']);
    data.push(['Key Roles', '', (resourcePlan.summary.keyRoles || []).join(', ')]);
  }
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  setColumnWidths(ws, [25, 30, 10, 12, 12, 40]);
  XLSX.utils.book_append_sheet(workbook, ws, 'Resources');
}

function addBudgetSheet(workbook: XLSX.WorkBook, program: any): void {
  const budget = parseField(program?.budget);
  const workstreams = parseField(program?.workstreams) || [];
  
  const headers = ['Category', 'Item', 'Amount', 'Notes'];
  const data = [headers];
  
  if (budget?.breakdown) {
    for (const item of budget.breakdown) {
      data.push([
        item.category || 'General',
        item.name || item.description,
        formatCurrency(item.amount),
        item.notes || '',
      ]);
    }
  }
  
  for (const ws of workstreams) {
    if (ws.estimatedCost) {
      data.push([
        'Workstream',
        ws.name,
        formatCurrency(ws.estimatedCost),
        '',
      ]);
    }
  }
  
  data.push(['']);
  data.push(['BUDGET SUMMARY']);
  data.push(['Total Program Budget', '', formatCurrency(budget?.totalBudget || calculateTotalBudget(program))]);
  data.push(['Contingency', '', formatCurrency(budget?.contingency || 0)]);
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  setColumnWidths(ws, [20, 40, 15, 40]);
  XLSX.utils.book_append_sheet(workbook, ws, 'Budget');
}

function addRACISheet(workbook: XLSX.WorkBook, program: any, assignments: any[] = []): void {
  const workstreams = parseField(program?.workstreams) || [];
  const roles = extractRoles(program);
  
  const headers = ['Deliverable', ...roles];
  const data = [headers];
  
  for (const ws of workstreams) {
    for (const del of ws.deliverables || []) {
      const row = [del.name];
      for (const role of roles) {
        const assignment = findAssignment(assignments, ws.id, del.id, role);
        row.push(assignment?.responsibility || '');
      }
      data.push(row);
    }
  }
  
  data.push(['']);
  data.push(['LEGEND']);
  data.push(['R = Responsible', 'A = Accountable', 'C = Consulted', 'I = Informed']);
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  setColumnWidths(ws, [40, ...roles.map(() => 15)]);
  XLSX.utils.book_append_sheet(workbook, ws, 'RACI');
}

function addRisksSheet(workbook: XLSX.WorkBook, program: any): void {
  const riskRegister = parseField(program?.riskRegister);
  const risks = riskRegister?.risks || [];
  
  const headers = ['ID', 'Risk', 'Category', 'Probability', 'Impact', 'Score', 'Mitigation', 'Owner', 'Status'];
  const data = [headers];
  
  for (const risk of risks) {
    const score = (risk.probability || 0) * (risk.impact || 0);
    data.push([
      risk.id || '',
      risk.description || risk.name,
      risk.category || '',
      risk.probability || '',
      risk.impact || '',
      score.toFixed(1),
      risk.mitigation || risk.mitigationStrategy || '',
      risk.owner || '',
      risk.status || 'Open',
    ]);
  }
  
  data.push(['']);
  data.push(['RISK SUMMARY']);
  data.push(['Total Risks', risks.length]);
  data.push(['High Risks (Score > 6)', risks.filter((r: any) => (r.probability || 0) * (r.impact || 0) > 6).length]);
  data.push(['Medium Risks (Score 3-6)', risks.filter((r: any) => {
    const s = (r.probability || 0) * (r.impact || 0);
    return s >= 3 && s <= 6;
  }).length]);
  data.push(['Low Risks (Score < 3)', risks.filter((r: any) => (r.probability || 0) * (r.impact || 0) < 3).length]);
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  setColumnWidths(ws, [10, 40, 15, 12, 10, 10, 40, 15, 12]);
  XLSX.utils.book_append_sheet(workbook, ws, 'Risks');
}

function addAssumptionsSheet(workbook: XLSX.WorkBook, pkg: FullExportPackage): void {
  const program = pkg.epm?.program;
  const assumptions = parseField(program?.assumptions) || [];
  const constraints = parseField(program?.constraints) || [];
  const understanding = pkg.strategy?.understanding;
  
  const data = [
    ['STRATEGIC ASSUMPTIONS & CONSTRAINTS'],
    [''],
    ['ASSUMPTIONS'],
    ['ID', 'Assumption', 'Category', 'Validated'],
  ];
  
  if (Array.isArray(assumptions)) {
    for (let i = 0; i < assumptions.length; i++) {
      const a = assumptions[i];
      if (typeof a === 'string') {
        data.push([`A${i + 1}`, a, '', '']);
      } else {
        data.push([a.id || `A${i + 1}`, a.description || a.assumption, a.category || '', a.validated ? 'Yes' : 'No']);
      }
    }
  }
  
  data.push(['']);
  data.push(['CONSTRAINTS']);
  data.push(['ID', 'Constraint', 'Type', 'Impact']);
  
  if (Array.isArray(constraints)) {
    for (let i = 0; i < constraints.length; i++) {
      const c = constraints[i];
      if (typeof c === 'string') {
        data.push([`C${i + 1}`, c, '', '']);
      } else {
        data.push([c.id || `C${i + 1}`, c.description || c.constraint, c.type || '', c.impact || '']);
      }
    }
  }
  
  if (understanding) {
    data.push(['']);
    data.push(['STRATEGIC CONTEXT']);
    data.push(['Business Context', understanding.userInput || '']);
    data.push(['Title', understanding.title || '']);
  }
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  setColumnWidths(ws, [10, 50, 20, 15]);
  XLSX.utils.book_append_sheet(workbook, ws, 'Assumptions');
}

function parseField(field: any): any {
  if (!field) return null;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch {
    return null;
  }
}

function setColumnWidths(ws: XLSX.WorkSheet, widths: number[]): void {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function calculateTotalBudget(program: any): number {
  const budget = parseField(program?.budget);
  if (budget?.totalBudget) return budget.totalBudget;
  
  const workstreams = parseField(program?.workstreams) || [];
  return workstreams.reduce((sum: number, ws: any) => sum + (ws.estimatedCost || 0), 0);
}

function calculateTotalFTE(program: any): string {
  const resourcePlan = parseField(program?.resourcePlan);
  if (resourcePlan?.summary?.totalFte) return resourcePlan.summary.totalFte.toFixed(2);
  
  const allocations = resourcePlan?.allocations || [];
  const total = allocations.reduce((sum: number, a: any) => sum + (a.fte || 0), 0);
  return total.toFixed(2);
}

function extractRoles(program: any): string[] {
  const resourcePlan = parseField(program?.resourcePlan);
  const allocations = resourcePlan?.allocations || [];
  
  const roles = new Set<string>();
  for (const alloc of allocations) {
    if (alloc.role) roles.add(alloc.role);
    if (alloc.resourceType) roles.add(alloc.resourceType);
  }
  
  if (roles.size === 0) {
    return ['Project Manager', 'Lead', 'Developer', 'Analyst'];
  }
  
  return Array.from(roles);
}

function findAssignment(assignments: any[], wsId: string, delId: string, role: string): any {
  return assignments.find(a => 
    a.workstreamId === wsId && 
    a.deliverableId === delId && 
    (a.role === role || a.assignee === role)
  );
}
