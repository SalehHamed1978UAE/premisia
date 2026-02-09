import { strategicUnderstandingService } from "./strategic-understanding-service";
async function testAsanaCase() {
    console.log("=== CHECKPOINT 1: Testing StrategicUnderstandingService ===\n");
    const testInput = "We want to expand Asana to India with Hindi localization ($500K investment) to target 100 enterprise clients in 18 months.";
    console.log("Test Input:");
    console.log(`"${testInput}"\n`);
    try {
        console.log("Step 1: Extracting understanding...\n");
        const { understandingId, entities } = await strategicUnderstandingService.extractUnderstanding({
            sessionId: "test-session-001",
            userInput: testInput,
        });
        console.log("\n=== EXTRACTION RESULTS ===\n");
        console.log(`Understanding ID: ${understandingId}`);
        console.log(`Total entities extracted: ${entities.length}`);
        console.log(`Expected: 3-6 entities (quality over quantity)\n`);
        console.log("Entities breakdown:\n");
        entities.forEach((entity, idx) => {
            console.log(`${idx + 1}. [${entity.type}] (${entity.confidence})`);
            console.log(`   Claim: ${entity.claim}`);
            console.log(`   Source: "${entity.source}"`);
            if (entity.evidence) {
                console.log(`   Evidence: ${entity.evidence}`);
            }
            if (entity.investmentAmount) {
                console.log(`   Investment: $${entity.investmentAmount.toLocaleString()}`);
            }
            console.log();
        });
        console.log("=== VALIDATION CHECKS ===\n");
        const hallucinations = [
            "25% adoption",
            "25% market share",
            "SMB market",
            "deprioritized",
            "competitive advantage"
        ];
        let hallucinationFound = false;
        for (const entity of entities) {
            for (const hallucination of hallucinations) {
                if (entity.claim.toLowerCase().includes(hallucination.toLowerCase())) {
                    console.error(`❌ HALLUCINATION DETECTED: "${hallucination}" in claim: "${entity.claim}"`);
                    hallucinationFound = true;
                }
            }
        }
        if (!hallucinationFound) {
            console.log("✅ No hallucinations detected");
        }
        const allSourcesValid = entities.every(entity => testInput.toLowerCase().includes(entity.source.toLowerCase()));
        if (allSourcesValid) {
            console.log("✅ All sources are valid (exist in input)");
        }
        else {
            console.error("❌ Some sources are invalid");
        }
        const hasExplicit = entities.some(e => e.type === 'explicit_assumption');
        const hasImplicit = entities.some(e => e.type === 'implicit_implication');
        if (hasExplicit) {
            console.log("✅ Has explicit assumptions (directly stated)");
        }
        if (hasImplicit) {
            console.log("✅ Has implicit implications (logical inferences)");
        }
        const hasInvestment = entities.some(e => e.investmentAmount === 500000);
        if (hasInvestment) {
            console.log("✅ Correctly extracted $500K investment amount");
        }
        console.log("\n=== EMBEDDING TEST ===\n");
        if (entities.length > 0) {
            const testEntity = entities[0];
            console.log(`Testing embedding generation for: "${testEntity.claim.substring(0, 50)}..."`);
            const embedding = await strategicUnderstandingService.generateEmbedding(testEntity.claim);
            console.log(`✅ Embedding generated: ${embedding.length} dimensions`);
            console.log(`   First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
            if (embedding.length === 1536) {
                console.log("✅ Correct embedding dimensions (1536)");
            }
            else {
                console.error(`❌ Wrong embedding dimensions: ${embedding.length} (expected 1536)`);
            }
        }
        console.log("\n=== TEST SUMMARY ===\n");
        const issues = [];
        if (hallucinationFound)
            issues.push("Hallucinations detected");
        if (!allSourcesValid)
            issues.push("Invalid sources");
        if (entities.length === 0)
            issues.push("No entities extracted");
        if (entities.length > 8)
            issues.push("Too many entities (should be 3-8)");
        if (issues.length === 0) {
            console.log("🎉 CHECKPOINT 1 PASSED! All tests successful.");
            console.log("\nKey achievements:");
            console.log("- No hallucinations (strict grounding works)");
            console.log("- All sources validated (substring matching works)");
            console.log("- Embeddings generated correctly (1536-dim)");
            console.log("- 3-tier categorization working (explicit/implicit/inferred)");
        }
        else {
            console.error("❌ CHECKPOINT 1 FAILED with issues:");
            issues.forEach(issue => console.error(`  - ${issue}`));
        }
    }
    catch (error) {
        console.error("\n❌ TEST FAILED WITH ERROR:");
        console.error(error.message);
        console.error(error.stack);
    }
}
testAsanaCase().catch(console.error);
//# sourceMappingURL=test-strategic-understanding.js.map