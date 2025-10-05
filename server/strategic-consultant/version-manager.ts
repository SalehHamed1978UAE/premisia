import type { IStorage } from '../storage';
import type { StrategyAnalysis } from './strategy-analyzer';
import type { GeneratedDecisions } from './decision-generator';

export interface StrategyVersionData {
  version_number: number;
  analysis: StrategyAnalysis;
  decisions: GeneratedDecisions;
  selected_decisions?: Record<string, string>; 
  program_structure?: any;
  status: 'draft' | 'in_review' | 'finalized';
  created_by: string;
  created_at?: Date;
  finalized_at?: Date;
}

export interface VersionComparison {
  version_a: number;
  version_b: number;
  differences: {
    approach_changed: boolean;
    market_changed: boolean;
    cost_delta: { min_delta: number; max_delta: number } | null;
    timeline_delta_months: number | null;
    decisions_changed: string[];
  };
  recommendation: string;
}

export class VersionManager {
  constructor(private storage: IStorage) {}

  async createVersion(
    sessionId: string,
    analysis: StrategyAnalysis,
    decisions: GeneratedDecisions,
    userId: string
  ): Promise<StrategyVersionData> {
    const existingVersions = await this.storage.getStrategyVersionsBySession(sessionId);
    const versionNumber = existingVersions.length + 1;

    const versionData: StrategyVersionData = {
      version_number: versionNumber,
      analysis,
      decisions,
      status: 'draft',
      created_by: userId,
      created_at: new Date(),
    };

    const version = await this.storage.createStrategyVersion({
      session_id: sessionId,
      version_number: versionNumber,
      analysis_data: analysis,
      decisions_data: decisions,
      selected_decisions: null,
      program_structure: null,
      status: 'draft',
      created_by: userId,
    });

    return versionData;
  }

  async updateVersion(
    sessionId: string,
    versionNumber: number,
    selectedDecisions: Record<string, string>
  ): Promise<StrategyVersionData> {
    const version = await this.storage.getStrategyVersion(sessionId, versionNumber);
    
    if (!version) {
      throw new Error(`Version ${versionNumber} not found for session ${sessionId}`);
    }

    if (version.status === 'finalized') {
      throw new Error('Cannot update finalized version');
    }

    const updated = await this.storage.updateStrategyVersion(version.id, {
      selected_decisions: selectedDecisions,
      status: 'in_review',
    });

    return {
      version_number: updated.version_number,
      analysis: updated.analysis_data as StrategyAnalysis,
      decisions: updated.decisions_data as GeneratedDecisions,
      selected_decisions: updated.selected_decisions as Record<string, string>,
      program_structure: updated.program_structure,
      status: updated.status as 'draft' | 'in_review' | 'finalized',
      created_by: updated.created_by,
      created_at: updated.created_at,
      finalized_at: updated.finalized_at || undefined,
    };
  }

  async finalizeVersion(
    sessionId: string,
    versionNumber: number,
    programStructure: any
  ): Promise<StrategyVersionData> {
    const version = await this.storage.getStrategyVersion(sessionId, versionNumber);
    
    if (!version) {
      throw new Error(`Version ${versionNumber} not found for session ${sessionId}`);
    }

    if (version.status === 'finalized') {
      throw new Error('Version already finalized');
    }

    if (!version.selected_decisions || Object.keys(version.selected_decisions as Record<string, unknown>).length === 0) {
      throw new Error('Cannot finalize version without selected decisions');
    }

    const updated = await this.storage.updateStrategyVersion(version.id, {
      program_structure: programStructure,
      status: 'finalized',
      finalized_at: new Date(),
    });

    return {
      version_number: updated.version_number,
      analysis: updated.analysis_data as StrategyAnalysis,
      decisions: updated.decisions_data as GeneratedDecisions,
      selected_decisions: updated.selected_decisions as Record<string, string>,
      program_structure: updated.program_structure,
      status: updated.status as 'draft' | 'in_review' | 'finalized',
      created_by: updated.created_by,
      created_at: updated.created_at,
      finalized_at: updated.finalized_at || undefined,
    };
  }

  async compareVersions(
    sessionId: string,
    versionA: number,
    versionB: number
  ): Promise<VersionComparison> {
    const [vA, vB] = await Promise.all([
      this.storage.getStrategyVersion(sessionId, versionA),
      this.storage.getStrategyVersion(sessionId, versionB),
    ]);

    if (!vA || !vB) {
      throw new Error('One or both versions not found');
    }

    const analysisA = vA.analysis_data as StrategyAnalysis;
    const analysisB = vB.analysis_data as StrategyAnalysis;
    const decisionsA = vA.decisions_data as GeneratedDecisions;
    const decisionsB = vB.decisions_data as GeneratedDecisions;

    const approachChanged = JSON.stringify(analysisA.recommended_approaches) !== JSON.stringify(analysisB.recommended_approaches);
    const marketChanged = analysisA.recommended_market !== analysisB.recommended_market;

    const decisionsChanged: string[] = [];
    const decisionIdsA = decisionsA.decisions.map(d => d.id);
    const decisionIdsB = decisionsB.decisions.map(d => d.id);
    
    const allDecisionIds = Array.from(new Set([...decisionIdsA, ...decisionIdsB]));
    for (const decisionId of allDecisionIds) {
      const decA = decisionsA.decisions.find(d => d.id === decisionId);
      const decB = decisionsB.decisions.find(d => d.id === decisionId);
      
      if (!decA || !decB || JSON.stringify(decA) !== JSON.stringify(decB)) {
        decisionsChanged.push(decisionId);
      }
    }

    let costDelta = null;
    let timelineDelta = null;

    if (vA.selected_decisions && vB.selected_decisions) {
      const selectedA = vA.selected_decisions as Record<string, string>;
      const selectedB = vB.selected_decisions as Record<string, string>;
      
      let totalCostMinA = 0, totalCostMaxA = 0, totalTimelineA = 0;
      let totalCostMinB = 0, totalCostMaxB = 0, totalTimelineB = 0;

      for (const decision of decisionsA.decisions) {
        const selectedOptionId = selectedA[decision.id];
        const option = decision.options.find(o => o.id === selectedOptionId);
        if (option?.estimated_cost) {
          totalCostMinA += option.estimated_cost.min;
          totalCostMaxA += option.estimated_cost.max;
        }
        if (option?.estimated_timeline_months) {
          totalTimelineA = Math.max(totalTimelineA, option.estimated_timeline_months);
        }
      }

      for (const decision of decisionsB.decisions) {
        const selectedOptionId = selectedB[decision.id];
        const option = decision.options.find(o => o.id === selectedOptionId);
        if (option?.estimated_cost) {
          totalCostMinB += option.estimated_cost.min;
          totalCostMaxB += option.estimated_cost.max;
        }
        if (option?.estimated_timeline_months) {
          totalTimelineB = Math.max(totalTimelineB, option.estimated_timeline_months);
        }
      }

      costDelta = {
        min_delta: totalCostMinB - totalCostMinA,
        max_delta: totalCostMaxB - totalCostMaxA,
      };
      timelineDelta = totalTimelineB - totalTimelineA;
    }

    let recommendation = '';
    if (approachChanged || marketChanged) {
      recommendation = 'Significant strategic changes detected. Review alignment with business objectives.';
    } else if (decisionsChanged.length > 0) {
      recommendation = 'Minor decision changes. Review specific decision points that changed.';
    } else {
      recommendation = 'No significant differences between versions.';
    }

    return {
      version_a: versionA,
      version_b: versionB,
      differences: {
        approach_changed: approachChanged,
        market_changed: marketChanged,
        cost_delta: costDelta,
        timeline_delta_months: timelineDelta,
        decisions_changed: decisionsChanged,
      },
      recommendation,
    };
  }

  async listVersions(sessionId: string): Promise<StrategyVersionData[]> {
    const versions = await this.storage.getStrategyVersionsBySession(sessionId);
    
    return versions.map(v => ({
      version_number: v.version_number,
      analysis: v.analysis_data as StrategyAnalysis,
      decisions: v.decisions_data as GeneratedDecisions,
      selected_decisions: v.selected_decisions as Record<string, string> | undefined,
      program_structure: v.program_structure,
      status: v.status as 'draft' | 'in_review' | 'finalized',
      created_by: v.created_by,
      created_at: v.created_at,
      finalized_at: v.finalized_at || undefined,
    }));
  }

  async getLatestVersion(sessionId: string): Promise<StrategyVersionData | null> {
    const versions = await this.listVersions(sessionId);
    if (versions.length === 0) return null;
    
    return versions.sort((a, b) => b.version_number - a.version_number)[0];
  }

  async getFinalizedVersion(sessionId: string): Promise<StrategyVersionData | null> {
    const versions = await this.listVersions(sessionId);
    const finalized = versions.find(v => v.status === 'finalized');
    return finalized || null;
  }
}
