import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { requireRole } from './auth.js';

export async function registerE2eeRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  // ── Upload device keys ───────────────────────────────────────
  app.post('/v1/e2ee/keys/upload', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['device_id', 'identity_key', 'signing_key'],
        additionalProperties: false,
        properties: {
          device_id: { type: 'string', minLength: 1, maxLength: 64 },
          device_name: { type: 'string', maxLength: 128 },
          identity_key: { type: 'string', minLength: 1 },
          signing_key: { type: 'string', minLength: 1 },
          one_time_keys: {
            type: 'array',
            maxItems: 100,
            items: {
              type: 'object',
              required: ['key_id', 'key_data'],
              properties: {
                key_id: { type: 'string' },
                key_data: { type: 'string' },
                signature: { type: 'string' },
              },
            },
          },
          fallback_key: {
            type: 'object',
            properties: {
              key_id: { type: 'string' },
              key_data: { type: 'string' },
              signature: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const {
      device_id,
      device_name,
      identity_key,
      signing_key,
      one_time_keys,
      fallback_key,
    } = request.body as any;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Upsert device keys
      await client.query(
        `INSERT INTO e2ee_device_keys (device_id, user_id, identity_key, signing_key, device_name, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, device_id) DO UPDATE SET
           identity_key = EXCLUDED.identity_key,
           signing_key = EXCLUDED.signing_key,
           device_name = COALESCE(EXCLUDED.device_name, e2ee_device_keys.device_name),
           last_seen_at = NOW()`,
        [device_id, userId, identity_key, signing_key, device_name || ''],
      );

      // Upload one-time keys
      if (Array.isArray(one_time_keys) && one_time_keys.length > 0) {
        for (const otk of one_time_keys) {
          await client.query(
            `INSERT INTO e2ee_one_time_keys (user_id, device_id, key_id, key_data, signature)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, device_id, key_id) DO NOTHING`,
            [userId, device_id, otk.key_id, otk.key_data, otk.signature || null],
          );
        }
      }

      // Upload fallback key
      if (fallback_key) {
        await client.query(
          `INSERT INTO e2ee_fallback_keys (user_id, device_id, key_id, key_data, signature)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, device_id, algorithm) DO UPDATE SET
             key_id = EXCLUDED.key_id,
             key_data = EXCLUDED.key_data,
             signature = EXCLUDED.signature`,
          [userId, device_id, fallback_key.key_id, fallback_key.key_data, fallback_key.signature || null],
        );
      }

      await client.query('COMMIT');

      // Return remaining OTK count
      const otkCount = await pool.query(
        `SELECT COUNT(*)::int AS count FROM e2ee_one_time_keys
         WHERE user_id = $1 AND device_id = $2 AND NOT claimed`,
        [userId, device_id],
      );

      return reply.status(200).send({
        success: true,
        data: {
          one_time_key_counts: {
            signed_curve25519: otkCount.rows[0]?.count ?? 0,
          },
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ── Query device keys for users ──────────────────────────────
  app.post('/v1/e2ee/keys/query', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['user_ids'],
        properties: {
          user_ids: { type: 'array', items: { type: 'string' }, maxItems: 50 },
        },
      },
    },
  }, async (request: any, reply) => {
    const { user_ids } = request.body as { user_ids: string[] };

    const { rows } = await pool.query(
      `SELECT user_id, device_id, identity_key, signing_key, device_name, algorithms, verified, last_seen_at
       FROM e2ee_device_keys WHERE user_id = ANY($1) ORDER BY user_id, device_id`,
      [user_ids],
    );

    // Group by user_id
    const deviceKeys: Record<string, any[]> = {};
    for (const row of rows) {
      if (!deviceKeys[row.user_id]) deviceKeys[row.user_id] = [];
      deviceKeys[row.user_id].push({
        device_id: row.device_id,
        identity_key: row.identity_key,
        signing_key: row.signing_key,
        device_name: row.device_name,
        algorithms: row.algorithms,
        verified: row.verified,
        last_seen_at: row.last_seen_at,
      });
    }

    return reply.status(200).send({ success: true, data: { device_keys: deviceKeys } });
  });

  // ── Claim one-time keys for session setup ────────────────────
  app.post('/v1/e2ee/keys/claim', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['claims'],
        properties: {
          claims: {
            type: 'array',
            maxItems: 50,
            items: {
              type: 'object',
              required: ['user_id', 'device_id'],
              properties: {
                user_id: { type: 'string' },
                device_id: { type: 'string' },
                algorithm: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request: any, reply) => {
    const claimerId: string = request.userId;
    const { claims } = request.body as { claims: Array<{ user_id: string; device_id: string; algorithm?: string }> };

    const results: Record<string, any> = {};
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const claim of claims) {
        const key = `${claim.user_id}:${claim.device_id}`;

        // Try to claim an OTK (atomic: SELECT FOR UPDATE + UPDATE)
        const { rows: otkRows } = await client.query(
          `UPDATE e2ee_one_time_keys SET claimed = TRUE, claimed_by_user = $3, claimed_at = NOW()
           WHERE id = (
             SELECT id FROM e2ee_one_time_keys
             WHERE user_id = $1 AND device_id = $2 AND NOT claimed
             ORDER BY created_at ASC LIMIT 1
             FOR UPDATE SKIP LOCKED
           )
           RETURNING key_id, key_data, signature, algorithm`,
          [claim.user_id, claim.device_id, claimerId],
        );

        if (otkRows.length > 0) {
          results[key] = {
            algorithm: otkRows[0].algorithm,
            key_id: otkRows[0].key_id,
            key_data: otkRows[0].key_data,
            signature: otkRows[0].signature,
          };
        } else {
          // Fall back to fallback key
          const { rows: fbRows } = await client.query(
            `SELECT key_id, key_data, signature, algorithm FROM e2ee_fallback_keys
             WHERE user_id = $1 AND device_id = $2 LIMIT 1`,
            [claim.user_id, claim.device_id],
          );
          if (fbRows.length > 0) {
            results[key] = {
              algorithm: fbRows[0].algorithm,
              key_id: fbRows[0].key_id,
              key_data: fbRows[0].key_data,
              signature: fbRows[0].signature,
              fallback: true,
            };
          }
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return reply.status(200).send({ success: true, data: { one_time_keys: results } });
  });

  // ── Upload cross-signing keys ────────────────────────────────
  app.post('/v1/e2ee/keys/cross-signing', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['keys'],
        properties: {
          keys: {
            type: 'array',
            items: {
              type: 'object',
              required: ['key_type', 'key_data'],
              properties: {
                key_type: { type: 'string', enum: ['master', 'self_signing', 'user_signing'] },
                key_data: { type: 'string' },
                signatures: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const { keys } = request.body as any;

    for (const key of keys) {
      await pool.query(
        `INSERT INTO e2ee_cross_signing_keys (user_id, key_type, key_data, signatures)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, key_type) DO UPDATE SET
           key_data = EXCLUDED.key_data,
           signatures = EXCLUDED.signatures,
           created_at = NOW()`,
        [userId, key.key_type, key.key_data, JSON.stringify(key.signatures || {})],
      );
    }

    return reply.status(200).send({ success: true });
  });

  // ── Verify a device ──────────────────────────────────────────
  app.post('/v1/e2ee/keys/verify', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['user_id', 'device_id'],
        properties: {
          user_id: { type: 'string' },
          device_id: { type: 'string' },
          verified: { type: 'boolean' },
        },
      },
    },
  }, async (request: any, reply) => {
    const { user_id, device_id, verified } = request.body as any;

    await pool.query(
      `UPDATE e2ee_device_keys SET verified = $3 WHERE user_id = $1 AND device_id = $2`,
      [user_id, device_id, verified !== false],
    );

    return reply.status(200).send({ success: true });
  });

  // ── OTK count ────────────────────────────────────────────────
  app.get('/v1/e2ee/keys/count', {
    preHandler: requireAuth,
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const deviceId = (request.query as any)?.device_id;

    if (!deviceId) {
      return reply.status(400).send({ success: false, error: 'device_id query param required' });
    }

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM e2ee_one_time_keys
       WHERE user_id = $1 AND device_id = $2 AND NOT claimed`,
      [userId, deviceId],
    );

    return reply.status(200).send({
      success: true,
      data: { signed_curve25519: rows[0]?.count ?? 0 },
    });
  });

  // ── Room key backup ──────────────────────────────────────────
  app.put('/v1/e2ee/room-keys', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        required: ['version', 'auth_data', 'session_data'],
        properties: {
          version: { type: 'integer', minimum: 1 },
          auth_data: { type: 'object' },
          session_data: { type: 'object' },
        },
      },
    },
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const { version, auth_data, session_data } = request.body as any;

    await pool.query(
      `INSERT INTO e2ee_key_backup (user_id, version, auth_data, session_data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, version) DO UPDATE SET
         auth_data = EXCLUDED.auth_data,
         session_data = EXCLUDED.session_data`,
      [userId, version, JSON.stringify(auth_data), JSON.stringify(session_data)],
    );

    return reply.status(200).send({ success: true });
  });

  app.get('/v1/e2ee/room-keys', {
    preHandler: requireAuth,
  }, async (request: any, reply) => {
    const userId: string = request.userId;
    const version = parseInt(String((request.query as any)?.version || '0'), 10);

    const { rows } = await pool.query(
      version > 0
        ? `SELECT version, auth_data, session_data FROM e2ee_key_backup WHERE user_id = $1 AND version = $2`
        : `SELECT version, auth_data, session_data FROM e2ee_key_backup WHERE user_id = $1 ORDER BY version DESC LIMIT 1`,
      version > 0 ? [userId, version] : [userId],
    );

    if (rows.length === 0) {
      return reply.status(404).send({ success: false, error: 'no backup found' });
    }

    return reply.status(200).send({ success: true, data: rows[0] });
  });
}
