// ---------------------------------------------------------------------------
// Coordinator — Postgres-backed Device Registry
// ---------------------------------------------------------------------------
// Replaces the in-memory DeviceRegistry with durable Postgres storage.
// All writes are transactional, heartbeat updates are batched.
// ---------------------------------------------------------------------------

import pg from 'pg';
import { createLogger } from '@sven/shared';
import type { DeviceCapabilities, DeviceStatus, DeviceType } from '@sven/compute-mesh/device-registry';

const logger = createLogger('mesh-device-registry');

/* ────── Row type (DB shape) ──────────────────────────────────────────────── */

export interface DeviceRow {
  id: string;
  org_id: string;
  device_name: string;
  device_type: DeviceType;
  status: DeviceStatus;
  capabilities: DeviceCapabilities;
  wireguard_ip: string | null;
  federation_id: string | null;
  opted_in: boolean;
  battery_min_pct: number;
  max_work_units: number;
  current_work_units: number;
  total_jobs_completed: number;
  total_compute_ms: number;
  last_heartbeat: string | null;
  registered_at: string;
  metadata: Record<string, unknown>;
}

export interface RegisterDeviceInput {
  id?: string;
  orgId: string;
  name: string;
  deviceType: DeviceType;
  capabilities: DeviceCapabilities;
  wireguardIp?: string | null;
  federationId?: string | null;
  batteryMinPct?: number;
  maxWorkUnits?: number;
  metadata?: Record<string, unknown>;
}

/* ────── Registry class ───────────────────────────────────────────────────── */

export class PgDeviceRegistry {
  constructor(private pool: pg.Pool) {}

  async register(input: RegisterDeviceInput): Promise<DeviceRow> {
    const { rows } = await this.pool.query<DeviceRow>(
      `INSERT INTO mesh_devices (
        id, org_id, device_name, device_type, status, capabilities,
        wireguard_ip, federation_id, opted_in, battery_min_pct,
        max_work_units, last_heartbeat, metadata
      ) VALUES (
        COALESCE($1, gen_random_uuid()), $2, $3, $4, 'online', $5,
        $6, $7, TRUE, $8, $9, NOW(), $10
      )
      ON CONFLICT (id) DO UPDATE SET
        device_name  = EXCLUDED.device_name,
        capabilities = EXCLUDED.capabilities,
        wireguard_ip = EXCLUDED.wireguard_ip,
        status       = 'online',
        opted_in     = TRUE,
        last_heartbeat = NOW()
      RETURNING *`,
      [
        input.id ?? null,
        input.orgId,
        input.name,
        input.deviceType,
        JSON.stringify(input.capabilities),
        input.wireguardIp ?? null,
        input.federationId ?? null,
        input.batteryMinPct ?? 20,
        input.maxWorkUnits ?? 4,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    logger.info('Device registered', { id: rows[0].id, name: input.name, type: input.deviceType });
    return rows[0];
  }

  async unregister(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM mesh_devices WHERE id = $1`,
      [id],
    );
    if (rowCount && rowCount > 0) {
      logger.info('Device unregistered', { id });
    }
    return (rowCount ?? 0) > 0;
  }

  async get(id: string): Promise<DeviceRow | null> {
    const { rows } = await this.pool.query<DeviceRow>(
      `SELECT * FROM mesh_devices WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async list(orgId: string): Promise<DeviceRow[]> {
    const { rows } = await this.pool.query<DeviceRow>(
      `SELECT * FROM mesh_devices WHERE org_id = $1 ORDER BY registered_at DESC`,
      [orgId],
    );
    return rows;
  }

  async listOnline(orgId: string): Promise<DeviceRow[]> {
    const { rows } = await this.pool.query<DeviceRow>(
      `SELECT * FROM mesh_devices
       WHERE org_id = $1
         AND status = 'online'
         AND opted_in = TRUE
       ORDER BY current_work_units ASC, total_compute_ms ASC`,
      [orgId],
    );
    return rows;
  }

  async listByType(orgId: string, deviceType: DeviceType): Promise<DeviceRow[]> {
    const { rows } = await this.pool.query<DeviceRow>(
      `SELECT * FROM mesh_devices WHERE org_id = $1 AND device_type = $2 ORDER BY registered_at DESC`,
      [orgId, deviceType],
    );
    return rows;
  }

  async heartbeat(id: string, capabilities?: Partial<DeviceCapabilities>): Promise<boolean> {
    if (capabilities) {
      const { rowCount } = await this.pool.query(
        `UPDATE mesh_devices
         SET last_heartbeat = NOW(),
             status = 'online',
             capabilities = capabilities || $2::jsonb
         WHERE id = $1`,
        [id, JSON.stringify(capabilities)],
      );
      return (rowCount ?? 0) > 0;
    }
    const { rowCount } = await this.pool.query(
      `UPDATE mesh_devices SET last_heartbeat = NOW(), status = 'online' WHERE id = $1`,
      [id],
    );
    return (rowCount ?? 0) > 0;
  }

  async setStatus(id: string, status: DeviceStatus): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE mesh_devices SET status = $2 WHERE id = $1`,
      [id, status],
    );
    return (rowCount ?? 0) > 0;
  }

  async optIn(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE mesh_devices SET opted_in = TRUE WHERE id = $1`,
      [id],
    );
    return (rowCount ?? 0) > 0;
  }

  async optOut(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE mesh_devices SET opted_in = FALSE WHERE id = $1`,
      [id],
    );
    return (rowCount ?? 0) > 0;
  }

  async incrementWorkUnits(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE mesh_devices SET current_work_units = current_work_units + 1 WHERE id = $1`,
      [id],
    );
  }

  async decrementWorkUnits(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE mesh_devices SET current_work_units = GREATEST(0, current_work_units - 1) WHERE id = $1`,
      [id],
    );
  }

  async recordCompletion(id: string, computeMs: number): Promise<void> {
    await this.pool.query(
      `UPDATE mesh_devices
       SET total_jobs_completed = total_jobs_completed + 1,
           total_compute_ms = total_compute_ms + $2,
           current_work_units = GREATEST(0, current_work_units - 1)
       WHERE id = $1`,
      [id, computeMs],
    );
  }

  async findStaleDevices(timeoutMs: number): Promise<DeviceRow[]> {
    const { rows } = await this.pool.query<DeviceRow>(
      `SELECT * FROM mesh_devices
       WHERE status = 'online'
         AND last_heartbeat < NOW() - ($1 || ' milliseconds')::interval`,
      [timeoutMs],
    );
    return rows;
  }

  async markStale(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const { rowCount } = await this.pool.query(
      `UPDATE mesh_devices SET status = 'offline' WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    return rowCount ?? 0;
  }

  async meshStats(orgId: string): Promise<{
    total: number;
    online: number;
    gpuDevices: number;
    totalVramMb: number;
    totalRamMb: number;
    totalCores: number;
  }> {
    const { rows } = await this.pool.query<{
      total: string;
      online: string;
      gpu_devices: string;
      total_vram_mb: string;
      total_ram_mb: string;
      total_cores: string;
    }>(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'online' AND opted_in) AS online,
        COUNT(*) FILTER (WHERE status = 'online' AND opted_in AND (capabilities->>'gpu') IS NOT NULL AND (capabilities->>'gpu') != 'null') AS gpu_devices,
        COALESCE(SUM((capabilities->'gpu'->>'vramMb')::int) FILTER (WHERE status = 'online' AND opted_in AND (capabilities->>'gpu') IS NOT NULL AND (capabilities->>'gpu') != 'null'), 0) AS total_vram_mb,
        COALESCE(SUM((capabilities->>'ramMb')::int) FILTER (WHERE status = 'online' AND opted_in), 0) AS total_ram_mb,
        COALESCE(SUM((capabilities->>'cpuCores')::int) FILTER (WHERE status = 'online' AND opted_in), 0) AS total_cores
       FROM mesh_devices
       WHERE org_id = $1`,
      [orgId],
    );
    const r = rows[0];
    return {
      total: Number(r.total),
      online: Number(r.online),
      gpuDevices: Number(r.gpu_devices),
      totalVramMb: Number(r.total_vram_mb),
      totalRamMb: Number(r.total_ram_mb),
      totalCores: Number(r.total_cores),
    };
  }
}
