// ---------------------------------------------------------------------------
// Coordinator — Scheduler
// ---------------------------------------------------------------------------
// Bridges the pure scoring functions from @sven/compute-mesh/scheduler
// with the Postgres-backed device registry and job manager.
// ---------------------------------------------------------------------------

import { createLogger } from '@sven/shared';
import {
  meetsRequirements, scoreDevice, DEFAULT_POLICY,
  type SchedulingPolicy, type ResourceRequirements,
} from '@sven/compute-mesh/scheduler';
import type { MeshDevice } from '@sven/compute-mesh/device-registry';
import { PgDeviceRegistry, type DeviceRow } from './device-registry.js';
import { PgJobManager, type UnitRow } from './job-manager.js';

const logger = createLogger('mesh-scheduler');

export interface ScheduleResult {
  unitId: string;
  deviceId: string;
  deviceName: string;
  score: number;
}

function rowToMeshDevice(row: DeviceRow): MeshDevice {
  return {
    id: row.id,
    name: row.device_name,
    deviceType: row.device_type,
    status: row.status,
    capabilities: row.capabilities,
    wireguardIp: row.wireguard_ip,
    federationInstanceId: row.federation_id,
    optedIn: row.opted_in,
    batteryMinPct: row.battery_min_pct,
    currentWorkUnits: row.current_work_units,
    totalJobsCompleted: Number(row.total_jobs_completed),
    totalComputeMs: Number(row.total_compute_ms),
    lastHeartbeat: row.last_heartbeat ?? '',
    registeredAt: row.registered_at,
    metadata: row.metadata,
  };
}

function unitToWorkUnit(row: UnitRow) {
  const reqs = row.resource_reqs as Partial<ResourceRequirements>;
  return {
    id: row.id,
    jobId: row.job_id,
    index: row.unit_index,
    status: row.status as any,
    payload: {},
    resourceReqs: {
      minCpuCores: reqs.minCpuCores ?? 1,
      minRamMb: reqs.minRamMb ?? 512,
      requiresGpu: reqs.requiresGpu ?? false,
      minVramMb: reqs.minVramMb ?? 0,
      minStorageGb: reqs.minStorageGb ?? 0,
      requiredRuntimes: reqs.requiredRuntimes ?? [],
    },
    assignedDeviceId: row.assigned_device,
    priority: row.priority,
    maxRetries: row.max_retries,
    retryCount: row.retry_count,
    encryptedPayload: row.encrypted_payload !== null,
    integrityHash: row.result_hash,
    createdAt: row.created_at,
    assignedAt: row.assigned_at,
    completedAt: row.completed_at,
    result: null,
    errorMessage: row.error_message,
  };
}

export class MeshScheduler {
  constructor(
    private registry: PgDeviceRegistry,
    private jobManager: PgJobManager,
    private policy: SchedulingPolicy = DEFAULT_POLICY,
  ) {}

  async scheduleUnit(unit: UnitRow, orgId: string): Promise<ScheduleResult | null> {
    const devices = await this.registry.listOnline(orgId);
    if (devices.length === 0) return null;

    const workUnit = unitToWorkUnit(unit);

    // Filter by capability
    const capable = devices.filter((d) =>
      meetsRequirements(rowToMeshDevice(d), workUnit.resourceReqs),
    );

    // Filter by capacity
    const eligible = capable.filter((d) => d.current_work_units < d.max_work_units);
    if (eligible.length === 0) return null;

    // Score and rank
    const scored = eligible
      .map((d) => {
        const meshDevice = rowToMeshDevice(d);
        return { device: d, score: scoreDevice(meshDevice, workUnit, this.policy) };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    const winner = scored[0];
    if (!winner) return null;

    // Persist assignment
    const assigned = await this.jobManager.assignUnit(unit.id, winner.device.id);
    if (!assigned) return null;

    await this.registry.incrementWorkUnits(winner.device.id);

    logger.info('Unit scheduled', {
      unitId: unit.id,
      jobId: unit.job_id,
      deviceId: winner.device.id,
      deviceName: winner.device.device_name,
      score: winner.score.toFixed(3),
    });

    return {
      unitId: unit.id,
      deviceId: winner.device.id,
      deviceName: winner.device.device_name,
      score: winner.score,
    };
  }

  async schedulePendingBatch(orgId: string, limit: number = 50): Promise<ScheduleResult[]> {
    const pending = await this.jobManager.getPendingUnits(limit);
    const results: ScheduleResult[] = [];

    for (const unit of pending) {
      const result = await this.scheduleUnit(unit, orgId);
      if (result) {
        results.push(result);
      }
    }

    if (results.length > 0) {
      logger.info('Batch scheduling complete', { scheduled: results.length, attempted: pending.length });
    }

    return results;
  }
}
