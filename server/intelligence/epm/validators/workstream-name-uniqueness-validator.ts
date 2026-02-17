import { BaseValidator, ValidatorContext, ValidatorIssue, ValidatorResult } from './base-validator';

export class WorkstreamNameUniquenessValidator extends BaseValidator {
  readonly name = 'WorkstreamNameUniquenessValidator';
  readonly description = 'Ensures workstream names are unique within an EPM program';

  validate(context: ValidatorContext): ValidatorResult {
    const issues: ValidatorIssue[] = [];
    const byName = new Map<string, string[]>();
    const displayByName = new Map<string, string>();

    for (const ws of context.workstreams || []) {
      const name = `${ws.name || ''}`.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const ids = byName.get(key) || [];
      ids.push(ws.id || 'unknown');
      byName.set(key, ids);
      if (!displayByName.has(key)) {
        displayByName.set(key, name);
      }
    }

    for (const [normalizedName, ids] of byName.entries()) {
      if (ids.length < 2) continue;
      const displayName = displayByName.get(normalizedName) || normalizedName;
      issues.push(
        this.createIssue(
          'error',
          'DUPLICATE_WORKSTREAM_NAME',
          `Workstream name appears multiple times: "${displayName}" (${ids.join(', ')})`,
          {
            field: 'workstreams.name',
            suggestion: 'Rename duplicate workstreams to uniquely reflect their deliverables and phase',
          }
        )
      );
    }

    const passed = issues.every((issue) => issue.severity !== 'error');
    return this.createResult(passed, issues, [], {
      checkedWorkstreams: context.workstreams?.length || 0,
      duplicateNames: issues.length,
    });
  }
}
