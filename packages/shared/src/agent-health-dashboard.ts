export type HealthTargetType = 'agent' | 'service' | 'database' | 'queue' | 'api' | 'infrastructure';

export type DashboardCheckType = 'ping' | 'http' | 'tcp' | 'custom' | 'heartbeat' | 'metric_threshold';

export type DashboardHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown' | 'maintenance';

export type WidgetType = 'gauge' | 'chart' | 'table' | 'status_grid' | 'timeline' | 'heatmap' | 'counter' | 'sparkline';

export type DashboardAlertSeverity = 'info' | 'warning' | 'critical' | 'fatal';

export interface DashboardHealthCheck {
  id: string;
  targetType: HealthTargetType;
  targetId: string;
  checkType: DashboardCheckType;
  status: DashboardHealthStatus;
  lastCheckAt?: string;
  nextCheckAt?: string;
  intervalSeconds: number;
  timeoutMs: number;
  consecutiveFailures: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface HealthDashboard {
  id: string;
  name: string;
  description?: string;
  ownerAgentId?: string;
  layout: Record<string, unknown>;
  isPublic: boolean;
  refreshIntervalSeconds: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface HealthWidget {
  id: string;
  dashboardId: string;
  widgetType: WidgetType;
  title: string;
  dataSource: string;
  query: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface HealthThreshold {
  id: string;
  checkId: string;
  metricName: string;
  warningValue?: number;
  criticalValue?: number;
  comparison: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface HealthAlertRule {
  id: string;
  name: string;
  checkId?: string;
  condition: Record<string, unknown>;
  notificationChannels: unknown[];
  cooldownSeconds: number;
  severity: DashboardAlertSeverity;
  isActive: boolean;
  lastTriggeredAt?: string;
  triggerCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function DashboardisHealthy(check: DashboardHealthCheck): boolean {
  return check.status === 'healthy';
}

export function checkOverdue(check: DashboardHealthCheck): boolean {
  if (!check.nextCheckAt) return false;
  return new Date(check.nextCheckAt) < new Date();
}

export function alertCooldownActive(rule: HealthAlertRule): boolean {
  if (!rule.lastTriggeredAt) return false;
  const elapsed = Date.now() - new Date(rule.lastTriggeredAt).getTime();
  return elapsed < rule.cooldownSeconds * 1000;
}
