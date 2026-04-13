-- Migration: 20260409160000_chat_thread_polish
-- Adds server-side persistence for reactions, pinned messages, and reply-to (Batch 7.3).

-- Message reactions
CREATE TABLE IF NOT EXISTS message_reactions (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_msg ON message_reactions(message_id);

-- Pinned messages
CREATE TABLE IF NOT EXISTS pinned_messages (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id     TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  pinned_by   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pinned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chat_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_pinned_messages_chat ON pinned_messages(chat_id);

-- Reply-to reference on messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL;
