import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { requireRole } from './auth.js';

export async function registerPushRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  app.post('/v1/push/register', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['token', 'platform'],
        additionalProperties: false,
        properties: {
          token: { type: 'string', minLength: 1 },
          platform: { type: 'string', enum: ['android', 'ios', 'web', 'unified_push'] },
          device_id: { type: 'string' },
        },
      },
    },
  }, async (request: any, reply) => {
    const body = (request.body || {}) as { token?: string; platform?: string; device_id?: string };
    const token = String(body.token || '').trim();
    const platform = String(body.platform || '').trim();
    const deviceId = body.device_id ? String(body.device_id).trim() : null;
    if (!token || !platform) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'token and platform are required' },
      });
    }

    await pool.query(
      `INSERT INTO mobile_push_tokens (id, user_id, platform, token, device_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (user_id, token) DO UPDATE
       SET platform = EXCLUDED.platform,
           device_id = EXCLUDED.device_id,
           updated_at = NOW()`,
      [uuidv7(), request.userId, platform, token, deviceId],
    );

    reply.send({ success: true });
  });

  app.post('/v1/push/unregister', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['token'],
        additionalProperties: false,
        properties: {
          token: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request: any, reply) => {
    const body = (request.body || {}) as { token?: string };
    const token = String(body.token || '').trim();
    if (!token) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'token is required' },
      });
    }
    await pool.query(
      `DELETE FROM mobile_push_tokens WHERE user_id = $1 AND token = $2`,
      [request.userId, token],
    );
    reply.send({ success: true });
  });

  app.get('/v1/push/vapid-public-key', { preHandler: requireAuth }, async (_request, reply) => {
    const publicKey = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '').trim();
    if (!publicKey) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_CONFIGURED', message: 'VAPID public key is not configured' },
      });
    }
    reply.send({ publicKey });
  });

  // ── Privacy-first push: fetch pending notifications ──────────────────
  // Clients receive only a content-free wake-up via FCM/APNs/UnifiedPush.
  // They call this endpoint to fetch the actual notification payload
  // directly from the Sven server — Google and Apple never see the content.

  app.get('/v1/push/pending', {
    preHandler: requireAuth,
  }, async (request: any, reply) => {
    const res = await pool.query(
      `SELECT id, title, body, channel, data, priority, created_at
       FROM push_pending
       WHERE user_id = $1 AND NOT fetched AND expires_at > NOW()
       ORDER BY created_at ASC
       LIMIT 50`,
      [request.userId],
    );

    reply.send({
      success: true,
      notifications: res.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        channel: row.channel,
        data: row.data,
        priority: row.priority,
        created_at: row.created_at,
      })),
    });
  });

  app.post('/v1/push/ack', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['ids'],
        additionalProperties: false,
        properties: {
          ids: { type: 'array', items: { type: 'string' }, maxItems: 100 },
        },
      },
    },
  }, async (request: any, reply) => {
    const body = (request.body || {}) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === 'string' && id.trim()) : [];
    if (ids.length === 0) {
      return reply.send({ success: true, acknowledged: 0 });
    }
    const res = await pool.query(
      `UPDATE push_pending SET fetched = TRUE WHERE user_id = $1 AND id = ANY($2::text[])`,
      [request.userId, ids],
    );
    reply.send({ success: true, acknowledged: res.rowCount ?? 0 });
  });
}
