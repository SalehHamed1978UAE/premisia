import Anthropic from '@anthropic-ai/sdk';
import { strategyOntologyService } from '../ontology/strategy-ontology-service';
import type { StrategyAnalysis } from './strategy-analyzer';
import type { GeneratedDecisions } from './decision-generator';
import { ontologyService } from '../ontology-service';

export interface EPMProgram {
  title: string;
  description: string;
  objectives: string[];
  strategic_approach: string;
  market_context: string;
  cost_estimate: {
    total_min: number;
    total_max: number;
    currency: string;
  };
  timeline: {
    total_months: number;
    start_date?: string;
    end_date?: string;
  };
  workstreams: EPMWorkstream[];
  success_criteria: string[];
  key_risks: string[];
}

export interface EPMWorkstream {
  id: string;
  title: string;
  description: string;
  strategic_purpose: string;
  cost_allocation: {
    min: number;
    max: number;
  };
  timeline_months: number;
  required_team: {
    role: string;
    count: number;
  }[];
  tasks: EPMTask[];
}

export interface EPMTask {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimated_hours: number;
  dependencies: string[];
  deliverables: string[];
}

export class EPMConverter {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  async convertToEPM(
    analysis: StrategyAnalysis,
    decisions: GeneratedDecisions,
    selectedDecisions: Record<string, string>
  ): Promise<EPMProgram> {
    const selectedApproach = this.extractSelectedApproach(analysis, selectedDecisions);
    const selectedMarket = analysis.recommended_market;

    const workstreams = strategyOntologyService.allocateWorkstreams(
      selectedApproach,
      selectedMarket
    );

    const costEstimate = strategyOntologyService.calculateCostEstimate(
      selectedApproach,
      selectedMarket
    );

    const programTitle = await this.generateProgramTitle(analysis, selectedApproach);
    const programDescription = await this.generateProgramDescription(
      analysis,
      selectedApproach,
      selectedMarket
    );

    const enrichedWorkstreams = await this.enrichWorkstreamsWithTasks(
      workstreams,
      analysis,
      selectedApproach
    );

    const objectives = this.extractObjectives(analysis);
    const successCriteria = this.extractSuccessCriteria(analysis);
    const keyRisks = this.extractKeyRisks(analysis);

    return {
      title: programTitle,
      description: programDescription,
      objectives,
      strategic_approach: selectedApproach,
      market_context: selectedMarket,
      cost_estimate: {
        total_min: costEstimate?.min || 0,
        total_max: costEstimate?.max || 0,
        currency: 'USD',
      },
      timeline: {
        total_months: costEstimate?.timeline_months || 12,
      },
      workstreams: enrichedWorkstreams,
      success_criteria: successCriteria,
      key_risks: keyRisks,
    };
  }

  private extractSelectedApproach(
    analysis: StrategyAnalysis,
    selectedDecisions: Record<string, string>
  ): string {
    for (const [decisionId, optionId] of Object.entries(selectedDecisions)) {
      if (decisionId.includes('approach') || decisionId.includes('strategy')) {
        const option = optionId.toLowerCase();
        if (option.includes('cost') && option.includes('leadership')) {
          return 'cost_leadership';
        }
        if (option.includes('differentiation') || option.includes('service')) {
          return 'differentiation_service';
        }
        if (option.includes('blue') && option.includes('ocean')) {
          return 'blue_ocean';
        }
      }
    }

    return analysis.recommended_approaches[0] || 'cost_leadership';
  }

  private async generateProgramTitle(
    analysis: StrategyAnalysis,
    approach: string
  ): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: `Generate a concise, professional program title (max 8 words) for this strategic initiative:

ROOT CAUSE: ${analysis.five_whys.root_cause}
APPROACH: ${approach.replace('_', ' ')}
EXECUTIVE SUMMARY: ${analysis.executive_summary}

Return ONLY the title, nothing else.`,
        },
      ],
    });

    const title = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('');

    return title.trim().replace(/['"]/g, '');
  }

  private async generateProgramDescription(
    analysis: StrategyAnalysis,
    approach: string,
    market: string
  ): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: `Write a 2-3 paragraph program description for:

ROOT CAUSE: ${analysis.five_whys.root_cause}
STRATEGIC APPROACH: ${approach.replace('_', ' ')}
MARKET: ${market.toUpperCase()}
EXECUTIVE SUMMARY: ${analysis.executive_summary}

The description should explain:
1. What problem this program solves
2. How the strategic approach addresses it
3. Expected business impact

Return ONLY the description, nothing else.`,
        },
      ],
    });

    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('')
      .trim();
  }

  private async enrichWorkstreamsWithTasks(
    workstreams: Array<{ id: string; label: string; cost_allocation: number; team_size: number }>,
    analysis: StrategyAnalysis,
    approach: string
  ): Promise<EPMWorkstream[]> {
    const enrichedWorkstreams: EPMWorkstream[] = [];

    for (const ws of workstreams) {
      const tasks = await this.generateTasksForWorkstream(ws, analysis, approach);

      enrichedWorkstreams.push({
        id: ws.id,
        title: ws.label,
        description: `Strategic workstream focused on ${ws.label.toLowerCase()} to support ${approach.replace('_', ' ')} approach`,
        strategic_purpose: `Deliver ${ws.label.toLowerCase()} capabilities required for strategy execution`,
        cost_allocation: {
          min: Math.round(ws.cost_allocation * 0.8),
          max: Math.round(ws.cost_allocation * 1.2),
        },
        timeline_months: 6,
        required_team: this.estimateTeamSize(ws),
        tasks,
      });
    }

    return enrichedWorkstreams;
  }

  private async generateTasksForWorkstream(
    workstream: { id: string; label: string },
    analysis: StrategyAnalysis,
    approach: string
  ): Promise<EPMTask[]> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: `Generate 4-6 concrete tasks for the "${workstream.label}" workstream.

STRATEGIC CONTEXT:
- Approach: ${approach.replace('_', ' ')}
- Root Cause: ${analysis.five_whys.root_cause.substring(0, 200)}

Each task should be:
- Specific and actionable
- Include clear deliverables
- Have realistic hour estimates (20-160 hours)
- Marked with priority (critical/high/medium/low)

Return ONLY valid JSON (no markdown):

{
  "tasks": [
    {
      "id": "task_1",
      "title": "Task Title",
      "description": "Detailed description of what needs to be done",
      "priority": "high",
      "estimated_hours": 80,
      "dependencies": [],
      "deliverables": ["deliverable 1", "deliverable 2"]
    }
  ]
}`,
        },
      ],
    });

    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return this.createDefaultTasks(workstream);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.tasks || this.createDefaultTasks(workstream);
    } catch {
      return this.createDefaultTasks(workstream);
    }
  }

  private createDefaultTasks(workstream: { id: string; label: string }): EPMTask[] {
    return [
      {
        id: `${workstream.id}_task_1`,
        title: `Initialize ${workstream.label}`,
        description: `Set up foundational elements for ${workstream.label} workstream`,
        priority: 'high',
        estimated_hours: 40,
        dependencies: [],
        deliverables: ['Setup complete', 'Initial documentation'],
      },
      {
        id: `${workstream.id}_task_2`,
        title: `Implement ${workstream.label} Core`,
        description: `Build core capabilities for ${workstream.label}`,
        priority: 'high',
        estimated_hours: 120,
        dependencies: [`${workstream.id}_task_1`],
        deliverables: ['Core implementation', 'Test results'],
      },
      {
        id: `${workstream.id}_task_3`,
        title: `Validate ${workstream.label}`,
        description: `Validate and refine ${workstream.label} deliverables`,
        priority: 'medium',
        estimated_hours: 60,
        dependencies: [`${workstream.id}_task_2`],
        deliverables: ['Validation report', 'Refinement plan'],
      },
    ];
  }

  private estimateTeamSize(workstream: { team_size: number }): Array<{ role: string; count: number }> {
    const teamSize = workstream.team_size;
    
    if (teamSize <= 2) {
      return [
        { role: 'Senior Specialist', count: 1 },
        { role: 'Specialist', count: 1 },
      ];
    } else if (teamSize <= 5) {
      return [
        { role: 'Team Lead', count: 1 },
        { role: 'Senior Specialist', count: 1 },
        { role: 'Specialist', count: teamSize - 2 },
      ];
    } else {
      return [
        { role: 'Workstream Manager', count: 1 },
        { role: 'Team Lead', count: 1 },
        { role: 'Senior Specialist', count: 2 },
        { role: 'Specialist', count: teamSize - 4 },
      ];
    }
  }

  private extractObjectives(analysis: StrategyAnalysis): string[] {
    return analysis.five_whys.strategic_implications.slice(0, 3);
  }

  private extractSuccessCriteria(analysis: StrategyAnalysis): string[] {
    return analysis.porters_five_forces.key_strategic_priorities.map(
      (priority) => `Achieve measurable progress in: ${priority}`
    );
  }

  private extractKeyRisks(analysis: StrategyAnalysis): string[] {
    const risks: string[] = [];
    const forces = analysis.porters_five_forces;

    if (forces.competitive_rivalry.level === 'high') {
      risks.push(`High competitive rivalry: ${forces.competitive_rivalry.factors[0]}`);
    }
    if (forces.threat_of_substitution.level === 'high') {
      risks.push(`Substitution risk: ${forces.threat_of_substitution.factors[0]}`);
    }
    if (forces.buyer_power.level === 'high') {
      risks.push(`Buyer power pressure: ${forces.buyer_power.factors[0]}`);
    }

    return risks.length > 0 ? risks : ['Market dynamics may shift', 'Resource constraints', 'Execution challenges'];
  }

  async validateEPMStructure(program: EPMProgram): Promise<{
    valid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!program.title || program.title.length < 5) {
      issues.push('Program title must be at least 5 characters');
    }

    if (!program.description || program.description.length < 50) {
      issues.push('Program description must be at least 50 characters');
    }

    if (program.objectives.length === 0) {
      issues.push('Program must have at least one objective');
    }

    if (program.workstreams.length === 0) {
      issues.push('Program must have at least one workstream');
    }

    for (const ws of program.workstreams) {
      if (ws.tasks.length === 0) {
        warnings.push(`Workstream "${ws.title}" has no tasks`);
      }

      if (ws.cost_allocation.min <= 0 || ws.cost_allocation.max <= 0) {
        warnings.push(`Workstream "${ws.title}" has invalid cost allocation`);
      }
    }

    if (program.cost_estimate.total_min > program.cost_estimate.total_max) {
      issues.push('Min cost cannot exceed max cost');
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
    };
  }

  async validateAgainstOntology(program: EPMProgram): Promise<{
    valid: boolean;
    validation: any;
    completeness: any;
    recommendations: string[];
  }> {
    const programData = {
      title: program.title,
      description: program.description,
      objectives: program.objectives,
      budget: program.cost_estimate.total_max,
      timelineDays: program.timeline.total_months * 30,
      status: 'planning',
      successCriteria: program.success_criteria,
    };

    const [validation, completeness] = await Promise.all([
      ontologyService.validateEntityData('Program', programData),
      ontologyService.checkCompleteness('Program', programData),
    ]);

    const recommendations: string[] = [];

    const completenessPercentage = completeness.maxScore > 0 
      ? Math.round((completeness.score / completeness.maxScore) * 100) 
      : 0;

    if (completenessPercentage < 70) {
      recommendations.push('Consider adding more detail to improve completeness (currently ' + completenessPercentage + '%)');
    }

    if (completeness.missingFields && completeness.missingFields.length > 0) {
      const critical = completeness.missingFields.filter((f: any) => f.importance === 'critical');
      if (critical.length > 0) {
        recommendations.push(`Add critical fields: ${critical.map((f: any) => f.field).join(', ')}`);
      }
    }

    if (validation.warnings && validation.warnings.length > 0) {
      validation.warnings.forEach((w: any) => {
        recommendations.push(`Warning: ${w.message}`);
      });
    }

    return {
      valid: validation.isValid,
      validation,
      completeness,
      recommendations,
    };
  }
}
