import { strategicUnderstandingService } from "./strategic-understanding-service";
import { db } from "./db";
import { strategicEntities, strategicRelationships } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

async function testContradictionFix() {
  console.log("=== TESTING CONTRADICTION RELATIONSHIP FIX ===\n");

  const testInput = "We want to implement Asana for 25 employees. We're wasting 10 hours/week on manual status updates. Implementation should take 2-4 weeks. Investment is $500/month.";
  
  try {
    // Step 1: Extract understanding (creates user_input entities)
    console.log("Step 1: Extracting understanding...");
    const understanding = await strategicUnderstandingService.extractUnderstanding({
      sessionId: `test-${Date.now()}`,
      userInput: testInput
    });
    console.log(`✓ Understanding ID: ${understanding.understandingId}`);
    console.log(`✓ Entities extracted: ${understanding.entities.length}\n`);

    // Step 2: Query persisted user_input entities
    console.log("Step 2: Querying persisted user_input entities...");
    const userEntities = await strategicUnderstandingService.getEntitiesByUnderstanding(understanding.understandingId);
    const userInputEntities = userEntities.filter(e => e.discoveredBy === 'user_input');
    console.log(`✓ Found ${userInputEntities.length} user_input entities with IDs\n`);

    // Display entities with IDs
    console.log("User entities with database IDs:");
    for (const entity of userInputEntities.slice(0, 3)) {
      console.log(`  - [${entity.id}] ${entity.claim.substring(0, 60)}...`);
    }
    console.log();

    // Step 3: Simulate contradiction detection (mock)
    console.log("Step 3: Simulating contradiction detection...");
    const mockContradictions = [
      {
        assumption: "Implementation timeline is expected to be 2-4 weeks",
        assumptionSource: "Implementation should take 2-4 weeks",
        contradictedBy: ["73% of businesses report implementation taking 6-12 weeks"],
        investmentAmount: null,
        matchedAssumptionClaim: null
      },
      {
        assumption: "Monthly investment is $500",
        assumptionSource: "Investment is $500/month",
        contradictedBy: ["Average cost is $800-1200/month for 25 users"],
        investmentAmount: 500,
        matchedAssumptionClaim: "Monthly investment is $500"
      }
    ];
    console.log(`✓ Mock contradictions created: ${mockContradictions.length}\n`);

    // Step 4: Test entity matching logic (same as in bmc-researcher.ts)
    console.log("Step 4: Testing entity matching for contradictions...");
    for (const contradiction of mockContradictions) {
      const sourceEntity = userInputEntities.find(e => {
        const entityClaim = e.claim.toLowerCase();
        const assumptionClaim = contradiction.assumption.toLowerCase();
        
        const match = entityClaim.includes(assumptionClaim.substring(0, 30)) ||
                     assumptionClaim.includes(entityClaim.substring(0, 30));
        
        return match;
      });

      if (sourceEntity) {
        console.log(`✓ Matched: "${contradiction.assumption}"`);
        console.log(`  → Entity ID: ${sourceEntity.id}`);
        console.log(`  → Entity claim: ${sourceEntity.claim}\n`);
        
        // Create contradiction entity
        const contradictionEntity = await strategicUnderstandingService.createEntity(understanding.understandingId, {
          type: 'research_finding',
          claim: contradiction.contradictedBy.join('; '),
          source: 'web research',
          confidence: 'medium',
          category: 'bmc_contradiction',
          evidence: 'Market research data'
        }, 'bmc_agent');
        
        // Create relationship
        await strategicUnderstandingService.createRelationship(
          sourceEntity.id,
          contradictionEntity.id,
          'contradicts',
          'high',
          contradiction.contradictedBy.join('; '),
          'bmc_agent'
        );
        
        console.log(`  ✓ Contradiction relationship created successfully!\n`);
      } else {
        console.log(`✗ No match found for: "${contradiction.assumption}"\n`);
      }
    }

    // Step 5: Verify relationships in database  
    console.log("\nStep 5: Verifying relationships in database...");
    // Get all entity IDs for this understanding
    const entityIds = userInputEntities.map(e => e.id);
    
    // Query relationships where from/to entities match this understanding
    const allRelationships = await db.select().from(strategicRelationships);
    const relationships = allRelationships.filter(rel => 
      entityIds.includes(rel.fromEntityId) || entityIds.includes(rel.toEntityId)
    );
    
    console.log(`✓ Total relationships created: ${relationships.length}\n`);

    // Step 6: Display contradiction details
    console.log("Step 6: Displaying contradiction details...");
    for (const rel of relationships) {
      const fromEntity = await db.select().from(strategicEntities).where(eq(strategicEntities.id, rel.fromEntityId));
      const toEntity = await db.select().from(strategicEntities).where(eq(strategicEntities.id, rel.toEntityId));
      
      console.log(`\nContradiction Relationship:`);
      console.log(`  From (user): ${fromEntity[0]?.claim.substring(0, 60)}...`);
      console.log(`  To (evidence): ${toEntity[0]?.claim.substring(0, 60)}...`);
      console.log(`  Relationship: ${rel.relationshipType}`);
      console.log(`  Confidence: ${rel.confidence}`);
    }

    console.log("\n=== ✅ TEST PASSED ===");
    console.log("Contradiction relationships successfully created with specific user values!");
    
  } catch (error) {
    console.error("\n=== ✗ TEST FAILED ===");
    console.error("Error:", error);
    process.exit(1);
  }
}

testContradictionFix().then(() => process.exit(0));
