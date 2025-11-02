#!/usr/bin/env tsx

import { JOURNEYS } from '../server/journey/journey-registry';
import { summaryBuilders } from '../server/services/journey-summary-service';
import type { JourneyType } from '../shared/journey-types';
import { writeFile } from 'fs/promises';
import { join } from 'path';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalJourneys: number;
    journeysWithSummaryBuilders: number;
    journeysWithReadiness: number;
    journeysWithDependencies: number;
  };
}

async function validateRegistry(): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      totalJourneys: 0,
      journeysWithSummaryBuilders: 0,
      journeysWithReadiness: 0,
      journeysWithDependencies: 0,
    }
  };

  const journeyTypes = Object.keys(JOURNEYS) as JourneyType[];
  result.stats.totalJourneys = journeyTypes.length;

  console.log('\n🔍 Validating Journey Registry...\n');

  for (const journeyType of journeyTypes) {
    const journey = JOURNEYS[journeyType];
    const prefix = `[${journeyType}]`;

    // Validate that journey.type matches the registry key (consistency check)
    if (journey.type !== journeyType) {
      result.errors.push(`${prefix} Type mismatch: journey.type is '${journey.type}' but registry key is '${journeyType}'`);
      result.valid = false;
    }

    if (!journey.name || journey.name.trim() === '') {
      result.errors.push(`${prefix} Missing name`);
      result.valid = false;
    }

    if (!journey.description || journey.description.trim() === '') {
      result.errors.push(`${prefix} Missing description`);
      result.valid = false;
    }

    if (!journey.frameworks || journey.frameworks.length === 0) {
      result.errors.push(`${prefix} Missing or empty frameworks array`);
      result.valid = false;
    }

    if (!journey.summaryBuilder || journey.summaryBuilder.trim() === '') {
      result.errors.push(`${prefix} Missing summaryBuilder`);
      result.valid = false;
    } else {
      // Check if summary builder exists by name
      if (summaryBuilders[journey.summaryBuilder]) {
        result.stats.journeysWithSummaryBuilders++;
        console.log(`  ✓ ${prefix} Summary builder '${journey.summaryBuilder}' registered`);
      } else {
        result.errors.push(`${prefix} Summary builder '${journey.summaryBuilder}' declared but not found in registry`);
        result.valid = false;
      }
    }

    if (!journey.defaultReadiness) {
      result.warnings.push(`${prefix} Missing defaultReadiness - will use system defaults`);
    } else {
      result.stats.journeysWithReadiness++;
      if (journey.defaultReadiness.minReferences === undefined || journey.defaultReadiness.minEntities === undefined) {
        result.errors.push(`${prefix} defaultReadiness must include both minReferences and minEntities`);
        result.valid = false;
      }
      console.log(`  ✓ ${prefix} Readiness thresholds: refs=${journey.defaultReadiness.minReferences}, entities=${journey.defaultReadiness.minEntities}`);
    }

    if (journey.insightsConfig) {
      if (journey.insightsConfig.expectedInsightTypes && journey.insightsConfig.expectedInsightTypes.length > 0) {
        console.log(`  ✓ ${prefix} Insights config: ${journey.insightsConfig.expectedInsightTypes.length} expected types`);
      }
    }

    if (journey.dependencies && journey.dependencies.length > 0) {
      result.stats.journeysWithDependencies++;
      const deps = journey.dependencies.map(d => `${d.from}→${d.to}`).join(', ');
      console.log(`  ✓ ${prefix} Dependencies: ${deps}`);
    }
  }

  return result;
}

async function generateDocumentation(outputPath: string): Promise<void> {
  const journeyTypes = Object.keys(JOURNEYS) as JourneyType[];
  
  let markdown = `# Journey Registry Documentation\n\n`;
  markdown += `**Generated:** ${new Date().toISOString()}\n\n`;
  markdown += `**Total Journeys:** ${journeyTypes.length}\n\n`;
  markdown += `---\n\n`;

  for (const journeyType of journeyTypes) {
    const journey = JOURNEYS[journeyType];
    
    markdown += `## ${journey.name}\n\n`;
    markdown += `**Type:** \`${journeyType}\`\n\n`;
    markdown += `**Description:** ${journey.description}\n\n`;
    markdown += `**Status:** ${journey.available ? '✅ Available' : '⏸️ Not Yet Implemented'}\n\n`;
    markdown += `**Estimated Duration:** ${journey.estimatedDuration}\n\n`;
    
    markdown += `### Framework Sequence\n\n`;
    markdown += journey.frameworks.map((f, i) => `${i + 1}. ${f}`).join('\n') + '\n\n';
    
    markdown += `### Summary Builder\n\n`;
    markdown += `\`${journey.summaryBuilder}\`\n\n`;
    
    if (journey.defaultReadiness) {
      markdown += `### Readiness Thresholds\n\n`;
      markdown += `- **Minimum References:** ${journey.defaultReadiness.minReferences}\n`;
      markdown += `- **Minimum Entities:** ${journey.defaultReadiness.minEntities}\n\n`;
    }
    
    if (journey.insightsConfig) {
      markdown += `### Insights Configuration\n\n`;
      if (journey.insightsConfig.expectedInsightTypes) {
        markdown += `**Expected Insight Types:**\n`;
        markdown += journey.insightsConfig.expectedInsightTypes.map(t => `- ${t}`).join('\n') + '\n\n';
      }
      if (journey.insightsConfig.minInsights !== undefined) {
        markdown += `**Minimum Insights:** ${journey.insightsConfig.minInsights}\n\n`;
      }
    }
    
    if (journey.dependencies && journey.dependencies.length > 0) {
      markdown += `### Dependencies\n\n`;
      markdown += `This journey builds upon data from previous frameworks:\n`;
      markdown += journey.dependencies.map(d => `- \`${d.from}\` → \`${d.to}\``).join('\n') + '\n\n';
    }
    
    markdown += `---\n\n`;
  }

  await writeFile(outputPath, markdown, 'utf-8');
  console.log(`\n📄 Documentation generated: ${outputPath}`);
}

async function generateTypeValidation(outputPath: string): Promise<void> {
  const journeyTypes = Object.keys(JOURNEYS) as JourneyType[];
  
  let typescript = `// AUTO-GENERATED - DO NOT EDIT\n`;
  typescript += `// Generated by scripts/sync-journeys.ts\n\n`;
  typescript += `import type { JourneyType } from '../shared/journey-types';\n\n`;
  
  typescript += `/**\n`;
  typescript += ` * All registered journey types.\n`;
  typescript += ` * Update server/journey/journey-registry.ts to add new journeys.\n`;
  typescript += ` */\n`;
  typescript += `export const REGISTERED_JOURNEY_TYPES = [\n`;
  journeyTypes.forEach(type => {
    typescript += `  '${type}',\n`;
  });
  typescript += `] as const;\n\n`;
  
  typescript += `export type RegisteredJourneyType = typeof REGISTERED_JOURNEY_TYPES[number];\n\n`;
  
  typescript += `/**\n`;
  typescript += ` * Validates that a journey type is registered.\n`;
  typescript += ` */\n`;
  typescript += `export function isRegisteredJourneyType(type: string): type is RegisteredJourneyType {\n`;
  typescript += `  return REGISTERED_JOURNEY_TYPES.includes(type as RegisteredJourneyType);\n`;
  typescript += `}\n`;

  await writeFile(outputPath, typescript, 'utf-8');
  console.log(`📦 Type validation generated: ${outputPath}`);
}

async function checkSummaryBuilderCoverage(): Promise<void> {
  console.log('\n📊 Summary Builder Coverage:\n');
  
  const journeyTypes = Object.keys(JOURNEYS) as JourneyType[];
  const registeredBuilders = Object.keys(summaryBuilders);
  
  const missing: string[] = [];
  const extra: string[] = [];
  const usedBuilders = new Set<string>();
  
  // Check which builders are actually used by journeys
  for (const type of journeyTypes) {
    const journey = JOURNEYS[type];
    usedBuilders.add(journey.summaryBuilder);
    if (!summaryBuilders[journey.summaryBuilder]) {
      missing.push(`${type} (needs '${journey.summaryBuilder}')`);
    }
  }
  
  // Check for unused builders
  for (const builder of registeredBuilders) {
    if (!usedBuilders.has(builder)) {
      extra.push(builder);
    }
  }
  
  if (missing.length === 0 && extra.length === 0) {
    console.log('  ✅ Perfect alignment - all journeys have summary builders');
  } else {
    if (missing.length > 0) {
      console.log('  ⚠️  Missing builders:', missing.join(', '));
    }
    if (extra.length > 0) {
      console.log('  ℹ️  Unused builders (orphaned):', extra.join(', '));
    }
  }
}

async function main() {
  console.log('🚀 Journey Registry Sync Tool\n');
  console.log('This tool validates the journey registry and generates artifacts.\n');

  const validation = await validateRegistry();
  
  console.log('\n📈 Statistics:\n');
  console.log(`  Total Journeys: ${validation.stats.totalJourneys}`);
  console.log(`  With Summary Builders: ${validation.stats.journeysWithSummaryBuilders}`);
  console.log(`  With Readiness Config: ${validation.stats.journeysWithReadiness}`);
  console.log(`  With Dependencies: ${validation.stats.journeysWithDependencies}`);

  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Warnings:\n');
    validation.warnings.forEach(w => console.log(`  ${w}`));
  }

  if (validation.errors.length > 0) {
    console.log('\n❌ Errors:\n');
    validation.errors.forEach(e => console.log(`  ${e}`));
    console.log('\n❌ Validation failed. Please fix errors above.\n');
    process.exit(1);
  }

  await checkSummaryBuilderCoverage();

  const docsPath = join(process.cwd(), 'docs', 'JOURNEY_REGISTRY.md');
  await generateDocumentation(docsPath);

  const typesPath = join(process.cwd(), 'server', 'journey', 'journey-registry.generated.ts');
  await generateTypeValidation(typesPath);

  console.log('\n✅ Journey registry sync completed successfully!\n');
  console.log('📋 Next steps:\n');
  console.log('  1. Review generated documentation: docs/JOURNEY_REGISTRY.md');
  console.log('  2. Review generated types: server/journey/journey-registry.generated.ts');
  console.log('  3. Add new journeys to server/journey/journey-registry.ts');
  console.log('  4. Run `npm run journeys:sync` after changes\n');
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
