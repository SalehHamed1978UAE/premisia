#!/usr/bin/env tsx

/**
 * Journey CLI Admin Tools
 * 
 * Commands:
 * - list: List all registered journeys
 * - summary <understandingId> <journeyType>: View summaries for a specific journey
 * - sessions <understandingId>: List all sessions for an understanding
 * - clear-summaries <understandingId>: Clear summaries for an understanding (dangerous)
 * 
 * Usage:
 * npm run journeys:list
 * npm run journeys:summary <understandingId> <journeyType>
 * npm run journeys:sessions <understandingId>
 * npm run journeys:clear-summaries <understandingId>
 */

import { JOURNEYS, getJourney, getAllJourneys } from '../server/journey/journey-registry';
import { journeySummaryService } from '../server/services/journey-summary-service';
import { db } from '../server/db';
import { journeySessions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { JourneyType, JourneySummary } from '../shared/journey-types';

const command = process.argv[2];
const args = process.argv.slice(3);

/**
 * List all registered journeys
 */
async function listJourneys() {
  console.log('\n📚 Registered Journeys\n');
  console.log('='.repeat(80) + '\n');

  const journeys = getAllJourneys();

  journeys.forEach((journey, index) => {
    const status = journey.available ? '✅ Available' : '⏸️  Not Implemented';
    
    console.log(`${index + 1}. ${journey.name} (${journey.type})`);
    console.log(`   Status: ${status}`);
    console.log(`   Duration: ${journey.estimatedDuration}`);
    console.log(`   Frameworks: ${journey.frameworks.join(' → ')}`);
    console.log(`   Summary Builder: ${journey.summaryBuilder}`);
    console.log(`   Readiness: ${journey.defaultReadiness.minReferences} refs, ${journey.defaultReadiness.minEntities} entities`);
    
    if (journey.dependencies && journey.dependencies.length > 0) {
      const deps = journey.dependencies.map(d => `${d.from}→${d.to}`).join(', ');
      console.log(`   Dependencies: ${deps}`);
    }
    
    console.log('');
  });

  console.log('='.repeat(80));
  console.log(`Total: ${journeys.length} journeys (${journeys.filter(j => j.available).length} available)\n`);
}

/**
 * View summary for a specific understanding and journey type
 */
async function viewSummary(understandingId: string, journeyType: string) {
  if (!understandingId) {
    console.error('❌ Error: understandingId is required');
    console.log('Usage: npm run journeys:summary <understandingId> <journeyType>');
    process.exit(1);
  }

  if (!journeyType) {
    console.error('❌ Error: journeyType is required');
    console.log('Usage: npm run journeys:summary <understandingId> <journeyType>');
    console.log('\nAvailable journey types:');
    Object.keys(JOURNEYS).forEach(type => console.log(`  - ${type}`));
    process.exit(1);
  }

  // Validate journey type
  if (!JOURNEYS[journeyType as JourneyType]) {
    console.error(`❌ Error: Invalid journey type '${journeyType}'`);
    console.log('\nAvailable journey types:');
    Object.keys(JOURNEYS).forEach(type => console.log(`  - ${type}`));
    process.exit(1);
  }

  console.log(`\n🔍 Fetching summary for understanding: ${understandingId}, journey: ${journeyType}\n`);

  const summary = await journeySummaryService.getLatestSummary(understandingId, journeyType as JourneyType);

  if (!summary) {
    console.log('⚠️  No summary found for this understanding and journey type.');
    console.log('\nPossible reasons:');
    console.log('  - No completed journey session exists');
    console.log('  - Understanding ID is incorrect');
    console.log('  - Journey has not been completed yet\n');
    process.exit(0);
  }

  // Display summary
  console.log('='.repeat(80));
  console.log(`📊 Journey Summary: ${summary.journeyType}`);
  console.log('='.repeat(80) + '\n');
  
  console.log(`Version: ${summary.versionNumber}`);
  console.log(`Completed: ${summary.completedAt}\n`);
  
  if (summary.keyInsights && summary.keyInsights.length > 0) {
    console.log('💡 Key Insights:\n');
    summary.keyInsights.forEach((insight, i) => {
      console.log(`  ${i + 1}. ${insight}`);
    });
    console.log('');
  }
  
  if (summary.strategicImplications && summary.strategicImplications.length > 0) {
    console.log('🎯 Strategic Implications:\n');
    summary.strategicImplications.forEach((impl, i) => {
      console.log(`  ${i + 1}. ${impl}`);
    });
    console.log('');
  }
  
  if (summary.frameworks) {
    console.log('🧩 Frameworks:\n');
    Object.entries(summary.frameworks).forEach(([name, data]) => {
      console.log(`  ${name}:`);
      console.log(`    ${JSON.stringify(data, null, 2).split('\n').join('\n    ')}`);
    });
    console.log('');
  }
  
  console.log('='.repeat(80) + '\n');
}

/**
 * List all sessions for an understanding
 */
async function listSessions(understandingId: string) {
  if (!understandingId) {
    console.error('❌ Error: understandingId is required');
    console.log('Usage: npm run journeys:sessions <understandingId>');
    process.exit(1);
  }

  console.log(`\n📋 Journey Sessions for understanding: ${understandingId}\n`);

  const sessions = await db
    .select()
    .from(journeySessions)
    .where(eq(journeySessions.understandingId, understandingId))
    .orderBy(journeySessions.versionNumber);

  if (sessions.length === 0) {
    console.log('⚠️  No sessions found for this understanding.\n');
    process.exit(0);
  }

  console.log('='.repeat(80) + '\n');

  sessions.forEach((session, index) => {
    console.log(`${index + 1}. Session ${session.id}`);
    console.log(`   Journey Type: ${session.journeyType}`);
    console.log(`   Version: ${session.versionNumber}`);
    console.log(`   Status: ${session.status}`);
    console.log(`   Created: ${session.createdAt}`);
    console.log(`   Updated: ${session.updatedAt}`);
    console.log(`   Has Summary: ${session.summary ? 'Yes ✅' : 'No ❌'}`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log(`Total: ${sessions.length} sessions\n`);
}

/**
 * Clear summaries for an understanding (dangerous operation)
 */
async function clearSummaries(understandingId: string) {
  if (!understandingId) {
    console.error('❌ Error: understandingId is required');
    console.log('Usage: npm run journeys:clear-summaries <understandingId>');
    process.exit(1);
  }

  console.log(`\n⚠️  WARNING: This will clear all summaries for understanding: ${understandingId}`);
  console.log('\nThis operation will:');
  console.log('  - Remove summary data from all journey sessions');
  console.log('  - Keep the session records (only clears summary field)');
  console.log('  - Cannot be undone\n');

  // In a real CLI, we'd prompt for confirmation here
  // For now, we'll just proceed with the operation
  console.log('Proceeding with summary clearing...\n');

  const result = await db
    .update(journeySessions)
    .set({ summary: null as any })
    .where(eq(journeySessions.understandingId, understandingId))
    .returning();

  console.log(`✅ Cleared summaries from ${result.length} sessions\n`);
}

/**
 * Show usage information
 */
function showUsage() {
  console.log('\n📖 Journey CLI Admin Tools\n');
  console.log('Commands:\n');
  console.log('  list                                     List all registered journeys');
  console.log('  summary <understandingId> <journeyType>  View summary for a journey');
  console.log('  sessions <understandingId>               List all sessions for an understanding');
  console.log('  clear-summaries <understandingId>        Clear summaries (dangerous)\n');
  console.log('Examples:\n');
  console.log('  npm run journeys:list');
  console.log('  npm run journeys:summary abc123 business_model_innovation');
  console.log('  npm run journeys:sessions abc123');
  console.log('  npm run journeys:clear-summaries abc123\n');
}

/**
 * Main CLI router
 */
async function main() {
  try {
    switch (command) {
      case 'list':
        await listJourneys();
        break;
      
      case 'summary':
        await viewSummary(args[0], args[1]);
        break;
      
      case 'sessions':
        await listSessions(args[0]);
        break;
      
      case 'clear-summaries':
        await clearSummaries(args[0]);
        break;
      
      case 'help':
      case '--help':
      case '-h':
        showUsage();
        break;
      
      default:
        console.error(`\n❌ Unknown command: ${command || '(none)'}\n`);
        showUsage();
        process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Error:', error instanceof Error ? error.message : String(error));
    console.error('\nStack trace:', error);
    process.exit(1);
  }
}

main();
