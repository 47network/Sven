import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { requireRole } from './auth.js';

export async function registerSearchRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  // ── Full-text message search ─────────────────────────────────
  app.post('/v1/search/messages', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['query'],
        additionalProperties: false,
        properties: {
          query: { type: 'string', minLength: 1, maxLength: 500 },
          chat_id: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
          offset: { type: 'integer', minimum: 0 },
          before: { type: 'string', format: 'date-time' },
          after: { type: 'string', format: 'date-time' },
          sender_user_id: { type: 'string' },
          content_type: { type: 'string', enum: ['text', 'file', 'audio', 'image', 'video'] },
        },
      },
    },
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const body = request.body as {
      query: string;
      chat_id?: string;
      limit?: number;
      offset?: number;
      before?: string;
      after?: string;
      sender_user_id?: string;
      content_type?: string;
    };

    const limit = Math.min(body.limit || 20, 50);
    const offset = body.offset || 0;

    // Build tsquery from user input — sanitise for safety
    const tsQuery = body.query
      .replace(/[^\w\s-]/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(' & ');

    if (!tsQuery) {
      return reply.status(400).send({ success: false, error: 'invalid search query' });
    }

    // Only search chats the user is a member of
    let sql = `
      SELECT m.id, m.chat_id, m.text, m.role, m.content_type, m.created_at,
             m.sender_user_id, u.display_name AS sender_name,
             c.name AS chat_name,
             ts_rank(m.search_tsv, to_tsquery('english', $1)) AS rank,
             ts_headline('english', m.text, to_tsquery('english', $1),
               'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=20'
             ) AS highlight
      FROM messages m
      JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = $2
      JOIN chats c ON c.id = m.chat_id
      LEFT JOIN users u ON u.id = m.sender_user_id
      WHERE m.search_tsv @@ to_tsquery('english', $1)
        AND m.encrypted = FALSE
    `;
    const params: any[] = [tsQuery, userId];
    let paramIdx = 2;

    if (body.chat_id) {
      paramIdx++;
      sql += ` AND m.chat_id = $${paramIdx}`;
      params.push(body.chat_id);
    }
    if (body.before) {
      paramIdx++;
      sql += ` AND m.created_at < $${paramIdx}`;
      params.push(body.before);
    }
    if (body.after) {
      paramIdx++;
      sql += ` AND m.created_at > $${paramIdx}`;
      params.push(body.after);
    }
    if (body.sender_user_id) {
      paramIdx++;
      sql += ` AND m.sender_user_id = $${paramIdx}`;
      params.push(body.sender_user_id);
    }
    if (body.content_type) {
      paramIdx++;
      sql += ` AND m.content_type = $${paramIdx}`;
      params.push(body.content_type);
    }

    // Count total
    const countSql = `SELECT COUNT(*)::int AS total FROM (${sql}) sub`;

    sql += ` ORDER BY rank DESC, m.created_at DESC`;
    paramIdx++;
    sql += ` LIMIT $${paramIdx}`;
    params.push(limit);
    paramIdx++;
    sql += ` OFFSET $${paramIdx}`;
    params.push(offset);

    const [results, countResult] = await Promise.all([
      pool.query(sql, params),
      pool.query(countSql, params.slice(0, -2)), // without limit/offset
    ]);

    return reply.status(200).send({
      success: true,
      data: {
        results: results.rows,
        total: countResult.rows[0]?.total ?? 0,
        limit,
        offset,
        query: body.query,
      },
    });
  });

  // ── Semantic search (pgvector) ───────────────────────────────
  app.post('/v1/search/semantic', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['embedding'],
        properties: {
          embedding: { type: 'array', items: { type: 'number' }, minItems: 1536, maxItems: 1536 },
          chat_id: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
          threshold: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const body = request.body as {
      embedding: number[];
      chat_id?: string;
      limit?: number;
      threshold?: number;
    };

    const limit = Math.min(body.limit || 10, 50);
    const threshold = body.threshold ?? 0.7;
    const embeddingStr = `[${body.embedding.join(',')}]`;

    let sql = `
      SELECT m.id, m.chat_id, m.text, m.role, m.content_type, m.created_at,
             m.sender_user_id, u.display_name AS sender_name,
             c.name AS chat_name,
             1 - (m.search_embedding <=> $1::vector) AS similarity
      FROM messages m
      JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = $2
      JOIN chats c ON c.id = m.chat_id
      LEFT JOIN users u ON u.id = m.sender_user_id
      WHERE m.search_embedding IS NOT NULL
        AND m.encrypted = FALSE
        AND 1 - (m.search_embedding <=> $1::vector) >= $3
    `;
    const params: any[] = [embeddingStr, userId, threshold];
    let paramIdx = 3;

    if (body.chat_id) {
      paramIdx++;
      sql += ` AND m.chat_id = $${paramIdx}`;
      params.push(body.chat_id);
    }

    sql += ` ORDER BY m.search_embedding <=> $1::vector ASC`;
    paramIdx++;
    sql += ` LIMIT $${paramIdx}`;
    params.push(limit);

    const { rows } = await pool.query(sql, params);

    return reply.status(200).send({
      success: true,
      data: { results: rows, limit },
    });
  });

  // ── Unified search (combines full-text + semantic) ───────────
  app.post('/v1/search/unified', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1, maxLength: 500 },
          chat_id: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
          scopes: {
            type: 'array',
            items: { type: 'string', enum: ['messages', 'files', 'contacts'] },
          },
        },
      },
    },
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const body = request.body as {
      query: string;
      chat_id?: string;
      limit?: number;
      scopes?: string[];
    };

    const limit = Math.min(body.limit || 20, 50);
    const scopes = body.scopes || ['messages', 'files'];
    const results: any = {};

    // Full-text message search
    if (scopes.includes('messages')) {
      const tsQuery = body.query
        .replace(/[^\w\s-]/g, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .join(' & ');

      if (tsQuery) {
        const params: any[] = [tsQuery, userId];
        let sql = `
          SELECT m.id, m.chat_id, m.text, m.role, m.created_at, c.name AS chat_name,
                 ts_rank(m.search_tsv, to_tsquery('english', $1)) AS rank
          FROM messages m
          JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = $2
          JOIN chats c ON c.id = m.chat_id
          WHERE m.search_tsv @@ to_tsquery('english', $1) AND m.encrypted = FALSE
        `;
        if (body.chat_id) {
          params.push(body.chat_id);
          sql += ` AND m.chat_id = $${params.length}`;
        }
        sql += ` ORDER BY rank DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const { rows } = await pool.query(sql, params);
        results.messages = rows;
      }
    }

    // File search
    if (scopes.includes('files')) {
      const pattern = `%${body.query.replace(/[%_]/g, '')}%`;
      const params: any[] = [pattern, userId];
      let sql = `
        SELECT mu.id, mu.file_name, mu.mime_type, mu.size_bytes, mu.chat_id, mu.created_at
        FROM media_uploads mu
        JOIN chat_members cm ON cm.chat_id = mu.chat_id AND cm.user_id = $2
        WHERE mu.file_name ILIKE $1 AND mu.processing_status = 'ready'
      `;
      if (body.chat_id) {
        params.push(body.chat_id);
        sql += ` AND mu.chat_id = $${params.length}`;
      }
      sql += ` ORDER BY mu.created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const { rows } = await pool.query(sql, params);
      results.files = rows;
    }

    // Contact search
    if (scopes.includes('contacts')) {
      const pattern = `%${body.query.replace(/[%_]/g, '')}%`;
      const { rows } = await pool.query(
        `SELECT u.id, u.username, u.display_name
         FROM users u WHERE (u.username ILIKE $1 OR u.display_name ILIKE $1) LIMIT $2`,
        [pattern, limit],
      );
      results.contacts = rows;
    }

    return reply.status(200).send({ success: true, data: results });
  });
}
