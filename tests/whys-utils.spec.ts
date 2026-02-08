import { describe, expect, it } from 'vitest';
import { normalizeWhysPathForReport, pickCanonicalWhysPath } from '../server/services/export/whys-utils';

describe('whys-utils canonical path selection', () => {
  it('prefers canonical question+answer format over flattened string paths', () => {
    const legacy = [
      'Answer one',
      'Answer two',
      'Answer three',
      'Answer four',
    ];
    const canonical = [
      { question: 'Why does onboarding fail?', answer: 'Users face high data-entry friction', depth: 0 },
      { question: 'Why is friction high?', answer: 'Mandatory fields appear before value preview', depth: 1 },
      { question: 'Why is preview delayed?', answer: 'Compliance copy is front-loaded in the flow', depth: 2 },
      { question: 'Why is copy front-loaded?', answer: 'The flow is optimized for review throughput', depth: 3 },
    ];

    const selected = pickCanonicalWhysPath([legacy, canonical]);

    expect(typeof selected[0]).toBe('object');
    expect(selected[0]).toMatchObject({
      question: 'Why does onboarding fail?',
      answer: 'Users face high data-entry friction',
    });
  });

  it('keeps canonical question text in report normalization', () => {
    const canonical = [
      { question: 'Why does churn spike in week one?', answer: 'Users do not understand immediate value', depth: 0 },
      { question: 'Why is value unclear?', answer: 'The first-run experience hides outcome examples', depth: 1 },
    ];

    const normalized = normalizeWhysPathForReport(canonical);

    expect(normalized[0].question).toBe('Why does churn spike in week one?');
    expect(normalized[0].answer).toBe('Users do not understand immediate value');
    expect(normalized[1].question).toBe('Why is value unclear?');
  });
});
