import { BaseValidator, ValidatorContext, ValidatorIssue, ValidatorResult } from './base-validator';

const TRAILING_FRAGMENT_RE = /\b(to|from|by|for|with|and|or|the|a|an|of)$/i;
const GENERIC_TARGET_RE = /(complete within \d+\s*(months?|weeks?)|defined strategic milestone achieved within \d+\s*months?|production go-live by month \d+|go-live by month \d+|launch by month \d+)/i;
const GENERIC_MEASUREMENT_RE = /(strategic kpi tracking|current baseline|quarterly tracking)/i;

export class KPIQualityValidator extends BaseValidator {
  readonly name = 'KPIQualityValidator';
  readonly description = 'Validates KPI naming and target specificity for publish-quality outputs';

  validate(context: ValidatorContext): ValidatorResult {
    const issues: ValidatorIssue[] = [];
    const kpis = context.kpis || [];

    if (!Array.isArray(kpis) || kpis.length === 0) {
      return this.createResult(true, [], [], {
        skipped: true,
        reason: 'No KPIs provided in validator context',
      });
    }

    kpis.forEach((kpi, idx) => {
      const name = `${kpi?.name || ''}`.trim();
      const target = `${kpi?.target || ''}`.trim();
      const measurement = `${kpi?.measurement || ''}`.trim();
      const kpiId = `${kpi?.id || idx + 1}`;

      if (!name || name.length < 10 || TRAILING_FRAGMENT_RE.test(name)) {
        issues.push(
          this.createIssue(
            'error',
            'KPI_TRUNCATED_OR_WEAK_NAME',
            `KPI "${kpiId}" has a truncated/weak name: "${name}"`,
            {
              field: 'kpis.name',
              suggestion: 'Use a clear outcome-oriented KPI title with at least 3 words and no trailing fragments',
            }
          )
        );
      }

      if (!target || GENERIC_TARGET_RE.test(target)) {
        issues.push(
          this.createIssue(
            'error',
            'KPI_GENERIC_TARGET',
            `KPI "${kpiId}" has a generic target: "${target}"`,
            {
              field: 'kpis.target',
              suggestion: 'Use measurable targets tied to business outcomes, not generic go-live/month completion text',
            }
          )
        );
      }

      if (!measurement || GENERIC_MEASUREMENT_RE.test(measurement)) {
        issues.push(
          this.createIssue(
            'warning',
            'KPI_GENERIC_MEASUREMENT',
            `KPI "${kpiId}" uses a generic measurement definition`,
            {
              field: 'kpis.measurement',
              suggestion: 'Define exact measurement logic (formula, source system, and cadence)',
            }
          )
        );
      }
    });

    const passed = issues.every((issue) => issue.severity !== 'error');
    return this.createResult(passed, issues, [], {
      checkedKpis: kpis.length,
    });
  }
}
