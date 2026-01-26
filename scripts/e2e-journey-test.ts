#!/usr/bin/env npx ts-node
/**
 * E2E Journey Test
 *
 * This script tests the ACTUAL flow, not mocks.
 * Run: npx ts-node scripts/e2e-journey-test.ts
 *
 * EXIT CODE 0 = All tests passed
 * EXIT CODE 1 = Tests failed
 */

import { db } from '../server/db';
import { frameworkInsights, strategyVersions, journeySessions, epmPrograms } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           E2E JOURNEY TEST                                  ║');
  console.log('║           ' + new Date().toISOString() + '              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  // Get the most recent journey session
  const [latestSession] = await db.select()
    .from(journeySessions)
    .orderBy(desc(journeySessions.createdAt))
    .limit(1);

  if (!latestSession) {
    console.log('❌ No journey sessions found');
    process.exit(1);
  }

  const understandingId = latestSession.understandingId || latestSession.id;
  console.log(`Testing journey session: ${latestSession.id}`);
  console.log(`Understanding ID: ${understandingId}\n`);

  // TEST 1: Journey session exists
  console.log('TEST 1: Journey session exists');
  if (latestSession) {
    console.log(`  ✓ Session found: ${latestSession.id}`);
    console.log(`  ✓ Status: ${latestSession.status}`);
    console.log(`  ✓ Current framework index: ${latestSession.currentFrameworkIndex}`);
    console.log(`  ✓ Understanding ID: ${latestSession.understandingId}`);
    passed++;
  } else {
    console.log('  ✗ No session found');
    failed++;
  }

  // TEST 2: Framework insights exist (query by understandingId - the correct approach)
  console.log('\nTEST 2: Framework insights exist');
  const insights = await db.select()
    .from(frameworkInsights)
    .where(eq(frameworkInsights.understandingId, understandingId));

  if (insights.length > 0) {
    console.log(`  ✓ Found ${insights.length} framework insight(s):`);
    insights.forEach(i => console.log(`    - ${i.frameworkName} (id: ${i.id})`));
    passed++;
  } else {
    console.log('  ✗ No framework insights found');
    console.log(`    Query: SELECT * FROM framework_insights WHERE understanding_id = '${understandingId}'`);
    failed++;
  }

  // TEST 3: Strategy version exists
  console.log('\nTEST 3: Strategy version exists');
  const [version] = await db.select()
    .from(strategyVersions)
    .where(eq(strategyVersions.sessionId, understandingId))
    .limit(1);

  if (version) {
    console.log(`  ✓ Version found: ${version.id}`);
    console.log(`  ✓ Version number: ${version.versionNumber}`);
    console.log(`  ✓ Session ID: ${version.sessionId}`);
    passed++;
  } else {
    console.log('  ✗ No strategy version found');
    console.log(`    Query: SELECT * FROM strategy_versions WHERE session_id = '${understandingId}'`);
    failed++;
  }

  // TEST 4: EPM program exists (if journey completed)
  console.log('\nTEST 4: EPM program exists');
  if (version) {
    const [epm] = await db.select()
      .from(epmPrograms)
      .where(eq(epmPrograms.strategyVersionId, version.id))
      .limit(1);

    if (epm) {
      console.log(`  ✓ EPM program found: ${epm.id}`);
      console.log(`  ✓ Status: ${epm.status}`);
      console.log(`  ✓ Has workstreams: ${!!epm.workstreams}`);
      passed++;
    } else {
      console.log('  ⚠ No EPM program yet (may still be generating or user hasn\'t triggered it)');
      console.log(`    Query: SELECT * FROM epm_programs WHERE strategy_version_id = '${version.id}'`);
    }
  } else {
    console.log('  ⚠ Skipped (no version found)');
  }

  // TEST 5: Data consistency - verify all IDs link correctly
  console.log('\nTEST 5: Data consistency');
  const allIds = {
    journeySessionId: latestSession.id,
    understandingId: latestSession.understandingId,
    insightUnderstandingIds: insights.map(i => i.understandingId),
    insightSessionIds: insights.map(i => i.sessionId),
    versionSessionId: version?.sessionId,
  };

  // Check that all insight understandingIds match the journey's understandingId
  const insightUnderstandingMatch = insights.every(i => i.understandingId === understandingId);
  // Check that version sessionId matches the understandingId
  const versionMatch = !version || version.sessionId === understandingId;

  if (insightUnderstandingMatch && versionMatch) {
    console.log(`  ✓ All framework insights correctly linked to understandingId: ${understandingId}`);
    console.log(`  ✓ Strategy version correctly linked to understandingId: ${understandingId}`);
    passed++;
  } else {
    console.log('  ✗ INCONSISTENT IDs detected:');
    console.log(`    Journey understanding ID: ${understandingId}`);
    console.log(`    Insight understanding IDs: ${allIds.insightUnderstandingIds.join(', ')}`);
    console.log(`    Version session ID: ${allIds.versionSessionId}`);
    failed++;
  }

  // Summary
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('EXIT CODE: 1 (TESTS FAILED)');
    process.exit(1);
  } else {
    console.log('EXIT CODE: 0 (ALL TESTS PASSED)');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});
