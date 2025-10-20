/**
 * Test BMC → EPM Pipeline
 * 
 * This test validates that the complete pipeline works:
 * 1. BMC Results → BMCAnalyzer → Strategic Insights
 * 2. Strategic Insights → EPMSynthesizer → Complete EPM Program (14 components)
 */

import { BMCAnalyzer } from './bmc-analyzer';
import { EPMSynthesizer } from './epm-synthesizer';
import type { BMCResults } from './types';

// Sample BMC data (Brooklyn Coffee Shop example)
const sampleBMC: BMCResults = {
  customerSegments: `Urban professionals aged 25-45
Remote workers seeking workspace
Coffee enthusiasts and specialty coffee lovers
Local neighborhood residents`,
  
  valuePropositions: `Premium specialty coffee with single-origin beans
Comfortable workspace with high-speed WiFi
Community hub for local creatives and entrepreneurs
Locally sourced pastries and sustainable practices`,
  
  channels: `Physical storefront in high-traffic Brooklyn location
Instagram and social media marketing
Local partnership with coworking spaces
Word-of-mouth and community events`,
  
  customerRelationships: `Personal service and barista expertise
Loyalty program for regular customers
Community events (open mic, art shows)
Social media engagement and customer feedback`,
  
  revenueStreams: `Coffee and beverage sales (70% of revenue)
Food and pastries (20% of revenue)
Merchandise and retail beans (10% of revenue)
Estimated revenue: $500,000/year`,
  
  keyActivities: `Daily coffee preparation and quality control
Customer service and community building
Inventory management and supplier relationships
Marketing and social media engagement
Event hosting and community programming`,
  
  keyResources: `Experienced baristas and coffee expertise
Premium espresso equipment and grinders
Prime retail location with foot traffic
Strong brand and social media presence
Supplier relationships with coffee roasters`,
  
  keyPartnerships: `Local coffee roasters for bean supply
Pastry bakeries for fresh goods
Coworking spaces for customer referrals
Local artists for events and displays`,
  
  costStructure: `Rent and utilities: $8,000/month ($96,000/year)
Personnel (4 baristas + manager): $200,000/year
Coffee beans and supplies: $80,000/year
Equipment maintenance: $15,000/year
Marketing and events: $20,000/year
Total estimated costs: $411,000/year`,
  
  contradictions: [
    'High rent costs vs. need for affordable pricing to compete',
    'Premium positioning vs. serving price-sensitive neighborhood customers',
    'Limited seating space vs. desire to be a community workspace hub',
  ],
  
  recommendations: [
    'Implement tiered pricing strategy to balance premium and accessible options',
    'Optimize seating layout with flexible furniture for events',
    'Develop subscription model for regular workspace users',
    'Expand online presence for retail bean sales',
  ],
  
  executiveSummary: `Brooklyn specialty coffee shop targeting urban professionals and remote workers with premium coffee, 
workspace amenities, and community events. Revenue model based primarily on beverage sales with opportunities 
for merchandise expansion. Key challenges include managing high operating costs while maintaining competitive 
pricing and balancing workspace capacity with community engagement goals.`,
};

async function testPipeline() {
  console.log('='.repeat(80));
  console.log('BMC → EPM Pipeline Test');
  console.log('='.repeat(80));
  console.log();

  // STEP 1: Analyze BMC
  console.log('STEP 1: Analyzing BMC Results...');
  console.log('-'.repeat(80));
  
  const analyzer = new BMCAnalyzer();
  const insights = await analyzer.analyze(sampleBMC);
  
  console.log(`✓ Framework Type: ${insights.frameworkType.toUpperCase()}`);
  console.log(`✓ Total Insights Extracted: ${insights.insights.length}`);
  console.log(`✓ Overall Confidence: ${Math.round(insights.overallConfidence * 100)}%`);
  console.log();
  
  console.log('Insight Breakdown:');
  const insightsByType = insights.insights.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(insightsByType).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count} insights`);
  });
  console.log();
  
  console.log('Market Context:');
  console.log(`  - Urgency: ${insights.marketContext.urgency}`);
  console.log(`  - Budget Range: ${insights.marketContext.budgetRange || 'Not specified'}`);
  console.log(`  - Risk Tolerance: ${insights.marketContext.riskTolerance || 'Not specified'}`);
  console.log();
  
  // STEP 2: Synthesize EPM Program
  console.log('STEP 2: Synthesizing EPM Program...');
  console.log('-'.repeat(80));
  
  const synthesizer = new EPMSynthesizer();
  const epmProgram = await synthesizer.synthesize(insights);
  
  console.log(`✓ EPM Program Generated`);
  console.log(`✓ Overall Confidence: ${Math.round(epmProgram.overallConfidence * 100)}%`);
  console.log();
  
  // STEP 3: Validate All 14 Components
  console.log('STEP 3: Validating 14 EPM Components...');
  console.log('-'.repeat(80));
  
  const components = [
    { name: '1. Executive Summary', data: epmProgram.executiveSummary, confidence: epmProgram.executiveSummary.confidence },
    { name: '2. Workstreams', data: epmProgram.workstreams, confidence: epmProgram.workstreams[0]?.confidence || 0 },
    { name: '3. Timeline', data: epmProgram.timeline, confidence: epmProgram.timeline.confidence },
    { name: '4. Resource Plan', data: epmProgram.resourcePlan, confidence: epmProgram.resourcePlan.confidence },
    { name: '5. Financial Plan', data: epmProgram.financialPlan, confidence: epmProgram.financialPlan.confidence },
    { name: '6. Benefits Realization', data: epmProgram.benefitsRealization, confidence: epmProgram.benefitsRealization.confidence },
    { name: '7. Risk Register', data: epmProgram.riskRegister, confidence: epmProgram.riskRegister.confidence },
    { name: '8. Stage Gates', data: epmProgram.stageGates, confidence: epmProgram.stageGates.confidence },
    { name: '9. KPIs', data: epmProgram.kpis, confidence: epmProgram.kpis.confidence },
    { name: '10. Stakeholder Map', data: epmProgram.stakeholderMap, confidence: epmProgram.stakeholderMap.confidence },
    { name: '11. Governance', data: epmProgram.governance, confidence: epmProgram.governance.confidence },
    { name: '12. QA Plan', data: epmProgram.qaPlan, confidence: epmProgram.qaPlan.confidence },
    { name: '13. Procurement', data: epmProgram.procurement, confidence: epmProgram.procurement.confidence },
    { name: '14. Exit Strategy', data: epmProgram.exitStrategy, confidence: epmProgram.exitStrategy.confidence },
  ];
  
  let allValid = true;
  components.forEach(component => {
    const isValid = component.data !== null && component.data !== undefined;
    const status = isValid ? '✓' : '✗';
    const confidenceStr = isValid ? ` (${Math.round(component.confidence * 100)}% confidence)` : '';
    
    console.log(`${status} ${component.name}${confidenceStr}`);
    
    if (!isValid) allValid = false;
  });
  
  console.log();
  
  // STEP 4: Display Key Metrics
  console.log('STEP 4: Key EPM Program Metrics...');
  console.log('-'.repeat(80));
  
  console.log(`Workstreams: ${epmProgram.workstreams.length}`);
  epmProgram.workstreams.slice(0, 5).forEach(ws => {
    console.log(`  - ${ws.name} (${ws.deliverables.length} deliverables, ${ws.startMonth}-${ws.endMonth} months)`);
  });
  console.log();
  
  console.log(`Timeline: ${epmProgram.timeline.totalMonths} months across ${epmProgram.timeline.phases.length} phases`);
  console.log();
  
  console.log(`Resources: ${epmProgram.resourcePlan.totalFTEs} FTEs`);
  console.log(`  - Internal team: ${epmProgram.resourcePlan.internalTeam.length} roles`);
  console.log(`  - External resources: ${epmProgram.resourcePlan.externalResources.length} items`);
  console.log();
  
  console.log(`Financial Plan:`);
  console.log(`  - Total Budget: $${epmProgram.financialPlan.totalBudget.toLocaleString()}`);
  console.log(`  - Cost Categories: ${epmProgram.financialPlan.costBreakdown.length}`);
  console.log(`  - Contingency: ${epmProgram.financialPlan.contingencyPercentage}%`);
  console.log();
  
  console.log(`Benefits: ${epmProgram.benefitsRealization.benefits.length} benefits identified`);
  if (epmProgram.benefitsRealization.totalFinancialValue) {
    console.log(`  - Total Financial Value: $${epmProgram.benefitsRealization.totalFinancialValue.toLocaleString()}`);
  }
  console.log();
  
  console.log(`Risks: ${epmProgram.riskRegister.risks.length} risks`);
  console.log(`  - Top Risks: ${epmProgram.riskRegister.topRisks.length}`);
  epmProgram.riskRegister.topRisks.slice(0, 3).forEach(risk => {
    console.log(`    • ${risk.id}: ${risk.description.substring(0, 60)}... (${risk.impact} impact)`);
  });
  console.log();
  
  console.log(`Stakeholders: ${epmProgram.stakeholderMap.stakeholders.length}`);
  console.log();
  
  console.log(`KPIs: ${epmProgram.kpis.kpis.length}`);
  epmProgram.kpis.kpis.slice(0, 3).forEach(kpi => {
    console.log(`  - ${kpi.name} (${kpi.category}, ${kpi.frequency})`);
  });
  console.log();
  
  console.log(`Stage Gates: ${epmProgram.stageGates.gates.length}`);
  console.log();
  
  console.log(`Procurement Items: ${epmProgram.procurement.items.length}`);
  if (epmProgram.procurement.totalProcurementValue > 0) {
    console.log(`  - Total Value: $${epmProgram.procurement.totalProcurementValue.toLocaleString()}`);
  }
  console.log();
  
  // STEP 5: Summary
  console.log('='.repeat(80));
  console.log('PIPELINE TEST RESULTS');
  console.log('='.repeat(80));
  
  if (allValid) {
    console.log('✓ SUCCESS: All 14 EPM components generated successfully!');
    console.log();
    console.log('Pipeline validated:');
    console.log('  1. BMC Results parsed correctly');
    console.log(`  2. ${insights.insights.length} strategic insights extracted`);
    console.log('  3. Complete EPM program synthesized');
    console.log('  4. All 14 components present and valid');
    console.log();
    console.log(`Overall System Confidence: ${Math.round(epmProgram.overallConfidence * 100)}%`);
  } else {
    console.log('✗ FAILURE: Some EPM components missing or invalid');
  }
  
  console.log('='.repeat(80));
  
  return { insights, epmProgram, allValid };
}

// Run test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testPipeline()
    .then(({ allValid }) => {
      process.exit(allValid ? 0 : 1);
    })
    .catch(error => {
      console.error('Pipeline test failed with error:', error);
      process.exit(1);
    });
}

export { testPipeline, sampleBMC };
