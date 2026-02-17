import { BaseValidator, ValidatorContext, ValidatorIssue, ValidatorResult } from './base-validator';
import { detectDomainProfile } from '../domain-profile';

const CRITICAL_FORBIDDEN_TERMS = new Set([
  'food safety',
  'pos systems',
  'haccp',
  'technology / saas',
  'saas',
  'api integration',
  'site reliability engineering',
  'platform reliability',
]);

function includesTerm(text: string, term: string): boolean {
  return text.toLowerCase().includes(term.toLowerCase());
}

export class DomainLexiconValidator extends BaseValidator {
  readonly name = 'DomainLexiconValidator';
  readonly description = 'Detects cross-domain terminology leakage in workstreams and resource skills';

  validate(context: ValidatorContext): ValidatorResult {
    const issues: ValidatorIssue[] = [];
    const sourceText = [
      context.businessContext || '',
      ...context.workstreams.map((w) => `${w.name} ${w.description}`),
    ].join(' ');

    const profile = context.domainProfile || detectDomainProfile({
      sourceText,
      industryHint: context.businessContext,
    });

    const forbidden = profile.forbiddenLexicon || [];
    if (forbidden.length === 0) {
      return this.createResult(true, [], [], {
        skipped: true,
        reason: 'No forbidden lexicon for detected domain',
        domain: profile.code,
      });
    }

    for (const ws of context.workstreams) {
      const blob = `${ws.name} ${ws.description} ${ws.deliverables.map((d) => d.name).join(' ')}`;
      for (const term of forbidden) {
        if (!includesTerm(blob, term)) continue;

        const severity: ValidatorIssue['severity'] = CRITICAL_FORBIDDEN_TERMS.has(term.toLowerCase())
          ? 'error'
          : 'warning';

        issues.push(
          this.createIssue(
            severity,
            'DOMAIN_LEXICON_LEAK',
            `Workstream "${ws.name}" contains forbidden domain term "${term}" for ${profile.industryLabel}`,
            {
              workstreamId: ws.id,
              field: 'workstreams.description',
              suggestion: `Replace "${term}" with terminology aligned to ${profile.industryLabel}`,
            }
          )
        );
      }
    }

    const internalTeam = context.resourcePlan?.internalTeam || [];
    for (const resource of internalTeam) {
      const skills = Array.isArray(resource.skills) ? resource.skills : [];
      const skillsBlob = skills.join(' ');

      for (const term of forbidden) {
        if (!includesTerm(skillsBlob, term)) continue;

        issues.push(
          this.createIssue(
            'error',
            'RESOURCE_DOMAIN_SKILL_LEAK',
            `Resource "${resource.role}" contains forbidden skill "${term}" for ${profile.industryLabel}`,
            {
              field: 'resourcePlan.internalTeam.skills',
              suggestion: `Replace "${term}" with domain-appropriate skills for ${profile.industryLabel}`,
            }
          )
        );
      }
    }

    const passed = issues.every((issue) => issue.severity !== 'error');
    return this.createResult(passed, issues, [], {
      domain: profile.code,
      forbiddenTermsChecked: forbidden.length,
      resourcesChecked: internalTeam.length,
      workstreamsChecked: context.workstreams.length,
    });
  }
}
