/**
 * @sven/proactive-notifier — Core notification engine
 *
 * Evaluates incoming system events against trigger rules,
 * enforces cooldowns and rate limits, resolves target channels,
 * and dispatches proactive notifications through the outbox.
 */

import type { NatsConnection, JetStreamClient, JetStreamManager } from 'nats';
import type pg from 'pg';
import {
  type TriggerRule,
  type NotificationSeverity,
  type TriggerCategory,
  SEVERITY_ORDER,
  severityMeetsThreshold,
} from '../triggers/index.js';
import {
  type ChannelEndpoint,
  type ProactiveNotificationConfig,
  type ProactiveOutboxPayload,
  DEFAULT_CONFIG,
  buildOutboxPayload,
  isInQuietHours,
  severityToPriority,
  renderTemplate,
} from '../channels/index.js';

/** Incoming system event to evaluate against trigger rules */
export interface ProactiveEvent {
  /** Event ID (for idempotency) */
  event_id: string;
  /** UTC ISO timestamp */
  occurred_at: string;
  /** Trigger category this event falls under */
  category: TriggerCategory;
  /** Event severity */
  severity: NotificationSeverity;
  /** Arbitrary event data for template rendering */
  data: Record<string, unknown>;
  /** Organisation scope (null = global) */
  organization_id: string | null;
}

/** Result of evaluating an event against the trigger engine */
export interface EvaluationResult {
  /** Whether a notification should be sent */
  should_notify: boolean;
  /** Reason if suppressed */
  suppression_reason?: string;
  /** Matched rules */
  matched_rules: TriggerRule[];
  /** Payloads to dispatch */
  payloads: ProactiveOutboxPayload[];
}

/** Notification log record persisted to DB */
export interface NotificationLogEntry {
  id: string;
  rule_id: string | null;
  category: TriggerCategory;
  severity: NotificationSeverity;
  channel: string;
  channel_chat_id: string;
  title: string;
  body: string;
  event_data: Record<string, unknown>;
  status: 'pending' | 'delivered' | 'failed' | 'suppressed';
  suppression_reason: string | null;
  created_at: string;
  delivered_at: string | null;
  organization_id: string | null;
}

/** In-memory rate tracker */
interface RateWindow {
  count: number;
  window_start: number;
}

/**
 * ProactiveEngine — stateful engine that runs in the notification service.
 * It subscribes to proactive event subjects and evaluates trigger rules.
 */
export class ProactiveEngine {
  private config: ProactiveNotificationConfig = { ...DEFAULT_CONFIG };
  private rules: TriggerRule[] = [];
  private endpoints: ChannelEndpoint[] = [];
  private rateWindows = new Map<string, RateWindow>();
  private globalRate: RateWindow = { count: 0, window_start: Date.now() };
  private lastGlobalFire = 0;

  constructor(
    private readonly pool: pg.Pool,
    private readonly nc: NatsConnection,
    private readonly logger: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void },
  ) {}

  /** Load config, rules, and endpoints from the database */
  async reload(): Promise<void> {
    // Load global config
    const configRes = await this.pool.query(
      `SELECT value FROM settings_global WHERE key = 'proactive_notifications.config' LIMIT 1`,
    );
    if (configRes.rows[0]?.value) {
      const stored = configRes.rows[0].value;
      this.config = { ...DEFAULT_CONFIG, ...(typeof stored === 'string' ? JSON.parse(stored) : stored) };
    }

    // Load trigger rules
    const rulesRes = await this.pool.query(
      `SELECT * FROM proactive_trigger_rules WHERE enabled = true ORDER BY category, name`,
    );
    this.rules = rulesRes.rows as TriggerRule[];

    // Load channel endpoints
    const endpointsRes = await this.pool.query(
      `SELECT * FROM proactive_channel_endpoints WHERE enabled = true ORDER BY channel, label`,
    );
    this.endpoints = endpointsRes.rows as ChannelEndpoint[];

    this.logger.info('ProactiveEngine reloaded', {
      rules_count: this.rules.length,
      endpoints_count: this.endpoints.length,
      enabled: this.config.enabled,
    });
  }

  /** Evaluate a system event against all active trigger rules */
  async evaluate(event: ProactiveEvent): Promise<EvaluationResult> {
    if (!this.config.enabled) {
      return { should_notify: false, suppression_reason: 'proactive_notifications_disabled', matched_rules: [], payloads: [] };
    }

    // Quiet hours — suppress non-critical
    if (event.severity !== 'critical' && isInQuietHours(this.config)) {
      return { should_notify: false, suppression_reason: 'quiet_hours', matched_rules: [], payloads: [] };
    }

    // Global cooldown
    const now = Date.now();
    if (event.severity !== 'critical' && (now - this.lastGlobalFire) < this.config.global_cooldown_seconds * 1000) {
      return { should_notify: false, suppression_reason: 'global_cooldown', matched_rules: [], payloads: [] };
    }

    // Global rate limit
    if (this.config.global_max_per_hour > 0) {
      this.resetWindowIfExpired(this.globalRate);
      if (this.globalRate.count >= this.config.global_max_per_hour && event.severity !== 'critical') {
        return { should_notify: false, suppression_reason: 'global_rate_limit', matched_rules: [], payloads: [] };
      }
    }

    // Find matching rules
    const matchedRules: TriggerRule[] = [];
    for (const rule of this.rules) {
      if (rule.category !== event.category) continue;
      if (!severityMeetsThreshold(event.severity, rule.min_severity)) continue;

      // Organisation scope check
      if (rule.organization_id && rule.organization_id !== event.organization_id) continue;

      // Per-rule cooldown
      if (rule.last_fired_at) {
        const lastFired = new Date(rule.last_fired_at).getTime();
        if (rule.cooldown_seconds > 0 && (now - lastFired) < rule.cooldown_seconds * 1000) continue;
      }

      // Per-rule rate limit
      if (rule.max_per_hour > 0) {
        const rateKey = `rule:${rule.id}`;
        let window = this.rateWindows.get(rateKey);
        if (!window) {
          window = { count: 0, window_start: now };
          this.rateWindows.set(rateKey, window);
        }
        this.resetWindowIfExpired(window);
        if (window.count >= rule.max_per_hour) continue;
      }

      matchedRules.push(rule);
    }

    if (matchedRules.length === 0) {
      return { should_notify: false, suppression_reason: 'no_matching_rules', matched_rules: [], payloads: [] };
    }

    // Resolve target endpoints
    const payloads: ProactiveOutboxPayload[] = [];
    for (const rule of matchedRules) {
      const targetEndpoints = this.resolveEndpoints(rule, event);
      for (const endpoint of targetEndpoints) {
        const idempotencyKey = `proactive:${event.event_id}:${rule.id}:${endpoint.id}`;
        payloads.push(buildOutboxPayload(rule, event.data, endpoint, idempotencyKey));
      }
    }

    if (payloads.length === 0) {
      return { should_notify: false, suppression_reason: 'no_reachable_endpoints', matched_rules: matchedRules, payloads: [] };
    }

    return { should_notify: true, matched_rules: matchedRules, payloads };
  }

  /** Dispatch evaluated notifications through the outbox */
  async dispatch(event: ProactiveEvent, result: EvaluationResult): Promise<void> {
    const { v7: uuidv7 } = await import('uuid');

    for (const payload of result.payloads) {
      const logId = uuidv7();

      try {
        // Insert outbox row
        const outboxId = uuidv7();
        await this.pool.query(
          `INSERT INTO outbox (id, chat_id, channel, channel_chat_id, content_type, text, blocks, idempotency_key, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'blocks', $5, $6, $7, 'pending', NOW(), NOW())
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [outboxId, payload.channel_chat_id, payload.channel, payload.channel_chat_id, payload.text, JSON.stringify(payload.blocks), payload.idempotency_key],
        );

        // Publish NATS outbox event for adapter pickup
        const { JSONCodec } = await import('nats');
        const jc = JSONCodec();
        const envelope = {
          schema_version: '1.0',
          event_id: uuidv7(),
          occurred_at: new Date().toISOString(),
          data: {
            outbox_id: outboxId,
            chat_id: payload.channel_chat_id,
            channel: payload.channel,
            channel_chat_id: payload.channel_chat_id,
            content_type: 'blocks',
            text: payload.text,
            blocks: payload.blocks,
            idempotency_key: payload.idempotency_key,
          },
        };
        this.nc.publish('outbox.enqueue', jc.encode(envelope));

        // Log delivery
        await this.pool.query(
          `INSERT INTO proactive_notification_log (id, rule_id, category, severity, channel, channel_chat_id, title, body, event_data, status, organization_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'delivered', $10, NOW())`,
          [logId, payload.rule_id, event.category, event.severity, payload.channel, payload.channel_chat_id, event.category, payload.text, JSON.stringify(event.data), event.organization_id],
        );

        this.logger.info('Proactive notification dispatched', {
          log_id: logId,
          rule_id: payload.rule_id,
          channel: payload.channel,
          channel_chat_id: payload.channel_chat_id,
        });
      } catch (err) {
        // Log failure but don't crash the engine
        await this.pool.query(
          `INSERT INTO proactive_notification_log (id, rule_id, category, severity, channel, channel_chat_id, title, body, event_data, status, suppression_reason, organization_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'failed', $10, $11, NOW())`,
          [logId, payload.rule_id, event.category, event.severity, payload.channel, payload.channel_chat_id, event.category, payload.text, JSON.stringify(event.data), err instanceof Error ? err.message : String(err), event.organization_id],
        ).catch(() => {});

        this.logger.error('Failed to dispatch proactive notification', {
          log_id: logId,
          rule_id: payload.rule_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Update rate tracking
    const now = Date.now();
    this.lastGlobalFire = now;
    this.resetWindowIfExpired(this.globalRate);
    this.globalRate.count += result.payloads.length;

    for (const rule of result.matched_rules) {
      // Update last_fired_at
      await this.pool.query(
        `UPDATE proactive_trigger_rules SET last_fired_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [rule.id],
      ).catch(() => {});

      // Update per-rule rate
      const rateKey = `rule:${rule.id}`;
      let window = this.rateWindows.get(rateKey);
      if (!window) {
        window = { count: 0, window_start: now };
        this.rateWindows.set(rateKey, window);
      }
      window.count++;
    }
  }

  /** Send a freeform proactive message (Sven-initiated, not rule-triggered) */
  async sendFreeform(opts: {
    text: string;
    severity: NotificationSeverity;
    category: TriggerCategory;
    target_channel_ids?: string[];
    organization_id?: string | null;
  }): Promise<{ dispatched: number; suppressed: boolean; reason?: string }> {
    if (!this.config.enabled) {
      return { dispatched: 0, suppressed: true, reason: 'proactive_notifications_disabled' };
    }
    if (!this.config.allow_freeform_proactive) {
      return { dispatched: 0, suppressed: true, reason: 'freeform_proactive_disabled' };
    }

    const endpoints = opts.target_channel_ids?.length
      ? this.endpoints.filter((e) => opts.target_channel_ids!.includes(e.id))
      : this.endpoints.filter((e) => this.config.default_channel_ids.includes(e.id));

    if (endpoints.length === 0) {
      return { dispatched: 0, suppressed: true, reason: 'no_endpoints_configured' };
    }

    const { v7: uuidv7 } = await import('uuid');
    let dispatched = 0;

    for (const endpoint of endpoints) {
      if (!severityMeetsThreshold(opts.severity, endpoint.min_severity)) continue;

      const outboxId = uuidv7();
      const idempotencyKey = `proactive:freeform:${outboxId}`;
      const blocks = [{ type: 'markdown', content: opts.text }];

      await this.pool.query(
        `INSERT INTO outbox (id, chat_id, channel, channel_chat_id, content_type, text, blocks, idempotency_key, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'blocks', $5, $6, $7, 'pending', NOW(), NOW())`,
        [outboxId, endpoint.channel_chat_id, endpoint.channel, endpoint.channel_chat_id, opts.text, JSON.stringify(blocks), idempotencyKey],
      );

      const { JSONCodec } = await import('nats');
      const jc = JSONCodec();
      const envelope = {
        schema_version: '1.0',
        event_id: uuidv7(),
        occurred_at: new Date().toISOString(),
        data: {
          outbox_id: outboxId,
          chat_id: endpoint.channel_chat_id,
          channel: endpoint.channel,
          channel_chat_id: endpoint.channel_chat_id,
          content_type: 'blocks',
          text: opts.text,
          blocks,
          idempotency_key: idempotencyKey,
        },
      };
      this.nc.publish('outbox.enqueue', jc.encode(envelope));

      const logId = uuidv7();
      await this.pool.query(
        `INSERT INTO proactive_notification_log (id, rule_id, category, severity, channel, channel_chat_id, title, body, event_data, status, organization_id, created_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, 'delivered', $9, NOW())`,
        [logId, opts.category, opts.severity, endpoint.channel, endpoint.channel_chat_id, 'freeform', opts.text, JSON.stringify({}), opts.organization_id ?? null],
      );

      dispatched++;
    }

    return { dispatched, suppressed: false };
  }

  /** Record user feedback on a notification (dismiss, acknowledge, mute rule) */
  async recordFeedback(logId: string, action: 'acknowledged' | 'dismissed' | 'muted_rule'): Promise<void> {
    await this.pool.query(
      `UPDATE proactive_notification_log SET feedback_action = $1, feedback_at = NOW() WHERE id = $2`,
      [action, logId],
    );

    if (action === 'muted_rule' && this.config.adaptive_suppression) {
      const logRow = await this.pool.query(
        `SELECT rule_id FROM proactive_notification_log WHERE id = $1 LIMIT 1`,
        [logId],
      );
      const ruleId = logRow.rows[0]?.rule_id;
      if (ruleId) {
        await this.pool.query(
          `UPDATE proactive_trigger_rules SET enabled = false, updated_at = NOW() WHERE id = $1`,
          [ruleId],
        );
        this.rules = this.rules.filter((r) => r.id !== ruleId);
        this.logger.info('Adaptive suppression: disabled rule via user feedback', { rule_id: ruleId });
      }
    }
  }

  /** Get the current engine config (for admin routes) */
  getConfig(): ProactiveNotificationConfig {
    return { ...this.config };
  }

  /** Get loaded rules (for admin routes) */
  getRules(): TriggerRule[] {
    return [...this.rules];
  }

  /** Get loaded endpoints (for admin routes) */
  getEndpoints(): ChannelEndpoint[] {
    return [...this.endpoints];
  }

  // ── Internal helpers ──

  private resolveEndpoints(rule: TriggerRule, event: ProactiveEvent): ChannelEndpoint[] {
    const candidateIds = rule.target_channels.length > 0
      ? new Set(rule.target_channels)
      : new Set(this.config.default_channel_ids);

    return this.endpoints.filter((ep) => {
      if (!candidateIds.has(ep.id)) return false;
      if (!severityMeetsThreshold(event.severity, ep.min_severity)) return false;
      if (ep.organization_id && ep.organization_id !== event.organization_id) return false;
      return true;
    });
  }

  private resetWindowIfExpired(window: RateWindow): void {
    const now = Date.now();
    const hourMs = 3600_000;
    if (now - window.window_start >= hourMs) {
      window.count = 0;
      window.window_start = now;
    }
  }
}
