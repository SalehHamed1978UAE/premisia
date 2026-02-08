import { describe, expect, it } from 'vitest';
import { generateMarkdownReport } from '../server/services/export/markdown-exporter';
import { generateUiStyledHtml } from '../server/services/export/html-exporter';

function buildPackage() {
  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      sessionId: 's1',
      versionNumber: 1,
      exportedBy: 'tester',
    },
    strategy: {
      understanding: {
        title: 'Test Initiative',
        initiativeType: 'service_launch',
        classificationConfidence: '0.9',
        userInput: 'Test input',
      },
      journeySession: {
        journeyType: 'business_model_innovation',
        status: 'completed',
      },
      fiveWhysTree: {
        rootQuestion: 'Root why?',
        maxDepth: 4,
        branches: [
          { option: 'CANON_STEP_1', question: 'Q1', branches: [] },
          { option: 'DRIFT_STEP_1', question: 'QX', branches: [] },
        ],
      },
      whysPath: ['CANON_STEP_1', 'CANON_STEP_2', 'CANON_STEP_3', 'CANON_STEP_4'],
      strategyVersion: {
        analysisData: {
          five_whys: {
            whysPath: ['DRIFT_STEP_1', 'DRIFT_STEP_2', 'DRIFT_STEP_3', 'DRIFT_STEP_4'],
            root_cause: 'Root cause',
            strategic_implications: ['Implication 1'],
          },
        },
      },
    },
    epm: undefined,
  };
}

describe('Export report whys-path consistency', () => {
  it('uses one canonical path for markdown tree markers and summary', () => {
    const pkg = buildPackage() as any;
    const markdown = generateMarkdownReport(pkg);

    expect(markdown).toContain('**CANON_STEP_1** ✓ (Chosen path)');
    expect(markdown).not.toContain('**DRIFT_STEP_1** ✓ (Chosen path)');

    const summary = markdown.split('## Five Whys - Chosen Path Summary')[1] || '';
    expect(summary).toContain('**Answer:** CANON_STEP_1');
    expect(summary).not.toContain('**Answer:** DRIFT_STEP_1');
  });

  it('uses canonical path for html chosen-path summary', () => {
    const pkg = buildPackage() as any;
    const html = generateUiStyledHtml(pkg);

    expect(html).toContain('<strong>Answer:</strong> CANON_STEP_1');
    expect(html).not.toContain('<strong>Answer:</strong> DRIFT_STEP_1');
  });

  it('does not duplicate stage gate numbering in markdown headings', () => {
    const pkg = buildPackage() as any;
    pkg.epm = {
      program: {
        status: 'finalized',
        frameworkType: 'bmc',
        overallConfidence: '0.8',
        stageGates: {
          gates: [
            { gate: 1, name: 'Gate 1: Planning & Foundation Complete', deliverables: ['WS001'] },
          ],
        },
      },
      assignments: [],
    };

    const markdown = generateMarkdownReport(pkg);
    expect(markdown).toContain('### Gate 1: Planning & Foundation Complete');
    expect(markdown).not.toContain('### Gate 1: Gate 1: Planning & Foundation Complete');
  });
});
