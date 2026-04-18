// Batch 83 — Agent Service Discovery shared types

export type DiscoveryServiceType = 'api' | 'worker' | 'scheduler' | 'gateway' | 'adapter' | 'processor' | 'monitor' | 'custom';
export type DiscoveryServiceStatus = 'registered' | 'healthy' | 'degraded' | 'unhealthy' | 'deregistered';
export type DiscoveryHealthCheckType = 'http' | 'tcp' | 'script' | 'heartbeat' | 'grpc';
export type HealthCheckStatus = 'passing' | 'warning' | 'failing' | 'unknown';
export type DiscoveryDependencyType = 'required' | 'optional' | 'soft' | 'development';

export interface DiscoveryServiceRegistryEntry {
  id: string;
  name: string;
  version: string;
  description?: string;
  serviceType: DiscoveryServiceType;
  status: DiscoveryServiceStatus;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc' | 'ws' | 'wss' | 'tcp' | 'nats';
  tags: string[];
  metadata: Record<string, unknown>;
  registeredBy?: string;
  lastHeartbeat?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveryServiceHealthCheck {
  id: string;
  serviceId: string;
  checkType: DiscoveryHealthCheckType;
  endpoint?: string;
  intervalSeconds: number;
  timeoutSeconds: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  lastStatus?: HealthCheckStatus;
  lastCheckedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DiscoveryServiceEndpoint {
  id: string;
  serviceId: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  description?: string;
  authRequired: boolean;
  rateLimit?: number;
  schemaRequest?: unknown;
  schemaResponse?: unknown;
  deprecated: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DiscoveryServiceDependency {
  id: string;
  serviceId: string;
  dependsOn: string;
  dependencyType: DiscoveryDependencyType;
  versionConstraint?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DiscoveryEvent {
  id: string;
  serviceId: string;
  eventType: 'registered' | 'deregistered' | 'healthy' | 'degraded' | 'unhealthy' | 'endpoint_added' | 'endpoint_removed' | 'dependency_added' | 'config_changed';
  details: Record<string, unknown>;
  triggeredBy?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isServiceHealthy(entry: Pick<DiscoveryServiceRegistryEntry, 'status'>): boolean {
  return entry.status === 'healthy';
}

export function serviceUptime(entry: Pick<DiscoveryServiceRegistryEntry, 'createdAt'>): number {
  return Date.now() - new Date(entry.createdAt).getTime();
}

export function healthyServiceCount(entries: Pick<DiscoveryServiceRegistryEntry, 'status'>[]): number {
  return entries.filter(e => e.status === 'healthy').length;
}
