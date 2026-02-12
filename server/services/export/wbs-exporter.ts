import { BaseExporter, escapeCsvField, type FullExportPackage, type ExportResult } from './base-exporter';
import { format } from 'date-fns';

export class WBSExporter extends BaseExporter {
  readonly name = 'WBS CSV Exporter';
  readonly format = 'wbs-csv';
  readonly mimeType = 'text/csv;charset=utf-8';

  async export(pkg: FullExportPackage): Promise<ExportResult> {
    try {
      // Add UTF-8 BOM for Excel compatibility
      const bom = '\uFEFF';
      const csvContent = bom + generateWBSCsv(pkg);

      return {
        filename: `wbs-${pkg.metadata.sessionId}.csv`,
        content: Buffer.from(csvContent, 'utf-8'),
        mimeType: this.mimeType,
        success: true,
      };
    } catch (error) {
      return {
        filename: `wbs-${pkg.metadata.sessionId}.csv`,
        content: Buffer.from(''),
        mimeType: this.mimeType,
        success: false,
        error: error instanceof Error ? error.message : 'WBS CSV generation failed',
      };
    }
  }
}

export interface WBSRow {
  wbs_code: string;
  task_name: string;
  level: number;
  type: 'program' | 'phase' | 'workstream' | 'task' | 'milestone';
  owner?: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  dependency?: string;
  dependency_type?: string;
  priority?: string;
  status?: string;
  percent_complete?: number;
  description?: string;
  framework_source?: string;
  journey?: string;
  notes?: string;
}

export function generateWBSRows(pkg: FullExportPackage): WBSRow[] {
  const rows: WBSRow[] = [];
  const program = pkg.epm?.program;
  const understanding = pkg.strategy?.understanding;

  if (!program) {
    throw new Error('No EPM program data available for WBS export');
  }

  // Parse fields that might be JSON strings
  const workstreams = parseField(program.workstreams) || [];
  const timeline = parseField(program.timeline) || {};
  const phases = timeline.phases || [];
  const resourcePlan = parseField(program.resourcePlan) || {};
  const riskRegister = parseField(program.riskRegister) || {};

  // Get program start date for date calculations
  const programStartDate = timeline.startDate ? new Date(timeline.startDate) : new Date();
  // Get journey type from journey session data if available
  const journeyType = pkg.strategy?.journeySession?.journeyType ||
                      pkg.strategy?.journeySession?.type ||
                      'Strategic Initiative';

  // Level 0: Program
  const programName = program.name || understanding?.title || 'Strategic Program';
  rows.push({
    wbs_code: '1',
    task_name: programName,
    level: 0,
    type: 'program',
    owner: '',
    start_date: timeline.startDate ? format(new Date(timeline.startDate), 'yyyy-MM-dd') : '',
    end_date: timeline.endDate ? format(new Date(timeline.endDate), 'yyyy-MM-dd') : '',
    duration_days: calculateBusinessDays(timeline.startDate, timeline.endDate),
    dependency: '',
    dependency_type: '',
    priority: 'Critical',
    status: 'Not Started',
    percent_complete: 0,
    description: program.description || understanding?.userInput || '',
    framework_source: '',
    journey: journeyType,
    notes: ''
  });

  // Track WBS codes for dependencies - must be built before generating rows
  const wbsCodeMap = new Map<string, string>();

  // First pass: Build WBS code map for all workstreams
  // Track assigned IDs to prevent duplicate workstreams across phases
  const assignedWsIds = new Set<string>();

  if (phases.length > 0) {
    phases.forEach((phase, phaseIndex) => {
      const phaseWorkstreams = workstreams.filter((ws: any) => {
        if (assignedWsIds.has(ws.id)) return false;
        return ws.phase === phase.name ||
               (ws.startMonth >= phase.startMonth && ws.startMonth <= phase.endMonth);
      });

      phaseWorkstreams.forEach((ws: any, wsIndex: number) => {
        const wsWbsCode = `1.${phaseIndex + 1}.${wsIndex + 1}`;
        wbsCodeMap.set(ws.id, wsWbsCode);
        assignedWsIds.add(ws.id);
      });
    });
  } else {
    workstreams.forEach((ws: any, wsIndex: number) => {
      const wsWbsCode = `1.${wsIndex + 1}`;
      wbsCodeMap.set(ws.id, wsWbsCode);
    });
  }

  // Level 1: Phases or direct workstreams
  // Re-use assignedWsIds to ensure row generation matches the code map
  const rowAssignedWsIds = new Set<string>();

  if (phases.length > 0) {
    phases.forEach((phase, phaseIndex) => {
      const phaseWbsCode = `1.${phaseIndex + 1}`;
      const phaseStartDate = addMonths(programStartDate, phase.startMonth);
      const phaseEndDate = addMonths(programStartDate, phase.endMonth);

      // Add phase
      rows.push({
        wbs_code: phaseWbsCode,
        task_name: phase.name || phase.phase || `Phase ${phaseIndex + 1}`,
        level: 1,
        type: 'phase',
        owner: '',
        start_date: format(phaseStartDate, 'yyyy-MM-dd'),
        end_date: format(phaseEndDate, 'yyyy-MM-dd'),
        duration_days: calculateBusinessDays(phaseStartDate, phaseEndDate),
        dependency: phaseIndex > 0 ? `1.${phaseIndex}` : '',
        dependency_type: phaseIndex > 0 ? 'FS' : '',
        priority: 'Critical',
        status: 'Not Started',
        percent_complete: 0,
        description: `${phase.name} phase of the program`,
        framework_source: '',
        journey: journeyType,
        notes: ''
      });

      // Add milestones for this phase
      if (phase.milestones) {
        phase.milestones.forEach((milestone, milestoneIndex) => {
          const milestoneDate = addMonths(programStartDate, milestone.month);
          const milestoneWbsCode = `${phaseWbsCode}.M${milestoneIndex + 1}`;

          rows.push({
            wbs_code: milestoneWbsCode,
            task_name: milestone.name,
            level: 2,
            type: 'milestone',
            owner: '',
            start_date: format(milestoneDate, 'yyyy-MM-dd'),
            end_date: format(milestoneDate, 'yyyy-MM-dd'),
            duration_days: 0,
            dependency: '',
            dependency_type: '',
            priority: 'High',
            status: 'Not Started',
            percent_complete: 0,
            description: milestone.description,
            framework_source: '',
            journey: journeyType,
            notes: 'Key milestone'
          });
        });
      }

      // Add workstreams for this phase (skip already-assigned to prevent duplicates)
      const phaseWorkstreams = workstreams.filter((ws: any) => {
        if (rowAssignedWsIds.has(ws.id)) return false;
        return ws.phase === phase.name ||
               (ws.startMonth >= phase.startMonth && ws.startMonth <= phase.endMonth);
      });

      phaseWorkstreams.forEach((ws: any, wsIndex: number) => {
        rowAssignedWsIds.add(ws.id);
        const wsWbsCode = `${phaseWbsCode}.${wsIndex + 1}`;
        addWorkstreamToRows(rows, ws, wsWbsCode, 2, programStartDate, journeyType, pkg, wbsCodeMap, phaseStartDate, phaseEndDate);
      });
    });
  } else {
    // No phases, add workstreams directly under program
    const programEndDate = timeline.endDate ? new Date(timeline.endDate) : new Date();
    workstreams.forEach((ws: any, wsIndex: number) => {
      const wsWbsCode = `1.${wsIndex + 1}`;
      addWorkstreamToRows(rows, ws, wsWbsCode, 1, programStartDate, journeyType, pkg, wbsCodeMap, programStartDate, programEndDate);
    });
  }

  return rows;
}

export function generateWBSCsv(pkg: FullExportPackage): string {
  const headers = [
    'wbs_code',
    'task_name',
    'level',
    'type',
    'owner',
    'start_date',
    'end_date',
    'duration_days',
    'dependency',
    'dependency_type',
    'priority',
    'status',
    'percent_complete',
    'description',
    'framework_source',
    'journey',
    'notes'
  ];

  const rows = generateWBSRows(pkg);
  const csvRows = [headers.join(',')];

  rows.forEach(row => {
    const csvRow = [
      escapeCsvField(row.wbs_code),
      escapeCsvField(row.task_name),
      row.level.toString(),
      escapeCsvField(row.type),
      escapeCsvField(row.owner || ''),
      row.start_date || '',
      row.end_date || '',
      row.duration_days !== undefined ? row.duration_days.toString() : '',
      escapeCsvField(row.dependency || ''),
      escapeCsvField(row.dependency_type || ''),
      escapeCsvField(row.priority || ''),
      escapeCsvField(row.status || ''),
      row.percent_complete !== undefined ? row.percent_complete.toString() : '0',
      escapeCsvField(row.description || ''),
      escapeCsvField(row.framework_source || ''),
      escapeCsvField(row.journey || ''),
      escapeCsvField(row.notes || '')
    ];
    csvRows.push(csvRow.join(','));
  });

  return csvRows.join('\n');
}

function addWorkstreamToRows(
  rows: WBSRow[],
  ws: any,
  wsWbsCode: string,
  level: number,
  programStartDate: Date,
  journeyType: string,
  pkg: FullExportPackage,
  wbsCodeMap: Map<string, string>,
  parentStartDate: Date,
  parentEndDate: Date
): void {
  const wsStartDate = addMonths(programStartDate, ws.startMonth || 0);
  const wsEndDate = addMonths(programStartDate, ws.endMonth || ws.startMonth || 0);

  // Determine framework source based on workstream name/description
  const frameworkSource = inferFrameworkSource(ws.name, ws.description);

  // Add workstream
  rows.push({
    wbs_code: wsWbsCode,
    task_name: ws.name,
    level: level,
    type: 'workstream',
    owner: ws.owner || 'TBD',
    start_date: format(wsStartDate, 'yyyy-MM-dd'),
    end_date: format(wsEndDate, 'yyyy-MM-dd'),
    duration_days: calculateBusinessDays(wsStartDate, wsEndDate),
    dependency: formatDependencies(ws.dependencies, wbsCodeMap),
    dependency_type: ws.dependencies && ws.dependencies.length > 0 ? 'FS' : '',
    priority: ws.isCritical ? 'Critical' : 'High',
    status: 'Not Started',
    percent_complete: 0,
    description: ws.description,
    framework_source: frameworkSource,
    journey: journeyType,
    notes: ws.isCritical ? 'Critical path item' : ''
  });

  // Add deliverables/tasks
  if (ws.deliverables && Array.isArray(ws.deliverables)) {
    ws.deliverables.forEach((deliverable: any, delIndex: number) => {
      const taskWbsCode = `${wsWbsCode}.${delIndex + 1}`;
      let taskDueDate = addMonths(programStartDate, deliverable.dueMonth || ws.endMonth || 0);

      // Ensure task due date falls within workstream boundaries
      if (taskDueDate > wsEndDate) {
        taskDueDate = wsEndDate;
      }

      // Calculate realistic start date: estimate task duration based on complexity
      // Use 2 weeks (10 business days) as default for complex deliverables
      const estimatedDuration = estimateTaskDuration(deliverable.name, deliverable.description);
      const taskStartDate = new Date(taskDueDate);
      taskStartDate.setDate(taskStartDate.getDate() - (estimatedDuration * 1.4)); // 1.4 = business days factor

      // Ensure task starts after workstream starts
      const finalTaskStartDate = taskStartDate < wsStartDate ? wsStartDate : taskStartDate;

      // Calculate actual duration based on final dates
      const actualDuration = calculateBusinessDays(finalTaskStartDate, taskDueDate);

      rows.push({
        wbs_code: taskWbsCode,
        task_name: deliverable.name,
        level: level + 1,
        type: 'task',
        owner: ws.owner || 'TBD',
        start_date: format(finalTaskStartDate, 'yyyy-MM-dd'),
        end_date: format(taskDueDate, 'yyyy-MM-dd'),
        duration_days: actualDuration,
        dependency: delIndex > 0 ? `${wsWbsCode}.${delIndex}` : '',
        dependency_type: delIndex > 0 ? 'FS' : '',
        priority: 'Medium',
        status: deliverable.status || 'Not Started',
        percent_complete: 0,
        description: deliverable.description || '',
        framework_source: frameworkSource,
        journey: journeyType,
        notes: deliverable.acceptanceCriteria ?
          `Acceptance: ${Array.isArray(deliverable.acceptanceCriteria) ?
            deliverable.acceptanceCriteria.join('; ') : deliverable.acceptanceCriteria}` : ''
      });
    });
  }
}

function calculateBusinessDays(startDate: any, endDate: any): number {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function formatDependencies(dependencies: string[] | undefined, wbsCodeMap: Map<string, string>): string {
  if (!dependencies || dependencies.length === 0) return '';

  // Map WS### IDs to WBS codes and validate existence
  const mappedDeps = dependencies
    .map((dep) => {
      // Remove any whitespace
      const cleanDep = dep.trim();

      // Check if dependency exists in map
      if (wbsCodeMap.has(cleanDep)) {
        return wbsCodeMap.get(cleanDep);
      }

      // If dependency is already a WBS code format (e.g., "1.1.1"), keep it
      if (/^\d+(\.\d+)*$/.test(cleanDep)) {
        return cleanDep;
      }

      // Dependency not found - log warning but don't fail
      console.warn(`Warning: Dependency "${cleanDep}" not found in WBS code map`);
      return null;
    })
    .filter((dep): dep is string => dep !== null); // Filter out null values

  return mappedDeps.join(';');
}

function estimateTaskDuration(taskName: string, taskDescription: string): number {
  const text = `${taskName} ${taskDescription || ''}`.toLowerCase();

  // Keywords indicating complexity
  const complexKeywords = [
    'comprehensive', 'complete', 'audit', 'certification', 'compliance',
    'assessment', 'strategy', 'framework', 'architecture', 'migration',
    'integration', 'security', 'dpia', 'legal review'
  ];

  const moderateKeywords = [
    'report', 'document', 'plan', 'checklist', 'guidelines',
    'training', 'analysis', 'design', 'implementation'
  ];

  // Check for complex tasks (15-20 business days)
  if (complexKeywords.some(keyword => text.includes(keyword))) {
    return 15;
  }

  // Check for moderate tasks (8-10 business days)
  if (moderateKeywords.some(keyword => text.includes(keyword))) {
    return 10;
  }

  // Simple tasks (5 business days)
  return 5;
}

function inferFrameworkSource(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();

  if (text.includes('market') || text.includes('customer') || text.includes('segment')) {
    return 'Market Analysis';
  } else if (text.includes('competitor') || text.includes('porter')) {
    return "Porter's Five Forces";
  } else if (text.includes('swot') || text.includes('strength') || text.includes('weakness')) {
    return 'SWOT Analysis';
  } else if (text.includes('business model') || text.includes('bmc')) {
    return 'Business Model Canvas';
  } else if (text.includes('pestle') || text.includes('political') || text.includes('regulatory')) {
    return 'PESTLE Analysis';
  } else if (text.includes('technology') || text.includes('digital') || text.includes('platform')) {
    return 'Technology Strategy';
  } else if (text.includes('risk')) {
    return 'Risk Assessment';
  } else if (text.includes('finance') || text.includes('budget') || text.includes('cost')) {
    return 'Financial Planning';
  }

  return '';
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
