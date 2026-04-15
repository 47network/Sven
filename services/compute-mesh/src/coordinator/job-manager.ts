// ---------------------------------------------------------------------------
// Coordinator — Postgres-backed Job Manager
// ---------------------------------------------------------------------------
// Full lifecycle: create → decompose → schedule → run → aggregate → complete.
// All state persisted to mesh_jobs + mesh_work_units tables.
// ---------------------------------------------------------------------------

import pg from 'pg';
import { createLogger } from '@sven/shared';
import type { DecompositionStrategy, ResourceRequirements } from '@sven/compute-mesh/scheduler';
import { encryptJson, generateKey, payloadToBase64, type EncryptionKey } from '../protocol/encryption.js';
import { hashJson } from '../protocol/verification.js';

const logger = createLogger('mesh-job-manager');

/* ────── Row types ────────────────────────────────────────────────────────── */

export type JobStatus = 'pending' | 'decomposing' | 'scheduling' | 'running' | 'aggregating' | 'completed' | 'failed' | 'cancelled';
export type UnitStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'retrying';

export interface JobRow {
  id: string;
  org_id: string;
  created_by: string;
  name: string;
  description: string;
  strategy: DecompositionStrategy;
  status: JobStatus;
  priority: number;
  sensitivity: string;
  federation_allowed: boolean;
  total_units: number;
  completed_units: number;
  failed_units: number;
  total_compute_ms: number;
  input_config: Record<string, unknown>;
  aggregated_result: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  deadline: string | null;
}

export interface UnitRow {
  id: string;
  job_id: string;
  unit_index: number;
  status: UnitStatus;
  assigned_device: string | null;
  priority: number;
  max_retries: number;
  retry_count: number;
  resource_reqs: Partial<ResourceRequirements>;
  encrypted_payload: Buffer | null;
  payload_iv: Buffer | null;
  payload_auth_tag: Buffer | null;
  encryption_key_id: string | null;
  result_payload: Buffer | null;
  result_hash: string | null;
  error_message: string | null;
  compute_ms: number | null;
  created_at: string;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreateJobInput {
  orgId: string;
  createdBy: string;
  name: string;
  description?: string;
  strategy: DecompositionStrategy;
  priority?: number;
  sensitivity?: 'public' | 'internal' | 'confidential';
  federationAllowed?: boolean;
  payloads: Record<string, unknown>[];
  resourceReqs?: Partial<ResourceRequirements>;
  deadline?: string | null;
}

export interface JobProgress {
  jobId: string;
  total: number;
  pending: number;
  assigned: number;
  running: number;
  completed: number;
  failed: number;
  progressPct: number;
}

/* ────── Manager class ────────────────────────────────────────────────────── */

export class PgJobManager {
  constructor(private pool: pg.Pool) {}

  async createJob(input: CreateJobInput): Promise<{ job: JobRow; units: UnitRow[] }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert job
      const { rows: jobRows } = await client.query<JobRow>(
        `INSERT INTO mesh_jobs (
          org_id, created_by, name, description, strategy,
          priority, sensitivity, federation_allowed, input_config, deadline
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          input.orgId,
          input.createdBy,
          input.name,
          input.description ?? '',
          input.strategy,
          input.priority ?? 5,
          input.sensitivity ?? 'internal',
          input.federationAllowed ?? false,
          JSON.stringify({ payloads: input.payloads, resourceReqs: input.resourceReqs }),
          input.deadline ?? null,
        ],
      );
      const job = jobRows[0];

      // Generate per-job encryption key
      const encKey = generateKey();

      // Decompose into work units
      const units: UnitRow[] = [];
      for (let i = 0; i < input.payloads.length; i++) {
        const payload = input.payloads[i];
        const encrypted = encryptJson(payload, encKey);
        const b64 = payloadToBase64(encrypted);

        const { rows: unitRows } = await client.query<UnitRow>(
          `INSERT INTO mesh_work_units (
            job_id, unit_index, priority, resource_reqs,
            encrypted_payload, payload_iv, payload_auth_tag, encryption_key_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *`,
          [
            job.id,
            i,
            input.priority ?? 5,
            JSON.stringify(input.resourceReqs ?? {}),
            Buffer.from(b64.ciphertext, 'base64'),
            Buffer.from(b64.iv, 'base64'),
            Buffer.from(b64.authTag, 'base64'),
            encKey.id,
          ],
        );
        units.push(unitRows[0]);
      }

      // Update job unit count and status
      await client.query(
        `UPDATE mesh_jobs SET total_units = $2, status = 'scheduling' WHERE id = $1`,
        [job.id, units.length],
      );
      job.total_units = units.length;
      job.status = 'scheduling';

      await client.query('COMMIT');

      logger.info('Job created', {
        jobId: job.id,
        name: input.name,
        strategy: input.strategy,
        units: units.length,
      });

      return { job, units };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getJob(jobId: string): Promise<JobRow | null> {
    const { rows } = await this.pool.query<JobRow>(
      `SELECT * FROM mesh_jobs WHERE id = $1`,
      [jobId],
    );
    return rows[0] ?? null;
  }

  async listJobs(orgId: string, limit: number = 50): Promise<JobRow[]> {
    const { rows } = await this.pool.query<JobRow>(
      `SELECT * FROM mesh_jobs WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit],
    );
    return rows;
  }

  async listJobsByStatus(orgId: string, status: JobStatus): Promise<JobRow[]> {
    const { rows } = await this.pool.query<JobRow>(
      `SELECT * FROM mesh_jobs WHERE org_id = $1 AND status = $2 ORDER BY priority DESC, created_at ASC`,
      [orgId, status],
    );
    return rows;
  }

  async getUnits(jobId: string): Promise<UnitRow[]> {
    const { rows } = await this.pool.query<UnitRow>(
      `SELECT * FROM mesh_work_units WHERE job_id = $1 ORDER BY unit_index ASC`,
      [jobId],
    );
    return rows;
  }

  async getPendingUnits(limit: number = 100): Promise<UnitRow[]> {
    const { rows } = await this.pool.query<UnitRow>(
      `SELECT * FROM mesh_work_units
       WHERE status IN ('pending', 'retrying')
       ORDER BY priority DESC, created_at ASC
       LIMIT $1`,
      [limit],
    );
    return rows;
  }

  async assignUnit(unitId: string, deviceId: string): Promise<UnitRow | null> {
    const { rows } = await this.pool.query<UnitRow>(
      `UPDATE mesh_work_units
       SET status = 'assigned', assigned_device = $2, assigned_at = NOW()
       WHERE id = $1 AND status IN ('pending', 'retrying')
       RETURNING *`,
      [unitId, deviceId],
    );
    if (rows[0]) {
      await this.pool.query(
        `UPDATE mesh_jobs SET status = 'running', started_at = COALESCE(started_at, NOW()) WHERE id = $1`,
        [rows[0].job_id],
      );
    }
    return rows[0] ?? null;
  }

  async startUnit(unitId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE mesh_work_units SET status = 'running', started_at = NOW() WHERE id = $1`,
      [unitId],
    );
    return (rowCount ?? 0) > 0;
  }

  async completeUnit(
    unitId: string,
    resultPayload: Buffer,
    resultHash: string,
    computeMs: number,
  ): Promise<{ unit: UnitRow; jobCompleted: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: unitRows } = await client.query<UnitRow>(
        `UPDATE mesh_work_units
         SET status = 'completed', result_payload = $2, result_hash = $3,
             compute_ms = $4, completed_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [unitId, resultPayload, resultHash, computeMs],
      );
      const unit = unitRows[0];
      if (!unit) {
        await client.query('ROLLBACK');
        throw new Error(`Unit ${unitId} not found`);
      }

      // Update job counters
      await client.query(
        `UPDATE mesh_jobs
         SET completed_units = completed_units + 1,
             total_compute_ms = total_compute_ms + $2
         WHERE id = $1`,
        [unit.job_id, computeMs],
      );

      // Check if job is complete
      const { rows: jobRows } = await client.query<JobRow>(
        `SELECT * FROM mesh_jobs WHERE id = $1`,
        [unit.job_id],
      );
      const job = jobRows[0];
      const allDone = job && (job.completed_units + 1 + job.failed_units) >= job.total_units;

      if (allDone) {
        const finalStatus = job.failed_units > 0 ? 'failed' : 'completed';
        await client.query(
          `UPDATE mesh_jobs SET status = $2, completed_at = NOW() WHERE id = $1`,
          [job.id, finalStatus],
        );
      }

      await client.query('COMMIT');

      logger.info('Unit completed', { unitId, jobId: unit.job_id, computeMs });
      return { unit, jobCompleted: allDone ?? false };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async failUnit(unitId: string, error: string): Promise<{ unit: UnitRow; willRetry: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check retry budget
      const { rows: currentRows } = await client.query<UnitRow>(
        `SELECT * FROM mesh_work_units WHERE id = $1`,
        [unitId],
      );
      const current = currentRows[0];
      if (!current) {
        await client.query('ROLLBACK');
        throw new Error(`Unit ${unitId} not found`);
      }

      const willRetry = current.retry_count < current.max_retries;
      const newStatus: UnitStatus = willRetry ? 'retrying' : 'failed';

      const { rows: unitRows } = await client.query<UnitRow>(
        `UPDATE mesh_work_units
         SET status = $2,
             retry_count = retry_count + 1,
             error_message = $3,
             assigned_device = NULL,
             assigned_at = NULL,
             started_at = NULL
         WHERE id = $1
         RETURNING *`,
        [unitId, newStatus, error],
      );

      if (!willRetry) {
        await client.query(
          `UPDATE mesh_jobs SET failed_units = failed_units + 1 WHERE id = $1`,
          [current.job_id],
        );

        // Check if job is now complete (all units resolved)
        const { rows: jobRows } = await client.query<JobRow>(
          `SELECT * FROM mesh_jobs WHERE id = $1`,
          [current.job_id],
        );
        const job = jobRows[0];
        if (job && (job.completed_units + job.failed_units + 1) >= job.total_units) {
          await client.query(
            `UPDATE mesh_jobs SET status = 'failed', completed_at = NOW(), error_message = $2 WHERE id = $1`,
            [job.id, `${job.failed_units + 1} unit(s) failed`],
          );
        }
      }

      await client.query('COMMIT');

      logger.warn('Unit failed', { unitId, jobId: current.job_id, willRetry, error });
      return { unit: unitRows[0], willRetry };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rowCount } = await client.query(
        `UPDATE mesh_jobs SET status = 'cancelled', completed_at = NOW()
         WHERE id = $1 AND status NOT IN ('completed', 'failed', 'cancelled')`,
        [jobId],
      );
      if ((rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query(
        `UPDATE mesh_work_units
         SET status = 'failed', error_message = 'Job cancelled'
         WHERE job_id = $1 AND status IN ('pending', 'assigned', 'retrying')`,
        [jobId],
      );

      await client.query('COMMIT');
      logger.info('Job cancelled', { jobId });
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getProgress(jobId: string): Promise<JobProgress | null> {
    const { rows } = await this.pool.query<{
      total: string;
      pending: string;
      assigned: string;
      running: string;
      completed: string;
      failed: string;
    }>(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status IN ('pending', 'retrying')) AS pending,
        COUNT(*) FILTER (WHERE status = 'assigned') AS assigned,
        COUNT(*) FILTER (WHERE status = 'running') AS running,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed
       FROM mesh_work_units
       WHERE job_id = $1`,
      [jobId],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    const total = Number(r.total);
    const completed = Number(r.completed);
    return {
      jobId,
      total,
      pending: Number(r.pending),
      assigned: Number(r.assigned),
      running: Number(r.running),
      completed,
      failed: Number(r.failed),
      progressPct: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  async findOrphanedUnits(timeoutMs: number): Promise<UnitRow[]> {
    const { rows } = await this.pool.query<UnitRow>(
      `SELECT wu.* FROM mesh_work_units wu
       JOIN mesh_devices d ON wu.assigned_device = d.id
       WHERE wu.status IN ('assigned', 'running')
         AND d.status = 'offline'
         AND wu.assigned_at < NOW() - ($1 || ' milliseconds')::interval`,
      [timeoutMs],
    );
    return rows;
  }

  async reassignOrphanedUnits(timeoutMs: number): Promise<number> {
    const orphans = await this.findOrphanedUnits(timeoutMs);
    let count = 0;
    for (const unit of orphans) {
      if (unit.retry_count < unit.max_retries) {
        await this.pool.query(
          `UPDATE mesh_work_units
           SET status = 'retrying', assigned_device = NULL, assigned_at = NULL, started_at = NULL, retry_count = retry_count + 1
           WHERE id = $1`,
          [unit.id],
        );
        count++;
      } else {
        await this.failUnit(unit.id, 'Device went offline — max retries exceeded');
      }
    }
    if (count > 0) {
      logger.warn('Reassigned orphaned units', { count, timeoutMs });
    }
    return count;
  }
}
