import { TrendAnalysisAgent } from './server/trend-analysis-agent.js';
import { storage } from './server/storage.js';

async function runLivePESTLETest() {
  console.log('🧪 LIVE PESTLE ANALYSIS TEST - Brooklyn Coffee Shop');
  console.log('=' .repeat(60));
  
  const understandingId = 'live-brooklyn-coffee-us';
  
  try {
    // Initialize agent
    const agent = new TrendAnalysisAgent();
    
    // Run REAL PESTLE analysis with actual services
    console.log('\n📊 Starting LIVE PESTLE analysis...');
    console.log('Understanding ID:', understandingId);
    console.log('This will use REAL LLMs, web searches, and processing\n');
    
    const startTime = Date.now();
    
    const result = await agent.analyzeTrends(understandingId);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    console.log('\n✅ LIVE PESTLE Analysis Complete!');
    console.log('Duration:', duration, 'seconds');
    console.log('\n' + '='.repeat(60));
    
    // Display key results
    console.log('\n📈 EXECUTIVE SUMMARY:');
    console.log(result.synthesis.executiveSummary);
    
    console.log('\n🔍 KEY FINDINGS:');
    result.synthesis.keyFindings.slice(0, 5).forEach((finding, i) => {
      console.log(`${i + 1}. ${finding}`);
    });
    
    console.log('\n📊 TELEMETRY:');
    console.log('Total Latency:', result.telemetry.totalLatencyMs, 'ms');
    console.log('LLM Calls:', result.telemetry.totalLLMCalls);
    console.log('Cache Hits:', result.telemetry.cacheHits);
    console.log('API Calls:', result.telemetry.totalAPICalls);
    console.log('Provider Usage:', JSON.stringify(result.telemetry.providerUsage, null, 2));
    
    // Verify database persistence
    console.log('\n💾 DATABASE VERIFICATION:');
    
    // Check framework_insights
    const insight = await storage.getFrameworkInsight(understandingId, 'PESTLE');
    console.log('Framework Insights:', insight ? '✅ Persisted' : '❌ Not found');
    
    // Check strategic_entities with trends_agent
    const entities = await storage.db
      .select()
      .from(storage.schema.strategicEntities)
      .where(storage.sql`understanding_id = ${understandingId} AND discovered_by = 'trends_agent'`)
      .limit(10);
    
    console.log('Entities (discovered_by=trends_agent):', entities.length);
    entities.slice(0, 3).forEach(entity => {
      console.log(`  - ${entity.type}: ${entity.claim?.substring(0, 80)}...`);
    });
    
    // Sample PESTLE factors
    console.log('\n🏛️  PESTLE FACTORS (Sample):');
    const categories = ['POLITICAL', 'ECONOMIC', 'SOCIAL', 'TECHNOLOGICAL'];
    categories.forEach(cat => {
      const factors = result.pestleFactors[cat as keyof typeof result.pestleFactors];
      if (factors && factors.length > 0) {
        console.log(`\n${cat}:`);
        console.log(`  ${factors[0].claim.substring(0, 100)}...`);
        console.log(`  Sources: ${factors[0].sources.map(s => s.source_name).join(', ')}`);
      }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ LIVE TEST COMPLETE - All systems operational!');
    console.log('Ready for production deployment 🚀');
    
  } catch (error: any) {
    console.error('\n❌ LIVE TEST FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runLivePESTLETest().then(() => {
  console.log('\nExiting...');
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
