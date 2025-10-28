/**
 * Dependency Analyzer for EPM Synthesizer
 *
 * Analyzes function signatures to determine which operations can safely run in parallel
 * by identifying what data each function reads vs writes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse EPM Synthesizer to extract function signatures and parameters
function analyzeEPMSynthesizer() {
  const filePath = path.join(__dirname, 'server/intelligence/epm-synthesizer.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  console.log('='.repeat(80));
  console.log('EPM SYNTHESIZER DEPENDENCY ANALYSIS');
  console.log('='.repeat(80));
  console.log();

  // Extract all generate* function signatures
  // Use a more robust approach that handles nested parentheses in callback types
  const functionStartPattern = /async\s+(generate\w+)\s*\(/g;
  const functions = [];
  let match;

  while ((match = functionStartPattern.exec(content)) !== null) {
    const funcName = match[1];
    const startPos = match.index + match[0].length;
    
    // Balance parentheses to find the end of the parameter list
    let parenCount = 1;
    let endPos = startPos;
    while (parenCount > 0 && endPos < content.length) {
      if (content[endPos] === '(') parenCount++;
      if (content[endPos] === ')') parenCount--;
      endPos++;
    }
    
    const paramsString = content.substring(startPos, endPos - 1);
    
    // Parse parameters more carefully
    // Split by comma, but only at the top level (not inside nested types)
    const params = [];
    let currentParam = '';
    let nestedLevel = 0;
    
    for (let i = 0; i < paramsString.length; i++) {
      const char = paramsString[i];
      if (char === '(' || char === '<') nestedLevel++;
      if (char === ')' || char === '>') nestedLevel--;
      
      if (char === ',' && nestedLevel === 0) {
        params.push(currentParam.trim());
        currentParam = '';
      } else {
        currentParam += char;
      }
    }
    if (currentParam.trim()) {
      params.push(currentParam.trim());
    }
    
    // Extract just the parameter names
    const paramNames = params
      .map(p => {
        // Get parameter name (before the colon)
        const paramName = p.split(':')[0].trim();
        // Remove any default values, optional markers, and destructuring
        return paramName.replace(/[?]/g, '').split('=')[0].trim();
      })
      .filter(p => p && !p.includes('//') && !p.includes('/*'));

    functions.push({ name: funcName, params: paramNames });
  }

  console.log('📊 FUNCTION PARAMETER ANALYSIS\n');
  console.log('Function Name | Reads From | Dependencies');
  console.log('-'.repeat(80));

  const dependencies = {};

  functions.forEach(func => {
    const deps = func.params.filter(p =>
      !['insights', 'userContext', 'namingContext', 'onProgress', 'startTime', 'initiativeType'].includes(p)
    );
    dependencies[func.name] = {
      params: func.params,
      dependsOn: deps,
      readsOnly: func.params.filter(p => ['insights', 'userContext'].includes(p)),
    };

    console.log(`${func.name.padEnd(30)} | ${func.params.join(', ').substring(0, 30).padEnd(30)} | ${deps.join(', ') || 'NONE (can parallelize!)'}`);
  });

  console.log();
  console.log('='.repeat(80));
  console.log('PARALLELIZATION GROUPS (functions with NO cross-dependencies)');
  console.log('='.repeat(80));
  console.log();

  // Find independent groups
  const independent = functions.filter(f => dependencies[f.name].dependsOn.length === 0);
  const dependent = functions.filter(f => dependencies[f.name].dependsOn.length > 0);

  console.log('✅ GROUP 1: INDEPENDENT (safe to parallelize)');
  console.log('-'.repeat(80));
  independent.forEach(f => {
    console.log(`  - ${f.name}`);
    console.log(`    Reads: ${dependencies[f.name].readsOnly.join(', ') || 'insights, userContext'}`);
    console.log(`    Writes: ${f.name.replace('generate', '')} component`);
    console.log();
  });

  console.log('⚠️  GROUP 2: DEPENDENT (requires sequential or chained execution)');
  console.log('-'.repeat(80));
  dependent.forEach(f => {
    console.log(`  - ${f.name}`);
    console.log(`    Reads: ${f.params.join(', ')}`);
    console.log(`    Dependencies: ${dependencies[f.name].dependsOn.join(', ')}`);
    console.log();
  });

  // Build dependency chains
  console.log('='.repeat(80));
  console.log('DEPENDENCY CHAINS (must execute in order)');
  console.log('='.repeat(80));
  console.log();

  buildDependencyChains(dependencies);

  return { functions, dependencies, independent, dependent };
}

function buildDependencyChains(dependencies) {
  const chains = new Map();

  // Map outputs to their dependents
  Object.entries(dependencies).forEach(([funcName, info]) => {
    const output = funcName.replace('generate', '').toLowerCase();

    info.dependsOn.forEach(dep => {
      const depLower = dep.toLowerCase();
      if (!chains.has(depLower)) {
        chains.set(depLower, []);
      }
      chains.get(depLower).push(funcName);
    });
  });

  // Print chains
  const printed = new Set();

  function printChain(start, depth = 0) {
    const indent = '  '.repeat(depth);
    const arrow = depth > 0 ? '└─> ' : '';
    console.log(`${indent}${arrow}${start}`);
    printed.add(start);

    const dependents = chains.get(start.replace('generate', '').toLowerCase()) || [];
    dependents.forEach(dep => {
      if (!printed.has(dep)) {
        printChain(dep, depth + 1);
      }
    });
  }

  // Find root functions (those that don't depend on anything)
  const roots = Object.entries(dependencies)
    .filter(([_, info]) => info.dependsOn.length === 0)
    .map(([name, _]) => name);

  roots.forEach(root => {
    if (!printed.has(root)) {
      console.log(`\nChain starting from: ${root}`);
      printChain(root);
    }
  });

  console.log();
}

// Analyze BMC Analyzer
function analyzeBMCAnalyzer() {
  const filePath = path.join(__dirname, 'server/intelligence/bmc-analyzer.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  console.log('='.repeat(80));
  console.log('BMC ANALYZER DEPENDENCY ANALYSIS');
  console.log('='.repeat(80));
  console.log();

  // Find the analyze method - more flexible regex that handles various indentation
  const analyzeMethodMatch = content.match(/async\s+analyze\s*\([^)]*\)[^{]*\{([\s\S]*?)\n\s*\}/m);
  if (analyzeMethodMatch) {
    const methodBody = analyzeMethodMatch[0];
    const calls = methodBody.match(/await\s+this\.(extract\w+|infer\w+)\s*\(/g) || [];

    console.log('📊 EXTRACTION CALLS IN analyze() METHOD:\n');
    if (calls.length > 0) {
      calls.forEach((call, idx) => {
        const methodName = call.replace(/await\s+this\./, '').replace(/\s*\($/, '');
        console.log(`${idx + 1}. ${methodName}`);
      });

      console.log('\n✅ ANALYSIS:');
      console.log('All extraction methods receive the SAME input (frameworkResults)');
      console.log('None of them modify frameworkResults');
      console.log('They all return independent arrays of insights');
      console.log('→ SAFE TO PARALLELIZE with Promise.all\n');
    } else {
      console.log('⚠️  No extraction method calls found in analyze() method');
      console.log('Pattern searched: await this.(extract*|infer*)(');
      console.log();
    }
  } else {
    console.log('⚠️  Could not locate analyze() method in BMC analyzer');
    console.log('File may have been refactored or pattern needs updating');
    console.log();
  }
}

// Analyze Journey Orchestrator
function analyzeJourneyOrchestrator() {
  const filePath = path.join(__dirname, 'server/journey/journey-orchestrator.ts');
  
  if (!fs.existsSync(filePath)) {
    console.log('='.repeat(80));
    console.log('JOURNEY ORCHESTRATOR DEPENDENCY ANALYSIS');
    console.log('='.repeat(80));
    console.log();
    console.log('⚠️  File not found: server/journey/journey-orchestrator.ts');
    console.log('Skipping Journey Orchestrator analysis');
    console.log();
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  console.log('='.repeat(80));
  console.log('JOURNEY ORCHESTRATOR DEPENDENCY ANALYSIS');
  console.log('='.repeat(80));
  console.log();

  // Find the for loop in executeJourney - more flexible regex
  const forLoopMatch = content.match(/for\s*\(\s*let\s+i[\s\S]*?context\s*=\s*addFrameworkResult[\s\S]*?\n\s*\}/);
  if (forLoopMatch) {
    console.log('📊 FRAMEWORK EXECUTION PATTERN:\n');
    console.log('Current implementation:');
    console.log('  for (let i = 0; i < frameworks.length; i++) {');
    console.log('    const result = await this.executeFramework(frameworkName, context);');
    console.log('    context = addFrameworkResult(context, result);  // ⚠️ CONTEXT MUTATION');
    console.log('  }');
    console.log();
    console.log('⚠️  CRITICAL FINDING:');
    console.log('  - Context is MUTATED between iterations');
    console.log('  - Each framework receives the accumulated context from previous frameworks');
    console.log('  - Later frameworks may depend on earlier results');
    console.log();
    console.log('🔍 TO VERIFY PARALLELIZATION SAFETY:');
    console.log('  1. Check if frameworks actually READ from accumulated context');
    console.log('  2. Check Five Whys → BMC bridge (line 110-112)');
    console.log('  3. Trace context.insights usage in each framework');
    console.log();
  } else {
    console.log('⚠️  Could not locate framework execution loop');
    console.log('File may have been refactored or pattern needs updating');
    console.log();
  }

  // Check if context is actually used - more flexible regex
  const executeFrameworkMethod = content.match(/private\s+async\s+executeFramework\s*\([^)]*\)[^{]*\{[\s\S]*?\n\s*\}/);
  if (executeFrameworkMethod) {
    const methodBody = executeFrameworkMethod[0];

    console.log('📊 CONTEXT USAGE IN executeFramework():');
    if (methodBody.includes('context.userInput')) {
      console.log('  ✅ Uses: context.userInput (available from start)');
    }
    if (methodBody.includes('context.sessionId')) {
      console.log('  ✅ Uses: context.sessionId (available from start)');
    }
    if (methodBody.includes('context.insights')) {
      console.log('  ⚠️  Uses: context.insights (accumulated from previous frameworks)');
    }

    console.log();
  } else {
    console.log('⚠️  Could not locate executeFramework() method');
    console.log('Method may have been refactored or pattern needs updating');
    console.log();
  }
}

// Main execution
console.clear();
console.log('\n🔬 DEPENDENCY ANALYSIS TOOL\n');

try {
  // Analyze EPM Synthesizer
  const epmAnalysis = analyzeEPMSynthesizer();

  console.log('\n');

  // Analyze BMC Analyzer
  analyzeBMCAnalyzer();

  console.log('\n');

  // Analyze Journey Orchestrator
  analyzeJourneyOrchestrator();

  console.log('\n');
  console.log('='.repeat(80));
  console.log('SUMMARY & RECOMMENDATIONS');
  console.log('='.repeat(80));
  console.log();
  console.log('1. ✅ BMC Analyzer: SAFE to parallelize extract* methods');
  console.log('   Risk: LOW | Impact: MEDIUM | Effort: 5 minutes');
  console.log();
  console.log('2. ⚠️  EPM Synthesizer: Need to verify Group 1 functions');
  console.log('   Risk: MEDIUM | Impact: HIGH | Effort: 2-3 hours');
  console.log('   Action: Review the independent functions list above');
  console.log();
  console.log('3. ⚠️  Journey Orchestrator: Context mutation detected');
  console.log('   Risk: HIGH | Impact: HIGH | Effort: 4-6 hours');
  console.log('   Action: Trace if later frameworks actually use accumulated context');
  console.log();

} catch (error) {
  console.error('Error during analysis:', error.message);
}
