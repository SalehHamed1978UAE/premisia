/**
 * Test All Framework Analyzers
 *
 * Comprehensive test suite for BMC, Porter's, and PESTLE analyzers
 */
import { BMCAnalyzer } from './bmc-analyzer';
import { PortersAnalyzer } from './porters-analyzer';
import { PESTLEAnalyzer } from './pestle-analyzer';
import { EPMSynthesizer } from './epm-synthesizer';
// ============================================================================
// Sample Data
// ============================================================================
const sampleBMC = {
    customerSegments: 'Urban professionals aged 25-45\nRemote workers seeking workspace',
    valuePropositions: 'Premium specialty coffee\nComfortable workspace with WiFi',
    channels: 'Physical storefront\nSocial media marketing',
    customerRelationships: 'Personal service\nLoyalty program',
    revenueStreams: 'Coffee sales (70%)\nFood sales (20%)\nMerchandise (10%)',
    keyActivities: 'Coffee preparation\nCustomer service\nInventory management',
    keyResources: 'Baristas\nEspresso equipment\nPrime location',
    keyPartnerships: 'Coffee roasters\nPastry suppliers',
    costStructure: 'Rent: $96k/yr\nPersonnel: $200k/yr\nSupplies: $80k/yr',
    contradictions: ['High rent vs. affordable pricing', 'Limited space vs. workspace demand'],
    recommendations: ['Tiered pricing', 'Optimize layout'],
    executiveSummary: 'Brooklyn specialty coffee shop with workspace focus',
};
const samplePorters = {
    threatOfNewEntrants: {
        score: 6,
        analysis: 'Moderate barriers to entry in coffee shop market',
        barriers: ['Brand loyalty', 'Prime location scarcity', 'Capital requirements'],
        risks: ['New coffee chains entering market', 'Increasing competition from coworking spaces'],
    },
    bargainingPowerOfSuppliers: {
        score: 5,
        analysis: 'Moderate supplier power from specialty coffee roasters',
        mitigations: ['Multi-source beans', 'Long-term contracts'],
    },
    bargainingPowerOfBuyers: {
        score: 7,
        analysis: 'High buyer power due to many alternatives',
        risks: ['Price sensitivity', 'Easy switching to competitors'],
    },
    threatOfSubstitutes: {
        score: 7,
        analysis: 'High threat from various coffee alternatives',
        substitutes: ['Home brewing', 'Office coffee', 'Tea shops', 'Energy drinks'],
    },
    competitiveRivalry: {
        score: 8,
        analysis: 'Intense competition in Brooklyn coffee market',
        competitors: ['Starbucks', 'Local chains', 'Independent cafes'],
        strategies: ['Differentiate through quality', 'Build community', 'Loyalty programs'],
    },
    overallAttractiveness: {
        score: 5,
        summary: 'Moderately attractive market with high competition',
        recommendations: ['Focus on differentiation', 'Build strong community', 'Leverage location'],
    },
    strategicImplications: [
        'Must differentiate to combat high rivalry',
        'Community building critical for retention',
        'Quality focus to justify premium pricing',
    ],
};
const samplePESTLE = {
    political: {
        trends: [
            { description: 'Small business support policies', strength: 6, timeframe: '2024-2026', source: 'NYC Economic Development' },
        ],
        risks: [
            { description: 'Changing minimum wage regulations', probability: 0.7, impact: 'Medium' },
        ],
        opportunities: [
            { description: 'Tax incentives for sustainable businesses', potential: 'High', requirements: ['ESG certification', 'Green practices'] },
        ],
    },
    economic: {
        trends: [
            { description: 'Post-pandemic economic recovery', strength: 7, timeframe: '2024-2025', source: 'Federal Reserve' },
            { description: 'Inflation pressures on operating costs', strength: 8, timeframe: 'Current', source: 'BLS' },
        ],
        risks: [
            { description: 'Rising labor and supply costs', probability: 0.8, impact: 'High' },
        ],
        opportunities: [
            { description: 'Growing premium coffee market', potential: 'High', requirements: ['Quality focus', 'Brand positioning'] },
        ],
    },
    social: {
        trends: [
            { description: 'Remote work adoption creating workspace demand', strength: 9, timeframe: '2023-2027', source: 'McKinsey' },
            { description: 'Health and wellness focus', strength: 7, timeframe: 'Current', source: 'Consumer surveys' },
        ],
        risks: [
            { description: 'Changing consumer preferences', probability: 0.5, impact: 'Medium' },
        ],
        opportunities: [
            { description: 'Community-focused businesses gaining traction', potential: 'High', requirements: ['Event hosting', 'Local partnerships'] },
        ],
    },
    technological: {
        trends: [
            { description: 'Digital payment adoption', strength: 9, timeframe: 'Current', source: 'Industry data' },
            { description: 'Coffee technology advancements', strength: 6, timeframe: '2024-2026', source: 'Industry reports' },
        ],
        risks: [
            { description: 'Need to keep up with POS technology', probability: 0.6, impact: 'Low' },
        ],
        opportunities: [
            { description: 'Mobile ordering and loyalty apps', potential: 'Medium', requirements: ['App development', 'Integration'] },
        ],
    },
    legal: {
        trends: [
            { description: 'Food safety regulations', strength: 7, timeframe: 'Ongoing', source: 'NYC Health Dept' },
        ],
        risks: [
            { description: 'Compliance violations and fines', probability: 0.3, impact: 'Medium' },
        ],
        opportunities: [],
    },
    environmental: {
        trends: [
            { description: 'Sustainability expectations from consumers', strength: 8, timeframe: 'Current', source: 'Consumer surveys' },
            { description: 'Single-use plastic bans', strength: 7, timeframe: '2024-2025', source: 'NYC legislation' },
        ],
        risks: [
            { description: 'Regulatory changes on packaging', probability: 0.7, impact: 'Medium' },
        ],
        opportunities: [
            { description: 'Sustainable coffee sourcing and practices', potential: 'High', requirements: ['Sustainable suppliers', 'Composting', 'Reusable cups'] },
        ],
    },
    crossFactorInsights: {
        synergies: [
            'Remote work (social) + workspace demand creates opportunity for premium positioning',
            'Sustainability (environmental) + consumer preferences (social) support green practices',
        ],
        conflicts: [
            'Rising costs (economic) vs. price sensitivity (competitive)',
            'Technology investment needs vs. tight margins',
        ],
    },
    strategicRecommendations: [
        'Leverage remote work trend for workspace positioning',
        'Invest in sustainability for competitive advantage',
        'Implement technology for operational efficiency',
    ],
};
// ============================================================================
// Test Functions
// ============================================================================
async function testBMCAnalyzer() {
    console.log('\n' + '='.repeat(80));
    console.log('BMC ANALYZER TEST');
    console.log('='.repeat(80));
    const analyzer = new BMCAnalyzer();
    const insights = await analyzer.analyze(sampleBMC);
    console.log(`✓ Framework: ${insights.frameworkType.toUpperCase()}`);
    console.log(`✓ Insights: ${insights.insights.length}`);
    console.log(`✓ Confidence: ${Math.round(insights.overallConfidence * 100)}%`);
    const types = insights.insights.reduce((acc, i) => {
        acc[i.type] = (acc[i.type] || 0) + 1;
        return acc;
    }, {});
    console.log('\nInsight Types:');
    Object.entries(types).forEach(([type, count]) => console.log(`  ${type}: ${count}`));
    return insights;
}
async function testPortersAnalyzer() {
    console.log('\n' + '='.repeat(80));
    console.log('PORTER\'S ANALYZER TEST');
    console.log('='.repeat(80));
    const analyzer = new PortersAnalyzer();
    const insights = await analyzer.analyze(samplePorters);
    console.log(`✓ Framework: ${insights.frameworkType.toUpperCase()}`);
    console.log(`✓ Insights: ${insights.insights.length}`);
    console.log(`✓ Confidence: ${Math.round(insights.overallConfidence * 100)}%`);
    const types = insights.insights.reduce((acc, i) => {
        acc[i.type] = (acc[i.type] || 0) + 1;
        return acc;
    }, {});
    console.log('\nInsight Types:');
    Object.entries(types).forEach(([type, count]) => console.log(`  ${type}: ${count}`));
    console.log('\nSample Insights:');
    console.log('Workstreams:', insights.insights.filter(i => i.type === 'workstream').length);
    console.log('Risks:', insights.insights.filter(i => i.type === 'risk').length);
    console.log('Stakeholders:', insights.insights.filter(i => i.type === 'stakeholder').length);
    return insights;
}
async function testPESTLEAnalyzer() {
    console.log('\n' + '='.repeat(80));
    console.log('PESTLE ANALYZER TEST');
    console.log('='.repeat(80));
    const analyzer = new PESTLEAnalyzer();
    const insights = await analyzer.analyze(samplePESTLE);
    console.log(`✓ Framework: ${insights.frameworkType.toUpperCase()}`);
    console.log(`✓ Insights: ${insights.insights.length}`);
    console.log(`✓ Confidence: ${Math.round(insights.overallConfidence * 100)}%`);
    const types = insights.insights.reduce((acc, i) => {
        acc[i.type] = (acc[i.type] || 0) + 1;
        return acc;
    }, {});
    console.log('\nInsight Types:');
    Object.entries(types).forEach(([type, count]) => console.log(`  ${type}: ${count}`));
    console.log('\nSample Insights:');
    console.log('Workstreams:', insights.insights.filter(i => i.type === 'workstream').length);
    console.log('Risks:', insights.insights.filter(i => i.type === 'risk').length);
    console.log('Benefits:', insights.insights.filter(i => i.type === 'benefit').length);
    return insights;
}
async function testEPMSynthesis(frameworkType, insights) {
    console.log('\n' + '='.repeat(80));
    console.log(`${frameworkType.toUpperCase()} → EPM SYNTHESIS TEST`);
    console.log('='.repeat(80));
    const synthesizer = new EPMSynthesizer();
    const program = await synthesizer.synthesize(insights);
    console.log(`✓ Program Generated`);
    console.log(`✓ Overall Confidence: ${Math.round(program.overallConfidence * 100)}%`);
    const components = [
        { name: 'Executive Summary', valid: !!program.executiveSummary },
        { name: 'Workstreams', valid: program.workstreams.length > 0 },
        { name: 'Timeline', valid: !!program.timeline },
        { name: 'Resources', valid: !!program.resourcePlan },
        { name: 'Financial', valid: !!program.financialPlan },
        { name: 'Benefits', valid: !!program.benefitsRealization },
        { name: 'Risks', valid: !!program.riskRegister },
        { name: 'Stage Gates', valid: !!program.stageGates },
        { name: 'KPIs', valid: !!program.kpis },
        { name: 'Stakeholders', valid: !!program.stakeholderMap },
        { name: 'Governance', valid: !!program.governance },
        { name: 'QA Plan', valid: !!program.qaPlan },
        { name: 'Procurement', valid: !!program.procurement },
        { name: 'Exit Strategy', valid: !!program.exitStrategy },
    ];
    console.log('\n14 EPM Components:');
    let allValid = true;
    components.forEach(c => {
        console.log(`${c.valid ? '✓' : '✗'} ${c.name}`);
        if (!c.valid)
            allValid = false;
    });
    console.log(`\nKey Metrics:`);
    console.log(`  Workstreams: ${program.workstreams.length}`);
    console.log(`  Timeline: ${program.timeline.totalMonths} months`);
    console.log(`  Resources: ${program.resourcePlan.totalFTEs} FTEs`);
    console.log(`  Budget: $${program.financialPlan.totalBudget.toLocaleString()}`);
    console.log(`  Risks: ${program.riskRegister.risks.length}`);
    console.log(`  Benefits: ${program.benefitsRealization.benefits.length}`);
    console.log(`  KPIs: ${program.kpis.kpis.length}`);
    return { program, allValid };
}
// ============================================================================
// Main Test Runner
// ============================================================================
async function runAllTests() {
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' '.repeat(20) + 'STRATEGY INTELLIGENCE LAYER TESTS' + ' '.repeat(25) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');
    const results = {
        bmc: { pass: false, insights: 0, components: 0 },
        porters: { pass: false, insights: 0, components: 0 },
        pestle: { pass: false, insights: 0, components: 0 },
    };
    try {
        // Test BMC
        const bmcInsights = await testBMCAnalyzer();
        const bmcProgram = await testEPMSynthesis('BMC', bmcInsights);
        results.bmc = {
            pass: bmcProgram.allValid,
            insights: bmcInsights.insights.length,
            components: bmcProgram.allValid ? 14 : 0,
        };
        // Test Porter's
        const portersInsights = await testPortersAnalyzer();
        const portersProgram = await testEPMSynthesis('Porter\'s', portersInsights);
        results.porters = {
            pass: portersProgram.allValid,
            insights: portersInsights.insights.length,
            components: portersProgram.allValid ? 14 : 0,
        };
        // Test PESTLE
        const pestleInsights = await testPESTLEAnalyzer();
        const pestleProgram = await testEPMSynthesis('PESTLE', pestleInsights);
        results.pestle = {
            pass: pestleProgram.allValid,
            insights: pestleInsights.insights.length,
            components: pestleProgram.allValid ? 14 : 0,
        };
    }
    catch (error) {
        console.error('\n❌ TEST SUITE FAILED:', error);
        return false;
    }
    // Summary
    console.log('\n' + '╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' '.repeat(32) + 'TEST SUMMARY' + ' '.repeat(34) + '║');
    console.log('╠' + '═'.repeat(78) + '╣');
    const frameworks = [
        { name: 'BMC', ...results.bmc },
        { name: 'Porter\'s Five Forces', ...results.porters },
        { name: 'PESTLE', ...results.pestle },
    ];
    frameworks.forEach(f => {
        const status = f.pass ? '✓ PASS' : '✗ FAIL';
        const padding = ' '.repeat(Math.max(0, 25 - f.name.length));
        console.log(`║  ${status}  ${f.name}${padding}${f.insights} insights → ${f.components}/14 components  ║`);
    });
    console.log('╚' + '═'.repeat(78) + '╝');
    const allPass = results.bmc.pass && results.porters.pass && results.pestle.pass;
    if (allPass) {
        console.log('\n🎉 ALL TESTS PASSED - Strategy Intelligence Layer is operational!\n');
    }
    else {
        console.log('\n❌ SOME TESTS FAILED - Review errors above\n');
    }
    return allPass;
}
// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests()
        .then(success => {
        process.exit(success ? 0 : 1);
    })
        .catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}
export { runAllTests };
//# sourceMappingURL=test-all-analyzers.js.map