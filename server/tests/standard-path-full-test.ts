/**
 * Standard Path Full Integration Test
 * 
 * This script runs the EPM converter with fully-formed mock data
 * to generate actual console logs for evidence capture.
 */

import { EPMConverter } from '../strategic-consultant/epm-converter';

console.log('='.repeat(70));
console.log('STANDARD PATH FULL INTEGRATION TEST');
console.log('='.repeat(70));

// Create complete mock analysis data that passes validation
const mockAnalysis = {
  key_insights: [
    'Physical retail faces challenges but experiential shopping remains valued',
    'Omnichannel approach maximizes reach and customer engagement',
    'Local market knowledge and brand relationships are key differentiators'
  ],
  synthesized_context: 'Strategic initiative to launch premium sneaker retail operations in Abu Dhabi, targeting fashion-conscious consumers with blend of physical and digital engagement.',
  core_strategic_challenge: 'Establishing profitable sneaker retail presence in competitive UAE market while managing high operating costs and supply chain dependencies.',
  opportunities: [
    'Growing youth demographic in UAE with high disposable income',
    'Limited premium sneaker retail options in Abu Dhabi specifically',
    'Strong tourism creating additional customer base'
  ],
  threats: [
    'Competition from online retailers',
    'High real estate costs',
    'Brand exclusivity challenges'
  ],
  strategic_options: [
    {
      name: 'Premium Hybrid Retail Strategy',
      description: 'Combined physical flagship with strong digital presence'
    }
  ],
  porters_analysis: {
    competitive_rivalry: { intensity: 'High', insights: ['Many international brands present'] },
    supplier_power: { level: 'Medium', insights: ['Limited authorized distributors'] },
    buyer_power: { level: 'Medium', insights: ['Price-conscious but brand-loyal consumers'] },
    threat_of_substitutes: { level: 'Low', insights: ['Sneaker culture is distinct'] },
    threat_of_new_entrants: { level: 'Medium', insights: ['High capital requirements'] }
  }
};

const mockDecisions = {
  decisions: [
    {
      id: 'decision_1',
      title: 'Market Entry Approach',
      question: 'How should we enter the Abu Dhabi sneaker market?',
      options: [
        { id: 'opt1', label: 'Premium Hybrid Strategy', description: 'Physical + Digital' }
      ],
      workstreams: [
        { id: 'ws1', label: 'Store Location & Setup', cost_allocation: 35, team_size: 6 },
        { id: 'ws2', label: 'E-commerce Platform', cost_allocation: 20, team_size: 4 },
        { id: 'ws3', label: 'Brand Partnerships', cost_allocation: 15, team_size: 3 },
        { id: 'ws4', label: 'Marketing Launch', cost_allocation: 15, team_size: 4 },
        { id: 'ws5', label: 'Operations Setup', cost_allocation: 15, team_size: 5 }
      ],
      cost_estimate: {
        min: 500000,
        max: 800000,
        timeline_months: 12
      }
    }
  ]
};

const mockSelectedDecisions = {
  decision_1: 'Premium Hybrid Strategy'
};

async function runFullTest() {
  console.log('\n[Test] Initializing EPM Converter...\n');
  const epmConverter = new EPMConverter();
  
  console.log('[Test] Starting EPM conversion with standard path...\n');
  console.log('-'.repeat(70));
  
  try {
    const program = await epmConverter.convertToEPM(
      mockAnalysis as any,
      mockDecisions as any,
      mockSelectedDecisions
    );
    
    console.log('-'.repeat(70));
    console.log('\n[Test] EPM Conversion successful!\n');
    
    // Output key evidence data
    console.log('=== EVIDENCE: Program Output ===');
    console.log(`Program Title: ${program.title}`);
    console.log(`Workstreams: ${program.workstreams.length}`);
    
    console.log('\n=== EVIDENCE: ResourcePlan ===');
    if (program.resourcePlan) {
      console.log(`Total FTE: ${program.resourcePlan.summary.totalFte}`);
      console.log(`Total Headcount: ${program.resourcePlan.summary.totalHeadcount}`);
      console.log('Internal Team:');
      program.resourcePlan.internalTeam.forEach(m => {
        console.log(`  - ${m.role}: ${m.fte} FTE`);
      });
    }
    
    console.log('\n=== EVIDENCE: BenefitsRealization ===');
    if (program.benefitsRealization) {
      console.log(`Total Benefits: ${program.benefitsRealization.summary?.totalBenefits}`);
      console.log(`Categories: ${program.benefitsRealization.summary?.categories.join(', ')}`);
      program.benefitsRealization.benefits.forEach((b, i) => {
        console.log(`  ${i+1}. ${b.name} [${b.category}]`);
        console.log(`     Target: ${(b as any).target || b.measurable_target}`);
      });
    }
    
    console.log('\n=== EVIDENCE: Workstream Confidence Values ===');
    program.workstreams.forEach(ws => {
      console.log(`  ${ws.title}: ${ws.confidence?.toFixed(2) || 'N/A'}`);
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('FULL INTEGRATION TEST COMPLETE');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('\n[Test] EPM Conversion failed:', error);
  }
}

runFullTest().catch(console.error);
