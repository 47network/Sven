import type {
  TriggerRule,
  TriggerCategory,
  NotificationSeverity,
  ProactiveNotificationConfig,
  ChannelEndpoint,
  ChannelType,
} from '@sven/proactive-notifier';

type InputPayload = {
  action: string;
  config?: Partial<ProactiveNotificationConfig>;
  rule?: Partial<TriggerRule>;
  endpoint?: Partial<ChannelEndpoint>;
  rule_id?: string;
  endpoint_id?: string;
  log_filter?: {
    category?: TriggerCategory;
    severity?: NotificationSeverity;
    status?: string;
    limit?: number;
    offset?: number;
  };
};

/**
 * Skill handler for proactive notification config management.
 * In production this talks to the gateway admin API.
 * The handler is invoked by the skill runtime with an HTTP client context.
 */
export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  // In production, `ctx.gateway` is injected by the skill runtime and provides
  // HTTP methods to the gateway API. Here we define the contract.
  const gateway = (input as Record<string, unknown>).__gateway as {
    get: (path: string) => Promise<unknown>;
    post: (path: string, body: unknown) => Promise<unknown>;
    put: (path: string, body: unknown) => Promise<unknown>;
    delete: (path: string) => Promise<unknown>;
  } | undefined;

  if (!gateway) {
    throw new Error('Gateway client not available — this skill must run within the Sven skill runtime');
  }

  switch (action) {
    case 'get_config': {
      const result = await gateway.get('/v1/admin/proactive-notifications/config');
      return { action, result };
    }

    case 'update_config': {
      if (!payload.config) throw new Error('config object is required');
      const result = await gateway.put('/v1/admin/proactive-notifications/config', payload.config);
      return { action, result };
    }

    case 'list_rules': {
      const result = await gateway.get('/v1/admin/proactive-notifications/rules');
      return { action, result };
    }

    case 'create_rule': {
      if (!payload.rule) throw new Error('rule object is required');
      const result = await gateway.post('/v1/admin/proactive-notifications/rules', payload.rule);
      return { action, result };
    }

    case 'update_rule': {
      if (!payload.rule_id) throw new Error('rule_id is required');
      if (!payload.rule) throw new Error('rule object is required');
      const result = await gateway.put(`/v1/admin/proactive-notifications/rules/${payload.rule_id}`, payload.rule);
      return { action, result };
    }

    case 'delete_rule': {
      if (!payload.rule_id) throw new Error('rule_id is required');
      const result = await gateway.delete(`/v1/admin/proactive-notifications/rules/${payload.rule_id}`);
      return { action, result };
    }

    case 'list_endpoints': {
      const result = await gateway.get('/v1/admin/proactive-notifications/endpoints');
      return { action, result };
    }

    case 'create_endpoint': {
      if (!payload.endpoint) throw new Error('endpoint object is required');
      const result = await gateway.post('/v1/admin/proactive-notifications/endpoints', payload.endpoint);
      return { action, result };
    }

    case 'update_endpoint': {
      if (!payload.endpoint_id) throw new Error('endpoint_id is required');
      if (!payload.endpoint) throw new Error('endpoint object is required');
      const result = await gateway.put(`/v1/admin/proactive-notifications/endpoints/${payload.endpoint_id}`, payload.endpoint);
      return { action, result };
    }

    case 'delete_endpoint': {
      if (!payload.endpoint_id) throw new Error('endpoint_id is required');
      const result = await gateway.delete(`/v1/admin/proactive-notifications/endpoints/${payload.endpoint_id}`);
      return { action, result };
    }

    case 'list_log': {
      const params = new URLSearchParams();
      if (payload.log_filter?.category) params.set('category', payload.log_filter.category);
      if (payload.log_filter?.severity) params.set('severity', payload.log_filter.severity);
      if (payload.log_filter?.status) params.set('status', payload.log_filter.status);
      params.set('limit', String(payload.log_filter?.limit ?? 50));
      params.set('offset', String(payload.log_filter?.offset ?? 0));
      const result = await gateway.get(`/v1/admin/proactive-notifications/log?${params.toString()}`);
      return { action, result };
    }

    case 'get_stats': {
      const result = await gateway.get('/v1/admin/proactive-notifications/stats');
      return { action, result };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
