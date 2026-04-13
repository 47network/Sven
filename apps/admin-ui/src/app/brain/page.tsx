'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import {
  useBrainGraph,
  useQuantumFadeConfig,
  useUpdateQuantumFadeConfig,
  useEmotionalSummary,
  useReasoning,
  useReasoningUnderstanding,
  useMemoryConsent,
  useUpdateMemoryConsent,
  useMemoryForget,
} from '@/lib/hooks';
import { BrainCircuit, Activity, Heart, Lightbulb, Shield, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type Tab = 'overview' | 'quantum' | 'emotional' | 'reasoning' | 'consent';

type R = Record<string, unknown>;

function toR(d: unknown): R {
  if (d && typeof d === 'object' && !Array.isArray(d)) return d as R;
  return {};
}
function toArr(d: unknown): R[] {
  if (!d) return [];
  const v = d as { rows?: unknown[] };
  if (Array.isArray(v.rows)) return v.rows as R[];
  if (Array.isArray(d)) return d as R[];
  return [];
}

export default function BrainPage() {
  const [tab, setTab] = useState<Tab>('overview');

  const { data: graphData, isLoading } = useBrainGraph();
  const { data: qfData } = useQuantumFadeConfig();
  const { data: emotionalData } = useEmotionalSummary();
  const { data: reasoningData } = useReasoning();
  const { data: understandingData } = useReasoningUnderstanding();
  const { data: consentData } = useMemoryConsent();

  const updateQf = useUpdateQuantumFadeConfig();
  const updateConsent = useUpdateMemoryConsent();
  const forgetMe = useMemoryForget();

  const graph = toR(graphData?.rows?.[0] ?? graphData);
  const qf = toR(qfData?.rows?.[0] ?? qfData);
  const emotional = toR(emotionalData?.rows?.[0] ?? emotionalData);
  const reasoning = toArr(reasoningData);
  const understanding = toArr(understandingData);
  const consent = toR(consentData?.rows?.[0] ?? consentData);
  const graphNodes = toArr(graph.nodes ?? graphData);

  if (isLoading) return <PageSpinner />;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Brain Map', icon: <BrainCircuit className="h-4 w-4" /> },
    { key: 'quantum', label: 'Quantum Fading', icon: <Activity className="h-4 w-4" /> },
    { key: 'emotional', label: 'Emotional Intel', icon: <Heart className="h-4 w-4" /> },
    { key: 'reasoning', label: 'Reasoning', icon: <Lightbulb className="h-4 w-4" /> },
    { key: 'consent', label: 'GDPR Consent', icon: <Shield className="h-4 w-4" /> },
  ];

  return (
    <>
      <PageHeader
        title="Brain Admin"
        description="Memory visualization, quantum fading decay, emotional intelligence & GDPR consent"
      />
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white shadow-sm dark:bg-slate-700'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <BrainMapTab nodes={graphNodes} graph={graph} />}
      {tab === 'quantum' && (
        <QuantumTab
          config={qf}
          onUpdate={(body) => {
            updateQf.mutate(body, {
              onSuccess: () => toast.success('Quantum fade config updated'),
              onError: () => toast.error('Failed to update config'),
            });
          }}
        />
      )}
      {tab === 'emotional' && <EmotionalTab summary={emotional} />}
      {tab === 'reasoning' && <ReasoningTab records={reasoning} understanding={understanding} />}
      {tab === 'consent' && (
        <ConsentTab
          consent={consent}
          onUpdate={(body) => {
            updateConsent.mutate(body, {
              onSuccess: () => toast.success('Consent updated'),
              onError: () => toast.error('Failed to update consent'),
            });
          }}
          onForget={() => {
            if (!window.confirm('This will permanently erase all user memory data. Continue?')) return;
            forgetMe.mutate(undefined as never, {
              onSuccess: () => toast.success('Memory erased (GDPR right to be forgotten)'),
              onError: () => toast.error('Failed to erase memory'),
            });
          }}
        />
      )}
    </>
  );
}

/* ─── Brain Map ──────────────────────────────────────────────────────── */

function BrainMapTab({ nodes, graph }: { nodes: R[]; graph: R }) {
  const nodeTypes = ['memory', 'knowledge', 'emotion', 'reasoning'];
  const typeColors: Record<string, string> = {
    memory: 'bg-sky-500', knowledge: 'bg-emerald-500', emotion: 'bg-amber-500', reasoning: 'bg-violet-500',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {nodeTypes.map((t) => {
          const count = nodes.filter((n) => n.type === t).length;
          return (
            <div key={t} className="card flex items-center gap-3 p-4">
              <span className={`inline-block h-3 w-3 rounded-full ${typeColors[t]}`} />
              <div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs capitalize text-slate-500">{t}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="card p-4">
        <h3 className="mb-3 font-medium">Graph Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-slate-500">Total Nodes:</span> <strong>{nodes.length || String(graph.total_nodes ?? 0)}</strong></div>
          <div><span className="text-slate-500">Edges:</span> <strong>{String(graph.total_edges ?? 0)}</strong></div>
          <div><span className="text-slate-500">Active:</span> <strong>{String(graph.active_count ?? nodes.filter((n) => n.state === 'active').length)}</strong></div>
          <div><span className="text-slate-500">Fading:</span> <strong>{String(graph.fading_count ?? nodes.filter((n) => n.state === 'fading').length)}</strong></div>
          <div><span className="text-slate-500">Consolidated:</span> <strong>{String(graph.consolidated_count ?? 0)}</strong></div>
          <div><span className="text-slate-500">Resonating:</span> <strong>{String(graph.resonating_count ?? 0)}</strong></div>
        </div>
      </div>
      {nodes.length === 0 ? (
        <EmptyState icon={BrainCircuit} title="No brain data" description="Brain graph is empty." />
      ) : (
        <div className="card">
          <h3 className="mb-3 font-medium">Nodes</h3>
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {nodes.slice(0, 50).map((n, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <span className={`inline-block h-2 w-2 rounded-full ${typeColors[String(n.type)] ?? 'bg-slate-400'}`} />
                <span className="flex-1 text-sm font-medium">{String(n.label ?? n.id ?? `node-${i}`)}</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{String(n.state ?? 'active')}</span>
                <span className="text-xs text-slate-400">{String(n.type ?? '')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Quantum Fading ─────────────────────────────────────────────────── */

function QuantumTab({ config, onUpdate }: { config: R; onUpdate: (b: R) => void }) {
  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-4">
        <h3 className="font-medium">Quantum Fading Decay Formula</h3>
        <p className="rounded bg-slate-50 p-3 font-mono text-sm dark:bg-slate-900">
          decay(t) = e<sup>-γt</sup> × (1 + A × sin(ωt + φ))
        </p>
        <p className="text-xs text-slate-500">
          Smooth exponential fade with resonance oscillations. Important memories resist decay.
        </p>
      </div>
      <div className="card space-y-4 p-4">
        <h3 className="font-medium">Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'gamma_base', label: 'Gamma (γ)', desc: 'Base decay rate' },
            { key: 'amplitude', label: 'Amplitude (A)', desc: 'Resonance strength' },
            { key: 'omega', label: 'Omega (ω)', desc: 'Oscillation frequency' },
            { key: 'consolidation_threshold', label: 'Consolidation Threshold', desc: 'Decay level triggering extraction' },
            { key: 'resonance_factor', label: 'Resonance Factor', desc: 'Boost for frequently accessed memories' },
            { key: 'consolidation_interval_hours', label: 'Consolidation Interval (hrs)', desc: 'How often pipeline runs' },
            { key: 'max_memory_budget_mb', label: 'Max Memory Budget (MB)', desc: 'Memory storage cap' },
          ].map((f) => (
            <div key={f.key}>
              <label className="text-xs font-medium text-slate-500">{f.label}</label>
              <input
                type="number"
                step="any"
                defaultValue={String(config[f.key] ?? '')}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) onUpdate({ [f.key]: v });
                }}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              <p className="mt-0.5 text-xs text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Emotional Intelligence ─────────────────────────────────────────── */

function EmotionalTab({ summary }: { summary: R }) {
  const emotions = ['joy', 'sadness', 'frustration', 'excitement', 'confusion', 'neutral'];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        {emotions.map((e) => (
          <div key={e} className="card p-3 text-center">
            <p className="text-2xl font-bold">{String(summary[`${e}_count`] ?? summary[e] ?? 0)}</p>
            <p className="text-xs capitalize text-slate-500">{e}</p>
          </div>
        ))}
      </div>
      <div className="card p-4">
        <h3 className="mb-3 font-medium">Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div><span className="text-slate-500">Total Samples:</span> <strong>{String(summary.total_samples ?? 0)}</strong></div>
          <div><span className="text-slate-500">Dominant Mood:</span> <strong>{String(summary.dominant_mood ?? 'unknown')}</strong></div>
          <div><span className="text-slate-500">Avg Sentiment:</span> <strong>{String(summary.avg_sentiment ?? 'N/A')}</strong></div>
          <div><span className="text-slate-500">Period:</span> <strong>{String(summary.period_days ?? 30)} days</strong></div>
        </div>
      </div>
    </div>
  );
}

/* ─── Reasoning ──────────────────────────────────────────────────────── */

function ReasoningTab({ records, understanding }: { records: R[]; understanding: R[] }) {
  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="mb-3 font-medium">Understanding Dimensions</h3>
        {understanding.length === 0 ? (
          <EmptyState icon={Lightbulb} title="No understanding data" description="No user reasoning captured yet." />
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {understanding.map((u, i) => (
              <div key={i} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium">{String(u.dimension ?? u.topic ?? `dim-${i}`)}</span>
                <span className="text-xs text-slate-500">{String(u.score ?? u.count ?? 0)} samples</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card">
        <h3 className="mb-3 font-medium">Recent Reasoning Records</h3>
        {records.length === 0 ? (
          <EmptyState icon={Lightbulb} title="No reasoning records" description="Users haven't shared reasoning yet." />
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {records.slice(0, 30).map((r, i) => (
              <div key={i} className="py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{String(r.topic ?? 'General')}</span>
                  <span className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">{String(r.choice ?? '')}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{String(r.reasoning ?? '')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── GDPR Consent ───────────────────────────────────────────────────── */

function ConsentTab({ consent, onUpdate, onForget }: { consent: R; onUpdate: (b: R) => void; onForget: () => void }) {
  const givenConsent = consent.consent_given === true;
  return (
    <div className="space-y-6">
      <div className={`rounded-lg border p-4 ${givenConsent ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
        <div className="flex items-center gap-3">
          <Shield className={`h-5 w-5 ${givenConsent ? 'text-emerald-500' : 'text-amber-500'}`} />
          <div>
            <p className="font-semibold">{givenConsent ? 'Consent Given' : 'No Consent'}</p>
            <p className="text-sm opacity-70">Scope: {String(consent.consent_scope ?? 'none')}</p>
          </div>
        </div>
      </div>
      <div className="card space-y-4 p-4">
        <h3 className="font-medium">Memory Consent Settings</h3>
        {['consent_given', 'allow_consolidation', 'allow_emotional_tracking', 'allow_reasoning_capture'].map((key) => (
          <label key={key} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={consent[key] === true}
              onChange={(e) => onUpdate({ [key]: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
            />
            <span className="text-sm font-medium">{key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
          </label>
        ))}
        <div>
          <label className="text-xs font-medium text-slate-500">Retention Days</label>
          <input
            type="number"
            defaultValue={String(consent.retention_days ?? 365)}
            onBlur={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v > 0) onUpdate({ retention_days: v });
            }}
            className="mt-1 block w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
      </div>
      <div className="card space-y-3 border-red-500/30 p-4">
        <h3 className="font-medium text-red-600">Danger Zone</h3>
        <p className="text-sm text-slate-500">GDPR Article 17 — Right to Erasure. This permanently deletes all user memory data.</p>
        <button
          onClick={onForget}
          className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <Trash2 className="h-4 w-4" />
          Forget Me — Erase All Data
        </button>
      </div>
    </div>
  );
}
