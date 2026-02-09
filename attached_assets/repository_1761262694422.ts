/**
 * @module planning/database/repository
 * Database repository for planning system
 */

import { Pool, QueryResult } from 'pg';
import { 
  Schedule, 
  Task, 
  ValidationResult, 
  RationalizationReport 
} from '../types';
import { PlanningResult } from '../orchestrator';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
}

export class PlanningRepository {
  private pool: Pool;
  
  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      ...config,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000
    });
  }
  
  /**
   * Create a new planning session
   */
  async createSession(
    epmProgramId: string,
    businessContext: any
  ): Promise<string> {
    const query = `
      INSERT INTO planning_sessions (epm_program_id, business_context, status)
      VALUES ($1, $2, 'running')
      RETURNING id
    `;
    
    const result = await this.pool.query(query, [
      epmProgramId,
      JSON.stringify(businessContext)
    ]);
    
    return result.rows[0].id;
  }
  
  /**
   * Update planning session
   */
  async updateSession(
    sessionId: string,
    updates: {
      status?: string;
      iterations?: number;
      finalScore?: number;
      success?: boolean;
      completedAt?: Date;
    }
  ): Promise<void> {
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    if (updates.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(updates.status);
    }
    
    if (updates.iterations !== undefined) {
      fields.push(`iterations = $${paramCount++}`);
      values.push(updates.iterations);
    }
    
    if (updates.finalScore !== undefined) {
      fields.push(`final_score = $${paramCount++}`);
      values.push(updates.finalScore);
    }
    
    if (updates.success !== undefined) {
      fields.push(`success = $${paramCount++}`);
      values.push(updates.success);
    }
    
    if (updates.completedAt !== undefined) {
      fields.push(`completed_at = $${paramCount++}`);
      values.push(updates.completedAt);
    }
    
    if (fields.length === 0) return;
    
    const query = `
      UPDATE planning_sessions
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
    `;
    
    values.push(sessionId);
    await this.pool.query(query, values);
  }
  
  /**
   * Save schedule
   */
  async saveSchedule(
    sessionId: string,
    schedule: Schedule,
    version: number,
    isFinal: boolean = false
  ): Promise<string> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert schedule
      const scheduleQuery = `
        INSERT INTO schedules (
          planning_session_id, version, schedule_data, 
          total_duration, start_date, end_date, 
          critical_path, is_final
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;
      
      const scheduleResult = await client.query(scheduleQuery, [
        sessionId,
        version,
        JSON.stringify(schedule),
        schedule.totalDuration,
        schedule.startDate,
        schedule.endDate,
        schedule.criticalPath,
        isFinal
      ]);
      
      const scheduleId = scheduleResult.rows[0].id;
      
      // Insert tasks
      for (const task of schedule.tasks) {
        const taskQuery = `
          INSERT INTO tasks (
            schedule_id, task_id, name, description,
            start_date, end_date, duration_days,
            dependencies, is_critical, slack_days,
            confidence_score, assigned_resources, deliverables
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;
        
        const durationDays = Math.ceil(
          (task.endDate.getTime() - task.startDate.getTime()) / 
          (1000 * 60 * 60 * 24)
        );
        
        await client.query(taskQuery, [
          scheduleId,
          task.id,
          task.name,
          task.description || null,
          task.startDate,
          task.endDate,
          durationDays,
          task.dependencies,
          task.isCritical,
          task.slack,
          null, // confidence_score - calculate if needed
          task.assignedResources,
          JSON.stringify(task.deliverables)
        ]);
      }
      
      await client.query('COMMIT');
      return scheduleId;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Save validation result
   */
  async saveValidationResult(
    scheduleId: string,
    validation: ValidationResult
  ): Promise<void> {
    const query = `
      INSERT INTO validation_results (
        schedule_id, is_valid, overall_score,
        feasibility_score, efficiency_score,
        risk_score, resource_utilization_score,
        issues, suggestions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    
    await this.pool.query(query, [
      scheduleId,
      validation.isValid,
      validation.score.overall,
      validation.score.feasibility,
      validation.score.efficiency,
      validation.score.riskLevel,
      validation.score.resourceUtilization,
      JSON.stringify(validation.issues),
      validation.suggestions
    ]);
  }
  
  /**
   * Save rationalization report
   */
  async saveRationalizationReport(
    scheduleId: string,
    report: RationalizationReport
  ): Promise<void> {
    const query = `
      INSERT INTO rationalization_reports (
        schedule_id, logical_coherence, reasoning,
        assumptions, risks, opportunities,
        critical_insights
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    
    await this.pool.query(query, [
      scheduleId,
      report.logicalCoherence,
      report.reasoning,
      report.assumptions,
      JSON.stringify(report.risks),
      JSON.stringify(report.opportunities),
      report.criticalInsights
    ]);
  }
  
  /**
   * Save strategy adjustments
   */
  async saveStrategyAdjustments(
    sessionId: string,
    adjustments: string[]
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const adjustment of adjustments) {
        const parsed = this.parseAdjustment(adjustment);
        
        const query = `
          INSERT INTO strategy_adjustments (
            planning_session_id, adjustment_type,
            description, original_value, suggested_value,
            impact, priority
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        
        await client.query(query, [
          sessionId,
          parsed.type,
          parsed.description,
          parsed.originalValue,
          parsed.suggestedValue,
          parsed.impact,
          parsed.priority
        ]);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Save planning step for progress tracking
   */
  async savePlanningStep(
    sessionId: string,
    step: {
      name: string;
      status: string;
      startedAt: Date;
      completedAt?: Date;
      errorMessage?: string;
      resultSummary?: string;
      durationMs?: number;
    }
  ): Promise<void> {
    const query = `
      INSERT INTO planning_steps (
        planning_session_id, step_name, status,
        started_at, completed_at, error_message,
        result_summary, duration_ms
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    await this.pool.query(query, [
      sessionId,
      step.name,
      step.status,
      step.startedAt,
      step.completedAt || null,
      step.errorMessage || null,
      step.resultSummary || null,
      step.durationMs || null
    ]);
  }
  
  /**
   * Get planning session by ID
   */
  async getSession(sessionId: string): Promise<any> {
    const query = `
      SELECT * FROM planning_sessions WHERE id = $1
    `;
    
    const result = await this.pool.query(query, [sessionId]);
    return result.rows[0];
  }
  
  /**
   * Get latest schedule for a session
   */
  async getLatestSchedule(sessionId: string): Promise<any> {
    const query = `
      SELECT s.*, vr.overall_score, vr.is_valid
      FROM schedules s
      LEFT JOIN validation_results vr ON vr.schedule_id = s.id
      WHERE s.planning_session_id = $1
      ORDER BY s.version DESC
      LIMIT 1
    `;
    
    const result = await this.pool.query(query, [sessionId]);
    return result.rows[0];
  }
  
  /**
   * Get planning history for an EPM program
   */
  async getPlanningHistory(epmProgramId: string): Promise<any[]> {
    const query = `
      SELECT 
        ps.*,
        COUNT(DISTINCT s.id) as schedule_versions,
        COUNT(DISTINCT sa.id) as adjustment_count,
        MAX(vr.overall_score) as best_score
      FROM planning_sessions ps
      LEFT JOIN schedules s ON s.planning_session_id = ps.id
      LEFT JOIN strategy_adjustments sa ON sa.planning_session_id = ps.id
      LEFT JOIN validation_results vr ON vr.schedule_id = s.id
      WHERE ps.epm_program_id = $1
      GROUP BY ps.id
      ORDER BY ps.created_at DESC
      LIMIT 10
    `;
    
    const result = await this.pool.query(query, [epmProgramId]);
    return result.rows;
  }
  
  /**
   * Cache LLM response
   */
  async cacheLLMResponse(
    cacheKey: string,
    method: string,
    requestHash: string,
    response: any,
    ttlSeconds: number = 3600
  ): Promise<void> {
    const query = `
      INSERT INTO llm_cache (
        cache_key, method, request_hash,
        response, expires_at
      )
      VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${ttlSeconds} seconds')
      ON CONFLICT (cache_key) DO UPDATE
      SET 
        response = $4,
        hits = llm_cache.hits + 1,
        last_accessed_at = NOW(),
        expires_at = NOW() + INTERVAL '${ttlSeconds} seconds'
    `;
    
    await this.pool.query(query, [
      cacheKey,
      method,
      requestHash,
      JSON.stringify(response)
    ]);
  }
  
  /**
   * Get cached LLM response
   */
  async getCachedLLMResponse(cacheKey: string): Promise<any | null> {
    const query = `
      SELECT response 
      FROM llm_cache 
      WHERE cache_key = $1 AND expires_at > NOW()
    `;
    
    const result = await this.pool.query(query, [cacheKey]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    // Update hit count
    await this.pool.query(
      `UPDATE llm_cache 
       SET hits = hits + 1, last_accessed_at = NOW() 
       WHERE cache_key = $1`,
      [cacheKey]
    );
    
    return result.rows[0].response;
  }
  
  /**
   * Clean up expired cache entries
   */
  async cleanupCache(): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM llm_cache WHERE expires_at < NOW() RETURNING id'
    );
    return result.rowCount || 0;
  }
  
  /**
   * Get planning metrics for date range
   */
  async getMetrics(startDate: Date, endDate: Date): Promise<any> {
    const query = `
      SELECT 
        SUM(total_sessions) as total_sessions,
        SUM(successful_sessions) as successful_sessions,
        SUM(failed_sessions) as failed_sessions,
        AVG(average_iterations) as avg_iterations,
        AVG(average_score) as avg_score,
        AVG(average_duration_ms) as avg_duration,
        SUM(strategy_adjustments_count) as total_adjustments
      FROM planning_metrics
      WHERE date BETWEEN $1 AND $2
    `;
    
    const result = await this.pool.query(query, [startDate, endDate]);
    return result.rows[0];
  }
  
  /**
   * Log error
   */
  async logError(
    error: Error,
    context: any,
    sessionId?: string
  ): Promise<void> {
    const query = `
      INSERT INTO error_logs (
        planning_session_id, error_type, error_category,
        error_message, stack_trace, context
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    await this.pool.query(query, [
      sessionId || null,
      error.name,
      this.categorizeError(error),
      error.message,
      error.stack || null,
      JSON.stringify(context)
    ]);
  }
  
  /**
   * Close database connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
  
  /**
   * Helper to parse adjustment string
   */
  private parseAdjustment(adjustment: string): any {
    // Parse adjustment string into structured data
    const type = adjustment.includes('Timeline') ? 'timeline' :
                 adjustment.includes('Budget') ? 'budget' :
                 adjustment.includes('Resource') ? 'resource' : 'other';
    
    return {
      type,
      description: adjustment,
      originalValue: null,
      suggestedValue: null,
      impact: 'medium',
      priority: 1
    };
  }
  
  /**
   * Helper to categorize errors
   */
  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('connection')) return 'connection';
    if (message.includes('validation')) return 'validation';
    if (message.includes('llm')) return 'llm';
    if (message.includes('resource')) return 'resource';
    
    return 'unknown';
  }
}

/**
 * Create repository with default configuration
 */
export function createRepository(): PlanningRepository {
  return new PlanningRepository({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'planning_system',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  });
}
