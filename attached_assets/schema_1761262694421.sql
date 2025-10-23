/**
 * @module planning/database/schema
 * Database schema for persisting planning results
 */

-- PostgreSQL schema for planning system

-- ============================================
-- CORE TABLES
-- ============================================

-- Planning sessions table
CREATE TABLE planning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epm_program_id UUID NOT NULL,
  business_context JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  iterations INTEGER DEFAULT 0,
  final_score DECIMAL(5,2),
  success BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_planning_sessions_epm_program_id ON planning_sessions(epm_program_id);
CREATE INDEX idx_planning_sessions_status ON planning_sessions(status);

-- Schedules table
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_session_id UUID NOT NULL REFERENCES planning_sessions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  schedule_data JSONB NOT NULL,
  total_duration INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  critical_path TEXT[],
  is_final BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedules_planning_session_id ON schedules(planning_session_id);
CREATE INDEX idx_schedules_is_final ON schedules(is_final);

-- Tasks table (denormalized from schedule for querying)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  task_id VARCHAR(255) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_days INTEGER NOT NULL,
  dependencies TEXT[],
  is_critical BOOLEAN DEFAULT FALSE,
  slack_days INTEGER DEFAULT 0,
  confidence_score DECIMAL(5,2),
  assigned_resources TEXT[],
  deliverables JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_schedule_id ON tasks(schedule_id);
CREATE INDEX idx_tasks_is_critical ON tasks(is_critical);
CREATE INDEX idx_tasks_start_date ON tasks(start_date);

-- Validation results table
CREATE TABLE validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  is_valid BOOLEAN NOT NULL,
  overall_score DECIMAL(5,2) NOT NULL,
  feasibility_score DECIMAL(5,2),
  efficiency_score DECIMAL(5,2),
  risk_score DECIMAL(5,2),
  resource_utilization_score DECIMAL(5,2),
  issues JSONB NOT NULL DEFAULT '[]',
  suggestions TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_validation_results_schedule_id ON validation_results(schedule_id);

-- Rationalization reports table
CREATE TABLE rationalization_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  logical_coherence DECIMAL(5,2) NOT NULL,
  reasoning TEXT[],
  assumptions TEXT[],
  risks JSONB NOT NULL DEFAULT '[]',
  opportunities JSONB NOT NULL DEFAULT '[]',
  critical_insights TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rationalization_reports_schedule_id ON rationalization_reports(schedule_id);

-- Strategy adjustments table
CREATE TABLE strategy_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_session_id UUID NOT NULL REFERENCES planning_sessions(id) ON DELETE CASCADE,
  adjustment_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  original_value TEXT,
  suggested_value TEXT,
  impact VARCHAR(20),
  priority INTEGER DEFAULT 0,
  accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_strategy_adjustments_planning_session_id ON strategy_adjustments(planning_session_id);
CREATE INDEX idx_strategy_adjustments_accepted ON strategy_adjustments(accepted);

-- ============================================
-- RESOURCE MANAGEMENT TABLES
-- ============================================

-- Resources table
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  capacity DECIMAL(10,2) NOT NULL,
  skills TEXT[],
  cost_per_unit DECIMAL(10,2),
  availability JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Resource allocations table
CREATE TABLE resource_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  allocation_percentage DECIMAL(5,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resource_allocations_task_id ON resource_allocations(task_id);
CREATE INDEX idx_resource_allocations_resource_id ON resource_allocations(resource_id);

-- Resource conflicts table
CREATE TABLE resource_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  required_resources DECIMAL(10,2) NOT NULL,
  available_resources DECIMAL(10,2) NOT NULL,
  overallocation DECIMAL(10,2) NOT NULL,
  affected_tasks TEXT[],
  resolution_status VARCHAR(50) DEFAULT 'unresolved',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resource_conflicts_schedule_id ON resource_conflicts(schedule_id);
CREATE INDEX idx_resource_conflicts_resolution_status ON resource_conflicts(resolution_status);

-- ============================================
-- OPTIMIZATION TRACKING TABLES
-- ============================================

-- Optimization iterations table
CREATE TABLE optimization_iterations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_session_id UUID NOT NULL REFERENCES planning_sessions(id) ON DELETE CASCADE,
  iteration_number INTEGER NOT NULL,
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  score DECIMAL(5,2) NOT NULL,
  adjustments JSONB NOT NULL DEFAULT '[]',
  improvement_from_previous DECIMAL(5,2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_optimization_iterations_planning_session_id ON optimization_iterations(planning_session_id);
CREATE INDEX idx_optimization_iterations_iteration_number ON optimization_iterations(iteration_number);

-- Planning steps table (for progress tracking)
CREATE TABLE planning_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_session_id UUID NOT NULL REFERENCES planning_sessions(id) ON DELETE CASCADE,
  step_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  error_message TEXT,
  result_summary TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_planning_steps_planning_session_id ON planning_steps(planning_session_id);
CREATE INDEX idx_planning_steps_status ON planning_steps(status);

-- ============================================
-- CACHE TABLES
-- ============================================

-- LLM response cache table
CREATE TABLE llm_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(64) NOT NULL UNIQUE,
  method VARCHAR(50) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  response JSONB NOT NULL,
  hits INTEGER DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_llm_cache_cache_key ON llm_cache(cache_key);
CREATE INDEX idx_llm_cache_expires_at ON llm_cache(expires_at);

-- ============================================
-- ANALYTICS TABLES
-- ============================================

-- Planning metrics table
CREATE TABLE planning_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_sessions INTEGER DEFAULT 0,
  successful_sessions INTEGER DEFAULT 0,
  failed_sessions INTEGER DEFAULT 0,
  average_iterations DECIMAL(5,2),
  average_score DECIMAL(5,2),
  average_duration_ms INTEGER,
  strategy_adjustments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_planning_metrics_date ON planning_metrics(date);

-- Error logs table
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_session_id UUID REFERENCES planning_sessions(id) ON DELETE SET NULL,
  error_type VARCHAR(100) NOT NULL,
  error_category VARCHAR(50),
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_error_logs_planning_session_id ON error_logs(planning_session_id);
CREATE INDEX idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at);

-- ============================================
-- VIEWS
-- ============================================

-- Current schedules view
CREATE VIEW current_schedules AS
SELECT 
  s.*,
  ps.epm_program_id,
  ps.business_context,
  vr.overall_score,
  vr.is_valid
FROM schedules s
JOIN planning_sessions ps ON s.planning_session_id = ps.id
LEFT JOIN validation_results vr ON vr.schedule_id = s.id
WHERE s.is_final = TRUE;

-- Planning session summary view
CREATE VIEW planning_session_summary AS
SELECT 
  ps.id,
  ps.epm_program_id,
  ps.status,
  ps.started_at,
  ps.completed_at,
  ps.iterations,
  ps.final_score,
  ps.success,
  COUNT(DISTINCT s.id) as schedule_versions,
  COUNT(DISTINCT sa.id) as adjustment_count,
  MAX(vr.overall_score) as best_score
FROM planning_sessions ps
LEFT JOIN schedules s ON s.planning_session_id = ps.id
LEFT JOIN strategy_adjustments sa ON sa.planning_session_id = ps.id
LEFT JOIN validation_results vr ON vr.schedule_id = s.id
GROUP BY ps.id;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache() RETURNS void AS $$
BEGIN
  DELETE FROM llm_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update metrics
CREATE OR REPLACE FUNCTION update_planning_metrics() RETURNS trigger AS $$
BEGIN
  INSERT INTO planning_metrics (
    date,
    total_sessions,
    successful_sessions,
    failed_sessions
  )
  VALUES (
    CURRENT_DATE,
    1,
    CASE WHEN NEW.success THEN 1 ELSE 0 END,
    CASE WHEN NOT NEW.success THEN 1 ELSE 0 END
  )
  ON CONFLICT (date) DO UPDATE SET
    total_sessions = planning_metrics.total_sessions + 1,
    successful_sessions = planning_metrics.successful_sessions + 
      CASE WHEN NEW.success THEN 1 ELSE 0 END,
    failed_sessions = planning_metrics.failed_sessions + 
      CASE WHEN NOT NEW.success THEN 1 ELSE 0 END,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to update metrics on session completion
CREATE TRIGGER update_metrics_on_session_complete
  AFTER UPDATE ON planning_sessions
  FOR EACH ROW
  WHEN (OLD.status != 'completed' AND NEW.status = 'completed')
  EXECUTE FUNCTION update_planning_metrics();

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_planning_sessions_updated_at
  BEFORE UPDATE ON planning_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
