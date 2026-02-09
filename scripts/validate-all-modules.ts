#!/usr/bin/env npx ts-node
/**
 * MODULE VALIDATION SCRIPT
 *
 * Run with: npx ts-node scripts/validate-all-modules.ts
 * Or add to package.json: "validate-modules": "ts-node scripts/validate-all-modules.ts"
 *
 * This script checks that all modules are properly configured.
 * It produces deterministic output - no LLM interpretation needed.
 *
 * EXIT CODES:
 *   0 = All validations passed
 *   1 = One or more validations failed
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// CONFIGURATION: All modules that must exist
// ============================================

const REQUIRED_MODULES = [
  'swot-analyzer',
  'bmc-analyzer',
  'porters-analyzer',
  'pestle-analyzer',
  'five-whys-analyzer',
  'ansoff-analyzer',
  'blue-ocean-analyzer',
  'bcg-matrix-analyzer',
  'value-chain-analyzer',
  'vrio-analyzer',
  'scenario-planning-analyzer',
  'jobs-to-be-done-analyzer',
  'competitive-positioning-analyzer',
  'ocean-strategy-analyzer',
  'segment-discovery-analyzer',
  'strategic-decisions',
  'strategic-understanding',
  'epm-generator',
  'okr-generator',
];

const USER_INPUT_MODULES = [
  'strategic-decisions',
  'strategic-understanding',
];

const GENERATOR_MODULES = [
  'epm-generator',
  'okr-generator',
];

// ============================================
// VALIDATION FUNCTIONS
// ============================================

interface ValidationResult {
  module: string;
  checks: {
    name: string;
    passed: boolean;
    details: string;
  }[];
}

function checkFileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function checkFileContains(filePath: string, searchString: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.includes(searchString);
  } catch {
    return false;
  }
}

function checkFileExportsId(filePath: string, moduleId: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Check for id: 'module-id' in the manifest
    return content.includes(`id: '${moduleId}'`) || content.includes(`id: "${moduleId}"`);
  } catch {
    return false;
  }
}

function checkModuleType(filePath: string, expectedTypes: string[]): { found: boolean; type: string | null } {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const type of expectedTypes) {
      if (content.includes(`moduleType: '${type}'`) || content.includes(`moduleType: "${type}"`)) {
        return { found: true, type };
      }
    }
    // Check if moduleType exists at all
    const match = content.match(/moduleType:\s*['"](\w+)['"]/);
    if (match) {
      return { found: true, type: match[1] };
    }
    return { found: false, type: null };
  } catch {
    return { found: false, type: null };
  }
}

function validateModule(moduleId: string, basePath: string): ValidationResult {
  const checks: ValidationResult['checks'] = [];

  // Determine expected paths
  const manifestPath = path.join(basePath, 'server/modules/manifests', `${moduleId}.ts`);
  const manifestIndexPath = path.join(basePath, 'server/modules/manifests/index.ts');

  // For implementations, check multiple possible locations
  const implPaths = [
    path.join(basePath, 'server/intelligence', `${moduleId}.ts`),
    path.join(basePath, 'server/intelligence', moduleId.replace('-analyzer', '') + '.ts'),
  ];

  // User input modules don't need intelligence implementations
  const isUserInput = USER_INPUT_MODULES.includes(moduleId);
  const isGenerator = GENERATOR_MODULES.includes(moduleId);

  // CHECK 1: Manifest exists
  const manifestExists = checkFileExists(manifestPath);
  checks.push({
    name: 'Manifest exists',
    passed: manifestExists,
    details: manifestExists ? manifestPath : `Missing: ${manifestPath}`,
  });

  // CHECK 2: Manifest has correct ID
  if (manifestExists) {
    const hasCorrectId = checkFileExportsId(manifestPath, moduleId);
    checks.push({
      name: 'Manifest has correct ID',
      passed: hasCorrectId,
      details: hasCorrectId ? `id: '${moduleId}'` : `ID mismatch in manifest`,
    });
  }

  // CHECK 3: Manifest has moduleType
  if (manifestExists) {
    const expectedType = isUserInput ? 'user-input' : (isGenerator ? 'generator' : 'ai_analyzer');
    const typeCheck = checkModuleType(manifestPath, [expectedType, 'ai_analyzer', 'user-input', 'generator', 'internal']);
    checks.push({
      name: 'Manifest has moduleType',
      passed: typeCheck.found,
      details: typeCheck.found ? `moduleType: '${typeCheck.type}'` : 'Missing moduleType field',
    });
  }

  // CHECK 4: Manifest exported in index
  const exportedInIndex = checkFileContains(manifestIndexPath, moduleId);
  checks.push({
    name: 'Exported in manifests/index.ts',
    passed: exportedInIndex,
    details: exportedInIndex ? 'Found in index' : 'Not exported in index.ts',
  });

  // CHECK 5: Implementation exists (skip for user-input modules)
  if (!isUserInput) {
    const implExists = implPaths.some(p => checkFileExists(p));
    const foundPath = implPaths.find(p => checkFileExists(p));
    checks.push({
      name: 'Implementation exists',
      passed: implExists,
      details: implExists ? foundPath! : `Missing implementation in /intelligence/`,
    });
  } else {
    checks.push({
      name: 'Implementation exists',
      passed: true,
      details: 'User-input module (no implementation needed)',
    });
  }

  // CHECK 6: In seed registry (check journey-builder-seed.ts)
  const seedPath = path.join(basePath, 'server/journey-builder-seed.ts');
  // Convert module-id to framework_key format (kebab to snake)
  const frameworkKey = moduleId.replace(/-/g, '_').replace('_analyzer', '').replace('_generator', '');
  const altKeys = [
    moduleId,
    moduleId.replace('-analyzer', ''),
    moduleId.replace('-generator', ''),
    frameworkKey,
  ];
  const inSeed = altKeys.some(key => checkFileContains(seedPath, `frameworkKey: '${key}'`) || checkFileContains(seedPath, `frameworkKey: "${key}"`));
  checks.push({
    name: 'In seed registry',
    passed: inSeed,
    details: inSeed ? 'Found in journey-builder-seed.ts' : 'Not in seed registry',
  });

  return { module: moduleId, checks };
}

// ============================================
// MAIN EXECUTION
// ============================================

function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           MODULE VALIDATION REPORT                         ║');
  console.log('║           ' + new Date().toISOString() + '              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Determine base path (look for server/ directory)
  let basePath = process.cwd();
  if (!fs.existsSync(path.join(basePath, 'server'))) {
    // Try parent directory
    basePath = path.dirname(basePath);
  }
  if (!fs.existsSync(path.join(basePath, 'server'))) {
    console.error('ERROR: Cannot find server/ directory. Run from project root.');
    process.exit(1);
  }

  console.log(`Base path: ${basePath}`);
  console.log(`Validating ${REQUIRED_MODULES.length} modules...`);
  console.log('');

  const results: ValidationResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const moduleId of REQUIRED_MODULES) {
    const result = validateModule(moduleId, basePath);
    results.push(result);

    const allPassed = result.checks.every(c => c.passed);
    const passedCount = result.checks.filter(c => c.passed).length;
    const totalChecks = result.checks.length;

    if (allPassed) {
      console.log(`✓ ${moduleId} (${passedCount}/${totalChecks} checks)`);
      totalPassed++;
    } else {
      console.log(`✗ ${moduleId} (${passedCount}/${totalChecks} checks)`);
      for (const check of result.checks) {
        if (!check.passed) {
          console.log(`    ✗ ${check.name}: ${check.details}`);
        }
      }
      totalFailed++;
    }
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`SUMMARY: ${totalPassed} passed, ${totalFailed} failed out of ${REQUIRED_MODULES.length} modules`);
  console.log('════════════════════════════════════════════════════════════');

  if (totalFailed > 0) {
    console.log('');
    console.log('FAILED MODULES:');
    for (const result of results) {
      const failed = result.checks.filter(c => !c.passed);
      if (failed.length > 0) {
        console.log(`  ${result.module}:`);
        for (const check of failed) {
          console.log(`    - ${check.name}: ${check.details}`);
        }
      }
    }
    console.log('');
    console.log('EXIT CODE: 1 (VALIDATION FAILED)');
    process.exit(1);
  } else {
    console.log('');
    console.log('EXIT CODE: 0 (ALL VALIDATIONS PASSED)');
    process.exit(0);
  }
}

main();
