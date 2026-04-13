'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import {
  useAgentPersonas,
  useModerationPending,
  useReviewModeration,
  useAgentChangelog,
  usePublishChangelog,
  useConfidenceCalibration,
  useConfidenceLow,
  useFeedbackTaskSummary,
  useCorrections,
  useVerifyCorrection,
  usePromoteCorrection,
  useAgentPatterns,
  useSelfImprovementSnapshots,
} from '@/lib/hooks';
import {
  Bot,
  ShieldCheck,
  FileText,
  Target,
  GitPullRequest,
  TrendingUp,
  Eye,
  CheckCircle2,
  ArrowUpCircle,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type Tab = 'personas' | 'moderation' | 'changelog' | 'confidence' | 'corrections' | 'patterns' | 'improvement';

type R = Record<string, unknown>;
function toArr(d: unknown): R[] {
  if (!d) return [];
  const v = d as { rows?: unknown[] };
  if (Array.isArray(v.rows)) return v.rows as R[];
  if (Array.isArray(d)) return d as R[];
  return [];
}
function toR(d: unknown): R {
  if (d && typeof d === 'object' && !Array.isArray(d)) return d as R;
  return {};
}

export default function CommunityAgentsPage() {
  const [tab, setTab] = useState<Tab>('personas');

  const { data: personasData, isLoading } = useAgentPersonas();
  const { data: modData } = useModerationPending();
  const { data: changelogData } = useAgentChangelog();
  const { data: calibrationData } = useConfidenceCalibration();
  const { data: lowConfData } = useConfidenceLow();
  const { data: feedbackData } = useFeedbackTaskSummary();
  const { data: correctionsData } = useCorrections();
  const { data: patternsData } = useAgentPatterns();
  const { data: snapshotsData } = useSelfImprovementSnapshots();

  const reviewMod = useReviewModeration();
  const publishCl = usePublishChangelog();
  const verifyCor = useVerifyCorrection();
  const promoteCor = usePromoteCorrection();

  const personas = toArr(personasData);
  const moderation = toArr(modData);
  const changelog = toArr(changelogData);
  const calibration = toR(calibrationData?.rows?.[0] ?? calibrationData);
  const lowConf = toArr(lowConfData);
  const feedback = toArr(feedbackData);
  const corrections = toArr(correctionsData);
  const patterns = toArr(patternsData);
  const snapshots = toArr(snapshotsData);

  if (isLoading) return <PageSpinner />;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'personas', label: 'Personas', icon: <Bot className="h-4 w-4" /> },
    { key: 'moderation', label: 'Moderation', icon: <ShieldCheck className="h-4 w-4" /> },
    { key: 'changelog', label: 'Changelog', icon: <FileText className="h-4 w-4" /> },
    { key: 'confidence', label: 'Confidence', icon: <Target className="h-4 w-4" /> },
    { key: 'corrections', label: 'Corrections', icon: <GitPullRequest className="h-4 w-4" /> },
    { key: 'patterns', label: 'Patterns', icon: <Eye className="h-4 w-4" /> },
    { key: 'improvement', label: 'Self-Improvement', icon: <TrendingUp className="h-4 w-4" /> },
  ];

  return (
    <>
      <PageHeader
        title="Community Agents"
        description="Agent personas, moderation, transparency, confidence calibration & self-improvement"
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

      {tab === 'personas' && <PersonasTab personas={personas} />}
      {tab === 'moderation' && (
        <ModerationTab
          items={moderation}
          onReview={(id, decision, explanation) => {
            reviewMod.mutate(
              { decisionId: id, body: { decision, explanation } },
              {
                onSuccess: () => toast.success('Review submitted'),
                onError: () => toast.error('Review failed'),
              },
            );
          }}
        />
      )}
      {tab === 'changelog' && (
        <ChangelogTab
          entries={changelog}
          onPublish={(id) => {
            publishCl.mutate(id, {
              onSuccess: () => toast.success('Entry published'),
              onError: () => toast.error('Publish failed'),
            });
          }}
        />
      )}
      {tab === 'confidence' && <ConfidenceTab calibration={calibration} lowConf={lowConf} feedback={feedback} />}
      {tab === 'corrections' && (
        <CorrectionsTab
          corrections={corrections}
          onVerify={(id) => {
            verifyCor.mutate(id, {
              onSuccess: () => toast.success('Correction verified'),
              onError: () => toast.error('Verification failed'),
            });
          }}
          onPromote={(id) => {
            promoteCor.mutate(id, {
              onSuccess: () => toast.success('Correction promoted to memory'),
              onError: () => toast.error('Promotion failed'),
            });
          }}
        />
      )}
      {tab === 'patterns' && <PatternsTab patterns={patterns} />}
      {tab === 'improvement' && <ImprovementTab snapshots={snapshots} />}
    </>
  );
}

/* ─── Personas ───────────────────────────────────────────────────────── */

function PersonasTab({ personas }: { personas: R[] }) {
  const typeColors: Record<string, string> = {
    guide: 'bg-sky-500', inspector: 'bg-amber-500', curator: 'bg-emerald-500',
    advocate: 'bg-violet-500', qa: 'bg-red-500', librarian: 'bg-indigo-500',
    tester: 'bg-orange-500', imagination: 'bg-pink-500',
  };
  return (
    <div className="space-y-4">
      {personas.length === 0 ? (
        <EmptyState icon={Bot} title="No agent personas" description="No community agents configured." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {personas.map((p, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 rounded-full ${typeColors[String(p.type ?? '').toLowerCase()] ?? 'bg-slate-400'}`} />
                  <p className="font-semibold">{String(p.name ?? p.agent_id ?? 'Agent')}</p>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${p.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}`}>
                  {String(p.status ?? 'unknown')}
                </span>
              </div>
              <p className="mt-2 text-xs capitalize text-slate-500">{String(p.type ?? '')}</p>
              {Boolean(p.description) && <p className="mt-1 text-xs text-slate-400 line-clamp-2">{String(p.description)}</p>}
              <div className="mt-2 flex gap-2 text-xs text-slate-400">
                {Boolean(p.community_visible) && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300">Visible</span>}
                {p.is_agent === true && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">AI Agent</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Moderation ─────────────────────────────────────────────────────── */

function ModerationTab({ items, onReview }: { items: R[]; onReview: (id: string, decision: string, explanation: string) => void }) {
  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Queue clear" description="No pending moderation reviews." />
      ) : (
        <div className="space-y-3">
          {items.map((m, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{String(m.agent_name ?? m.agent_id ?? 'Agent')}</p>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-3">{String(m.content ?? m.message ?? '')}</p>
                </div>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{String(m.risk_level ?? 'pending')}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onReview(String(m.decision_id ?? m.id), 'approved', 'Approved by admin')}
                  className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-3 w-3" /> Approve
                </button>
                <button
                  onClick={() => onReview(String(m.decision_id ?? m.id), 'rejected', 'Rejected by admin')}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Changelog ──────────────────────────────────────────────────────── */

function ChangelogTab({ entries, onPublish }: { entries: R[]; onPublish: (id: string) => void }) {
  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <EmptyState icon={FileText} title="No changelog" description="No transparency changelog entries yet." />
      ) : (
        <div className="space-y-3">
          {entries.map((e, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{String(e.title ?? e.type ?? 'Entry')}</p>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">{String(e.content ?? e.body ?? '')}</p>
                </div>
                {e.published ? (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Published</span>
                ) : (
                  <button onClick={() => onPublish(String(e.entry_id ?? e.id))} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-700">
                    Publish
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-400">{String(e.type ?? '')} · {String(e.visibility ?? 'draft')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Confidence Calibration ─────────────────────────────────────────── */

function ConfidenceTab({ calibration, lowConf, feedback }: { calibration: R; lowConf: R[]; feedback: R[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Avg Confidence" value={String(calibration.avg_confidence ?? 'N/A')} />
        <Stat label="Calibration Score" value={String(calibration.calibration_score ?? 'N/A')} />
        <Stat label="Total Scored" value={calibration.total_scored} />
        <Stat label="Low Confidence" value={lowConf.length} />
      </div>
      <div className="card">
        <h3 className="mb-3 font-medium">Feedback by Task Type</h3>
        {feedback.length === 0 ? (
          <EmptyState icon={Target} title="No feedback" description="No feedback signals recorded." />
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {feedback.map((f, i) => (
              <div key={i} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium">{String(f.task_type ?? f.type ?? 'general')}</span>
                <div className="flex gap-3 text-xs text-slate-500">
                  <span>👍 {String(f.positive ?? 0)}</span>
                  <span>👎 {String(f.negative ?? 0)}</span>
                  <span>Total: {String(f.total ?? 0)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card">
        <h3 className="mb-3 font-medium">Low Confidence Responses</h3>
        {lowConf.length === 0 ? (
          <p className="text-sm text-slate-500">No low-confidence responses found.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {lowConf.slice(0, 20).map((r, i) => (
              <div key={i} className="py-2.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{String(r.confidence ?? 0)}</span>
                  <span className="text-xs text-slate-500">{String(r.task_type ?? '')}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400 line-clamp-1">{String(r.prompt ?? r.query ?? '')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Corrections ────────────────────────────────────────────────────── */

function CorrectionsTab({ corrections, onVerify, onPromote }: { corrections: R[]; onVerify: (id: string) => void; onPromote: (id: string) => void }) {
  return (
    <div className="space-y-4">
      {corrections.length === 0 ? (
        <EmptyState icon={GitPullRequest} title="No corrections" description="No corrections submitted." />
      ) : (
        <div className="space-y-3">
          {corrections.map((c, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium">{String(c.original_response ?? '').slice(0, 100) || 'Original response'}</p>
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">→ {String(c.correction ?? c.corrected_response ?? '')}</p>
                </div>
                <span className={`ml-2 rounded px-2 py-0.5 text-xs font-medium ${
                  c.status === 'verified' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                  c.status === 'promoted' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' :
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                }`}>{String(c.status ?? 'pending')}</span>
              </div>
              {c.status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => onVerify(String(c.correction_id ?? c.id))} className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Verify
                  </button>
                </div>
              )}
              {c.status === 'verified' && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => onPromote(String(c.correction_id ?? c.id))} className="flex items-center gap-1 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700">
                    <ArrowUpCircle className="h-3 w-3" /> Promote to Memory
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Patterns ───────────────────────────────────────────────────────── */

function PatternsTab({ patterns }: { patterns: R[] }) {
  return (
    <div className="space-y-4">
      {patterns.length === 0 ? (
        <EmptyState icon={Eye} title="No patterns" description="No behavioral patterns observed yet." />
      ) : (
        <div className="space-y-3">
          {patterns.map((p, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{String(p.description ?? p.name ?? `Pattern ${i + 1}`)}</p>
                  <p className="mt-1 text-xs text-slate-500">Type: {String(p.type ?? 'unknown')} · Occurrences: {String(p.occurrences ?? p.count ?? 0)}</p>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                  p.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                  p.status === 'investigating' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                  'bg-slate-100 text-slate-600 dark:bg-slate-800'
                }`}>{String(p.status ?? 'observed')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Self-Improvement ───────────────────────────────────────────────── */

function ImprovementTab({ snapshots }: { snapshots: R[] }) {
  return (
    <div className="space-y-4">
      {snapshots.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No snapshots" description="No self-improvement data collected yet." />
      ) : (
        <div className="space-y-3">
          {snapshots.map((s, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{String(s.date ?? s.snapshot_date ?? `Snapshot ${i + 1}`)}</p>
                <span className="text-xs text-slate-500">{String(s.period ?? '')}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div><span className="text-slate-500">Correction Rate:</span> <strong>{String(s.correction_rate ?? 'N/A')}</strong></div>
                <div><span className="text-slate-500">Confidence:</span> <strong>{String(s.avg_confidence ?? 'N/A')}</strong></div>
                <div><span className="text-slate-500">Corrections:</span> <strong>{String(s.corrections_count ?? 0)}</strong></div>
                <div><span className="text-slate-500">Patterns:</span> <strong>{String(s.patterns_found ?? 0)}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Shared ─────────────────────────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="card flex flex-col items-center justify-center p-4 text-center">
      <p className="text-2xl font-bold">{String(value ?? 0)}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
