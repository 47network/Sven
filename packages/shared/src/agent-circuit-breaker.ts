export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export type CircuitBreakerEventType = 'state_change' | 'failure' | 'success' | 'timeout' | 'reset' | 'trip' | 'probe';

export type FallbackType = 'cache' | 'default_value' | 'alternate_service' | 'queue' | 'reject' | 'custom';

export type SlidingWindowType = 'count' | 'time';

export type MetricsPeriod = 'minute' | 'hour' | 'day' | 'week' | 'month';

export interface CircuitBreaker {
  id: string;
  serviceId: string;
  targetService: string;
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  lastFailureAt?: string;
  lastSuccessAt?: string;
  openedAt?: string;
  halfOpenedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CircuitBreakerEvent {
  id: string;
  breakerId: string;
  eventType: CircuitBreakerEventType;
  fromState?: string;
  toState?: string;
  errorMessage?: string;
  latencyMs?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CircuitBreakerPolicy {
  id: string;
  name: string;
  description?: string;
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  halfOpenMaxCalls: number;
  slidingWindowSize: number;
  slidingWindowType: SlidingWindowType;
  slowCallThresholdMs: number;
  slowCallRateThreshold: number;
  isDefault: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CircuitBreakerFallback {
  id: string;
  breakerId: string;
  fallbackType: FallbackType;
  fallbackConfig: Record<string, unknown>;
  priority: number;
  isActive: boolean;
  successCount: number;
  failureCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CircuitBreakerMetrics {
  id: string;
  breakerId: string;
  periodStart: string;
  periodEnd: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  timeoutCalls: number;
  avgLatencyMs?: number;
  p99LatencyMs?: number;
  errorRate?: number;
  stateChanges: number;
  fallbackInvocations: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function shouldTrip(cb: CircuitBreaker): boolean {
  return cb.state === 'closed' && cb.failureCount >= cb.failureThreshold;
}

export function canProbe(cb: CircuitBreaker): boolean {
  if (cb.state !== 'open' || !cb.openedAt) return false;
  const elapsed = Date.now() - new Date(cb.openedAt).getTime();
  return elapsed >= cb.timeoutMs;
}

export function calculateErrorRate(m: CircuitBreakerMetrics): number {
  if (m.totalCalls === 0) return 0;
  return (m.failedCalls / m.totalCalls) * 100;
}
