-- Eidolon Phase 1 completion migration.
--
-- The Phase 1 migration (20260635700000_eidolon_world_simulation.sql) shipped
-- the simulation tables (agent_states, agent_interactions, agent_businesses,
-- agent_business_revenue_events, agent_structure_builds, eidolon_world_ticks)
-- and extended the agent_token_ledger.kind CHECK with business_revenue,
-- structure_build, and land_purchase.
--
-- However, the runtime code in services/sven-eidolon/src/repo-write.ts and the
-- seeder script depend on two additional pieces that were NOT in that
-- migration:
--
--   1. agent_profiles.token_balance column — used as the cached running token
--      balance, kept transactionally in lockstep with agent_token_ledger.
--      Without it: recordBusinessRun() and buildStructure() crash, and the
--      seeder cannot grant starter tokens.
--
--   2. agent_parcels table — owns each agent's plot of land, tracks structures
--      built, land value, token_invested. Used by buildStructure() and seeded
--      one-per-agent on the ring layout.
--
-- This migration adds both. Idempotent (IF NOT EXISTS / ADD COLUMN IF NOT
-- EXISTS) so it is safe to re-run on partial-applied environments.
--
-- Rollback:
--   ALTER TABLE agent_profiles DROP COLUMN IF EXISTS token_balance;
--   DROP TABLE IF EXISTS agent_parcels;

BEGIN;

-- ─── 1. Cached token balance on agent_profiles ─────────────────────────────
-- Source of truth remains agent_token_ledger.balance_after on the latest row.
-- This column mirrors that value and is kept consistent inside the same
-- transaction that writes the ledger row (see repo-write.ts).
ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS token_balance NUMERIC(18,4) NOT NULL DEFAULT 0;

-- Backfill from ledger for any pre-existing profile (no-op on a fresh DB).
UPDATE agent_profiles p
   SET token_balance = COALESCE(l.balance_after, 0)
  FROM (
    SELECT DISTINCT ON (agent_id) agent_id, balance_after
      FROM agent_token_ledger
     ORDER BY agent_id, created_at DESC, id DESC
  ) l
 WHERE l.agent_id = p.id
   AND p.token_balance = 0;

-- Defensive non-negative constraint (debits go through buildStructure() which
-- already validates funds; this is the DB-level backstop).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_profiles_token_balance_nonneg'
  ) THEN
    ALTER TABLE agent_profiles
      ADD CONSTRAINT agent_profiles_token_balance_nonneg
      CHECK (token_balance >= 0);
  END IF;
END $$;

-- ─── 2. agent_parcels — one-per-agent land plot ────────────────────────────
CREATE TABLE IF NOT EXISTS agent_parcels (
  id                TEXT        PRIMARY KEY,
  agent_id          TEXT        NOT NULL UNIQUE,
  zone              TEXT        NOT NULL DEFAULT 'residential',
  grid_x            INTEGER     NOT NULL,
  grid_z            INTEGER     NOT NULL,
  parcel_size       TEXT        NOT NULL DEFAULT 'small',
  current_location  TEXT        NOT NULL DEFAULT 'parcel',
  last_city_visit   TIMESTAMPTZ,
  total_city_visits BIGINT      NOT NULL DEFAULT 0,
  land_value        NUMERIC(18,4) NOT NULL DEFAULT 0,
  token_invested    NUMERIC(18,4) NOT NULL DEFAULT 0,
  structures        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  decorations       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  upgrades          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  acquired_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_parcels_zone_chk
    CHECK (zone IN ('residential','commercial','industrial','civic','wild')),
  CONSTRAINT agent_parcels_size_chk
    CHECK (parcel_size IN ('small','medium','large','district')),
  CONSTRAINT agent_parcels_invested_nonneg
    CHECK (token_invested >= 0),
  CONSTRAINT agent_parcels_value_nonneg
    CHECK (land_value >= 0)
);

CREATE INDEX IF NOT EXISTS idx_agent_parcels_agent
  ON agent_parcels(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_parcels_grid
  ON agent_parcels(grid_x, grid_z);
CREATE INDEX IF NOT EXISTS idx_agent_parcels_zone
  ON agent_parcels(zone);

-- Defensive ADD COLUMN IF NOT EXISTS so that environments which applied an
-- earlier draft of this migration without the read-side columns get patched.
ALTER TABLE agent_parcels ADD COLUMN IF NOT EXISTS last_city_visit   TIMESTAMPTZ;
ALTER TABLE agent_parcels ADD COLUMN IF NOT EXISTS total_city_visits BIGINT      NOT NULL DEFAULT 0;
ALTER TABLE agent_parcels ADD COLUMN IF NOT EXISTS decorations       JSONB       NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE agent_parcels ADD COLUMN IF NOT EXISTS upgrades          JSONB       NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE agent_parcels ADD COLUMN IF NOT EXISTS metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE agent_parcels ADD COLUMN IF NOT EXISTS acquired_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- updated_at trigger to mirror the rest of the schema convention.
CREATE OR REPLACE FUNCTION agent_parcels_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_parcels_updated_at ON agent_parcels;
CREATE TRIGGER agent_parcels_updated_at
  BEFORE UPDATE ON agent_parcels
  FOR EACH ROW EXECUTE FUNCTION agent_parcels_set_updated_at();

-- ─── 3. agent_movements — audit of agent location changes ──────────────────
CREATE TABLE IF NOT EXISTS agent_movements (
  id              TEXT        PRIMARY KEY,
  agent_id        TEXT        NOT NULL,
  from_location   TEXT,
  to_location     TEXT        NOT NULL,
  reason          TEXT        NOT NULL,
  departed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  arrived_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_movements_agent
  ON agent_movements(agent_id, arrived_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_movements_to
  ON agent_movements(to_location, arrived_at DESC);

-- ─── 4. agent_crews + agent_crew_members ───────────────────────────────────
-- Read by the CityScene crew-headquarters projection. Empty table is fine for
-- Phase 1; CityScene LEFT JOIN tolerates no rows. The tables must exist or the
-- read query fails with "relation does not exist".
CREATE TABLE IF NOT EXISTS agent_crews (
  id              TEXT        PRIMARY KEY,
  org_id          TEXT        NOT NULL,
  name            TEXT        NOT NULL,
  crew_type       TEXT        NOT NULL DEFAULT 'general',
  status          TEXT        NOT NULL DEFAULT 'active',
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_crews_status_chk
    CHECK (status IN ('active','suspended','disbanded'))
);

CREATE INDEX IF NOT EXISTS idx_agent_crews_org_status
  ON agent_crews(org_id, status);

CREATE TABLE IF NOT EXISTS agent_crew_members (
  crew_id         TEXT        NOT NULL REFERENCES agent_crews(id) ON DELETE CASCADE,
  agent_id        TEXT        NOT NULL,
  role            TEXT        NOT NULL DEFAULT 'member',
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (crew_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_crew_members_agent
  ON agent_crew_members(agent_id);

COMMIT;
