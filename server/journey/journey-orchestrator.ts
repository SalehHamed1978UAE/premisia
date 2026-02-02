/**
 * Journey Orchestrator
 * Coordinates the execution of multiple strategic frameworks in sequence,
 * accumulating context and insights across the journey
 */

import { db } from '../db';
import { journeySessions, strategicUnderstanding, frameworkInsights, goldenRecords } from '@shared/schema';
import { StrategicContext, JourneyType, FrameworkResult, JourneyProgress } from '@shared/journey-types';
import { eq, sql, desc, and } from 'drizzle-orm';
import {
  initializeContext,
  addFrameworkResult,
  finalizeContext,
} from './strategic-context-accumulator';
import { getJourney, isJourneyAvailable } from './journey-registry';
import { applyWhysToBMCBridge } from './bridges/whys-to-bmc-bridge';
import { applyPESTLEToPortersBridge } from './bridges/pestle-to-porters-bridge';
import { applyPortersToSWOTBridge } from './bridges/porters-to-swot-bridge';
import { WhysTreeGenerator } from '../strategic-consultant-legacy/whys-tree-generator';
import { BMCResearcher } from '../strategic-consultant-legacy/bmc-researcher';
import { dbConnectionManager } from '../db-connection-manager';
import { getStrategicUnderstanding, saveJourneySession, getJourneySession, updateJourneySession } from '../services/secure-data-service';
import { encryptJSONKMS, decryptJSONKMS } from '../utils/kms-encryption';
import { journeySummaryService } from '../services/journey-summary-service';
import { isJourneyRegistryV2Enabled } from '../config';
import { moduleRegistry } from '../modules/registry';
import { strategyVersions } from '@shared/schema';

// User input steps that pause execution and redirect to a page
const USER_INPUT_FRAMEWORKS = [
  'strategic_decisions',
  'strategic-decisions',
  'prioritization',
];

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
   * Start a custom journey with user-defined framework sequence
   * Used for wizard-created journeys from journey_templates
   */
  async startCustomJourney(params: {
    understandingId: string;
    userId: string;
    frameworks: string[];
    allSteps?: string[]; // All journey steps including non-executable ones (for navigation)
    templateId?: string;
  }): Promise<{ journeySessionId: string; versionNumber: number }> {
    const { understandingId, userId, frameworks, allSteps, templateId } = params;

    console.log(`[JourneyOrchestrator] Starting custom journey for understanding ${understandingId}`);
    console.log(`[JourneyOrchestrator] Custom frameworks: ${frameworks.join(', ')}`);
    if (allSteps) {
      console.log(`[JourneyOrchestrator] All journey steps: ${allSteps.join(', ')}`);
    }

    // Load understanding using secure service
    const understanding = await getStrategicUnderstanding(understandingId);

    if (!understanding) {
      throw new Error(`Understanding ${understandingId} not found`);
    }

    // Initialize context with 'custom' journey type
    const context = initializeContext(understanding as any, 'custom' as JourneyType);

    // Use a database transaction with advisory lock to serialize version allocation
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

      console.log(`[JourneyOrchestrator] Creating custom journey session version ${nextVersion}`);

      // Encrypt accumulated context before inserting
      const encryptedContext = await encryptJSONKMS(context);

      // Store custom framework sequence in metadata
      // allSteps includes all journey steps (for navigation), frameworks are only executable ones
      const metadata = {
        frameworks: allSteps || frameworks, // Use allSteps for navigation if provided
        executableFrameworks: frameworks, // Keep track of which are actually executable
        templateId,
        isCustomJourney: true,
      };

      // Insert new session with custom journey type and metadata
      const [newSession] = await tx
        .insert(journeySessions)
        .values({
          understandingId,
          userId,
          journeyType: 'custom' as any,
          status: 'initializing' as any,
          currentFrameworkIndex: 0,
          completedFrameworks: [],
          accumulatedContext: encryptedContext as any,
          versionNumber: nextVersion,
          startedAt: new Date(),
          metadata: metadata as any,
        })
        .returning();

      console.log(`[JourneyOrchestrator] ✓ Custom journey session saved (Version ${nextVersion})`);
      
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

    // Get framework sequence - either from custom metadata OR from predefined journey
    let frameworks: string[];
    let journey: any;

    if (session.journeyType === 'custom' && session.metadata) {
      // Custom journey: read frameworks from session metadata
      const metadata = typeof session.metadata === 'string' 
        ? JSON.parse(session.metadata) 
        : session.metadata;
      frameworks = metadata.frameworks || [];
      console.log(`[JourneyOrchestrator] Executing custom journey with frameworks: ${frameworks.join(', ')}`);
      
      // Create a minimal journey definition for custom journeys
      journey = {
        type: 'custom',
        frameworks,
        dependencies: [],
      };
    } else {
      // Predefined journey: get from registry
      journey = getJourney(session.journeyType! as JourneyType);
      frameworks = journey.frameworks;
    }

    // Load context from database (already decrypted by secure service)
    let context: StrategicContext = session.accumulatedContext as StrategicContext;

    // Update status to in_progress
    await this.updateSessionStatus(journeySessionId, 'in_progress');

    try {
      // Execute each framework in sequence
      for (let i = context.currentFrameworkIndex; i < frameworks.length; i++) {
        const frameworkName = frameworks[i] as import('@shared/journey-types').FrameworkName;

        // Report progress
        if (progressCallback) {
          progressCallback({
            currentFramework: frameworkName,
            frameworkIndex: i,
            totalFrameworks: frameworks.length,
            percentComplete: Math.round((i / frameworks.length) * 100),
            status: `Executing ${frameworkName}...`,
          });
        }

        // STEP 1.5: Check if this is a user-input step that requires pausing
        if (this.isUserInputStep(frameworkName)) {
          console.log(`[JourneyOrchestrator] User input step detected: ${frameworkName}`);
          
          // Create decision version and get redirect URL
          const redirectUrl = await this.prepareUserInputStep(
            journeySessionId,
            context.understandingId,
            session.versionNumber || 1,
            context
          );
          
          // Update session status to paused and store redirect URL in metadata
          await updateJourneySession(journeySessionId, {
            status: 'paused' as any,
            accumulatedContext: {
              ...context,
              status: 'paused',
            },
          });
          
          // Store redirectUrl in session metadata for frontend access
          const currentMetadata = session.metadata as Record<string, any> || {};
          await db.update(journeySessions)
            .set({
              status: 'paused',
              metadata: {
                ...currentMetadata,
                nextStepRedirectUrl: redirectUrl,
              },
              updatedAt: new Date(),
            })
            .where(eq(journeySessions.id, journeySessionId));
          
          console.log(`[JourneyOrchestrator] Stored redirectUrl in session metadata: ${redirectUrl}`);
          
          // Emit user_input_required progress event
          if (progressCallback) {
            progressCallback({
              currentFramework: frameworkName,
              frameworkIndex: i,
              totalFrameworks: frameworks.length,
              percentComplete: Math.round((i / frameworks.length) * 100),
              status: 'Awaiting user input for strategic decisions',
              userInputRequired: true,
              redirectUrl,
            });
          }
          
          console.log(`[JourneyOrchestrator] Paused journey for user input. Redirect: ${redirectUrl}`);
          
          // Return context - journey will be resumed after user completes input
          return context;
        }

        // STEP 2: Execute the framework (NO DB connection held during AI operations)
        const result = await this.executeFramework(frameworkName, context);

        // Add result to context
        context = addFrameworkResult(context, result);

        // Apply bridge if needed (between frameworks)
        // These bridges perform COGNITIVE transformation, not just data mapping
        if (frameworkName === 'five_whys' && frameworks[i + 1] === 'bmc') {
          console.log('[JourneyOrchestrator] Applying Five Whys → BMC bridge');
          const { context: bridgedContext } = applyWhysToBMCBridge(context);
          context = bridgedContext;
        }
        
        // PESTLE → Porter's bridge: Transform macro factors into competitive force context
        if (frameworkName === 'pestle' && frameworks[i + 1] === 'porters') {
          console.log('[JourneyOrchestrator] Applying PESTLE → Porter\'s bridge');
          try {
            const pestleOutput = result.data;
            const positioning = {};
            const portersContext = await applyPESTLEToPortersBridge(pestleOutput, positioning);
            
            // Store bridge output in context for Porter's executor to use
            // Use trendFactors which is the existing field for PESTLE data
            context.insights = {
              ...context.insights,
              trendFactors: pestleOutput,
            };
            // Store bridge context in marketResearch (cast to any to bypass strict typing)
            (context as any).pestleToPortersBridge = portersContext;
            console.log('[JourneyOrchestrator] ✓ PESTLE → Porter\'s bridge applied');
          } catch (bridgeError) {
            console.error('[JourneyOrchestrator] PESTLE → Porter\'s bridge error:', bridgeError);
            // Continue without bridge - Porter's can still run with raw PESTLE output
          }
        }
        
        // Porter's → SWOT bridge: Transform competitive analysis into O/T derivation
        if (frameworkName === 'porters' && frameworks[i + 1] === 'swot') {
          console.log('[JourneyOrchestrator] Applying Porter\'s → SWOT bridge');
          try {
            const portersOutput = result.data;
            const pestleOutput = context.insights?.trendFactors;
            const positioning = {};
            const swotContext = await applyPortersToSWOTBridge(portersOutput, pestleOutput, positioning);
            
            // Store bridge output in context for SWOT executor to use
            // Use portersForces which is the existing field for Porter's data
            context.insights = {
              ...context.insights,
              portersForces: portersOutput,
            };
            // Store bridge context (cast to any to bypass strict typing)
            (context as any).portersToSWOTBridge = swotContext;
            console.log('[JourneyOrchestrator] ✓ Porter\'s → SWOT bridge applied');
          } catch (bridgeError) {
            console.error('[JourneyOrchestrator] Porter\'s → SWOT bridge error:', bridgeError);
            // Continue without bridge - SWOT can still run with raw Porter's output
          }
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

      // Build and save journey summary (only if Journey Registry V2 is enabled and not custom journey)
      if (isJourneyRegistryV2Enabled() && session.journeyType !== 'custom') {
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
      } else if (session.journeyType === 'custom') {
        console.log('[JourneyOrchestrator] Custom journey - skipping summary builder (no predefined summary format)');
      } else {
        console.log('[JourneyOrchestrator] Journey Registry V2 disabled, skipping summary save');
      }

      // Auto-capture golden record if enabled
      await this.autoCaptureGoldenRecord(journeySessionId, session.journeyType! as JourneyType);

      // Final progress callback
      if (progressCallback) {
        progressCallback({
          currentFramework: frameworks[frameworks.length - 1] as import('@shared/journey-types').FrameworkName,
          frameworkIndex: frameworks.length,
          totalFrameworks: frameworks.length,
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
   * Check if a framework/step is a user-input type that requires pausing
   */
  private isUserInputStep(frameworkName: string): boolean {
    // Check against known user-input framework names
    if (USER_INPUT_FRAMEWORKS.includes(frameworkName)) {
      return true;
    }
    
    // Also check module registry for type='user-input'
    const normalizedName = frameworkName.replace(/_/g, '-');
    const module = moduleRegistry.getModule(normalizedName);
    if (module && module.type === 'user-input') {
      return true;
    }
    
    // Check if name contains strategic and decision
    if (frameworkName.includes('strategic') && frameworkName.includes('decision')) {
      return true;
    }
    
    return false;
  }

  /**
   * Prepare for user input step by creating decision version and returning redirect URL
   *
   * FIXED: Now queries for the LAST framework in the journey instead of hard-coding SWOT.
   * For growth_strategy (PESTLE → Ansoff → BMC), this uses BMC.
   * For market_entry (PESTLE → Porter's → SWOT), this uses SWOT.
   */
  private async prepareUserInputStep(
    journeySessionId: string,
    understandingId: string,
    versionNumber: number,
    context: StrategicContext
  ): Promise<string> {
    // Check if a decision version already exists using understandingId as sessionId
    const existingVersions = await db.select()
      .from(strategyVersions)
      .where(eq(strategyVersions.sessionId, understandingId))
      .orderBy(strategyVersions.versionNumber);

    if (existingVersions.length === 0) {
      // No versions exist: create version 1 with AI-generated decisions
      const { DecisionGenerator } = await import('../strategic-consultant-legacy/decision-generator');
      const generator = new DecisionGenerator();

      let decisionsData: any;

      // CRITICAL FIX: Determine the LAST framework in the journey, don't hard-code SWOT
      // Query the journey session to get the journey type and frameworks
      const journeySession = await db.select()
        .from(journeySessions)
        .where(eq(journeySessions.id, journeySessionId))
        .limit(1);

      let lastFramework = 'swot'; // Default fallback
      if (journeySession[0]) {
        const journeyType = journeySession[0].journeyType;

        // Get the framework sequence for this journey type
        if (journeyType === 'custom' && journeySession[0].metadata) {
          const metadata = typeof journeySession[0].metadata === 'string'
            ? JSON.parse(journeySession[0].metadata)
            : journeySession[0].metadata;
          const frameworks = metadata.frameworks || [];
          lastFramework = frameworks[frameworks.length - 1] || 'swot';
        } else if (journeyType) {
          const journey = getJourney(journeyType as JourneyType);
          lastFramework = journey.frameworks[journey.frameworks.length - 1] || 'swot';
        }
      }

      console.log(`[JourneyOrchestrator] Journey last framework: ${lastFramework}`);
      console.log(`[JourneyOrchestrator] Looking for ${lastFramework} insights in session: ${journeySessionId}`);

      // Query for the LAST framework's insight from this journey session
      const frameworkInsightsResult = await db
        .select()
        .from(frameworkInsights)
        .where(sql`${frameworkInsights.sessionId} = ${journeySessionId} AND ${frameworkInsights.frameworkName} = ${lastFramework}`)
        .limit(1);

      console.log(`[JourneyOrchestrator] Found ${frameworkInsightsResult.length} ${lastFramework} insight records`);
      if (frameworkInsightsResult.length > 0) {
        console.log(`[JourneyOrchestrator] ${lastFramework} insight ID: ${frameworkInsightsResult[0].id}, sessionId: ${frameworkInsightsResult[0].sessionId}`);
      }

      // Decrypt the insights (they are encrypted in the database)
      let frameworkData: any = null;
      if (frameworkInsightsResult[0]?.insights) {
        const rawInsights = frameworkInsightsResult[0].insights;
        console.log(`[JourneyOrchestrator] ${lastFramework} insights raw type: ${typeof rawInsights}`);

        try {
          if (typeof rawInsights === 'string') {
            frameworkData = await decryptJSONKMS(rawInsights);
            console.log(`[JourneyOrchestrator] Decrypted ${lastFramework} insights successfully`);
            if (frameworkData) {
              console.log(`[JourneyOrchestrator] Decrypted data keys: ${Object.keys(frameworkData).join(', ')}`);
            }
          } else if (typeof rawInsights === 'object') {
            frameworkData = rawInsights;
            console.log(`[JourneyOrchestrator] ${lastFramework} insights already an object with keys: ${Object.keys(frameworkData || {}).join(', ')}`);
          }
        } catch (decryptError) {
          console.warn(`[JourneyOrchestrator] Failed to decrypt ${lastFramework} insights:`, decryptError);
        }
      } else {
        console.log(`[JourneyOrchestrator] No insights field found in ${lastFramework} record`);
      }

      // Generate decisions based on the framework type
      const frameworkOutput = frameworkData?.output || frameworkData;
      console.log(`[JourneyOrchestrator] ${lastFramework} output keys: ${Object.keys(frameworkOutput || {}).join(', ')}`);

      try {
        if (lastFramework === 'swot' && frameworkOutput && Array.isArray(frameworkOutput.strengths)) {
          // SWOT-based decisions
          console.log('[JourneyOrchestrator] Generating AI decisions from SWOT analysis');
          console.log(`[JourneyOrchestrator] SWOT has ${frameworkOutput.strengths.length} strengths, ${frameworkOutput.weaknesses?.length || 0} weaknesses`);
          decisionsData = await generator.generateDecisionsFromSWOT(
            frameworkOutput,
            context.userInput || ''
          );
        } else if (lastFramework === 'bmc' && frameworkOutput) {
          // BMC-based decisions
          console.log('[JourneyOrchestrator] Generating AI decisions from BMC analysis');
          console.log(`[JourneyOrchestrator] BMC has ${frameworkOutput.blocks?.length || 0} blocks`);
          decisionsData = await generator.generateDecisionsFromBMC(
            frameworkOutput,
            context.userInput || ''
          );
        } else if (frameworkOutput) {
          // Generic fallback: try to extract insights for decision generation
          console.log(`[JourneyOrchestrator] Generating decisions from ${lastFramework} using generic approach`);
          // For frameworks without specific decision generators, we'll create a summary and use SWOT-style generation
          const genericSummary = this.extractGenericInsights(frameworkOutput, lastFramework);
          if (genericSummary) {
            decisionsData = await generator.generateDecisionsFromSWOT(
              genericSummary,
              context.userInput || ''
            );
          } else {
            decisionsData = this.generatePlaceholderDecisions(context);
          }
        } else {
          console.log(`[JourneyOrchestrator] No valid ${lastFramework} data available, using placeholder decisions`);
          decisionsData = this.generatePlaceholderDecisions(context);
        }
        console.log(`[JourneyOrchestrator] AI generated ${decisionsData?.decisions?.length || 0} decisions`);
      } catch (error) {
        console.warn('[JourneyOrchestrator] AI decision generation failed, using placeholders:', error);
        decisionsData = this.generatePlaceholderDecisions(context);
      }
      
      // Create version 1 with atomic verification via .returning()
      const [insertedVersion] = await db.insert(strategyVersions).values({
        sessionId: understandingId,
        versionNumber: 1,
        versionLabel: `Strategic Decisions v1`,
        decisionsData,
        createdBy: 'system',
        userId: null,
      }).returning({
        id: strategyVersions.id,
        sessionId: strategyVersions.sessionId,
        versionNumber: strategyVersions.versionNumber,
      });
      
      // VALIDATION GATE: Verify the insert returned the exact row we expect
      if (!insertedVersion || insertedVersion.sessionId !== understandingId || insertedVersion.versionNumber !== 1) {
        console.error(`[JourneyOrchestrator] VALIDATION FAILED: Insert did not return expected row for session=${understandingId}, version=1`);
        throw new Error(`Failed to create strategy version 1 for session ${understandingId}`);
      }
      console.log(`[JourneyOrchestrator] ✓ VALIDATION PASSED: strategy_versions row (id=${insertedVersion.id}, session=${understandingId}, version=1) atomically verified`);
      
      // Return redirect URL to version 1
      return `/strategic-consultant/decisions/${understandingId}/1`;
    } else {
      // Versions exist: reuse the latest existing version (do NOT increment or create new one)
      const latestVersion = existingVersions[existingVersions.length - 1];
      console.log(`[JourneyOrchestrator] Found existing decision version ${latestVersion.versionNumber}, reusing it`);
      
      // Return redirect URL to the latest existing version
      return `/strategic-consultant/decisions/${understandingId}/${latestVersion.versionNumber}`;
    }
  }

  /**
   * Generate placeholder decisions structure when AI generation is not available
   */
  private generatePlaceholderDecisions(context: StrategicContext): any {
    return {
      decisions: [
        {
          id: 'decision-1',
          title: 'Strategic Direction',
          description: 'Define the primary strategic direction based on analysis',
          options: [
            { id: 'opt-1', title: 'Growth Focus', description: 'Prioritize expansion and market growth' },
            { id: 'opt-2', title: 'Efficiency Focus', description: 'Optimize operations and reduce costs' },
            { id: 'opt-3', title: 'Innovation Focus', description: 'Invest in new products and capabilities' },
          ],
          selectedOptionId: null,
        }
      ],
      priorities: [],
    };
  }

  /**
   * Extract generic insights from any framework output and convert to SWOT-like structure
   * This allows decision generation from frameworks that don't have dedicated decision generators
   *
   * @param frameworkOutput - Raw output from the framework
   * @param frameworkName - Name of the framework (pestle, ansoff, porters, etc.)
   * @returns SWOT-like structure or null if unable to extract
   */
  private extractGenericInsights(frameworkOutput: any, frameworkName: string): any | null {
    if (!frameworkOutput) return null;

    console.log(`[JourneyOrchestrator] Extracting generic insights from ${frameworkName}`);

    // Convert framework-specific outputs to a pseudo-SWOT structure
    // This allows the existing decision generator to work with any framework
    switch (frameworkName.toLowerCase()) {
      case 'pestle':
        return this.convertPESTLEToSWOT(frameworkOutput);
      case 'ansoff':
        return this.convertAnsoffToSWOT(frameworkOutput);
      case 'porters':
      case 'porter':
        return this.convertPortersToSWOT(frameworkOutput);
      default:
        // Generic fallback: try to find arrays of insights and map them
        return this.convertGenericToSWOT(frameworkOutput, frameworkName);
    }
  }

  /**
   * Convert PESTLE output to SWOT-like structure
   */
  private convertPESTLEToSWOT(pestle: any): any {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const opportunities: string[] = [];
    const threats: string[] = [];

    // PESTLE factors map to O/T primarily
    const categories = ['political', 'economic', 'social', 'technological', 'legal', 'environmental'];

    for (const category of categories) {
      const factors = pestle[category] || pestle[category.charAt(0).toUpperCase() + category.slice(1)] || [];
      if (Array.isArray(factors)) {
        factors.forEach((factor: any) => {
          const text = typeof factor === 'string' ? factor : factor?.factor || factor?.description || JSON.stringify(factor);
          const impact = factor?.impact || factor?.implication || '';
          const entry = `${text}${impact ? ': ' + impact : ''}`;

          // Classify based on sentiment/keywords
          if (this.isPositiveFactor(text + impact)) {
            opportunities.push(entry);
          } else {
            threats.push(entry);
          }
        });
      }
    }

    return { strengths, weaknesses, opportunities, threats };
  }

  /**
   * Convert Ansoff Matrix output to SWOT-like structure
   */
  private convertAnsoffToSWOT(ansoff: any): any {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const opportunities: string[] = [];
    const threats: string[] = [];

    // Ansoff strategies represent growth opportunities
    const strategies = ['market_penetration', 'market_development', 'product_development', 'diversification'];

    for (const strategy of strategies) {
      const strategyData = ansoff[strategy] || ansoff[strategy.replace(/_/g, '')] || null;
      if (strategyData) {
        const description = typeof strategyData === 'string'
          ? strategyData
          : strategyData?.description || strategyData?.recommendation || JSON.stringify(strategyData);
        opportunities.push(`${strategy.replace(/_/g, ' ')}: ${description}`);

        // Extract risks as threats
        if (strategyData?.risks && Array.isArray(strategyData.risks)) {
          threats.push(...strategyData.risks.map((r: any) => typeof r === 'string' ? r : r?.description || JSON.stringify(r)));
        }
      }
    }

    // Check for recommendation/selected strategy as a strength
    if (ansoff.recommendation || ansoff.selectedStrategy) {
      const rec = ansoff.recommendation || ansoff.selectedStrategy;
      strengths.push(`Recommended strategy: ${typeof rec === 'string' ? rec : JSON.stringify(rec)}`);
    }

    return { strengths, weaknesses, opportunities, threats };
  }

  /**
   * Convert Porter's Five Forces output to SWOT-like structure
   */
  private convertPortersToSWOT(porters: any): any {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const opportunities: string[] = [];
    const threats: string[] = [];

    const forces = [
      'buyer_power', 'supplier_power', 'competitive_rivalry',
      'threat_of_substitutes', 'threat_of_new_entrants'
    ];

    for (const force of forces) {
      const forceData = porters[force] || porters[force.replace(/_/g, '')] || null;
      if (forceData) {
        const intensity = forceData?.intensity || forceData?.level || 'moderate';
        const description = forceData?.analysis || forceData?.description || '';
        const entry = `${force.replace(/_/g, ' ')}: ${intensity}${description ? ' - ' + description : ''}`;

        // High intensity forces are threats, low intensity are opportunities
        if (intensity.toLowerCase().includes('high') || intensity.toLowerCase().includes('strong')) {
          threats.push(entry);
        } else if (intensity.toLowerCase().includes('low') || intensity.toLowerCase().includes('weak')) {
          opportunities.push(entry);
        } else {
          // Moderate forces: buyer/supplier power as weaknesses, others as threats
          if (force.includes('buyer') || force.includes('supplier')) {
            weaknesses.push(entry);
          } else {
            threats.push(entry);
          }
        }
      }
    }

    return { strengths, weaknesses, opportunities, threats };
  }

  /**
   * Generic fallback conversion for unknown frameworks
   */
  private convertGenericToSWOT(output: any, frameworkName: string): any {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const opportunities: string[] = [];
    const threats: string[] = [];

    // Try to find arrays of insights in the output
    const traverse = (obj: any, path: string = '') => {
      if (!obj || typeof obj !== 'object') return;

      for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (Array.isArray(value)) {
          value.forEach((item: any) => {
            const text = typeof item === 'string' ? item : item?.text || item?.description || item?.insight || JSON.stringify(item);
            // Distribute evenly across SWOT categories as a fallback
            if (key.toLowerCase().includes('strength') || key.toLowerCase().includes('advantage')) {
              strengths.push(text);
            } else if (key.toLowerCase().includes('weakness') || key.toLowerCase().includes('challenge')) {
              weaknesses.push(text);
            } else if (key.toLowerCase().includes('opportunit')) {
              opportunities.push(text);
            } else if (key.toLowerCase().includes('threat') || key.toLowerCase().includes('risk')) {
              threats.push(text);
            } else {
              // Classify based on content sentiment
              if (this.isPositiveFactor(text)) {
                opportunities.push(`${key}: ${text}`);
              } else {
                threats.push(`${key}: ${text}`);
              }
            }
          });
        } else if (typeof value === 'object' && value !== null) {
          traverse(value, `${path}.${key}`);
        }
      }
    };

    traverse(output);

    // If we couldn't extract anything, return null to trigger placeholder
    if (strengths.length === 0 && weaknesses.length === 0 && opportunities.length === 0 && threats.length === 0) {
      console.log(`[JourneyOrchestrator] Could not extract insights from ${frameworkName} output`);
      return null;
    }

    console.log(`[JourneyOrchestrator] Extracted ${strengths.length}S/${weaknesses.length}W/${opportunities.length}O/${threats.length}T from ${frameworkName}`);
    return { strengths, weaknesses, opportunities, threats };
  }

  /**
   * Simple heuristic to determine if a factor is positive or negative
   */
  private isPositiveFactor(text: string): boolean {
    const positiveKeywords = ['growth', 'opportunity', 'advantage', 'benefit', 'improve', 'increase', 'expand', 'gain', 'positive', 'favorable'];
    const negativeKeywords = ['risk', 'threat', 'decline', 'decrease', 'challenge', 'obstacle', 'barrier', 'negative', 'unfavorable', 'loss'];

    const lowerText = text.toLowerCase();
    const positiveScore = positiveKeywords.filter(k => lowerText.includes(k)).length;
    const negativeScore = negativeKeywords.filter(k => lowerText.includes(k)).length;

    return positiveScore >= negativeScore;
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
   * Auto-capture golden record if enabled
   * Called after journey completion (async, non-blocking)
   */
  private async autoCaptureGoldenRecord(
    journeySessionId: string,
    journeyType: JourneyType
  ): Promise<void> {
    // Check if auto-capture is enabled via environment variable
    const autoCaptureEnabled = process.env.AUTO_CAPTURE_GOLDEN === 'true';
    
    if (!autoCaptureEnabled) {
      console.log('[Golden Records] Auto-capture disabled (AUTO_CAPTURE_GOLDEN=false)');
      return;
    }

    // Journey allowlist (all journey types enabled for auto-capture)
    const allowedJourneys: JourneyType[] = [
      'market_entry',
      'business_model_innovation',
      'competitive_strategy',
      'digital_transformation',
      'crisis_recovery',
      'growth_strategy'
    ];
    
    if (!allowedJourneys.includes(journeyType)) {
      console.log(`[Golden Records] Journey type "${journeyType}" not in auto-capture allowlist`);
      return;
    }

    // Capture asynchronously without blocking the main flow
    setImmediate(async () => {
      try {
        console.log(`[Golden Records] 🔄 Auto-capturing golden record for journey: ${journeyType}`);
        const timestamp = new Date().toISOString();
        
        // Import the golden records service
        const {
          fetchJourneySessionData,
          sanitizeGoldenRecordData,
          saveGoldenRecordToFile,
        } = await import('../utils/golden-records-service');
        
        const { screenshotCaptureService } = await import('../services/screenshot-capture-service');
        
        // Fetch journey data
        const rawData = await fetchJourneySessionData(journeySessionId);
        
        if (!rawData) {
          console.error('[Golden Records] Failed to fetch journey session data for auto-capture');
          return;
        }

        // Sanitize data
        let sanitizedData = await sanitizeGoldenRecordData(rawData);

        // Determine next version
        const existingRecords = await db
          .select()
          .from(goldenRecords)
          .where(eq(goldenRecords.journeyType, journeyType as any))
          .orderBy(desc(goldenRecords.version));

        const maxVersion = existingRecords.length > 0 ? existingRecords[0].version : 0;
        const nextVersion = maxVersion + 1;

        // Update sanitized data with the correct golden record version
        sanitizedData.versionNumber = nextVersion;

        // Capture screenshots (AFTER determining version, without admin cookie)
        try {
          const stepsWithScreenshots = await screenshotCaptureService.captureStepScreenshots({
            journeyType,
            versionNumber: nextVersion,
            steps: sanitizedData.steps,
            adminSessionCookie: undefined,
          });
          
          sanitizedData = {
            ...sanitizedData,
            steps: stepsWithScreenshots,
          };
        } catch (screenshotError) {
          console.warn('[Golden Records] Screenshot capture failed during auto-capture, continuing without screenshots:', screenshotError);
        }

        // Save to local file
        await saveGoldenRecordToFile(sanitizedData, `Auto-captured on ${timestamp}`);

        // Save to database (don't auto-promote)
        const recordData = {
          journeyType: journeyType as any,
          version: nextVersion,
          parentVersion: maxVersion > 0 ? maxVersion : null,
          isCurrent: false, // Don't auto-promote
          metadata: sanitizedData.metadata,
          notes: `Auto-captured on ${timestamp}`,
          steps: sanitizedData.steps as any,
          createdBy: 'system', // Auto-capture is system-initiated
        };

        const [newRecord] = await db
          .insert(goldenRecords)
          .values(recordData)
          .returning();

        console.log(`[Golden Records] ✅ Auto-captured golden record v${nextVersion}: ${newRecord.id}`);
        console.log(`[Golden Records] Journey: ${journeyType}, Session: ${journeySessionId}`);
        
      } catch (error) {
        console.error('[Golden Records] Error during auto-capture:', error);
        // Don't throw - this is a non-critical background operation
      }
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
