'use client';

import { useMemo, useState } from 'react';
import type { EidolonEvent, EidolonEventKind } from '@/lib/api';
import { formatBucharestTime } from '@/lib/time';

const KIND_ACCENT: Partial<Record<EidolonEvent['kind'], string>> = {
  'market.listing_published': 'text-brand-400',
  'market.order_paid': 'text-emerald-300',
  'market.fulfilled': 'text-emerald-400',
  'market.refunded': 'text-rose-300',
  'market.task_created': 'text-sky-300',
  'market.task_completed': 'text-sky-400',
  'treasury.credit': 'text-amber-300',
  'treasury.debit': 'text-rose-300',
  'agent.spawned': 'text-violet-300',
  'agent.retired': 'text-slate-400',
  'agent.profile_updated': 'text-violet-200',
  'agent.tokens_earned': 'text-amber-200',
  'agent.moved': 'text-sky-200',
  'agent.built_structure': 'text-amber-400',
  'agent.parcel_acquired': 'text-emerald-300',
  'agent.avatar_changed': 'text-violet-200',
  'agent.anomaly_detected': 'text-red-400',
  'agent.report_generated': 'text-cyan-300',
  'agent.message_sent': 'text-violet-300',
  'agent.business_created': 'text-emerald-400',
  'agent.business_activated': 'text-emerald-300',
  'agent.business_deactivated': 'text-slate-400',
  'oversight.command_issued': 'text-rose-400',
  'crew.created': 'text-pink-300',
  'crew.member_added': 'text-pink-200',
  'goal.progress': 'text-teal-300',
  'goal.completed': 'text-cyan-300',
  'publishing.project_created': 'text-violet-300',
  'publishing.stage_advanced': 'text-violet-200',
  'publishing.review_submitted': 'text-pink-300',
  'publishing.book_published': 'text-violet-400',
  'world.tick': 'text-gray-500',
  'world.parcel_interaction': 'text-cyan-300',
  'infra.node_change': 'text-sky-300',
  heartbeat: 'text-slate-600',
};

// ── Category filter ──────────────────────────────────────────────────────
type Category = 'all' | 'market' | 'agent' | 'treasury' | 'world' | 'crew' | 'publish' | 'other';

const CATEGORY_KINDS: Record<Exclude<Category, 'all' | 'other'>, EidolonEventKind[]> = {
  market:   ['market.listing_published', 'market.order_paid', 'market.fulfilled', 'market.refunded', 'market.task_created', 'market.task_completed'],
  agent:    ['agent.spawned', 'agent.retired', 'agent.profile_updated', 'agent.tokens_earned', 'agent.moved', 'agent.built_structure', 'agent.parcel_acquired', 'agent.avatar_changed', 'agent.anomaly_detected', 'agent.report_generated', 'agent.message_sent', 'agent.business_created', 'agent.business_activated', 'agent.business_deactivated'],
  treasury: ['treasury.credit', 'treasury.debit'],
  world:    ['world.tick', 'world.parcel_interaction', 'infra.node_change'],
  crew:     ['crew.created', 'crew.member_added', 'oversight.command_issued', 'goal.progress', 'goal.completed'],
  publish:  ['publishing.project_created', 'publishing.stage_advanced', 'publishing.review_submitted', 'publishing.book_published'],
};

const CATEGORY_LABEL: Record<Category, string> = {
  all: 'All', market: 'Market', agent: 'Agent', treasury: 'Treasury',
  world: 'World', crew: 'Crew', publish: 'Publish', other: 'Other',
};
const CATEGORY_COLOR: Record<Category, string> = {
  all: 'text-gray-300', market: 'text-brand-400', agent: 'text-violet-300',
  treasury: 'text-amber-300', world: 'text-sky-300', crew: 'text-pink-300',
  publish: 'text-violet-400', other: 'text-gray-400',
};

const ALL_CATEGORISED = new Set(Object.values(CATEGORY_KINDS).flat());
function eventCategory(kind: EidolonEventKind): Exclude<Category, 'all'> {
  for (const [cat, kinds] of Object.entries(CATEGORY_KINDS) as [Exclude<Category, 'all' | 'other'>, EidolonEventKind[]][]) {
    if (kinds.includes(kind)) return cat;
  }
  return 'other';
}

// ── Payload entity extraction for cross-link navigation ──────────────────
function extractEntity(ev: EidolonEvent): { type: 'citizen' | 'building'; id: string } | null {
  // Agent-scoped events carry agentId in the payload.
  const agentId = ev.payload.agentId ?? ev.payload.agent_id;
  if (typeof agentId === 'string' && agentId) {
    return { type: 'citizen', id: agentId.startsWith('agent:') ? agentId : `agent:${agentId}` };
  }
  // Building/listing events.
  const buildingId = ev.payload.buildingId ?? ev.payload.building_id ?? ev.payload.listingId ?? ev.payload.listing_id;
  if (typeof buildingId === 'string' && buildingId) {
    return { type: 'building', id: buildingId };
  }
  return null;
}

interface Props {
  events: EidolonEvent[];
  onSelectCitizen?: (citizenId: string) => void;
  onSelectBuilding?: (buildingId: string) => void;
}

export function EventFeed({ events, onSelectCitizen, onSelectBuilding }: Props) {
  const [category, setCategory] = useState<Category>('all');
  const visible = useMemo(() => {
    const base = events.filter((e) => e.kind !== 'heartbeat');
    if (category === 'all') return base.slice(0, 40);
    if (category === 'other') return base.filter((e) => !ALL_CATEGORISED.has(e.kind)).slice(0, 40);
    const allowed = new Set(CATEGORY_KINDS[category as keyof typeof CATEGORY_KINDS]);
    return base.filter((e) => allowed.has(e.kind)).slice(0, 40);
  }, [events, category]);

  const categories: Category[] = ['all', 'market', 'agent', 'treasury', 'world', 'crew', 'publish', 'other'];

  const handleClick = (ev: EidolonEvent) => {
    const entity = extractEntity(ev);
    if (!entity) return;
    if (entity.type === 'citizen') onSelectCitizen?.(entity.id);
    else if (entity.type === 'building') onSelectBuilding?.(entity.id);
  };

  return (
    <div className="glass-card p-4 max-h-[50vh] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-widest text-gray-400">Live Feed</div>
        <div className="text-[10px] text-gray-500">{visible.length} events</div>
      </div>
      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-1 mb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded transition-colors ${
              category === cat
                ? `${CATEGORY_COLOR[cat]} bg-white/10 font-semibold`
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            {CATEGORY_LABEL[cat]}
          </button>
        ))}
      </div>
      <div className="overflow-y-auto pr-1 space-y-1.5">
        {visible.length === 0 ? (
          <div className="text-xs text-gray-500">
            {category === 'all' ? 'Awaiting signals from the economy…' : `No ${CATEGORY_LABEL[category].toLowerCase()} events yet`}
          </div>
        ) : (
          visible.map((ev) => {
            const entity = extractEntity(ev);
            const clickable = entity && (onSelectCitizen || onSelectBuilding);
            return (
              <div
                key={ev.id}
                className={`text-xs ${clickable ? 'cursor-pointer hover:bg-white/5 rounded px-1 -mx-1 transition-colors' : ''}`}
                onClick={clickable ? () => handleClick(ev) : undefined}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(ev); } } : undefined}
              >
                <span className="text-[10px] text-gray-500 font-mono" title="Romanian time (Europe/Bucharest)">
                  {formatBucharestTime(ev.at)}
                </span>
                <span className={`ml-2 font-medium ${KIND_ACCENT[ev.kind] ?? 'text-gray-300'}`}>
                  {ev.kind}
                </span>
                <span className="ml-2 text-gray-400 break-all">{summarise(ev.payload)}</span>
                {entity && (
                  <span className="ml-1 text-[9px] text-cyan-400/60" title={`Navigate to ${entity.type}`}>↗</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function summarise(payload: EidolonEvent['payload']): string {
  const entries = Object.entries(payload).slice(0, 3);
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${k}=${v}`).join(' · ');
}
