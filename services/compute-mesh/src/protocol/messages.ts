// ---------------------------------------------------------------------------
// Protocol — Message type definitions for NATS communication
// ---------------------------------------------------------------------------

import type { DeviceCapabilities, DeviceStatus } from '@sven/compute-mesh/device-registry';
import type { ResourceRequirements, DecompositionStrategy } from '@sven/compute-mesh/scheduler';

/* ────── Device → Coordinator ─────────────────────────────────────────────── */

export interface HeartbeatMessage {
  deviceId: string;
  timestamp: number;
  status: DeviceStatus;
  currentUnits: number;
  capabilities: DeviceCapabilities;
}

export interface DeviceRegisterMessage {
  deviceId: string;
  orgId: string;
  name: string;
  deviceType: 'vm' | 'mobile' | 'desktop' | 'federated';
  capabilities: DeviceCapabilities;
  wireguardIp: string | null;
  batteryMinPct: number;
  maxWorkUnits: number;
}

export interface DeviceDeregisterMessage {
  deviceId: string;
  reason: string;
}

export interface UnitResultMessage {
  unitId: string;
  jobId: string;
  deviceId: string;
  encryptedResult: string;      // base64-encoded encrypted bytes
  resultHash: string;           // SHA-256 hex
  computeMs: number;
  peakMemoryMb: number;
}

export interface UnitErrorMessage {
  unitId: string;
  jobId: string;
  deviceId: string;
  error: string;
  retryable: boolean;
}

/* ────── Coordinator → Device ─────────────────────────────────────────────── */

export interface UnitAssignmentMessage {
  unitId: string;
  jobId: string;
  unitIndex: number;
  strategy: DecompositionStrategy;
  encryptedPayload: string;     // base64-encoded AES-256-GCM ciphertext
  iv: string;                   // base64-encoded initialization vector
  authTag: string;              // base64-encoded authentication tag
  keyId: string;
  resourceReqs: ResourceRequirements;
  priority: number;
  maxRetries: number;
  deadline: number | null;      // unix ms
}

export interface JobStatusMessage {
  jobId: string;
  status: string;
  totalUnits: number;
  completedUnits: number;
  failedUnits: number;
  progressPct: number;
}

export interface UnitStatusMessage {
  unitId: string;
  jobId: string;
  status: string;
  assignedDevice: string | null;
}

/* ────── Mesh Metrics ─────────────────────────────────────────────────────── */

export interface MeshMetricsMessage {
  timestamp: number;
  totalDevices: number;
  onlineDevices: number;
  gpuDevices: number;
  totalVramMb: number;
  totalRamMb: number;
  totalCores: number;
  activeJobs: number;
  pendingUnits: number;
  runningUnits: number;
}
