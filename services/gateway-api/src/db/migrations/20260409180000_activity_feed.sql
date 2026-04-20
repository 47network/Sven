-- Batch 7.6: Activity feed for unified timeline events.
CREATE TABLE IF NOT EXISTS activity_feed (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'chat_created', 'chat_message', 'agent_run', 'memory_update',
    'approval_request', 'approval_resolved', 'org_invite', 'login', 'setting_change'
  )),
  title TEXT NOT NULL,
  body TEXT,
  resource_id TEXT,
  resource_type TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_org ON activity_feed (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_unread ON activity_feed (user_id, read) WHERE NOT read;
