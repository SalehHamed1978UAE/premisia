import { strategicUnderstandingService } from "./strategic-understanding-service";

async function testBMCIntegration() {
  console.log("=== TESTING BMC INTEGRATION WITH KNOWLEDGE GRAPH ===\n");

  const testInput = "We want to implement Asana for 25 employees. We're wasting 10 hours/week on manual status updates. Implementation should take 2-4 weeks. Investment is $500/month.";
  
  console.log("Test Input:");
  console.log(`"${testInput}"\n`);

  try {
    console.log("Step 1: Extracting understanding with user_input persistence...\n");
    
    const { understandingId, entities } = await strategicUnderstandingService.extractUnderstanding({
      sessionId: `test-bmc-${Date.now()}`,
      userInput: testInput,
    });

    console.log(`Understanding ID: ${understandingId}`);
    console.log(`Entities extracted: ${entities.length}\n`);

    console.log("=== VERIFICATION ===\n");

    // Query database to verify user entities were persisted
    const db = await import('./db');
    const { strategicEntities } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');

    const userEntities = await db.db
      .select()
      .from(strategicEntities)
      .where(eq(strategicEntities.understandingId, understandingId));

    console.log(`Total entities in database: ${userEntities.length}`);
    
    const userInputEntities = userEntities.filter(e => e.discoveredBy === 'user_input');
    const bmcEntities = userEntities.filter(e => e.discoveredBy === 'bmc_agent');
    const systemEntities = userEntities.filter(e => e.discoveredBy === 'system');

    console.log(`- User input entities (discovered_by='user_input'): ${userInputEntities.length}`);
    console.log(`- BMC agent entities (discovered_by='bmc_agent'): ${bmcEntities.length}`);
    console.log(`- System entities (discovered_by='system'): ${systemEntities.length}\n`);

    if (userInputEntities.length > 0) {
      console.log("✅ SUCCESS: User input entities persisted!");
      console.log("\nSample user entities:");
      userInputEntities.slice(0, 3).forEach((e, idx) => {
        console.log(`${idx + 1}. [${e.type}] ${e.claim}`);
        console.log(`   Source: "${e.source}"`);
        console.log(`   Confidence: ${e.confidence}`);
      });
    } else {
      console.error("❌ FAIL: No user input entities found!");
    }

    console.log("\n=== TEST SUMMARY ===");
    if (userInputEntities.length >= 3) {
      console.log("🎉 CRITICAL BUG FIXED!");
      console.log("- User entities are persisted with discovered_by='user_input'");
      console.log("- Ready for BMC integration test");
    } else {
      console.error("❌ TEST FAILED: Expected 3-6 user entities, got", userInputEntities.length);
    }

  } catch (error: any) {
    console.error("\n❌ TEST FAILED WITH ERROR:");
    console.error(error.message);
    console.error(error.stack);
  }
}

testBMCIntegration().catch(console.error);
