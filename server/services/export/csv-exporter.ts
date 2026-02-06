import { format } from 'date-fns';
import { BaseExporter, escapeCsvField, type FullExportPackage, type ExportResult } from './base-exporter';

export class CsvExporter extends BaseExporter {
  readonly name = 'CSV Exporter';
  readonly format = 'csv';
  readonly mimeType = 'text/csv';

  async export(pkg: FullExportPackage): Promise<ExportResult> {
    try {
      const csvFiles: { name: string; content: string }[] = [];

      if (pkg.epm?.assignments && pkg.epm.assignments.length > 0) {
        csvFiles.push({
          name: 'assignments.csv',
          content: generateAssignmentsCsv(pkg.epm.assignments),
        });
      }

      if (pkg.epm?.program?.workstreams) {
        const workstreams = this.parseField(pkg.epm.program.workstreams);
        if (workstreams && workstreams.length > 0) {
          csvFiles.push({
            name: 'workstreams.csv',
            content: generateWorkstreamsCsv(workstreams),
          });
        }
      }

      if (pkg.epm?.program?.resourcePlan) {
        const resourcePlan = this.parseField(pkg.epm.program.resourcePlan);
        if (resourcePlan) {
          csvFiles.push({
            name: 'resources.csv',
            content: generateResourcesCsv(resourcePlan),
          });
        }
      }

      if (pkg.epm?.program?.riskRegister) {
        const riskRegister = this.parseField(pkg.epm.program.riskRegister);
        if (riskRegister) {
          csvFiles.push({
            name: 'risks.csv',
            content: generateRisksCsv(riskRegister),
          });
        }
      }

      if (pkg.epm?.program?.benefitsRealization) {
        const benefitsRealization = this.parseField(pkg.epm.program.benefitsRealization);
        if (benefitsRealization) {
          csvFiles.push({
            name: 'benefits.csv',
            content: generateBenefitsCsv(benefitsRealization),
          });
        }
      }

      const combinedContent = csvFiles.map(f => `=== ${f.name} ===\n${f.content}`).join('\n\n');

      return {
        filename: 'data.csv',
        content: Buffer.from(combinedContent, 'utf-8'),
        mimeType: this.mimeType,
        success: true,
      };
    } catch (error) {
      return {
        filename: 'data.csv',
        content: Buffer.from(''),
        mimeType: this.mimeType,
        success: false,
        error: error instanceof Error ? error.message : 'CSV generation failed',
      };
    }
  }

  generateAssignmentsCsv(assignments: any[], workstreams?: any[]): string {
    return generateAssignmentsCsv(assignments, workstreams);
  }

  generateWorkstreamsCsv(workstreams: any[]): string {
    return generateWorkstreamsCsv(workstreams);
  }

  generateResourcesCsv(resourcePlan: any, assignments: any[] = []): string {
    return generateResourcesCsv(resourcePlan, assignments);
  }

  generateRisksCsv(riskRegister: any): string {
    return generateRisksCsv(riskRegister);
  }

  generateBenefitsCsv(benefitsRealization: any): string {
    return generateBenefitsCsv(benefitsRealization);
  }
}

export function generateAssignmentsCsv(assignments: any[], workstreams?: any[]): string {
  const headers = ['Task ID', 'Task Name', 'Workstream ID', 'Owner', 'Resource ID', 'Resource Name', 'Resource Role', 'Resource Type', 'Status', 'Allocation %', 'Assigned From', 'Assigned To', 'Start Month', 'End Month'];
  const rows = [headers.join(',')];

  const deliverableLookup: Record<string, { workstreamId?: string; startMonth?: number; endMonth?: number }> = {};
  if (Array.isArray(workstreams)) {
    workstreams.forEach((ws: any) => {
      const wsId = ws.id;
      const wsStart = ws.startMonth;
      const wsEnd = ws.endMonth;
      (ws.deliverables || []).forEach((d: any) => {
        const taskId = d.id || d.taskId || d.name;
        if (!taskId) return;
        const dueMonth = d.dueMonth ?? d.due_month;
        deliverableLookup[taskId] = {
          workstreamId: wsId,
          startMonth: wsStart,
          endMonth: dueMonth ?? wsEnd ?? wsStart,
        };
      });
    });
  }

  const parseTaskIdWorkstream = (taskId?: string) => {
    if (!taskId) return '';
    const match = taskId.match(/^(WS\\d+)/i);
    return match ? match[1] : '';
  };

  const minAssignedFrom = assignments
    .map(a => a.assignedFrom)
    .filter(Boolean)
    .map((d: any) => new Date(d))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  assignments.forEach(assignment => {
    const lookup = deliverableLookup[assignment.taskId] || {};
    const workstreamId = lookup.workstreamId || assignment.workstreamId || parseTaskIdWorkstream(assignment.taskId);

    let startMonth = lookup.startMonth;
    let endMonth = lookup.endMonth;
    if ((startMonth === undefined || endMonth === undefined) && assignment.assignedFrom && assignment.assignedTo && minAssignedFrom) {
      const start = new Date(assignment.assignedFrom);
      const end = new Date(assignment.assignedTo);
      const monthsFromStart = (d: Date) => Math.max(0, Math.round((d.getTime() - minAssignedFrom.getTime()) / (1000 * 60 * 60 * 24 * 30)));
      startMonth = startMonth ?? monthsFromStart(start);
      endMonth = endMonth ?? monthsFromStart(end);
    }

    const row = [
      escapeCsvField(assignment.taskId),
      escapeCsvField(assignment.taskName),
      escapeCsvField(workstreamId || ''),
      escapeCsvField(assignment.owner || assignment.resourceName || assignment.resourceRole || ''),
      escapeCsvField(assignment.resourceId),
      escapeCsvField(assignment.resourceName),
      escapeCsvField(assignment.resourceRole || ''),
      escapeCsvField(assignment.resourceType),
      escapeCsvField(assignment.status),
      assignment.allocationPercent?.toString() || '100',
      assignment.assignedFrom ? format(new Date(assignment.assignedFrom), 'yyyy-MM-dd') : '',
      assignment.assignedTo ? format(new Date(assignment.assignedTo), 'yyyy-MM-dd') : '',
      startMonth !== undefined ? `Month ${startMonth}` : '',
      endMonth !== undefined ? `Month ${endMonth}` : '',
    ];
    rows.push(row.join(','));
  });

  return rows.join('\n');
}

export function generateWorkstreamsCsv(workstreams: any[]): string {
  const headers = ['Workstream ID', 'Name', 'Description', 'Owner', 'Start Date', 'End Date', 'Status', 'Deliverables Count', 'Deliverables'];
  const rows = [headers.join(',')];

  workstreams.forEach((ws: any, idx: number) => {
    const deliverables = ws.deliverables || [];
    const deliverableNames = deliverables.map((d: any) => 
      typeof d === 'string' ? d : (d.name || d.title || d.description || 'Deliverable')
    );
    
    const row = [
      ws.id || `WS-${idx + 1}`,
      escapeCsvField(ws.name || `Workstream ${idx + 1}`),
      escapeCsvField(ws.description || '-'),
      escapeCsvField(ws.owner || '-'),
      ws.startMonth !== undefined ? `Month ${ws.startMonth}` : '-',
      ws.endMonth !== undefined ? `Month ${ws.endMonth}` : '-',
      escapeCsvField(ws.status || 'Pending'),
      deliverables.length.toString(),
      escapeCsvField(deliverableNames.join('; ') || '-')
    ];
    rows.push(row.join(','));
  });

  return rows.join('\n');
}

export function generateResourcesCsv(resourcePlan: any, assignments: any[] = []): string {
  const headers = ['Resource Type', 'Role/Title', 'FTE/Quantity', 'Total Allocation %', 'Estimated FTE', 'Overallocated', 'Skills/Responsibilities', 'Source'];
  const rows = [headers.join(',')];

  const plan = typeof resourcePlan === 'string' ? JSON.parse(resourcePlan) : resourcePlan;
  if (!plan) return rows.join('\n');

  const allocationByRole: Record<string, number> = {};
  assignments.forEach((a: any) => {
    const key = a.resourceRole || a.resourceName || a.owner;
    if (!key) return;
    const alloc = typeof a.allocationPercent === 'number' ? a.allocationPercent : parseFloat(a.allocationPercent || '0');
    if (!Number.isNaN(alloc)) {
      allocationByRole[key] = (allocationByRole[key] || 0) + alloc;
    }
  });

  const allocationInfo = (role: string) => {
    const total = allocationByRole[role] ?? 0;
    const estimatedFte = total ? (total / 100).toFixed(2) : '';
    const over = total > 100 ? 'Yes' : 'No';
    return { total: total ? total.toFixed(0) + '%' : '', estimatedFte, over };
  };

  if (plan.internalTeam && plan.internalTeam.length > 0) {
    plan.internalTeam.forEach((r: any) => {
      // Skills can be an array or string - format appropriately
      let skillsText = '-';
      if (Array.isArray(r.skills) && r.skills.length > 0) {
        skillsText = r.skills.join(', ');
      } else if (r.skills && typeof r.skills === 'string') {
        skillsText = r.skills;
      } else if (r.responsibilities) {
        skillsText = r.responsibilities;
      } else if (r.justification) {
        // Fallback to justification which often describes the role
        skillsText = r.justification;
      }
      
      const role = r.role || r.title || 'Not specified';
      const alloc = allocationInfo(role);
      const row = [
        'Internal',
        escapeCsvField(role),
        r.allocation || r.fte || 'TBD',
        alloc.total,
        alloc.estimatedFte,
        alloc.over,
        escapeCsvField(skillsText),
        'Internal Team'
      ];
      rows.push(row.join(','));
    });
  }

  if (plan.externalResources && plan.externalResources.length > 0) {
    plan.externalResources.forEach((r: any) => {
      // Handle skills array for external resources too
      let skillsText = '-';
      if (Array.isArray(r.skills) && r.skills.length > 0) {
        skillsText = r.skills.join(', ');
      } else if (r.skills && typeof r.skills === 'string') {
        skillsText = r.skills;
      } else if (r.requirements) {
        skillsText = r.requirements;
      } else if (r.description) {
        skillsText = r.description;
      }
      
      const role = r.type || r.role || 'Contractor';
      const alloc = allocationInfo(role);
      const row = [
        'External',
        escapeCsvField(role),
        r.quantity || r.count || '1',
        alloc.total,
        alloc.estimatedFte,
        alloc.over,
        escapeCsvField(skillsText),
        'External/Vendor'
      ];
      rows.push(row.join(','));
    });
  }

  return rows.join('\n');
}

export function generateRisksCsv(riskRegister: any): string {
  const headers = ['Risk ID', 'Risk Description', 'Probability', 'Impact', 'Severity', 'Severity Score', 'Severity Level', 'Mitigation Strategy', 'Owner'];
  const rows = [headers.join(',')];

  const risks = typeof riskRegister === 'string' ? JSON.parse(riskRegister) : riskRegister;
  if (!risks) return rows.join('\n');

  const riskArray = risks.risks || risks;
  if (Array.isArray(riskArray)) {
    riskArray.forEach((r: any, idx: number) => {
      // Calculate severity if not provided: probability (0-100) * impact multiplier
      const impactMultiplier = r.impact === 'Critical' ? 4 : r.impact === 'High' ? 3 : r.impact === 'Medium' ? 2 : 1;
      let probabilityValue: number | null = null;
      if (typeof r.probability === 'number') probabilityValue = r.probability;
      if (typeof r.probability === 'string') {
        const p = parseFloat(r.probability.replace('%', '').trim());
        if (!Number.isNaN(p)) probabilityValue = p;
      }

      const calculatedSeverity = r.severity ?? (probabilityValue !== null ? Math.round((probabilityValue * impactMultiplier) / 10) : '-');
      const severityScore = typeof calculatedSeverity === 'number' ? calculatedSeverity : '-';
      const severityLabel = typeof calculatedSeverity === 'number'
        ? calculatedSeverity >= 30
          ? 'Critical'
          : calculatedSeverity >= 20
            ? 'High'
            : calculatedSeverity >= 10
              ? 'Medium'
              : calculatedSeverity > 0
                ? 'Low'
                : '-'
        : '-';
      
      const row = [
        r.id || `RISK-${idx + 1}`,
        escapeCsvField(r.risk || r.name || r.description || 'Unnamed risk'),
        typeof r.probability === 'number' ? `${r.probability}%` : (r.probability || r.likelihood || '-'),
        r.impact || '-',
        typeof calculatedSeverity === 'number' ? `${calculatedSeverity} (${severityLabel})` : calculatedSeverity,
        severityScore,
        severityLabel,
        escapeCsvField(r.mitigation || r.response || r.strategy || '-'),
        escapeCsvField(r.owner || '-')
      ];
      rows.push(row.join(','));
    });
  }

  return rows.join('\n');
}

export function generateBenefitsCsv(benefitsRealization: any): string {
  const headers = ['Benefit ID', 'Benefit Name', 'Description', 'Category', 'Metric', 'Target', 'Timeframe', 'Responsible Party'];
  const rows = [headers.join(',')];

  const benefits = typeof benefitsRealization === 'string' ? JSON.parse(benefitsRealization) : benefitsRealization;
  if (!benefits) return rows.join('\n');

  const benefitArray = benefits.benefits || [];
  if (Array.isArray(benefitArray)) {
    benefitArray.forEach((b: any, idx: number) => {
      // Support both standard path field names and custom path field names
      // Extract a short name from description if name isn't present
      const benefitName = b.name || b.benefit || 
        (b.description ? b.description.split('.')[0].substring(0, 80) : 'Benefit ' + (idx + 1));
      
      // Build target from available fields
      const target = b.target || b.goal || b.measurable_target || 
        (b.estimatedValue ? `$${b.estimatedValue.toLocaleString()}` : b.measurement || '-');
      
      // Build timeframe from month or timeline
      const timeframe = b.timeframe || b.timeline || b.realization_timeline ||
        (b.realizationMonth ? `Month ${b.realizationMonth}` : '-');
      
      const row = [
        `BEN-${idx + 1}`,
        escapeCsvField(benefitName),
        escapeCsvField(b.description || '-'),
        escapeCsvField(b.category || b.type || '-'),
        escapeCsvField(b.metric || b.quantified_value || b.measurement || '-'),
        escapeCsvField(target),
        escapeCsvField(timeframe),
        escapeCsvField(b.responsibleParty || b.owner || b.responsible || '-')
      ];
      rows.push(row.join(','));
    });
  }

  return rows.join('\n');
}
