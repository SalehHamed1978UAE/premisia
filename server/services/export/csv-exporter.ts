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

  generateAssignmentsCsv(assignments: any[]): string {
    return generateAssignmentsCsv(assignments);
  }

  generateWorkstreamsCsv(workstreams: any[]): string {
    return generateWorkstreamsCsv(workstreams);
  }

  generateResourcesCsv(resourcePlan: any): string {
    return generateResourcesCsv(resourcePlan);
  }

  generateRisksCsv(riskRegister: any): string {
    return generateRisksCsv(riskRegister);
  }

  generateBenefitsCsv(benefitsRealization: any): string {
    return generateBenefitsCsv(benefitsRealization);
  }
}

export function generateAssignmentsCsv(assignments: any[]): string {
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

export function generateResourcesCsv(resourcePlan: any): string {
  const headers = ['Resource Type', 'Role/Title', 'FTE/Quantity', 'Skills/Responsibilities', 'Source'];
  const rows = [headers.join(',')];

  const plan = typeof resourcePlan === 'string' ? JSON.parse(resourcePlan) : resourcePlan;
  if (!plan) return rows.join('\n');

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
      
      const row = [
        'Internal',
        escapeCsvField(r.role || r.title || 'Not specified'),
        r.allocation || r.fte || 'TBD',
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
      
      const row = [
        'External',
        escapeCsvField(r.type || r.role || 'Contractor'),
        r.quantity || r.count || '1',
        escapeCsvField(skillsText),
        'External/Vendor'
      ];
      rows.push(row.join(','));
    });
  }

  return rows.join('\n');
}

export function generateRisksCsv(riskRegister: any): string {
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
