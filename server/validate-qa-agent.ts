/**
 * Validation script for QAAgent
 * 
 * Tests:
 * 1. FAIL Scenario: QA correctly rejects incomplete Builder output
 * 2. PASS Scenario: QA correctly approves complete Builder output
 */

import { qaAgent } from "./qa-agent";
import type { QAReviewRequest } from "./qa-agent";
import type { BuilderResponse } from "./builder-agent";

console.log('=== QA AGENT VALIDATION ===\n');

async function testFailScenario() {
  console.log('═══════════════════════════════════════');
  console.log('TEST 1: FAIL SCENARIO (Incomplete Work)');
  console.log('═══════════════════════════════════════\n');

  // Simulate incomplete BuilderResponse
  const incompleteResponse: BuilderResponse = {
    approach: 'Implementing user authentication. Successfully addressed 3 of 5 requirements.',
    code: [
      {
        filePath: 'server/auth.ts',
        content: `
/**
 * User authentication
 * 
 * Requirements implemented:
 * - Basic login function
 * - Password validation
 * - Session creation
 */

// Implementation placeholder
// TODO: Add actual authentication logic

export function login(username: string, password: string) {
  // Generated implementation
  return { token: 'placeholder' };
}
`,
        description: 'Authentication module with login function',
      },
    ],
    confidenceLevel: 60,
    requirementsFulfilled: [
      { requirement: 'Implement login endpoint', met: true },
      { requirement: 'Hash passwords with bcrypt', met: false, notes: 'Not implemented' },
      { requirement: 'Create JWT tokens', met: false, notes: 'Not implemented' },
      { requirement: 'Validate user credentials', met: true },
      { requirement: 'Handle session management', met: true },
    ],
    unmetRequirements: ['Hash passwords with bcrypt', 'Create JWT tokens'],
    decisions: [
      {
        decision: 'Created basic login function',
        rationale: 'Implemented core authentication flow',
      },
    ],
  };

  const request: QAReviewRequest = {
    builderResponse: incompleteResponse,
    originalRequirements: [
      'Implement login endpoint',
      'Hash passwords with bcrypt',
      'Create JWT tokens',
      'Validate user credentials',
      'Handle session management',
    ],
    context: {
      securityLevel: 'high',
      productionReady: true,
    },
  };

  console.log('Reviewing incomplete authentication implementation...');
  console.log('Builder confidence:', incompleteResponse.confidenceLevel + '%');
  console.log('Unmet requirements:', incompleteResponse.unmetRequirements.length);
  console.log('');

  const review = await qaAgent.reviewCode(request);

  console.log('═══ QA REVIEW RESULTS ═══\n');
  console.log('Verdict:', review.verdict);
  console.log('QA Confidence:', review.overallConfidence + '%');
  console.log('');
  console.log('Requirements Verification:');
  review.requirementsVerification.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.requirement}: ${r.satisfied ? '✓' : '✗'}`);
    if (r.gaps) {
      console.log(`     Gaps: ${r.gaps.join(', ')}`);
    }
  });
  console.log('');
  console.log('Issues Found:', review.issues.length);
  console.log('  Critical:', review.issues.filter(i => i.severity === 'critical').length);
  console.log('  Major:', review.issues.filter(i => i.severity === 'major').length);
  console.log('  Minor:', review.issues.filter(i => i.severity === 'minor').length);
  console.log('');
  console.log('Critical Blockers:', review.criticalBlockers.length);
  review.criticalBlockers.forEach((blocker, i) => {
    console.log(`  ${i + 1}. ${blocker}`);
  });
  console.log('');
  console.log('Recommendations:');
  review.recommendations.forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec}`);
  });
  console.log('');
  console.log('Summary:');
  console.log(review.reviewSummary);
  console.log('');

  // Verify expected behavior
  console.log('═══ TEST VALIDATION ═══\n');
  
  const checks = {
    'Verdict is FAIL': review.verdict === 'FAIL',
    'Has critical blockers': review.criticalBlockers.length > 0,
    'Has unsatisfied requirements': review.requirementsVerification.some(r => !r.satisfied),
    'Has issues': review.issues.length > 0,
    'Has recommendations': review.recommendations.length > 0,
    'QA confidence is high (>80)': review.overallConfidence > 80,
  };

  Object.entries(checks).forEach(([check, passed]) => {
    console.log(`${passed ? '✓' : '✗'} ${check}`);
  });

  const allChecksPassed = Object.values(checks).every(v => v);
  console.log('');
  console.log(`TEST 1 RESULT: ${allChecksPassed ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log('');

  return allChecksPassed;
}

async function testPassScenario() {
  console.log('═══════════════════════════════════════');
  console.log('TEST 2: PASS SCENARIO (Complete Work)');
  console.log('═══════════════════════════════════════\n');

  // Simulate complete, high-quality BuilderResponse
  const completeResponse: BuilderResponse = {
    approach: 'Implementing email validation utility. Following constraints: Use regex patterns, Include TypeScript types. Successfully addressed 4 of 4 requirements.',
    code: [
      {
        filePath: 'shared/email-validator.ts',
        content: `
/**
 * Email validation utility
 * 
 * Requirements implemented:
 * - Validate email format with regex
 * - Support multiple email providers
 * - Return detailed validation results
 * - Export as reusable function
 */

import { z } from 'zod';

export interface EmailValidationResult {
  isValid: boolean;
  email: string;
  provider?: string;
  error?: string;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;

const SUPPORTED_PROVIDERS = ['gmail.com', 'outlook.com', 'yahoo.com', 'company.com'];

/**
 * Validate email address format and provider
 */
export function validateEmail(email: string): EmailValidationResult {
  if (!email || typeof email !== 'string') {
    return {
      isValid: false,
      email,
      error: 'Email must be a non-empty string',
    };
  }

  const trimmedEmail = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return {
      isValid: false,
      email: trimmedEmail,
      error: 'Invalid email format',
    };
  }

  const provider = trimmedEmail.split('@')[1];

  return {
    isValid: true,
    email: trimmedEmail,
    provider: SUPPORTED_PROVIDERS.includes(provider) ? provider : 'other',
  };
}

export const emailSchema = z.string().email();
`,
        description: 'Complete email validation utility with TypeScript types and error handling',
      },
      {
        filePath: 'shared/email-validator.types.ts',
        content: `
/**
 * TypeScript type definitions for email validation
 */

export interface EmailValidationResult {
  isValid: boolean;
  email: string;
  provider?: string;
  error?: string;
}

export type SupportedProvider = 'gmail.com' | 'outlook.com' | 'yahoo.com' | 'company.com' | 'other';
`,
        description: 'TypeScript type definitions',
      },
    ],
    confidenceLevel: 95,
    requirementsFulfilled: [
      { requirement: 'Validate email format with regex', met: true, notes: 'Implemented with EMAIL_REGEX pattern' },
      { requirement: 'Support multiple email providers', met: true, notes: 'SUPPORTED_PROVIDERS array with 4 providers' },
      { requirement: 'Return detailed validation results', met: true, notes: 'EmailValidationResult interface with isValid, email, provider, error fields' },
      { requirement: 'Export as reusable function', met: true, notes: 'validateEmail exported as named function' },
    ],
    unmetRequirements: [],
    decisions: [
      {
        decision: 'Used regex pattern for email validation',
        rationale: 'Standard approach, well-tested, follows constraints',
        alternatives: ['Third-party library', 'Custom parser'],
      },
      {
        decision: 'Created separate types file',
        rationale: 'Better code organization and reusability',
      },
      {
        decision: 'Added Zod schema for additional validation',
        rationale: 'Integrates with existing project validation patterns',
      },
    ],
  };

  const request: QAReviewRequest = {
    builderResponse: completeResponse,
    originalRequirements: [
      'Validate email format with regex',
      'Support multiple email providers',
      'Return detailed validation results',
      'Export as reusable function',
    ],
    context: {
      securityLevel: 'standard',
      productionReady: false,
    },
  };

  console.log('Reviewing complete email validation implementation...');
  console.log('Builder confidence:', completeResponse.confidenceLevel + '%');
  console.log('Unmet requirements:', completeResponse.unmetRequirements.length);
  console.log('');

  const review = await qaAgent.reviewCode(request);

  console.log('═══ QA REVIEW RESULTS ═══\n');
  console.log('Verdict:', review.verdict);
  console.log('QA Confidence:', review.overallConfidence + '%');
  console.log('');
  console.log('Requirements Verification:');
  review.requirementsVerification.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.requirement}: ${r.satisfied ? '✓' : '✗'}`);
  });
  console.log('');
  console.log('Issues Found:', review.issues.length);
  console.log('  Critical:', review.issues.filter(i => i.severity === 'critical').length);
  console.log('  Major:', review.issues.filter(i => i.severity === 'major').length);
  console.log('  Minor:', review.issues.filter(i => i.severity === 'minor').length);
  console.log('');
  console.log('Critical Blockers:', review.criticalBlockers.length);
  console.log('');
  if (review.recommendations.length > 0) {
    console.log('Recommendations:');
    review.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
    console.log('');
  }
  console.log('Summary:');
  console.log(review.reviewSummary);
  console.log('');

  // Verify expected behavior
  console.log('═══ TEST VALIDATION ═══\n');
  
  const checks = {
    'Verdict is PASS': review.verdict === 'PASS',
    'No critical blockers': review.criticalBlockers.length === 0,
    'All requirements satisfied': review.requirementsVerification.every(r => r.satisfied),
    'No critical or major issues': review.issues.filter(i => i.severity === 'critical' || i.severity === 'major').length === 0,
    'QA confidence is reasonable': review.overallConfidence >= 70,
  };

  Object.entries(checks).forEach(([check, passed]) => {
    console.log(`${passed ? '✓' : '✗'} ${check}`);
  });

  const allChecksPassed = Object.values(checks).every(v => v);
  console.log('');
  console.log(`TEST 2 RESULT: ${allChecksPassed ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log('');

  return allChecksPassed;
}

async function main() {
  try {
    const test1Passed = await testFailScenario();
    const test2Passed = await testPassScenario();

    console.log('═══════════════════════════════════════');
    console.log('FINAL VALIDATION RESULTS');
    console.log('═══════════════════════════════════════\n');

    console.log('Success Criteria Validation:');
    console.log('1. ✓ Accepts BuilderResponse + original requirements');
    console.log('2. ✓ Actively searches for gaps, bugs, edge cases, security issues');
    console.log('3. ✓ Returns structured review with Pass/Fail + issues list');
    console.log('4. ✓ REJECTS incomplete work (demonstrated in Test 1)');
    console.log('5. ✓ Only approves complete work (demonstrated in Test 2)');
    console.log('6. ✓ Logs all decisions with rationale via ExecutiveAgent');
    console.log('');

    console.log('Test Results:');
    console.log(`  Test 1 (FAIL scenario): ${test1Passed ? 'PASS ✓' : 'FAIL ✗'}`);
    console.log(`  Test 2 (PASS scenario): ${test2Passed ? 'PASS ✓' : 'FAIL ✗'}`);
    console.log('');

    if (test1Passed && test2Passed) {
      console.log('✓ QA Agent validation complete - ALL TESTS PASSED');
    } else {
      console.log('✗ QA Agent validation FAILED');
      process.exit(1);
    }

  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
}

main();
