-- Compute Mesh — Core Tables
-- Stores devices, jobs, and work units for the distributed compute mesh.

BEGIN;

-- ── Devices ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mesh_devices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            TEXT NOT NULL,
  device_name       TEXT NOT NULL,
  device_type       TEXT NOT NULL CHECK (device_type IN ('vm', 'mobile', 'desktop', 'federated')),
  status            TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy', 'draining', 'error')),
  capabilities      JSONB NOT NULL DEFAULT '{}',
  wireguard_ip      TEXT,
  federation_id     TEXT,
  opted_in          BOOLEAN NOT NULL DEFAULT FALSE,
  battery_min_pct   INTEGER NOT NULL DEFAULT 20,
  max_work_units    INTEGER NOT NULL DEFAULT 4,
  current_work_units INTEGER NOT NULL DEFAULT 0,
  total_jobs_completed BIGINT NOT NULL DEFAULT 0,
  total_compute_ms  BIGINT NOT NULL DEFAULT 0,
  last_heartbeat    TIMESTAMPTZ,
  registered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata          JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_mesh_devices_org       ON mesh_devices (org_id);
CREATE INDEX IF NOT EXISTS idx_mesh_devices_status    ON mesh_devices (status);
CREATE INDEX IF NOT EXISTS idx_mesh_devices_type      ON mesh_devices (device_type);
CREATE INDEX IF NOT EXISTS idx_mesh_devices_heartbeat ON mesh_devices (last_heartbeat);

-- ── Jobs ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mesh_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            TEXT NOT NULL,
  created_by        TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  strategy          TEXT NOT NULL DEFAULT 'map_reduce' CHECK (strategy IN ('map_reduce', 'pipeline', 'scatter_gather', 'layer_split')),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'decomposing', 'scheduling', 'running', 'aggregating', 'completed', 'failed', 'cancelled')),
  priority          INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  sensitivity       TEXT NOT NULL DEFAULT 'internal' CHECK (sensitivity IN ('public', 'internal', 'confidential')),
  federation_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  total_units       INTEGER NOT NULL DEFAULT 0,
  completed_units   INTEGER NOT NULL DEFAULT 0,
  failed_units      INTEGER NOT NULL DEFAULT 0,
  total_compute_ms  BIGINT NOT NULL DEFAULT 0,
  input_config      JSONB NOT NULL DEFAULT '{}',
  aggregated_result JSONB,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  deadline          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mesh_jobs_org     ON mesh_jobs (org_id);
CREATE INDEX IF NOT EXISTS idx_mesh_jobs_status  ON mesh_jobs (status);
CREATE INDEX IF NOT EXISTS idx_mesh_jobs_created ON mesh_jobs (created_at DESC);

-- ── Work Units ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mesh_work_units (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID NOT NULL REFERENCES mesh_jobs(id) ON DELETE CASCADE,
  unit_index        INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'running', 'completed', 'failed', 'retrying')),
  assigned_device   UUID REFERENCES mesh_devices(id) ON DELETE SET NULL,
  priority          INTEGER NOT NULL DEFAULT 5,
  max_retries       INTEGER NOT NULL DEFAULT 3,
  retry_count       INTEGER NOT NULL DEFAULT 0,
  resource_reqs     JSONB NOT NULL DEFAULT '{}',
  encrypted_payload BYTEA,
  payload_iv        BYTEA,
  payload_auth_tag  BYTEA,
  encryption_key_id TEXT,
  result_payload    BYTEA,
  result_hash       TEXT,
  error_message     TEXT,
  compute_ms        BIGINT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at       TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mesh_units_job      ON mesh_work_units (job_id);
CREATE INDEX IF NOT EXISTS idx_mesh_units_status   ON mesh_work_units (status);
CREATE INDEX IF NOT EXISTS idx_mesh_units_device   ON mesh_work_units (assigned_device);
CREATE INDEX IF NOT EXISTS idx_mesh_units_pending  ON mesh_work_units (status, priority DESC) WHERE status IN ('pending', 'retrying');

COMMIT;
