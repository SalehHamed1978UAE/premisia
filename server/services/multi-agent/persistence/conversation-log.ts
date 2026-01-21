import { db } from '../../../db';
import { multiAgentSessions, multiAgentTurns } from '@shared/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { randomUUID as uuid } from 'crypto';

export interface BusinessContext {
  name: string;
  type: string;
  scale: string;
  description: string;
  industry?: string;
}

export interface ConversationTurn {
  id: string;
  sessionId: string;
  round: number;
  agentId: string;
  turnType: 'agent_input' | 'agent_output' | 'synthesis' | 'conflict_resolution';
  prompt: string;
  response: string | null;
  status: 'in_progress' | 'complete' | 'failed';
  tokensUsed: number;
  durationMs?: number;
  parsedOutput?: Record<string, any>;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface ConversationLog {
  sessionId: string;
  businessContext: BusinessContext;
  bmcInsights: any;
  startedAt: Date;
  updatedAt: Date;
  currentRound: number;
  status: 'initializing' | 'in_progress' | 'paused' | 'completed' | 'failed';
  turns: ConversationTurn[];
  completedRounds: number[];
  agentOutputsByRound: Record<number, Record<string, any>>;
  synthesisOutputsByRound: Record<number, any>;
}

export interface ResumePoint {
  round: number;
  agentsCompleted: string[];
  agentsPending: string[];
  needsSynthesis: boolean;
}

export class ConversationPersistence {
  async createSession(
    userId: string,
    businessContext: BusinessContext,
    bmcInsights?: any,
    journeySessionId?: string
  ): Promise<string> {
    const sessionId = uuid();
    
    await db.insert(multiAgentSessions).values({
      id: sessionId,
      userId,
      journeySessionId: journeySessionId || null,
      businessContext,
      bmcInsights: bmcInsights || null,
      status: 'initializing',
      currentRound: 1,
      totalRounds: 7,
      lastCompletedRound: 0,
    });
    
    return sessionId;
  }

  async updateSessionStatus(
    sessionId: string,
    status: 'initializing' | 'in_progress' | 'paused' | 'completed' | 'failed',
    updates?: {
      currentRound?: number;
      lastCompletedRound?: number;
      lastCompletedAgent?: string;
      errorMessage?: string;
      finalProgram?: any;
    }
  ): Promise<void> {
    await db.update(multiAgentSessions)
      .set({
        status,
        updatedAt: new Date(),
        ...(updates?.currentRound !== undefined && { currentRound: updates.currentRound }),
        ...(updates?.lastCompletedRound !== undefined && { lastCompletedRound: updates.lastCompletedRound }),
        ...(updates?.lastCompletedAgent && { lastCompletedAgent: updates.lastCompletedAgent }),
        ...(updates?.errorMessage && { errorMessage: updates.errorMessage }),
        ...(updates?.finalProgram && { finalProgram: updates.finalProgram }),
        ...(status === 'completed' && { completedAt: new Date() }),
      })
      .where(eq(multiAgentSessions.id, sessionId));
  }

  async saveTurn(turn: Omit<ConversationTurn, 'createdAt'>): Promise<void> {
    await db.insert(multiAgentTurns).values({
      id: turn.id,
      sessionId: turn.sessionId,
      round: turn.round,
      agentId: turn.agentId,
      turnType: turn.turnType,
      prompt: turn.prompt,
      response: turn.response,
      status: turn.status,
      tokensUsed: turn.tokensUsed,
      durationMs: turn.durationMs,
      parsedOutput: turn.parsedOutput,
      errorMessage: turn.errorMessage,
      completedAt: turn.completedAt,
    });
  }

  async updateTurn(
    turnId: string,
    updates: {
      response?: string;
      status?: 'in_progress' | 'complete' | 'failed';
      tokensUsed?: number;
      durationMs?: number;
      parsedOutput?: Record<string, any>;
      errorMessage?: string;
    }
  ): Promise<void> {
    await db.update(multiAgentTurns)
      .set({
        ...updates,
        ...(updates.status === 'complete' && { completedAt: new Date() }),
      })
      .where(eq(multiAgentTurns.id, turnId));
  }

  async loadSession(sessionId: string): Promise<{
    session: typeof multiAgentSessions.$inferSelect;
    turns: typeof multiAgentTurns.$inferSelect[];
  } | null> {
    const sessions = await db.select()
      .from(multiAgentSessions)
      .where(eq(multiAgentSessions.id, sessionId));
    
    if (sessions.length === 0) return null;
    
    const turns = await db.select()
      .from(multiAgentTurns)
      .where(eq(multiAgentTurns.sessionId, sessionId))
      .orderBy(asc(multiAgentTurns.round), asc(multiAgentTurns.createdAt));
    
    return { session: sessions[0], turns };
  }

  async loadConversation(sessionId: string): Promise<ConversationLog | null> {
    const data = await this.loadSession(sessionId);
    if (!data) return null;
    
    const { session, turns } = data;
    
    const completedRounds = this.getCompletedRounds(turns);
    const agentOutputsByRound = this.getAgentOutputsByRound(turns);
    const synthesisOutputsByRound = this.getSynthesisOutputsByRound(turns);
    
    return {
      sessionId,
      businessContext: session.businessContext as BusinessContext,
      bmcInsights: session.bmcInsights,
      startedAt: session.startedAt || new Date(),
      updatedAt: session.updatedAt || new Date(),
      currentRound: session.currentRound,
      status: session.status,
      turns: turns.map(t => ({
        id: t.id,
        sessionId: t.sessionId,
        round: t.round,
        agentId: t.agentId,
        turnType: t.turnType,
        prompt: t.prompt,
        response: t.response,
        status: t.status,
        tokensUsed: t.tokensUsed || 0,
        durationMs: t.durationMs || undefined,
        parsedOutput: t.parsedOutput as Record<string, any> | undefined,
        errorMessage: t.errorMessage || undefined,
        createdAt: t.createdAt || new Date(),
        completedAt: t.completedAt || undefined,
      })),
      completedRounds,
      agentOutputsByRound,
      synthesisOutputsByRound,
    };
  }

  async getResumePoint(sessionId: string, roundAgents: string[]): Promise<ResumePoint> {
    const log = await this.loadConversation(sessionId);
    
    if (!log) {
      return { round: 1, agentsCompleted: [], agentsPending: roundAgents, needsSynthesis: false };
    }
    
    const lastCompletedRound = Math.max(...log.completedRounds, 0);
    const currentRound = lastCompletedRound + 1;
    
    const currentRoundTurns = log.turns.filter(t =>
      t.round === currentRound &&
      t.status === 'complete' &&
      t.turnType === 'agent_output'
    );
    
    const agentsCompleted = currentRoundTurns.map(t => t.agentId);
    const agentsPending = roundAgents.filter(a => !agentsCompleted.includes(a));
    
    const hasSynthesis = log.turns.some(t =>
      t.round === currentRound &&
      t.status === 'complete' &&
      t.turnType === 'synthesis'
    );
    
    return {
      round: currentRound,
      agentsCompleted,
      agentsPending,
      needsSynthesis: !hasSynthesis && agentsPending.length === 0,
    };
  }

  async getRoundOutputs(sessionId: string, round: number): Promise<Record<string, any>> {
    const turns = await db.select()
      .from(multiAgentTurns)
      .where(
        and(
          eq(multiAgentTurns.sessionId, sessionId),
          eq(multiAgentTurns.round, round),
          eq(multiAgentTurns.status, 'complete')
        )
      );
    
    const outputs: Record<string, any> = {};
    for (const turn of turns) {
      if (turn.turnType === 'agent_output' && turn.parsedOutput) {
        outputs[turn.agentId] = turn.parsedOutput;
      }
    }
    return outputs;
  }

  async getSynthesis(sessionId: string, round: number): Promise<any | null> {
    const turns = await db.select()
      .from(multiAgentTurns)
      .where(
        and(
          eq(multiAgentTurns.sessionId, sessionId),
          eq(multiAgentTurns.round, round),
          eq(multiAgentTurns.turnType, 'synthesis'),
          eq(multiAgentTurns.status, 'complete')
        )
      );
    
    return turns.length > 0 ? turns[0].parsedOutput : null;
  }

  private getCompletedRounds(turns: typeof multiAgentTurns.$inferSelect[]): number[] {
    const rounds = new Set<number>();
    
    for (const turn of turns) {
      if (turn.turnType === 'synthesis' && turn.status === 'complete') {
        rounds.add(turn.round);
      }
    }
    
    return Array.from(rounds).sort((a, b) => a - b);
  }

  private getAgentOutputsByRound(turns: typeof multiAgentTurns.$inferSelect[]): Record<number, Record<string, any>> {
    const outputs: Record<number, Record<string, any>> = {};
    
    for (const turn of turns) {
      if (turn.turnType === 'agent_output' && turn.status === 'complete' && turn.parsedOutput) {
        if (!outputs[turn.round]) outputs[turn.round] = {};
        outputs[turn.round][turn.agentId] = turn.parsedOutput;
      }
    }
    
    return outputs;
  }

  private getSynthesisOutputsByRound(turns: typeof multiAgentTurns.$inferSelect[]): Record<number, any> {
    const outputs: Record<number, any> = {};
    
    for (const turn of turns) {
      if (turn.turnType === 'synthesis' && turn.status === 'complete' && turn.parsedOutput) {
        outputs[turn.round] = turn.parsedOutput;
      }
    }
    
    return outputs;
  }
}

export const conversationPersistence = new ConversationPersistence();
