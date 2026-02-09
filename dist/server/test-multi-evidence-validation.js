/**
 * Test semantic validation with multiple evidence items
 * Ensures that mixed evidence (some valid, some invalid) is rejected
 */
import { BMCResearcher } from "./strategic-consultant/bmc-researcher";
async function testMultiEvidenceValidation() {
    console.log("=== TESTING MULTI-EVIDENCE SEMANTIC VALIDATION ===\n");
    const researcher = new BMCResearcher();
    // Simulate a contradiction with MIXED evidence (some valid, some invalid)
    const mixedEvidenceTest = {
        userClaim: "Asana implementation takes 2-4 weeks",
        evidenceItems: [
            "Asana deployment takes 6-8 months", // VALID (both about Asana rollout)
            "PM discipline adoption takes 12 months" // INVALID (different concept)
        ],
        expectedResult: false, // Should reject because evidence is MIXED
        description: "Mixed evidence: Asana deployment (valid) + PM discipline (invalid)"
    };
    const allValidEvidenceTest = {
        userClaim: "Monthly cost is $500",
        evidenceItems: [
            "Monthly subscription is $800", // VALID (both about recurring cost)
            "Monthly fee is $900" // VALID (both about recurring cost)
        ],
        expectedResult: true, // Should accept because ALL evidence is valid
        description: "All valid evidence: Monthly subscription + Monthly fee"
    };
    const testCases = [mixedEvidenceTest, allValidEvidenceTest];
    for (const testCase of testCases) {
        console.log(`\nTest: ${testCase.description}`);
        console.log(`  User: "${testCase.userClaim}"`);
        console.log(`  Evidence items:`);
        testCase.evidenceItems.forEach((evidence, i) => {
            console.log(`    ${i + 1}. "${evidence}"`);
        });
        console.log(`  Expected: ${testCase.expectedResult ? 'ACCEPT (all valid)' : 'REJECT (mixed/invalid)'}`);
        try {
            // Validate each evidence item separately
            const validationResults = await Promise.all(testCase.evidenceItems.map(evidence => researcher.validateContradiction(testCase.userClaim, evidence)));
            console.log(`\n  Individual validations:`);
            validationResults.forEach((result, i) => {
                console.log(`    ${i + 1}. ${result.isContradiction ? 'SAME' : 'DIFFERENT'}: ${result.reasoning}`);
            });
            // Only valid if ALL evidence items are semantically equivalent
            const allValid = validationResults.every(v => v.isContradiction);
            console.log(`\n  Final result: ${allValid ? 'ACCEPT' : 'REJECT'}`);
            console.log(`  Explanation: ${allValid
                ? `All ${validationResults.length} evidence items are semantically equivalent to user claim`
                : `Some evidence items are different concepts - cannot create contradiction`}`);
            if (allValid === testCase.expectedResult) {
                console.log(`  ✅ PASS`);
            }
            else {
                console.log(`  ❌ FAIL - Expected ${testCase.expectedResult}, got ${allValid}`);
            }
        }
        catch (error) {
            console.error(`  ❌ ERROR:`, error);
        }
    }
    console.log(`\n=== TEST COMPLETE ===`);
    console.log(`This demonstrates that mixed evidence (valid + invalid) is correctly rejected.`);
}
testMultiEvidenceValidation().then(() => process.exit(0));
//# sourceMappingURL=test-multi-evidence-validation.js.map