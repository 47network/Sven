// ---------------------------------------------------------------------------
// Eidolon — World tick scheduler + agent state machine
// ---------------------------------------------------------------------------
// Drives the simulation. Every tick:
//   1) Fetch active agents + their states + their current locations.
//   2) Advance state machine for each agent (idle → exploring → ...).
//   3) Pair co-located agents → roll for an interaction → record it.
//   4) For agents in `working` state with a target business → run adapter.
//   5) Persist deltas; publish events to NATS; write tick row.
//
// Every operation is best-effort and isolated: a failure in one agent never
// aborts the tick. Errors are counted into the world_ticks row and logged.
// ---------------------------------------------------------------------------

import type { NatsConnection } from 'nats';
import { createLogger } from '@sven/shared';
import type { EidolonWriteRepository } from './repo-write.js';
import type {
  AgentRuntime,
  AgentRuntimeState,
  InteractionTopic,
} from './simulation-types.js';
import { BUSINESS_KIND_INDEX, runSimulated } from './business-catalog.js';

const logger = createLogger('sven-eidolon-tick');

const CITY_LOCATIONS = [
  'city_market', 'city_treasury', 'city_infra', 'city_revenue', 'city_centre',
] as const;

const INTERACTION_TEMPLATES: Record<InteractionTopic, string[]> = {
  greeting: [
    'Salut, partener — ce mai face piața azi?',
    'Hey, you good? Just back from the market.',
  ],
  business_tip: [
    'Try the b2b-translate slot — publishers are paying premium right now.',
    'Edge-printing demand spiked. Worth scoping a supplier.',
  ],
  job_lead: [
    'Heard a publisher needs a long-form translator. Worth a look.',
    'Saw a thesis brief land in the Licenta queue.',
  ],
  gossip: [
    'The treasury keeps growing — Sven must be approving something.',
    'Two writers changed avatars last tick.',
  ],
  collaboration_offer: [
    'Want to co-launch a print pipeline? I can scout suppliers.',
    'Pair up with me for a Licenta crew — I take research.',
  ],
  review_share: [
    'Last book translation got a 4.8 rating. Customer wanted RO.',
    'Originality checker caught 12% — had to rewrite.',
  ],
  goodbye: [
    'Heading back to my parcel — got a structure to finish.',
    'Catch you next tick. Stay productive.',
  ],
};

export interface TickStats {
  agentsProcessed: number;
  stateChanges: number;
  interactions: number;
  businessRuns: number;
  revenueEurCents: number;
  tokensCredited: number;
  errors: number;
}

export interface WorldTickConfig {
  orgId: string;
  intervalMs: number;
  tokensPerEur: number;
  agentSharePct: number;
}

export class WorldTickScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private currentRun: Promise<void> | null = null;

  constructor(
    private readonly repo: EidolonWriteRepository,
    private readonly nc: NatsConnection | null,
    private readonly cfg: WorldTickConfig,
  ) {}

  start(): void {
    if (this.timer) return;
    logger.info('world tick scheduler starting', {
      org_id: this.cfg.orgId,
      interval_ms: this.cfg.intervalMs,
    });
    // Stagger first tick so health checks land first.
    this.timer = setTimeout(() => this.scheduleNext(), 5_000);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.currentRun) {
      try { await this.currentRun; } catch { /* swallow on shutdown */ }
    }
    logger.info('world tick scheduler stopped');
  }

  private scheduleNext(): void {
    if (!this.timer) return;
    if (this.running) {
      this.timer = setTimeout(() => this.scheduleNext(), this.cfg.intervalMs);
      return;
    }
    this.running = true;
    this.currentRun = this.runOnce()
      .then(() => undefined)
      .catch((err) => {
        logger.error('tick failed', { err: (err as Error).message, stack: (err as Error).stack });
      })
      .finally(() => {
        this.running = false;
        this.currentRun = null;
        if (this.timer) {
          this.timer = setTimeout(() => this.scheduleNext(), this.cfg.intervalMs);
        }
      });
  }

  /** One tick. Public so callers can manually trigger (tests, admin route). */
  async runOnce(): Promise<TickStats> {
    const stats: TickStats = {
      agentsProcessed: 0,
      stateChanges: 0,
      interactions: 0,
      businessRuns: 0,
      revenueEurCents: 0,
      tokensCredited: 0,
      errors: 0,
    };

    const tick = await this.repo.beginTick(this.cfg.orgId);

    const agentIds = await this.repo.listOrgAgentIds(this.cfg.orgId);
    if (agentIds.length === 0) {
      await this.repo.finishTick(tick.id, stats);
      return stats;
    }

    const [stateMap, locMap] = await Promise.all([
      this.repo.fetchStates(agentIds),
      this.repo.fetchCurrentLocations(agentIds),
    ]);

    // 1) Advance each agent.
    const decisions: Array<{ agentId: string; nextState: AgentRuntimeState; nextLocation: string | null; intent: string }> = [];
    for (const agentId of agentIds) {
      try {
        const cur = stateMap.get(agentId) ?? defaultRuntime(agentId);
        const loc = locMap.get(agentId) ?? 'parcel';
        const decision = decide(cur, loc, tick.tickNo);
        decisions.push({ agentId, ...decision });
      } catch (err) {
        stats.errors++;
        logger.warn('decide failed', { agent_id: agentId, err: (err as Error).message });
      }
    }

    // 2) Persist decisions + move agents.
    for (const d of decisions) {
      try {
        const cur = stateMap.get(d.agentId) ?? defaultRuntime(d.agentId);
        const stateChanged = cur.state !== d.nextState;

        if (d.nextLocation && (locMap.get(d.agentId) !== d.nextLocation)) {
          await this.repo.setAgentLocation(d.agentId, d.nextLocation, d.intent);
          locMap.set(d.agentId, d.nextLocation);
          this.publish('agent.moved', { agentId: d.agentId, location: d.nextLocation, reason: d.intent });
        }

        await this.repo.upsertState({
          agentId: d.agentId,
          state: d.nextState,
          intent: d.intent,
          targetLocation: d.nextLocation,
          targetAgentId: null,
          targetBusinessId: null,
          energy: clamp(cur.energy + energyDelta(d.nextState), 0, 100),
          mood: cur.mood,
          incrementTick: true,
        });
        if (stateChanged) stats.stateChanges++;
        stats.agentsProcessed++;
      } catch (err) {
        stats.errors++;
        logger.warn('persist state failed', { agent_id: d.agentId, err: (err as Error).message });
      }
    }

    // 3) Pairwise interactions among co-located agents (city only).
    const colocated = new Map<string, string[]>();
    for (const [agentId, loc] of locMap.entries()) {
      if (!isCityLocation(loc)) continue;
      const list = colocated.get(loc) ?? [];
      list.push(agentId);
      colocated.set(loc, list);
    }
    for (const [loc, members] of colocated.entries()) {
      if (members.length < 2) continue;
      // One pair per location per tick keeps the firehose calm.
      const pair = pickPair(members, tick.tickNo, loc);
      if (!pair) continue;
      try {
        const topic = pickTopic(tick.tickNo, loc, pair);
        const message = pickTemplate(topic, tick.tickNo, pair);
        await this.repo.recordInteraction({
          agentA: pair[0], agentB: pair[1], location: loc, topic, message,
        });
        stats.interactions++;
        this.publish('agent.message_sent', { agentA: pair[0], agentB: pair[1], location: loc, topic });
      } catch (err) {
        stats.errors++;
        logger.warn('interaction failed', { location: loc, err: (err as Error).message });
      }
    }

    // 4) Run businesses for agents currently in `working` city districts (revenue/market).
    const workingAgents = decisions.filter(
      (d) => d.nextState === 'working' && (d.nextLocation === 'city_revenue' || d.nextLocation === 'city_market'),
    );
    if (workingAgents.length > 0) {
      const businesses = await this.repo.listOrgBusinesses(this.cfg.orgId, 500);
      const byAgent = new Map<string, typeof businesses>();
      for (const b of businesses) {
        if (b.status === 'archived' || b.status === 'paused') continue;
        const list = byAgent.get(b.agentId) ?? [];
        list.push(b);
        byAgent.set(b.agentId, list);
      }
      for (const w of workingAgents) {
        const owned = byAgent.get(w.agentId);
        if (!owned || owned.length === 0) continue;
        const biz = owned[Math.abs(hashStr(`${w.agentId}:${tick.tickNo}`)) % owned.length];
        try {
          // Only a registered slot can run.
          if (!BUSINESS_KIND_INDEX.has(biz.kind)) continue;
          const result = runSimulated({ businessId: biz.id, kind: biz.kind, tickNo: tick.tickNo });
          const out = await this.repo.recordBusinessRun({
            business: biz,
            result,
            tokensPerEur: this.cfg.tokensPerEur,
            agentSharePct: this.cfg.agentSharePct,
          });
          stats.businessRuns++;
          if (biz.mode === 'live' && result.outcome === 'success') {
            stats.revenueEurCents += result.grossEurCents;
          }
          stats.tokensCredited += out.tokensCredited;
          this.publish('agent.business_activated', {
            businessId: biz.id, agentId: biz.agentId, mode: biz.mode,
            outcome: result.outcome, tokensCredited: out.tokensCredited,
          });
        } catch (err) {
          stats.errors++;
          logger.warn('business run failed', { business_id: biz.id, err: (err as Error).message });
        }
      }
    }

    await this.repo.finishTick(tick.id, stats);
    this.publish('world.tick', { tickNo: tick.tickNo, ...stats });
    return stats;
  }

  private publish(subject: string, payload: Record<string, unknown>): void {
    if (!this.nc) return;
    try {
      this.nc.publish(`eidolon.${subject}`, Buffer.from(JSON.stringify(payload)));
    } catch (err) {
      logger.warn('NATS publish failed', { subject, err: (err as Error).message });
    }
  }
}

// ── State machine ────────────────────────────────────────────────────────

function defaultRuntime(agentId: string): AgentRuntime {
  const now = new Date().toISOString();
  return {
    agentId, state: 'idle', intent: null,
    targetLocation: null, targetAgentId: null, targetBusinessId: null,
    energy: 100, mood: 'neutral',
    stateStartedAt: now, lastTickAt: now, ticksAlive: 0,
  };
}

function decide(
  cur: AgentRuntime,
  currentLoc: string,
  tickNo: number,
): { nextState: AgentRuntimeState; nextLocation: string | null; intent: string } {
  const seed = hashStr(`${cur.agentId}:${tickNo}`);
  const roll = (Math.abs(seed) % 1000) / 1000;

  // Tired agents always go home to rest.
  if (cur.energy < 25) {
    return { nextState: 'returning_home', nextLocation: 'parcel', intent: 'low energy → rest' };
  }

  // Resting on parcel → recover, then idle.
  if (cur.state === 'resting' && cur.energy >= 90) {
    return { nextState: 'idle', nextLocation: 'parcel', intent: 'rested' };
  }
  if (cur.state === 'returning_home' && currentLoc === 'parcel') {
    return { nextState: 'resting', nextLocation: 'parcel', intent: 'resting at home' };
  }

  // From parcel — decide whether to leave.
  if (currentLoc === 'parcel') {
    if (roll < 0.40) {
      // Go work in the city.
      const dest = roll < 0.20 ? 'city_revenue' : 'city_market';
      return { nextState: 'working', nextLocation: dest, intent: 'heading to ' + dest };
    }
    if (roll < 0.70) {
      return { nextState: 'exploring', nextLocation: pickCityLoc(seed), intent: 'exploring city' };
    }
    return { nextState: 'idle', nextLocation: 'parcel', intent: 'tending parcel' };
  }

  // In the city — chance to chat, work more, or head home.
  if (isCityLocation(currentLoc)) {
    if (roll < 0.25) {
      return { nextState: 'returning_home', nextLocation: 'parcel', intent: 'heading home' };
    }
    if (roll < 0.55) {
      return { nextState: 'talking', nextLocation: currentLoc, intent: 'meeting peers' };
    }
    if (roll < 0.85) {
      // Stay/move within city working.
      return { nextState: 'working', nextLocation: pickCityLoc(seed), intent: 'working in city' };
    }
    return { nextState: 'exploring', nextLocation: pickCityLoc(seed), intent: 'exploring further' };
  }

  return { nextState: 'idle', nextLocation: currentLoc, intent: 'idle' };
}

function energyDelta(state: AgentRuntimeState): number {
  switch (state) {
    case 'resting': return +12;
    case 'idle': return +2;
    case 'talking': return -1;
    case 'exploring': return -3;
    case 'travelling': return -2;
    case 'working': return -5;
    case 'building': return -7;
    case 'returning_home': return -2;
    default: return 0;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function isCityLocation(loc: string): boolean {
  return (CITY_LOCATIONS as readonly string[]).includes(loc);
}

function pickCityLoc(seed: number): string {
  return CITY_LOCATIONS[Math.abs(seed) % CITY_LOCATIONS.length];
}

function pickPair(members: string[], tickNo: number, loc: string): [string, string] | null {
  if (members.length < 2) return null;
  const sorted = [...members].sort();
  const seed = Math.abs(hashStr(`${tickNo}:${loc}`));
  const i = seed % sorted.length;
  let j = (seed * 31 + 7) % sorted.length;
  if (j === i) j = (j + 1) % sorted.length;
  return [sorted[i], sorted[j]];
}

function pickTopic(tickNo: number, loc: string, pair: [string, string]): InteractionTopic {
  const topics: InteractionTopic[] = [
    'greeting', 'business_tip', 'job_lead', 'gossip',
    'collaboration_offer', 'review_share', 'goodbye',
  ];
  const seed = Math.abs(hashStr(`${tickNo}:${loc}:${pair[0]}:${pair[1]}`));
  return topics[seed % topics.length];
}

function pickTemplate(topic: InteractionTopic, tickNo: number, pair: [string, string]): string {
  const list = INTERACTION_TEMPLATES[topic];
  const seed = Math.abs(hashStr(`${tickNo}:${pair[0]}:${pair[1]}:${topic}`));
  return list[seed % list.length];
}

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) | 0;
  return h;
}
