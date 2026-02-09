/**
 * Test: Contradiction Persistence to Database
 *
 * Verifies that BMC contradictions are:
 * 1. Matched to user entities using concept extraction
 * 2. Validated semantically
 * 3. Persisted as relationships in strategic_relationships table
 */
import { StrategicUnderstandingService } from './strategic-understanding-service';
import { BMCResearcher } from './strategic-consultant/bmc-researcher';
import { db } from './db';
import { sql } from 'drizzle-orm';
async function testContradictionPersistence() {
    console.log('\n=== Testing Contradiction Persistence ===\n');
    const userInput = `
    We want to implement Asana for 25 employees. We're wasting 10 hours/week on manual status updates. 
    Implementation should take 2-4 weeks. Investment is $500/month.
  `;
    console.log('User Input:', userInput.trim());
    const understandingService = new StrategicUnderstandingService();
    const bmcResearcher = new BMCResearcher();
    try {
        // Step 1: Create understanding and extract entities
        console.log('\n--- Step 1: Extract Strategic Understanding ---\n');
        const understanding = await understandingService.getOrCreateUnderstanding({
            inputText: userInput,
            inputType: 'text',
            framework: 'business_model_canvas',
        });
        console.log(`✓ Understanding ID: ${understanding.id}`);
        const userEntities = await understandingService.getEntitiesByUnderstanding(understanding.id);
        const userInputEntities = userEntities.filter(e => e.discoveredBy === 'user_input');
        console.log(`✓ Extracted ${userInputEntities.length} user entities\n`);
        userInputEntities.forEach((e, i) => {
            console.log(`${i + 1}. [${e.type}] ${e.claim}`);
        });
        // Step 2: Run BMC research (this will compute and store contradictions)
        console.log('\n--- Step 2: Run BMC Research ---\n');
        const bmcResult = await bmcResearcher.researchBusinessModel(userInput, understanding.id);
        console.log(`✓ BMC Research Complete`);
        console.log(`  - Blocks: ${bmcResult.blocks.length}`);
        console.log(`  - Contradictions computed: ${bmcResult.contradictions.length}\n`);
        if (bmcResult.contradictions.length > 0) {
            console.log('Computed Contradictions:');
            bmcResult.contradictions.forEach((c, i) => {
                console.log(`${i + 1}. ${c.assumption}`);
                console.log(`   Contradicted by: ${c.contradictedBy.slice(0, 2).join('; ')}...`);
                console.log(`   Impact: ${c.impact}\n`);
            });
        }
        // Step 3: Verify contradictions are stored in database
        console.log('--- Step 3: Verify Database Storage ---\n');
        const storedContradictions = await db.execute(sql `
      SELECT 
        sr.relationship_type,
        e1.claim as user_claim,
        e2.claim as research_finding,
        sr.confidence,
        sr.evidence
      FROM strategic_relationships sr
      JOIN strategic_entities e1 ON sr.from_entity_id = e1.id
      JOIN strategic_entities e2 ON sr.to_entity_id = e2.id
      WHERE sr.relationship_type = 'contradicts'
      AND e1.understanding_id = ${understanding.id}
    `);
        console.log(`Database query result: ${storedContradictions.rows.length} contradiction relationships found\n`);
        if (storedContradictions.rows.length > 0) {
            console.log('✓ Stored Contradictions:');
            storedContradictions.rows.forEach((row, i) => {
                console.log(`\n${i + 1}. User Claim: "${row.user_claim}"`);
                console.log(`   Research Finding: "${row.research_finding}"`);
                console.log(`   Evidence: "${row.evidence}"`);
                console.log(`   Confidence: ${row.confidence}`);
            });
        }
        else {
            console.log('✗ NO CONTRADICTIONS STORED IN DATABASE');
            console.log('\nDiagnostic Info:');
            console.log(`- Contradictions computed by BMC: ${bmcResult.contradictions.length}`);
            console.log(`- User entities available: ${userInputEntities.length}`);
            console.log('\nPossible Issues:');
            console.log('1. Entity matching failed (check concept extraction logic)');
            console.log('2. Semantic validation rejected all contradictions');
            console.log('3. Error during relationship creation');
        }
        // Summary
        console.log('\n=== Summary ===\n');
        console.log(`Contradictions Computed: ${bmcResult.contradictions.length}`);
        console.log(`Contradictions Stored: ${storedContradictions.rows.length}`);
        if (bmcResult.contradictions.length > 0 && storedContradictions.rows.length === 0) {
            console.log('\n✗ BUG CONFIRMED: Contradictions computed but not persisted');
            process.exit(1);
        }
        else if (storedContradictions.rows.length > 0) {
            console.log('\n✓ SUCCESS: Contradictions properly persisted to database');
            process.exit(0);
        }
        else {
            console.log('\n⚠ No contradictions found in research (expected for valid strategy)');
            process.exit(0);
        }
    }
    catch (error) {
        console.error('\n=== Test Failed ===');
        console.error(error);
        process.exit(1);
    }
}
testContradictionPersistence();
//# sourceMappingURL=test-contradiction-persistence.js.map