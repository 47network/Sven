-- Migration: Push pending payloads for privacy-first push notifications
--
-- Stores notification payloads server-side so that FCM/APNs only receives
-- a content-free wake-up signal. The actual notification content is fetched
-- directly from the Sven server by the client, keeping Google and Apple
-- out of the notification content path (similar to Rocket.Chat's approach).
--
-- Supports both FCM data-only messages and UnifiedPush distributors.

CREATE TABLE IF NOT EXISTS push_pending (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  channel     TEXT NOT NULL DEFAULT 'sven_messages',
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority    TEXT NOT NULL DEFAULT 'normal',
  fetched     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_push_pending_user_fetched
  ON push_pending (user_id, fetched) WHERE NOT fetched;

CREATE INDEX IF NOT EXISTS idx_push_pending_expires
  ON push_pending (expires_at);

-- Track UnifiedPush endpoints alongside FCM/VAPID tokens.
-- platform = 'unified_push' with token = the UP endpoint URL.
-- Existing mobile_push_tokens table already supports this via
-- the generic platform/token columns.

-- Scheduled cleanup: expired payloads are purged by the notification service.
