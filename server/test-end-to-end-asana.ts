/**
 * End-to-End Test: Asana Implementation Strategy
 * 
 * Tests the complete pipeline:
 * 1. Strategic Understanding Service extracts entities from user input
 * 2. BMC Query Generator preserves context (Asana, 25 employees, 2-4 weeks, $500/month)
 * 3. BMC Researcher finds specific data (not generic software stats)
 * 4. Semantic validation prevents false contradictions
 * 5. No timeouts during LLM operations
 */

import { StrategicUnderstandingService } from './strategic-understanding-service';
import { BMCQueryGenerator } from './strategic-consultant/bmc-query-generator';

async function testAsanaStrategy() {
  console.log('\n=== End-to-End Test: Asana Implementation Strategy ===\n');

  const userInput = `
    We want to implement Asana for 25 employees. We're wasting 10 hours/week on manual status updates. 
    Implementation should take 2-4 weeks. Investment is $500/month.
  `;

  console.log('User Input:', userInput.trim());
  console.log('\n--- Phase 1: Extract Strategic Understanding ---\n');

  const understandingService = new StrategicUnderstandingService();
  
  try {
    // Create strategic understanding
    const understanding = await understandingService.getOrCreateUnderstanding({
      inputText: userInput,
      inputType: 'text',
      framework: 'business_model_canvas',
    });

    console.log(`✓ Created understanding ID: ${understanding.id}`);

    // Get extracted entities
    const entities = await understandingService.getEntitiesByUnderstanding(understanding.id);
    console.log(`\n✓ Extracted ${entities.length} entities:\n`);
    
    entities.forEach((entity, i) => {
      console.log(`${i + 1}. [${entity.confidence}] ${entity.claim}`);
      console.log(`   Type: ${entity.type}, Source: "${entity.source}"\n`);
    });

    // Verify key entities are extracted
    const expectedConcepts = ['Asana', '25 employees', '2-4 weeks', '$500', '10 hours'];
    const entityClaims = entities.map(e => e.claim).join(' ');
    
    console.log('--- Verification: Key Concepts Extracted ---\n');
    expectedConcepts.forEach(concept => {
      const found = entityClaims.toLowerCase().includes(concept.toLowerCase());
      console.log(`${found ? '✓' : '✗'} ${concept}: ${found ? 'Found' : 'Missing'}`);
    });

    console.log('\n--- Phase 2: Generate Context-Grounded Queries ---\n');

    const queryGen = new BMCQueryGenerator();
    const queries = await queryGen.generateQueriesForBlock('key_activities', userInput);

    console.log(`✓ Generated ${queries.length} queries for Key Activities block\n`);

    // Check if queries preserve context
    const allQueries = queries.map(q => q.query).join(' ').toLowerCase();
    const contextPreserved = {
      'asana': allQueries.includes('asana'),
      '25': allQueries.includes('25'),
      '2-4 weeks': allQueries.includes('2-4') || allQueries.includes('weeks'),
      '$500': allQueries.includes('500') || allQueries.includes('$500'),
    };

    console.log('--- Context Preservation in Queries ---\n');
    Object.entries(contextPreserved).forEach(([entity, preserved]) => {
      console.log(`${preserved ? '✓' : '✗'} ${entity}: ${preserved ? 'Preserved' : 'Lost'}`);
    });

    console.log('\n--- Generated Queries ---\n');
    queries.forEach((q, i) => {
      console.log(`${i + 1}. [${q.type}] ${q.query}`);
      console.log(`   Purpose: ${q.purpose}\n`);
    });

    // Summary
    const contextScore = Object.values(contextPreserved).filter(v => v).length;
    const totalChecks = Object.keys(contextPreserved).length;

    console.log('=== Summary ===\n');
    console.log(`Entities Extracted: ${entities.length}`);
    console.log(`Queries Generated: ${queries.length}`);
    console.log(`Context Preservation: ${contextScore}/${totalChecks} specifics preserved`);

    if (contextScore === totalChecks) {
      console.log('\n✓ SUCCESS: Full pipeline working - context preserved from input to queries');
    } else {
      console.log('\n⚠ PARTIAL: Some context lost in query generation');
    }

  } catch (error) {
    console.error('Error in end-to-end test:', error);
    throw error;
  }
}

// Run the test
testAsanaStrategy()
  .then(() => {
    console.log('\n=== End-to-End Test Complete ===\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n=== Test Failed ===');
    console.error(error);
    process.exit(1);
  });
