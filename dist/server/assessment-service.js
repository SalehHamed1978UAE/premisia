export class AssessmentService {
    // Industry benchmarks and thresholds
    BENCHMARKS = {
        program: {
            minDurationDays: 90,
            maxDurationDays: 1095,
            typicalDurationDays: 365,
            minTasksPerMonth: 2,
            maxTasksPerMonth: 20,
            minBudgetPerTask: 1000,
            roiThreshold: 1.5,
            minStageGates: 4,
            maxStageGates: 7
        },
        task: {
            minDurationDays: 1,
            maxDurationDays: 90,
            typicalDurationDays: 14,
            maxDependencies: 5,
            warningDependencies: 3
        },
        risk: {
            highPriorityMitigationRequired: true,
            maxOpenHighRisks: 5,
            mitigationTimeframeDays: 30
        },
        kpi: {
            minMeasurementsForTrend: 3,
            measurementFrequencyDays: 30
        },
        benefit: {
            minROI: 1.2,
            realizationTimeframeMonths: 12
        },
        resource: {
            maxAllocationPercent: 100,
            warningAllocationPercent: 90
        }
    };
    async assessProgram(program, relatedData) {
        const concerns = [];
        // Timeline assessment
        if (program.startDate && program.endDate) {
            const durationDays = this.calculateDaysBetween(program.startDate, program.endDate);
            if (durationDays < this.BENCHMARKS.program.minDurationDays) {
                concerns.push({
                    category: 'timeline',
                    severity: 'high',
                    message: `Program duration of ${durationDays} days is unusually short. Typical programs run 90-1095 days.`,
                    recommendation: `Consider extending the timeline to at least ${this.BENCHMARKS.program.minDurationDays} days or evaluate if this should be a project instead of a program.`
                });
            }
            else if (durationDays > this.BENCHMARKS.program.maxDurationDays) {
                concerns.push({
                    category: 'timeline',
                    severity: 'medium',
                    message: `Program duration of ${durationDays} days is very long. Programs over 3 years often face scope creep.`,
                    recommendation: `Consider breaking into phases or multiple programs with intermediate milestones.`
                });
            }
        }
        // Task density assessment
        if (relatedData?.tasks && program.startDate && program.endDate) {
            const durationMonths = this.calculateDaysBetween(program.startDate, program.endDate) / 30;
            const tasksPerMonth = relatedData.tasks.length / durationMonths;
            if (tasksPerMonth < this.BENCHMARKS.program.minTasksPerMonth) {
                concerns.push({
                    category: 'scope',
                    severity: 'medium',
                    message: `With ${relatedData.tasks.length} tasks over ${Math.round(durationMonths)} months (${tasksPerMonth.toFixed(1)} tasks/month), the program may lack detailed planning.`,
                    recommendation: `Add more granular tasks to ensure work is properly broken down and trackable.`
                });
            }
            else if (tasksPerMonth > this.BENCHMARKS.program.maxTasksPerMonth) {
                concerns.push({
                    category: 'scope',
                    severity: 'medium',
                    message: `With ${relatedData.tasks.length} tasks over ${Math.round(durationMonths)} months (${tasksPerMonth.toFixed(1)} tasks/month), the program may be over-planned.`,
                    recommendation: `Consider consolidating smaller tasks or delegating detailed planning to workstreams.`
                });
            }
        }
        // Stage gate assessment
        if (relatedData?.stageGates) {
            if (relatedData.stageGates.length < this.BENCHMARKS.program.minStageGates) {
                concerns.push({
                    category: 'quality',
                    severity: 'high',
                    message: `Program has only ${relatedData.stageGates.length} stage gates. Proper governance requires at least ${this.BENCHMARKS.program.minStageGates} gates (G0-G4).`,
                    recommendation: `Add standard stage gates: G0 (Ideation), G1 (Planning), G2 (Execution), G3 (Validation), G4 (Closure).`
                });
            }
        }
        // Budget and ROI assessment
        if (relatedData?.fundingSources && relatedData?.benefits) {
            let totalFunding = 0;
            let hasFundingError = false;
            for (const f of relatedData.fundingSources) {
                const amount = parseFloat(f.allocatedAmount || '0');
                if (isNaN(amount)) {
                    hasFundingError = true;
                    concerns.push({
                        category: 'budget',
                        severity: 'critical',
                        message: `Funding source "${f.name || 'unnamed'}" has invalid amount: "${f.allocatedAmount}". Must be numeric.`,
                        recommendation: `Correct funding amount to be a valid number.`
                    });
                }
                else {
                    totalFunding += amount;
                }
            }
            let totalBenefits = 0;
            let hasBenefitError = false;
            for (const b of relatedData.benefits) {
                const value = parseFloat(b.targetValue || '0');
                if (isNaN(value)) {
                    hasBenefitError = true;
                    concerns.push({
                        category: 'budget',
                        severity: 'high',
                        message: `Benefit "${b.name || 'unnamed'}" has invalid target value: "${b.targetValue}". Must be numeric.`,
                        recommendation: `Correct benefit target value to be a valid number.`
                    });
                }
                else {
                    totalBenefits += value;
                }
            }
            if (!hasFundingError && totalFunding === 0) {
                concerns.push({
                    category: 'budget',
                    severity: 'critical',
                    message: `Program has no funding sources defined. Cannot calculate ROI or financial viability.`,
                    recommendation: `Define at least one funding source with allocated budget to establish program capital.`
                });
            }
            else if (!hasFundingError && !hasBenefitError && totalBenefits > 0) {
                const roi = totalBenefits / totalFunding;
                if (roi < this.BENCHMARKS.program.roiThreshold) {
                    concerns.push({
                        category: 'budget',
                        severity: roi < 1 ? 'critical' : 'high',
                        message: `Program ROI of ${roi.toFixed(2)}x is ${roi < 1 ? 'negative' : 'below recommended threshold of ' + this.BENCHMARKS.program.roiThreshold + 'x'}.`,
                        recommendation: roi < 1
                            ? 'Re-evaluate program viability. Consider reducing costs or increasing benefit targets.'
                            : 'Review benefit calculations and look for additional value opportunities to improve ROI.',
                        data: { totalFunding, totalBenefits, roi }
                    });
                }
            }
        }
        // Risk assessment
        if (relatedData?.risks) {
            const highRisks = relatedData.risks.filter((r) => r.priority === 'High' || r.priority === 'Critical');
            const openHighRisks = highRisks.filter((r) => r.status === 'Open');
            if (openHighRisks.length > this.BENCHMARKS.risk.maxOpenHighRisks) {
                concerns.push({
                    category: 'risk',
                    severity: 'critical',
                    message: `Program has ${openHighRisks.length} open high/critical risks. This exceeds safe threshold of ${this.BENCHMARKS.risk.maxOpenHighRisks}.`,
                    recommendation: `Prioritize risk mitigation. Address critical risks immediately before proceeding.`
                });
            }
        }
        return {
            isRealistic: concerns.filter(c => c.severity === 'critical').length === 0,
            concerns,
            benchmarks: {
                typical: {
                    duration: `${this.BENCHMARKS.program.typicalDurationDays} days (12 months)`,
                    tasksPerMonth: `${this.BENCHMARKS.program.minTasksPerMonth}-${this.BENCHMARKS.program.maxTasksPerMonth}`,
                    stageGates: `${this.BENCHMARKS.program.minStageGates}-${this.BENCHMARKS.program.maxStageGates}`,
                    roi: `${this.BENCHMARKS.program.roiThreshold}x or higher`
                },
                current: {
                    duration: program.startDate && program.endDate
                        ? `${this.calculateDaysBetween(program.startDate, program.endDate)} days`
                        : 'Not specified',
                    tasks: relatedData?.tasks?.length || 0,
                    stageGates: relatedData?.stageGates?.length || 0,
                    openHighRisks: relatedData?.risks?.filter((r) => (r.priority === 'High' || r.priority === 'Critical') && r.status === 'Open').length || 0
                },
                deviation: concerns.length === 0 ? 'Within normal parameters' : `${concerns.length} concern(s) identified`
            }
        };
    }
    async assessTask(task, program) {
        const concerns = [];
        // Duration assessment
        if (task.startDate && task.endDate) {
            const durationDays = this.calculateDaysBetween(task.startDate, task.endDate);
            if (durationDays === 0) {
                concerns.push({
                    category: 'timeline',
                    severity: 'medium',
                    message: `Task has zero duration (start and end on the same day). Tasks should span at least 1 day.`,
                    recommendation: `Extend task duration to at least 1 day or combine with other tasks.`
                });
            }
            else if (durationDays < this.BENCHMARKS.task.minDurationDays) {
                concerns.push({
                    category: 'timeline',
                    severity: 'low',
                    message: `Task duration of ${durationDays} days is very short. Consider consolidating micro-tasks.`,
                    recommendation: `Combine with related tasks or extend duration to at least 1 day.`
                });
            }
            else if (durationDays > this.BENCHMARKS.task.maxDurationDays) {
                concerns.push({
                    category: 'timeline',
                    severity: 'medium',
                    message: `Task duration of ${durationDays} days is very long. Tasks over 90 days risk becoming stale.`,
                    recommendation: `Break into smaller, more manageable subtasks with intermediate deliverables.`
                });
            }
        }
        // Program timeline alignment
        if (program && task.startDate && task.endDate) {
            if (new Date(task.startDate) < new Date(program.startDate)) {
                concerns.push({
                    category: 'timeline',
                    severity: 'critical',
                    message: `Task starts before program start date.`,
                    recommendation: `Adjust task start date to be within program timeline.`
                });
            }
            if (new Date(task.endDate) > new Date(program.endDate)) {
                concerns.push({
                    category: 'timeline',
                    severity: 'critical',
                    message: `Task ends after program end date.`,
                    recommendation: `Adjust task end date to be within program timeline or extend program duration.`
                });
            }
        }
        // Progress vs timeline assessment
        if (task.startDate && task.endDate && task.progress !== undefined) {
            const totalDays = Math.max(1, this.calculateDaysBetween(task.startDate, task.endDate));
            const now = new Date();
            const taskStart = new Date(task.startDate);
            // Only assess progress if task has started
            if (now >= taskStart) {
                const elapsed = Math.max(0, this.calculateDaysBetween(task.startDate, now));
                const expectedProgress = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
                const progressGap = task.progress - expectedProgress;
                if (progressGap < -20) {
                    concerns.push({
                        category: 'timeline',
                        severity: 'high',
                        message: `Task is ${Math.abs(progressGap).toFixed(0)}% behind schedule (expected ${expectedProgress.toFixed(0)}%, actual ${task.progress}%).`,
                        recommendation: `Investigate delays and allocate additional resources or adjust timeline.`,
                        data: { expectedProgress: expectedProgress.toFixed(0), actualProgress: task.progress, gap: progressGap.toFixed(0) }
                    });
                }
            }
        }
        return {
            isRealistic: concerns.filter(c => c.severity === 'critical').length === 0,
            concerns,
            benchmarks: {
                typical: {
                    duration: `${this.BENCHMARKS.task.typicalDurationDays} days`,
                    maxDuration: `${this.BENCHMARKS.task.maxDurationDays} days`
                },
                current: {
                    duration: task.startDate && task.endDate
                        ? `${this.calculateDaysBetween(task.startDate, task.endDate)} days`
                        : 'Not specified',
                    progress: `${task.progress || 0}%`,
                    status: task.status || 'Unknown'
                },
                deviation: concerns.length === 0 ? 'Within normal parameters' : `${concerns.length} concern(s) identified`
            }
        };
    }
    async assessRisk(risk, mitigations) {
        const concerns = [];
        // High/Critical risk mitigation check
        if ((risk.priority === 'High' || risk.priority === 'Critical') && risk.status === 'Open') {
            if (!mitigations || mitigations.length === 0) {
                concerns.push({
                    category: 'risk',
                    severity: 'critical',
                    message: `High/Critical risk has no mitigation actions defined.`,
                    recommendation: `Define at least one mitigation action with owner and target date.`
                });
            }
            else {
                const completedMitigations = mitigations.filter(m => m.status === 'Completed');
                if (completedMitigations.length === 0) {
                    concerns.push({
                        category: 'risk',
                        severity: 'high',
                        message: `High/Critical risk has ${mitigations.length} mitigation(s) but none are completed.`,
                        recommendation: `Accelerate mitigation actions. High/Critical risks should be addressed within ${this.BENCHMARKS.risk.mitigationTimeframeDays} days.`
                    });
                }
            }
        }
        // Risk age assessment
        if (risk.createdAt && risk.status === 'Open') {
            const ageInDays = this.calculateDaysBetween(risk.createdAt, new Date());
            if (ageInDays > 90 && (risk.priority === 'High' || risk.priority === 'Critical')) {
                concerns.push({
                    category: 'risk',
                    severity: 'high',
                    message: `High/Critical risk has been open for ${ageInDays} days without resolution.`,
                    recommendation: `Escalate to program leadership. Persistent high risks threaten program success.`
                });
            }
        }
        return {
            isRealistic: concerns.filter(c => c.severity === 'critical').length === 0,
            concerns,
            benchmarks: {
                typical: {
                    mitigationTimeframe: `${this.BENCHMARKS.risk.mitigationTimeframeDays} days for high/critical`,
                    requiredMitigations: 'At least 1 for high/critical risks'
                },
                current: {
                    priority: risk.priority || 'Unknown',
                    status: risk.status || 'Unknown',
                    mitigations: mitigations?.length || 0,
                    completedMitigations: mitigations?.filter((m) => m.status === 'Completed').length || 0
                },
                deviation: concerns.length === 0 ? 'Risk properly managed' : `${concerns.length} concern(s) identified`
            }
        };
    }
    async assessBenefit(benefit, program) {
        const concerns = [];
        // Target value assessment
        if (benefit.targetValue && program) {
            // If we can access program funding
            const targetValue = parseFloat(benefit.targetValue);
            if (targetValue <= 0) {
                concerns.push({
                    category: 'budget',
                    severity: 'critical',
                    message: `Benefit target value must be positive to justify investment.`,
                    recommendation: `Define a measurable, positive target value for this benefit.`
                });
            }
        }
        // Realization timeframe assessment
        if (benefit.targetDate && program?.endDate) {
            const realizationDate = new Date(benefit.targetDate);
            const programEnd = new Date(program.endDate);
            const monthsAfterProgram = (realizationDate.getTime() - programEnd.getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (monthsAfterProgram > this.BENCHMARKS.benefit.realizationTimeframeMonths) {
                concerns.push({
                    category: 'timeline',
                    severity: 'medium',
                    message: `Benefit realization is ${Math.round(monthsAfterProgram)} months after program completion. Long delays reduce confidence in benefit delivery.`,
                    recommendation: `Review benefit timeline. Consider if this is truly achievable or if interim benefits should be defined.`
                });
            }
        }
        return {
            isRealistic: concerns.filter(c => c.severity === 'critical').length === 0,
            concerns,
            benchmarks: {
                typical: {
                    targetValue: 'Positive, measurable value',
                    realizationTimeframe: `Within ${this.BENCHMARKS.benefit.realizationTimeframeMonths} months of program completion`
                },
                current: {
                    targetValue: benefit.targetValue || 'Not specified',
                    status: benefit.status || 'Unknown',
                    category: benefit.category || 'Unknown'
                },
                deviation: concerns.length === 0 ? 'Benefit properly defined' : `${concerns.length} concern(s) identified`
            }
        };
    }
    async assessKpi(kpi, measurements) {
        const concerns = [];
        // Measurement frequency assessment
        if (measurements && measurements.length >= 2) {
            const sortedMeasurements = [...measurements].sort((a, b) => new Date(a.measurementDate).getTime() - new Date(b.measurementDate).getTime());
            const intervals = [];
            let hasInvalidDate = false;
            for (let i = 1; i < sortedMeasurements.length; i++) {
                const date1 = new Date(sortedMeasurements[i - 1].measurementDate);
                const date2 = new Date(sortedMeasurements[i].measurementDate);
                if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
                    hasInvalidDate = true;
                    concerns.push({
                        category: 'quality',
                        severity: 'critical',
                        message: `KPI measurements contain invalid dates. Cannot calculate measurement frequency.`,
                        recommendation: `Ensure all measurement dates are valid ISO dates.`
                    });
                    break;
                }
                const daysBetween = this.calculateDaysBetween(date1, date2);
                intervals.push(daysBetween);
            }
            if (!hasInvalidDate && intervals.length > 0) {
                const avgInterval = intervals.reduce((sum, days) => sum + days, 0) / intervals.length;
                if (isNaN(avgInterval)) {
                    concerns.push({
                        category: 'quality',
                        severity: 'critical',
                        message: `Cannot calculate measurement frequency. Check measurement dates.`,
                        recommendation: `Verify all measurement dates are valid and properly formatted.`
                    });
                }
                else if (avgInterval > this.BENCHMARKS.kpi.measurementFrequencyDays * 2) {
                    concerns.push({
                        category: 'quality',
                        severity: 'medium',
                        message: `KPI measurements are averaged ${Math.round(avgInterval)} days apart. This is too infrequent for effective tracking.`,
                        recommendation: `Increase measurement frequency to at least every ${this.BENCHMARKS.kpi.measurementFrequencyDays} days for meaningful trends.`
                    });
                }
            }
        }
        else if (!measurements || measurements.length < this.BENCHMARKS.kpi.minMeasurementsForTrend) {
            concerns.push({
                category: 'quality',
                severity: 'high',
                message: `KPI has ${measurements?.length || 0} measurements. Need at least ${this.BENCHMARKS.kpi.minMeasurementsForTrend} to establish a trend.`,
                recommendation: `Record ${this.BENCHMARKS.kpi.minMeasurementsForTrend} measurements to establish a baseline and track progress.`
            });
        }
        // Target value assessment
        if (kpi.targetValue !== undefined && kpi.actualValue !== undefined) {
            const target = parseFloat(kpi.targetValue);
            const actual = parseFloat(kpi.actualValue);
            if (isNaN(target) || isNaN(actual)) {
                concerns.push({
                    category: 'quality',
                    severity: 'medium',
                    message: `KPI target or actual value is not numeric. Cannot assess performance.`,
                    recommendation: `Ensure target and actual values are numeric for quantitative tracking.`
                });
            }
            else {
                const achievement = (actual / target) * 100;
                if (achievement < 50) {
                    concerns.push({
                        category: 'quality',
                        severity: 'critical',
                        message: `KPI achievement is ${achievement.toFixed(0)}% of target. Significantly underperforming.`,
                        recommendation: `Investigate root causes. Consider if target is realistic or if corrective actions are needed.`,
                        data: { target, actual, achievement: achievement.toFixed(0) }
                    });
                }
                else if (achievement < 80) {
                    concerns.push({
                        category: 'quality',
                        severity: 'high',
                        message: `KPI achievement is ${achievement.toFixed(0)}% of target. Below expected performance.`,
                        recommendation: `Review progress and implement improvement actions to reach target.`,
                        data: { target, actual, achievement: achievement.toFixed(0) }
                    });
                }
            }
        }
        // Stale KPI assessment
        if (measurements && measurements.length > 0) {
            const latestMeasurement = measurements.reduce((latest, m) => new Date(m.measurementDate) > new Date(latest.measurementDate) ? m : latest, measurements[0]);
            const daysSinceLastMeasurement = this.calculateDaysBetween(latestMeasurement.measurementDate, new Date());
            if (daysSinceLastMeasurement > this.BENCHMARKS.kpi.measurementFrequencyDays * 2) {
                concerns.push({
                    category: 'quality',
                    severity: 'medium',
                    message: `KPI has not been measured in ${daysSinceLastMeasurement} days. Data is stale.`,
                    recommendation: `Record a new measurement to keep KPI tracking current.`
                });
            }
        }
        return {
            isRealistic: concerns.filter(c => c.severity === 'critical').length === 0,
            concerns,
            benchmarks: {
                typical: {
                    measurementFrequency: `Every ${this.BENCHMARKS.kpi.measurementFrequencyDays} days`,
                    minMeasurements: this.BENCHMARKS.kpi.minMeasurementsForTrend,
                    targetAchievement: '80% or higher'
                },
                current: {
                    measurements: measurements?.length || 0,
                    latestValue: kpi.actualValue || 'Not recorded',
                    targetValue: kpi.targetValue || 'Not set'
                },
                deviation: concerns.length === 0 ? 'KPI tracking is healthy' : `${concerns.length} concern(s) identified`
            }
        };
    }
    async assessResource(resource) {
        const concerns = [];
        // Allocation percentage assessment
        if (resource.allocation !== undefined) {
            const allocation = parseFloat(resource.allocation);
            if (allocation > this.BENCHMARKS.resource.maxAllocationPercent) {
                concerns.push({
                    category: 'resources',
                    severity: 'critical',
                    message: `Resource allocation of ${allocation}% exceeds 100%. This is not sustainable.`,
                    recommendation: `Reduce allocation to 100% or split work across multiple resources.`
                });
            }
            else if (allocation >= this.BENCHMARKS.resource.warningAllocationPercent) {
                concerns.push({
                    category: 'resources',
                    severity: 'medium',
                    message: `Resource allocation of ${allocation}% is very high. Risk of burnout and quality issues.`,
                    recommendation: `Consider reducing allocation to allow buffer for unexpected work or allocate additional resources.`
                });
            }
        }
        return {
            isRealistic: concerns.filter(c => c.severity === 'critical').length === 0,
            concerns,
            benchmarks: {
                typical: {
                    maxAllocation: `${this.BENCHMARKS.resource.maxAllocationPercent}%`,
                    sustainableAllocation: `${this.BENCHMARKS.resource.warningAllocationPercent}% or below`
                },
                current: {
                    allocation: `${resource.allocation || 0}%`,
                    role: resource.role || 'Unknown'
                },
                deviation: concerns.length === 0 ? 'Allocation is reasonable' : `${concerns.length} concern(s) identified`
            }
        };
    }
    calculateDaysBetween(start, end) {
        const startDate = typeof start === 'string' ? new Date(start) : start;
        const endDate = typeof end === 'string' ? new Date(end) : end;
        return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    }
}
export const assessmentService = new AssessmentService();
//# sourceMappingURL=assessment-service.js.map