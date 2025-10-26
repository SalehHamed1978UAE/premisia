import { db } from "../db";
import { journeyTemplates, userJourneys, frameworkRegistry } from "@shared/schema";
import type { InsertJourneyTemplate, InsertUserJourney, InsertFrameworkRegistry } from "@shared/schema";
import type { JourneyStep, JourneyTemplate, UserJourney, Framework } from "@shared/journey-types";
import { eq } from "drizzle-orm";

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
}

export const journeyBuilderService = new JourneyBuilderService();
