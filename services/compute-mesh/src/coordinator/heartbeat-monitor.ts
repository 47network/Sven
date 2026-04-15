// ---------------------------------------------------------------------------
// Coordinator — Heartbeat Monitor
// ---------------------------------------------------------------------------
// Runs on a configurable interval. Detects stale devices (heartbeat timeout),
// marks them offline, and reassigns their in-flight work units to other
// devices via the job manager.
// ---------------------------------------------------------------------------

import { createLogger } from '@sven/shared';
import { PgDeviceRegistry } from './device-registry.js';
import { PgJobManager } from './job-manager.js';

const logger = createLogger('mesh-heartbeat-monitor');

export interface HeartbeatMonitorConfig {
  /** How often to run the sweep (ms). Default: 30 000 (30s). */
  intervalMs: number;
  /** How long before a device is considered stale (ms). Default: 90 000 (90s). */
  deviceTimeoutMs: number;
  /** How long before an assigned unit on an offline device is reassigned (ms). Default: 120 000 (2m). */
  unitOrphanTimeoutMs: number;
}

const DEFAULT_CONFIG: HeartbeatMonitorConfig = {
  intervalMs: 30_000,
  deviceTimeoutMs: 90_000,
  unitOrphanTimeoutMs: 120_000,
};

export class HeartbeatMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private config: HeartbeatMonitorConfig;
  private running = false;

  constructor(
    private registry: PgDeviceRegistry,
    private jobManager: PgJobManager,
    config?: Partial<HeartbeatMonitorConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (this.timer) return;
    logger.info('Heartbeat monitor started', {
      intervalMs: this.config.intervalMs,
      deviceTimeoutMs: this.config.deviceTimeoutMs,
    });
    this.timer = setInterval(() => void this.sweep(), this.config.intervalMs);
    // Run immediately on start
    void this.sweep();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Heartbeat monitor stopped');
    }
  }

  async sweep(): Promise<{ staleDevices: number; reassignedUnits: number }> {
    if (this.running) return { staleDevices: 0, reassignedUnits: 0 };
    this.running = true;
    try {
      // 1. Find and mark stale devices
      const stale = await this.registry.findStaleDevices(this.config.deviceTimeoutMs);
      let staleCount = 0;
      if (stale.length > 0) {
        const ids = stale.map((d) => d.id);
        staleCount = await this.registry.markStale(ids);
        logger.warn('Marked devices as offline', {
          count: staleCount,
          devices: stale.map((d) => ({ id: d.id, name: d.device_name, lastHb: d.last_heartbeat })),
        });
      }

      // 2. Reassign orphaned work units
      const reassigned = await this.jobManager.reassignOrphanedUnits(this.config.unitOrphanTimeoutMs);

      return { staleDevices: staleCount, reassignedUnits: reassigned };
    } catch (err) {
      logger.error('Heartbeat sweep error', { err: (err as Error).message });
      return { staleDevices: 0, reassignedUnits: 0 };
    } finally {
      this.running = false;
    }
  }
}
