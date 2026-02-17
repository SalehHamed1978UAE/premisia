import { BaseValidator, ValidatorContext, ValidatorIssue, ValidatorResult } from './base-validator';
import {
  analyzeWorkstreamDeclaredTheme,
  analyzeWorkstreamDeliverableTheme,
  getCanonicalWorkstreamName,
  isSemanticRepairCandidate,
} from '../workstream-theme';

export class WorkstreamSemanticAlignmentValidator extends BaseValidator {
  readonly name = 'WorkstreamSemanticAlignmentValidator';
  readonly description = 'Checks that each workstream name/description aligns with its deliverable theme';

  private readonly minDominantScore = 2;
  private readonly minThemeDelta = 2;

  validate(context: ValidatorContext): ValidatorResult {
    const issues: ValidatorIssue[] = [];

    for (const ws of context.workstreams || []) {
      if (!isSemanticRepairCandidate(ws)) continue;
      if (!Array.isArray(ws.deliverables) || ws.deliverables.length === 0) continue;

      const declared = analyzeWorkstreamDeclaredTheme(ws);
      const dominant = analyzeWorkstreamDeliverableTheme(ws);
      if (dominant.theme === 'general' || dominant.score < this.minDominantScore) continue;

      if (declared.theme === dominant.theme) continue;
      if (dominant.score < declared.score + this.minThemeDelta) continue;

      const canonical = getCanonicalWorkstreamName(dominant.theme);
      issues.push(
        this.createIssue(
          'error',
          'WORKSTREAM_DELIVERABLE_MISMATCH',
          `Workstream "${ws.name}" appears misaligned: deliverables are dominantly ${dominant.theme}-oriented`,
          {
            workstreamId: ws.id,
            field: 'workstreams.name',
            suggestion: canonical
              ? `Rename/remap this workstream to align with "${canonical}" deliverables`
              : 'Rename/remap this workstream to match dominant deliverable theme',
          }
        )
      );
    }

    const passed = issues.every((issue) => issue.severity !== 'error');
    return this.createResult(passed, issues, [], {
      checkedWorkstreams: context.workstreams?.length || 0,
      minDominantScore: this.minDominantScore,
      minThemeDelta: this.minThemeDelta,
    });
  }
}
