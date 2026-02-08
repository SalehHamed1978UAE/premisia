import { format } from 'date-fns';
import { BaseExporter, type FullExportPackage, type ExportResult } from './base-exporter';
import { deriveInsights } from './insights';

export class MarkdownExporter extends BaseExporter {
  readonly name = 'Markdown Exporter';
  readonly format = 'md';
  readonly mimeType = 'text/markdown';

  async export(pkg: FullExportPackage): Promise<ExportResult> {
    try {
      const markdown = generateMarkdownReport(pkg);
      return {
        filename: 'report.md',
        content: Buffer.from(markdown, 'utf-8'),
        mimeType: this.mimeType,
        success: true,
      };
    } catch (error) {
      return {
        filename: 'report.md',
        content: Buffer.from(''),
        mimeType: this.mimeType,
        success: false,
        error: error instanceof Error ? error.message : 'Markdown generation failed',
      };
    }
  }
}

export function generateFiveWhysTreeMarkdown(tree: any, whysPath?: any[]): string {
  if (!tree) return '';
  
  const lines: string[] = [];
  lines.push('## Five Whys - Complete Analysis Tree\n');
  lines.push(`**Root Question:** ${tree.rootQuestion}\n`);
  lines.push(`**Maximum Depth:** ${tree.maxDepth} levels\n`);
  
  const normalizeText = (value: any): string =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().toLowerCase() : '';

  const isNodeInPath = (nodeOption: string, nodeQuestion?: string): boolean => {
    if (!whysPath || whysPath.length === 0) return false;

    const optionNorm = normalizeText(nodeOption);
    const questionNorm = normalizeText(nodeQuestion);

    return whysPath.some((pathStep: any) => {
      if (typeof pathStep === 'string') {
        const stepNorm = normalizeText(pathStep);
        return stepNorm.length > 0 && (stepNorm === optionNorm || stepNorm === questionNorm);
      } else if (pathStep && typeof pathStep === 'object') {
        const candidateValues = [
          pathStep.answer,
          pathStep.option,
          pathStep.label,
          pathStep.why,
          pathStep.reason,
          pathStep.text,
          pathStep.question,
        ];
        return candidateValues.some((candidate) => {
          const candidateNorm = normalizeText(candidate);
          return candidateNorm.length > 0 && (candidateNorm === optionNorm || candidateNorm === questionNorm);
        });
      }
      return false;
    });
  };
  
  const renderNode = (node: any, level: number): void => {
    const indent = '  '.repeat(level);
    // Check both: reconciled tree marker (isChosen) and path matching
    const isChosen = node.isChosen || isNodeInPath(node.option, node.question);
    const chosenMarker = isChosen ? ' ✓ (Chosen path)' : '';

    lines.push(`${indent}${level + 1}. **${node.option}**${chosenMarker}`);
    
    if (node.supporting_evidence && node.supporting_evidence.length > 0) {
      lines.push(`${indent}   - **Supporting Evidence:**`);
      node.supporting_evidence.forEach((evidence: string) => {
        lines.push(`${indent}     - ${evidence}`);
      });
    }
    
    if (node.counter_arguments && node.counter_arguments.length > 0) {
      lines.push(`${indent}   - **Counter Arguments:**`);
      node.counter_arguments.forEach((counter: string) => {
        lines.push(`${indent}     - ${counter}`);
      });
    }
    
    if (node.consideration) {
      lines.push(`${indent}   - **Consideration:** ${node.consideration}`);
    }
    
    if (node.question && node.branches && node.branches.length > 0) {
      lines.push(`${indent}   - **Next Question:** ${node.question}\n`);
    }
    
    lines.push('');
  };
  
  if (tree.branches && tree.branches.length > 0) {
    lines.push('### Level 1 Options:\n');
    
    tree.branches.forEach((branch: any) => {
      renderNode(branch, 0);
      
      if (branch.branches && branch.branches.length > 0) {
        lines.push(`### Level 2 Options (from "${branch.option}"):\n`);
        branch.branches.forEach((subBranch: any) => {
          renderNode(subBranch, 1);
          
          if (subBranch.branches && subBranch.branches.length > 0) {
            lines.push(`### Level 3 Options (from "${subBranch.option}"):\n`);
            subBranch.branches.forEach((subSubBranch: any) => {
              renderNode(subSubBranch, 2);
              
              if (subSubBranch.branches && subSubBranch.branches.length > 0) {
                lines.push(`### Level 4 Options (from "${subSubBranch.option}"):\n`);
                subSubBranch.branches.forEach((level4: any) => {
                  renderNode(level4, 3);
                  
                  if (level4.branches && level4.branches.length > 0) {
                    lines.push(`### Level 5 Options (from "${level4.option}"):\n`);
                    level4.branches.forEach((level5: any) => {
                      renderNode(level5, 4);
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  }
  
  lines.push('\n---\n');
  return lines.join('\n');
}

export function generateClarificationsMarkdown(clarifications: any): string {
  if (!clarifications || !clarifications.questions || clarifications.questions.length === 0) {
    return '';
  }
  
  const lines: string[] = [];
  lines.push('## Strategic Input Clarifications\n');
  lines.push('During initial analysis, you provided the following clarifications:\n');
  
  clarifications.questions.forEach((q: any) => {
    lines.push(`**${q.question}**\n`);
    
    if (q.options && Array.isArray(q.options)) {
      q.options.forEach((option: any) => {
        const isChosen = clarifications.answers && clarifications.answers[q.id] === option.value;
        const chosenMarker = isChosen ? ' ✓ (You chose this)' : '';
        lines.push(`- **${option.label}**${chosenMarker}`);
        if (option.description) {
          lines.push(`  - ${option.description}`);
        }
      });
    }
    
    lines.push('');
  });
  
  lines.push('\n---\n');
  return lines.join('\n');
}

export function generateMarkdownReport(pkg: FullExportPackage): string {
  const lines: string[] = [];
  
  const parseField = (field: any) => {
    if (!field) return null;
    if (typeof field === 'object') return field;
    
    try {
      return JSON.parse(field);
    } catch (err) {
      console.warn('[Export] Failed to parse JSONB field:', err);
      return null;
    }
  };

  lines.push('# Premisia Strategic Analysis & EPM Program Report\n');
  lines.push(`**Generated:** ${format(new Date(pkg.metadata.exportedAt), 'PPpp')}\n`);
  lines.push(`**Session ID:** ${pkg.metadata.sessionId}`);
  if (pkg.metadata.versionNumber) {
    lines.push(`**Version:** ${pkg.metadata.versionNumber}`);
  }
  lines.push('\n---\n');

  if (pkg.strategy.understanding) {
    const u = pkg.strategy.understanding;
    lines.push('## Strategic Understanding\n');
    lines.push(`**Title:** ${u.title || 'Untitled Initiative'}\n`);
    lines.push(`**Initiative Type:** ${u.initiativeType || 'Not classified'}\n`);
    if (u.classificationConfidence) {
      lines.push(`**Classification Confidence:** ${(parseFloat(u.classificationConfidence as any) * 100).toFixed(0)}%\n`);
    }
    
    if (u.initiativeDescription) {
      lines.push(`\n**Description:**\n${u.initiativeDescription}\n`);
    }
    
    if (u.userInput) {
      lines.push(`\n**Original User Input:**\n${u.userInput}\n`);
    }
    
    lines.push('\n---\n');
  }

  if (pkg.strategy.clarifications) {
    const clarificationsMarkdown = generateClarificationsMarkdown(pkg.strategy.clarifications);
    if (clarificationsMarkdown) {
      lines.push(clarificationsMarkdown);
    }
  }

  if (pkg.strategy.journeySession) {
    const j = pkg.strategy.journeySession;
    lines.push('## Strategic Journey\n');
    lines.push(`**Journey Type:** ${j.journeyType || 'Custom'}\n`);
    lines.push(`**Status:** ${j.status}\n`);
    
    if (j.completedFrameworks && j.completedFrameworks.length > 0) {
      lines.push(`\n**Completed Frameworks:**\n`);
      j.completedFrameworks.forEach((fw: string) => lines.push(`- ${fw}`));
      lines.push('');
    }
    
    lines.push('\n---\n');
    
    const insights = deriveInsights(pkg, parseField);
    
    if (pkg.strategy.fiveWhysTree) {
      // Extract raw answers from formatted path for tree marker matching
      const rawWhysPath = insights.whysPath?.map((step: any) => {
        if (typeof step === 'string') return step;
        return step?.answer || step?.option || step?.label || '';
      }).filter((s: string) => s.length > 0);

      const treeMarkdown = generateFiveWhysTreeMarkdown(pkg.strategy.fiveWhysTree, rawWhysPath);
      if (treeMarkdown) {
        lines.push(treeMarkdown);
      }
    }
    
    if (insights.rootCauses || insights.whysPath || insights.strategicImplications) {
      lines.push('## Five Whys - Chosen Path Summary\n');
      
      if (insights.whysPath && insights.whysPath.length > 0) {
        lines.push('\n**Analysis Path (Chosen):**\n');
        insights.whysPath.forEach((step: any, idx: number) => {
          if (typeof step === 'string') {
            lines.push(`${idx + 1}. ${step}`);
          } else {
            lines.push(`${idx + 1}. **Why?** ${step.question || step.why || step}`);
            if (step.answer) {
              lines.push(`   **Answer:** ${step.answer}\n`);
            }
          }
        });
        lines.push('');
      }
      
      if (insights.rootCauses && insights.rootCauses.length > 0) {
        lines.push('\n**Identified Root Causes:**\n');
        insights.rootCauses.forEach((cause: string) => {
          lines.push(`- ${cause}`);
        });
        lines.push('');
      }
      
      if (insights.strategicImplications && insights.strategicImplications.length > 0) {
        lines.push('\n**Strategic Implications:**\n');
        insights.strategicImplications.forEach((imp: string) => {
          lines.push(`- ${imp}`);
        });
        lines.push('');
      }
      
      lines.push('---\n');
    }
    
    if (insights.bmcBlocks) {
      const bmc = insights.bmcBlocks;
      lines.push('## Business Model Canvas Analysis\n');
      
      if (bmc.customerSegments) {
        lines.push('\n### Customer Segments\n');
        if (typeof bmc.customerSegments === 'string') {
          lines.push(`${bmc.customerSegments}\n`);
        } else if (Array.isArray(bmc.customerSegments)) {
          bmc.customerSegments.forEach((seg: string) => lines.push(`- ${seg}`));
          lines.push('');
        } else if (bmc.customerSegments.segments) {
          bmc.customerSegments.segments.forEach((seg: any) => {
            lines.push(`- **${seg.name || 'Segment'}:** ${seg.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (bmc.valuePropositions) {
        lines.push('\n### Value Propositions\n');
        if (typeof bmc.valuePropositions === 'string') {
          lines.push(`${bmc.valuePropositions}\n`);
        } else if (Array.isArray(bmc.valuePropositions)) {
          bmc.valuePropositions.forEach((vp: string) => lines.push(`- ${vp}`));
          lines.push('');
        } else if (bmc.valuePropositions.propositions) {
          bmc.valuePropositions.propositions.forEach((vp: any) => {
            lines.push(`- **${vp.title || 'Value Proposition'}:** ${vp.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (bmc.channels) {
        lines.push('\n### Channels\n');
        if (typeof bmc.channels === 'string') {
          lines.push(`${bmc.channels}\n`);
        } else if (Array.isArray(bmc.channels)) {
          bmc.channels.forEach((ch: string) => lines.push(`- ${ch}`));
          lines.push('');
        } else if (bmc.channels.channels) {
          bmc.channels.channels.forEach((ch: any) => {
            lines.push(`- **${ch.name || 'Channel'}:** ${ch.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (bmc.customerRelationships) {
        lines.push('\n### Customer Relationships\n');
        if (typeof bmc.customerRelationships === 'string') {
          lines.push(`${bmc.customerRelationships}\n`);
        } else if (Array.isArray(bmc.customerRelationships)) {
          bmc.customerRelationships.forEach((rel: string) => lines.push(`- ${rel}`));
          lines.push('');
        } else if (bmc.customerRelationships.relationships) {
          bmc.customerRelationships.relationships.forEach((rel: any) => {
            lines.push(`- **${rel.type || 'Relationship'}:** ${rel.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (bmc.revenueStreams) {
        lines.push('\n### Revenue Streams\n');
        if (typeof bmc.revenueStreams === 'string') {
          lines.push(`${bmc.revenueStreams}\n`);
        } else if (Array.isArray(bmc.revenueStreams)) {
          bmc.revenueStreams.forEach((rev: string) => lines.push(`- ${rev}`));
          lines.push('');
        } else if (bmc.revenueStreams.streams) {
          bmc.revenueStreams.streams.forEach((rev: any) => {
            lines.push(`- **${rev.name || 'Revenue Stream'}:** ${rev.description || ''}`);
            if (rev.pricingModel) {
              lines.push(`  - *Pricing Model:* ${rev.pricingModel}`);
            }
          });
          lines.push('');
        }
      }
      
      if (bmc.keyResources) {
        lines.push('\n### Key Resources\n');
        if (typeof bmc.keyResources === 'string') {
          lines.push(`${bmc.keyResources}\n`);
        } else if (Array.isArray(bmc.keyResources)) {
          bmc.keyResources.forEach((res: string) => lines.push(`- ${res}`));
          lines.push('');
        } else if (bmc.keyResources.resources) {
          bmc.keyResources.resources.forEach((res: any) => {
            lines.push(`- **${res.name || 'Resource'}:** ${res.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (bmc.keyActivities) {
        lines.push('\n### Key Activities\n');
        if (typeof bmc.keyActivities === 'string') {
          lines.push(`${bmc.keyActivities}\n`);
        } else if (Array.isArray(bmc.keyActivities)) {
          bmc.keyActivities.forEach((act: string) => lines.push(`- ${act}`));
          lines.push('');
        } else if (bmc.keyActivities.activities) {
          bmc.keyActivities.activities.forEach((act: any) => {
            lines.push(`- **${act.name || 'Activity'}:** ${act.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (bmc.keyPartnerships) {
        lines.push('\n### Key Partnerships\n');
        if (typeof bmc.keyPartnerships === 'string') {
          lines.push(`${bmc.keyPartnerships}\n`);
        } else if (Array.isArray(bmc.keyPartnerships)) {
          bmc.keyPartnerships.forEach((part: string) => lines.push(`- ${part}`));
          lines.push('');
        } else if (bmc.keyPartnerships.partnerships) {
          bmc.keyPartnerships.partnerships.forEach((part: any) => {
            lines.push(`- **${part.partner || 'Partner'}:** ${part.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (bmc.costStructure) {
        lines.push('\n### Cost Structure\n');
        if (typeof bmc.costStructure === 'string') {
          lines.push(`${bmc.costStructure}\n`);
        } else if (Array.isArray(bmc.costStructure)) {
          bmc.costStructure.forEach((cost: string) => lines.push(`- ${cost}`));
          lines.push('');
        } else if (bmc.costStructure.costs) {
          bmc.costStructure.costs.forEach((cost: any) => {
            lines.push(`- **${cost.category || 'Cost'}:** ${cost.description || ''}`);
          });
          lines.push('');
        }
      }
      
      if (insights.bmcContradictions && insights.bmcContradictions.length > 0) {
        lines.push('\n### Identified Contradictions\n');
        insights.bmcContradictions.forEach((cont: any) => {
          if (typeof cont === 'string') {
            lines.push(`- ${cont}`);
          } else {
            lines.push(`- **${cont.title || 'Contradiction'}:** ${cont.description || cont.issue || ''}`);
            if (cont.recommendation) {
              lines.push(`  - *Recommendation:* ${cont.recommendation}`);
            }
          }
        });
        lines.push('');
      }
      
      if (insights.businessModelGaps && insights.businessModelGaps.length > 0) {
        lines.push('\n### Critical Gaps\n');
        insights.businessModelGaps.forEach((gap: any) => {
          if (typeof gap === 'string') {
            lines.push(`- ${gap}`);
          } else {
            lines.push(`- **${gap.area || 'Gap'}:** ${gap.description || ''}`);
            if (gap.impact) {
              lines.push(`  - *Impact:* ${gap.impact}`);
            }
          }
        });
        lines.push('');
      }
      
      lines.push('---\n');
    }
    
    if (insights.portersForces) {
      const forces = insights.portersForces;
      lines.push('## Porter\'s Five Forces Analysis\n');
      
      const renderForce = (title: string, force: any) => {
        if (!force) return;
        lines.push(`\n### ${title}\n`);
        
        if (typeof force === 'string') {
          lines.push(`${force}\n`);
        } else {
          if (force.intensity) lines.push(`**Intensity:** ${force.intensity}\n`);
          if (force.level) lines.push(`**Level:** ${force.level}\n`);
          if (force.power) lines.push(`**Power:** ${force.power}\n`);
          if (force.factors && Array.isArray(force.factors)) {
            lines.push('\n**Key Factors:**');
            force.factors.forEach((f: string) => lines.push(`- ${f}`));
            lines.push('');
          }
          if (force.barriers && Array.isArray(force.barriers)) {
            lines.push('\n**Entry Barriers:**');
            force.barriers.forEach((b: string) => lines.push(`- ${b}`));
            lines.push('');
          }
          if (force.substitutes && Array.isArray(force.substitutes)) {
            lines.push('\n**Substitutes:**');
            force.substitutes.forEach((s: string) => lines.push(`- ${s}`));
            lines.push('');
          }
        }
      };
      
      renderForce('Competitive Rivalry', forces.competitiveRivalry || forces.competitive_rivalry);
      renderForce('Threat of New Entrants', forces.threatOfNewEntrants || forces.threat_of_new_entrants);
      renderForce('Bargaining Power of Suppliers', forces.bargainingPowerOfSuppliers || forces.supplier_power);
      renderForce('Bargaining Power of Buyers', forces.bargainingPowerOfBuyers || forces.buyer_power);
      renderForce('Threat of Substitutes', forces.threatOfSubstitutes || forces.threat_of_substitutes);
      
      lines.push('---\n');
    }
    
    if (insights.trendFactors || insights.externalForces) {
      lines.push('## PESTLE Analysis\n');
      const factors = insights.trendFactors ?? insights.externalForces ?? {};
      
      ['political', 'economic', 'social', 'technological', 'legal', 'environmental'].forEach((category: string) => {
        if (factors[category]) {
          lines.push(`\n### ${category.charAt(0).toUpperCase() + category.slice(1)} Factors\n`);
          const catData = factors[category];
          
          if (typeof catData === 'string') {
            lines.push(`${catData}\n`);
          } else if (Array.isArray(catData)) {
            catData.forEach((item: string) => lines.push(`- ${item}`));
            lines.push('');
          } else {
            if (catData.trends && Array.isArray(catData.trends)) {
              lines.push('**Trends:**\n');
              catData.trends.forEach((t: string) => lines.push(`- ${t}`));
              lines.push('');
            }
            if (catData.opportunities && Array.isArray(catData.opportunities)) {
              lines.push('**Opportunities:**\n');
              catData.opportunities.forEach((o: string) => lines.push(`- ${o}`));
              lines.push('');
            }
            if (catData.risks && Array.isArray(catData.risks)) {
              lines.push('**Risks:**\n');
              catData.risks.forEach((r: string) => lines.push(`- ${r}`));
              lines.push('');
            }
          }
        }
      });
      
      lines.push('---\n');
    }
  }

  if (pkg.strategy.strategyVersion) {
    const sv = pkg.strategy.strategyVersion;
    lines.push('## Strategic Decisions\n');
    
    if (sv.versionLabel) {
      lines.push(`**Version:** ${sv.versionLabel}\n`);
    }
    
    if (sv.inputSummary) {
      lines.push(`\n**Summary:**\n${sv.inputSummary}\n`);
    }
    
    if (pkg.strategy.decisions && pkg.strategy.decisions.length > 0) {
      lines.push('\n### Selected Decisions\n');
      pkg.strategy.decisions.forEach((decision: any, idx: number) => {
        const decType = decision.type || decision.category || 'Decision';
        const decValue = decision.value || decision.description || decision.choice || 'Not specified';
        lines.push(`${idx + 1}. **${decType}:** ${decValue}`);
        if (decision.rationale) {
          lines.push(`   - *Rationale:* ${decision.rationale}`);
        }
      });
      lines.push('');
    }
    
    lines.push('\n---\n');
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

    lines.push('# Enterprise Program Management (EPM) Program\n');
    lines.push(`**Framework:** ${program.frameworkType || 'Not specified'}\n`);
    lines.push(`**Status:** ${program.status}\n`);
    
    const confidenceValue = program.overallConfidence ? parseFloat(program.overallConfidence as any) : null;
    const confidenceText = (confidenceValue !== null && !isNaN(confidenceValue)) 
      ? `${(confidenceValue * 100).toFixed(1)}%`
      : 'Not calculated';
    lines.push(`**Overall Confidence:** ${confidenceText}\n`);
    lines.push('\n---\n');

    if (execSummary) {
      lines.push('## 1. Executive Summary\n');
      if (execSummary.title) {
        lines.push(`**Program Title:** ${execSummary.title}\n`);
      }
      if (execSummary.overview || execSummary.summary) {
        lines.push(`\n${execSummary.overview || execSummary.summary}\n`);
      }
      if (execSummary.objectives && execSummary.objectives.length > 0) {
        lines.push('\n**Strategic Objectives:**\n');
        execSummary.objectives.forEach((obj: string, idx: number) => {
          lines.push(`${idx + 1}. ${obj}`);
        });
        lines.push('');
      }
      if (execSummary.scope) {
        lines.push(`\n**Scope:** ${execSummary.scope}\n`);
      }
      if (execSummary.successCriteria && execSummary.successCriteria.length > 0) {
        lines.push('\n**Success Criteria:**\n');
        execSummary.successCriteria.forEach((criteria: string) => {
          lines.push(`- ${criteria}`);
        });
        lines.push('');
      }
      lines.push('\n---\n');
    }

    if (workstreams && workstreams.length > 0) {
      lines.push('## 2. Workstreams\n');
      workstreams.forEach((ws: any, idx: number) => {
        lines.push(`### ${idx + 1}. ${ws.name || `Workstream ${idx + 1}`}\n`);
        if (ws.description) {
          lines.push(`${ws.description}\n`);
        }
        if (ws.owner) {
          lines.push(`**Owner:** ${ws.owner}`);
        }
        if (ws.startMonth !== undefined && ws.endMonth !== undefined) {
          lines.push(`**Duration:** Month ${ws.startMonth} to Month ${ws.endMonth}`);
        }
        if (ws.dependencies && ws.dependencies.length > 0) {
          lines.push(`**Dependencies:** ${ws.dependencies.join(', ')}`);
        }
        if (ws.deliverables && ws.deliverables.length > 0) {
          lines.push('\n**Key Deliverables:**');
          ws.deliverables.forEach((d: any) => {
            const delName = typeof d === 'string' ? d : (d.name || d.title || 'Deliverable');
            lines.push(`- ${delName}`);
          });
        }
        if (ws.tasks && ws.tasks.length > 0) {
          lines.push(`\n**Tasks:** ${ws.tasks.length} tasks defined`);
        }
        lines.push('');
      });
      lines.push('---\n');
    }

    if (timeline) {
      lines.push('## 3. Timeline & Critical Path\n');
      if (timeline.totalDuration) {
        lines.push(`**Total Program Duration:** ${timeline.totalDuration} months\n`);
      }
      if (timeline.phases && timeline.phases.length > 0) {
        lines.push('\n**Program Phases:**\n');
        timeline.phases.forEach((phase: any) => {
          lines.push(`- **${phase.name}:** Month ${phase.startMonth} to Month ${phase.endMonth}`);
          if (phase.milestones && phase.milestones.length > 0) {
            lines.push(`  - Milestones: ${phase.milestones.join(', ')}`);
          }
        });
        lines.push('');
      }
      if (timeline.criticalPath && timeline.criticalPath.length > 0) {
        lines.push('\n**Critical Path:**\n');
        timeline.criticalPath.forEach((item: string) => {
          lines.push(`- ${item}`);
        });
        lines.push('');
      }
      if (timeline.milestones && timeline.milestones.length > 0) {
        lines.push('\n**Key Milestones:**\n');
        timeline.milestones.forEach((m: any) => {
          const mName = typeof m === 'string' ? m : (m.name || m.title);
          const mDate = m.date || m.month ? ` (${m.date || `Month ${m.month}`})` : '';
          lines.push(`- ${mName}${mDate}`);
        });
        lines.push('');
      }
      lines.push('---\n');
    }

    if (resourcePlan) {
      lines.push('## 4. Resource Plan\n');
      if (resourcePlan.internalTeam && resourcePlan.internalTeam.length > 0) {
        lines.push('\n### Internal Team\n');
        lines.push('| Role | FTE | Responsibilities |');
        lines.push('|------|-----|------------------|');
        resourcePlan.internalTeam.forEach((r: any) => {
          const role = r.role || r.title || 'Not specified';
          const fte = r.fte || r.allocation || 'TBD';
          const resp = r.responsibilities || r.description || '-';
          lines.push(`| ${role} | ${fte} | ${resp} |`);
        });
        lines.push('');
      }
      if (resourcePlan.externalResources && resourcePlan.externalResources.length > 0) {
        lines.push('\n### External Resources\n');
        lines.push('| Type | Quantity | Skills Required |');
        lines.push('|------|----------|-----------------|');
        resourcePlan.externalResources.forEach((r: any) => {
          const type = r.type || r.role || 'Contractor';
          const qty = r.quantity || r.count || '1';
          const skills = r.skills || r.requirements || '-';
          lines.push(`| ${type} | ${qty} | ${skills} |`);
        });
        lines.push('');
      }
      if (resourcePlan.totalFTE) {
        lines.push(`\n**Total FTE Required:** ${resourcePlan.totalFTE}\n`);
      }
      lines.push('---\n');
    }

    if (financialPlan) {
      lines.push('## 5. Financial Plan\n');
      if (financialPlan.totalBudget) {
        const budget = typeof financialPlan.totalBudget === 'number' 
          ? `$${financialPlan.totalBudget.toLocaleString()}`
          : financialPlan.totalBudget;
        lines.push(`**Total Program Budget:** ${budget}\n`);
      }
      if (financialPlan.costBreakdown && financialPlan.costBreakdown.length > 0) {
        lines.push('\n### Cost Breakdown\n');
        lines.push('| Category | Amount | Percentage |');
        lines.push('|----------|--------|------------|');
        financialPlan.costBreakdown.forEach((item: any) => {
          const category = item.category || item.name || 'Other';
          const amount = typeof item.amount === 'number' ? `$${item.amount.toLocaleString()}` : item.amount;
          const pct = item.percentage || '-';
          lines.push(`| ${category} | ${amount} | ${pct} |`);
        });
        lines.push('');
      }
      if (financialPlan.cashFlow && financialPlan.cashFlow.length > 0) {
        lines.push('\n### Cash Flow Projection\n');
        financialPlan.cashFlow.forEach((cf: any) => {
          lines.push(`- **${cf.period || `Period ${cf.month || cf.quarter}`}:** $${cf.amount?.toLocaleString() || '0'}`);
        });
        lines.push('');
      }
      lines.push('---\n');
    }

    if (benefits) {
      lines.push('## 6. Benefits Realization\n');
      if (benefits.benefits && benefits.benefits.length > 0) {
        lines.push('\n### Expected Benefits\n');
        benefits.benefits.forEach((b: any, idx: number) => {
          const benefitName = b.name || b.benefit || b.description || b.category || 'Benefit';
          lines.push(`${idx + 1}. **${benefitName}**`);
          if (b.description && b.description !== benefitName) lines.push(`   - ${b.description}`);
          if (b.metric) lines.push(`   - **Metric:** ${b.metric}`);
          if (b.target) lines.push(`   - **Target:** ${b.target}`);
          if (b.timeframe) lines.push(`   - **Timeframe:** ${b.timeframe}`);
        });
        lines.push('');
      }
      if (benefits.realizationPlan) {
        lines.push(`\n**Realization Plan:** ${benefits.realizationPlan}\n`);
      }
      lines.push('---\n');
    }

    if (risks) {
      lines.push('## 7. Risk Register\n');
      const riskArray = risks.risks || risks;
      if (Array.isArray(riskArray) && riskArray.length > 0) {
        lines.push('| Risk | Probability | Impact | Mitigation |');
        lines.push('|------|-------------|--------|------------|');
        riskArray.forEach((r: any) => {
          const name = r.risk || r.name || r.description || 'Unnamed risk';
          const prob = r.probability || r.likelihood || '-';
          const impact = r.impact || r.severity || '-';
          const mit = r.mitigation || r.response || '-';
          lines.push(`| ${name} | ${prob} | ${impact} | ${mit} |`);
        });
        lines.push('');
      }
      lines.push('---\n');
    }

    if (stageGates) {
      lines.push('## 8. Stage Gates & Milestones\n');
      const gates = stageGates.gates || stageGates;
      if (Array.isArray(gates) && gates.length > 0) {
        gates.forEach((gate: any, idx: number) => {
          const rawLabel = String(gate.name || gate.title || `Gate ${idx + 1}`).trim();
          const normalizedLabel = rawLabel.replace(/^Gate\s+\d+\s*:\s*/i, '').trim() || rawLabel;
          lines.push(`### Gate ${idx + 1}: ${normalizedLabel}\n`);
          if (gate.timing) lines.push(`**Timing:** ${gate.timing}`);
          if (gate.criteria && gate.criteria.length > 0) {
            lines.push('\n**Approval Criteria:**');
            gate.criteria.forEach((c: string) => lines.push(`- ${c}`));
          }
          if (gate.deliverables && gate.deliverables.length > 0) {
            lines.push('\n**Required Deliverables:**');
            gate.deliverables.forEach((d: string) => lines.push(`- ${d}`));
          }
          lines.push('');
        });
      }
      lines.push('---\n');
    }

    if (kpis) {
      lines.push('## 9. Key Performance Indicators (KPIs)\n');
      const kpiArray = kpis.kpis || kpis.metrics || kpis;
      if (Array.isArray(kpiArray) && kpiArray.length > 0) {
        lines.push('| KPI | Target | Measurement Frequency |');
        lines.push('|-----|--------|----------------------|');
        kpiArray.forEach((kpi: any) => {
          const name = kpi.name || kpi.metric || kpi.kpi || 'KPI';
          const target = kpi.target || kpi.goal || '-';
          const freq = kpi.frequency || kpi.measurementFrequency || 'Monthly';
          lines.push(`| ${name} | ${target} | ${freq} |`);
        });
        lines.push('');
      }
      lines.push('---\n');
    }

    if (stakeholders) {
      lines.push('## 10. Stakeholder Map\n');
      const stakeholderArray = stakeholders.stakeholders || stakeholders;
      if (Array.isArray(stakeholderArray) && stakeholderArray.length > 0) {
        lines.push('| Stakeholder | Role | Interest Level | Engagement Strategy |');
        lines.push('|-------------|------|----------------|---------------------|');
        stakeholderArray.forEach((s: any) => {
          const name = s.name || s.stakeholder || 'Stakeholder';
          const role = s.role || s.position || '-';
          const interest = s.interest || s.interestLevel || '-';
          const strategy = s.engagement || s.strategy || '-';
          lines.push(`| ${name} | ${role} | ${interest} | ${strategy} |`);
        });
        lines.push('');
      }
      lines.push('---\n');
    }

    if (governance) {
      lines.push('## 11. Governance Structure\n');
      if (governance.structure) lines.push(`**Governance Model:** ${governance.structure}\n`);
      if (governance.decisionMaking) lines.push(`\n**Decision-Making Framework:** ${governance.decisionMaking}\n`);
      if (governance.roles && governance.roles.length > 0) {
        lines.push('\n**Key Governance Roles:**\n');
        governance.roles.forEach((r: any) => {
          const role = typeof r === 'string' ? r : (r.role || r.name);
          const resp = r.responsibilities || '';
          lines.push(`- **${role}**${resp ? `: ${resp}` : ''}`);
        });
        lines.push('');
      }
      if (governance.meetings) lines.push(`\n**Meeting Cadence:** ${governance.meetings}\n`);
      lines.push('---\n');
    }

    if (qaPlan) {
      lines.push('## 12. Quality Assurance Plan\n');
      if (qaPlan.approach) lines.push(`**QA Approach:** ${qaPlan.approach}\n`);
      if (qaPlan.standards && qaPlan.standards.length > 0) {
        lines.push('\n**Quality Standards:**\n');
        qaPlan.standards.forEach((std: any) => {
          if (typeof std === 'string') {
            lines.push(`- ${std}`);
          } else if (std && typeof std === 'object') {
            const area = std.area || 'General';
            const standard = std.standard || std.name || std.description || 'Quality standard';
            lines.push(`- **${area}:** ${standard}`);
            if (std.acceptanceCriteria && Array.isArray(std.acceptanceCriteria)) {
              std.acceptanceCriteria.forEach((criteria: string) => {
                lines.push(`  - ${criteria}`);
              });
            }
          }
        });
        lines.push('');
      }
      if (qaPlan.reviews && qaPlan.reviews.length > 0) {
        lines.push('\n**Review Gates:**\n');
        qaPlan.reviews.forEach((rev: any) => {
          const name = typeof rev === 'string' ? rev : (rev.name || rev.type);
          lines.push(`- ${name}`);
        });
        lines.push('');
      }
      lines.push('---\n');
    }

    if (procurement) {
      lines.push('## 13. Procurement Plan\n');
      if (procurement.strategy) lines.push(`**Procurement Strategy:** ${procurement.strategy}\n`);
      const vendors = procurement.vendors || procurement.suppliers || [];
      if (vendors.length > 0) {
        lines.push('\n**Vendor Requirements:**\n');
        vendors.forEach((v: any) => {
          const name = typeof v === 'string' ? v : (v.name || v.vendor || v.type);
          const req = v.requirements || v.details || '';
          lines.push(`- **${name}**${req ? `: ${req}` : ''}`);
        });
        lines.push('');
      }
      lines.push('---\n');
    }

    if (exitStrategy) {
      lines.push('## 14. Exit Strategy\n');
      if (exitStrategy.approach) lines.push(`**Exit Approach:** ${exitStrategy.approach}\n`);
      if (exitStrategy.criteria && exitStrategy.criteria.length > 0) {
        lines.push('\n**Exit Criteria:**\n');
        exitStrategy.criteria.forEach((c: string) => lines.push(`- ${c}`));
        lines.push('');
      }
      if (exitStrategy.transitionPlan) lines.push(`\n**Transition Plan:** ${exitStrategy.transitionPlan}\n`);
      lines.push('---\n');
    }
  }

  if (pkg.epm?.assignments && pkg.epm.assignments.length > 0) {
    lines.push('## Task Assignments Overview\n');
    lines.push(`**Total Assignments:** ${pkg.epm.assignments.length}\n`);
    
    const resourceCounts = pkg.epm.assignments.reduce((acc: any, a: any) => {
      acc[a.resourceName] = (acc[a.resourceName] || 0) + 1;
      return acc;
    }, {});
    
    lines.push('\n**Assignments by Resource:**\n');
    Object.entries(resourceCounts).forEach(([name, count]) => {
      lines.push(`- **${name}:** ${count} task(s)`);
    });
    lines.push('\n');
    
    lines.push('*Detailed assignment data available in assignments.csv*\n');
    lines.push('\n---\n');
  }

  lines.push('\n*Report generated by Premisia Intelligent Strategic EPM*\n');
  lines.push(`*Export Date: ${format(new Date(pkg.metadata.exportedAt), 'PPPPpp')}*`);

  return lines.join('\n');
}
