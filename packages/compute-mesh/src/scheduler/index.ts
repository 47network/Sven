// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------
// Assigns work units to mesh devices based on capability matching, load
// balancing, locality, battery/network awareness, priority, affinity,
// and fair-share policies. Supports MapReduce, Pipeline, ScatterGather,
// and LayerSplit decomposition strategies.
// ---------------------------------------------------------------------------

import {
  DeviceRegistry,
  type MeshDevice,
} from '../device-registry/index.js';

/* ------------------------------------------------------------------ types */

export type DecompositionStrategy = 'map_reduce' | 'pipeline' | 'scatter_gather' | 'layer_split';

export type WorkUnitStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'retrying';

export interface ResourceRequirements {
  minCpuCores: number;
  minRamMb: number;
  requiresGpu: boolean;
  minVramMb: number;
  minStorageGb: number;
  requiredRuntimes: string[];
}

export interface WorkUnit {
  id: string;
  jobId: string;
  index: number;
  status: WorkUnitStatus;
  payload: Record<string, unknown>;
  resourceReqs: ResourceRequirements;
  assignedDeviceId: string | null;
  priority: number;                       // 1-10, higher = more important
  maxRetries: number;
  retryCount: number;
  encryptedPayload: boolean;
  integrityHash: string | null;
  createdAt: string;
  assignedAt: string | null;
  completedAt: string | null;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
}

export interface SchedulingPolicy {
  name: string;
  preferGpu: boolean;
  preferLocal: boolean;                    // prefer non-federated devices
  batteryAware: boolean;
  loadBalancing: 'round_robin' | 'least_loaded' | 'best_fit';
  affinityTags: string[];
  fairShareEnabled: boolean;
}

export interface SchedulingDecision {
  unitId: string;
  deviceId: string;
  deviceName: string;
  reason: string;
  score: number;
}

/* ------------------------------------------------------- default policy */

export const DEFAULT_POLICY: SchedulingPolicy = {
  name: 'default',
  preferGpu: false,
  preferLocal: true,
  batteryAware: true,
  loadBalancing: 'best_fit',
  affinityTags: [],
  fairShareEnabled: true,
};

/* ------------------------------------------------------------ scheduler */

export function meetsRequirements(device: MeshDevice, reqs: ResourceRequirements): boolean {
  const caps = device.capabilities;
  if (caps.cpuCores < reqs.minCpuCores) return false;
  if (caps.ramMb < reqs.minRamMb) return false;
  if (reqs.requiresGpu && !caps.gpu) return false;
  if (reqs.minVramMb > 0 && (caps.gpu?.vramMb ?? 0) < reqs.minVramMb) return false;
  if (caps.storageFreeGb < reqs.minStorageGb) return false;
  for (const rt of reqs.requiredRuntimes) {
    if (!caps.runtimes.includes(rt)) return false;
  }
  return true;
}

export function scoreDevice(
  device: MeshDevice,
  unit: WorkUnit,
  policy: SchedulingPolicy,
): number {
  let score = 0.5;

  // Capability surplus — more resources = higher score
  const caps = device.capabilities;
  const reqs = unit.resourceReqs;
  score += Math.min(0.1, (caps.cpuCores - reqs.minCpuCores) / 32);
  score += Math.min(0.1, (caps.ramMb - reqs.minRamMb) / 65_536);

  // GPU bonus
  if (policy.preferGpu && caps.gpu) {
    score += 0.15;
    if (reqs.requiresGpu) score += 0.1;
  }

  // Load balancing
  const loadRatio = device.currentWorkUnits / caps.maxWorkUnits;
  if (policy.loadBalancing === 'least_loaded') {
    score += (1 - loadRatio) * 0.2;
  } else if (policy.loadBalancing === 'best_fit') {
    // Prefer device where this unit uses capacity efficiently
    score += (1 - Math.abs(0.7 - loadRatio)) * 0.15;
  }

  // Battery awareness (mobile)
  if (policy.batteryAware && caps.battery) {
    if (caps.battery.levelPct < device.batteryMinPct) return 0; // hard reject
    if (!caps.battery.charging && caps.battery.levelPct < 50) score -= 0.1;
    if (caps.battery.charging) score += 0.05;
  }

  // Locality preference
  if (policy.preferLocal && device.federationInstanceId) {
    score -= 0.1;
  }

  // Priority bonus
  score += (unit.priority / 10) * 0.05;

  return Math.max(0, Math.min(1, score));
}

export function scheduleUnit(
  registry: DeviceRegistry,
  unit: WorkUnit,
  policy: SchedulingPolicy = DEFAULT_POLICY,
): SchedulingDecision | null {
  const candidates = registry.listOnline();

  // Filter by capability
  const capable = candidates.filter((d) => meetsRequirements(d, unit.resourceReqs));

  // Filter capacity
  const eligible = capable.filter((d) => d.currentWorkUnits < d.capabilities.maxWorkUnits);

  if (eligible.length === 0) return null;

  // Score and rank
  const scored = eligible
    .map((d) => ({ device: d, score: scoreDevice(d, unit, policy) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const winner = scored[0];
  if (!winner) return null;

  return {
    unitId: unit.id,
    deviceId: winner.device.id,
    deviceName: winner.device.name,
    reason: `Best ${policy.loadBalancing} match (score: ${winner.score.toFixed(2)})`,
    score: winner.score,
  };
}

export function scheduleBatch(
  registry: DeviceRegistry,
  units: WorkUnit[],
  policy: SchedulingPolicy = DEFAULT_POLICY,
): SchedulingDecision[] {
  // Sort by priority (highest first)
  const sorted = [...units].sort((a, b) => b.priority - a.priority);
  const decisions: SchedulingDecision[] = [];

  for (const unit of sorted) {
    const decision = scheduleUnit(registry, unit, policy);
    if (decision) {
      decisions.push(decision);
      // Update the device's current work unit count
      const device = registry.get(decision.deviceId);
      if (device) device.currentWorkUnits++;
    }
  }

  return decisions;
}

export function createWorkUnit(
  jobId: string,
  index: number,
  payload: Record<string, unknown>,
  resourceReqs: Partial<ResourceRequirements> = {},
  priority: number = 5,
): WorkUnit {
  return {
    id: `wu-${jobId}-${index}`,
    jobId,
    index,
    status: 'pending',
    payload,
    resourceReqs: {
      minCpuCores: resourceReqs.minCpuCores ?? 1,
      minRamMb: resourceReqs.minRamMb ?? 512,
      requiresGpu: resourceReqs.requiresGpu ?? false,
      minVramMb: resourceReqs.minVramMb ?? 0,
      minStorageGb: resourceReqs.minStorageGb ?? 1,
      requiredRuntimes: resourceReqs.requiredRuntimes ?? [],
    },
    assignedDeviceId: null,
    priority,
    maxRetries: 3,
    retryCount: 0,
    encryptedPayload: false,
    integrityHash: null,
    createdAt: new Date().toISOString(),
    assignedAt: null,
    completedAt: null,
    result: null,
    errorMessage: null,
  };
}
