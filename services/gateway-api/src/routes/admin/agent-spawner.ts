// ---------------------------------------------------------------------------
// Agent Spawner — one-shot agent provisioning (profile + automaton + treasury
// + listing) for the autonomous economy.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { NatsConnection } from 'nats';
import { createLogger } from '@sven/shared';

const logger = createLogger('agent-spawner');

const VALID_ARCHETYPES = [
  'seller', 'translator', 'writer', 'scout', 'analyst', 'operator',
  'accountant', 'marketer', 'researcher', 'legal', 'designer',
  'support', 'strategist', 'recruiter', 'custom',
] as const;

type SpawnArchetype = (typeof VALID_ARCHETYPES)[number];

interface SpawnRequest {
  displayName: string;
  archetype: SpawnArchetype;
  bio?: string;
  specializations?: string[];
  personalityMode?: string;
  listingTitle?: string;
  listingPrice?: number;
  metadata?: Record<string, unknown>;
}

const ARCHETYPE_LISTING_DEFAULTS: Record<string, {
  kind: string; pricingModel: string; price: number; title: (name: string) => string;
}> = {
  translator: { kind: 'service', pricingModel: 'per_call', price: 0.02, title: (n) => `${n} — Translation Service` },
  writer:     { kind: 'digital_good', pricingModel: 'one_time', price: 4.99, title: (n) => `${n} — Written Content` },
  designer:   { kind: 'service', pricingModel: 'per_call', price: 0.05, title: (n) => `${n} — Design Service` },
  researcher: { kind: 'service', pricingModel: 'per_call', price: 0.03, title: (n) => `${n} — Research Service` },
  support:    { kind: 'service', pricingModel: 'per_call', price: 0.01, title: (n) => `${n} — Support Service` },
  marketer:   { kind: 'service', pricingModel: 'per_call', price: 0.03, title: (n) => `${n} — Marketing Service` },
  legal:      { kind: 'service', pricingModel: 'per_call', price: 0.05, title: (n) => `${n} — Legal Review` },
  seller:     { kind: 'skill_api', pricingModel: 'per_call', price: 0.01, title: (n) => `${n} — API Service` },
  scout:      { kind: 'service', pricingModel: 'per_call', price: 0.02, title: (n) => `${n} — Scout Intel` },
  analyst:    { kind: 'service', pricingModel: 'per_call', price: 0.03, title: (n) => `${n} — Analysis Report` },
  operator:   { kind: 'service', pricingModel: 'per_call', price: 0.04, title: (n) => `${n} — Ops Service` },
  accountant: { kind: 'service', pricingModel: 'per_call', price: 0.03, title: (n) => `${n} — Financial Audit` },
  strategist: { kind: 'service', pricingModel: 'per_call', price: 0.05, title: (n) => `${n} — Strategy Plan` },
  recruiter:  { kind: 'service', pricingModel: 'per_call', price: 0.02, title: (n) => `${n} — Agent Recruitment` },
  custom:     { kind: 'skill_api', pricingModel: 'per_call', price: 0.01, title: (n) => `${n} — Custom Service` },
};

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function publishNats(nc: NatsConnection | null, subject: string, payload: Record<string, unknown>): void {
  if (!nc) return;
  try { nc.publish(subject, Buffer.from(JSON.stringify(payload))); }
  catch (err) { logger.warn('NATS publish failed', { subject, err: (err as Error).message }); }
}

export function registerAgentSpawnerRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc?: NatsConnection | null,
) {
  const natsConn = nc ?? null;

  // POST /v1/admin/agents/spawn — one-shot agent creation
  app.post('/agents/spawn', async (req, reply) => {
    const body = req.body as Partial<SpawnRequest>;
    if (!body.displayName?.trim()) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_NAME', message: 'displayName required' } });
    }
    if (!body.archetype || !VALID_ARCHETYPES.includes(body.archetype)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ARCHETYPE', message: `archetype must be one of: ${VALID_ARCHETYPES.join(', ')}` } });
    }

    const orgId = (req as any).orgId ?? 'default';
    const agentId = newId('agent');
    const profileId = newId('ap');
    const automatonId = newId('auto');
    const treasuryAccountId = newId('ta');
    const listingId = newId('lst');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Create treasury account
      await client.query(
        `INSERT INTO treasury_accounts (id, org_id, label, currency, metadata)
         VALUES ($1, $2, $3, 'USD', $4::jsonb)`,
        [treasuryAccountId, orgId, `${body.displayName} Treasury`, JSON.stringify({ agentId, archetype: body.archetype })],
      );

      // 2. Create agent profile
      await client.query(
        `INSERT INTO agent_profiles
           (id, agent_id, org_id, display_name, bio, archetype, specializations,
            personality_mode, metadata, payout_account_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10)`,
        [
          profileId, agentId, orgId, body.displayName.trim(),
          body.bio ?? null, body.archetype,
          JSON.stringify(body.specializations ?? []),
          body.personalityMode ?? 'professional',
          JSON.stringify(body.metadata ?? {}),
          treasuryAccountId,
        ],
      );

      // 3. Create automaton record
      const autoMeta = {
        agentId, agentArchetype: body.archetype,
        treasuryAccountId, profileId,
      };
      await client.query(
        `INSERT INTO automatons (id, org_id, status, metadata)
         VALUES ($1, $2, 'born', $3::jsonb)`,
        [automatonId, orgId, JSON.stringify(autoMeta)],
      );

      // 4. Create seed marketplace listing
      const defaults = ARCHETYPE_LISTING_DEFAULTS[body.archetype] ?? ARCHETYPE_LISTING_DEFAULTS.custom;
      const listingTitle = body.listingTitle?.trim() || defaults.title(body.displayName.trim());
      const listingPrice = body.listingPrice ?? defaults.price;
      const slug = listingTitle.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').slice(0, 80) || `agent-${Date.now()}`;

      await client.query(
        `INSERT INTO marketplace_listings
           (id, org_id, seller_agent_id, slug, title, description, kind,
            pricing_model, unit_price, currency, payout_account_id, metadata, status, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'USD',$10,$11::jsonb,'published',NOW())`,
        [
          listingId, orgId, agentId, slug, listingTitle,
          `Autonomous ${body.archetype} service by ${body.displayName.trim()}`,
          defaults.kind, defaults.pricingModel, listingPrice,
          treasuryAccountId,
          JSON.stringify({ agentArchetype: body.archetype, autoSpawned: true }),
        ],
      );

      await client.query('COMMIT');

      logger.info('Agent spawned', { agentId, archetype: body.archetype, automatonId, listingId });

      publishNats(natsConn, 'sven.agent.spawned', {
        agentId, automatonId, archetype: body.archetype,
        displayName: body.displayName.trim(), profileId,
        treasuryAccountId, listingId,
      });

      return reply.status(201).send({
        success: true,
        data: {
          agentId,
          profileId,
          automatonId,
          treasuryAccountId,
          listingId,
          archetype: body.archetype,
          displayName: body.displayName.trim(),
        },
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Agent spawn failed', { err: msg });

      // Handle duplicate agent name
      if (msg.includes('23505') || msg.includes('unique')) {
        return reply.status(409).send({ success: false, error: { code: 'DUPLICATE', message: 'Agent with that name already exists' } });
      }
      return reply.status(500).send({ success: false, error: { code: 'SPAWN_FAILED', message: msg } });
    } finally {
      client.release();
    }
  });

  // GET /v1/admin/agents/spawn/defaults — archetype listing defaults
  app.get('/agents/spawn/defaults', async (_req, reply) => {
    return reply.send({
      success: true,
      data: {
        archetypes: VALID_ARCHETYPES,
        listingDefaults: ARCHETYPE_LISTING_DEFAULTS,
      },
    });
  });
}
