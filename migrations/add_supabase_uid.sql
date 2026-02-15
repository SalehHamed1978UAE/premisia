-- Migration: Add supabaseUid column to users table for Supabase Auth integration
-- Description: Adds a unique column to link users with their Supabase authentication ID

ALTER TABLE users
ADD COLUMN IF NOT EXISTS supabase_uid TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_supabase_uid ON users(supabase_uid);

COMMENT ON COLUMN users.supabase_uid IS 'Links to Supabase Auth user.id for authentication';
