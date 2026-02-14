-- Add optional explicit budget constraint for dual-mode EPM
ALTER TABLE strategic_understanding
ADD COLUMN IF NOT EXISTS budget_constraint JSONB;

