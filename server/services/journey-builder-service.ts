import { db } from "../db";
import { journeyTemplates, userJourneys, frameworkRegistry } from "@shared/schema";
import type { InsertJourneyTemplate, InsertUserJourney, InsertFrameworkRegistry } from "@shared/schema";
import type { JourneyStep, JourneyTemplate, UserJourney, Framework } from "@shared/journey-types";
import { eq, desc } from "drizzle-orm";
import { JourneyOrchestrator } from "../journey/journey-orchestrator";

/**
 * Journey Builder Service
 * 
 * PURPOSE: Manages journey templates and user journey instances
 * 
 * KEY CONCEPTS:
 * - Templates = Pre-defined or custom journey blueprints
 * - User Journeys = Active instances of templates
 * - Each journey creates its own knowledge graph (isolated)
 */
export class JourneyBuilderService {
  /**
   * Create a new journey template
   * Used for both system templates (pre-defined) and custom user journeys
   */
  async createTemplate(params: {
    name: string;
    description?: string;
    steps: JourneyStep[];
    category?: string;
    tags?: string[];
    isSystemTemplate?: boolean;
    createdBy?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
  }): Promise<string> {
    console.log('[Journey Builder] Creating template:', params.name);

    // Validate steps structure
    this.validateSteps(params.steps);

    // Calculate estimated duration
    const estimatedDuration = params.steps.reduce((total, step) => {
      return total + (step.estimatedDuration || 0);
    }, 0);

    const [template] = await db.insert(journeyTemplates).values({
      name: params.name,
      description: params.description,
      steps: params.steps as any,
      category: params.category,
      tags: params.tags as any,
      isSystemTemplate: params.isSystemTemplate || false,
      createdBy: params.createdBy,
      estimatedDuration,
      difficulty: params.difficulty,
    }).returning();

    console.log('[Journey Builder] ✓ Template created:', template.id);

    return template.id;
  }

  /**
   * Start a journey from a template or custom steps
   * Creates a new knowledge graph for this journey
   */
  async startJourney(params: {
    userId: string;
    templateId?: string;
    customSteps?: JourneyStep[];
    name?: string;
  }): Promise<{ journeyId: string; sessionId: string }> {
    console.log('[Journey Builder] Starting journey for user:', params.userId);

    let steps: JourneyStep[];
    let name: string;
    let templateId: string | undefined;

    if (params.templateId) {
      // Load from template
      const [template] = await db
        .select()
        .from(journeyTemplates)
        .where(eq(journeyTemplates.id, params.templateId));

      if (!template) {
        throw new Error(`Template not found: ${params.templateId}`);
      }

      steps = template.steps as JourneyStep[];
      name = params.name || template.name;
      templateId = template.id;

      // Increment usage count
      await db
        .update(journeyTemplates)
        .set({ usageCount: template.usageCount + 1 })
        .where(eq(journeyTemplates.id, template.id));
    } else if (params.customSteps) {
      // Use custom steps
      this.validateSteps(params.customSteps);
      steps = params.customSteps;
      name = params.name || 'Custom Journey';
      templateId = undefined;
    } else {
      throw new Error('Must provide either templateId or customSteps');
    }

    // Generate unique session ID for this journey's knowledge graph
    const sessionId = `journey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create user journey instance
    const [journey] = await db.insert(userJourneys).values({
      userId: params.userId,
      sessionId,
      templateId,
      name,
      steps: steps as any,
      currentStepIndex: 0,
      status: 'in_progress',
    }).returning();

    console.log('[Journey Builder] ✓ Journey started:', {
      journeyId: journey.id,
      sessionId: journey.sessionId,
      steps: steps.length,
      note: 'Each journey creates its own isolated knowledge graph',
    });

    return {
      journeyId: journey.id,
      sessionId: journey.sessionId,
    };
  }

  /**
   * Get journey by session ID
   */
  async getJourney(sessionId: string): Promise<UserJourney | null> {
    const [journey] = await db
      .select()
      .from(userJourneys)
      .where(eq(userJourneys.sessionId, sessionId));

    if (!journey) {
      return null;
    }

    return {
      ...journey,
      steps: journey.steps as JourneyStep[],
      completedSteps: journey.completedSteps as string[],
      stepResults: journey.stepResults as Record<string, any>,
      journeyContext: journey.journeyContext as Record<string, any>,
    } as UserJourney;
  }

  /**
   * Complete a step and advance to next
   * Updates journey context which feeds into knowledge graph
   */
  async completeStep(params: {
    sessionId: string;
    stepId: string;
    result: any;
    contextUpdates?: Record<string, any>;
  }): Promise<{ completed: boolean; nextStepIndex: number | null }> {
    console.log('[Journey Builder] Completing step:', params.stepId);

    const journey = await this.getJourney(params.sessionId);

    if (!journey) {
      throw new Error(`Journey not found: ${params.sessionId}`);
    }

    // Find step
    const stepIndex = journey.steps.findIndex(s => s.id === params.stepId);

    if (stepIndex === -1) {
      throw new Error(`Step not found: ${params.stepId}`);
    }

    // Update journey
    const completedSteps = [...journey.completedSteps, params.stepId];
    const stepResults = { ...journey.stepResults, [params.stepId]: params.result };
    const journeyContext = { ...journey.journeyContext, ...params.contextUpdates };

    // Find next step index
    let nextStepIndex = stepIndex + 1;
    if (nextStepIndex >= journey.steps.length) {
      nextStepIndex = -1; // Journey complete
    }

    // Update database
    const updateData: any = {
      completedSteps: completedSteps as any,
      stepResults: stepResults as any,
      journeyContext: journeyContext as any,
      lastActivityAt: new Date(),
    };

    if (nextStepIndex === -1) {
      // Journey complete
      updateData.status = 'completed';
      updateData.completedAt = new Date();
      updateData.currentStepIndex = journey.steps.length;
      console.log('[Journey Builder] 🎉 Journey completed! Knowledge graph is complete.');
    } else {
      updateData.currentStepIndex = nextStepIndex;
    }

    await db
      .update(userJourneys)
      .set(updateData)
      .where(eq(userJourneys.sessionId, params.sessionId));

    console.log('[Journey Builder] ✓ Step completed:', {
      stepId: params.stepId,
      nextStepIndex: nextStepIndex === -1 ? null : nextStepIndex,
      journeyComplete: nextStepIndex === -1,
    });

    return {
      completed: nextStepIndex === -1,
      nextStepIndex: nextStepIndex === -1 ? null : nextStepIndex,
    };
  }

  /**
   * Register a framework in the registry
   */
  async registerFramework(params: {
    frameworkKey: string;
    name: string;
    description?: string;
    category?: string;
    estimatedDuration?: number;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    requiredInputs: string[];
    providedOutputs: string[];
    processorPath?: string;
  }): Promise<string> {
    console.log('[Journey Builder] Registering framework:', params.frameworkKey);

    const [framework] = await db.insert(frameworkRegistry).values({
      frameworkKey: params.frameworkKey,
      name: params.name,
      description: params.description,
      category: params.category,
      estimatedDuration: params.estimatedDuration,
      difficulty: params.difficulty,
      requiredInputs: params.requiredInputs as any,
      providedOutputs: params.providedOutputs as any,
      processorPath: params.processorPath,
    }).returning();

    console.log('[Journey Builder] ✓ Framework registered:', framework.id);

    return framework.id;
  }

  /**
   * Get all available templates
   */
  async getTemplates(params?: {
    category?: string;
    userId?: string;
  }): Promise<JourneyTemplate[]> {
    const templates = await db.select().from(journeyTemplates);

    return templates.map((t): JourneyTemplate => ({
      ...t,
      steps: t.steps as JourneyStep[],
      tags: t.tags as string[],
    } as JourneyTemplate));
  }

  /**
   * Get templates created by a specific user (custom journeys from wizard)
   */
  async getUserTemplates(userId: string): Promise<JourneyTemplate[]> {
    const templates = await db
      .select()
      .from(journeyTemplates)
      .where(eq(journeyTemplates.createdBy, userId))
      .orderBy(desc(journeyTemplates.createdAt));

    return templates.map((t): JourneyTemplate => ({
      ...t,
      steps: t.steps as JourneyStep[],
      tags: t.tags as string[],
    } as JourneyTemplate));
  }

  /**
   * Get all registered frameworks (user-selectable only)
   */
  async getFrameworks(): Promise<Framework[]> {
    const frameworks = await db
      .select()
      .from(frameworkRegistry)
      .where(eq(frameworkRegistry.isActive, true));

    return frameworks.map((f): Framework => ({
      ...f,
      requiredInputs: f.requiredInputs as string[],
      providedOutputs: f.providedOutputs as string[],
    } as Framework));
  }

  /**
   * Validate journey steps structure
   */
  private validateSteps(steps: JourneyStep[]): void {
    if (!steps || steps.length === 0) {
      throw new Error('Journey must have at least one step');
    }

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const step of steps) {
      if (ids.has(step.id)) {
        throw new Error(`Duplicate step ID: ${step.id}`);
      }
      ids.add(step.id);
    }

    // Validate dependencies
    for (const step of steps) {
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          if (!ids.has(depId)) {
            throw new Error(`Step ${step.id} depends on non-existent step: ${depId}`);
          }
        }
      }
    }
  }

  /**
   * Get a template by its ID
   */
  async getTemplateById(templateId: string): Promise<JourneyTemplate | null> {
    const [template] = await db
      .select()
      .from(journeyTemplates)
      .where(eq(journeyTemplates.id, templateId));

    if (!template) {
      return null;
    }

    return {
      ...template,
      steps: template.steps as JourneyStep[],
      tags: template.tags as string[],
    } as JourneyTemplate;
  }

  /**
   * Start a custom journey execution from a template
   * Uses JourneyOrchestrator to create a proper journey session with framework sequence
   */
  async startCustomJourneyExecution(params: {
    userId: string;
    understandingId: string;
    templateId: string;
  }): Promise<{ journeySessionId: string; firstFramework: string; versionNumber: number }> {
    console.log('[Journey Builder] Starting custom journey execution for understanding:', params.understandingId);

    // Get the template
    const template = await this.getTemplateById(params.templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Verify ownership for non-system templates
    if (!template.isSystemTemplate && template.createdBy && template.createdBy !== params.userId) {
      console.warn('[Journey Builder] Unauthorized access attempt to template:', params.templateId, 'by user:', params.userId);
      throw new Error('Not authorized to use this template');
    }

    if (!template.steps || template.steps.length === 0) {
      throw new Error('Template has no steps');
    }

    // Map template framework keys to executor registry keys
    // Templates may use longer names like 'business_model_canvas' but executors use 'bmc'
    const frameworkKeyMap: Record<string, string> = {
      'business_model_canvas': 'bmc',
      'porters_five_forces': 'porters',
      'strategic_decisions': 'strategic_decisions', // Pass through (not executed)
    };

    // Convert ALL template steps to normalized framework names (for navigation tracking)
    const allSteps = template.steps
      .filter(step => step.frameworkKey !== 'strategic_understanding') // Only filter out intake step
      .map(step => frameworkKeyMap[step.frameworkKey] || step.frameworkKey);

    // Filter to only executable frameworks (for AI analysis)
    const nonExecutableSteps = ['strategic_decisions'];
    const executableFrameworks = allSteps.filter(key => !nonExecutableSteps.includes(key));

    if (executableFrameworks.length === 0) {
      throw new Error('Template has no executable frameworks after filtering');
    }

    const firstFramework = executableFrameworks[0];

    console.log('[Journey Builder] All journey steps:', allSteps.join(', '));
    console.log('[Journey Builder] Executable frameworks:', executableFrameworks.join(', '));

    // Use JourneyOrchestrator to create a proper journey session
    const orchestrator = new JourneyOrchestrator();
    const { journeySessionId, versionNumber } = await orchestrator.startCustomJourney({
      understandingId: params.understandingId,
      userId: params.userId,
      frameworks: executableFrameworks,
      allSteps, // Pass ALL steps including non-executable ones for navigation
      templateId: params.templateId,
    });

    // Also track in user_journeys for the wizard UI (backward compatibility)
    await this.startJourney({
      userId: params.userId,
      templateId: params.templateId,
      name: template.name,
    });

    console.log('[Journey Builder] ✓ Custom journey started via orchestrator:', {
      journeySessionId,
      versionNumber,
      firstFramework,
      templateId: params.templateId,
    });

    return {
      journeySessionId,
      firstFramework,
      versionNumber,
    };
  }
}

export const journeyBuilderService = new JourneyBuilderService();
