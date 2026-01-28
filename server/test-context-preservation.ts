/**
 * Test: Context Preservation in Query Generation
 * 
 * Verifies that BMCQueryGenerator preserves specific entities, numbers, and timelines
 * from user input instead of abstracting them away.
 * 
 * Example:
 * - Input: "Implement Asana for 25 employees in 2-4 weeks"
 * - Query should include: "Asana", "25 employees", "2-4 weeks"
 * - NOT: Generic "software implementation timelines"
 */

import { BMCQueryGenerator } from './strategic-consultant-legacy/bmc-query-generator';

async function testContextPreservation() {
  console.log('\n=== Testing Context Preservation in Query Generation ===\n');

  const generator = new BMCQueryGenerator();

  // Test case: Asana implementation with specific constraints
  const testInput = `
    We plan to implement Asana as our project management tool for our team of 25 employees.
    The rollout timeline is 2-4 weeks, and we have a budget of $50,000.
    We're based in San Francisco and need to train the engineering team first.
  `;

  console.log('Input:', testInput.trim());
  console.log('\n--- Generating queries for Key Activities block ---\n');

  try {
    const queries = await generator.generateQueriesForBlock('key_activities', testInput);

    console.log(`\n✓ Generated ${queries.length} queries\n`);

    // Check for context preservation
    const expectedEntities = [
      'Asana',
      '25',
      '2-4 weeks',
      '$50',
      'San Francisco'
    ];

    const allQueries = queries.map(q => q.query).join(' ').toLowerCase();

    console.log('=== Context Preservation Analysis ===\n');

    const results = {
      preserved: [] as string[],
      missing: [] as string[],
    };

    for (const entity of expectedEntities) {
      const found = allQueries.includes(entity.toLowerCase());
      if (found) {
        results.preserved.push(entity);
        console.log(`✓ PRESERVED: "${entity}" found in queries`);
      } else {
        results.missing.push(entity);
        console.log(`✗ MISSING: "${entity}" not found in queries`);
      }
    }

    console.log('\n=== Generated Queries ===\n');
    queries.forEach((q, i) => {
      console.log(`${i + 1}. [${q.type}] ${q.query}`);
      console.log(`   Purpose: ${q.purpose}\n`);
    });

    console.log('\n=== Summary ===');
    console.log(`Preserved: ${results.preserved.length}/${expectedEntities.length} entities`);
    console.log(`Missing: ${results.missing.length}/${expectedEntities.length} entities`);

    if (results.missing.length === 0) {
      console.log('\n✓ SUCCESS: All context preserved in queries');
    } else {
      console.log('\n✗ ISSUE: Some context lost during query generation');
      console.log('Missing entities:', results.missing.join(', '));
    }

  } catch (error) {
    console.error('Error generating queries:', error);
    throw error;
  }
}

// Run the test
testContextPreservation()
  .then(() => {
    console.log('\n=== Test Complete ===\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n=== Test Failed ===');
    console.error(error);
    process.exit(1);
  });
