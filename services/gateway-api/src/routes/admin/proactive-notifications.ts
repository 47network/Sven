import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { NatsConnection, JSONCodec } from 'nats';
import { createLogger } from '@sven/shared';

// ── Inline types & constants (mirrors @sven/proactive-notifier) ─────

type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical';
type TriggerCategory =
  | 'critical_error' | 'resource_exhaustion' | 'security_alert'
  | 'training_milestone' | 'health_degraded' | 'task_completed'
  | 'scheduled_digest' | 'custom';

interface ProactiveNotificationConfig {
  enabled: boolean;
  global_cooldown_seconds: number;
  global_max_per_hour: number;
  default_channel_ids: string[];
  allow_freeform_proactive: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  adaptive_suppression: boolean;
}

const DEFAULT_CONFIG: ProactiveNotificationConfig = {
  enabled: true,
  global_cooldown_seconds: 30,
  global_max_per_hour: 60,
  default_channel_ids: [],
  allow_freeform_proactive: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
  adaptive_suppression: true,
};

const SEVERITY_ORDER: Record<NotificationSeverity, number> = { info: 0, warning: 1, error: 2, critical: 3 };

function severityMeetsThreshold(eventSeverity: NotificationSeverity, minSeverity: NotificationSeverity): boolean {
  return SEVERITY_ORDER[eventSeverity] >= SEVERITY_ORDER[minSeverity];
}

const DEFAULT_TRIGGER_PRESETS = [
  { name: 'Critical Error Alert', category: 'critical_error', enabled: true, min_severity: 'critical', cooldown_seconds: 300, max_per_hour: 10, condition_expression: 'event.level === "fatal" || event.level === "error"', body_template: '🚨 **Critical Error**\n\n{{event.message}}\n\nService: `{{event.service}}`\nTimestamp: {{event.timestamp}}' },
  { name: 'Resource Exhaustion Warning', category: 'resource_exhaustion', enabled: true, min_severity: 'warning', cooldown_seconds: 600, max_per_hour: 5, condition_expression: 'event.metric_value >= event.threshold', body_template: '⚠️ **Resource Alert**: {{event.resource}} at {{event.metric_value}}% (threshold: {{event.threshold}}%)' },
  { name: 'Security Alert', category: 'security_alert', enabled: true, min_severity: 'error', cooldown_seconds: 60, max_per_hour: 20, condition_expression: 'event.type === "auth_failure" || event.type === "brute_force"', body_template: '🔒 **Security Alert**: {{event.type}}\n\n{{event.description}}\n\nSource: `{{event.source_ip}}`' },
  { name: 'Training Milestone Reached', category: 'training_milestone', enabled: true, min_severity: 'info', cooldown_seconds: 0, max_per_hour: 0, condition_expression: 'event.milestone !== undefined', body_template: '🎯 **Milestone**: {{event.milestone}}\n\n{{event.description}}' },
  { name: 'Health Degradation', category: 'health_degraded', enabled: true, min_severity: 'warning', cooldown_seconds: 300, max_per_hour: 6, condition_expression: 'event.status === "degraded" || event.status === "down"', body_template: '💔 **Health Degraded**: {{event.service}} is {{event.status}}' },
  { name: 'Task Completed', category: 'task_completed', enabled: true, min_severity: 'info', cooldown_seconds: 0, max_per_hour: 0, condition_expression: 'event.task_status === "completed"', body_template: '✅ **Task Complete**: {{event.task_name}}\n\n{{event.summary}}' },
];

const logger = createLogger('admin-proactive-notifications');
const jc = JSONCodec();

const ALLOWED_CHANNELS: Set<string> = new Set(['slack', 'discord', 'whatsapp', 'matrix', 'telegram', 'email', 'push', 'webhook']);
const ALLOWED_SEVERITIES: Set<string> = new Set(['info', 'warning', 'error', 'critical']);
const ALLOWED_CATEGORIES: Set<string> = new Set([
  'critical_error', 'resource_exhaustion', 'security_alert', 'training_milestone',
  'health_degraded', 'task_completed', 'scheduled_digest', 'custom',
]);
const MAX_BODY_TEMPLATE_LENGTH = 4000;
const MAX_CONDITION_LENGTH = 1000;
const MAX_LABEL_LENGTH = 200;
const MAX_LOG_LIMIT = 200;

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

function sanitizeString(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, maxLen);
}

function sanitizeOptionalString(raw: unknown, maxLen: number): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  return sanitizeString(raw, maxLen);
}

export async function registerProactiveNotificationRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc: NatsConnection,
): Promise<void> {

  // ─── Config CRUD ──────────────────────────────────────────────────

  app.get('/proactive-notifications/config', async (request: any, reply) => {
    try {
      const res = await pool.query(
        `SELECT value FROM settings_global WHERE key = 'proactive_notifications.config' LIMIT 1`,
      );
      const config: ProactiveNotificationConfig = res.rows[0]?.value
        ? { ...DEFAULT_CONFIG, ...(typeof res.rows[0].value === 'string' ? JSON.parse(res.rows[0].value) : res.rows[0].value) }
        : { ...DEFAULT_CONFIG };
      return reply.send({ success: true, data: config });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.send({ success: true, data: { ...DEFAULT_CONFIG } });
      }
      logger.error('Failed to get proactive config', { error: err instanceof Error ? err.message : String(err) });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to load config' } });
    }
  });

  app.put('/proactive-notifications/config', async (request: any, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'Request body required' } });
    }

    try {
      // Load current config
      const currentRes = await pool.query(
        `SELECT value FROM settings_global WHERE key = 'proactive_notifications.config' LIMIT 1`,
      );
      const current: ProactiveNotificationConfig = currentRes.rows[0]?.value
        ? { ...DEFAULT_CONFIG, ...(typeof currentRes.rows[0].value === 'string' ? JSON.parse(currentRes.rows[0].value) : currentRes.rows[0].value) }
        : { ...DEFAULT_CONFIG };

      // Merge with validated fields
      const updated: ProactiveNotificationConfig = { ...current };
      if (typeof body.enabled === 'boolean') updated.enabled = body.enabled;
      if (typeof body.global_cooldown_seconds === 'number' && body.global_cooldown_seconds >= 0) {
        updated.global_cooldown_seconds = Math.floor(body.global_cooldown_seconds);
      }
      if (typeof body.global_max_per_hour === 'number' && body.global_max_per_hour >= 0) {
        updated.global_max_per_hour = Math.floor(body.global_max_per_hour);
      }
      if (Array.isArray(body.default_channel_ids)) {
        updated.default_channel_ids = body.default_channel_ids.filter((id): id is string => typeof id === 'string');
      }
      if (typeof body.allow_freeform_proactive === 'boolean') updated.allow_freeform_proactive = body.allow_freeform_proactive;
      if (body.quiet_hours_start !== undefined) {
        updated.quiet_hours_start = sanitizeOptionalString(body.quiet_hours_start, 5);
      }
      if (body.quiet_hours_end !== undefined) {
        updated.quiet_hours_end = sanitizeOptionalString(body.quiet_hours_end, 5);
      }
      if (typeof body.adaptive_suppression === 'boolean') updated.adaptive_suppression = body.adaptive_suppression;

      await pool.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ('proactive_notifications.config', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [JSON.stringify(updated), request.userId],
      );

      logger.info('Proactive notification config updated', { updated_by: request.userId });
      return reply.send({ success: true, data: updated });
    } catch (err) {
      logger.error('Failed to update proactive config', { error: err instanceof Error ? err.message : String(err) });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to update config' } });
    }
  });

  // ─── Trigger Rules CRUD ──────────────────────────────────────────

  app.get('/proactive-notifications/rules', async (request: any, reply) => {
    try {
      const orgId = String(request.orgId || '');
      const res = await pool.query(
        `SELECT * FROM proactive_trigger_rules WHERE organization_id = $1 OR organization_id IS NULL ORDER BY category, name`,
        [orgId || null],
      );
      return reply.send({ success: true, data: res.rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.send({ success: true, data: [] });
      }
      logger.error('Failed to list trigger rules', { error: err instanceof Error ? err.message : String(err) });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list rules' } });
    }
  });

  app.post('/proactive-notifications/rules', async (request: any, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'Request body required' } });
    }

    const name = sanitizeString(body.name, MAX_LABEL_LENGTH);
    if (!name) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'name is required' } });
    }

    const category = sanitizeString(body.category, 50);
    if (!ALLOWED_CATEGORIES.has(category)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: `category must be one of: ${[...ALLOWED_CATEGORIES].join(', ')}` } });
    }

    const minSeverity = sanitizeString(body.min_severity ?? 'info', 20);
    if (!ALLOWED_SEVERITIES.has(minSeverity)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: `min_severity must be one of: ${[...ALLOWED_SEVERITIES].join(', ')}` } });
    }

    const cooldownSeconds = typeof body.cooldown_seconds === 'number' ? Math.max(0, Math.floor(body.cooldown_seconds)) : 300;
    const maxPerHour = typeof body.max_per_hour === 'number' ? Math.max(0, Math.floor(body.max_per_hour)) : 10;
    const conditionExpression = sanitizeString(body.condition_expression ?? '', MAX_CONDITION_LENGTH);
    const bodyTemplate = sanitizeString(body.body_template ?? '', MAX_BODY_TEMPLATE_LENGTH);
    const targetChannels = Array.isArray(body.target_channels) ? body.target_channels.filter((c): c is string => typeof c === 'string') : [];
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;

    try {
      const id = uuidv7();
      const orgId = String(request.orgId || '') || null;
      await pool.query(
        `INSERT INTO proactive_trigger_rules (id, name, category, enabled, min_severity, cooldown_seconds, max_per_hour, condition_expression, body_template, target_channels, organization_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
        [id, name, category, enabled, minSeverity, cooldownSeconds, maxPerHour, conditionExpression, bodyTemplate, JSON.stringify(targetChannels), orgId],
      );

      const created = (await pool.query(`SELECT * FROM proactive_trigger_rules WHERE id = $1`, [id])).rows[0];
      logger.info('Trigger rule created', { rule_id: id, name, category });
      return reply.status(201).send({ success: true, data: created });
    } catch (err) {
      logger.error('Failed to create trigger rule', { error: err instanceof Error ? err.message : String(err) });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to create rule' } });
    }
  });

  app.put('/proactive-notifications/rules/:ruleId', async (request: any, reply) => {
    const ruleId = String(request.params?.ruleId || '');
    if (!ruleId) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'ruleId is required' } });
    }

    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'Request body required' } });
    }

    try {
      const existing = await pool.query(`SELECT * FROM proactive_trigger_rules WHERE id = $1`, [ruleId]);
      if (existing.rows.length === 0) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } });
      }

      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (body.name !== undefined) {
        const name = sanitizeString(body.name, MAX_LABEL_LENGTH);
        if (!name) return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'name cannot be empty' } });
        sets.push(`name = $${idx++}`); params.push(name);
      }
      if (body.category !== undefined) {
        const cat = sanitizeString(body.category, 50);
        if (!ALLOWED_CATEGORIES.has(cat)) return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid category' } });
        sets.push(`category = $${idx++}`); params.push(cat);
      }
      if (typeof body.enabled === 'boolean') {
        sets.push(`enabled = $${idx++}`); params.push(body.enabled);
      }
      if (body.min_severity !== undefined) {
        const sev = sanitizeString(body.min_severity, 20);
        if (!ALLOWED_SEVERITIES.has(sev)) return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid severity' } });
        sets.push(`min_severity = $${idx++}`); params.push(sev);
      }
      if (typeof body.cooldown_seconds === 'number') {
        sets.push(`cooldown_seconds = $${idx++}`); params.push(Math.max(0, Math.floor(body.cooldown_seconds)));
      }
      if (typeof body.max_per_hour === 'number') {
        sets.push(`max_per_hour = $${idx++}`); params.push(Math.max(0, Math.floor(body.max_per_hour)));
      }
      if (body.condition_expression !== undefined) {
        sets.push(`condition_expression = $${idx++}`); params.push(sanitizeString(body.condition_expression, MAX_CONDITION_LENGTH));
      }
      if (body.body_template !== undefined) {
        sets.push(`body_template = $${idx++}`); params.push(sanitizeString(body.body_template, MAX_BODY_TEMPLATE_LENGTH));
      }
      if (Array.isArray(body.target_channels)) {
        sets.push(`target_channels = $${idx++}`); params.push(JSON.stringify(body.target_channels.filter((c: unknown): c is string => typeof c === 'string')));
      }

      if (sets.length === 0) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'No valid fields to update' } });
      }

      sets.push(`updated_at = NOW()`);
      params.push(ruleId);
      await pool.query(`UPDATE proactive_trigger_rules SET ${sets.join(', ')} WHERE id = $${idx}`, params);

      const updated = (await pool.query(`SELECT * FROM proactive_trigger_rules WHERE id = $1`, [ruleId])).rows[0];
      logger.info('Trigger rule updated', { rule_id: ruleId });
      return reply.send({ success: true, data: updated });
    } catch (err) {
      logger.error('Failed to update trigger rule', { error: err instanceof Error ? err.message : String(err) });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to update rule' } });
    }
  });

  app.delete('/proactive-notifications/rules/:ruleId', async (request: any, reply) => {
    const ruleId = String(request.params?.ruleId || '');
    if (!ruleId) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'ruleId is required' } });
    }

    try {
      const res = await pool.query(`DELETE FROM proactive_trigger_rules WHERE id = $1 RETURNING id`, [ruleId]);
      if (res.rows.length === 0) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } });
      }
      logger.info('Trigger rule deleted', { rule_id: ruleId });
      return reply.send({ success: true, data: { deleted: true, id: ruleId } });
    } catch (err) {
      logger.error('Failed to delete trigger rule', { error: err instanceof Error ? err.message : String(err) });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to delete rule' } });
    }
  });

  // ─── Channel Endpoints CRUD ──────────────────────────────────────

  app.get('/proactive-notifications/endpoints', async (request: any, reply) => {
    try {
      const orgId = String(request.orgId || '');
      const res = await pool.query(
        `SELECT * FROM proactive_channel_endpoints WHERE organization_id = $1 OR organization_id IS NULL ORDER BY channel, label`,
        [orgId || null],
      );
      return reply.send({ success: true, data: res.rows });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.send({ success: true, data: [] });
      }
      logger.error('Failed to list channel endpoints', { error: err instanceof Error ? err.message : String(err) });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list endpoints' } });
    }
  });

  app.post('/proactive-notifications/endpoints', async (request: any, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'Request body required' } });
    }

    const channel = sanitizeString(body.channel, 50);
    if (!ALLOWED_CHANNELS.has(channel)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: `channel must be one of: ${[...ALLOWED_CHANNELS].join(', ')}` } });
    }

    const channelChatId = sanitizeString(body.channel_chat_id, 500);
    if (!channelChatId) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'channel_chat_id is required' } });
    }

    const label = sanitizeString(body.label ?? channel, MAX_LABEL_LENGTH);
    const minSeverity = sanitizeString(body.min_severity ?? 'info', 20);
    if (!ALLOWED_SEVERITIES.has(minSeverity)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid min_severity' } });
    }
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;

    try {
      const id = uuidv7();
      const orgId = String(request.orgId || '') || null;
      await pool.query(
        `INSERT INTO proactive_channel_endpoints (id, channel, channel_chat_id, label, enabled, min_severity, organization_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [id, channel, channelChatId, label, enabled, minSeverity, orgId],
      );

      const created = (await pool.query(`SELECT * FROM proactive_channel_endpoints WHERE id = $1`, [id])).rows[0];
      logger.info('Channel endpoint created', { endpoint_id: id, channel, label });
      return reply.status(201).send({ success: true, data: created });
    } catch (err) {
      logger.error('Failed to create channel endpoint', { error: err instanceof Error ? err.message : String(err) });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to create endpoint' } });
    }
  });

  app.put('/proactive-notifications/endpoints/:endpointId', async (request: any, reply) => {
    const endpointId = String(request.params?.endpointId || '');
    if (!endpointId) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'endpointId is required' } });
    }

    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'Request body required' } });
    }

    try {
      const existing = await pool.query(`SELECT * FROM proactive_channel_endpoints WHERE id = $1`, [endpointId]);
      if (existing.rows.length === 0) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
      }

      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (body.channel !== undefined) {
        const ch = sanitizeString(body.channel, 50);
        if (!ALLOWED_CHANNELS.has(ch)) return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid channel' } });
        sets.push(`channel = $${idx++}`); params.push(ch);
      }
      if (body.channel_chat_id !== undefined) {
        const cid = sanitizeString(body.channel_chat_id, 500);
        if (!cid) return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'channel_chat_id cannot be empty' } });
        sets.push(`channel_chat_id = $${idx++}`); params.push(cid);
      }
      if (body.label !== undefined) {
        sets.push(`label = $${idx++}`); params.push(sanitizeString(body.label, MAX_LABEL_LENGTH));
      }
      if (typeof body.enabled === 'boolean') {
        sets.push(`enabled = $${idx++}`); params.push(body.enabled);
      }
      if (body.min_severity !== undefined) {
        const sev = sanitizeString(body.min_severity, 20);
        if (!ALLOWED_SEVERITIES.has(sev)) return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid min_severity' } });
        sets.push(`min_severity = $${idx++}`); params.push(sev);
      }

      if (sets.length === 0) {
        return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'No valid fields to update' } });
      }

      sets.push(`updated_at = NOW()`);
      params.push(endpointId);
      await pool.query(`UPDATE proactive_channel_endpoints SET ${sets.join(', ')} WHERE id = $${idx}`, params);

      const updated = (await pool.query(`SELECT * FROM proactive_channel_endpoints WHERE id = $1`, [endpointId])).rows[0];
      logger.info('Channel endpoint updated', { endpoint_id: endpointId });
      return reply.send({ success: true, data: updated });
    } catch (err) {
      logger.error('Failed to update channel endpoint', { error: err instanceof Error ? err.message : String(err) });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to update endpoint' } });
    }
  });

  app.delete('/proactive-notifications/endpoints/:endpointId', async (request: any, reply) => {
    const endpointId = String(request.params?.endpointId || '');
    if (!endpointId) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'endpointId is required' } });
    }

    try {
      const res = await pool.query(`DELETE FROM proactive_channel_endpoints WHERE id = $1 RETURNING id`, [endpointId]);
      if (res.rows.length === 0) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
      }
      logger.info('Channel endpoint deleted', { endpoint_id: endpointId });
      return reply.send({ success: true, data: { deleted: true, id: endpointId } });
    } catch (err) {
      logger.error('Failed to delete channel endpoint', { error: err instanceof Error ? err.message : String(err) });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to delete endpoint' } });
    }
  });

  // ─── Send Proactive Message ──────────────────────────────────────

  app.post('/proactive-notifications/send', async (request: any, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'Request body required' } });
    }

    const text = sanitizeString(body.text, 4000);
    if (!text) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'text is required' } });
    }

    const severity = sanitizeString(body.severity ?? 'info', 20) as NotificationSeverity;
    if (!ALLOWED_SEVERITIES.has(severity)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid severity' } });
    }

    const category = sanitizeString(body.category ?? 'custom', 50) as TriggerCategory;

    // Check if enabled
    let config: ProactiveNotificationConfig = { ...DEFAULT_CONFIG };
    try {
      const configRes = await pool.query(
        `SELECT value FROM settings_global WHERE key = 'proactive_notifications.config' LIMIT 1`,
      );
      if (configRes.rows[0]?.value) {
        config = { ...DEFAULT_CONFIG, ...(typeof configRes.rows[0].value === 'string' ? JSON.parse(configRes.rows[0].value) : configRes.rows[0].value) };
      }
    } catch { /* use defaults */ }

    if (!config.enabled) {
      return reply.status(422).send({ success: false, error: { code: 'DISABLED', message: 'Proactive notifications are disabled' } });
    }

    // Resolve target endpoints
    const targetChannelIds = Array.isArray(body.target_channel_ids)
      ? body.target_channel_ids.filter((id): id is string => typeof id === 'string')
      : [];

    try {
      let endpoints: Array<{ id: string; channel: string; channel_chat_id: string; min_severity: string }>;
      if (targetChannelIds.length > 0) {
        const res = await pool.query(
          `SELECT id, channel, channel_chat_id, min_severity FROM proactive_channel_endpoints WHERE id = ANY($1) AND enabled = true`,
          [targetChannelIds],
        );
        endpoints = res.rows;
      } else if (config.default_channel_ids.length > 0) {
        const res = await pool.query(
          `SELECT id, channel, channel_chat_id, min_severity FROM proactive_channel_endpoints WHERE id = ANY($1) AND enabled = true`,
          [config.default_channel_ids],
        );
        endpoints = res.rows;
      } else {
        // Fallback: all enabled endpoints
        const res = await pool.query(
          `SELECT id, channel, channel_chat_id, min_severity FROM proactive_channel_endpoints WHERE enabled = true`,
        );
        endpoints = res.rows;
      }

      if (endpoints.length === 0) {
        return reply.status(422).send({ success: false, error: { code: 'NO_ENDPOINTS', message: 'No delivery endpoints configured' } });
      }

      // Filter by severity
      const eligible = endpoints.filter((ep) =>
        severityMeetsThreshold(severity, ep.min_severity as NotificationSeverity),
      );

      if (eligible.length === 0) {
        return reply.status(422).send({ success: false, error: { code: 'NO_ELIGIBLE_ENDPOINTS', message: 'No endpoints match the severity threshold' } });
      }

      let dispatched = 0;
      const blocks = [{ type: 'markdown', content: text }];

      for (const ep of eligible) {
        const outboxId = uuidv7();
        const idempotencyKey = `proactive:freeform:${outboxId}`;

        await pool.query(
          `INSERT INTO outbox (id, chat_id, channel, channel_chat_id, content_type, text, blocks, idempotency_key, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'blocks', $5, $6, $7, 'pending', NOW(), NOW())`,
          [outboxId, ep.channel_chat_id, ep.channel, ep.channel_chat_id, text, JSON.stringify(blocks), idempotencyKey],
        );

        const envelope = {
          schema_version: '1.0',
          event_id: uuidv7(),
          occurred_at: new Date().toISOString(),
          data: {
            outbox_id: outboxId,
            chat_id: ep.channel_chat_id,
            channel: ep.channel,
            channel_chat_id: ep.channel_chat_id,
            content_type: 'blocks',
            text,
            blocks,
            idempotency_key: idempotencyKey,
          },
        };
        nc.publish('outbox.enqueue', jc.encode(envelope));

        // Log
        const logId = uuidv7();
        await pool.query(
          `INSERT INTO proactive_notification_log (id, rule_id, category, severity, channel, channel_chat_id, title, body, event_data, status, organization_id, created_at)
           VALUES ($1, NULL, $2, $3, $4, $5, 'freeform', $6, $7, 'delivered', $8, NOW())`,
          [logId, category, severity, ep.channel, ep.channel_chat_id, text, JSON.stringify({}), request.orgId || null],
        ).catch(() => {});

        dispatched++;
      }

      logger.info('Proactive message sent', { dispatched, severity, category, sent_by: request.userId });
      return reply.send({ success: true, data: { dispatched, endpoints: eligible.length } });
    } catch (err) {
      logger.error('Failed to send proactive message', { error: err instanceof Error ? err.message : String(err) });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to send message' } });
    }
  });

  // ─── Log & Stats ──────────────────────────────────────────────────

  app.get('/proactive-notifications/log', async (request: any, reply) => {
    const query = request.query as Record<string, string> | undefined;
    const category = query?.category || '';
    const severity = query?.severity || '';
    const status = query?.status || '';
    const limit = Math.min(Math.max(1, parseInt(query?.limit || '50', 10) || 50), MAX_LOG_LIMIT);
    const offset = Math.max(0, parseInt(query?.offset || '0', 10) || 0);

    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (category && ALLOWED_CATEGORIES.has(category)) {
        conditions.push(`category = $${idx++}`); params.push(category);
      }
      if (severity && ALLOWED_SEVERITIES.has(severity)) {
        conditions.push(`severity = $${idx++}`); params.push(severity);
      }
      if (status) {
        conditions.push(`status = $${idx++}`); params.push(status);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit, offset);

      const res = await pool.query(
        `SELECT * FROM proactive_notification_log ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
        params,
      );

      const countRes = await pool.query(
        `SELECT COUNT(*) AS total FROM proactive_notification_log ${where}`,
        params.slice(0, -2), // exclude limit/offset
      );

      return reply.send({
        success: true,
        data: {
          items: res.rows,
          total: parseInt(countRes.rows[0]?.total || '0', 10),
          limit,
          offset,
        },
      });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.send({ success: true, data: { items: [], total: 0, limit, offset } });
      }
      logger.error('Failed to list notification log', { error: err instanceof Error ? err.message : String(err) });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to list log' } });
    }
  });

  app.get('/proactive-notifications/stats', async (request: any, reply) => {
    try {
      const res = await pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed,
          COUNT(*) FILTER (WHERE status = 'suppressed') AS suppressed,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS last_hour,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h,
          COUNT(DISTINCT rule_id) AS unique_rules_fired,
          COUNT(DISTINCT channel) AS unique_channels_used
        FROM proactive_notification_log
      `);

      const stats = res.rows[0] || {};
      return reply.send({ success: true, data: stats });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.send({ success: true, data: { total: 0, delivered: 0, failed: 0, suppressed: 0, last_hour: 0, last_24h: 0 } });
      }
      logger.error('Failed to get notification stats', { error: err instanceof Error ? err.message : String(err) });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to get stats' } });
    }
  });

  // ─── Feedback ──────────────────────────────────────────────────────

  app.post('/proactive-notifications/log/:logId/feedback', async (request: any, reply) => {
    const logId = String(request.params?.logId || '');
    if (!logId) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'logId is required' } });
    }

    const body = request.body as Record<string, unknown> | null;
    const feedbackAction = sanitizeString(body?.action, 50);
    if (!feedbackAction || !['acknowledged', 'dismissed', 'muted_rule'].includes(feedbackAction)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_INPUT', message: 'action must be one of: acknowledged, dismissed, muted_rule' } });
    }

    try {
      const res = await pool.query(
        `UPDATE proactive_notification_log SET feedback_action = $1, feedback_at = NOW() WHERE id = $2 RETURNING id, rule_id`,
        [feedbackAction, logId],
      );

      if (res.rows.length === 0) {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Log entry not found' } });
      }

      // Adaptive suppression: auto-disable rule if user mutes it
      if (feedbackAction === 'muted_rule' && res.rows[0].rule_id) {
        // Check adaptive suppression setting
        let config: ProactiveNotificationConfig = { ...DEFAULT_CONFIG };
        try {
          const configRes = await pool.query(
            `SELECT value FROM settings_global WHERE key = 'proactive_notifications.config' LIMIT 1`,
          );
          if (configRes.rows[0]?.value) {
            config = { ...DEFAULT_CONFIG, ...(typeof configRes.rows[0].value === 'string' ? JSON.parse(configRes.rows[0].value) : configRes.rows[0].value) };
          }
        } catch { /* use defaults */ }

        if (config.adaptive_suppression) {
          await pool.query(
            `UPDATE proactive_trigger_rules SET enabled = false, updated_at = NOW() WHERE id = $1`,
            [res.rows[0].rule_id],
          );
          logger.info('Adaptive suppression: disabled rule via user feedback', {
            rule_id: res.rows[0].rule_id,
            by_user: request.userId,
          });
        }
      }

      logger.info('Notification feedback recorded', { log_id: logId, action: feedbackAction });
      return reply.send({ success: true, data: { id: logId, feedback_action: feedbackAction } });
    } catch (err) {
      logger.error('Failed to record feedback', { error: err instanceof Error ? err.message : String(err) });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to record feedback' } });
    }
  });

  // ─── Seed default rules ──────────────────────────────────────────

  app.post('/proactive-notifications/seed-defaults', async (request: any, reply) => {
    try {
      let seeded = 0;
      for (const preset of DEFAULT_TRIGGER_PRESETS) {
        const id = uuidv7();
        const res = await pool.query(
          `INSERT INTO proactive_trigger_rules (id, name, category, enabled, min_severity, cooldown_seconds, max_per_hour, condition_expression, body_template, target_channels, organization_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '[]', NULL, NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [id, preset.name, preset.category, preset.enabled, preset.min_severity, preset.cooldown_seconds, preset.max_per_hour, preset.condition_expression, preset.body_template],
        );
        if ((res.rowCount ?? 0) > 0) seeded++;
      }
      logger.info('Default trigger rules seeded', { count: seeded });
      return reply.send({ success: true, data: { seeded } });
    } catch (err) {
      logger.error('Failed to seed defaults', { error: err instanceof Error ? err.message : String(err) });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Failed to seed defaults' } });
    }
  });
}
