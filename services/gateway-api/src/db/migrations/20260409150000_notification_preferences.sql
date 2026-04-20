-- Migration: 20260409150000_notification_preferences
-- Adds per-user notification preference storage (Batch 7.2).

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel   TEXT NOT NULL,                -- e.g. 'messages', 'approvals', 'reminders', 'agents', 'calls', 'memory'
  enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  sound     TEXT NOT NULL DEFAULT 'default',  -- 'default', 'subtle', 'silent'
  vibrate   BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (user_id, channel)
);

-- DND and global prefs stored alongside on the users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS dnd_enabled       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dnd_start_hour    SMALLINT NOT NULL DEFAULT 22;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dnd_start_minute  SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dnd_end_hour      SMALLINT NOT NULL DEFAULT 7;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dnd_end_minute    SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_sound       TEXT NOT NULL DEFAULT 'default';
