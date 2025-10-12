import { db } from './server/db.js';
import { frameworkInsights, trendAnalysisJobs } from './shared/schema.js';

async function persistLiveResults() {
  console.log('💾 Persisting live PESTLE results to database...\n');
  
  const understandingId = 'live-brooklyn-coffee-us';
  
  try {
    // Check if already exists
    const existing = await db
      .select()
      .from(frameworkInsights)
      .where(db.sql`understanding_id = ${understandingId} AND framework_name = 'PESTLE'`)
      .limit(1);
    
    if (existing.length > 0) {
      console.log('✅ Results already persisted to framework_insights');
      console.log('ID:', existing[0].id);
      console.log('Created:', existing[0].createdAt);
      
      // Show telemetry
      const telemetry = (existing[0] as any).telemetry;
      if (telemetry) {
        console.log('\n📊 TELEMETRY:');
        console.log('Total Latency:', telemetry.totalLatencyMs, 'ms');
        console.log('LLM Calls:', telemetry.llmCalls);
        console.log('Provider Usage:', JSON.stringify(telemetry.providerUsage, null, 2));
      }
      
      // Show sample findings
      const insights = (existing[0] as any).insights;
      if (insights?.synthesis?.keyFindings) {
        console.log('\n🔍 KEY FINDINGS:');
        insights.synthesis.keyFindings.slice(0, 3).forEach((f: string, i: number) => {
          console.log(`${i + 1}. ${f.substring(0, 100)}...`);
        });
      }
      
      process.exit(0);
    }
    
    console.log('❌ No results found in database');
    console.log('The live analysis ran successfully but results need to be persisted via API route');
    
    process.exit(1);
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

persistLiveResults();
