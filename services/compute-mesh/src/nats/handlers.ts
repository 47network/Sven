// ---------------------------------------------------------------------------
// NATS Handlers — Worker communication
// ---------------------------------------------------------------------------
// Subscribes to mesh.device.* and mesh.unit.* subjects. Processes heartbeats,
// device registration, unit results, and unit errors from workers.
// ---------------------------------------------------------------------------

import { NatsConnection, JSONCodec } from 'nats';
import { createLogger, NATS_SUBJECTS } from '@sven/shared';
import { PgDeviceRegistry } from '../coordinator/device-registry.js';
import { PgJobManager } from '../coordinator/job-manager.js';
import { MeshScheduler } from '../coordinator/scheduler.js';
import { verifyHash } from '../protocol/verification.js';
import type {
  HeartbeatMessage,
  DeviceRegisterMessage,
  DeviceDeregisterMessage,
  UnitResultMessage,
  UnitErrorMessage,
} from '../protocol/messages.js';

const logger = createLogger('mesh-nats-handlers');
const jc = JSONCodec();

export async function registerNatsHandlers(
  nc: NatsConnection,
  registry: PgDeviceRegistry,
  jobManager: PgJobManager,
  scheduler: MeshScheduler,
): Promise<void> {

  // ── Device Registration ──────────────────────────────────────────────
  const regSub = nc.subscribe(NATS_SUBJECTS.MESH_DEVICE_REGISTER);
  (async () => {
    for await (const msg of regSub) {
      try {
        const data = jc.decode(msg.data) as DeviceRegisterMessage;
        const device = await registry.register({
          id: data.deviceId,
          orgId: data.orgId,
          name: data.name,
          deviceType: data.deviceType,
          capabilities: data.capabilities,
          wireguardIp: data.wireguardIp,
          batteryMinPct: data.batteryMinPct,
          maxWorkUnits: data.maxWorkUnits,
        });
        if (msg.reply) {
          msg.respond(jc.encode({ success: true, deviceId: device.id }));
        }
        logger.info('Device registered via NATS', { deviceId: device.id, name: data.name });
      } catch (err) {
        logger.error('Device registration error', { err: (err as Error).message });
        if (msg.reply) {
          msg.respond(jc.encode({ success: false, error: (err as Error).message }));
        }
      }
    }
  })();

  // ── Heartbeat ────────────────────────────────────────────────────────
  const hbSub = nc.subscribe(NATS_SUBJECTS.MESH_DEVICE_HEARTBEAT);
  (async () => {
    for await (const msg of hbSub) {
      try {
        const data = jc.decode(msg.data) as HeartbeatMessage;
        await registry.heartbeat(data.deviceId, data.capabilities);
      } catch (err) {
        logger.error('Heartbeat processing error', { err: (err as Error).message });
      }
    }
  })();

  // ── Device Deregistration ────────────────────────────────────────────
  const deregSub = nc.subscribe(NATS_SUBJECTS.MESH_DEVICE_DEREGISTER);
  (async () => {
    for await (const msg of deregSub) {
      try {
        const data = jc.decode(msg.data) as DeviceDeregisterMessage;
        await registry.setStatus(data.deviceId, 'offline');
        logger.info('Device deregistered via NATS', { deviceId: data.deviceId, reason: data.reason });
        if (msg.reply) {
          msg.respond(jc.encode({ success: true }));
        }
      } catch (err) {
        logger.error('Device deregistration error', { err: (err as Error).message });
      }
    }
  })();

  // ── Unit Results ─────────────────────────────────────────────────────
  // Workers publish results to mesh.unit.result.{jobId}
  const resultSub = nc.subscribe('mesh.unit.result.*');
  (async () => {
    for await (const msg of resultSub) {
      try {
        const data = jc.decode(msg.data) as UnitResultMessage;

        // Verify result integrity
        const resultBuf = Buffer.from(data.encryptedResult, 'base64');
        if (!verifyHash(resultBuf, data.resultHash)) {
          logger.error('Result integrity check failed — rejecting', {
            unitId: data.unitId,
            deviceId: data.deviceId,
          });
          await jobManager.failUnit(data.unitId, 'Result integrity verification failed');
          continue;
        }

        const { unit, jobCompleted } = await jobManager.completeUnit(
          data.unitId,
          resultBuf,
          data.resultHash,
          data.computeMs,
        );

        await registry.recordCompletion(data.deviceId, data.computeMs);

        // Publish job status update
        nc.publish(
          NATS_SUBJECTS.meshJobStatus(data.jobId),
          jc.encode({
            jobId: data.jobId,
            unitId: data.unitId,
            status: jobCompleted ? 'completed' : 'running',
            event: 'unit_completed',
          }),
        );

        logger.info('Unit result accepted', { unitId: data.unitId, jobId: data.jobId, jobCompleted });
      } catch (err) {
        logger.error('Unit result processing error', { err: (err as Error).message });
      }
    }
  })();

  // ── Unit Errors ──────────────────────────────────────────────────────
  // Workers publish errors to mesh.unit.error.{unitId}
  const errorSub = nc.subscribe('mesh.unit.error.*');
  (async () => {
    for await (const msg of errorSub) {
      try {
        const data = jc.decode(msg.data) as UnitErrorMessage;
        const { unit, willRetry } = await jobManager.failUnit(data.unitId, data.error);

        await registry.decrementWorkUnits(data.deviceId);

        logger.warn('Unit error received', {
          unitId: data.unitId,
          jobId: data.jobId,
          deviceId: data.deviceId,
          willRetry,
          error: data.error,
        });

        // Publish status update
        nc.publish(
          NATS_SUBJECTS.meshJobStatus(data.jobId),
          jc.encode({
            jobId: data.jobId,
            unitId: data.unitId,
            status: willRetry ? 'retrying' : 'failed',
            event: 'unit_failed',
            willRetry,
          }),
        );
      } catch (err) {
        logger.error('Unit error processing error', { err: (err as Error).message });
      }
    }
  })();

  logger.info('NATS mesh handlers registered', {
    subjects: [
      NATS_SUBJECTS.MESH_DEVICE_REGISTER,
      NATS_SUBJECTS.MESH_DEVICE_HEARTBEAT,
      NATS_SUBJECTS.MESH_DEVICE_DEREGISTER,
      'mesh.unit.result.*',
      'mesh.unit.error.*',
    ],
  });
}
