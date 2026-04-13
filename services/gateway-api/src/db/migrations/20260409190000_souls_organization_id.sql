-- Migration: Add organization_id to souls tables so the admin routes can scope
-- souls per-org. Also adds the unique constraint activateSoul() relies on for
-- the ON CONFLICT upsert path, and a unique constraint on souls_installed so
-- only one install per org+soul pair exists.

BEGIN;

-- souls_catalog: organization scoping
ALTER TABLE souls_catalog
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_souls_catalog_org
  ON souls_catalog(organization_id, slug, created_at DESC);

-- souls_installed: organization scoping + upsert constraint
ALTER TABLE souls_installed
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

-- Unique constraint used by the install upsert (ON CONFLICT (organization_id, soul_id))
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'uq_souls_installed_org_soul'
  ) THEN
    ALTER TABLE souls_installed
      ADD CONSTRAINT uq_souls_installed_org_soul
      UNIQUE (organization_id, soul_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_souls_installed_org
  ON souls_installed(organization_id, status, installed_at DESC);

-- sven_identity_docs: organization scoping + upsert constraint
ALTER TABLE sven_identity_docs
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

-- Unique partial index for the activateSoul ON CONFLICT (organization_id, scope) WHERE scope = 'global'
CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_docs_org_global
  ON sven_identity_docs(organization_id, scope) WHERE scope = 'global';

COMMIT;
