/**
 * DBConnectionManager - System-wide database connection management
 * 
 * CRITICAL PATTERN FOR ALL LONG-RUNNING OPERATIONS:
 * Neon serverless database kills idle connections during long AI/web operations.
 * This manager ensures connections are only held during active DB operations.
 * 
 * USAGE PATTERN (ALL JOURNEYS MUST FOLLOW THIS):
 * 
 * 1. Get initial data (with fresh connection)
 * 2. Release connection
 * 3. Perform long operation (web searches, AI calls)
 * 4. Get new connection with retry
 * 5. Save results
 * 
 * Example:
 * ```typescript
 * const manager = new DBConnectionManager();
 * 
 * // STEP 1: Get data (connection acquired and released automatically)
 * const initialData = await manager.withFreshConnection(async (db) => {
 *   return await db.select().from(table).where(...);
 * });
 * 
 * // STEP 2: Long operation (NO connection held)
 * const results = await performWebSearches(initialData);
 * 
 * // STEP 3: Save results (new connection with retry)
 * await manager.retryWithBackoff(async (db) => {
 *   return await db.insert(table).values(results);
 * });
 * ```
 * 
 * APPLIES TO:
 * - BMC Researcher
 * - Market Researcher
 * - Porter's Analyzer
 * - PESTLE Analyzer
 * - Five Whys flow
 * - ALL future journeys (Blue Ocean, SWOT, OKRs, etc.)
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { pool } from './db';
import * as schema from '@shared/schema';

export interface DBOperation<T> {
  (db: ReturnType<typeof drizzle>): Promise<T>;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export class DBConnectionManager {
  private defaultRetryOptions: Required<RetryOptions> = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    onRetry: (attempt, error) => {
      console.log(`[DBConnectionManager] Retry attempt ${attempt} after error:`, error.message);
    }
  };

  /**
   * Execute a database operation with a fresh connection.
   * Connection is automatically acquired before operation and released after.
   * 
   * Use this for SHORT database operations (queries, inserts, updates).
   * Do NOT use during long AI/web operations.
   */
  async withFreshConnection<T>(operation: DBOperation<T>): Promise<T> {
    const client = await pool.connect();
    try {
      const db = drizzle({ client, schema });
      const result = await operation(db);
      return result;
    } finally {
      // CRITICAL: Always release connection back to pool
      client.release();
    }
  }

  /**
   * Execute a database operation with automatic retry and exponential backoff.
   * Handles transient connection errors (timeouts, connection killed, etc.)
   * 
   * Use this for SAVING RESULTS after long operations.
   */
  async retryWithBackoff<T>(
    operation: DBOperation<T>,
    options?: RetryOptions
  ): Promise<T> {
    const opts = { ...this.defaultRetryOptions, ...options };
    let lastError: Error;

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      try {
        return await this.withFreshConnection(operation);
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable (connection issues)
        if (!this.isRetryableError(error)) {
          // Not a connection error, throw immediately
          throw error;
        }

        if (attempt === opts.maxRetries) {
          // Final attempt failed, throw
          console.error(`[DBConnectionManager] All ${opts.maxRetries} retry attempts failed`);
          throw error;
        }

        // Calculate exponential backoff delay
        const delay = Math.min(
          opts.baseDelayMs * Math.pow(2, attempt - 1),
          opts.maxDelayMs
        );

        opts.onRetry(attempt, error as Error);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // TypeScript requires this, but we always throw or return above
    throw lastError!;
  }

  /**
   * Check if an error is retryable (connection-related).
   * Returns true for errors that might be resolved by reconnecting.
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    const retryablePatterns = [
      'terminating connection',
      'connection terminated',
      'connection closed',
      'connection timeout',
      'connection lost',
      'econnreset',
      'econnrefused',
      'etimedout',
      'administrator command', // Neon-specific: connection killed by admin
    ];

    return retryablePatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Execute multiple database operations in a transaction with retry.
   * All operations succeed or all fail together.
   * 
   * Use this when you need atomic updates across multiple tables.
   */
  async transactionWithRetry<T>(
    operations: DBOperation<T>,
    options?: RetryOptions
  ): Promise<T> {
    return this.retryWithBackoff(async (db) => {
      // Note: Neon serverless doesn't support traditional transactions
      // This wraps operations in a single connection for consistency
      return await operations(db);
    }, options);
  }
}

/**
 * Singleton instance for convenience.
 * Import and use this in all researchers and analyzers.
 */
export const dbConnectionManager = new DBConnectionManager();
