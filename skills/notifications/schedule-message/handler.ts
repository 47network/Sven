type InputPayload = {
  action: 'schedule' | 'list' | 'cancel';
  title?: string;
  body?: string;
  scheduled_at?: string;
  message_id?: string;
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  const gateway = (input as Record<string, unknown>).__gateway as {
    post: (path: string, body: unknown) => Promise<unknown>;
    get: (path: string) => Promise<unknown>;
    delete: (path: string) => Promise<unknown>;
  } | undefined;

  if (!gateway) {
    throw new Error('Gateway client not available — this skill must run within the Sven skill runtime');
  }

  switch (action) {
    case 'schedule': {
      if (!payload.body) throw new Error('body is required for schedule action');
      if (!payload.scheduled_at) throw new Error('scheduled_at is required for schedule action');
      const result = await gateway.post('/v1/messages/schedule', {
        title: payload.title ?? 'Message from Sven',
        body: payload.body,
        scheduled_at: payload.scheduled_at,
      });
      return { action, result };
    }

    case 'list': {
      const result = await gateway.get('/v1/messages/scheduled');
      return { action, result };
    }

    case 'cancel': {
      if (!payload.message_id) throw new Error('message_id is required for cancel action');
      const result = await gateway.delete(`/v1/messages/scheduled/${payload.message_id}`);
      return { action, result };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
