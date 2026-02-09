import { BaseRepository } from './base-repository';
import { strategyVersions, strategyDecisions } from '@shared/schema';
import { eq, and, desc, max } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export type StrategyVersion = InferSelectModel<typeof strategyVersions>;
export type NewStrategyVersion = InferInsertModel<typeof strategyVersions>;
export type StrategyDecision = InferSelectModel<typeof strategyDecisions>;
export type NewStrategyDecision = InferInsertModel<typeof strategyDecisions>;

export class StrategyRepository extends BaseRepository<typeof strategyVersions> {
  protected table = strategyVersions;
  protected idColumn = strategyVersions.id;

  async findByUserId(userId: string, options: { includeArchived?: boolean } = {}): Promise<StrategyVersion[]> {
    const conditions = options.includeArchived
      ? eq(strategyVersions.userId, userId)
      : and(eq(strategyVersions.userId, userId), eq(strategyVersions.archived, false));
    
    return this.db
      .select()
      .from(this.table)
      .where(conditions)
      .orderBy(desc(strategyVersions.createdAt));
  }

  async findBySessionId(sessionId: string): Promise<StrategyVersion[]> {
    return this.db
      .select()
      .from(this.table)
      .where(eq(strategyVersions.sessionId, sessionId))
      .orderBy(desc(strategyVersions.versionNumber));
  }

  async findLatestBySessionId(sessionId: string): Promise<StrategyVersion | null> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(strategyVersions.sessionId, sessionId))
      .orderBy(desc(strategyVersions.versionNumber))
      .limit(1);
    return results[0] || null;
  }

  async getNextVersionNumber(sessionId: string): Promise<number> {
    const result = await this.db
      .select({ maxVersion: max(strategyVersions.versionNumber) })
      .from(this.table)
      .where(eq(strategyVersions.sessionId, sessionId));
    return (result[0]?.maxVersion || 0) + 1;
  }

  async updateStatus(id: string, status: 'draft' | 'finalized' | 'archived'): Promise<StrategyVersion | null> {
    const updateData: any = { 
      status, 
      updatedAt: new Date() 
    };
    if (status === 'finalized') {
      updateData.finalizedAt = new Date();
    }
    return this.update(id, updateData);
  }

  async archive(id: string): Promise<StrategyVersion | null> {
    return this.update(id, { 
      archived: true, 
      updatedAt: new Date() 
    });
  }

  async linkToProgram(id: string, programId: string): Promise<StrategyVersion | null> {
    return this.update(id, { 
      convertedProgramId: programId,
      updatedAt: new Date() 
    });
  }

  async findDecisionByVersionId(versionId: string): Promise<StrategyDecision | null> {
    const results = await this.db
      .select()
      .from(strategyDecisions)
      .where(eq(strategyDecisions.strategyVersionId, versionId))
      .limit(1);
    return results[0] || null;
  }

  async findDecisionsByUserId(userId: string): Promise<StrategyDecision[]> {
    return this.db
      .select()
      .from(strategyDecisions)
      .where(eq(strategyDecisions.userId, userId))
      .orderBy(desc(strategyDecisions.createdAt));
  }

  async createDecision(data: NewStrategyDecision): Promise<StrategyDecision> {
    const results = await this.db
      .insert(strategyDecisions)
      .values(data)
      .returning();
    return results[0];
  }

  async updateDecision(id: string, data: Partial<NewStrategyDecision>): Promise<StrategyDecision | null> {
    const results = await this.db
      .update(strategyDecisions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(strategyDecisions.id, id))
      .returning();
    return results[0] || null;
  }
}
