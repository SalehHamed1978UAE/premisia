-- Migration: Add new fields to task_assignments table
-- Architecture Spec Section 20: Assignment Persistence Contract
-- Run this migration on the database to add the new columns

-- Add new columns to task_assignments table
ALTER TABLE task_assignments
ADD COLUMN IF NOT EXISTS task_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS resource_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS resource_role VARCHAR(100),
ADD COLUMN IF NOT EXISTS assigned_from DATE,
ADD COLUMN IF NOT EXISTS assigned_to DATE,
ADD COLUMN IF NOT EXISTS allocation_percent INTEGER DEFAULT 100;

-- Update comments
COMMENT ON COLUMN task_assignments.task_name IS 'Deliverable name for display in exports';
COMMENT ON COLUMN task_assignments.resource_name IS 'Resource display name for exports';
COMMENT ON COLUMN task_assignments.resource_role IS 'Role title (e.g., Store Manager)';
COMMENT ON COLUMN task_assignments.assigned_from IS 'Assignment start date';
COMMENT ON COLUMN task_assignments.assigned_to IS 'Assignment end date';
COMMENT ON COLUMN task_assignments.allocation_percent IS 'Percentage allocation (0-100)';

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'task_assignments'
ORDER BY ordinal_position;
