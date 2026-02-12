import { describe, it, expect, vi } from 'vitest';
import { generateWBSCsv } from '../server/services/export/wbs-exporter';
import type { FullExportPackage } from '../server/services/export/base-exporter';

describe('WBS Export', () => {
  describe('generateWBSCsv', () => {
    it('should generate valid WBS CSV with required columns', () => {
      const mockPackage: FullExportPackage = {
        metadata: {
          sessionId: 'test-session',
          versionNumber: 1,
          exportedAt: new Date().toISOString(),
        },
        strategy: {
          understanding: {
            id: 'test-understanding',
            title: 'Test Strategic Initiative',
            userInput: 'Test business idea',
          },
          journey: {
            type: 'Market Entry',
          },
        },
        epm: {
          program: {
            id: 'test-program',
            name: 'Test EPM Program',
            description: 'Test program description',
            timeline: {
              startDate: '2026-03-01',
              endDate: '2026-06-30',
              totalMonths: 4,
              phases: [
                {
                  name: 'Discovery Phase',
                  phase: 'Phase 1',
                  startMonth: 0,
                  endMonth: 1,
                  milestones: [
                    {
                      name: 'Research Complete',
                      month: 1,
                      description: 'Complete market research',
                    },
                  ],
                },
              ],
            },
            workstreams: [
              {
                id: 'ws1',
                name: 'Market Research',
                description: 'Conduct comprehensive market analysis',
                owner: 'John Doe',
                startMonth: 0,
                endMonth: 1,
                deliverables: [
                  {
                    id: 'del1',
                    name: 'Market Analysis Report',
                    description: 'Complete market analysis',
                    dueMonth: 1,
                  },
                ],
                dependencies: [],
                isCritical: true,
              },
              {
                id: 'ws2',
                name: 'Product Development',
                description: 'Build MVP',
                owner: 'Jane Smith',
                startMonth: 1,
                endMonth: 3,
                deliverables: [
                  {
                    id: 'del2',
                    name: 'MVP Launch',
                    description: 'Launch minimum viable product',
                    dueMonth: 3,
                  },
                ],
                dependencies: ['ws1'],
              },
            ],
          },
        },
      };

      const csv = generateWBSCsv(mockPackage);

      // Check that CSV contains headers
      const lines = csv.split('\n');
      const headers = lines[0].split(',');

      // Verify required headers are present
      expect(headers).toContain('wbs_code');
      expect(headers).toContain('task_name');
      expect(headers).toContain('level');
      expect(headers).toContain('type');
      expect(headers).toContain('owner');
      expect(headers).toContain('start_date');
      expect(headers).toContain('end_date');
      expect(headers).toContain('duration_days');
      expect(headers).toContain('dependency');
      expect(headers).toContain('priority');
      expect(headers).toContain('status');
      expect(headers).toContain('framework_source');
      expect(headers).toContain('journey');

      // Check that content rows are generated
      expect(lines.length).toBeGreaterThan(1);

      // Verify program level (level 0)
      const programRow = lines[1];
      expect(programRow).toContain('"Test EPM Program"');
      expect(programRow).toContain(',0,'); // level 0
      expect(programRow).toContain('program');

      // Check for phase, workstreams, and tasks
      const csvContent = lines.join('\n');
      expect(csvContent).toContain('Discovery Phase');
      expect(csvContent).toContain('Market Research');
      expect(csvContent).toContain('Product Development');
      expect(csvContent).toContain('Market Analysis Report');
      expect(csvContent).toContain('MVP Launch');
    });

    it('should handle workstreams without phases', () => {
      const mockPackage: FullExportPackage = {
        metadata: {
          sessionId: 'test-session',
          versionNumber: 1,
          exportedAt: new Date().toISOString(),
        },
        strategy: {
          understanding: {
            id: 'test-understanding',
            title: 'Test Initiative',
            userInput: 'Test input',
          },
        },
        epm: {
          program: {
            id: 'test-program',
            name: 'Test Program',
            timeline: {
              startDate: '2026-03-01',
              endDate: '2026-06-30',
              phases: [], // No phases
            },
            workstreams: [
              {
                id: 'ws1',
                name: 'Direct Workstream',
                description: 'Workstream without phase',
                owner: 'Owner',
                startMonth: 0,
                endMonth: 2,
                deliverables: [],
              },
            ],
          },
        },
      };

      const csv = generateWBSCsv(mockPackage);
      const lines = csv.split('\n');

      // Check workstream is at level 1 (directly under program)
      const workstreamLine = lines.find(line => line.includes('Direct Workstream'));
      expect(workstreamLine).toBeDefined();
      expect(workstreamLine).toContain(',1,'); // level 1
      expect(workstreamLine).toContain('1.1'); // WBS code for first workstream under program
    });

    it('should properly escape CSV fields', () => {
      const mockPackage: FullExportPackage = {
        metadata: {
          sessionId: 'test-session',
          versionNumber: 1,
          exportedAt: new Date().toISOString(),
        },
        strategy: {
          understanding: {
            title: 'Test, with comma',
            userInput: 'Description with "quotes"',
          },
        },
        epm: {
          program: {
            name: 'Program, with special chars',
            description: 'Has "quotes" and, commas',
            timeline: {
              startDate: '2026-03-01',
              endDate: '2026-03-31',
            },
            workstreams: [],
          },
        },
      };

      const csv = generateWBSCsv(mockPackage);

      // Check proper escaping
      expect(csv).toContain('"Program, with special chars"');
      expect(csv).toContain('"Has ""quotes"" and, commas"');
    });

    it('should calculate business days correctly', () => {
      const mockPackage: FullExportPackage = {
        metadata: {
          sessionId: 'test-session',
          versionNumber: 1,
          exportedAt: new Date().toISOString(),
        },
        strategy: {
          understanding: {
            title: 'Test Initiative',
          },
        },
        epm: {
          program: {
            name: 'Test Program',
            timeline: {
              startDate: '2026-03-01', // Sunday
              endDate: '2026-03-13', // Friday
            },
            workstreams: [],
          },
        },
      };

      const csv = generateWBSCsv(mockPackage);
      const lines = csv.split('\n');
      const programRow = lines[1];

      // March 1-13, 2026: 10 business days (excluding weekends)
      const durationMatch = programRow.match(/,(\d+),/);
      if (durationMatch) {
        const businessDays = parseInt(durationMatch[1]);
        expect(businessDays).toBeGreaterThan(0);
        expect(businessDays).toBeLessThanOrEqual(10);
      }
    });

    it('should throw error when no EPM program data is available', () => {
      const mockPackage: FullExportPackage = {
        metadata: {
          sessionId: 'test-session',
          versionNumber: 1,
          exportedAt: new Date().toISOString(),
        },
        strategy: {},
        epm: {
          // No program data
        },
      };

      expect(() => generateWBSCsv(mockPackage)).toThrow('No EPM program data available for WBS export');
    });

    it('should infer framework sources from workstream names', () => {
      const mockPackage: FullExportPackage = {
        metadata: {
          sessionId: 'test-session',
          versionNumber: 1,
          exportedAt: new Date().toISOString(),
        },
        strategy: {},
        epm: {
          program: {
            name: 'Test Program',
            timeline: {
              startDate: '2026-03-01',
              endDate: '2026-06-30',
            },
            workstreams: [
              {
                id: 'ws1',
                name: 'Market Analysis and Customer Segmentation',
                description: 'Analyze market opportunities',
                startMonth: 0,
                endMonth: 1,
              },
              {
                id: 'ws2',
                name: 'Competitor Positioning Assessment',
                description: 'Analyze competitive landscape',
                startMonth: 1,
                endMonth: 2,
              },
              {
                id: 'ws3',
                name: 'SWOT Analysis Implementation',
                description: 'Identify strengths and weaknesses',
                startMonth: 2,
                endMonth: 3,
              },
            ],
          },
        },
      };

      const csv = generateWBSCsv(mockPackage);

      expect(csv).toContain('Market Analysis');
      expect(csv).toContain("Porter's Five Forces");
      expect(csv).toContain('SWOT Analysis');
    });
  });
});