-- ═══════════════════════════════════════════════════════════════════════════
-- API Keys: Add kid + organization_id columns
-- ═══════════════════════════════════════════════════════════════════════════
-- The OpenAI-compat and A2A routes expect kid-based lookups and org binding.
-- Original 070_api_keys.sql lacked these columns.

BEGIN;

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS kid TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;

-- kid-based lookup index (fast path for sk-sven-<kid>.xxx auth)
CREATE INDEX IF NOT EXISTS idx_api_keys_kid ON api_keys (kid) WHERE revoked_at IS NULL;

-- org-scoped queries
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys (organization_id) WHERE revoked_at IS NULL;

COMMIT;
