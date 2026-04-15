// ---------------------------------------------------------------------------
// Compute Mesh Coordinator — Service Entry Point
// ---------------------------------------------------------------------------
// Fastify HTTP server (internal API) + NATS worker communication + Postgres
// persistence. Orchestrates device registry, job lifecycle, scheduling,
// heartbeat monitoring, and encrypted work unit distribution.
// ---------------------------------------------------------------------------

import Fastify from 'fastify';
import pg from 'pg';
import { connect, NatsConnection, JSONCodec } from 'nats';
import { createLogger, buildHealthStatus, ensureStreams, NATS_SUBJECTS } from '@sven/shared';
import { PgDeviceRegistry } from './coordinator/device-registry.js';
import { PgJobManager } from './coordinator/job-manager.js';
import { MeshScheduler } from './coordinator/scheduler.js';
import { HeartbeatMonitor } from './coordinator/heartbeat-monitor.js';
import { registerNatsHandlers } from './nats/handlers.js';
import { rotateKeys } from './protocol/encryption.js';

const logger = createLogger('compute-mesh');
const jc = JSONCodec();

const PORT = Number(process.env.MESH_PORT || 9470);
const HOST = process.env.MESH_HOST || '0.0.0.0';
const HEARTBEAT_INTERVAL = Number(process.env.MESH_HEARTBEAT_INTERVAL_MS || 30_000);
const DEVICE_TIMEOUT = Number(process.env.MESH_DEVICE_TIMEOUT_MS || 90_000);
const SCHEDULE_INTERVAL = Number(process.env.MESH_SCHEDULE_INTERVAL_MS || 5_000);
const KEY_ROTATION_INTERVAL = Number(process.env.MESH_KEY_ROTATION_INTERVAL_MS || 24 * 60 * 60 * 1000);
const KEY_MAX_AGE = Number(process.env.MESH_KEY_MAX_AGE_MS || 48 * 60 * 60 * 1000);
const VERSION = '0.1.0';

async function main() {
  // ── Postgres ──────────────────────────────────────────────────────────
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven',
    max: 15,
  });
  logger.info('Connected to Postgres');

  // ── NATS ──────────────────────────────────────────────────────────────
  const nc = await connect({
    servers: process.env.NATS_URL || 'nats://localhost:4222',
    name: 'compute-mesh',
    maxReconnectAttempts: -1,
  });
  logger.info('Connected to NATS');

  await ensureStreams(nc);
  logger.info('NATS JetStream streams ensured');

  // ── Core subsystems ───────────────────────────────────────────────────
  const registry = new PgDeviceRegistry(pool);
  const jobManager = new PgJobManager(pool);
  const scheduler = new MeshScheduler(registry, jobManager);
  const heartbeatMonitor = new HeartbeatMonitor(registry, jobManager, {
    intervalMs: HEARTBEAT_INTERVAL,
    deviceTimeoutMs: DEVICE_TIMEOUT,
  });

  // ── NATS handlers (worker communication) ──────────────────────────────
  await registerNatsHandlers(nc, registry, jobManager, scheduler);

  // ── Start heartbeat monitor ───────────────────────────────────────────
  heartbeatMonitor.start();

  // ── Periodic scheduling loop ──────────────────────────────────────────
  const defaultOrgId = process.env.MESH_DEFAULT_ORG_ID || 'default';
  const scheduleTimer = setInterval(async () => {
    try {
      await scheduler.schedulePendingBatch(defaultOrgId);
    } catch (err) {
      logger.error('Scheduling loop error', { err: (err as Error).message });
    }
  }, SCHEDULE_INTERVAL);

  // ── Key rotation timer ────────────────────────────────────────────────
  const keyRotationTimer = setInterval(() => {
    const revoked = rotateKeys(KEY_MAX_AGE);
    if (revoked > 0) {
      logger.info('Encryption keys rotated', { revoked });
    }
  }, KEY_ROTATION_INTERVAL);

  // ── Fastify HTTP server ───────────────────────────────────────────────
  const app = Fastify({ logger: false });

  // Health endpoints
  app.get('/healthz', async () => {
    const checks = [
      { name: 'postgres', status: 'pass' as const },
      { name: 'nats', status: nc.isClosed() ? ('fail' as const) : ('pass' as const) },
    ];
    try {
      await pool.query('SELECT 1');
    } catch {
      checks[0] = { name: 'postgres', status: 'fail' };
    }
    return buildHealthStatus('compute-mesh', VERSION, checks);
  });

  app.get('/readyz', async () => {
    try {
      await pool.query('SELECT 1');
      if (nc.isClosed()) throw new Error('NATS disconnected');
      return { status: 'ready' };
    } catch (err) {
      return { status: 'not_ready', error: (err as Error).message };
    }
  });

  // ── Device routes ─────────────────────────────────────────────────────
  app.get('/v1/mesh/devices', async (request) => {
    const orgId = (request.query as Record<string, string>).org_id || defaultOrgId;
    const devices = await registry.list(orgId);
    return { success: true, data: devices };
  });

  app.post('/v1/mesh/devices', async (request, reply) => {
    const body = request.body as Record<string, any>;
    if (!body.name || !body.device_type || !body.org_id) {
      return reply.status(400).send({ success: false, error: 'name, device_type, and org_id required' });
    }
    const device = await registry.register({
      id: body.id,
      orgId: body.org_id,
      name: body.name,
      deviceType: body.device_type,
      capabilities: body.capabilities || {},
      wireguardIp: body.wireguard_ip,
      federationId: body.federation_id,
      batteryMinPct: body.battery_min_pct,
      maxWorkUnits: body.max_work_units,
      metadata: body.metadata,
    });
    return { success: true, data: device };
  });

  app.get('/v1/mesh/devices/:id', async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const device = await registry.get(id);
    if (!device) return reply.status(404).send({ success: false, error: 'Device not found' });
    return { success: true, data: device };
  });

  app.patch('/v1/mesh/devices/:id/status', async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const { status } = request.body as Record<string, string>;
    if (!status) return reply.status(400).send({ success: false, error: 'status required' });
    const ok = await registry.setStatus(id, status as any);
    if (!ok) return reply.status(404).send({ success: false, error: 'Device not found' });
    return { success: true };
  });

  app.post('/v1/mesh/devices/:id/opt-in', async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const ok = await registry.optIn(id);
    if (!ok) return reply.status(404).send({ success: false, error: 'Device not found' });
    return { success: true };
  });

  app.post('/v1/mesh/devices/:id/opt-out', async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const ok = await registry.optOut(id);
    if (!ok) return reply.status(404).send({ success: false, error: 'Device not found' });
    return { success: true };
  });

  app.delete('/v1/mesh/devices/:id', async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const ok = await registry.unregister(id);
    if (!ok) return reply.status(404).send({ success: false, error: 'Device not found' });
    return { success: true };
  });

  // ── Job routes ────────────────────────────────────────────────────────
  app.post('/v1/mesh/jobs', async (request, reply) => {
    const body = request.body as Record<string, any>;
    if (!body.name || !body.payloads || !Array.isArray(body.payloads)) {
      return reply.status(400).send({ success: false, error: 'name and payloads[] required' });
    }
    if (body.payloads.length > 1000) {
      return reply.status(400).send({ success: false, error: 'Maximum 1000 work units per job' });
    }
    const { job, units } = await jobManager.createJob({
      orgId: body.org_id || defaultOrgId,
      createdBy: body.created_by || 'api',
      name: body.name,
      description: body.description,
      strategy: body.strategy || 'map_reduce',
      priority: body.priority,
      sensitivity: body.sensitivity,
      federationAllowed: body.federation_allowed,
      payloads: body.payloads,
      resourceReqs: body.resource_reqs,
      deadline: body.deadline,
    });
    return { success: true, data: { job, unitCount: units.length } };
  });

  app.get('/v1/mesh/jobs', async (request) => {
    const q = request.query as Record<string, string>;
    const orgId = q.org_id || defaultOrgId;
    const limit = Math.min(Number(q.limit || 50), 200);
    const jobs = await jobManager.listJobs(orgId, limit);
    return { success: true, data: jobs };
  });

  app.get('/v1/mesh/jobs/:id', async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const job = await jobManager.getJob(id);
    if (!job) return reply.status(404).send({ success: false, error: 'Job not found' });
    return { success: true, data: job };
  });

  app.get('/v1/mesh/jobs/:id/progress', async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const progress = await jobManager.getProgress(id);
    if (!progress) return reply.status(404).send({ success: false, error: 'Job not found' });
    return { success: true, data: progress };
  });

  app.get('/v1/mesh/jobs/:id/units', async (request) => {
    const { id } = request.params as Record<string, string>;
    const units = await jobManager.getUnits(id);
    return { success: true, data: units };
  });

  app.post('/v1/mesh/jobs/:id/cancel', async (request, reply) => {
    const { id } = request.params as Record<string, string>;
    const ok = await jobManager.cancelJob(id);
    if (!ok) return reply.status(404).send({ success: false, error: 'Job not found or already resolved' });
    return { success: true };
  });

  // ── Stats ─────────────────────────────────────────────────────────────
  app.get('/v1/mesh/stats', async (request) => {
    const orgId = (request.query as Record<string, string>).org_id || defaultOrgId;
    const stats = await registry.meshStats(orgId);
    return { success: true, data: stats };
  });

  // ── Scheduling trigger (manual) ───────────────────────────────────────
  app.post('/v1/mesh/schedule', async (request) => {
    const q = request.query as Record<string, string>;
    const orgId = q.org_id || defaultOrgId;
    const limit = Math.min(Number(q.limit || 50), 200);
    const results = await scheduler.schedulePendingBatch(orgId, limit);
    return { success: true, data: { scheduled: results.length, decisions: results } };
  });

  // ── Start server ──────────────────────────────────────────────────────
  await app.listen({ port: PORT, host: HOST });
  logger.info(`Compute Mesh coordinator listening on ${HOST}:${PORT}`);

  // ── Graceful shutdown ─────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info('Shutting down compute mesh coordinator', { signal });
    heartbeatMonitor.stop();
    clearInterval(scheduleTimer);
    clearInterval(keyRotationTimer);
    await app.close();
    await nc.drain();
    await pool.end();
    logger.info('Compute mesh coordinator stopped');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal('Failed to start compute mesh coordinator', { err: String(err) });
  process.exit(1);
});
