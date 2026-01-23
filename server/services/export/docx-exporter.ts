import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';
import { format } from 'date-fns';
// @ts-ignore - no type declarations available
import HTMLtoDOCX from 'html-docx-js';
import { BaseExporter, type FullExportPackage, type ExportResult } from './base-exporter';

export class DocxExporter extends BaseExporter {
  readonly name = 'DOCX Exporter';
  readonly format = 'docx';
  readonly mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  async export(pkg: FullExportPackage): Promise<ExportResult> {
    try {
      const docx = await generateDocxReport(pkg);
      return {
        filename: 'report.docx',
        content: docx,
        mimeType: this.mimeType,
        success: true,
      };
    } catch (error) {
      return {
        filename: 'report.docx',
        content: Buffer.from(''),
        mimeType: this.mimeType,
        success: false,
        error: error instanceof Error ? error.message : 'DOCX generation failed',
      };
    }
  }
}

export async function generateDocxFromHtml(html: string): Promise<Buffer> {
  const docxBlob = HTMLtoDOCX.asBlob(html, {
    orientation: 'portrait',
    margins: {
      top: 720,
      right: 720,
      bottom: 720,
      left: 720,
    },
  });
  
  const arrayBuffer = await docxBlob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateDocxReport(pkg: FullExportPackage): Promise<Buffer> {
  const sections: (Paragraph | Table)[] = [];

  const parseField = (field: any) => {
    if (!field) return null;
    if (typeof field === 'object') return field;
    try {
      return JSON.parse(field);
    } catch (err) {
      console.warn('[DOCX Export] Failed to parse JSONB field:', err);
      return null;
    }
  };

  sections.push(
    new Paragraph({
      text: 'Premisia Strategic Analysis & EPM Program Report',
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Generated: ', bold: true }),
        new TextRun(format(new Date(pkg.metadata.exportedAt), 'PPpp')),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Session ID: ', bold: true }),
        new TextRun(pkg.metadata.sessionId),
      ],
    })
  );

  if (pkg.metadata.versionNumber) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Version: ', bold: true }),
          new TextRun(pkg.metadata.versionNumber.toString()),
        ],
      })
    );
  }

  sections.push(new Paragraph({ text: '' }));

  if (pkg.strategy.understanding) {
    const u = pkg.strategy.understanding;
    sections.push(
      new Paragraph({
        text: 'Strategic Understanding',
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Title: ', bold: true }),
          new TextRun(u.title || 'Untitled Initiative'),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Initiative Type: ', bold: true }),
          new TextRun(u.initiativeType || 'Not classified'),
        ],
      })
    );

    if (u.classificationConfidence) {
      const conf = parseFloat(u.classificationConfidence as any);
      if (!isNaN(conf)) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Classification Confidence: ', bold: true }),
              new TextRun(`${(conf * 100).toFixed(0)}%`),
            ],
          })
        );
      }
    }

    if (u.initiativeDescription) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: 'Description', bold: true })],
        }),
        new Paragraph({ text: u.initiativeDescription })
      );
    }

    if (u.userInput) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: 'Original User Input', bold: true })],
        }),
        new Paragraph({ text: u.userInput })
      );
    }

    sections.push(new Paragraph({ text: '' }));
  }

  if (pkg.strategy.journeySession) {
    const j = pkg.strategy.journeySession;
    sections.push(
      new Paragraph({
        text: 'Strategic Journey',
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Journey Type: ', bold: true }),
          new TextRun(j.journeyType || 'Custom'),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Status: ', bold: true }),
          new TextRun(j.status),
        ],
      })
    );

    if (j.completedFrameworks && j.completedFrameworks.length > 0) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: 'Completed Frameworks', bold: true })],
        })
      );
      j.completedFrameworks.forEach((fw: string) => {
        sections.push(
          new Paragraph({
            text: `• ${fw}`,
            bullet: { level: 0 },
          })
        );
      });
    }

    sections.push(new Paragraph({ text: '' }));
  }

  if (pkg.strategy.strategyVersion) {
    const sv = pkg.strategy.strategyVersion;
    sections.push(
      new Paragraph({
        text: 'Strategic Decisions',
        heading: HeadingLevel.HEADING_2,
      })
    );

    if (sv.versionLabel) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Version: ', bold: true }),
            new TextRun(sv.versionLabel),
          ],
        })
      );
    }

    if (sv.inputSummary) {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: 'Summary', bold: true })],
        }),
        new Paragraph({ text: sv.inputSummary })
      );
    }

    if (pkg.strategy.decisions && pkg.strategy.decisions.length > 0) {
      sections.push(
        new Paragraph({
          text: 'Selected Decisions',
          heading: HeadingLevel.HEADING_3,
        })
      );
      pkg.strategy.decisions.forEach((decision: any, idx: number) => {
        const decType = decision.type || decision.category || 'Decision';
        const decValue = decision.value || decision.description || decision.choice || 'Not specified';
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${idx + 1}. ${decType}: `, bold: true }),
              new TextRun(decValue),
            ],
          })
        );
        if (decision.rationale) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({ text: `   Rationale: ${decision.rationale}`, italics: true }),
              ],
            })
          );
        }
      });
    }

    sections.push(new Paragraph({ text: '' }));
  }

  if (pkg.epm?.program) {
    const program = pkg.epm.program;
    const execSummary = parseField(program.executiveSummary);
    const workstreams = parseField(program.workstreams);
    const timeline = parseField(program.timeline);
    const resourcePlan = parseField(program.resourcePlan);
    const financialPlan = parseField(program.financialPlan);
    const benefits = parseField(program.benefitsRealization);
    const risks = parseField(program.riskRegister);
    const stageGates = parseField(program.stageGates);
    const kpis = parseField(program.kpis);
    const stakeholders = parseField(program.stakeholderMap);
    const governance = parseField(program.governance);
    const qaPlan = parseField(program.qaPlan);
    const procurement = parseField(program.procurement);
    const exitStrategy = parseField(program.exitStrategy);

    sections.push(
      new Paragraph({
        text: 'Enterprise Program Management (EPM) Program',
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Framework: ', bold: true }),
          new TextRun(program.frameworkType || 'Not specified'),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Status: ', bold: true }),
          new TextRun(program.status),
        ],
      })
    );

    const confidenceValue = program.overallConfidence ? parseFloat(program.overallConfidence as any) : null;
    const confidenceText = (confidenceValue !== null && !isNaN(confidenceValue)) 
      ? `${(confidenceValue * 100).toFixed(1)}%`
      : 'Not calculated';
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Overall Confidence: ', bold: true }),
          new TextRun(confidenceText),
        ],
      }),
      new Paragraph({ text: '' })
    );

    if (execSummary) {
      sections.push(
        new Paragraph({
          text: '1. Executive Summary',
          heading: HeadingLevel.HEADING_2,
        })
      );

      if (execSummary.title) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Program Title: ', bold: true }),
              new TextRun(execSummary.title),
            ],
          })
        );
      }

      if (execSummary.overview || execSummary.summary) {
        sections.push(
          new Paragraph({ text: execSummary.overview || execSummary.summary })
        );
      }

      if (execSummary.objectives && execSummary.objectives.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Strategic Objectives', bold: true })],
          })
        );
        execSummary.objectives.forEach((obj: string, idx: number) => {
          sections.push(
            new Paragraph({
              text: `${idx + 1}. ${obj}`,
            })
          );
        });
      }

      sections.push(new Paragraph({ text: '' }));
    }

    if (workstreams && workstreams.length > 0) {
      sections.push(
        new Paragraph({
          text: '2. Workstreams',
          heading: HeadingLevel.HEADING_2,
        })
      );

      workstreams.forEach((ws: any, idx: number) => {
        sections.push(
          new Paragraph({
            text: `${idx + 1}. ${ws.name || `Workstream ${idx + 1}`}`,
            heading: HeadingLevel.HEADING_3,
          })
        );

        if (ws.description) {
          sections.push(new Paragraph({ text: ws.description }));
        }

        if (ws.owner) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Owner: ', bold: true }),
                new TextRun(ws.owner),
              ],
            })
          );
        }

        if (ws.startMonth !== undefined && ws.endMonth !== undefined) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Duration: ', bold: true }),
                new TextRun(`Month ${ws.startMonth} to Month ${ws.endMonth}`),
              ],
            })
          );
        }

        sections.push(new Paragraph({ text: '' }));
      });
    }

    if (timeline) {
      sections.push(
        new Paragraph({
          text: '3. Timeline & Critical Path',
          heading: HeadingLevel.HEADING_2,
        })
      );

      if (timeline.totalDuration) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Total Program Duration: ', bold: true }),
              new TextRun(`${timeline.totalDuration} months`),
            ],
          })
        );
      }

      if (timeline.phases && timeline.phases.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Program Phases', bold: true })],
          })
        );
        timeline.phases.forEach((phase: any) => {
          sections.push(
            new Paragraph({
              text: `• ${phase.name}: Month ${phase.startMonth} to Month ${phase.endMonth}`,
              bullet: { level: 0 },
            })
          );
        });
      }

      sections.push(new Paragraph({ text: '' }));
    }

    if (resourcePlan) {
      sections.push(
        new Paragraph({
          text: '4. Resource Plan',
          heading: HeadingLevel.HEADING_2,
        })
      );

      if (resourcePlan.internalTeam && resourcePlan.internalTeam.length > 0) {
        sections.push(
          new Paragraph({
            text: 'Internal Team',
            heading: HeadingLevel.HEADING_3,
          })
        );

        const internalTeamRows: TableRow[] = [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Role', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'FTE', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Responsibilities', bold: true })] })] }),
            ],
          }),
        ];

        resourcePlan.internalTeam.forEach((r: any) => {
          internalTeamRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(r.role || r.title || 'Not specified')] }),
                new TableCell({ children: [new Paragraph(String(r.fte || r.allocation || 'TBD'))] }),
                new TableCell({ children: [new Paragraph(r.responsibilities || r.description || '-')] }),
              ],
            })
          );
        });

        sections.push(
          new Table({
            rows: internalTeamRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
      }

      sections.push(new Paragraph({ text: '' }));
    }

    if (risks) {
      sections.push(
        new Paragraph({
          text: '7. Risk Register',
          heading: HeadingLevel.HEADING_2,
        })
      );

      const riskArray = risks.risks || risks;
      if (Array.isArray(riskArray) && riskArray.length > 0) {
        const riskRows = [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Risk', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Probability', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Impact', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Mitigation', bold: true })] })] }),
            ],
          }),
        ];

        riskArray.forEach((r: any) => {
          const name = r.risk || r.name || r.description || 'Unnamed risk';
          const prob = r.probability || r.likelihood || '-';
          const impact = r.impact || r.severity || '-';
          const mit = r.mitigation || r.response || '-';

          riskRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: name })] }),
                new TableCell({ children: [new Paragraph({ text: prob })] }),
                new TableCell({ children: [new Paragraph({ text: impact })] }),
                new TableCell({ children: [new Paragraph({ text: mit })] }),
              ],
            })
          );
        });

        sections.push(
          new Table({
            rows: riskRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
      }

      sections.push(new Paragraph({ text: '' }));
    }

    if (kpis) {
      sections.push(
        new Paragraph({
          text: '9. Key Performance Indicators (KPIs)',
          heading: HeadingLevel.HEADING_2,
        })
      );

      const kpiArray = kpis.kpis || kpis.metrics || kpis;
      if (Array.isArray(kpiArray) && kpiArray.length > 0) {
        const kpiRows = [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'KPI', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Target', bold: true })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Measurement Frequency', bold: true })] })] }),
            ],
          }),
        ];

        kpiArray.forEach((kpi: any) => {
          const name = kpi.name || kpi.metric || kpi.kpi || 'KPI';
          const target = kpi.target || kpi.goal || '-';
          const freq = kpi.frequency || kpi.measurementFrequency || 'Monthly';

          kpiRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ text: name })] }),
                new TableCell({ children: [new Paragraph({ text: target })] }),
                new TableCell({ children: [new Paragraph({ text: freq })] }),
              ],
            })
          );
        });

        sections.push(
          new Table({
            rows: kpiRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
      }

      sections.push(new Paragraph({ text: '' }));
    }
  }

  if (pkg.epm?.assignments && pkg.epm.assignments.length > 0) {
    sections.push(
      new Paragraph({
        text: 'Task Assignments Overview',
        heading: HeadingLevel.HEADING_2,
      })
    );

    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Total Assignments: ', bold: true }),
          new TextRun(pkg.epm.assignments.length.toString()),
        ],
      })
    );

    const resourceCounts = pkg.epm.assignments.reduce((acc: any, a: any) => {
      acc[a.resourceName] = (acc[a.resourceName] || 0) + 1;
      return acc;
    }, {});

    sections.push(
      new Paragraph({
        children: [new TextRun({ text: 'Assignments by Resource', bold: true })],
      })
    );

    Object.entries(resourceCounts).forEach(([name, count]) => {
      sections.push(
        new Paragraph({
          text: `• ${name}: ${count} task(s)`,
          bullet: { level: 0 },
        })
      );
    });

    sections.push(new Paragraph({ text: '' }));
  }

  sections.push(
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Report generated by Premisia Intelligent Strategic EPM',
          italics: true,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Export Date: ${format(new Date(pkg.metadata.exportedAt), 'PPPPpp')}`,
          italics: true,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children: sections,
    }],
  });

  return await Packer.toBuffer(doc);
}
