/**
 * Backfill script to sync existing BMI journey sessions to Neo4j Knowledge Graph
 * 
 * Usage: npx tsx scripts/backfill/graph-bmi.ts [--limit=N] [--dry-run]
 * 
 * This script:
 * - Queries database for all completed BMI journey sessions
 * - Retrieves journey metadata, strategic understanding, frameworks, decisions, and EPM
 * - Calls graph service functions to create nodes/relationships
 * - Tracks which sessions are already synced
 * - Batches operations to avoid driver timeouts
 * - Can be safely resumed if interrupted
 */

import { db } from '../../server/db.js';
import { journeySessions, strategicUnderstanding, strategyDecisions, epmPrograms, strategyVersions } from '../../shared/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { isKnowledgeGraphEnabled, isNeo4jConfigured } from '../../server/config.js';
import * as kgService from '../../server/services/knowledge-graph-service.js';

// Parse command-line arguments
const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const dryRun = args.includes('--dry-run');
const batchSize = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

// Statistics tracker
const stats = {
  total: 0,
  processed: 0,
  skipped: 0,
  alreadySynced: 0,
  errors: 0,
  startTime: Date.now(),
};

/**
 * Check if a journey session is already synced to Knowledge Graph
 */
async function isSessionSynced(sessionId: string): Promise<boolean> {
  try {
    const result = await kgService.checkJourneySessionExists(sessionId);
    return result;
  } catch (error) {
    console.error(`  ⚠️  Error checking sync status for ${sessionId}:`, (error as Error).message);
    return false; // Assume not synced if we can't check
  }
}

/**
 * Sync a single journey session to the Knowledge Graph
 */
async function syncJourneySession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`\n  📊 Processing session: ${sessionId}`);
    
    // 1. Get journey session
    const [session] = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.id, sessionId))
      .limit(1);
    
    if (!session) {
      return { success: false, error: 'Session not found' };
    }
    
    console.log(`    Journey Type: ${session.journeyType}, Status: ${session.status}`);
    
    // 2. Get strategic understanding (optional - may not exist)
    let understanding: any = null;
    if (session.understandingId) {
      const [result] = await db
        .select()
        .from(strategicUnderstanding)
        .where(eq(strategicUnderstanding.id, session.understandingId))
        .limit(1);
      understanding = result;
    }
    
    // 3. Get strategy versions for this session
    // Try journey session ID first (new flow), then understanding session ID (legacy flow)
    let versions = await db
      .select()
      .from(strategyVersions)
      .where(eq(strategyVersions.sessionId, sessionId));
    
    // Fallback to understanding session ID for legacy flows
    if (versions.length === 0 && understanding?.sessionId) {
      console.log(`    Trying legacy flow with understanding session ID: ${understanding.sessionId}`);
      versions = await db
        .select()
        .from(strategyVersions)
        .where(eq(strategyVersions.sessionId, understanding.sessionId));
    }
    
    if (versions.length === 0) {
      console.log(`    ⚠️  No strategy versions found, skipping`);
      return { success: false, error: 'No strategy versions' };
    }
    
    const versionIds = versions.map(v => v.id);
    
    // 4. Get decisions for all versions
    const decisions = await db
      .select()
      .from(strategyDecisions)
      .where(inArray(strategyDecisions.strategyVersionId, versionIds));
    
    // 5. Get EPM programs for all versions
    const programs = await db
      .select()
      .from(epmPrograms)
      .where(inArray(epmPrograms.strategyVersionId, versionIds));
    
    console.log(`    Found: ${versions.length} versions, ${decisions.length} decisions, ${programs.length} programs`);
    
    if (dryRun) {
      console.log(`    🏃 DRY RUN: Would sync to Knowledge Graph`);
      return { success: true };
    }
    
    // 6. Upsert Journey Session node
    console.log(`    Creating JourneySession node...`);
    const context = session.accumulatedContext as any;
    await kgService.upsertJourneySession({
      id: session.id,
      journeyType: session.journeyType,
      versionNumber: versions[0]?.versionNumber || 1,
      locationId: context?.locationId,
      jurisdictionId: context?.jurisdictionId,
      industryId: context?.industryId,
      createdAt: session.createdAt?.toISOString() || new Date().toISOString(),
    });
    
    // 7. Upsert Framework Outputs (Five Whys, BMC, etc.)
    const insights = context?.insights;
    if (insights) {
      console.log(`    Creating framework outputs...`);
      
      // Five Whys
      if (insights.rootCauses && insights.rootCauses.length > 0) {
        await kgService.upsertFrameworkOutput({
          id: `${session.id}-five-whys`,
          journeyId: session.id,
          stepId: 'five_whys',
          framework: 'five_whys',
          data: {
            rootCauses: insights.rootCauses,
            primaryRootCause: insights.primaryRootCause,
          },
          createdAt: session.createdAt?.toISOString() || new Date().toISOString(),
        });
      }
      
      // BMC (Business Model Canvas)
      if (insights.businessModel) {
        await kgService.upsertFrameworkOutput({
          id: `${session.id}-bmc`,
          journeyId: session.id,
          stepId: 'bmc',
          framework: 'bmc',
          data: insights.businessModel,
          createdAt: session.createdAt?.toISOString() || new Date().toISOString(),
        });
      }
    }
    
    // 8. Upsert Strategic Decisions as Decision nodes
    if (decisions.length > 0) {
      console.log(`    Creating ${decisions.length} decision records...`);
      for (const decision of decisions) {
        // Map strategy decisions to decision nodes
        const decisionId = `decision-${decision.id}`;
        const questions: string[] = [];
        const selectedOptions: string[] = [];
        
        if (decision.primaryCustomerSegment) {
          questions.push('Primary Customer Segment');
          selectedOptions.push(decision.primaryCustomerSegment);
        }
        if (decision.revenueModel) {
          questions.push('Revenue Model');
          selectedOptions.push(decision.revenueModel);
        }
        if (decision.partnershipStrategy) {
          questions.push('Partnership Strategy');
          selectedOptions.push(decision.partnershipStrategy);
        }
        
        if (questions.length > 0) {
          await kgService.upsertDecision({
            id: decisionId,
            journeyId: session.id,
            question: questions.join(', '),
            selectedOptionId: selectedOptions[0],
            createdAt: decision.createdAt?.toISOString() || new Date().toISOString(),
          });
        }
      }
    }
    
    // 9. Upsert EPM Programs
    if (programs.length > 0) {
      console.log(`    Creating ${programs.length} EPM programs...`);
      for (const program of programs) {
        await kgService.upsertProgram({
          id: program.id,
          journeyId: session.id,
          status: program.status,
          locationId: context?.locationId,
          createdAt: program.createdAt?.toISOString() || new Date().toISOString(),
        });
      }
    }
    
    // 10. Create evidence links if research citations exist
    const references = context?.references;
    if (references && Array.isArray(references) && references.length > 0) {
      console.log(`    Creating evidence links for ${references.length} citations...`);
      
      for (let i = 0; i < references.length; i++) {
        const ref = references[i];
        const evidenceId = `evidence-${session.id}-${i}`;
        
        await kgService.createEvidenceLinks(
          `decision-${session.id}`,
          [{
            id: evidenceId,
            snippet: ref.snippet || ref.title,
            sourceType: 'web',
            origin: ref.source || ref.url,
          }]
        );
      }
    }
    
    // 11. Link to incentives (if jurisdiction is known)
    const jurisdictionId = context?.jurisdictionId;
    if (jurisdictionId) {
      console.log(`    Linking to incentives for jurisdiction: ${jurisdictionId}...`);
      // Note: This would require querying available incentives first
      // For now, we'll skip this as it requires incentive IDs
      // await kgService.linkJourneyToIncentives(session.id, [incentiveIds]);
    }
    
    // 12. Link to regulations (if applicable)
    if (jurisdictionId && context?.industryId) {
      console.log(`    Linking to regulations...`);
      // Note: This would require querying available regulations first
      // For now, we'll skip this as it requires regulation IDs
      // await kgService.linkJourneyToRegulations(session.id, [regulationIds]);
    }
    
    console.log(`    ✅ Successfully synced session ${sessionId}`);
    return { success: true };
    
  } catch (error: any) {
    console.error(`    ❌ Error syncing session ${sessionId}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main backfill function
 */
async function backfillKnowledgeGraph() {
  console.log('='.repeat(80));
  console.log('📊 Knowledge Graph Backfill - BMI Journey Sessions');
  console.log('='.repeat(80));
  
  // Check feature flag and configuration
  if (!isKnowledgeGraphEnabled()) {
    console.error('\n❌ Knowledge Graph feature is disabled');
    console.log('   Set FEATURE_KNOWLEDGE_GRAPH=true to enable\n');
    process.exit(1);
  }
  
  if (!isNeo4jConfigured()) {
    console.error('\n❌ Neo4j is not configured');
    console.log('   Set NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD environment variables\n');
    process.exit(1);
  }
  
  console.log(`\n✓ Knowledge Graph enabled and configured`);
  if (dryRun) {
    console.log('🏃 DRY RUN MODE - No data will be written to Neo4j');
  }
  if (batchSize) {
    console.log(`📦 Batch size limit: ${batchSize} sessions`);
  }
  
  try {
    // Query all completed BMI journey sessions
    console.log('\n📋 Querying database for completed BMI journey sessions...\n');
    
    let query = db
      .select()
      .from(journeySessions)
      .where(
        and(
          eq(journeySessions.journeyType, 'business_model_innovation'),
          eq(journeySessions.status, 'completed')
        )
      )
      .orderBy(journeySessions.createdAt);
    
    if (batchSize) {
      query = query.limit(batchSize) as any;
    }
    
    const sessions = await query;
    stats.total = sessions.length;
    
    console.log(`Found ${stats.total} completed BMI journey sessions\n`);
    
    if (stats.total === 0) {
      console.log('No sessions to process. Exiting.\n');
      return;
    }
    
    // Process each session
    console.log('🔄 Processing sessions...\n');
    
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const progress = `[${i + 1}/${stats.total}]`;
      
      console.log(`${progress} Session: ${session.id}`);
      
      // Check if already synced
      if (!dryRun) {
        const alreadySynced = await isSessionSynced(session.id);
        if (alreadySynced) {
          console.log(`  ✓ Already synced, skipping`);
          stats.alreadySynced++;
          stats.skipped++;
          continue;
        }
      }
      
      // Sync the session
      const result = await syncJourneySession(session.id);
      
      if (result.success) {
        stats.processed++;
      } else {
        console.error(`  ❌ Failed: ${result.error}`);
        stats.errors++;
      }
      
      // Small delay to avoid overwhelming the database
      if (i < sessions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Print summary
    const duration = (Date.now() - stats.startTime) / 1000;
    console.log('\n' + '='.repeat(80));
    console.log('✅ Backfill Complete');
    console.log('='.repeat(80));
    console.log(`  Total sessions: ${stats.total}`);
    console.log(`  Processed: ${stats.processed}`);
    console.log(`  Already synced: ${stats.alreadySynced}`);
    console.log(`  Skipped: ${stats.skipped}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log(`  Duration: ${duration.toFixed(2)}s`);
    console.log('='.repeat(80) + '\n');
    
    if (stats.errors > 0) {
      console.log('⚠️  Some sessions failed to sync. Review the errors above.');
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('\n❌ Fatal error during backfill:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close Neo4j driver
    if (!dryRun) {
      await kgService.closeDriver();
      console.log('🔌 Neo4j driver closed\n');
    }
  }
}

// Run backfill
backfillKnowledgeGraph().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
