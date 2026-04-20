import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { requireRole } from './auth.js';

import {
  DeviceRegistry,
  type MeshDevice, type DeviceStatus,
} from '@sven/compute-mesh/device-registry';
import {
  scheduleUnit, scheduleBatch, createWorkUnit,
  scoreDevice, DEFAULT_POLICY,
  type WorkUnit, type SchedulingPolicy,
} from '@sven/compute-mesh/scheduler';
import {
  JobManager,
  type MeshJob, type JobStatus,
} from '@sven/compute-mesh/job-manager';
import {
  planSingleDeviceInference, planMultiDeviceInference,
  estimateInferenceTime, generateInferencePlan,
  type LayerByLayerConfig, type DistributedInferenceConfig,
} from '@sven/compute-mesh/layer-inference';

const logger = createLogger('gateway-compute-mesh');

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

async function requireTenantMembership(pool: pg.Pool, request: any, reply: any): Promise<string | null> {
  const orgId = String(request.orgId || '').trim();
  const userId = String(request.userId || '').trim();
  if (!orgId) {
    reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    return null;
  }
  const membership = await pool.query(
    `SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
    [orgId, userId],
  );
  if (membership.rows.length === 0) {
    reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Active organization membership required' } });
    return null;
  }
  return orgId;
}

export async function registerComputeMeshRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  const deviceRegistry = new DeviceRegistry();
  const jobManager = new JobManager();

  // ── Device Registry ─────────────────────────────────────────────────
  app.get('/v1/compute/devices', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const devices = deviceRegistry.list();
      return { success: true, data: devices };
    } catch (err) {
      logger.error('compute/devices error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list devices' } });
    }
  });

  app.post('/v1/compute/devices', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    if (!body.name || !body.type) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name and type required' } });
    }
    try {
      const now = new Date().toISOString();
      const device: MeshDevice = {
        id: uuidv7(),
        name: body.name,
        deviceType: body.type || 'vm',
        status: 'online',
        capabilities: body.capabilities || {},
        wireguardIp: body.wireguard_ip || null,
        federationInstanceId: null,
        optedIn: body.opted_in !== false,
        batteryMinPct: body.battery_min_pct || 0,
        currentWorkUnits: 0,
        totalJobsCompleted: 0,
        totalComputeMs: 0,
        lastHeartbeat: now,
        registeredAt: now,
        metadata: body.metadata || {},
      };
      deviceRegistry.register(device);
      try {
        await pool.query(
          `INSERT INTO compute_devices (id, org_id, name, type, status, capabilities, registered_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [device.id, orgId, device.name, device.deviceType, device.status, JSON.stringify(device.capabilities || {})],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      return { success: true, data: device };
    } catch (err) {
      logger.error('compute/devices/register error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Device registration failed' } });
    }
  });

  app.get('/v1/compute/devices/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { id } = request.params as Record<string, string>;
    try {
      const device = deviceRegistry.get(id);
      if (!device) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Device "${id}" not found` } });
      }
      return { success: true, data: device };
    } catch (err) {
      logger.error('compute/devices/:id error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to get device' } });
    }
  });

  app.patch('/v1/compute/devices/:id/status', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { id } = request.params as Record<string, string>;
    const { status } = request.body as Record<string, any>;
    if (!status) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'status required' } });
    }
    try {
      const device = deviceRegistry.get(id);
      if (!device) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Device "${id}" not found` } });
      }
      device.status = status as DeviceStatus;
      try {
        await pool.query(
          `UPDATE compute_devices SET status = $1 WHERE id = $2 AND org_id = $3`,
          [status, id, orgId],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      return { success: true, data: device };
    } catch (err) {
      logger.error('compute/devices/:id/status error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Status update failed' } });
    }
  });

  // ── Scheduling ──────────────────────────────────────────────────────
  app.post('/v1/compute/schedule', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { work_unit, policy } = request.body as Record<string, any>;
    if (!work_unit) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'work_unit required' } });
    }
    try {
      const decision = scheduleUnit(deviceRegistry, work_unit as WorkUnit, policy || DEFAULT_POLICY);
      if (!decision) {
        return reply.status(409).send({ success: false, error: { code: 'NO_DEVICE', message: 'No suitable device available for scheduling' } });
      }
      return { success: true, data: decision };
    } catch (err) {
      logger.error('compute/schedule error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Scheduling failed' } });
    }
  });

  app.post('/v1/compute/schedule/batch', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { work_units, policy } = request.body as Record<string, any>;
    if (!Array.isArray(work_units) || work_units.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'work_units array required' } });
    }
    if (work_units.length > 100) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'Maximum 100 work units per batch' } });
    }
    try {
      const decisions = scheduleBatch(deviceRegistry, work_units as WorkUnit[], policy || DEFAULT_POLICY);
      return { success: true, data: decisions };
    } catch (err) {
      logger.error('compute/schedule/batch error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Batch scheduling failed' } });
    }
  });

  // ── Jobs ────────────────────────────────────────────────────────────
  app.post('/v1/compute/jobs', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    if (!body.name) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name required' } });
    }
    try {
      const job = jobManager.createJob(
        body.name,
        body.description || '',
        {
          strategy: body.strategy || 'map_reduce',
          payloads: body.payloads || [{}],
          priority: body.priority,
        },
      );
      try {
        await pool.query(
          `INSERT INTO compute_jobs (id, org_id, user_id, name, status, priority, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [job.id, orgId, request.userId, job.name, job.status, job.priority],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      return { success: true, data: job };
    } catch (err) {
      logger.error('compute/jobs error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Job creation failed' } });
    }
  });

  app.get('/v1/compute/jobs', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const { rows } = await pool.query(
        `SELECT id, name, status, priority, created_at FROM compute_jobs WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [orgId],
      );
      return { success: true, data: rows };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({ success: false, error: { code: 'FEATURE_UNAVAILABLE', message: 'Compute jobs schema not available' } });
      }
      throw err;
    }
  });

  app.get('/v1/compute/jobs/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { id } = request.params as Record<string, string>;
    try {
      const job = jobManager.get(id);
      if (!job) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Job "${id}" not found` } });
      }
      return { success: true, data: job };
    } catch (err) {
      logger.error('compute/jobs/:id error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to get job' } });
    }
  });

  // ── Inference Planning ──────────────────────────────────────────────
  app.post('/v1/compute/inference/plan', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { config, available_vram_mb } = request.body as Record<string, any>;
    if (!config) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'config object required' } });
    }
    try {
      const steps = planSingleDeviceInference(config as LayerByLayerConfig, available_vram_mb || 8192);
      return { success: true, data: { steps, count: steps.length } };
    } catch (err) {
      logger.error('compute/inference/plan error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Inference planning failed' } });
    }
  });

  app.post('/v1/compute/inference/distribute', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { config, devices } = request.body as Record<string, any>;
    if (!config || !Array.isArray(devices) || devices.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'config object and devices array required' } });
    }
    try {
      const distributed = planMultiDeviceInference(config as LayerByLayerConfig, devices);
      const markdown = generateInferencePlan(distributed);
      return { success: true, data: { plan: distributed, markdown } };
    } catch (err) {
      logger.error('compute/inference/distribute error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Distributed inference planning failed' } });
    }
  });

  app.post('/v1/compute/inference/estimate', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { distributed_config, layer_config } = request.body as Record<string, any>;
    if (!distributed_config || !layer_config) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'distributed_config and layer_config required' } });
    }
    try {
      const estimate = estimateInferenceTime(distributed_config as DistributedInferenceConfig, layer_config as LayerByLayerConfig);
      return { success: true, data: estimate };
    } catch (err) {
      logger.error('compute/inference/estimate error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Inference time estimation failed' } });
    }
  });

  logger.info('Compute Mesh routes registered (/v1/compute/*)');
}
