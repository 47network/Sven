/* Batch 164 — Agent Secret Rotation */

export type AgentSecretRotationType = 'time_based' | 'usage_based' | 'event_based' | 'manual';

export type AgentRotationPolicyStatus = 'active' | 'paused' | 'disabled';

export type AgentRotationEventType = 'rotated' | 'expired' | 'expiring_soon' | 'rotation_failed' | 'manual_override';

export type AgentRotationScheduleStatus = 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface AgentRotationPolicy {
  id: string;
  tenantId: string;
  policyName: string;
  secretPattern: string;
  rotationType: AgentSecretRotationType;
  intervalHours: number;
  maxAgeHours: number;
  autoRotate: boolean;
  notifyBeforeH: number;
  status: AgentRotationPolicyStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRotationEvent {
  id: string;
  policyId: string;
  secretName: string;
  eventType: AgentRotationEventType;
  oldVersion: string | null;
  newVersion: string | null;
  rotatedBy: string;
  durationMs: number | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentRotationSchedule {
  id: string;
  policyId: string;
  secretName: string;
  lastRotatedAt: string | null;
  nextRotation: string;
  rotationCount: number;
  consecutiveFailures: number;
  status: AgentRotationScheduleStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentSecretRotationStats {
  totalPolicies: number;
  activePolicies: number;
  totalRotations: number;
  failedRotations: number;
  expiringSoon: number;
}
