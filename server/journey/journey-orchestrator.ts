/**
 * Journey Orchestrator
 * Coordinates the execution of multiple strategic frameworks in sequence,
 * accumulating context and insights across the journey
 */

import { db } from '../db';
import { journeySessions, strategicUnderstanding, frameworkInsights } from '@shared/schema';
import { StrategicContext, JourneyType, FrameworkResult, JourneyProgress } from '@shared/journey-types';
import { eq, sql } from 'drizzle-orm';
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
import { encryptJSONKMS } from '../utils/kms-encryption';
import { journeySummaryService } from '../services/journey-summary-service';
import { isJourneyRegistryV2Enabled } from '../config';

export class JourneyOrchestrator {
  /**
   * Start a new journey execution
   */
  async startJourney(
    understandingId: string,
    journeyType: JourneyType,
    userId: string
  ): Promise<{ journeySessionId: string; versionNumber: number }> {
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

    // Load baseline summary from previous journey of the SAME journey type (if exists)
    // Only if Journey Registry V2 is enabled
    if (isJourneyRegistryV2Enabled()) {
      const baselineSummary = await journeySummaryService.getLatestSummary(understandingId, journeyType);
      
      // Attach baseline summary to context if it exists
      if (baselineSummary) {
        context.baselineSummary = baselineSummary;
        console.log(`[JourneyOrchestrator] Loaded baseline summary from previous ${journeyType} run (version ${baselineSummary.versionNumber})`);
      } else {
        console.log(`[JourneyOrchestrator] No previous ${journeyType} summary found, starting fresh`);
      }
    } else {
      console.log('[JourneyOrchestrator] Journey Registry V2 disabled, skipping summary load');
    }

    // Use a database transaction with advisory lock to serialize version allocation
    // This ensures all operations (lock, query, insert, unlock) happen on the same connection
    const lockId = this.hashStringToInt64(understandingId);
    
    return await db.transaction(async (tx) => {
      // Acquire advisory lock (blocks if another transaction holds it)
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockId})`);
      console.log(`[JourneyOrchestrator] Acquired transaction advisory lock for understanding ${understandingId}`);

      // Query max version on the SAME connection
      const existingSessions = await tx
        .select({ versionNumber: journeySessions.versionNumber })
        .from(journeySessions)
        .where(eq(journeySessions.understandingId, understandingId))
        .orderBy(journeySessions.versionNumber);

      const maxVersion = existingSessions.length > 0 
        ? Math.max(...existingSessions.map(s => s.versionNumber || 1))
        : 0;
      const nextVersion = maxVersion + 1;

      console.log(`[JourneyOrchestrator] Creating journey session version ${nextVersion} for understanding ${understandingId}`);

      // Encrypt accumulated context before inserting
      const encryptedContext = await encryptJSONKMS(context);

      // Insert new session on the SAME connection
      const [newSession] = await tx
        .insert(journeySessions)
        .values({
          understandingId,
          userId,
          journeyType: journeyType as any,
          status: 'initializing' as any,
          currentFrameworkIndex: 0,
          completedFrameworks: [],
          accumulatedContext: encryptedContext as any,
          versionNumber: nextVersion,
          startedAt: new Date(),
        })
        .returning();

      console.log(`[JourneyOrchestrator] ✓ Journey session saved with encryption (Version ${nextVersion})`);
      // Lock is automatically released when transaction commits
      
      return {
        journeySessionId: newSession.id,
        versionNumber: nextVersion
      };
    });
  }

  /**
   * Hash a UUID string to a 64-bit integer for PostgreSQL advisory locks
   */
  private hashStringToInt64(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Ensure the number is within PostgreSQL's int8 range
    return Math.abs(hash);
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

        // STEP 3a: Save framework insights linked to this journey session
        await dbConnectionManager.retryWithBackoff(async (db) => {
          // Save framework insight to framework_insights table
          console.log(`[Journey] Saving ${result.frameworkName} insights for journey session ${journeySessionId} (version ${session.versionNumber})`);
          await db
            .insert(frameworkInsights)
            .values({
              understandingId: context.understandingId,
              sessionId: journeySessionId,
              frameworkName: result.frameworkName,
              frameworkVersion: `${session.versionNumber}.0`,
              insights: result.data as any,
              telemetry: {
                duration: result.duration,
                executedAt: result.executedAt,
              } as any,
            });
          console.log(`[Journey] ✓ Saved ${result.frameworkName} insights (Version ${session.versionNumber})`);
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

      // Build and save journey summary (only if Journey Registry V2 is enabled)
      if (isJourneyRegistryV2Enabled()) {
        const journeyDef = getJourney(session.journeyType! as JourneyType);
        const summary = journeySummaryService.buildSummary(
          journeyDef.summaryBuilder,
          context,
          {
            versionNumber: session.versionNumber || 1,
            completedAt: new Date().toISOString()
          }
        );
        await journeySummaryService.saveSummary(journeySessionId, summary);
        console.log(`[JourneyOrchestrator] ✓ Journey summary saved for version ${session.versionNumber}`);
      } else {
        console.log('[JourneyOrchestrator] Journey Registry V2 disabled, skipping summary save');
      }

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
   * Execute a single framework using the modular registry system
   */
  private async executeFramework(
    frameworkName: import('@shared/journey-types').FrameworkName,
    context: StrategicContext
  ): Promise<FrameworkResult> {
    const { frameworkRegistry } = await import('./framework-executor-registry');
    return frameworkRegistry.execute(frameworkName, context);
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
