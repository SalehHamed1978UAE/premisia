-- Migration: Add supabaseUid column to users table for Supabase Auth integration
-- Date: 2025-02-09
-- Description: Adds a unique column to link users with their Supabase authentication ID

-- Add the supabaseUid column if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS supabase_uid TEXT UNIQUE;

-- Create an index for faster lookups by supabaseUid
CREATE INDEX IF NOT EXISTS idx_users_supabase_uid ON users(supabase_uid);

-- Optional: Add a comment to document the column
COMMENT ON COLUMN users.supabase_uid IS 'Links to Supabase Auth user.id for authentication';