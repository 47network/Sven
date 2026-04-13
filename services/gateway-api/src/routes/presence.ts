import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { requireRole } from './auth.js';

export async function registerPresenceRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  // ── Send typing indicator ────────────────────────────────────
  app.post('/v1/chats/:chatId/typing', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        properties: {
          typing: { type: 'boolean' },
        },
      },
    },
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const { chatId } = request.params as { chatId: string };
    const { typing } = (request.body || { typing: true }) as { typing?: boolean };

    // Verify membership
    const memberCheck = await pool.query(
      `SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2`,
      [chatId, userId],
    );
    if (memberCheck.rows.length === 0) {
      return reply.status(403).send({ success: false, error: 'not a member' });
    }

    // Broadcast typing event to chat members via SSE bus
    const members = await pool.query(
      `SELECT user_id FROM chat_members WHERE chat_id = $1 AND user_id != $2`,
      [chatId, userId],
    );

    const typingEvent = {
      type: 'typing',
      chat_id: chatId,
      user_id: userId,
      typing: typing !== false,
      timestamp: new Date().toISOString(),
    };

    if ((app as any).a2uiBus) {
      for (const member of members.rows) {
        (app as any).a2uiBus.emit(`user:${member.user_id}`, typingEvent);
      }
    }

    return reply.status(200).send({ success: true });
  });

  // ── Send read receipt ────────────────────────────────────────
  app.post('/v1/chats/:chatId/read', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['message_id'],
        properties: {
          message_id: { type: 'string' },
        },
      },
    },
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const { chatId } = request.params as { chatId: string };
    const { message_id } = request.body as { message_id: string };

    // Upsert read receipt (only advance forward, never backward)
    await pool.query(
      `INSERT INTO read_receipts (user_id, chat_id, last_read_message_id, last_read_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, chat_id) DO UPDATE SET
         last_read_message_id = EXCLUDED.last_read_message_id,
         last_read_at = EXCLUDED.last_read_at
       WHERE read_receipts.last_read_at < EXCLUDED.last_read_at`,
      [userId, chatId, message_id],
    );

    // Broadcast read receipt to chat members
    const members = await pool.query(
      `SELECT user_id FROM chat_members WHERE chat_id = $1 AND user_id != $2`,
      [chatId, userId],
    );

    const readEvent = {
      type: 'read_receipt',
      chat_id: chatId,
      user_id: userId,
      message_id,
      timestamp: new Date().toISOString(),
    };

    if ((app as any).a2uiBus) {
      for (const member of members.rows) {
        (app as any).a2uiBus.emit(`user:${member.user_id}`, readEvent);
      }
    }

    return reply.status(200).send({ success: true });
  });

  // ── Get read receipts for a chat ─────────────────────────────
  app.get('/v1/chats/:chatId/read-receipts', {
    preHandler: requireAuth,
  }, async (request: any, reply) => {
    const { chatId } = request.params as { chatId: string };

    const { rows } = await pool.query(
      `SELECT rr.user_id, rr.last_read_message_id, rr.last_read_at, u.display_name
       FROM read_receipts rr JOIN users u ON u.id = rr.user_id
       WHERE rr.chat_id = $1`,
      [chatId],
    );

    return reply.status(200).send({ success: true, data: { receipts: rows } });
  });

  // ── Get unread counts ────────────────────────────────────────
  app.get('/v1/chats/unread', {
    preHandler: requireAuth,
  }, async (request: any, reply) => {
    const userId: string = request.userId;

    const { rows } = await pool.query(
      `SELECT cm.chat_id, unread_count($1, cm.chat_id) AS count
       FROM chat_members cm WHERE cm.user_id = $1`,
      [userId],
    );

    const counts: Record<string, number> = {};
    for (const row of rows) {
      if (row.count > 0) counts[row.chat_id] = row.count;
    }

    return reply.status(200).send({ success: true, data: { unread: counts } });
  });

  // ── Update presence status ───────────────────────────────────
  app.put('/v1/presence', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['online', 'away', 'dnd', 'offline'] },
          status_message: { type: 'string', maxLength: 140 },
        },
      },
    },
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const { status, status_message } = request.body as { status?: string; status_message?: string };

    await pool.query(
      `INSERT INTO user_presence (user_id, status, status_message, last_active_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         status = COALESCE($2, user_presence.status),
         status_message = COALESCE($3, user_presence.status_message),
         last_active_at = NOW(),
         updated_at = NOW()`,
      [userId, status || 'online', status_message ?? null],
    );

    return reply.status(200).send({ success: true });
  });

  // ── Get presence for users ───────────────────────────────────
  app.post('/v1/presence/query', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['user_ids'],
        properties: {
          user_ids: { type: 'array', items: { type: 'string' }, maxItems: 100 },
        },
      },
    },
  }, async (request: any, reply) => {
    const { user_ids } = request.body as { user_ids: string[] };

    const { rows } = await pool.query(
      `SELECT user_id, status, status_message, last_active_at
       FROM user_presence WHERE user_id = ANY($1)`,
      [user_ids],
    );

    const presence: Record<string, any> = {};
    for (const row of rows) {
      // Auto-mark as away if inactive > 5 minutes
      const lastActive = new Date(row.last_active_at).getTime();
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      const effectiveStatus = (row.status === 'online' && lastActive < fiveMinAgo)
        ? 'away' : row.status;

      presence[row.user_id] = {
        status: effectiveStatus,
        status_message: row.status_message,
        last_active_at: row.last_active_at,
      };
    }

    return reply.status(200).send({ success: true, data: { presence } });
  });
}
