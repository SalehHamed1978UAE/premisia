/**
 * Test semantic validation to prevent false contradictions
 * Example: "PM software" vs "PM discipline" should NOT be a contradiction
 */
import { BMCResearcher } from "./strategic-consultant/bmc-researcher";
async function testSemanticValidation() {
    console.log("=== TESTING SEMANTIC VALIDATION ===\n");
    const researcher = new BMCResearcher();
    // Test cases: Should these be contradictions?
    const testCases = [
        {
            userClaim: "PM software implementation takes 2-4 weeks",
            researchFinding: "PM discipline adoption takes 6-12 months",
            expectedResult: false, // DIFFERENT concepts (software vs discipline)
            description: "PM software vs PM discipline"
        },
        {
            userClaim: "Asana deployment takes 2 weeks",
            researchFinding: "Asana implementation takes 6-8 months",
            expectedResult: true, // SAME concept (both about Asana rollout)
            description: "Asana deployment vs Asana implementation"
        },
        {
            userClaim: "Hiring engineers costs $500/month",
            researchFinding: "Hiring process costs $1000 per candidate",
            expectedResult: false, // DIFFERENT (salaries vs recruitment fees)
            description: "Hiring engineers vs hiring process"
        },
        {
            userClaim: "India market entry is planned",
            researchFinding: "India market research shows challenges",
            expectedResult: false, // DIFFERENT (entering vs researching)
            description: "Market entry vs market research"
        },
        {
            userClaim: "Monthly subscription is $500",
            researchFinding: "Monthly cost is $800 for similar tools",
            expectedResult: true, // SAME concept (recurring cost)
            description: "Monthly subscription vs monthly cost"
        }
    ];
    let passCount = 0;
    let failCount = 0;
    for (const testCase of testCases) {
        console.log(`\nTest: ${testCase.description}`);
        console.log(`  User: "${testCase.userClaim}"`);
        console.log(`  Research: "${testCase.researchFinding}"`);
        console.log(`  Expected: ${testCase.expectedResult ? 'SAME CONCEPT (contradiction)' : 'DIFFERENT CONCEPTS (not a contradiction)'}`);
        try {
            // Call the private method via type casting
            const result = await researcher.validateContradiction(testCase.userClaim, testCase.researchFinding);
            console.log(`  Result: ${result.isContradiction ? 'SAME CONCEPT' : 'DIFFERENT CONCEPTS'}`);
            console.log(`  Reasoning: ${result.reasoning}`);
            console.log(`  Provider: ${result.provider}`);
            if (result.isContradiction === testCase.expectedResult) {
                console.log(`  ✅ PASS`);
                passCount++;
            }
            else {
                console.log(`  ❌ FAIL - Expected ${testCase.expectedResult}, got ${result.isContradiction}`);
                failCount++;
            }
        }
        catch (error) {
            console.error(`  ❌ ERROR:`, error);
            failCount++;
        }
    }
    console.log(`\n=== TEST SUMMARY ===`);
    console.log(`✅ Passed: ${passCount}/${testCases.length}`);
    console.log(`❌ Failed: ${failCount}/${testCases.length}`);
    if (failCount === 0) {
        console.log(`\n🎉 All tests passed! Semantic validation working correctly.`);
    }
    else {
        console.log(`\n⚠️  Some tests failed. Review validation logic.`);
        process.exit(1);
    }
}
testSemanticValidation().then(() => process.exit(0));
//# sourceMappingURL=test-semantic-validation.js.map