import { randomUUID as uuid } from 'crypto';
import { conversationPersistence, ConversationLog, BusinessContext } from './persistence/conversation-log';
import { agents, getAgent, getAllAgentIds } from './agents';
import { rounds, getRound, getTotalRounds, synthesisOutputSchema, conflictResolutionSchema } from './rounds';
import { buildAgentSystemPrompt, buildRoundPrompt, buildSynthesisPrompt, buildConflictResolutionPrompt } from './prompts/agent-prompts';
import { llmInterface } from './llm/interface';
import { epmAssembler, EPMProgram } from './assembly/epm-assembler';

export interface ProgressUpdate {
  type: 'resume' | 'round_start' | 'round_complete' | 'agent_start' | 'agent_complete' | 'synthesis_start' | 'synthesis_complete' | 'conflict_resolution_start' | 'conflict_resolution_complete' | 'complete' | 'error';
  round?: number;
  name?: string;
  agent?: string;
  conflicts?: number;
  progress?: number;
  message?: string;
  error?: string;
}

export interface OrchestratorConfig {
  agentTimeoutMs?: number;
  maxRetries?: number;
  parallelAgents?: boolean;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  agentTimeoutMs: 90000,
  maxRetries: 2,
  parallelAgents: true,
};

export class MultiAgentOrchestrator {
  private config: OrchestratorConfig;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate an EPM program through multi-agent collaboration.
   * Session ID handling:
   * - If providedSessionId exists and is not completed, resume it
   * - If providedSessionId exists and is completed, return the cached result
   * - If providedSessionId doesn't exist, create a new session with that ID
   * - If no providedSessionId, generate a new session ID
   */
  async generate(
    userId: string,
    businessContext: BusinessContext,
    bmcInsights: any,
    journeySessionId?: string,
    onProgress?: (progress: ProgressUpdate) => void,
    providedSessionId?: string
  ): Promise<{ sessionId: string; program: EPMProgram }> {
    // Check if we should resume or return cached result for existing session
    if (providedSessionId) {
      const sessionStatus = await conversationPersistence.getSessionStatus(providedSessionId);
      if (sessionStatus.exists) {
        if (sessionStatus.status === 'completed') {
          console.log(`[Orchestrator] Session ${providedSessionId} already completed, returning cached result`);
          // Session is completed - return the cached program
          return this.resume(providedSessionId, onProgress);
        } else {
          console.log(`[Orchestrator] Session ${providedSessionId} exists with status ${sessionStatus.status}, resuming...`);
          return this.resume(providedSessionId, onProgress);
        }
      }
    }

    const sessionId = await conversationPersistence.createSession(
      userId,
      businessContext,
      bmcInsights,
      journeySessionId,
      providedSessionId
    );

    console.log(`[Orchestrator] Created session ${sessionId} for ${businessContext.name}`);

    await conversationPersistence.updateSessionStatus(sessionId, 'in_progress');

    try {
      const program = await this.executeSession(sessionId, businessContext, bmcInsights, onProgress);
      
      await conversationPersistence.updateSessionStatus(sessionId, 'completed', {
        finalProgram: program,
      });

      onProgress?.({ type: 'complete', progress: 100, message: 'EPM program generated successfully' });

      return { sessionId, program };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Orchestrator] Session ${sessionId} failed:`, errorMessage);
      
      await conversationPersistence.updateSessionStatus(sessionId, 'failed', {
        errorMessage,
      });

      onProgress?.({ type: 'error', error: errorMessage });
      throw error;
    }
  }

  async resume(
    sessionId: string,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<{ sessionId: string; program: EPMProgram }> {
    const data = await conversationPersistence.loadSession(sessionId);
    if (!data) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const { session } = data;
    const businessContext = session.businessContext as BusinessContext;
    const bmcInsights = session.bmcInsights;

    if (session.status === 'completed' && session.finalProgram) {
      return { sessionId, program: session.finalProgram as EPMProgram };
    }

    console.log(`[Orchestrator] Resuming session ${sessionId} from round ${session.currentRound}`);
    
    await conversationPersistence.updateSessionStatus(sessionId, 'in_progress');
    onProgress?.({ type: 'resume', round: session.currentRound });

    try {
      const program = await this.executeSession(sessionId, businessContext, bmcInsights, onProgress);
      
      await conversationPersistence.updateSessionStatus(sessionId, 'completed', {
        finalProgram: program,
      });

      onProgress?.({ type: 'complete', progress: 100, message: 'EPM program generated successfully' });

      return { sessionId, program };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await conversationPersistence.updateSessionStatus(sessionId, 'failed', {
        errorMessage,
      });
      onProgress?.({ type: 'error', error: errorMessage });
      throw error;
    }
  }

  private async executeSession(
    sessionId: string,
    businessContext: BusinessContext,
    bmcInsights: any,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<EPMProgram> {
    const totalRounds = getTotalRounds();

    for (const roundDef of rounds) {
      const resumePoint = await conversationPersistence.getResumePoint(
        sessionId,
        roundDef.participatingAgents.includes('all') ? getAllAgentIds() : roundDef.participatingAgents
      );

      if (roundDef.round < resumePoint.round) {
        console.log(`[Orchestrator] Skipping completed round ${roundDef.round}`);
        continue;
      }

      const progress = Math.round(((roundDef.round - 1) / totalRounds) * 100);
      onProgress?.({
        type: 'round_start',
        round: roundDef.round,
        name: roundDef.name,
        progress,
        message: `Round ${roundDef.round}/${totalRounds}: ${roundDef.name}`,
      });

      await conversationPersistence.updateSessionStatus(sessionId, 'in_progress', {
        currentRound: roundDef.round,
      });

      await this.executeRound(
        sessionId,
        roundDef,
        businessContext,
        bmcInsights,
        resumePoint.round === roundDef.round ? resumePoint.agentsCompleted : [],
        resumePoint.round === roundDef.round ? !resumePoint.needsSynthesis : true,
        onProgress
      );

      await conversationPersistence.updateSessionStatus(sessionId, 'in_progress', {
        lastCompletedRound: roundDef.round,
      });

      onProgress?.({
        type: 'round_complete',
        round: roundDef.round,
        name: roundDef.name,
        progress: Math.round((roundDef.round / totalRounds) * 100),
      });
    }

    const conversationLog = await conversationPersistence.loadConversation(sessionId);
    if (!conversationLog) {
      throw new Error('Failed to load conversation log for assembly');
    }

    return epmAssembler.assemble(conversationLog, businessContext);
  }

  private async executeRound(
    sessionId: string,
    roundDef: typeof rounds[0],
    businessContext: BusinessContext,
    bmcInsights: any,
    alreadyCompleted: string[],
    skipAgents: boolean,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<void> {
    const agentIds = roundDef.participatingAgents.includes('all')
      ? getAllAgentIds()
      : roundDef.participatingAgents;

    const pendingAgents = skipAgents ? [] : agentIds.filter(id => !alreadyCompleted.includes(id));
    const previousContext = await this.buildContextFromPreviousRounds(sessionId, roundDef.inputFromPreviousRounds);

    if (pendingAgents.length > 0) {
      if (roundDef.parallel && this.config.parallelAgents) {
        await Promise.all(pendingAgents.map(agentId =>
          this.executeAgent(
            sessionId,
            agentId,
            roundDef,
            businessContext,
            bmcInsights,
            previousContext,
            onProgress
          )
        ));
      } else {
        for (const agentId of pendingAgents) {
          await this.executeAgent(
            sessionId,
            agentId,
            roundDef,
            businessContext,
            bmcInsights,
            previousContext,
            onProgress
          );
        }
      }
    }

    if (roundDef.requiresSynthesis) {
      await this.executeSynthesis(sessionId, roundDef, businessContext, onProgress);
    }

    if (roundDef.conflictResolution) {
      await this.executeConflictResolution(sessionId, roundDef, businessContext, onProgress);
    }
  }

  private async executeAgent(
    sessionId: string,
    agentId: string,
    roundDef: typeof rounds[0],
    businessContext: BusinessContext,
    bmcInsights: any,
    previousContext: string,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<void> {
    const agent = getAgent(agentId);
    if (!agent) {
      console.warn(`[Orchestrator] Unknown agent: ${agentId}`);
      return;
    }

    const turnId = uuid();
    const systemPrompt = buildAgentSystemPrompt(agent);
    const userPrompt = buildRoundPrompt(agent, roundDef, businessContext, bmcInsights, previousContext);

    await conversationPersistence.saveTurn({
      id: turnId,
      sessionId,
      round: roundDef.round,
      agentId,
      turnType: 'agent_input',
      prompt: userPrompt,
      response: null,
      status: 'in_progress',
      tokensUsed: 0,
    });

    onProgress?.({
      type: 'agent_start',
      round: roundDef.round,
      agent: agent.role,
    });

    const startTime = Date.now();

    try {
      const response = await llmInterface.generateStructured({
        systemPrompt,
        userPrompt,
        schema: agent.outputSchema,
      });

      const parsedOutput = response.content as Record<string, any>;
      
      await conversationPersistence.updateTurn(turnId, {
        response: JSON.stringify(parsedOutput),
        status: 'complete',
        tokensUsed: response.tokensUsed,
        durationMs: response.durationMs,
        parsedOutput,
      });

      await conversationPersistence.saveTurn({
        id: uuid(),
        sessionId,
        round: roundDef.round,
        agentId,
        turnType: 'agent_output',
        prompt: '',
        response: JSON.stringify(parsedOutput),
        status: 'complete',
        tokensUsed: response.tokensUsed,
        durationMs: response.durationMs,
        parsedOutput,
      });

      onProgress?.({
        type: 'agent_complete',
        round: roundDef.round,
        agent: agent.role,
      });

      console.log(`[Orchestrator] Agent ${agentId} completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await conversationPersistence.updateTurn(turnId, {
        status: 'failed',
        errorMessage,
        durationMs: Date.now() - startTime,
      });

      console.error(`[Orchestrator] Agent ${agentId} failed:`, errorMessage);
    }
  }

  private async executeSynthesis(
    sessionId: string,
    roundDef: typeof rounds[0],
    businessContext: BusinessContext,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<void> {
    const agentOutputs = await conversationPersistence.getRoundOutputs(sessionId, roundDef.round);

    if (Object.keys(agentOutputs).length === 0) {
      console.warn(`[Orchestrator] No agent outputs for synthesis in round ${roundDef.round}`);
      return;
    }

    const turnId = uuid();
    const synthesisPrompt = buildSynthesisPrompt(roundDef, agentOutputs, businessContext);

    await conversationPersistence.saveTurn({
      id: turnId,
      sessionId,
      round: roundDef.round,
      agentId: 'program_coordinator',
      turnType: 'synthesis',
      prompt: synthesisPrompt,
      response: null,
      status: 'in_progress',
      tokensUsed: 0,
    });

    onProgress?.({ type: 'synthesis_start', round: roundDef.round });

    try {
      const response = await llmInterface.generateStructured({
        systemPrompt: agents.program_coordinator.goal,
        userPrompt: synthesisPrompt,
        schema: synthesisOutputSchema,
      });

      const synthesisParsedOutput = response.content as Record<string, any>;
      
      await conversationPersistence.updateTurn(turnId, {
        response: JSON.stringify(synthesisParsedOutput),
        status: 'complete',
        tokensUsed: response.tokensUsed,
        durationMs: response.durationMs,
        parsedOutput: synthesisParsedOutput,
      });

      onProgress?.({ type: 'synthesis_complete', round: roundDef.round });

      console.log(`[Orchestrator] Synthesis for round ${roundDef.round} completed`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await conversationPersistence.updateTurn(turnId, {
        status: 'failed',
        errorMessage,
      });

      console.error(`[Orchestrator] Synthesis failed for round ${roundDef.round}:`, errorMessage);
    }
  }

  private async executeConflictResolution(
    sessionId: string,
    roundDef: typeof rounds[0],
    businessContext: BusinessContext,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<void> {
    const synthesis = await conversationPersistence.getSynthesis(sessionId, roundDef.round);

    if (!synthesis?.conflicts || synthesis.conflicts.length === 0) {
      console.log(`[Orchestrator] No conflicts to resolve in round ${roundDef.round}`);
      return;
    }

    const turnId = uuid();
    const resolutionPrompt = buildConflictResolutionPrompt(roundDef, synthesis, businessContext);

    await conversationPersistence.saveTurn({
      id: turnId,
      sessionId,
      round: roundDef.round,
      agentId: 'program_coordinator',
      turnType: 'conflict_resolution',
      prompt: resolutionPrompt,
      response: null,
      status: 'in_progress',
      tokensUsed: 0,
    });

    onProgress?.({
      type: 'conflict_resolution_start',
      round: roundDef.round,
      conflicts: synthesis.conflicts.length,
    });

    try {
      const response = await llmInterface.generateStructured({
        systemPrompt: 'You are an experienced program manager who makes clear, justified decisions to resolve conflicts.',
        userPrompt: resolutionPrompt,
        schema: conflictResolutionSchema,
      });

      const resolutionParsedOutput = response.content as Record<string, any>;
      
      await conversationPersistence.updateTurn(turnId, {
        response: JSON.stringify(resolutionParsedOutput),
        status: 'complete',
        tokensUsed: response.tokensUsed,
        durationMs: response.durationMs,
        parsedOutput: resolutionParsedOutput,
      });

      onProgress?.({ type: 'conflict_resolution_complete', round: roundDef.round });

      console.log(`[Orchestrator] Conflict resolution for round ${roundDef.round} completed`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await conversationPersistence.updateTurn(turnId, {
        status: 'failed',
        errorMessage,
      });

      console.error(`[Orchestrator] Conflict resolution failed for round ${roundDef.round}:`, errorMessage);
    }
  }

  private async buildContextFromPreviousRounds(
    sessionId: string,
    roundNumbers: number[]
  ): Promise<string> {
    if (roundNumbers.length === 0) {
      return '';
    }

    const contextParts: string[] = [];

    for (const round of roundNumbers) {
      const synthesis = await conversationPersistence.getSynthesis(sessionId, round);
      if (synthesis) {
        contextParts.push(`### Round ${round} Summary\n${synthesis.roundSummary || JSON.stringify(synthesis, null, 2)}`);
      }
    }

    return contextParts.join('\n\n');
  }
}

export const multiAgentOrchestrator = new MultiAgentOrchestrator();
