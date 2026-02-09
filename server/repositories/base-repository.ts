import { db } from '../db';
import { eq, inArray, SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'asc' | 'desc';
}

export abstract class BaseRepository<T extends PgTable<any>> {
  protected db = db;
  protected abstract table: T;
  protected abstract idColumn: any;

  async findById(id: string): Promise<any | null> {
    const results = await (this.db as any)
      .select()
      .from(this.table)
      .where(eq(this.idColumn, id))
      .limit(1);
    return results[0] || null;
  }

  async findAll(options: QueryOptions = {}): Promise<any[]> {
    const { limit = 100, offset = 0 } = options;
    return (this.db as any)
      .select()
      .from(this.table)
      .limit(limit)
      .offset(offset);
  }

  async findByIds(ids: string[]): Promise<any[]> {
    if (!ids.length) return [];
    return (this.db as any)
      .select()
      .from(this.table)
      .where(inArray(this.idColumn, ids));
  }

  async create(data: any): Promise<any> {
    const results = await (this.db as any)
      .insert(this.table)
      .values(data)
      .returning();
    return results[0];
  }

  async update(id: string, data: any): Promise<any | null> {
    const results = await (this.db as any)
      .update(this.table)
      .set(data)
      .where(eq(this.idColumn, id))
      .returning();
    return results[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const results = await (this.db as any)
      .delete(this.table)
      .where(eq(this.idColumn, id))
      .returning();
    return results.length > 0;
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.findById(id);
    return result !== null;
  }

  async count(where?: SQL): Promise<number> {
    const results = where
      ? await (this.db as any).select().from(this.table).where(where)
      : await (this.db as any).select().from(this.table);
    return results.length;
  }
}
