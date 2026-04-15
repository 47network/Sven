import { DeviceRegistry } from '@sven/compute-mesh/device-registry';
import {
  scheduleUnit,
  scheduleBatch,
  scoreDevice,
  DEFAULT_POLICY,
  createWorkUnit,
  type WorkUnit,
  type SchedulingPolicy,
} from '@sven/compute-mesh/scheduler';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const registry = new DeviceRegistry();
  const policy = (input.policy as SchedulingPolicy) ?? DEFAULT_POLICY;

  switch (action) {
    case 'schedule': {
      const unitInput = input.unit as Record<string, unknown> | undefined;
      if (!unitInput) return { error: 'unit object is required' };
      const unit = createWorkUnit(
        (unitInput.jobId as string) ?? 'adhoc',
        (unitInput.index as number) ?? 0,
        (unitInput.payload as Record<string, unknown>) ?? {},
        unitInput.resourceReqs as Record<string, unknown> | undefined,
        (unitInput.priority as number) ?? 5,
      );
      const decision = scheduleUnit(registry, unit, policy);
      return decision
        ? { result: decision }
        : { error: 'No eligible device found for this work unit' };
    }

    case 'schedule_batch': {
      const unitsInput = (input.units as Record<string, unknown>[]) ?? [];
      const units: WorkUnit[] = unitsInput.map((u, i) =>
        createWorkUnit(
          (u.jobId as string) ?? 'batch',
          i,
          (u.payload as Record<string, unknown>) ?? {},
          u.resourceReqs as Record<string, unknown> | undefined,
          (u.priority as number) ?? 5,
        ),
      );
      const decisions = scheduleBatch(registry, units, policy);
      return { result: { scheduled: decisions.length, total: units.length, decisions } };
    }

    case 'score_device': {
      const deviceId = input.device_id as string;
      if (!deviceId) return { error: 'device_id is required' };
      const device = registry.get(deviceId);
      if (!device) return { error: `Device "${deviceId}" not found` };
      const unit = createWorkUnit('score-test', 0, {});
      const score = scoreDevice(device, unit, policy);
      return { result: { deviceId, score } };
    }

    default:
      return { error: `Unknown action "${action}". Use: schedule, schedule_batch, score_device` };
  }
}
