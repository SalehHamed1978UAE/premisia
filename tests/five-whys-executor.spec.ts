import { describe, expect, it, vi } from 'vitest';
import { FiveWhysExecutor } from '../server/journey/executors/five-whys-executor';

describe('FiveWhysExecutor canonical path behavior', () => {
  it('selects the strongest/deepest branch instead of always taking first branch', async () => {
    const tree = {
      rootQuestion: 'Why are outcomes weak?',
      maxDepth: 5,
      sessionId: 's1',
      branches: [
        {
          id: 'A1',
          question: 'Why level 1?',
          option: 'Shallow branch start',
          depth: 1,
          isLeaf: false,
          supporting_evidence: [],
          counter_arguments: [],
          consideration: '',
          branches: [
            {
              id: 'A2',
              question: 'Why level 2?',
              option: 'Shallow root cause',
              depth: 2,
              isLeaf: true,
              supporting_evidence: [],
              counter_arguments: [],
              consideration: '',
              branches: [],
            },
          ],
        },
        {
          id: 'B1',
          question: 'Why level 1?',
          option: 'Deep branch step 1',
          depth: 1,
          isLeaf: false,
          isVerified: true,
          supporting_evidence: ['audit-1', 'audit-2'],
          counter_arguments: [],
          consideration: '',
          branches: [
            {
              id: 'B2',
              question: 'Why level 2?',
              option: 'Deep branch step 2',
              depth: 2,
              isLeaf: false,
              supporting_evidence: ['audit-3'],
              counter_arguments: [],
              consideration: '',
              branches: [
                {
                  id: 'B3',
                  question: 'Why level 3?',
                  option: 'Deep branch step 3',
                  depth: 3,
                  isLeaf: false,
                  supporting_evidence: [],
                  counter_arguments: [],
                  consideration: '',
                  branches: [
                    {
                      id: 'B4',
                      question: 'Why level 4?',
                      option: 'Deep canonical root cause',
                      depth: 4,
                      isLeaf: true,
                      supporting_evidence: [],
                      counter_arguments: [],
                      consideration: '',
                      branches: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const executor = new FiveWhysExecutor();
    (executor as any).generator = {
      generateTree: vi.fn().mockResolvedValue(tree),
    };

    const context: any = {
      understandingId: 'u1',
      sessionId: 's1',
      userInput: 'Diagnose weak strategy execution',
      journeyType: 'business_model_innovation',
      currentFrameworkIndex: 0,
      completedFrameworks: [],
      insights: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'in_progress',
    };

    const result = await executor.execute(context);
    expect(result.whysPath).toEqual([
      'Deep branch step 1',
      'Deep branch step 2',
      'Deep branch step 3',
      'Deep canonical root cause',
    ]);
    expect(result.rootCauses[0]).toBe('Deep canonical root cause');
  });

  it('prefers already-selected path from context insights when available', async () => {
    const executor = new FiveWhysExecutor();
    (executor as any).generator = {
      generateTree: vi.fn().mockResolvedValue({
        rootQuestion: 'Why?',
        maxDepth: 5,
        sessionId: 's2',
        branches: [
          {
            id: 'B1',
            question: 'Why level 1?',
            option: 'Tree path step',
            depth: 1,
            isLeaf: false,
            supporting_evidence: [],
            counter_arguments: [],
            consideration: '',
            branches: [],
          },
        ],
      }),
    };

    const selected = ['Chosen step 1', 'Chosen step 2', 'Chosen step 3', 'Chosen step 4'];
    const context: any = {
      understandingId: 'u2',
      sessionId: 's2',
      userInput: 'Diagnose issue',
      journeyType: 'business_model_innovation',
      currentFrameworkIndex: 0,
      completedFrameworks: [],
      insights: {
        whysPath: selected,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'in_progress',
    };

    const result = await executor.execute(context);
    expect(result.whysPath).toEqual(selected);
    expect(result.rootCauses[0]).toBe('Chosen step 4');
  });
});

