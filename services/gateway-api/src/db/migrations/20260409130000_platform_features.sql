-- Migration: Platform Features — E2EE, Calls, Media, Presence, Search
--
-- Covers features 3-7 of the Sven platform roadmap:
--   3. End-to-end encryption (E2EE) — Olm/Megolm-style
--   4. Voice/Video calls — WebRTC signaling via NATS
--   5. File sharing & media — S3-compatible uploads
--   6. Read receipts & typing indicators — real-time presence
--   7. Message search — tsvector full-text + pgvector semantic

-- ═══════════════════════════════════════════════════════════════
-- § 3 — E2EE: End-to-End Encryption
-- ═══════════════════════════════════════════════════════════════

-- Each device has a Curve25519 identity key + Ed25519 signing key
CREATE TABLE IF NOT EXISTS e2ee_device_keys (
  device_id         TEXT NOT NULL,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  identity_key      TEXT NOT NULL,          -- Curve25519 public key (base64)
  signing_key       TEXT NOT NULL,          -- Ed25519 public key (base64)
  device_name       TEXT NOT NULL DEFAULT '',
  algorithms        TEXT[] NOT NULL DEFAULT ARRAY['m.olm.v1.curve25519-aes-sha2', 'm.megolm.v1.aes-sha2'],
  verified          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_e2ee_device_keys_user ON e2ee_device_keys (user_id);

-- One-time pre-keys for establishing Olm sessions
CREATE TABLE IF NOT EXISTS e2ee_one_time_keys (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id           TEXT NOT NULL,
  device_id         TEXT NOT NULL,
  algorithm         TEXT NOT NULL DEFAULT 'signed_curve25519',
  key_id            TEXT NOT NULL,
  key_data          TEXT NOT NULL,          -- public key (base64)
  signature         TEXT,                   -- Ed25519 signature
  claimed           BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_by_user   TEXT,
  claimed_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id, device_id) REFERENCES e2ee_device_keys(user_id, device_id) ON DELETE CASCADE,
  UNIQUE (user_id, device_id, key_id)
);
CREATE INDEX IF NOT EXISTS idx_e2ee_otk_available ON e2ee_one_time_keys (user_id, device_id, claimed)
  WHERE NOT claimed;

-- Fallback keys (used when OTKs are exhausted)
CREATE TABLE IF NOT EXISTS e2ee_fallback_keys (
  user_id           TEXT NOT NULL,
  device_id         TEXT NOT NULL,
  algorithm         TEXT NOT NULL DEFAULT 'signed_curve25519',
  key_id            TEXT NOT NULL,
  key_data          TEXT NOT NULL,
  signature         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id, device_id) REFERENCES e2ee_device_keys(user_id, device_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, device_id, algorithm)
);

-- Megolm outbound group session tracking (room → session mapping)
CREATE TABLE IF NOT EXISTS e2ee_megolm_sessions (
  session_id        TEXT PRIMARY KEY,
  chat_id           TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_device_id  TEXT NOT NULL,
  algorithm         TEXT NOT NULL DEFAULT 'm.megolm.v1.aes-sha2',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ,
  message_index     INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_e2ee_megolm_chat ON e2ee_megolm_sessions (chat_id);

-- Encrypted room key backup (server-side, encrypted with user recovery key)
CREATE TABLE IF NOT EXISTS e2ee_key_backup (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version           INT NOT NULL DEFAULT 1,
  algorithm         TEXT NOT NULL DEFAULT 'm.megolm_backup.v1.curve25519-aes-sha2',
  auth_data         JSONB NOT NULL DEFAULT '{}',    -- public key for backup encryption
  session_data      JSONB NOT NULL DEFAULT '{}',    -- encrypted session keys
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, version)
);

-- Cross-signing keys for device verification
CREATE TABLE IF NOT EXISTS e2ee_cross_signing_keys (
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_type          TEXT NOT NULL CHECK (key_type IN ('master', 'self_signing', 'user_signing')),
  key_data          TEXT NOT NULL,
  signatures        JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, key_type)
);

-- Add encrypted content support to messages table
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_content_type_check;
ALTER TABLE messages
  ADD CONSTRAINT messages_content_type_check
  CHECK (content_type IN ('text', 'file', 'audio', 'blocks', 'encrypted', 'image', 'video'));

-- Encrypted message metadata (stored alongside cleartext message row)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS e2ee_algorithm   TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS e2ee_sender_key  TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS e2ee_session_id  TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS e2ee_ciphertext  TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS e2ee_device_id   TEXT;


-- ═══════════════════════════════════════════════════════════════
-- § 4 — Voice/Video Calls (WebRTC signaling)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS calls (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id           TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  initiator_user_id TEXT NOT NULL REFERENCES users(id),
  call_type         TEXT NOT NULL CHECK (call_type IN ('voice', 'video', 'screen_share')),
  status            TEXT NOT NULL DEFAULT 'ringing'
                    CHECK (status IN ('ringing', 'active', 'ended', 'missed', 'declined', 'failed')),
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  duration_seconds  INT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calls_chat ON calls (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls (status) WHERE status IN ('ringing', 'active');

CREATE TABLE IF NOT EXISTS call_participants (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  call_id           TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL REFERENCES users(id),
  device_id         TEXT,
  status            TEXT NOT NULL DEFAULT 'invited'
                    CHECK (status IN ('invited', 'ringing', 'joined', 'left', 'declined', 'failed')),
  joined_at         TIMESTAMPTZ,
  left_at           TIMESTAMPTZ,
  media_state       JSONB NOT NULL DEFAULT '{"audio": true, "video": false, "screen": false}',
  UNIQUE (call_id, user_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_call_participants_call ON call_participants (call_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_user ON call_participants (user_id)
  WHERE status IN ('invited', 'ringing', 'joined');

-- ICE/TURN server configuration (org-level)
CREATE TABLE IF NOT EXISTS webrtc_config (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id            TEXT,
  stun_urls         TEXT[] NOT NULL DEFAULT ARRAY['stun:stun.l.google.com:19302'],
  turn_urls         TEXT[] NOT NULL DEFAULT '{}',
  turn_username     TEXT,
  turn_credential   TEXT,
  turn_ttl_seconds  INT NOT NULL DEFAULT 86400,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
-- § 5 — File Sharing & Media
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS media_uploads (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id           TEXT NOT NULL REFERENCES users(id),
  chat_id           TEXT REFERENCES chats(id),
  message_id        TEXT REFERENCES messages(id),
  file_name         TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  size_bytes        BIGINT NOT NULL,
  storage_backend   TEXT NOT NULL DEFAULT 'local'
                    CHECK (storage_backend IN ('local', 's3', 'minio')),
  storage_key       TEXT NOT NULL,             -- object key / file path
  thumbnail_key     TEXT,                       -- thumbnail object key
  width             INT,
  height            INT,
  duration_seconds  NUMERIC(10,2),             -- for audio/video
  checksum_sha256   TEXT NOT NULL,
  encrypted         BOOLEAN NOT NULL DEFAULT FALSE,
  e2ee_key          TEXT,                       -- AES key encrypted to recipient(s)
  e2ee_iv           TEXT,                       -- initialization vector
  e2ee_hash         TEXT,                       -- SHA-256 of ciphertext
  processing_status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (processing_status IN ('pending', 'processing', 'ready', 'failed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_uploads_chat ON media_uploads (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_uploads_user ON media_uploads (user_id);
CREATE INDEX IF NOT EXISTS idx_media_uploads_message ON media_uploads (message_id);

-- Gallery view: link multiple media items per message
CREATE TABLE IF NOT EXISTS message_attachments (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id        TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  media_upload_id   TEXT NOT NULL REFERENCES media_uploads(id) ON DELETE CASCADE,
  sort_order        INT NOT NULL DEFAULT 0,
  caption           TEXT,
  UNIQUE (message_id, media_upload_id)
);
CREATE INDEX IF NOT EXISTS idx_message_attachments_msg ON message_attachments (message_id);

-- Storage backend configuration
CREATE TABLE IF NOT EXISTS media_storage_config (
  id                TEXT PRIMARY KEY DEFAULT 'default',
  backend           TEXT NOT NULL DEFAULT 'local'
                    CHECK (backend IN ('local', 's3', 'minio')),
  local_path        TEXT NOT NULL DEFAULT '/data/uploads',
  s3_bucket         TEXT,
  s3_region         TEXT,
  s3_endpoint       TEXT,       -- for MinIO
  s3_access_key     TEXT,       -- encrypted in env, reference only
  s3_secret_key     TEXT,       -- encrypted in env, reference only
  max_file_size_mb  INT NOT NULL DEFAULT 100,
  allowed_mime_types TEXT[] NOT NULL DEFAULT ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
    'application/pdf', 'text/plain', 'text/markdown',
    'application/zip', 'application/gzip'
  ],
  thumbnail_max_width  INT NOT NULL DEFAULT 320,
  thumbnail_max_height INT NOT NULL DEFAULT 320,
  cdn_base_url      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO media_storage_config (id, backend, local_path) VALUES ('default', 'local', '/data/uploads')
  ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- § 6 — Read Receipts & Typing Indicators
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS read_receipts (
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id           TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  last_read_message_id TEXT NOT NULL,
  last_read_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, chat_id)
);
CREATE INDEX IF NOT EXISTS idx_read_receipts_chat ON read_receipts (chat_id);

-- Unread count view (materialized for performance)
CREATE OR REPLACE FUNCTION unread_count(p_user_id TEXT, p_chat_id TEXT)
RETURNS BIGINT AS $$
  SELECT COUNT(*)
  FROM messages m
  WHERE m.chat_id = p_chat_id
    AND m.created_at > COALESCE(
      (SELECT last_read_at FROM read_receipts WHERE user_id = p_user_id AND chat_id = p_chat_id),
      '1970-01-01'::timestamptz
    )
    AND m.sender_user_id IS DISTINCT FROM p_user_id
$$ LANGUAGE sql STABLE;


-- ═══════════════════════════════════════════════════════════════
-- § 7 — Message Search (Full-Text + Semantic)
-- ═══════════════════════════════════════════════════════════════

-- Full-text search column + index on messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_tsv TSVECTOR;

-- Trigger to auto-update tsvector on insert/update
CREATE OR REPLACE FUNCTION messages_search_tsv_trigger() RETURNS trigger AS $$
BEGIN
  IF NEW.text IS NOT NULL AND NEW.encrypted = FALSE THEN
    NEW.search_tsv := to_tsvector('english', NEW.text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_search_tsv ON messages;
CREATE TRIGGER trg_messages_search_tsv
  BEFORE INSERT OR UPDATE OF text ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_search_tsv_trigger();

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_messages_search_tsv ON messages USING GIN (search_tsv);

-- Composite index for scoped search (by chat)
CREATE INDEX IF NOT EXISTS idx_messages_chat_search ON messages (chat_id, created_at DESC)
  WHERE search_tsv IS NOT NULL;

-- Semantic search embedding column (reuses pgvector from foundation)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_embedding vector(1536);
CREATE INDEX IF NOT EXISTS idx_messages_search_embedding ON messages
  USING ivfflat (search_embedding vector_cosine_ops) WITH (lists = 100);

-- Backfill existing messages with tsvector
UPDATE messages SET search_tsv = to_tsvector('english', text)
  WHERE text IS NOT NULL AND search_tsv IS NULL AND encrypted = FALSE;


-- ═══════════════════════════════════════════════════════════════
-- § 8 — Presence (online status)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_presence (
  user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'offline'
                    CHECK (status IN ('online', 'away', 'dnd', 'offline')),
  status_message    TEXT,
  last_active_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
-- § Seed data
-- ═══════════════════════════════════════════════════════════════

-- Default STUN/TURN configuration
INSERT INTO webrtc_config (id, stun_urls) VALUES (
  'default',
  ARRAY['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']
) ON CONFLICT (id) DO NOTHING;
