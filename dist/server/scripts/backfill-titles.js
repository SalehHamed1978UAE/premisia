import { db } from '../db.js';
import { strategicUnderstanding } from '../../shared/schema.js';
import { generateTitle } from '../services/title-generator.js';
import { isNull, eq } from 'drizzle-orm';
/**
 * Backfill titles for all strategic statements that don't have one
 */
async function backfillTitles() {
    console.log('[BackfillTitles] Starting title generation for existing statements...');
    try {
        // Find all statements without titles
        const statements = await db
            .select({
            id: strategicUnderstanding.id,
            userInput: strategicUnderstanding.userInput,
        })
            .from(strategicUnderstanding)
            .where(isNull(strategicUnderstanding.title));
        console.log(`[BackfillTitles] Found ${statements.length} statements without titles`);
        let successCount = 0;
        let failCount = 0;
        for (const statement of statements) {
            try {
                console.log(`[BackfillTitles] Generating title for statement ${statement.id}...`);
                const title = await generateTitle(statement.userInput);
                // Update the statement with the generated title
                await db
                    .update(strategicUnderstanding)
                    .set({ title })
                    .where(eq(strategicUnderstanding.id, statement.id));
                console.log(`[BackfillTitles] ✓ Generated title: "${title}"`);
                successCount++;
                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            catch (error) {
                console.error(`[BackfillTitles] ✗ Failed to generate title for ${statement.id}:`, error);
                failCount++;
            }
        }
        console.log(`[BackfillTitles] Complete! Success: ${successCount}, Failed: ${failCount}`);
        process.exit(0);
    }
    catch (error) {
        console.error('[BackfillTitles] Fatal error:', error);
        process.exit(1);
    }
}
backfillTitles();
//# sourceMappingURL=backfill-titles.js.map