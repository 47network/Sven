// ---------------------------------------------------------------------------
// Eidolon — Write repository (state, interactions, businesses, ticks, builds)
// ---------------------------------------------------------------------------
// All mutations are explicit, transactional where multi-row, and never
// silently fabricate revenue. Simulated business runs MUST go through
// `recordBusinessRun({ mode: 'simulated', tokensCredited: 0 })`.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';
import type {
  AgentBusiness,
  AgentInteraction,
  AgentRuntime,
  AgentRuntimeState,
  BusinessMode,
  BusinessRunResult,
  BusinessStatus,
  InteractionTopic,
  StructureType,
  WorldTick,
} from './simulation-types.js';

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class EidolonWriteRepository {
  constructor(private readonly pool: Pool) {}

  // ── Agent runtime state ─────────────────────────────────────────────────

  async listOrgAgentIds(orgId: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ id: string }>(
      `SELECT id FROM agent_profiles WHERE org_id = $1 AND status = 'active' ORDER BY id ASC`,
      [orgId],
    );
    return rows.map((r) => r.id);
  }

  async fetchStates(agentIds: string[]): Promise<Map<string, AgentRuntime>> {
    const map = new Map<string, AgentRuntime>();
    if (agentIds.length === 0) return map;
    const { rows } = await this.pool.query(
      `SELECT agent_id, state, intent, target_location, target_agent_id,
              target_business_id, energy, mood, state_started_at, last_tick_at,
              ticks_alive
       FROM agent_states WHERE agent_id = ANY($1::text[])`,
      [agentIds],
    );
    for (const r of rows as Record<string, unknown>[]) {
      map.set(String(r.agent_id), {
        agentId: String(r.agent_id),
        state: String(r.state) as AgentRuntimeState,
        intent: r.intent ? String(r.intent) : null,
        targetLocation: r.target_location ? String(r.target_location) : null,
        targetAgentId: r.target_agent_id ? String(r.target_agent_id) : null,
        targetBusinessId: r.target_business_id ? String(r.target_business_id) : null,
        energy: Number(r.energy ?? 100),
        mood: (r.mood ?? 'neutral') as AgentRuntime['mood'],
        stateStartedAt: r.state_started_at ? new Date(r.state_started_at as string).toISOString() : new Date().toISOString(),
        lastTickAt: r.last_tick_at ? new Date(r.last_tick_at as string).toISOString() : new Date().toISOString(),
        ticksAlive: Number(r.ticks_alive ?? 0),
      });
    }
    return map;
  }

  async upsertState(rt: Pick<AgentRuntime, 'agentId' | 'state' | 'intent' | 'targetLocation' | 'targetAgentId' | 'targetBusinessId' | 'energy' | 'mood'> & { incrementTick?: boolean }): Promise<void> {
    await this.pool.query(
      `INSERT INTO agent_states
         (agent_id, state, intent, target_location, target_agent_id, target_business_id,
          energy, mood, state_started_at, last_tick_at, ticks_alive)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), $9)
       ON CONFLICT (agent_id) DO UPDATE SET
         state             = EXCLUDED.state,
         intent            = EXCLUDED.intent,
         target_location   = EXCLUDED.target_location,
         target_agent_id   = EXCLUDED.target_agent_id,
         target_business_id = EXCLUDED.target_business_id,
         energy            = EXCLUDED.energy,
         mood              = EXCLUDED.mood,
         state_started_at  = CASE
                                WHEN agent_states.state IS DISTINCT FROM EXCLUDED.state
                                THEN NOW()
                                ELSE agent_states.state_started_at
                              END,
         last_tick_at      = NOW(),
         ticks_alive       = agent_states.ticks_alive + CASE WHEN $10 THEN 1 ELSE 0 END`,
      [
        rt.agentId, rt.state, rt.intent, rt.targetLocation, rt.targetAgentId,
        rt.targetBusinessId, rt.energy, rt.mood,
        rt.incrementTick ? 1 : 0,
        rt.incrementTick ?? false,
      ],
    );
  }

  // ── Agent location (lives on agent_parcels.current_location) ────────────

  async setAgentLocation(agentId: string, location: string, reason: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const cur = await client.query<{ current_location: string }>(
        `SELECT current_location FROM agent_parcels WHERE agent_id = $1 FOR UPDATE`,
        [agentId],
      );
      const from = cur.rows[0]?.current_location ?? null;
      if (from === location) {
        await client.query('COMMIT');
        return;
      }
      await client.query(
        `UPDATE agent_parcels
            SET current_location = $2,
                last_city_visit  = CASE WHEN $2 LIKE 'city_%' THEN NOW() ELSE last_city_visit END,
                total_city_visits = total_city_visits + CASE WHEN $2 LIKE 'city_%' THEN 1 ELSE 0 END
          WHERE agent_id = $1`,
        [agentId, location],
      );
      await client.query(
        `INSERT INTO agent_movements (id, agent_id, from_location, to_location, reason, departed_at, arrived_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [newId('mv'), agentId, from, location, reason],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async fetchCurrentLocations(agentIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (agentIds.length === 0) return map;
    const { rows } = await this.pool.query<{ agent_id: string; current_location: string }>(
      `SELECT agent_id, current_location FROM agent_parcels WHERE agent_id = ANY($1::text[])`,
      [agentIds],
    );
    for (const r of rows) map.set(r.agent_id, r.current_location);
    return map;
  }

  // ── Interactions ────────────────────────────────────────────────────────

  async recordInteraction(args: {
    agentA: string;
    agentB: string;
    location: string;
    topic: InteractionTopic;
    message: string;
    influencedDecision?: boolean;
  }): Promise<AgentInteraction> {
    const id = newId('int');
    const { rows } = await this.pool.query<{ created_at: Date }>(
      `INSERT INTO agent_interactions
         (id, agent_a, agent_b, location, topic, message, influenced_decision)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING created_at`,
      [id, args.agentA, args.agentB, args.location, args.topic, args.message, args.influencedDecision ?? false],
    );
    return {
      id,
      agentA: args.agentA,
      agentB: args.agentB,
      location: args.location,
      topic: args.topic,
      message: args.message,
      influencedDecision: args.influencedDecision ?? false,
      createdAt: new Date(rows[0].created_at).toISOString(),
    };
  }

  async listRecentInteractions(orgId: string, limit = 50): Promise<AgentInteraction[]> {
    const { rows } = await this.pool.query(
      `SELECT i.id, i.agent_a, i.agent_b, i.location, i.topic, i.message,
              i.influenced_decision, i.created_at
         FROM agent_interactions i
         JOIN agent_profiles p ON p.id = i.agent_a
        WHERE p.org_id = $1
        ORDER BY i.created_at DESC
        LIMIT $2`,
      [orgId, limit],
    );
    return rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      agentA: String(r.agent_a),
      agentB: String(r.agent_b),
      location: String(r.location),
      topic: String(r.topic) as InteractionTopic,
      message: String(r.message),
      influencedDecision: Boolean(r.influenced_decision),
      createdAt: new Date(r.created_at as string).toISOString(),
    }));
  }

  // ── Businesses ──────────────────────────────────────────────────────────

  async createBusiness(args: {
    agentId: string;
    orgId: string;
    name: string;
    kind: string;
    mode: BusinessMode;
    config?: Record<string, unknown>;
  }): Promise<AgentBusiness> {
    const id = newId('biz');
    const { rows } = await this.pool.query(
      `INSERT INTO agent_businesses (id, agent_id, org_id, name, kind, mode, status, config)
       VALUES ($1,$2,$3,$4,$5,$6,'idle',$7::jsonb)
       RETURNING created_at, updated_at`,
      [id, args.agentId, args.orgId, args.name, args.kind, args.mode, JSON.stringify(args.config ?? {})],
    );
    return {
      id,
      agentId: args.agentId,
      orgId: args.orgId,
      name: args.name,
      kind: args.kind,
      mode: args.mode,
      status: 'idle',
      config: args.config ?? {},
      totalRevenueEurCents: 0,
      totalTokensCredited: 0,
      lastRunAt: null,
      lastRevenueAt: null,
      lastError: null,
      createdAt: new Date(rows[0].created_at).toISOString(),
      updatedAt: new Date(rows[0].updated_at).toISOString(),
    };
  }

  async listAgentBusinesses(agentId: string): Promise<AgentBusiness[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM agent_businesses WHERE agent_id = $1 ORDER BY created_at ASC`,
      [agentId],
    );
    return rows.map(rowToBusiness);
  }

  async listOrgBusinesses(orgId: string, limit = 200): Promise<AgentBusiness[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM agent_businesses WHERE org_id = $1 ORDER BY updated_at DESC LIMIT $2`,
      [orgId, limit],
    );
    return rows.map(rowToBusiness);
  }

  async updateBusinessStatus(businessId: string, status: BusinessStatus, error?: string | null): Promise<void> {
    await this.pool.query(
      `UPDATE agent_businesses
          SET status = $2,
              last_error = $3,
              updated_at = NOW()
        WHERE id = $1`,
      [businessId, status, error ?? null],
    );
  }

  /**
   * Record a business run + (when live + tokens > 0) credit the agent's ledger
   * atomically. Simulated runs are written but credit zero tokens.
   */
  async recordBusinessRun(args: {
    business: AgentBusiness;
    result: BusinessRunResult;
    tokensPerEur: number;
    agentSharePct: number;       // 0–100
  }): Promise<{ tokensCredited: number; ledgerTxId: string | null; eventId: string }> {
    const { business, result, tokensPerEur, agentSharePct } = args;
    const eventId = newId('brev');
    const isLiveSuccess = business.mode === 'live' && result.outcome === 'success' && result.grossEurCents > 0;
    const eurFromCents = result.grossEurCents / 100;
    const tokensCredited = isLiveSuccess
      ? Math.floor(eurFromCents * tokensPerEur * (agentSharePct / 100))
      : 0;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let ledgerTxId: string | null = null;
      if (tokensCredited > 0) {
        ledgerTxId = newId('tx');
        const balRes = await client.query<{ token_balance: string }>(
          `SELECT token_balance FROM agent_profiles WHERE id = $1 FOR UPDATE`,
          [business.agentId],
        );
        const prev = Number(balRes.rows[0]?.token_balance ?? 0);
        const next = prev + tokensCredited;
        await client.query(
          `INSERT INTO agent_token_ledger
             (id, agent_id, amount, balance_after, kind, source_ref, description, metadata)
           VALUES ($1,$2,$3,$4,'business_revenue',$5,$6,$7::jsonb)`,
          [
            ledgerTxId, business.agentId, tokensCredited, next, business.id,
            `business_revenue:${business.kind}`,
            JSON.stringify({
              business_id: business.id,
              gross_eur_cents: result.grossEurCents,
              tokens_per_eur: tokensPerEur,
              agent_share_pct: agentSharePct,
            }),
          ],
        );
        await client.query(
          `UPDATE agent_profiles SET token_balance = $2, updated_at = NOW() WHERE id = $1`,
          [business.agentId, next],
        );
      }

      await client.query(
        `INSERT INTO agent_business_revenue_events
           (id, business_id, agent_id, mode, outcome, gross_eur_cents, tokens_credited,
            ledger_tx_id, evidence_url, evidence_hash, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          eventId, business.id, business.agentId, business.mode, result.outcome,
          result.grossEurCents, tokensCredited, ledgerTxId,
          result.evidenceUrl, result.evidenceHash, result.notes,
        ],
      );

      await client.query(
        `UPDATE agent_businesses
            SET total_revenue_eur_cents = total_revenue_eur_cents
                  + CASE WHEN $2 = 'live' AND $3 = 'success' THEN $4 ELSE 0 END,
                total_tokens_credited   = total_tokens_credited + $5,
                last_run_at             = NOW(),
                last_revenue_at         = CASE WHEN $3 = 'success' AND $4 > 0 THEN NOW() ELSE last_revenue_at END,
                status                  = CASE
                                            WHEN $3 = 'failure' THEN 'failed'
                                            WHEN $3 = 'success' AND $4 > 0 THEN 'earning'
                                            ELSE 'idle'
                                          END,
                updated_at              = NOW()
          WHERE id = $1`,
        [business.id, business.mode, result.outcome, result.grossEurCents, tokensCredited],
      );

      await client.query('COMMIT');
      return { tokensCredited, ledgerTxId, eventId };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Structure builds ────────────────────────────────────────────────────

  async buildStructure(args: {
    parcelId: string;
    agentId: string;
    structureType: StructureType;
    label: string;
    level: number;
    cost: number;
  }): Promise<{ buildId: string; ledgerTxId: string; balanceAfter: number }> {
    if (args.cost < 0) throw new Error('cost must be >= 0');
    const buildId = newId('build');
    const ledgerTxId = newId('tx');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Lock parcel + verify ownership.
      const parcelRes = await client.query<{ agent_id: string; structures: unknown }>(
        `SELECT agent_id, structures FROM agent_parcels WHERE id = $1 FOR UPDATE`,
        [args.parcelId],
      );
      if (parcelRes.rows.length === 0) throw new Error('parcel not found');
      if (parcelRes.rows[0].agent_id !== args.agentId) {
        throw new Error('agent does not own parcel');
      }

      // Lock balance + validate funds.
      const balRes = await client.query<{ token_balance: string }>(
        `SELECT token_balance FROM agent_profiles WHERE id = $1 FOR UPDATE`,
        [args.agentId],
      );
      const prev = Number(balRes.rows[0]?.token_balance ?? 0);
      if (prev < args.cost) {
        throw new Error('insufficient_tokens');
      }
      const next = prev - args.cost;

      // Debit + ledger.
      await client.query(
        `INSERT INTO agent_token_ledger
           (id, agent_id, amount, balance_after, kind, source_ref, description, metadata)
         VALUES ($1,$2,$3,$4,'structure_build',$5,$6,$7::jsonb)`,
        [
          ledgerTxId, args.agentId, -args.cost, next, args.parcelId,
          `build:${args.structureType}:${args.label}`,
          JSON.stringify({ parcel_id: args.parcelId, structure_type: args.structureType, level: args.level }),
        ],
      );
      await client.query(
        `UPDATE agent_profiles SET token_balance = $2, updated_at = NOW() WHERE id = $1`,
        [args.agentId, next],
      );

      // Append structure to parcel JSONB.
      const newStructure = {
        type: args.structureType,
        label: args.label,
        level: args.level,
        builtAt: new Date().toISOString(),
      };
      await client.query(
        `UPDATE agent_parcels
            SET structures      = COALESCE(structures, '[]'::jsonb) || $2::jsonb,
                token_invested  = token_invested + $3,
                land_value      = land_value + $3
          WHERE id = $1`,
        [args.parcelId, JSON.stringify([newStructure]), args.cost],
      );

      // Audit row.
      await client.query(
        `INSERT INTO parcel_structure_builds
           (id, parcel_id, agent_id, structure_type, level, token_cost, ledger_tx_id, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
        [buildId, args.parcelId, args.agentId, args.structureType, args.level, args.cost, ledgerTxId,
         JSON.stringify({ label: args.label })],
      );

      await client.query('COMMIT');
      return { buildId, ledgerTxId, balanceAfter: next };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── World ticks ─────────────────────────────────────────────────────────

  async beginTick(orgId: string): Promise<{ id: string; tickNo: number }> {
    const { rows } = await this.pool.query<{ next_no: string }>(
      `SELECT COALESCE(MAX(tick_no), 0) + 1 AS next_no FROM world_ticks WHERE org_id = $1`,
      [orgId],
    );
    const tickNo = Number(rows[0]?.next_no ?? 1);
    const id = newId('tick');
    await this.pool.query(
      `INSERT INTO world_ticks (id, tick_no, org_id) VALUES ($1, $2, $3)`,
      [id, tickNo, orgId],
    );
    return { id, tickNo };
  }

  async finishTick(id: string, stats: {
    agentsProcessed: number;
    stateChanges: number;
    interactions: number;
    businessRuns: number;
    revenueEurCents: number;
    tokensCredited: number;
    errors: number;
  }): Promise<void> {
    await this.pool.query(
      `UPDATE world_ticks
          SET completed_at      = NOW(),
              agents_processed  = $2,
              state_changes     = $3,
              interactions      = $4,
              business_runs     = $5,
              revenue_eur_cents = $6,
              tokens_credited   = $7,
              errors            = $8
        WHERE id = $1`,
      [id, stats.agentsProcessed, stats.stateChanges, stats.interactions,
       stats.businessRuns, stats.revenueEurCents, stats.tokensCredited, stats.errors],
    );
  }

  async listRecentTicks(orgId: string, limit = 20): Promise<WorldTick[]> {
    const { rows } = await this.pool.query(
      `SELECT id, tick_no, org_id, started_at, completed_at, agents_processed,
              state_changes, interactions, business_runs, revenue_eur_cents,
              tokens_credited, errors
         FROM world_ticks WHERE org_id = $1
         ORDER BY tick_no DESC LIMIT $2`,
      [orgId, limit],
    );
    return rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      tickNo: Number(r.tick_no),
      orgId: String(r.org_id),
      startedAt: new Date(r.started_at as string).toISOString(),
      completedAt: r.completed_at ? new Date(r.completed_at as string).toISOString() : null,
      agentsProcessed: Number(r.agents_processed),
      stateChanges: Number(r.state_changes),
      interactions: Number(r.interactions),
      businessRuns: Number(r.business_runs),
      revenueEurCents: Number(r.revenue_eur_cents),
      tokensCredited: Number(r.tokens_credited),
      errors: Number(r.errors),
    }));
  }
}

function rowToBusiness(r: Record<string, unknown>): AgentBusiness {
  return {
    id: String(r.id),
    agentId: String(r.agent_id),
    orgId: String(r.org_id),
    name: String(r.name),
    kind: String(r.kind),
    mode: String(r.mode) as BusinessMode,
    status: String(r.status) as BusinessStatus,
    config: (r.config ?? {}) as Record<string, unknown>,
    totalRevenueEurCents: Number(r.total_revenue_eur_cents ?? 0),
    totalTokensCredited: Number(r.total_tokens_credited ?? 0),
    lastRunAt: r.last_run_at ? new Date(r.last_run_at as string).toISOString() : null,
    lastRevenueAt: r.last_revenue_at ? new Date(r.last_revenue_at as string).toISOString() : null,
    lastError: r.last_error ? String(r.last_error) : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}
