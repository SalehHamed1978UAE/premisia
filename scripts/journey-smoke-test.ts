#!/usr/bin/env tsx

/**
 * Journey Smoke Test Harness
 * 
 * Iterates through every journey in the registry and validates:
 * 1. Journey definition is complete and valid
 * 2. Summary builders execute without errors
 * 3. Readiness thresholds are properly configured
 * 4. Dependencies are logically valid
 * 
 * Usage: npm run journeys:test
 * Exit code 0 = all tests passed, 1 = failures detected
 */

import { JOURNEYS, getJourney } from '../server/journey/journey-registry';
import { summaryBuilders } from '../server/services/journey-summary-service';
import type { JourneyType, StrategicContext, JourneySummary } from '../shared/journey-types';

interface TestResult {
  journeyType: JourneyType;
  passed: boolean;
  errors: string[];
  warnings: string[];
}

interface SmokeTestSummary {
  totalJourneys: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

/**
 * Create mock strategic context for testing summary builders
 */
function createMockContext(journeyType: JourneyType): StrategicContext {
  const journey = getJourney(journeyType);
  
  // Base context structure
  const context: StrategicContext = {
    understandingId: `test-understanding-${journeyType}`,
    sessionId: `test-session-${journeyType}`,
    userInput: `Test input for ${journey.name}`,
    journeyType: journeyType,
    currentFrameworkIndex: journey.frameworks.length,
    completedFrameworks: journey.frameworks,
    insights: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'completed',
  };

  // Create journey-specific mock insights based on summary builder requirements
  const summaryBuilder = journey.summaryBuilder;

  if (summaryBuilder === 'fiveWhysBmc') {
    // For Business Model Innovation (Five Whys + BMC)
    context.insights = {
      rootCauses: [
        'Root cause 1: Insufficient market understanding',
        'Root cause 2: Misaligned value proposition',
        'Root cause 3: Ineffective customer engagement',
      ],
      whysPath: [
        'Why 1: Customer churn is high',
        'Why 2: Product doesn\'t meet expectations',
        'Why 3: Value proposition unclear',
        'Why 4: Market research was insufficient',
        'Why 5: No systematic validation process',
      ],
      bmcBlocks: {
        value_propositions: ['Innovative solution for customer pain points', 'Cost-effective service delivery'],
        customer_segments: ['Small to medium enterprises', 'Tech-savvy millennials'],
        revenue_streams: ['Subscription model', 'Freemium tier'],
        key_activities: ['Product development', 'Customer support', 'Marketing'],
        key_resources: ['Technical team', 'Cloud infrastructure', 'Brand reputation'],
        customer_relationships: ['Personal assistance', 'Self-service'],
        channels: ['Direct sales', 'Online platform'],
        key_partners: ['Technology providers', 'Distribution partners'],
        cost_structure: ['Development costs', 'Infrastructure costs', 'Marketing expenses'],
      },
      strategicImplications: [
        'Focus on customer validation before scaling',
        'Invest in value proposition refinement',
        'Build systematic feedback loops',
      ],
      businessModelGaps: [
        'Missing revenue diversification',
        'Weak customer retention mechanisms',
      ],
    };
  } else if (summaryBuilder === 'pestlePorters') {
    // For Market Entry (PESTLE + Porter's)
    context.insights = {
      trendFactors: {
        political: { trend: 'Regulatory changes favoring innovation', impact: 'High' },
        economic: { trend: 'Economic recovery post-pandemic', impact: 'Medium' },
        social: { trend: 'Shift to remote work', impact: 'High' },
        technological: { trend: 'AI and automation adoption', impact: 'Very High' },
        legal: { trend: 'Data privacy regulations tightening', impact: 'Medium' },
        environmental: { trend: 'Sustainability becoming priority', impact: 'Medium' },
      },
      portersForces: {
        threat_of_new_entrants: { level: 'Medium', factors: ['Low barriers to entry', 'High capital requirements'] },
        bargaining_power_of_suppliers: { level: 'Low', factors: ['Multiple suppliers available'] },
        bargaining_power_of_buyers: { level: 'High', factors: ['Many alternatives', 'Price sensitivity'] },
        threat_of_substitutes: { level: 'Medium', factors: ['Emerging technologies'] },
        competitive_rivalry: { level: 'High', factors: ['Many competitors', 'Slow market growth'] },
      },
      keyOpportunities: [
        'Leverage AI trends for competitive advantage',
        'Target underserved customer segments',
        'Expand into emerging markets',
      ],
    };
  } else if (summaryBuilder === 'portersBmc') {
    // For Competitive Strategy (Porter's + BMC)
    context.insights = {
      competitivePressures: [
        'Intense price competition from established players',
        'High customer switching costs create barriers',
        'New entrants with disruptive technology',
      ],
      portersForces: {
        threat_of_new_entrants: { level: 'High', factors: ['Low barriers', 'Tech disruption'] },
        bargaining_power_of_suppliers: { level: 'Medium', factors: ['Concentrated suppliers'] },
        bargaining_power_of_buyers: { level: 'High', factors: ['Price sensitive'] },
        threat_of_substitutes: { level: 'Medium', factors: ['Alternative solutions exist'] },
        competitive_rivalry: { level: 'Very High', factors: ['Mature market', 'Many players'] },
      },
      bmcBlocks: {
        value_propositions: ['Differentiated premium offering', 'Superior customer experience'],
        key_resources: ['Proprietary technology', 'Brand reputation', 'Expert team'],
        key_activities: ['Innovation', 'Quality assurance', 'Customer service'],
        customer_segments: ['Enterprise clients', 'High-value customers'],
        channels: ['Direct sales force', 'Strategic partnerships'],
        customer_relationships: ['Dedicated account management'],
        revenue_streams: ['Enterprise contracts', 'Premium subscriptions'],
        key_partners: ['Strategic technology partners', 'Industry consortiums'],
        cost_structure: ['R&D investments', 'Sales and marketing', 'Operations'],
      },
    };
  } else if (summaryBuilder === 'pestleBmc') {
    // For Digital Transformation (PESTLE + BMC)
    context.insights = {
      trendFactors: {
        political: { trend: 'Digital infrastructure investments', impact: 'High' },
        economic: { trend: 'Digital economy growth', impact: 'Very High' },
        social: { trend: 'Digital-first customer expectations', impact: 'High' },
        technological: { trend: 'Cloud and AI adoption accelerating', impact: 'Very High' },
        legal: { trend: 'Digital compliance requirements', impact: 'Medium' },
        environmental: { trend: 'Green technology initiatives', impact: 'Medium' },
      },
      bmcBlocks: {
        value_propositions: ['Digital-first solutions', 'Seamless omnichannel experience'],
        channels: ['Mobile app', 'Web platform', 'API integrations', 'Social media'],
        customer_relationships: ['Automated support', 'Community engagement', 'Personalization'],
        key_activities: ['Digital platform development', 'Data analytics', 'UX optimization'],
        customer_segments: ['Digital natives', 'Mobile-first users'],
        revenue_streams: ['Digital subscriptions', 'Platform fees', 'Data services'],
        key_resources: ['Cloud infrastructure', 'Data analytics platform', 'Digital talent'],
        key_partners: ['Cloud providers', 'Technology platforms', 'Digital agencies'],
        cost_structure: ['Technology infrastructure', 'Digital marketing', 'Cybersecurity'],
      },
      keyOpportunities: [
        'Expand digital channels to reach new segments',
        'Leverage data analytics for personalization',
        'Build platform ecosystem',
      ],
    };
  } else if (summaryBuilder === 'fiveWhysSwot') {
    // For Crisis Recovery (Five Whys + SWOT)
    context.insights = {
      rootCauses: [
        'Core operational inefficiencies',
        'Market position erosion over time',
        'Leadership and strategy misalignment',
      ],
      whysPath: [
        'Why 1: Revenue declining rapidly',
        'Why 2: Customer acquisition stopped',
        'Why 3: Value proposition no longer competitive',
        'Why 4: Failed to adapt to market changes',
        'Why 5: No systematic market monitoring',
      ],
      strategicImplications: [
        'Immediate cost reduction required',
        'Core business model needs restructuring',
        'Leadership alignment critical',
      ],
      // SWOT is not yet implemented, using placeholder
      swotAnalysis: {
        strengths: ['Existing customer base', 'Brand recognition'],
        weaknesses: ['Operational inefficiencies', 'Outdated technology'],
        opportunities: ['Market recovery', 'New customer segments'],
        threats: ['Aggressive competitors', 'Market consolidation'],
      },
    };
  } else if (summaryBuilder === 'pestleAnsoff') {
    // For Growth Strategy (PESTLE + Ansoff)
    context.insights = {
      trendFactors: {
        political: { trend: 'Trade agreements opening new markets', impact: 'High' },
        economic: { trend: 'Emerging market growth', impact: 'Very High' },
        social: { trend: 'Changing consumer preferences', impact: 'High' },
        technological: { trend: 'Enablement of global operations', impact: 'High' },
        legal: { trend: 'Harmonized regulations', impact: 'Medium' },
        environmental: { trend: 'Sustainable growth focus', impact: 'Medium' },
      },
      keyOpportunities: [
        'Geographic expansion into emerging markets',
        'Product line extension',
        'Adjacent market penetration',
        'Strategic acquisitions',
      ],
      // Ansoff is not yet implemented, using placeholder
      ansoffMatrix: {
        marketPenetration: ['Increase market share in existing markets'],
        marketDevelopment: ['Enter new geographic regions'],
        productDevelopment: ['Launch new product lines'],
        diversification: ['Explore adjacent industries'],
      },
    };
  }

  return context;
}

/**
 * Test that a journey's summary builder executes successfully
 */
function testSummaryBuilder(journeyType: JourneyType): TestResult {
  const result: TestResult = {
    journeyType,
    passed: true,
    errors: [],
    warnings: [],
  };

  const journey = getJourney(journeyType);
  
  try {
    // 1. Check that summary builder is registered
    const builder = summaryBuilders[journey.summaryBuilder];
    if (!builder) {
      result.errors.push(`Summary builder '${journey.summaryBuilder}' not found in registry`);
      result.passed = false;
      return result;
    }

    // 2. Create mock context
    const context = createMockContext(journeyType);
    const sessionMeta = {
      versionNumber: 1,
      completedAt: new Date().toISOString(),
    };

    // 3. Execute summary builder
    const summary: JourneySummary = builder(context, sessionMeta);

    // 4. Validate summary structure
    if (!summary) {
      result.errors.push('Summary builder returned null or undefined');
      result.passed = false;
      return result;
    }

    if (summary.journeyType !== journeyType) {
      result.errors.push(`Summary journeyType mismatch: expected '${journeyType}', got '${summary.journeyType}'`);
      result.passed = false;
    }

    if (summary.versionNumber !== 1) {
      result.errors.push(`Summary versionNumber should be 1, got ${summary.versionNumber}`);
      result.passed = false;
    }

    if (!summary.keyInsights || summary.keyInsights.length === 0) {
      result.warnings.push('Summary has no keyInsights');
    }

    if (!summary.strategicImplications || summary.strategicImplications.length === 0) {
      result.warnings.push('Summary has no strategicImplications');
    }

    if (!summary.frameworks || Object.keys(summary.frameworks).length === 0) {
      result.errors.push('Summary has no frameworks');
      result.passed = false;
    } else {
      // Verify frameworks object exists and has data
      const frameworkKeys = Object.keys(summary.frameworks);
      if (frameworkKeys.length === 0) {
        result.warnings.push('Summary frameworks object is empty');
      }
    }

    if (!summary.completedAt) {
      result.errors.push('Summary missing completedAt field');
      result.passed = false;
    }

  } catch (error) {
    result.errors.push(`Summary builder threw error: ${error instanceof Error ? error.message : String(error)}`);
    result.passed = false;
  }

  return result;
}

/**
 * Test that readiness thresholds are properly configured
 */
function testReadinessConfiguration(journeyType: JourneyType): TestResult {
  const result: TestResult = {
    journeyType,
    passed: true,
    errors: [],
    warnings: [],
  };

  const journey = getJourney(journeyType);

  // Check that readiness config exists
  if (!journey.defaultReadiness) {
    result.errors.push('Missing defaultReadiness configuration');
    result.passed = false;
    return result;
  }

  // Validate threshold values
  const { minReferences, minEntities } = journey.defaultReadiness;

  if (minReferences === undefined || minReferences === null) {
    result.errors.push('defaultReadiness.minReferences is undefined');
    result.passed = false;
  }

  if (minEntities === undefined || minEntities === null) {
    result.errors.push('defaultReadiness.minEntities is undefined');
    result.passed = false;
  }

  if (typeof minReferences === 'number' && minReferences < 0) {
    result.errors.push(`minReferences cannot be negative: ${minReferences}`);
    result.passed = false;
  }

  if (typeof minEntities === 'number' && minEntities < 0) {
    result.errors.push(`minEntities cannot be negative: ${minEntities}`);
    result.passed = false;
  }

  // Warn if both thresholds are 0 (unless it's intentional like BMI)
  if (minReferences === 0 && minEntities === 0 && journeyType !== 'business_model_innovation') {
    result.warnings.push('Both readiness thresholds are 0 - is this intentional?');
  }

  return result;
}

/**
 * Test that dependencies are logically valid
 */
function testDependencies(journeyType: JourneyType): TestResult {
  const result: TestResult = {
    journeyType,
    passed: true,
    errors: [],
    warnings: [],
  };

  const journey = getJourney(journeyType);

  if (!journey.dependencies || journey.dependencies.length === 0) {
    // No dependencies is valid
    return result;
  }

  const frameworkSet = new Set(journey.frameworks);

  for (const dep of journey.dependencies) {
    // Validate 'from' framework exists in journey
    if (!frameworkSet.has(dep.from)) {
      result.errors.push(`Dependency 'from' framework '${dep.from}' not in journey frameworks`);
      result.passed = false;
    }

    // Validate 'to' framework exists in journey
    if (!frameworkSet.has(dep.to)) {
      result.errors.push(`Dependency 'to' framework '${dep.to}' not in journey frameworks`);
      result.passed = false;
    }

    // Validate 'from' comes before 'to' in sequence
    const fromIndex = journey.frameworks.indexOf(dep.from);
    const toIndex = journey.frameworks.indexOf(dep.to);

    if (fromIndex >= toIndex && fromIndex !== -1 && toIndex !== -1) {
      result.errors.push(`Dependency violation: '${dep.from}' should come before '${dep.to}' in framework sequence`);
      result.passed = false;
    }
  }

  return result;
}

/**
 * Run all smoke tests for a single journey
 */
function testJourney(journeyType: JourneyType): TestResult {
  console.log(`\n🧪 Testing: ${journeyType}`);
  
  const summaryTest = testSummaryBuilder(journeyType);
  const readinessTest = testReadinessConfiguration(journeyType);
  const dependenciesTest = testDependencies(journeyType);

  const combinedResult: TestResult = {
    journeyType,
    passed: summaryTest.passed && readinessTest.passed && dependenciesTest.passed,
    errors: [...summaryTest.errors, ...readinessTest.errors, ...dependenciesTest.errors],
    warnings: [...summaryTest.warnings, ...readinessTest.warnings, ...dependenciesTest.warnings],
  };

  if (combinedResult.passed) {
    console.log(`  ✅ PASS`);
  } else {
    console.log(`  ❌ FAIL`);
    combinedResult.errors.forEach(err => console.log(`     ❌ ${err}`));
  }

  if (combinedResult.warnings.length > 0) {
    combinedResult.warnings.forEach(warn => console.log(`     ⚠️  ${warn}`));
  }

  return combinedResult;
}

/**
 * Main test runner
 */
async function main() {
  console.log('🚀 Journey Smoke Test Harness\n');
  console.log('Testing all registered journeys for completeness and correctness...\n');

  const journeyTypes = Object.keys(JOURNEYS) as JourneyType[];
  const results: TestResult[] = [];

  for (const journeyType of journeyTypes) {
    const result = testJourney(journeyType);
    results.push(result);
  }

  // Generate summary
  const summary: SmokeTestSummary = {
    totalJourneys: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results,
  };

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SMOKE TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nTotal Journeys: ${summary.totalJourneys}`);
  console.log(`Passed: ${summary.passed} ✅`);
  console.log(`Failed: ${summary.failed} ${summary.failed > 0 ? '❌' : ''}`);

  if (summary.failed > 0) {
    console.log('\n❌ FAILED JOURNEYS:\n');
    summary.results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  • ${r.journeyType}`);
        r.errors.forEach(err => console.log(`    - ${err}`));
      });
  }

  console.log('\n' + '='.repeat(60) + '\n');

  if (summary.failed > 0) {
    console.log('❌ SMOKE TESTS FAILED\n');
    process.exit(1);
  } else {
    console.log('✅ ALL SMOKE TESTS PASSED\n');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
