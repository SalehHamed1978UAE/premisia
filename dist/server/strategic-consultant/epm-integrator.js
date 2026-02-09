import { storage } from '../storage';
export class EPMIntegrator {
    /**
     * Integrates a Strategic Consultant EPM program into the main EPM suite database.
     * Creates actual database records for programs, workstreams, tasks, stage gates, KPIs, benefits, risks, and resources.
     */
    async integrateToEPMSuite(epmProgram, userId, sessionId, versionId) {
        console.log(`[EPMIntegrator] Starting integration for session ${sessionId}`);
        const summary = {
            programId: '',
            workstreamsCreated: 0,
            tasksCreated: 0,
            stageGatesCreated: 0,
            kpisCreated: 0,
            benefitsCreated: 0,
            risksCreated: 0,
            fundingSourcesCreated: 0,
            resourcesCreated: 0,
        };
        try {
            // 1. Create Program
            const program = await this.createProgram(epmProgram, userId);
            summary.programId = program.id;
            console.log(`[EPMIntegrator] Created program: ${program.id}`);
            // Immediately set convertedProgramId for idempotency (prevents duplicates on retry)
            await storage.updateStrategyVersion(versionId, {
                convertedProgramId: program.id,
            });
            console.log(`[EPMIntegrator] Marked version ${versionId} with program ID for idempotency`);
            // 2. Create Workstreams and Tasks
            const workstreamMap = await this.createWorkstreamsAndTasks(epmProgram, program.id);
            summary.workstreamsCreated = workstreamMap.size;
            summary.tasksCreated = Array.from(workstreamMap.values())
                .reduce((total, tasks) => total + tasks.length, 0);
            console.log(`[EPMIntegrator] Created ${summary.workstreamsCreated} workstreams with ${summary.tasksCreated} tasks`);
            // 3. Create Stage Gates
            summary.stageGatesCreated = await this.createStageGates(epmProgram, program.id);
            console.log(`[EPMIntegrator] Created ${summary.stageGatesCreated} stage gates`);
            // 4. Create KPIs
            summary.kpisCreated = await this.createKPIs(epmProgram, program.id);
            console.log(`[EPMIntegrator] Created ${summary.kpisCreated} KPIs`);
            // 5. Create Benefits
            summary.benefitsCreated = await this.createBenefits(epmProgram, program.id);
            console.log(`[EPMIntegrator] Created ${summary.benefitsCreated} benefits`);
            // 6. Create Risks
            summary.risksCreated = await this.createRisks(epmProgram, program.id);
            console.log(`[EPMIntegrator] Created ${summary.risksCreated} risks`);
            // 7. Create Funding Sources
            summary.fundingSourcesCreated = await this.createFundingSources(epmProgram, program.id);
            console.log(`[EPMIntegrator] Created ${summary.fundingSourcesCreated} funding sources`);
            // 8. Create Resources
            summary.resourcesCreated = await this.createResources(epmProgram, program.id, userId);
            console.log(`[EPMIntegrator] Created ${summary.resourcesCreated} resources`);
            console.log(`[EPMIntegrator] Integration complete for program ${program.id}`);
            return { programId: program.id, summary };
        }
        catch (error) {
            console.error('[EPMIntegrator] Integration failed:', error);
            throw error;
        }
    }
    async createProgram(epmProgram, userId) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + epmProgram.timeline.total_months);
        const programData = {
            name: epmProgram.title,
            description: epmProgram.description,
            status: 'Planning',
            startDate,
            endDate,
            ownerId: userId,
        };
        return await storage.createProgram(programData);
    }
    async createWorkstreamsAndTasks(epmProgram, programId) {
        const workstreamMap = new Map();
        for (const ws of epmProgram.workstreams) {
            const workstreamData = {
                programId,
                name: ws.title,
                description: ws.description,
            };
            const workstream = await storage.createWorkstream(workstreamData);
            const taskIds = [];
            // Create tasks for this workstream
            for (const task of ws.tasks) {
                const taskData = {
                    workstreamId: workstream.id,
                    name: task.title,
                    description: task.description,
                    status: 'Not Started',
                    priority: this.normalizePriority(task.priority),
                    progress: 0,
                };
                const createdTask = await storage.createTask(taskData);
                taskIds.push(createdTask.id);
            }
            workstreamMap.set(workstream.id, taskIds);
        }
        return workstreamMap;
    }
    async createStageGates(epmProgram, programId) {
        let count = 0;
        for (const sg of epmProgram.stage_gates) {
            const stageGateData = {
                programId,
                code: sg.gate,
                name: sg.name,
                description: sg.criteria.join(', '),
                successCriteria: sg.deliverables.join('; '),
            };
            await storage.createStageGate(stageGateData);
            count++;
        }
        return count;
    }
    async createKPIs(epmProgram, programId) {
        let count = 0;
        for (const kpi of epmProgram.kpis) {
            const kpiData = {
                programId,
                name: kpi.name,
                description: kpi.description,
                targetValue: this.extractNumericTarget(kpi.target),
                currentValue: '0',
                unit: this.extractUnit(kpi.target),
                frequency: kpi.measurement_frequency,
            };
            await storage.createKpi(kpiData);
            count++;
        }
        return count;
    }
    async createBenefits(epmProgram, programId) {
        let count = 0;
        for (const benefit of epmProgram.benefits) {
            const benefitData = {
                programId,
                name: benefit.category,
                description: benefit.description,
                category: benefit.category,
                targetValue: benefit.quantified_value ? this.extractNumericValue(benefit.quantified_value) : '0',
                realizedValue: '0',
                unit: benefit.quantified_value ? this.extractUnit(benefit.quantified_value) : '$',
                status: 'Not Started',
                realizationDate: this.parseRealizationDate(benefit.realization_timeline),
            };
            await storage.createBenefit(benefitData);
            count++;
        }
        return count;
    }
    async createRisks(epmProgram, programId) {
        let count = 0;
        for (let i = 0; i < epmProgram.risks.length; i++) {
            const risk = epmProgram.risks[i];
            const riskData = {
                programId,
                riskId: `R-${String(i + 1).padStart(3, '0')}`,
                description: risk.description,
                category: 'Strategic',
                likelihood: this.normalizeLikelihood(risk.likelihood),
                impact: this.normalizeImpact(risk.impact),
                priority: this.calculateRiskPriority(risk.likelihood, risk.impact),
                mitigationPlan: risk.mitigation_strategy,
                status: 'Open',
            };
            await storage.createRisk(riskData);
            count++;
        }
        return count;
    }
    async createFundingSources(epmProgram, programId) {
        let count = 0;
        for (const source of epmProgram.funding.sources) {
            const fundingData = {
                programId,
                sourceName: source.source,
                allocatedAmount: source.amount, // Keep as number
                dateReceived: new Date(),
            };
            await storage.createFundingSource(fundingData);
            count++;
        }
        return count;
    }
    async createResources(epmProgram, programId, userId) {
        let count = 0;
        for (const resource of epmProgram.resources) {
            for (let i = 0; i < resource.count; i++) {
                const resourceData = {
                    programId,
                    name: `${resource.role} ${i + 1}`,
                    role: resource.role,
                    department: resource.skillset.join(', '),
                    email: null,
                    userId: null,
                };
                await storage.createResource(resourceData);
                count++;
            }
        }
        return count;
    }
    normalizePriority(priority) {
        const map = {
            'critical': 'High',
            'high': 'High',
            'medium': 'Medium',
            'low': 'Low',
        };
        return map[priority.toLowerCase()] || 'Medium';
    }
    normalizeLikelihood(likelihood) {
        const map = {
            'low': 'Unlikely',
            'medium': 'Possible',
            'high': 'Likely',
        };
        return map[likelihood.toLowerCase()] || 'Possible';
    }
    normalizeImpact(impact) {
        const map = {
            'low': 'Low',
            'medium': 'Medium',
            'high': 'High',
        };
        return map[impact.toLowerCase()] || 'Medium';
    }
    calculateRiskPriority(likelihood, impact) {
        if (likelihood === 'high' && impact === 'high')
            return 'Critical';
        if (likelihood === 'high' || impact === 'high')
            return 'High';
        if (likelihood === 'medium' && impact === 'medium')
            return 'Medium';
        return 'Low';
    }
    extractNumericTarget(target) {
        const match = target.match(/[\d.]+/);
        return match ? match[0] : '0';
    }
    extractNumericValue(value) {
        const match = value.match(/[\d.]+/);
        return match ? match[0] : '0';
    }
    extractUnit(target) {
        if (target.includes('%'))
            return '%';
        if (target.includes('$') || target.includes('M') || target.includes('USD'))
            return '$';
        if (target.includes('hours'))
            return 'hours';
        if (target.includes('days'))
            return 'days';
        return 'count';
    }
    parseRealizationDate(timeline) {
        const match = timeline.match(/\d+/);
        const months = match ? parseInt(match[0]) : 12;
        const date = new Date();
        date.setMonth(date.getMonth() + months);
        return date;
    }
}
export const epmIntegrator = new EPMIntegrator();
//# sourceMappingURL=epm-integrator.js.map