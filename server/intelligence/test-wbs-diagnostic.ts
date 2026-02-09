/**
 * Diagnostic test script for WBS Builder
 * 
 * Run with: npx tsx server/intelligence/test-wbs-diagnostic.ts
 * 
 * This script reproduces the WBS Builder failure with the Gaming Cafe session data
 * to capture the exact exception and stack trace.
 */

import { db } from '../db';
import { frameworkInsights } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { decryptJSONKMS } from '../utils/kms-encryption';
import { getAggregatedAnalysis } from './analysis-aggregator';
import { ContextBuilder } from './epm/context-builder';
import { createWBSBuilder } from '../../src/lib/intelligent-planning/wbs-builder';
import { OpenAIProvider } from '../../src/lib/intelligent-planning/llm-provider';

const SESSION_ID = 'ab28cdd6-df7b-4e26-a590-f10db973d54f';

async function runDiagnostic() {
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║ WBS BUILDER DIAGNOSTIC TEST                                                    ║');
  console.log('║ Session: ' + SESSION_ID + '                                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Step 1: Fetch raw framework insights from database
    console.log('═══ STEP 1: Fetching raw framework insights ═══');
    const rawInsights = await db.select()
      .from(frameworkInsights)
      .where(eq(frameworkInsights.understandingId, SESSION_ID));
    
    console.log(`Found ${rawInsights.length} framework insight(s)`);
    for (const insight of rawInsights) {
      console.log(`  - ${insight.frameworkName} (${insight.id})`);
    }
    console.log('');

    // Step 2: Decrypt and show insight structure
    console.log('═══ STEP 2: Decrypting insights ═══');
    for (const insight of rawInsights) {
      try {
        const decrypted = await decryptJSONKMS(insight.insights as string);
        const data = (decrypted as any)?.output || decrypted;
        console.log(`${insight.frameworkName} insight structure:`);
        console.log(`  - Type: ${typeof data}`);
        console.log(`  - Keys: ${Object.keys(data || {}).join(', ')}`);
        
        // Show sample data
        if (data?.strengths) {
          console.log(`  - Strengths count: ${data.strengths.length}`);
        }
        if (data?.opportunities) {
          console.log(`  - Opportunities count: ${data.opportunities.length}`);
        }
        if (data?.threats) {
          console.log(`  - Threats count: ${data.threats.length}`);
        }
        if (data?.weaknesses) {
          console.log(`  - Weaknesses count: ${data.weaknesses.length}`);
        }
      } catch (err: any) {
        console.error(`  Failed to decrypt: ${err.message}`);
      }
    }
    console.log('');

    // Step 3: Run analysis aggregator to normalize insights
    console.log('═══ STEP 3: Running Analysis Aggregator ═══');
    const aggregated = await getAggregatedAnalysis(SESSION_ID);
    
    if (!aggregated.insights) {
      console.error('No insights returned from aggregator!');
      return;
    }
    
    console.log(`Primary framework: ${aggregated.primaryFramework}`);
    console.log(`Available frameworks: ${aggregated.availableFrameworks.join(', ')}`);
    console.log(`Normalized insights count: ${aggregated.insights.insights.length}`);
    console.log('Insight types breakdown:');
    const typeCounts: Record<string, number> = {};
    for (const i of aggregated.insights.insights) {
      typeCounts[i.type] = (typeCounts[i.type] || 0) + 1;
    }
    for (const [type, count] of Object.entries(typeCounts)) {
      console.log(`  - ${type}: ${count}`);
    }
    console.log('');

    // Step 4: Build planning context
    console.log('═══ STEP 4: Building Planning Context ═══');
    const planningContext = await ContextBuilder.fromJourneyInsights(
      aggregated.insights,
      aggregated.insights.frameworkType || 'strategy_workspace',
      SESSION_ID
    );
    
    console.log('Planning context:');
    console.log(`  - Business name: ${planningContext.business.name}`);
    console.log(`  - Business type: ${planningContext.business.type}`);
    console.log(`  - Business scale: ${planningContext.business.scale}`);
    console.log(`  - Initiative type: ${planningContext.business.initiativeType}`);
    console.log(`  - Timeline: ${planningContext.execution.timeline.min}-${planningContext.execution.timeline.max} months`);
    console.log('');

    // Step 5: Run WBS Builder
    console.log('═══ STEP 5: Running WBS Builder ═══');
    console.log('(This is where we expect to see the failure)');
    console.log('');
    
    const llmProvider = new OpenAIProvider();
    const wbsBuilder = createWBSBuilder(llmProvider, (current, total, name) => {
      console.log(`  [Progress] Workstream ${current}/${total}: ${name}`);
    });
    
    const wbs = await wbsBuilder.buildWBS(aggregated.insights, planningContext);
    
    // If we get here, WBS succeeded!
    console.log('');
    console.log('═══ WBS BUILDER SUCCEEDED! ═══');
    console.log(`Generated ${wbs.workstreams.length} workstreams:`);
    for (const ws of wbs.workstreams) {
      console.log(`  - ${ws.name} (${ws.id})`);
      console.log(`    Deliverables: ${ws.deliverables.length}`);
      console.log(`    Dependencies: ${ws.dependencies.join(', ') || 'None'}`);
    }
    console.log(`Validation: ${wbs.validationReport.isValid ? 'PASSED' : 'FAILED'}`);
    console.log(`Confidence: ${(wbs.confidence * 100).toFixed(1)}%`);

  } catch (error: any) {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.error('║ DIAGNOSTIC CAPTURED FAILURE                                                    ║');
    console.error('╚════════════════════════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('Error message:', error.message);
    console.error('');
    console.error('Full stack trace:');
    console.error(error.stack);
  }

  // Clean exit
  process.exit(0);
}

runDiagnostic().catch(console.error);
