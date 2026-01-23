import { BaseRepository } from './base-repository';
import { journeySessions, strategicUnderstanding } from '@shared/schema';
import { eq, and, desc, max } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export type JourneySession = InferSelectModel<typeof journeySessions>;
export type NewJourneySession = InferInsertModel<typeof journeySessions>;
export type StrategicUnderstanding = InferSelectModel<typeof strategicUnderstanding>;
export type NewStrategicUnderstanding = InferInsertModel<typeof strategicUnderstanding>;

export class JourneyRepository extends BaseRepository<typeof journeySessions> {
  protected table = journeySessions;
  protected idColumn = journeySessions.id;

  async findByUnderstandingId(understandingId: string): Promise<JourneySession[]> {
    return this.db
      .select()
      .from(this.table)
      .where(eq(journeySessions.understandingId, understandingId))
      .orderBy(desc(journeySessions.versionNumber));
  }

  async findLatestByUnderstandingId(understandingId: string): Promise<JourneySession | null> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(journeySessions.understandingId, understandingId))
      .orderBy(desc(journeySessions.versionNumber))
      .limit(1);
    return results[0] || null;
  }

  async findByUserId(userId: string): Promise<JourneySession[]> {
    return this.db
      .select()
      .from(this.table)
      .where(eq(journeySessions.userId, userId))
      .orderBy(desc(journeySessions.createdAt));
  }

  async updateStatus(id: string, status: string): Promise<JourneySession | null> {
    const updateData: any = { 
      status, 
      updatedAt: new Date() 
    };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    return this.update(id, updateData);
  }

  async updateProgress(id: string, currentFrameworkIndex: number, completedFrameworks: string[]): Promise<JourneySession | null> {
    return this.update(id, {
      currentFrameworkIndex,
      completedFrameworks,
      updatedAt: new Date()
    });
  }

  async getNextVersionNumber(understandingId: string): Promise<number> {
    const result = await this.db
      .select({ maxVersion: max(journeySessions.versionNumber) })
      .from(this.table)
      .where(eq(journeySessions.understandingId, understandingId));
    return (result[0]?.maxVersion || 0) + 1;
  }

  async findUnderstandingById(id: string): Promise<StrategicUnderstanding | null> {
    const results = await this.db
      .select()
      .from(strategicUnderstanding)
      .where(eq(strategicUnderstanding.id, id))
      .limit(1);
    return results[0] || null;
  }

  async findUnderstandingBySessionId(sessionId: string): Promise<StrategicUnderstanding | null> {
    const results = await this.db
      .select()
      .from(strategicUnderstanding)
      .where(eq(strategicUnderstanding.sessionId, sessionId))
      .limit(1);
    return results[0] || null;
  }

  async createUnderstanding(data: NewStrategicUnderstanding): Promise<StrategicUnderstanding> {
    const results = await this.db
      .insert(strategicUnderstanding)
      .values(data)
      .returning();
    return results[0];
  }

  async updateUnderstanding(id: string, data: Partial<NewStrategicUnderstanding>): Promise<StrategicUnderstanding | null> {
    const results = await this.db
      .update(strategicUnderstanding)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(strategicUnderstanding.id, id))
      .returning();
    return results[0] || null;
  }
}
