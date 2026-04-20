import { FastifyInstance } from 'fastify';
import pg from 'pg';

export async function registerAnalyticsOverviewRoutes(app: FastifyInstance, pool: pg.Pool) {
  // ── GET /analytics/overview — Platform-wide admin analytics ──
  app.get('/analytics/overview', async (request: any, reply) => {
    const orgId: string = request.orgId;
    if (!orgId) return reply.status(403).send({ success: false, error: 'org required' });

    const [
      userStats,
      chatStats,
      messageStats,
      agentStats,
      approvalStats,
      dailyActivity,
    ] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE u.updated_at > NOW() - INTERVAL '7 days')::int AS active_7d,
           COUNT(*) FILTER (WHERE u.updated_at > NOW() - INTERVAL '30 days')::int AS active_30d
         FROM users u
         JOIN organization_memberships m ON m.user_id = u.id
         WHERE m.organization_id = $1 AND m.status = 'active'`,
        [orgId],
      ),
      pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE c.created_at > NOW() - INTERVAL '7 days')::int AS created_7d,
           COUNT(*) FILTER (WHERE c.created_at > NOW() - INTERVAL '30 days')::int AS created_30d
         FROM chats c
         WHERE c.organization_id = $1`,
        [orgId],
      ),
      pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE m.created_at > NOW() - INTERVAL '24 hours')::int AS last_24h,
           COUNT(*) FILTER (WHERE m.created_at > NOW() - INTERVAL '7 days')::int AS last_7d
         FROM messages m
         JOIN chats c ON c.id = m.chat_id
         WHERE c.organization_id = $1`,
        [orgId],
      ),
      pool.query(
        `SELECT
           COUNT(*)::int AS total_runs,
           COUNT(*) FILTER (WHERE tr.status = 'success')::int AS succeeded,
           COUNT(*) FILTER (WHERE tr.status = 'error')::int AS failed,
           COUNT(*) FILTER (WHERE tr.created_at > NOW() - INTERVAL '7 days')::int AS runs_7d
         FROM tool_runs tr
         JOIN chats c ON c.id = tr.chat_id
         WHERE c.organization_id = $1`,
        [orgId],
      ),
      pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE a.status = 'pending')::int AS pending,
           COUNT(*) FILTER (WHERE a.status = 'approved')::int AS approved,
           COUNT(*) FILTER (WHERE a.status = 'rejected')::int AS rejected
         FROM approvals a
         JOIN chats c ON c.id = a.chat_id
         WHERE c.organization_id = $1`,
        [orgId],
      ),
      pool.query(
        `SELECT
           d.day::date AS day,
           COALESCE(msg.count, 0)::int AS messages,
           COALESCE(usr.count, 0)::int AS active_users
         FROM generate_series(
           (NOW() - INTERVAL '14 days')::date,
           NOW()::date,
           '1 day'::interval
         ) AS d(day)
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS count
           FROM messages m
           JOIN chats c ON c.id = m.chat_id
           WHERE c.organization_id = $1
             AND m.created_at >= d.day
             AND m.created_at < d.day + INTERVAL '1 day'
         ) msg ON TRUE
         LEFT JOIN LATERAL (
           SELECT COUNT(DISTINCT m.sender_user_id)::int AS count
           FROM messages m
           JOIN chats c ON c.id = m.chat_id
           WHERE c.organization_id = $1
             AND m.created_at >= d.day
             AND m.created_at < d.day + INTERVAL '1 day'
             AND m.sender_user_id IS NOT NULL
         ) usr ON TRUE
         ORDER BY d.day`,
        [orgId],
      ),
    ]);

    return reply.send({
      success: true,
      data: {
        users: userStats.rows[0] ?? { total: 0, active_7d: 0, active_30d: 0 },
        chats: chatStats.rows[0] ?? { total: 0, created_7d: 0, created_30d: 0 },
        messages: messageStats.rows[0] ?? { total: 0, last_24h: 0, last_7d: 0 },
        agent_runs: agentStats.rows[0] ?? { total_runs: 0, succeeded: 0, failed: 0, runs_7d: 0 },
        approvals: approvalStats.rows[0] ?? { total: 0, pending: 0, approved: 0, rejected: 0 },
        daily_activity: dailyActivity.rows,
      },
    });
  });
}
