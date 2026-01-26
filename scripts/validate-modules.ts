#!/usr/bin/env npx tsx
/**
 * Module Validation Script
 * Validates all module manifests against required checks
 * 
 * Usage: npm run validate-modules
 */

import { allManifests } from '../server/modules/manifests/index';
import type { ModuleManifest } from '../server/modules/manifest';
import * as fs from 'fs';
import * as path from 'path';

interface CheckResult {
  name: string;
  passed: boolean;
  details?: string;
}

interface ModuleValidation {
  moduleId: string;
  checks: CheckResult[];
  passed: number;
  failed: number;
  allPassed: boolean;
}

const MANIFEST_ID_TO_REGISTRY_KEY: Record<string, string> = {
  'swot-analyzer': 'swot',
  'bmc-analyzer': 'bmc',
  'porters-analyzer': 'porters',
  'pestle-analyzer': 'pestle',
  'five-whys-analyzer': 'five_whys',
  'ansoff-analyzer': 'ansoff',
  'blue-ocean-analyzer': 'blue_ocean',
  'ocean-strategy-analyzer': 'ocean_strategy',
  'bcg-matrix-analyzer': 'bcg_matrix',
  'value-chain-analyzer': 'value_chain',
  'vrio-analyzer': 'vrio',
  'scenario-planning-analyzer': 'scenario_planning',
  'jobs-to-be-done-analyzer': 'jobs_to_be_done',
  'competitive-positioning-analyzer': 'competitive_positioning',
  'segment-discovery-analyzer': 'segment_discovery',
  'strategic-decisions': 'strategic_decisions',
  'strategic-understanding': 'strategic_understanding',
  'epm-generator': 'epm',
  'okr-generator': 'okr',
  'input-processor': 'input_processor',
};

const VALID_MODULE_TYPES = ['ai_analyzer', 'user_input', 'generator', 'internal'];

function validateModule(manifest: ModuleManifest): ModuleValidation {
  const checks: CheckResult[] = [];
  
  // Check 1: Manifest has valid ID
  checks.push({
    name: 'has_valid_id',
    passed: !!manifest.id && typeof manifest.id === 'string' && manifest.id.length > 0,
    details: manifest.id || 'missing',
  });
  
  // Check 2: Has moduleType field
  checks.push({
    name: 'has_moduleType',
    passed: !!manifest.moduleType && VALID_MODULE_TYPES.includes(manifest.moduleType),
    details: manifest.moduleType || 'missing',
  });
  
  // Check 3: Exported in index.ts (check for the manifest file import)
  const indexPath = path.join(process.cwd(), 'server/modules/manifests/index.ts');
  const indexContent = fs.readFileSync(indexPath, 'utf-8');
  // Check for import from the manifest file (e.g., './swot-analyzer' or './bmc-analyzer')
  const manifestFileName = manifest.id; // e.g., 'swot-analyzer'
  const isExported = indexContent.includes(`'./${manifestFileName}'`) || 
                     indexContent.includes(`"./${manifestFileName}"`);
  checks.push({
    name: 'exported_in_index',
    passed: isExported,
    details: isExported ? 'yes' : 'not found in index.ts',
  });
  
  // Check 4: Has registry key mapping
  const hasRegistryMapping = MANIFEST_ID_TO_REGISTRY_KEY[manifest.id] !== undefined;
  checks.push({
    name: 'has_registry_mapping',
    passed: hasRegistryMapping,
    details: hasRegistryMapping ? MANIFEST_ID_TO_REGISTRY_KEY[manifest.id] : 'no mapping',
  });
  
  // Check 5: Has required fields
  const hasRequiredFields = !!manifest.name && !!manifest.version && !!manifest.type && 
                            Array.isArray(manifest.inputs) && Array.isArray(manifest.outputs);
  checks.push({
    name: 'has_required_fields',
    passed: hasRequiredFields,
    details: hasRequiredFields ? 'all present' : 'missing fields',
  });
  
  // Check 6: Is active
  checks.push({
    name: 'is_active',
    passed: manifest.isActive === true,
    details: manifest.isActive ? 'active' : 'inactive',
  });
  
  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;
  
  return {
    moduleId: manifest.id,
    checks,
    passed,
    failed,
    allPassed: failed === 0,
  };
}

function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('MODULE FACTORY SYSTEM VALIDATION');
  console.log('='.repeat(60));
  console.log('');
  
  const results: ModuleValidation[] = [];
  
  for (const manifest of allManifests) {
    const result = validateModule(manifest);
    results.push(result);
    
    const icon = result.allPassed ? '✓' : '✗';
    const color = result.allPassed ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    
    console.log(`${color}${icon}${reset} ${manifest.id} (${result.passed}/${result.passed + result.failed} checks)`);
    
    if (!result.allPassed) {
      for (const check of result.checks) {
        if (!check.passed) {
          console.log(`    ✗ ${check.name}: ${check.details}`);
        }
      }
    }
  }
  
  const totalPassed = results.filter(r => r.allPassed).length;
  const totalFailed = results.filter(r => !r.allPassed).length;
  
  console.log('');
  console.log('='.repeat(60));
  console.log(`SUMMARY: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('='.repeat(60));
  
  if (totalFailed > 0) {
    console.log('');
    console.log('FAILED MODULES:');
    for (const result of results) {
      if (!result.allPassed) {
        console.log(`  - ${result.moduleId}`);
        for (const check of result.checks) {
          if (!check.passed) {
            console.log(`      ${check.name}: ${check.details}`);
          }
        }
      }
    }
    process.exit(1);
  }
  
  console.log('');
  console.log('EXIT CODE: 0');
  process.exit(0);
}

main();
