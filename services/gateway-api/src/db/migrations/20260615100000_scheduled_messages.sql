-- ---------------------------------------------------------------------------
-- Scheduled Messages: Sven can send messages to users at a future time
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scheduled_messages (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Message from Sven',
  body          TEXT NOT NULL,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  delivered     BOOLEAN NOT NULL DEFAULT FALSE,
  delivered_at  TIMESTAMPTZ,
  channel       TEXT NOT NULL DEFAULT 'companion_push',
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending
  ON scheduled_messages(scheduled_at)
  WHERE NOT delivered;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user
  ON scheduled_messages(user_id, created_at DESC);
