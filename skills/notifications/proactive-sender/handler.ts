import type { NotificationSeverity, TriggerCategory } from '@sven/proactive-notifier';

type InputPayload = {
  action: 'send_message' | 'send_alert' | 'send_question' | 'send_progress' | 'record_feedback';
  text?: string;
  severity?: NotificationSeverity;
  category?: TriggerCategory;
  target_channel_ids?: string[];
  log_id?: string;
  feedback_action?: 'acknowledged' | 'dismissed' | 'muted_rule';
};

const SEVERITY_BANNERS: Record<NotificationSeverity, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '🚨',
  critical: '🔴 CRITICAL',
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  const gateway = (input as Record<string, unknown>).__gateway as {
    post: (path: string, body: unknown) => Promise<unknown>;
  } | undefined;

  if (!gateway) {
    throw new Error('Gateway client not available — this skill must run within the Sven skill runtime');
  }

  switch (action) {
    case 'send_message': {
      if (!payload.text) throw new Error('text is required');
      const result = await gateway.post('/v1/admin/proactive-notifications/send', {
        text: payload.text,
        severity: payload.severity ?? 'info',
        category: payload.category ?? 'custom',
        target_channel_ids: payload.target_channel_ids,
      });
      return { action, result };
    }

    case 'send_alert': {
      if (!payload.text) throw new Error('text is required');
      const severity = payload.severity ?? 'error';
      const banner = SEVERITY_BANNERS[severity];
      const formattedText = `${banner} **Alert** (${severity})\n\n${payload.text}`;
      const result = await gateway.post('/v1/admin/proactive-notifications/send', {
        text: formattedText,
        severity,
        category: payload.category ?? 'critical_error',
        target_channel_ids: payload.target_channel_ids,
      });
      return { action, result };
    }

    case 'send_question': {
      if (!payload.text) throw new Error('text is required');
      const formattedText = `❓ **Sven has a question**\n\n${payload.text}\n\n_Reply in this channel to respond._`;
      const result = await gateway.post('/v1/admin/proactive-notifications/send', {
        text: formattedText,
        severity: payload.severity ?? 'info',
        category: payload.category ?? 'custom',
        target_channel_ids: payload.target_channel_ids,
      });
      return { action, result };
    }

    case 'send_progress': {
      if (!payload.text) throw new Error('text is required');
      const formattedText = `📊 **Progress Update**\n\n${payload.text}`;
      const result = await gateway.post('/v1/admin/proactive-notifications/send', {
        text: formattedText,
        severity: payload.severity ?? 'info',
        category: payload.category ?? 'task_completed',
        target_channel_ids: payload.target_channel_ids,
      });
      return { action, result };
    }

    case 'record_feedback': {
      if (!payload.log_id) throw new Error('log_id is required');
      if (!payload.feedback_action) throw new Error('feedback_action is required');
      const result = await gateway.post(`/v1/admin/proactive-notifications/log/${payload.log_id}/feedback`, {
        action: payload.feedback_action,
      });
      return { action, result };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
