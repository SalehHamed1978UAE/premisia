#!/usr/bin/env tsx

/**
 * Golden Record Capture CLI
 * 
 * Captures a journey session as a golden record for regression testing.
 * 
 * Usage:
 *   npm run capture:golden -- --sessionId=<id> [--flowVariant=strategic_consultant|strategies_hub] [--notes="Description"] [--promote] [--skipScreenshots]
 *   npm run capture:golden -- --strategyVersionId=<id> [--flowVariant=strategic_consultant|strategies_hub] [--notes="Description"] [--promote] [--skipScreenshots]
 * 
 * Flags:
 *   --sessionId: Journey session ID to capture
 *   --strategyVersionId: Strategy version ID (alternative to sessionId)
 *   --flowVariant: Flow type (strategic_consultant for v1 baseline, strategies_hub for follow-on). Auto-detected if not provided.
 *   --notes: Optional notes about this golden record
 *   --promote: Promote this version as the current golden record (default: false)
 *   --skipScreenshots: Skip screenshot capture (default: false)
 *   --sessionCookie: Admin session cookie for screenshot authentication (optional)
 * 
 * Environment:
 *   GOLDEN_RECORD_SCREENSHOT_DIR: Override screenshot output directory
 */

import {
  fetchJourneySessionData,
  fetchStrategyVersionData,
  sanitizeGoldenRecordData,
  saveGoldenRecordToFile,
  prepareGoldenRecordForAPI,
} from '../server/utils/golden-records-service.js';
import { screenshotCaptureService } from '../server/services/screenshot-capture-service.js';
import { db } from '../server/db.js';
import { goldenRecords } from '../shared/schema.js';
import { eq, and, desc } from 'drizzle-orm';

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
const flowVariant = flags.flowVariant as string | undefined;
const notes = flags.notes as string | undefined;
const promote = flags.promote === true || flags.promote === 'true';
const skipScreenshots = flags.skipScreenshots === true || flags.skipScreenshots === 'true';
const sessionCookie = flags.sessionCookie as string | undefined;

/**
 * Main capture function
 */
async function captureGoldenRecord() {
  console.log('\n📸 Golden Record Capture Tool\n');
  console.log('='.repeat(80) + '\n');

  // Validate inputs
  if (!sessionId && !strategyVersionId) {
    console.error('❌ Error: Either --sessionId or --strategyVersionId is required');
    console.log('\nUsage:');
    console.log('  npm run capture:golden -- --sessionId=<id> [--notes="..."] [--promote]');
    console.log('  npm run capture:golden -- --strategyVersionId=<id> [--notes="..."] [--promote]');
    process.exit(1);
  }

  if (sessionId && strategyVersionId) {
    console.error('❌ Error: Provide either --sessionId OR --strategyVersionId, not both');
    process.exit(1);
  }

  try {
    // Step 1: Fetch journey data
    console.log('📥 Fetching journey data...');
    const rawData = sessionId
      ? await fetchJourneySessionData(sessionId)
      : await fetchStrategyVersionData(strategyVersionId!);

    if (!rawData) {
      console.error('❌ Error: Journey session or strategy version not found');
      process.exit(1);
    }

    // Auto-detect flow variant if not provided based on presence of Five Whys step
    // strategic_consultant: Has Five Whys (5-step flow)
    // strategies_hub: No Five Whys (4-step flow, reuses baseline)
    const hasFiveWhys = rawData.steps.some(step => step.stepName === 'five_whys');
    const detectedFlowVariant = flowVariant || (hasFiveWhys ? 'strategic_consultant' : 'strategies_hub');
    
    console.log(`✓ Found journey: ${rawData.journeyType} (v${rawData.versionNumber})`);
    console.log(`  Session ID: ${rawData.sessionId}`);
    console.log(`  Understanding ID: ${rawData.understandingId}`);
    console.log(`  Flow Variant: ${detectedFlowVariant}`);
    console.log(`  Steps: ${rawData.steps.length}`);
    console.log('');

    // Step 2: Sanitize data
    console.log('🧹 Sanitizing sensitive data...');
    let sanitizedData = await sanitizeGoldenRecordData(rawData);
    console.log('✓ Data sanitized\n');

    // Step 3: Determine next version number for this flow variant
    console.log('🔍 Checking existing golden records...');
    const existingRecords = await db
      .select()
      .from(goldenRecords)
      .where(
        and(
          eq(goldenRecords.journeyType, rawData.journeyType as any),
          eq(goldenRecords.flowVariant, detectedFlowVariant)
        )
      )
      .orderBy(desc(goldenRecords.version));

    const maxVersion = existingRecords.length > 0 ? existingRecords[0].version : 0;
    const nextVersion = maxVersion + 1;
    
    console.log(`✓ Latest version for ${detectedFlowVariant}: v${maxVersion}`);
    console.log(`  New version: v${nextVersion}\n`);

    // Update sanitized data with the correct golden record version
    sanitizedData.versionNumber = nextVersion;

    // Step 4: Capture screenshots (AFTER determining version)
    if (!skipScreenshots) {
      try {
        const stepsWithScreenshots = await screenshotCaptureService.captureStepScreenshots({
          journeyType: rawData.journeyType,
          versionNumber: nextVersion,
          steps: sanitizedData.steps,
          adminSessionCookie: sessionCookie,
        });
        
        sanitizedData = {
          ...sanitizedData,
          steps: stepsWithScreenshots,
        };
      } catch (screenshotError) {
        console.warn('⚠️  Screenshot capture failed, continuing without screenshots:', screenshotError);
      }
    } else {
      console.log('⏭️  Skipping screenshot capture (--skipScreenshots flag set)\n');
    }

    // Step 5: Save to local file
    console.log('💾 Saving to local file system...');
    const filepath = await saveGoldenRecordToFile(sanitizedData, notes);
    console.log(`✓ Saved to: ${filepath}\n`);

    // Step 6: Save to database via direct insert (CLI has DB access)
    console.log('💾 Saving to database...');
    
    // Get user ID (in CLI context, query for first admin user)
    const { users } = await import('../shared/schema.js');
    const [adminUserRecord] = await db
      .select()
      .from(users)
      .where(eq(users.role, 'Admin'))
      .limit(1);
    
    if (!adminUserRecord) {
      console.error('❌ Error: No admin user found in database');
      process.exit(1);
    }
    
    const adminUser = adminUserRecord.id;
    
    const recordData = {
      journeyType: rawData.journeyType as any,
      flowVariant: detectedFlowVariant,
      version: nextVersion,
      parentVersion: maxVersion > 0 ? maxVersion : null,
      isCurrent: promote,
      metadata: sanitizedData.metadata,
      notes: notes || null,
      steps: sanitizedData.steps as any,
      createdBy: adminUser,
    };

    // If promoting, demote all other current records for this journey type + flow variant
    if (promote) {
      await db
        .update(goldenRecords)
        .set({ isCurrent: false })
        .where(
          and(
            eq(goldenRecords.journeyType, rawData.journeyType as any),
            eq(goldenRecords.flowVariant, detectedFlowVariant),
            eq(goldenRecords.isCurrent, true)
          )
        );
      console.log('  Demoted previous current version');
    }

    const [newRecord] = await db
      .insert(goldenRecords)
      .values(recordData)
      .returning();

    console.log(`✓ Saved to database: ${newRecord.id}\n`);

    // Step 7: Push to Knowledge Graph (optional, feature-flagged)
    console.log('📊 Pushing to Knowledge Graph...');
    const { pushGoldenRecordToKnowledgeGraph } = await import('../server/utils/golden-records-service.js');
    const kgResult = await pushGoldenRecordToKnowledgeGraph(sanitizedData);
    
    if (kgResult.success) {
      console.log('✓ Pushed to Knowledge Graph successfully\n');
    } else if (kgResult.error === 'Feature disabled' || kgResult.error === 'Neo4j not configured') {
      console.log(`⚠️  Knowledge Graph skipped: ${kgResult.error}\n`);
    } else {
      console.log(`⚠️  Knowledge Graph push failed: ${kgResult.error}\n`);
    }

    // Step 8: Print summary
    console.log('='.repeat(80));
    console.log('✅ Golden Record Captured Successfully\n');
    console.log(`  Journey Type: ${rawData.journeyType}`);
    console.log(`  Flow Variant: ${detectedFlowVariant}`);
    console.log(`  Version: v${nextVersion}`);
    console.log(`  Steps: ${rawData.steps.length}`);
    console.log(`  Promoted: ${promote ? 'Yes' : 'No'}`);
    if (notes) {
      console.log(`  Notes: ${notes}`);
    }
    console.log(`\n  Local File: ${filepath}`);
    console.log(`  Database ID: ${newRecord.id}`);
    console.log('='.repeat(80) + '\n');

    console.log('💡 Next steps:');
    console.log('  - View in admin UI: /admin/golden-records');
    console.log('  - Compare against new runs: npm run compare:golden -- --sessionId=<id> --journeyType=' + rawData.journeyType + ' --flowVariant=' + detectedFlowVariant);
    if (!promote) {
      console.log('  - Promote to current: POST /api/admin/golden-records/' + rawData.journeyType + '/' + detectedFlowVariant + '/' + nextVersion + '/promote');
    }
    console.log('');

  } catch (error) {
    console.error('\n❌ Error capturing golden record:', error);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

// Run the capture
captureGoldenRecord().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
