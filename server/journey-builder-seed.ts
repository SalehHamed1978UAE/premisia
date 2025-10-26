import { db } from "./db";
import { journeyTemplates, frameworkRegistry } from "@shared/schema";
import type { JourneyStep } from "@shared/journey-types";
import { eq } from "drizzle-orm";

/**
 * Journey Builder Seed Data
 * 
 * PURPOSE: Initialize system with 6 pre-defined journey templates and 7 frameworks
 * 
 * SYSTEM TEMPLATES:
 * 1. Business Model Innovation
 * 2. Digital Transformation
 * 3. Market Entry
 * 4. Competitive Strategy
 * 5. Crisis Recovery
 * 6. Growth Strategy
 */

/**
 * Define the 7 available frameworks
 */
const FRAMEWORKS = [
  {
    frameworkKey: 'strategic_understanding',
    name: 'Strategic Understanding',
    description: 'Build strategic context and foundational knowledge graph',
    category: 'Foundation',
    estimatedDuration: 5,
    difficulty: 'beginner' as const,
    requiredInputs: ['user_business_description'],
    providedOutputs: ['strategic_context', 'company_context', 'goals', 'assumptions'],
    processorPath: '/api/strategic-understanding',
  },
  {
    frameworkKey: 'five_whys',
    name: '5 Whys Analysis',
    description: 'Root cause analysis to uncover assumptions',
    category: 'Problem Analysis',
    estimatedDuration: 8,
    difficulty: 'beginner' as const,
    requiredInputs: ['problem_statement'],
    providedOutputs: ['root_causes', 'causal_chains', 'assumptions_validated'],
    processorPath: '/api/strategic-consultant/five-whys',
  },
  {
    frameworkKey: 'business_model_canvas',
    name: 'Business Model Canvas',
    description: 'Validate business model across 9 building blocks',
    category: 'Business Model',
    estimatedDuration: 12,
    difficulty: 'intermediate' as const,
    requiredInputs: ['strategic_context'],
    providedOutputs: ['business_model', 'value_proposition', 'customer_segments', 'revenue_streams'],
    processorPath: '/api/strategic-consultant/bmc',
  },
  {
    frameworkKey: 'porters_five_forces',
    name: "Porter's Five Forces",
    description: 'Analyze competitive dynamics and industry attractiveness',
    category: 'Competition',
    estimatedDuration: 10,
    difficulty: 'intermediate' as const,
    requiredInputs: ['strategic_context', 'industry_context'],
    providedOutputs: ['competitive_analysis', 'industry_attractiveness', 'competitive_threats'],
    processorPath: '/api/strategic-consultant/porters',
  },
  {
    frameworkKey: 'pestle',
    name: 'PESTLE Analysis',
    description: 'Analyze macro-environmental factors and trends',
    category: 'External Environment',
    estimatedDuration: 10,
    difficulty: 'intermediate' as const,
    requiredInputs: ['strategic_context'],
    providedOutputs: ['macro_environment', 'trends', 'external_factors'],
    processorPath: '/api/strategic-consultant/pestle',
  },
  {
    frameworkKey: 'swot',
    name: 'SWOT Analysis',
    description: 'Identify strengths, weaknesses, opportunities, and threats',
    category: 'Strategic Position',
    estimatedDuration: 8,
    difficulty: 'beginner' as const,
    requiredInputs: ['strategic_context'],
    providedOutputs: ['strengths', 'weaknesses', 'opportunities', 'threats'],
    processorPath: '/api/strategic-consultant/swot',
  },
  {
    frameworkKey: 'strategic_decisions',
    name: 'Strategic Decisions',
    description: 'Make key strategic choices and set priorities',
    category: 'Decision Making',
    estimatedDuration: 7,
    difficulty: 'intermediate' as const,
    requiredInputs: ['strategic_context', 'analysis_results'],
    providedOutputs: ['strategic_decisions', 'risk_tolerance', 'priorities', 'go_decision'],
    processorPath: '/api/strategy-workspace/decisions',
  },
];

/**
 * Define the 6 system templates
 */
const SYSTEM_TEMPLATES = [
  {
    name: 'Business Model Innovation',
    description: 'Design and validate a new or improved business model with deep market research',
    category: 'Innovation',
    difficulty: 'intermediate' as const,
    tags: ['business_model', 'innovation', 'validation'],
    steps: [
      {
        id: 'step_su_1',
        frameworkKey: 'strategic_understanding',
        name: 'Strategic Understanding',
        description: 'Build foundational knowledge graph',
        required: true,
        skippable: false,
        estimatedDuration: 5,
        order: 1,
      },
      {
        id: 'step_5w_1',
        frameworkKey: 'five_whys',
        name: '5 Whys Analysis',
        description: 'Uncover root problems and assumptions',
        required: true,
        skippable: false,
        dependsOn: ['step_su_1'],
        estimatedDuration: 8,
        order: 2,
      },
      {
        id: 'step_bmc_1',
        frameworkKey: 'business_model_canvas',
        name: 'Business Model Canvas',
        description: 'Design and validate business model',
        required: true,
        skippable: false,
        dependsOn: ['step_5w_1'],
        estimatedDuration: 12,
        order: 3,
      },
      {
        id: 'step_sd_1',
        frameworkKey: 'strategic_decisions',
        name: 'Strategic Decisions',
        description: 'Make final strategic choices',
        required: true,
        skippable: false,
        dependsOn: ['step_bmc_1'],
        estimatedDuration: 7,
        order: 4,
      },
    ] as JourneyStep[],
  },
  {
    name: 'Digital Transformation',
    description: 'Navigate digital transformation with technology adoption and change management',
    category: 'Transformation',
    difficulty: 'advanced' as const,
    tags: ['digital', 'transformation', 'technology'],
    steps: [
      {
        id: 'step_su_2',
        frameworkKey: 'strategic_understanding',
        name: 'Strategic Understanding',
        required: true,
        skippable: false,
        estimatedDuration: 5,
        order: 1,
      },
      {
        id: 'step_pestle_2',
        frameworkKey: 'pestle',
        name: 'PESTLE Analysis',
        description: 'Analyze technological and regulatory trends',
        required: true,
        skippable: false,
        dependsOn: ['step_su_2'],
        estimatedDuration: 10,
        order: 2,
      },
      {
        id: 'step_bmc_2',
        frameworkKey: 'business_model_canvas',
        name: 'Business Model Canvas',
        description: 'Design digital-first business model',
        required: true,
        skippable: false,
        dependsOn: ['step_pestle_2'],
        estimatedDuration: 12,
        order: 3,
      },
      {
        id: 'step_sd_2',
        frameworkKey: 'strategic_decisions',
        name: 'Strategic Decisions',
        required: true,
        skippable: false,
        dependsOn: ['step_bmc_2'],
        estimatedDuration: 7,
        order: 4,
      },
    ] as JourneyStep[],
  },
  {
    name: 'Market Entry',
    description: 'Analyze new market opportunities and plan successful market entry',
    category: 'Growth',
    difficulty: 'intermediate' as const,
    tags: ['market_entry', 'expansion', 'competition'],
    steps: [
      {
        id: 'step_su_3',
        frameworkKey: 'strategic_understanding',
        name: 'Strategic Understanding',
        required: true,
        skippable: false,
        estimatedDuration: 5,
        order: 1,
      },
      {
        id: 'step_pestle_3',
        frameworkKey: 'pestle',
        name: 'PESTLE Analysis',
        description: 'Understand target market environment',
        required: true,
        skippable: false,
        dependsOn: ['step_su_3'],
        estimatedDuration: 10,
        order: 2,
      },
      {
        id: 'step_porters_3',
        frameworkKey: 'porters_five_forces',
        name: "Porter's Five Forces",
        description: 'Analyze competitive landscape',
        required: true,
        skippable: false,
        dependsOn: ['step_pestle_3'],
        estimatedDuration: 10,
        order: 3,
      },
      {
        id: 'step_bmc_3',
        frameworkKey: 'business_model_canvas',
        name: 'Business Model Canvas',
        description: 'Design market entry business model',
        required: true,
        skippable: false,
        dependsOn: ['step_porters_3'],
        estimatedDuration: 12,
        order: 4,
      },
      {
        id: 'step_sd_3',
        frameworkKey: 'strategic_decisions',
        name: 'Strategic Decisions',
        required: true,
        skippable: false,
        dependsOn: ['step_bmc_3'],
        estimatedDuration: 7,
        order: 5,
      },
    ] as JourneyStep[],
  },
  {
    name: 'Competitive Strategy',
    description: 'Build competitive advantage through deep industry and competitor analysis',
    category: 'Competition',
    difficulty: 'advanced' as const,
    tags: ['competition', 'strategy', 'positioning'],
    steps: [
      {
        id: 'step_su_4',
        frameworkKey: 'strategic_understanding',
        name: 'Strategic Understanding',
        required: true,
        skippable: false,
        estimatedDuration: 5,
        order: 1,
      },
      {
        id: 'step_porters_4',
        frameworkKey: 'porters_five_forces',
        name: "Porter's Five Forces",
        description: 'Deep competitive analysis',
        required: true,
        skippable: false,
        dependsOn: ['step_su_4'],
        estimatedDuration: 10,
        order: 2,
      },
      {
        id: 'step_swot_4',
        frameworkKey: 'swot',
        name: 'SWOT Analysis',
        description: 'Assess competitive position',
        required: true,
        skippable: false,
        dependsOn: ['step_porters_4'],
        estimatedDuration: 8,
        order: 3,
      },
      {
        id: 'step_bmc_4',
        frameworkKey: 'business_model_canvas',
        name: 'Business Model Canvas',
        description: 'Design differentiated business model',
        required: true,
        skippable: false,
        dependsOn: ['step_swot_4'],
        estimatedDuration: 12,
        order: 4,
      },
      {
        id: 'step_sd_4',
        frameworkKey: 'strategic_decisions',
        name: 'Strategic Decisions',
        required: true,
        skippable: false,
        dependsOn: ['step_bmc_4'],
        estimatedDuration: 7,
        order: 5,
      },
    ] as JourneyStep[],
  },
  {
    name: 'Crisis Recovery',
    description: 'Navigate crisis situations with rapid problem analysis and recovery planning',
    category: 'Recovery',
    difficulty: 'advanced' as const,
    tags: ['crisis', 'recovery', 'turnaround'],
    steps: [
      {
        id: 'step_su_5',
        frameworkKey: 'strategic_understanding',
        name: 'Strategic Understanding',
        required: true,
        skippable: false,
        estimatedDuration: 5,
        order: 1,
      },
      {
        id: 'step_5w_5',
        frameworkKey: 'five_whys',
        name: '5 Whys Analysis',
        description: 'Identify root causes of crisis',
        required: true,
        skippable: false,
        dependsOn: ['step_su_5'],
        estimatedDuration: 8,
        order: 2,
      },
      {
        id: 'step_swot_5',
        frameworkKey: 'swot',
        name: 'SWOT Analysis',
        description: 'Assess current position and opportunities',
        required: true,
        skippable: false,
        dependsOn: ['step_5w_5'],
        estimatedDuration: 8,
        order: 3,
      },
      {
        id: 'step_bmc_5',
        frameworkKey: 'business_model_canvas',
        name: 'Business Model Canvas',
        description: 'Redesign for recovery',
        required: true,
        skippable: false,
        dependsOn: ['step_swot_5'],
        estimatedDuration: 12,
        order: 4,
      },
      {
        id: 'step_sd_5',
        frameworkKey: 'strategic_decisions',
        name: 'Strategic Decisions',
        required: true,
        skippable: false,
        dependsOn: ['step_bmc_5'],
        estimatedDuration: 7,
        order: 5,
      },
    ] as JourneyStep[],
  },
  {
    name: 'Growth Strategy',
    description: 'Plan sustainable growth with market analysis and business model optimization',
    category: 'Growth',
    difficulty: 'intermediate' as const,
    tags: ['growth', 'scaling', 'expansion'],
    steps: [
      {
        id: 'step_su_6',
        frameworkKey: 'strategic_understanding',
        name: 'Strategic Understanding',
        required: true,
        skippable: false,
        estimatedDuration: 5,
        order: 1,
      },
      {
        id: 'step_swot_6',
        frameworkKey: 'swot',
        name: 'SWOT Analysis',
        description: 'Identify growth opportunities',
        required: true,
        skippable: false,
        dependsOn: ['step_su_6'],
        estimatedDuration: 8,
        order: 2,
      },
      {
        id: 'step_pestle_6',
        frameworkKey: 'pestle',
        name: 'PESTLE Analysis',
        description: 'Analyze growth environment',
        required: true,
        skippable: false,
        dependsOn: ['step_swot_6'],
        estimatedDuration: 10,
        order: 3,
      },
      {
        id: 'step_bmc_6',
        frameworkKey: 'business_model_canvas',
        name: 'Business Model Canvas',
        description: 'Optimize for scaling',
        required: true,
        skippable: false,
        dependsOn: ['step_pestle_6'],
        estimatedDuration: 12,
        order: 4,
      },
      {
        id: 'step_sd_6',
        frameworkKey: 'strategic_decisions',
        name: 'Strategic Decisions',
        required: true,
        skippable: false,
        dependsOn: ['step_bmc_6'],
        estimatedDuration: 7,
        order: 5,
      },
    ] as JourneyStep[],
  },
];

/**
 * Seed the Journey Builder system
 */
export async function seedJourneyBuilder() {
  console.log('[Journey Builder Seed] Starting seed process...');

  try {
    // =========================================================================
    // STEP 1: Seed Framework Registry
    // =========================================================================
    console.log('[Journey Builder Seed] Seeding framework registry...');

    for (const framework of FRAMEWORKS) {
      // Check if exists
      const existing = await db
        .select()
        .from(frameworkRegistry)
        .where(eq(frameworkRegistry.frameworkKey, framework.frameworkKey));

      if (existing.length === 0) {
        await db.insert(frameworkRegistry).values(framework);
        console.log(`  ✓ Registered: ${framework.name}`);
      } else {
        console.log(`  - Already exists: ${framework.name}`);
      }
    }

    console.log('[Journey Builder Seed] ✓ Framework registry seeded');

    // =========================================================================
    // STEP 2: Seed System Templates
    // =========================================================================
    console.log('[Journey Builder Seed] Seeding system templates...');

    for (const template of SYSTEM_TEMPLATES) {
      // Check if exists
      const existing = await db
        .select()
        .from(journeyTemplates)
        .where(eq(journeyTemplates.name, template.name));

      if (existing.length === 0) {
        const estimatedDuration = template.steps.reduce((total, step) => {
          return total + (step.estimatedDuration || 0);
        }, 0);

        await db.insert(journeyTemplates).values({
          name: template.name,
          description: template.description,
          isSystemTemplate: true,
          steps: template.steps as any,
          category: template.category,
          tags: template.tags as any,
          estimatedDuration,
          difficulty: template.difficulty,
        });

        console.log(`  ✓ Created: ${template.name} (${template.steps.length} steps, ~${estimatedDuration} min)`);
      } else {
        console.log(`  - Already exists: ${template.name}`);
      }
    }

    console.log('[Journey Builder Seed] ✓ System templates seeded');

    console.log('[Journey Builder Seed] 🎉 Seed complete!');
    console.log(`  - ${FRAMEWORKS.length} frameworks registered`);
    console.log(`  - ${SYSTEM_TEMPLATES.length} system templates created`);
  } catch (error) {
    console.error('[Journey Builder Seed] ❌ Seed failed:', error);
    throw error;
  }
}

// Allow manual execution
if (import.meta.url === `file://${process.argv[1]}`) {
  seedJourneyBuilder()
    .then(() => {
      console.log('Seed completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
