/**
 * Journey Orchestrator
 * Coordinates the execution of multiple strategic frameworks in sequence,
 * accumulating context and insights across the journey
 */

import { db } from '../db';
import { journeySessions, strategicUnderstanding } from '@shared/schema';
import { StrategicContext, JourneyType, FrameworkResult, JourneyProgress } from '@shared/journey-types';
import { eq } from 'drizzle-orm';
import {
  initializeContext,
  addFrameworkResult,
  finalizeContext,
} from './strategic-context-accumulator';
import { getJourney, isJourneyAvailable } from './journey-registry';
import { applyWhysToBMCBridge } from './bridges/whys-to-bmc-bridge';

export class JourneyOrchestrator {
  /**
   * Start a new journey execution
   */
  async startJourney(
    understandingId: string,
    journeyType: JourneyType,
    userId: string
  ): Promise<string> {
    // Verify journey is available
    if (!isJourneyAvailable(journeyType)) {
      throw new Error(`Journey "${journeyType}" is not yet implemented`);
    }

    // Load understanding
    const understanding = await db
      .select()
      .from(strategicUnderstanding)
      .where(eq(strategicUnderstanding.id, understandingId))
      .then(rows => rows[0]);

    if (!understanding) {
      throw new Error(`Understanding ${understandingId} not found`);
    }

    // Initialize context
    const context = initializeContext(understanding, journeyType);

    // Create journey session in database
    const [journeySession] = await db
      .insert(journeySessions)
      .values({
        understandingId,
        userId,
        journeyType,
        status: 'initializing',
        currentFrameworkIndex: 0,
        completedFrameworks: [],
        accumulatedContext: context as any, // Store initial context
      })
      .returning();

    return journeySession.id;
  }

  /**
   * Execute a journey step-by-step
   * Returns the updated context after each framework execution
   */
  async executeJourney(
    journeySessionId: string,
    progressCallback?: (progress: JourneyProgress) => void
  ): Promise<StrategicContext> {
    // Load journey session
    const session = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.id, journeySessionId))
      .then(rows => rows[0]);

    if (!session) {
      throw new Error(`Journey session ${journeySessionId} not found`);
    }

    // Get journey definition
    const journey = getJourney(session.journeyType);

    // Load context from database
    let context: StrategicContext = session.accumulatedContext as StrategicContext;

    // Update status to in_progress
    await this.updateSessionStatus(journeySessionId, 'in_progress');

    try {
      // Execute each framework in sequence
      for (let i = context.currentFrameworkIndex; i < journey.frameworks.length; i++) {
        const frameworkName = journey.frameworks[i];

        // Report progress
        if (progressCallback) {
          progressCallback({
            currentFramework: frameworkName,
            frameworkIndex: i,
            totalFrameworks: journey.frameworks.length,
            percentComplete: Math.round((i / journey.frameworks.length) * 100),
            status: `Executing ${frameworkName}...`,
          });
        }

        // Execute the framework
        const result = await this.executeFramework(frameworkName, context);

        // Add result to context
        context = addFrameworkResult(context, result);

        // Apply bridge if needed (between frameworks)
        if (frameworkName === 'five_whys' && journey.frameworks[i + 1] === 'bmc') {
          const { context: bridgedContext } = applyWhysToBMCBridge(context);
          context = bridgedContext;
        }

        // Update database with progress
        await this.saveProgress(journeySessionId, context);

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Mark journey as complete
      await this.updateSessionStatus(journeySessionId, 'completed');
      context.status = 'completed';

      // Final progress callback
      if (progressCallback) {
        progressCallback({
          currentFramework: journey.frameworks[journey.frameworks.length - 1],
          frameworkIndex: journey.frameworks.length,
          totalFrameworks: journey.frameworks.length,
          percentComplete: 100,
          status: 'Journey complete!',
        });
      }

      return context;
    } catch (error) {
      // Mark journey as failed
      await this.updateSessionStatus(journeySessionId, 'failed');
      throw error;
    }
  }

  /**
   * Execute a single framework
   */
  private async executeFramework(
    frameworkName: import('@shared/journey-types').FrameworkName,
    context: StrategicContext
  ): Promise<FrameworkResult> {
    const startTime = Date.now();

    try {
      let data: any;

      switch (frameworkName) {
        case 'five_whys':
          // Execute Five Whys framework
          // For now, this is a stub - in reality, this would call the actual framework
          data = await this.executeFiveWhys(context);
          break;

        case 'bmc':
          // Execute Business Model Canvas framework
          data = await this.executeBMC(context);
          break;

        case 'porters':
          // Execute Porter's Five Forces (not implemented yet)
          throw new Error('Porter\'s Five Forces not yet implemented');

        case 'pestle':
          // Execute PESTLE analysis (not implemented yet)
          throw new Error('PESTLE analysis not yet implemented');

        default:
          throw new Error(`Unknown framework: ${frameworkName}`);
      }

      return {
        frameworkName,
        executedAt: new Date(),
        duration: Date.now() - startTime,
        data,
      };
    } catch (error) {
      return {
        frameworkName,
        executedAt: new Date(),
        duration: Date.now() - startTime,
        data: {},
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Execute Five Whys framework
   * NOTE: This is a simplified version - the actual implementation should call the real framework
   */
  private async executeFiveWhys(context: StrategicContext): Promise<any> {
    // This is a placeholder - in the real implementation, this would:
    // 1. Call the WhysTreeGenerator
    // 2. Run the analysis
    // 3. Return the results
    
    // For now, return a mock result
    return {
      rootCause: 'Placeholder root cause',
      rootCauses: ['Root cause 1'],
      whysPath: ['Why 1', 'Why 2', 'Why 3'],
      selectedPath: ['Level 1', 'Level 2', 'Level 3'],
      strategicImplications: ['Implication 1', 'Implication 2'],
    };
  }

  /**
   * Execute Business Model Canvas framework
   * NOTE: This is a simplified version - the actual implementation should call the real framework
   */
  private async executeBMC(context: StrategicContext): Promise<any> {
    // Extract BMC constraints from context (provided by Five Whys bridge)
    const constraints = context.insights.bmcDesignConstraints;

    // This is a placeholder - in the real implementation, this would:
    // 1. Call the BMCAnalyzer with the constraints
    // 2. Use the problemsToSolve, mustHaveCapabilities, designPrinciples
    // 3. Run the analysis with contextualBackground
    // 4. Return the results

    // For now, log that we have the constraints and return mock data
    if (constraints) {
      console.log('[BMC] Received constraints from Five Whys bridge:', {
        problems: constraints.problemsToSolve.length,
        capabilities: constraints.mustHaveCapabilities.length,
        principles: constraints.designPrinciples.length,
      });
    }

    return {
      blocks: {},
      criticalGaps: constraints?.problemsToSolve || [],
      contradictions: [],
      // Include constraints in output to verify they were received
      receivedConstraints: constraints ? true : false,
    };
  }

  /**
   * Save journey progress to database
   */
  private async saveProgress(journeySessionId: string, context: StrategicContext): Promise<void> {
    await db
      .update(journeySessions)
      .set({
        currentFrameworkIndex: context.currentFrameworkIndex,
        completedFrameworks: context.completedFrameworks as any,
        accumulatedContext: context as any,
        updatedAt: new Date(),
      })
      .where(eq(journeySessions.id, journeySessionId));
  }

  /**
   * Update journey session status
   */
  private async updateSessionStatus(
    journeySessionId: string,
    status: 'initializing' | 'in_progress' | 'paused' | 'completed' | 'failed'
  ): Promise<void> {
    await db
      .update(journeySessions)
      .set({
        status,
        updatedAt: new Date(),
        ...(status === 'completed' ? { completedAt: new Date() } : {}),
      })
      .where(eq(journeySessions.id, journeySessionId));
  }

  /**
   * Resume a paused journey
   */
  async resumeJourney(
    journeySessionId: string,
    progressCallback?: (progress: JourneyProgress) => void
  ): Promise<StrategicContext> {
    // Update status to in_progress
    await this.updateSessionStatus(journeySessionId, 'in_progress');

    // Continue execution
    return this.executeJourney(journeySessionId, progressCallback);
  }

  /**
   * Get journey progress
   */
  async getProgress(journeySessionId: string): Promise<JourneyProgress | null> {
    const session = await db
      .select()
      .from(journeySessions)
      .where(eq(journeySessions.id, journeySessionId))
      .then(rows => rows[0]);

    if (!session) {
      return null;
    }

    const journey = getJourney(session.journeyType);
    const currentIndex = session.currentFrameworkIndex || 0;

    return {
      currentFramework: journey.frameworks[currentIndex] || journey.frameworks[0],
      frameworkIndex: currentIndex,
      totalFrameworks: journey.frameworks.length,
      percentComplete: Math.round((currentIndex / journey.frameworks.length) * 100),
      status: session.status || 'initializing',
    };
  }
}

// Export a singleton instance
export const journeyOrchestrator = new JourneyOrchestrator();
