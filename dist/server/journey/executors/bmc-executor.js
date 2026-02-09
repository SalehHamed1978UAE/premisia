import { BMCResearcher } from '../../strategic-consultant/bmc-researcher';
import { ReferenceService } from '../../services/reference-service';
import { db } from '../../db';
import { journeySessions } from '@shared/schema';
import { eq } from 'drizzle-orm';
/**
 * Business Model Canvas Framework Executor
 * Conducts comprehensive BMC research across all 9 building blocks
 */
export class BMCExecutor {
    name = 'bmc';
    researcher = new BMCResearcher();
    referenceService = new ReferenceService();
    async execute(context) {
        console.log('[BMC Executor] Starting Business Model Canvas research...');
        // Extract BMC constraints from context (if provided by Five Whys)
        const constraints = context.insights.bmcDesignConstraints;
        if (constraints) {
            console.log('[BMC Executor] Using Five Whys constraints:', {
                problems: constraints.problemsToSolve.length,
                capabilities: constraints.mustHaveCapabilities.length,
                principles: constraints.designPrinciples.length,
            });
        }
        // Conduct BMC research
        const bmcResults = await this.researcher.conductBMCResearch(context.userInput, context.sessionId);
        console.log(`[BMC Executor] Completed - generated ${Object.keys(bmcResults.blocks || {}).length} blocks`);
        // Persist references to database for provenance tracking
        if (bmcResults.references && bmcResults.references.length > 0) {
            console.log(`[BMC Executor] Persisting ${bmcResults.references.length} references to database...`);
            // Get userId from journey session
            const [session] = await db
                .select({ userId: journeySessions.userId })
                .from(journeySessions)
                .where(eq(journeySessions.id, context.sessionId))
                .limit(1);
            if (!session) {
                console.warn(`[BMC Executor] Could not find session ${context.sessionId}, skipping reference persistence`);
                return bmcResults;
            }
            const normalizedRefs = bmcResults.references.map(ref => this.referenceService.normalizeReference(ref, session.userId, { component: 'BMC', claim: ref.description }, {
                understandingId: context.understandingId,
                sessionId: context.sessionId,
            }));
            const result = await this.referenceService.persistReferences(normalizedRefs, {
                understandingId: context.understandingId,
                sessionId: context.sessionId,
            });
            console.log(`[BMC Executor] ✓ Persisted references: ${result.created.length} created, ${result.updated.length} updated, ${result.skipped} skipped`);
        }
        return bmcResults;
    }
}
//# sourceMappingURL=bmc-executor.js.map