#!/usr/bin/env tsx

/**
 * Golden Record Compare CLI
 * 
 * Compares a journey session against the current golden record for regression testing.
 * 
 * Usage:
 *   npm run compare:golden -- --sessionId=<id> --journeyType=<type>
 *   npm run compare:golden -- --strategyVersionId=<id> --journeyType=<type>
 * 
 * Flags:
 *   --sessionId: Journey session ID to compare
 *   --strategyVersionId: Strategy version ID (alternative to sessionId)
 *   --journeyType: Journey type to compare against (required)
 * 
 * Exit Codes:
 *   0 - Journey matches golden record
 *   1 - Journey differs from golden record
 *   2 - Error occurred during comparison
 */

import {
  fetchJourneySessionData,
  fetchStrategyVersionData,
  sanitizeGoldenRecordData,
  generateDiffSummary,
} from '../server/utils/golden-records-service';
import { db } from '../server/db';
import { goldenRecords, goldenRecordChecks } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { JourneyType } from '@shared/journey-types';

// Parse command line arguments
const args = process.argv.slice(2);
const flags: Record<string, string | boolean> = {};

for (const arg of args) {
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    flags[key] = value || true;
  }
}

const sessionId = flags.sessionId as string | undefined;
const strategyVersionId = flags.strategyVersionId as string | undefined;
const journeyType = flags.journeyType as string | undefined;

/**
 * Main compare function
 */
async function compareGoldenRecord() {
  console.log('\n🔍 Golden Record Comparison Tool\n');
  console.log('='.repeat(80) + '\n');

  // Validate inputs
  if (!sessionId && !strategyVersionId) {
    console.error('❌ Error: Either --sessionId or --strategyVersionId is required');
    console.log('\nUsage:');
    console.log('  npm run compare:golden -- --sessionId=<id> --journeyType=<type>');
    console.log('  npm run compare:golden -- --strategyVersionId=<id> --journeyType=<type>');
    process.exit(2);
  }

  if (!journeyType) {
    console.error('❌ Error: --journeyType is required');
    console.log('\nAvailable journey types:');
    console.log('  - market_entry');
    console.log('  - business_model_innovation');
    console.log('  - competitive_strategy');
    console.log('  - digital_transformation');
    console.log('  - crisis_recovery');
    console.log('  - growth_strategy');
    process.exit(2);
  }

  try {
    // Step 1: Fetch current journey data
    console.log('📥 Fetching current journey data...');
    const currentRawData = sessionId
      ? await fetchJourneySessionData(sessionId)
      : await fetchStrategyVersionData(strategyVersionId!);

    if (!currentRawData) {
      console.error('❌ Error: Journey session or strategy version not found');
      process.exit(2);
    }

    console.log(`✓ Found journey: ${currentRawData.journeyType} (v${currentRawData.versionNumber})`);
    console.log(`  Session ID: ${currentRawData.sessionId}`);
    console.log(`  Steps: ${currentRawData.steps.length}`);
    console.log('');

    // Verify journey type matches
    if (currentRawData.journeyType !== journeyType) {
      console.error(`❌ Error: Journey type mismatch`);
      console.error(`  Expected: ${journeyType}`);
      console.error(`  Actual: ${currentRawData.journeyType}`);
      process.exit(2);
    }

    // Step 2: Sanitize current data
    console.log('🧹 Sanitizing current journey data...');
    const currentData = await sanitizeGoldenRecordData(currentRawData);
    console.log('✓ Data sanitized\n');

    // Step 3: Fetch current golden record
    console.log('📚 Fetching current golden record...');
    const [goldenRecord] = await db
      .select()
      .from(goldenRecords)
      .where(
        and(
          eq(goldenRecords.journeyType, journeyType as any),
          eq(goldenRecords.isCurrent, true)
        )
      )
      .limit(1);

    if (!goldenRecord) {
      console.error(`❌ Error: No current golden record found for journey type: ${journeyType}`);
      console.log('\n💡 Tip: Create a golden record first using:');
      console.log(`  npm run capture:golden -- --sessionId=${currentRawData.sessionId} --promote`);
      process.exit(2);
    }

    console.log(`✓ Found golden record: v${goldenRecord.version}`);
    console.log(`  Created: ${goldenRecord.createdAt.toISOString()}`);
    console.log(`  Created by: ${goldenRecord.createdBy}`);
    if (goldenRecord.notes) {
      console.log(`  Notes: ${goldenRecord.notes}`);
    }
    console.log('');

    // Step 4: Compare journey data
    console.log('⚖️  Comparing journeys...\n');
    
    const baselineData = {
      journeyType: goldenRecord.journeyType as JourneyType,
      sessionId: '',
      understandingId: '',
      versionNumber: goldenRecord.version,
      steps: goldenRecord.steps as any[],
      metadata: goldenRecord.metadata as any,
    };

    const diff = generateDiffSummary(baselineData, currentData);

    // Step 5: Print results
    console.log('='.repeat(80));
    console.log(diff.summary);
    console.log('='.repeat(80) + '\n');

    if (!diff.match) {
      if (diff.added.length > 0) {
        console.log('➕ Added Steps:');
        diff.added.forEach(step => console.log(`  - ${step}`));
        console.log('');
      }

      if (diff.removed.length > 0) {
        console.log('➖ Removed Steps:');
        diff.removed.forEach(step => console.log(`  - ${step}`));
        console.log('');
      }

      if (diff.modified.length > 0) {
        console.log('🔄 Modified Steps:');
        diff.modified.forEach(mod => {
          console.log(`  - ${mod.step}:`);
          mod.differences.forEach(d => console.log(`      ${d}`));
        });
        console.log('');
      }
    }

    // Step 6: Log check result to database
    console.log('💾 Logging check result...');
    
    const checkData = {
      goldenRecordId: goldenRecord.id,
      sessionId: currentData.sessionId,
      status: diff.match ? 'pass' : 'fail',
      diffSummary: {
        added: diff.added,
        removed: diff.removed,
        modified: diff.modified,
      },
      stepResults: currentData.steps.map((step, idx) => ({
        stepName: step.stepName,
        status: diff.modified.some(m => m.step === step.stepName) ? 'modified' : 'passed',
      })),
      exitCode: diff.match ? 0 : 1,
      executedBy: null, // CLI execution
    };

    const [checkRecord] = await db
      .insert(goldenRecordChecks)
      .values(checkData as any)
      .returning();

    console.log(`✓ Check logged: ${checkRecord.id}\n`);

    // Step 7: Print summary
    console.log('📊 Comparison Summary:');
    console.log(`  Golden Record: v${goldenRecord.version}`);
    console.log(`  Current Journey: v${currentData.versionNumber}`);
    console.log(`  Result: ${diff.match ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Check ID: ${checkRecord.id}`);
    console.log('');

    console.log('💡 Next steps:');
    if (!diff.match) {
      console.log('  - Review the differences above');
      console.log('  - If expected, capture as new golden record:');
      console.log(`    npm run capture:golden -- --sessionId=${currentData.sessionId} --promote`);
      console.log('  - View check history: /admin/golden-records/' + journeyType);
    } else {
      console.log('  ✓ Journey is consistent with golden record');
      console.log('  - View check history: /admin/golden-records/' + journeyType);
    }
    console.log('');

    // Exit with appropriate code
    process.exit(diff.match ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Error comparing golden record:', error);
    console.error((error as Error).stack);
    process.exit(2);
  }
}

// Run the comparison
compareGoldenRecord().catch(error => {
  console.error('Fatal error:', error);
  process.exit(2);
});
