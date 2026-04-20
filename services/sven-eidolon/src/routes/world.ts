// ---------------------------------------------------------------------------
// Eidolon — Simulation routes
// ---------------------------------------------------------------------------
// Surfaces:
//   GET  /v1/eidolon/world/states         — agent runtime states
//   GET  /v1/eidolon/world/interactions   — recent interactions (capped 100)
//   GET  /v1/eidolon/world/ticks          — recent tick log (capped 50)
//   GET  /v1/eidolon/world/businesses     — businesses for org or agent
//   GET  /v1/eidolon/world/catalog        — catalog of available business kinds
//   POST /v1/eidolon/agents/:agentId/businesses        — create business
//   POST /v1/eidolon/parcels/:parcelId/structures      — build structure
//   POST /v1/eidolon/admin/tick                        — admin: trigger one tick
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type { EidolonWriteRepository } from '../repo-write.js';
import type { WorldTickScheduler } from '../world-tick.js';
import {
  BUSINESS_CATALOG,
  BUSINESS_KIND_INDEX,
} from '../business-catalog.js';
import { STRUCTURE_BASE_COST, type StructureType, type BusinessMode } from '../simulation-types.js';

const ORG_RE = /^[a-zA-Z0-9_\-:.]+$/;
const ID_RE = /^[a-zA-Z0-9_\-:.]+$/;
const NAME_RE = /^[\p{L}\p{N} _\-.,'!?()&]{1,120}$/u;
const MAX_LEN = 120;
const STRUCT_TYPES: StructureType[] = Object.keys(STRUCTURE_BASE_COST) as StructureType[];

function validOrg(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || t.length > 80 || !ORG_RE.test(t)) return null;
  return t;
}

function validId(raw: unknown, max = 80): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || t.length > max || !ID_RE.test(t)) return null;
  return t;
}

function validName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || t.length > MAX_LEN || !NAME_RE.test(t)) return null;
  return t;
}

function validBuilderRole(req: import('fastify').FastifyRequest): boolean {
  // Trust boundary: gateway-api is upstream and stamps these headers per
  // authenticated session. Direct calls without these headers are rejected.
  // In Phase 2 we'll move to JWT verification middleware in @sven/shared.
  const role = req.headers['x-sven-role'];
  if (!role) return false;
  const r = String(role).toLowerCase();
  return r === 'admin' || r === 'sven' || r === 'operator';
}

export async function registerWorldRoutes(
  app: FastifyInstance,
  repo: EidolonWriteRepository,
  scheduler: WorldTickScheduler,
): Promise<void> {
  // ── GET states ────────────────────────────────────────────────────────
  app.get<{ Querystring: { orgId?: string } }>('/v1/eidolon/world/states', async (req, reply) => {
    const orgId = validOrg(req.query?.orgId ?? process.env.EIDOLON_DEFAULT_ORG_ID);
    if (!orgId) return reply.code(400).send({ error: 'orgId required' });
    const ids = await repo.listOrgAgentIds(orgId);
    const states = await repo.fetchStates(ids);
    reply.header('Cache-Control', 'no-store');
    return { orgId, states: Array.from(states.values()) };
  });

  // ── GET interactions ──────────────────────────────────────────────────
  app.get<{ Querystring: { orgId?: string; limit?: string } }>(
    '/v1/eidolon/world/interactions',
    async (req, reply) => {
      const orgId = validOrg(req.query?.orgId ?? process.env.EIDOLON_DEFAULT_ORG_ID);
      if (!orgId) return reply.code(400).send({ error: 'orgId required' });
      const limit = Math.min(100, Math.max(1, Number(req.query?.limit ?? 50) || 50));
      const items = await repo.listRecentInteractions(orgId, limit);
      reply.header('Cache-Control', 'no-store');
      return { orgId, count: items.length, items };
    },
  );

  // ── GET ticks ─────────────────────────────────────────────────────────
  app.get<{ Querystring: { orgId?: string; limit?: string } }>(
    '/v1/eidolon/world/ticks',
    async (req, reply) => {
      const orgId = validOrg(req.query?.orgId ?? process.env.EIDOLON_DEFAULT_ORG_ID);
      if (!orgId) return reply.code(400).send({ error: 'orgId required' });
      const limit = Math.min(50, Math.max(1, Number(req.query?.limit ?? 20) || 20));
      const items = await repo.listRecentTicks(orgId, limit);
      reply.header('Cache-Control', 'no-store');
      return { orgId, count: items.length, items };
    },
  );

  // ── GET businesses ────────────────────────────────────────────────────
  app.get<{ Querystring: { orgId?: string; agentId?: string } }>(
    '/v1/eidolon/world/businesses',
    async (req, reply) => {
      const orgId = validOrg(req.query?.orgId ?? process.env.EIDOLON_DEFAULT_ORG_ID);
      if (!orgId) return reply.code(400).send({ error: 'orgId required' });
      const agentId = req.query?.agentId ? validId(req.query.agentId) : null;
      const items = agentId
        ? await repo.listAgentBusinesses(agentId)
        : await repo.listOrgBusinesses(orgId);
      reply.header('Cache-Control', 'no-store');
      return { orgId, agentId, count: items.length, items };
    },
  );

  // ── GET catalog ───────────────────────────────────────────────────────
  app.get('/v1/eidolon/world/catalog', async (_req, reply) => {
    reply.header('Cache-Control', 'public, max-age=60');
    return { count: BUSINESS_CATALOG.length, items: BUSINESS_CATALOG };
  });

  // ── POST create business ──────────────────────────────────────────────
  app.post<{
    Params: { agentId: string };
    Body: { orgId?: string; name?: string; kind?: string; mode?: BusinessMode; subdomainSlug?: string; config?: Record<string, unknown> };
  }>('/v1/eidolon/agents/:agentId/businesses', async (req, reply) => {
    if (!validBuilderRole(req)) return reply.code(403).send({ error: 'forbidden' });

    const agentId = validId(req.params?.agentId);
    if (!agentId) return reply.code(400).send({ error: 'invalid agentId' });

    const body = req.body ?? {};
    const orgId = validOrg(body.orgId ?? process.env.EIDOLON_DEFAULT_ORG_ID);
    if (!orgId) return reply.code(400).send({ error: 'orgId required' });

    const name = validName(body.name);
    if (!name) return reply.code(400).send({ error: 'invalid name' });

    const kind = typeof body.kind === 'string' ? body.kind.trim() : '';
    const slot = BUSINESS_KIND_INDEX.get(kind);
    if (!slot) return reply.code(400).send({ error: 'unknown business kind', allowed: Array.from(BUSINESS_KIND_INDEX.keys()) });

    // Hard rule: live mode requires a registered live adapter. None exist yet.
    const requestedMode: BusinessMode = body.mode === 'live' ? 'live' : 'simulated';
    if (requestedMode === 'live') {
      return reply.code(409).send({
        error: 'live_mode_unavailable',
        detail: 'No live revenue adapter is wired for this kind. Business stays simulated until adapter + credentials are registered.',
      });
    }

    // Sanitised subdomain (alnum + dash, max 40).
    const slugRaw = typeof body.subdomainSlug === 'string' ? body.subdomainSlug : slot.recommendedSubdomain;
    const slug = slugRaw.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    if (!slug) return reply.code(400).send({ error: 'invalid subdomainSlug' });

    // Sanitise config (1-level shallow copy, drop functions / prototype pollution).
    const safeConfig: Record<string, unknown> = {};
    if (body.config && typeof body.config === 'object' && !Array.isArray(body.config)) {
      for (const [k, v] of Object.entries(body.config)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        if (typeof v === 'function') continue;
        if (typeof v === 'string' && v.length > 1024) continue;
        safeConfig[k] = v;
      }
    }
    safeConfig.subdomain = `${slug}.from.sven.systems`;
    safeConfig.subdomain_slug = slug;
    safeConfig.catalog_group = slot.group;

    const created = await repo.createBusiness({
      agentId, orgId, name, kind, mode: requestedMode, config: safeConfig,
    });
    reply.code(201);
    return { business: created };
  });

  // ── POST build structure ──────────────────────────────────────────────
  app.post<{
    Params: { parcelId: string };
    Body: { agentId?: string; structureType?: string; label?: string; level?: number };
  }>('/v1/eidolon/parcels/:parcelId/structures', async (req, reply) => {
    if (!validBuilderRole(req)) return reply.code(403).send({ error: 'forbidden' });

    const parcelId = validId(req.params?.parcelId);
    if (!parcelId) return reply.code(400).send({ error: 'invalid parcelId' });

    const body = req.body ?? {};
    const agentId = validId(body.agentId);
    if (!agentId) return reply.code(400).send({ error: 'invalid agentId' });

    const structureType = String(body.structureType || '') as StructureType;
    if (!STRUCT_TYPES.includes(structureType)) {
      return reply.code(400).send({ error: 'invalid structureType', allowed: STRUCT_TYPES });
    }

    const label = validName(body.label) ?? structureType;
    const levelRaw = Number(body.level ?? 1);
    const level = Number.isInteger(levelRaw) && levelRaw >= 1 && levelRaw <= 10 ? levelRaw : 1;
    const cost = STRUCTURE_BASE_COST[structureType] * level;

    try {
      const out = await repo.buildStructure({ parcelId, agentId, structureType, label, level, cost });
      reply.code(201);
      return { ...out, cost, structureType, level };
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'insufficient_tokens' || msg === 'parcel not found' || msg === 'agent does not own parcel') {
        return reply.code(409).send({ error: msg });
      }
      throw err;
    }
  });

  // ── POST admin tick ───────────────────────────────────────────────────
  app.post('/v1/eidolon/admin/tick', async (req, reply) => {
    if (!validBuilderRole(req)) return reply.code(403).send({ error: 'forbidden' });
    const stats = await scheduler.runOnce();
    return { ok: true, stats };
  });
}
