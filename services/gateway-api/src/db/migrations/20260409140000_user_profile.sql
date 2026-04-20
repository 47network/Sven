-- Migration: 20260409140000_user_profile
-- Adds profile fields to the users table for Batch 7.1 (User Profile).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio          TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS timezone     TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS status_emoji TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_text  TEXT NOT NULL DEFAULT '';

-- Update GET /v1/auth/me to return new columns (handled in route code).
