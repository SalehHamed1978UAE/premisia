/**
 * Journey Orchestrator
 * Coordinates the execution of multiple strategic frameworks in sequence,
 * accumulating context and insights across the journey
 */

import { db } from '../db';
import { journeySessions, strategicUnderstanding, frameworkInsights } from '@shared/schema';
import { StrategicContext, JourneyType, FrameworkResult, JourneyProgress } from '@shared/journey-types';
import { eq } from 'drizzle-orm';
import {
  initializeContext,
  addFrameworkResult,
  finalizeContext,
} from './strategic-context-accumulator';
import { getJourney, isJourneyAvailable } from './journey-registry';
import { applyWhysToBMCBridge } from './bridges/whys-to-bmc-bridge';
import { WhysTreeGenerator } from '../strategic-consultant/whys-tree-generator';
import { BMCResearcher } from '../strategic-consultant/bmc-researcher';
import { dbConnectionManager } from '../db-connection-manager';
import { getStrategicUnderstanding, saveJourneySession, getJourneySession, updateJourneySession } from '../services/secure-data-service';

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

    // Load understanding using secure service
    const understanding = await getStrategicUnderstanding(understandingId);

    if (!understanding) {
      throw new Error(`Understanding ${understandingId} not found`);
    }

    // Initialize context (cast to full type since we've confirmed it exists)
    const context = initializeContext(understanding as any, journeyType);

    // Create journey session in database using secure service (encrypts accumulatedContext)
    console.log('[JourneyOrchestrator] 🔐 Encrypting and saving journey session...');
    const journeySession = await saveJourneySession({
      understandingId,
      userId,
      journeyType: journeyType as any,
      status: 'initializing',
      currentFrameworkIndex: 0,
      completedFrameworks: [],
      accumulatedContext: context, // Will be encrypted by secure service
    });
    console.log('[JourneyOrchestrator] ✓ Journey session saved with encryption');

    return journeySession.id!;
  }

  /**
   * Execute a journey step-by-step
   * Returns the updated context after each framework execution
   */
  async executeJourney(
    journeySessionId: string,
    progressCallback?: (progress: JourneyProgress) => void
  ): Promise<StrategicContext> {
    // STEP 1: Load journey session using secure service (decrypts accumulatedContext)
    const session = await getJourneySession(journeySessionId);

    if (!session) {
      throw new Error(`Journey session ${journeySessionId} not found`);
    }

    // Get journey definition
    const journey = getJourney(session.journeyType! as JourneyType);

    // Load context from database (already decrypted by secure service)
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

        // STEP 2: Execute the framework (NO DB connection held during AI operations)
        const result = await this.executeFramework(frameworkName, context);

        // Add result to context
        context = addFrameworkResult(context, result);

        // Apply bridge if needed (between frameworks)
        if (frameworkName === 'five_whys' && journey.frameworks[i + 1] === 'bmc') {
          const { context: bridgedContext } = applyWhysToBMCBridge(context);
          context = bridgedContext;
        }

        // STEP 3a: Save framework insights
        await dbConnectionManager.retryWithBackoff(async (db) => {
          // Save framework insight to framework_insights table
          console.log(`[Journey] Saving ${result.frameworkName} insights for understanding ${context.understandingId}`);
          await db
            .insert(frameworkInsights)
            .values({
              understandingId: context.understandingId,
              frameworkName: result.frameworkName,
              frameworkVersion: '1.0',
              insights: result.data as any,
              telemetry: {
                duration: result.duration,
                executedAt: result.executedAt,
              } as any,
            });
          console.log(`[Journey] ✓ Saved ${result.frameworkName} insights`);
        });

        // STEP 3b: Save journey progress using secure service (encrypts accumulatedContext)
        console.log(`[Journey] 🔐 Encrypting and updating journey progress...`);
        await updateJourneySession(journeySessionId, {
          currentFrameworkIndex: context.currentFrameworkIndex,
          completedFrameworks: context.completedFrameworks as any,
          accumulatedContext: context,
        });
        console.log(`[Journey] ✓ Journey progress updated with encryption`);

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
   */
  private async executeFiveWhys(context: StrategicContext): Promise<any> {
    console.log('[Journey] Executing Five Whys with AI...');
    
    const generator = new WhysTreeGenerator();
    const sessionId = context.sessionId;
    const userInput = context.userInput;
    
    // Generate the complete Five Whys tree
    const whysTree = await generator.generateTree(userInput, sessionId);
    
    console.log(`[Journey] Five Whys completed - generated tree with ${whysTree.branches.length} root branches`);
    
    // Extract root causes and paths from the tree
    // Navigate through branches to find deepest answers (root causes)
    const rootCauses: string[] = [];
    const whysPath: string[] = [whysTree.rootQuestion];
    
    // Extract from each branch - for now, take first branch to build a path
    if (whysTree.branches && whysTree.branches.length > 0) {
      let currentLevel = whysTree.branches;
      
      // Traverse the first branch to build a complete path
      while (currentLevel && currentLevel.length > 0) {
        const node = currentLevel[0];
        whysPath.push(node.question);
        
        // If we're at a leaf node (deepest level), this is a root cause
        if (!node.branches || node.branches.length === 0) {
          rootCauses.push(node.option || node.question);
        }
        
        currentLevel = node.branches || [];
      }
      
      // Also collect root causes from other branches
      for (const branch of whysTree.branches) {
        const deepestAnswer = this.findDeepestAnswer(branch);
        if (deepestAnswer && !rootCauses.includes(deepestAnswer)) {
          rootCauses.push(deepestAnswer);
        }
      }
    }
    
    // Generate strategic implications from root causes
    const strategicImplications = rootCauses.map(cause => 
      `Strategic implication: The business model must address ${cause}`
    );
    
    // Return data in the format expected by the accumulator
    return {
      rootCauses: rootCauses.length > 0 ? rootCauses : ['No root causes identified'],
      whysPath,
      strategicImplications,
      tree: whysTree, // Also include the full tree for reference
    };
  }
  
  /**
   * Helper to find the deepest answer in a branch
   */
  private findDeepestAnswer(node: any): string | null {
    if (!node.branches || node.branches.length === 0) {
      return node.option || node.question;
    }
    
    // Recurse to find deepest
    for (const branch of node.branches) {
      const deep = this.findDeepestAnswer(branch);
      if (deep) return deep;
    }
    
    return node.option || node.question;
  }

  /**
   * Execute Business Model Canvas framework
   */
  private async executeBMC(context: StrategicContext): Promise<any> {
    console.log('[Journey] Executing BMC with AI...');
    
    // Extract BMC constraints from context (provided by Five Whys bridge)
    const constraints = context.insights.bmcDesignConstraints;
    
    if (constraints) {
      console.log('[Journey] BMC constraints from Five Whys:', {
        problems: constraints.problemsToSolve.length,
        capabilities: constraints.mustHaveCapabilities.length,
        principles: constraints.designPrinciples.length,
      });
    }

    const researcher = new BMCResearcher();
    const sessionId = context.sessionId;
    const userInput = context.userInput;
    
    // For now, conduct BMC research with the original input
    // TODO: Incorporate constraints into the BMC analysis
    const bmcResults = await researcher.conductBMCResearch(userInput, sessionId);
    
    console.log(`[Journey] BMC analysis completed - generated ${Object.keys(bmcResults.blocks || {}).length} blocks`);
    
    return bmcResults;
  }


  /**
   * Update journey session status
   */
  private async updateSessionStatus(
    journeySessionId: string,
    status: 'initializing' | 'in_progress' | 'paused' | 'completed' | 'failed'
  ): Promise<void> {
    await dbConnectionManager.retryWithBackoff(async (db) => {
      await db
        .update(journeySessions)
        .set({
          status,
          updatedAt: new Date(),
          ...(status === 'completed' ? { completedAt: new Date() } : {}),
        })
        .where(eq(journeySessions.id, journeySessionId));
    });
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
