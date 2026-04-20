-- Batch 7.4: Store theme preferences server-side for cross-device sync.
-- Uses a JSONB column for flexibility — schema stays stable as new settings are added.
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Partial GIN index for future queries filtering by specific theme properties.
CREATE INDEX IF NOT EXISTS idx_users_theme_prefs ON users USING gin (theme_prefs);
