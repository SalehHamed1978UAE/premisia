import { BaseRepository } from './base-repository';
import { epmPrograms, taskAssignments } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export type EPMProgram = InferSelectModel<typeof epmPrograms>;
export type NewEPMProgram = InferInsertModel<typeof epmPrograms>;
export type TaskAssignment = InferSelectModel<typeof taskAssignments>;
export type NewTaskAssignment = InferInsertModel<typeof taskAssignments>;

export class EPMRepository extends BaseRepository<typeof epmPrograms> {
  protected table = epmPrograms;
  protected idColumn = epmPrograms.id;

  async findByStrategyVersionId(strategyVersionId: string): Promise<EPMProgram | null> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(epmPrograms.strategyVersionId, strategyVersionId))
      .limit(1);
    return results[0] || null;
  }

  async findByUserId(userId: string, options: { includeArchived?: boolean } = {}): Promise<EPMProgram[]> {
    const conditions = options.includeArchived
      ? eq(epmPrograms.userId, userId)
      : and(eq(epmPrograms.userId, userId), eq(epmPrograms.archived, false));
    
    return this.db
      .select()
      .from(this.table)
      .where(conditions)
      .orderBy(desc(epmPrograms.createdAt));
  }

  async updateStatus(id: string, status: 'draft' | 'finalized' | 'archived'): Promise<EPMProgram | null> {
    const updateData: any = { 
      status, 
      updatedAt: new Date() 
    };
    if (status === 'finalized') {
      updateData.finalizedAt = new Date();
    }
    return this.update(id, updateData);
  }

  async archive(id: string): Promise<EPMProgram | null> {
    return this.update(id, { 
      archived: true, 
      status: 'archived',
      updatedAt: new Date() 
    });
  }

  async createTaskAssignment(data: NewTaskAssignment): Promise<TaskAssignment> {
    const results = await this.db
      .insert(taskAssignments)
      .values(data)
      .returning();
    return results[0];
  }

  async createTaskAssignments(data: NewTaskAssignment[]): Promise<TaskAssignment[]> {
    if (!data.length) return [];
    return this.db
      .insert(taskAssignments)
      .values(data)
      .returning();
  }

  async findTaskAssignmentsByProgramId(programId: string): Promise<TaskAssignment[]> {
    return this.db
      .select()
      .from(taskAssignments)
      .where(eq(taskAssignments.epmProgramId, programId));
  }

  async deleteTaskAssignmentsByProgramId(programId: string): Promise<number> {
    const results = await this.db
      .delete(taskAssignments)
      .where(eq(taskAssignments.epmProgramId, programId))
      .returning();
    return results.length;
  }
}
