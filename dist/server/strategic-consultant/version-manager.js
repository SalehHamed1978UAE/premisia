export class VersionManager {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    async createVersion(sessionId, analysis, decisions, userId) {
        const existingVersions = await this.storage.getStrategyVersionsBySession(sessionId);
        const versionNumber = existingVersions.length + 1;
        const version = await this.storage.createStrategyVersion({
            sessionId: sessionId,
            versionNumber: versionNumber,
            analysisData: analysis,
            decisionsData: decisions,
            selectedDecisions: null,
            programStructure: null,
            status: 'draft',
            createdBy: userId,
            userId: userId,
        });
        return {
            versionNumber: version.versionNumber,
            analysis: version.analysisData,
            decisions: version.decisionsData,
            selectedDecisions: version.selectedDecisions,
            programStructure: version.programStructure,
            status: version.status,
            createdBy: version.createdBy,
            createdAt: version.createdAt || undefined,
            finalizedAt: version.finalizedAt || undefined,
        };
    }
    async updateVersion(sessionId, versionNumber, selectedDecisions) {
        const version = await this.storage.getStrategyVersion(sessionId, versionNumber);
        if (!version) {
            throw new Error(`Version ${versionNumber} not found for session ${sessionId}`);
        }
        if (version.status === 'finalized') {
            throw new Error('Cannot update finalized version');
        }
        const updated = await this.storage.updateStrategyVersion(version.id, {
            selectedDecisions: selectedDecisions,
            status: 'in_review',
        });
        return {
            versionNumber: updated.versionNumber,
            analysis: updated.analysisData,
            decisions: updated.decisionsData,
            selectedDecisions: updated.selectedDecisions,
            programStructure: updated.programStructure,
            status: updated.status,
            createdBy: updated.createdBy,
            createdAt: updated.createdAt || undefined,
            finalizedAt: updated.finalizedAt || undefined,
        };
    }
    async finalizeVersion(sessionId, versionNumber, programStructure) {
        const version = await this.storage.getStrategyVersion(sessionId, versionNumber);
        if (!version) {
            throw new Error(`Version ${versionNumber} not found for session ${sessionId}`);
        }
        if (version.status === 'finalized') {
            // Already finalized - return existing data (idempotent operation)
            return {
                versionNumber: version.versionNumber,
                analysis: version.analysisData,
                decisions: version.decisionsData,
                selectedDecisions: version.selectedDecisions,
                programStructure: version.programStructure,
                status: version.status,
                createdBy: version.createdBy,
                createdAt: version.createdAt || undefined,
                finalizedAt: version.finalizedAt || undefined,
            };
        }
        if (!version.selectedDecisions || Object.keys(version.selectedDecisions).length === 0) {
            throw new Error('Cannot finalize version without selected decisions');
        }
        const updated = await this.storage.updateStrategyVersion(version.id, {
            programStructure: programStructure,
            status: 'finalized',
            finalizedAt: new Date(),
        });
        return {
            versionNumber: updated.versionNumber,
            analysis: updated.analysisData,
            decisions: updated.decisionsData,
            selectedDecisions: updated.selectedDecisions,
            programStructure: updated.programStructure,
            status: updated.status,
            createdBy: updated.createdBy,
            createdAt: updated.createdAt || undefined,
            finalizedAt: updated.finalizedAt || undefined,
        };
    }
    async compareVersions(sessionId, versionA, versionB) {
        const [vA, vB] = await Promise.all([
            this.storage.getStrategyVersion(sessionId, versionA),
            this.storage.getStrategyVersion(sessionId, versionB),
        ]);
        if (!vA || !vB) {
            throw new Error('One or both versions not found');
        }
        const analysisA = vA.analysisData;
        const analysisB = vB.analysisData;
        const decisionsA = vA.decisionsData;
        const decisionsB = vB.decisionsData;
        const approachChanged = JSON.stringify(analysisA.recommended_approaches) !== JSON.stringify(analysisB.recommended_approaches);
        const marketChanged = analysisA.recommended_market !== analysisB.recommended_market;
        const decisionsChanged = [];
        const decisionIdsA = decisionsA.decisions.map(d => d.id);
        const decisionIdsB = decisionsB.decisions.map(d => d.id);
        const allDecisionIds = Array.from(new Set([...decisionIdsA, ...decisionIdsB]));
        for (const decisionId of allDecisionIds) {
            const decA = decisionsA.decisions.find(d => d.id === decisionId);
            const decB = decisionsB.decisions.find(d => d.id === decisionId);
            if (!decA || !decB || JSON.stringify(decA) !== JSON.stringify(decB)) {
                decisionsChanged.push(decisionId);
            }
        }
        let costDelta = null;
        let timelineDelta = null;
        if (vA.selectedDecisions && vB.selectedDecisions) {
            const selectedA = vA.selectedDecisions;
            const selectedB = vB.selectedDecisions;
            let totalCostMinA = 0, totalCostMaxA = 0, totalTimelineA = 0;
            let totalCostMinB = 0, totalCostMaxB = 0, totalTimelineB = 0;
            for (const decision of decisionsA.decisions) {
                const selectedOptionId = selectedA[decision.id];
                const option = decision.options.find(o => o.id === selectedOptionId);
                if (option?.estimated_cost) {
                    totalCostMinA += option.estimated_cost.min;
                    totalCostMaxA += option.estimated_cost.max;
                }
                if (option?.estimated_timeline_months) {
                    totalTimelineA = Math.max(totalTimelineA, option.estimated_timeline_months);
                }
            }
            for (const decision of decisionsB.decisions) {
                const selectedOptionId = selectedB[decision.id];
                const option = decision.options.find(o => o.id === selectedOptionId);
                if (option?.estimated_cost) {
                    totalCostMinB += option.estimated_cost.min;
                    totalCostMaxB += option.estimated_cost.max;
                }
                if (option?.estimated_timeline_months) {
                    totalTimelineB = Math.max(totalTimelineB, option.estimated_timeline_months);
                }
            }
            costDelta = {
                min_delta: totalCostMinB - totalCostMinA,
                max_delta: totalCostMaxB - totalCostMaxA,
            };
            timelineDelta = totalTimelineB - totalTimelineA;
        }
        let recommendation = '';
        if (approachChanged || marketChanged) {
            recommendation = 'Significant strategic changes detected. Review alignment with business objectives.';
        }
        else if (decisionsChanged.length > 0) {
            recommendation = 'Minor decision changes. Review specific decision points that changed.';
        }
        else {
            recommendation = 'No significant differences between versions.';
        }
        return {
            version_a: versionA,
            version_b: versionB,
            differences: {
                approach_changed: approachChanged,
                market_changed: marketChanged,
                cost_delta: costDelta,
                timeline_delta_months: timelineDelta,
                decisions_changed: decisionsChanged,
            },
            recommendation,
        };
    }
    async listVersions(sessionId) {
        const versions = await this.storage.getStrategyVersionsBySession(sessionId);
        return versions.map(v => ({
            versionNumber: v.versionNumber,
            analysis: v.analysisData,
            decisions: v.decisionsData,
            selectedDecisions: v.selectedDecisions,
            programStructure: v.programStructure,
            status: v.status,
            createdBy: v.createdBy,
            createdAt: v.createdAt || undefined,
            finalizedAt: v.finalizedAt || undefined,
        }));
    }
    async getLatestVersion(sessionId) {
        const versions = await this.listVersions(sessionId);
        if (versions.length === 0)
            return null;
        return versions.sort((a, b) => b.versionNumber - a.versionNumber)[0];
    }
    async getFinalizedVersion(sessionId) {
        const versions = await this.listVersions(sessionId);
        const finalized = versions.find(v => v.status === 'finalized');
        return finalized || null;
    }
}
//# sourceMappingURL=version-manager.js.map