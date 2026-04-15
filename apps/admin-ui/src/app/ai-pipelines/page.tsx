'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import {
  useImageStats,
  useImageJobs,
  useScribeStats,
  useScribeSessions,
  useActionStats,
  useActionExecutions,
  useRoutingPolicy,
  useRoutingStats,
  usePrivacyPolicy,
  usePrivacyVerify,
  usePrivacyAuditStats,
  useModulesList,
  useModulesStats,
  useUpdateRoutingPolicy,
  useUpdatePrivacyPolicy,
} from '@/lib/hooks';
import {
  BrainCircuit,
  Image,
  Mic,
  Zap,
  Route,
  Shield,
  Puzzle,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type Tab = 'overview' | 'image' | 'scribe' | 'actions' | 'routing' | 'privacy' | 'modules';

type GenericRow = Record<string, unknown>;

function rowToRecord(row: unknown): Record<string, unknown> {
  if (row && typeof row === 'object' && !Array.isArray(row)) return row as Record<string, unknown>;
  return {};
}

function rowsToArray(data: unknown): GenericRow[] {
  if (!data) return [];
  const d = data as { rows?: unknown[] };
  if (Array.isArray(d.rows)) return d.rows as GenericRow[];
  if (Array.isArray(data)) return data as GenericRow[];
  return [];
}

export default function AiPipelinesPage() {
  const [tab, setTab] = useState<Tab>('overview');

  const { data: imageStats, isLoading: isLoading } = useImageStats();
  const { data: imageJobsData } = useImageJobs();
  const { data: scribeStats } = useScribeStats();
  const { data: scribeSessionsData } = useScribeSessions();
  const { data: actionStats } = useActionStats();
  const { data: actionExecsData } = useActionExecutions();
  const { data: routingPolicyData } = useRoutingPolicy();
  const { data: routingStatsData } = useRoutingStats();
  const { data: privacyPolicyData } = usePrivacyPolicy();
  const { data: privacyVerifyData } = usePrivacyVerify();
  const { data: privacyAuditData } = usePrivacyAuditStats();
  const { data: modulesData } = useModulesList();
  const { data: modulesStatsData } = useModulesStats();

  const updateRouting = useUpdateRoutingPolicy();
  const updatePrivacy = useUpdatePrivacyPolicy();

  const imgStats = rowToRecord(imageStats?.rows?.[0] ?? imageStats);
  const scrStats = rowToRecord(scribeStats?.rows?.[0] ?? scribeStats);
  const actStats = rowToRecord(actionStats?.rows?.[0] ?? actionStats);
  const routStats = rowToRecord(routingStatsData?.rows?.[0] ?? routingStatsData);
  const routPolicy = rowToRecord(routingPolicyData?.rows?.[0] ?? routingPolicyData);
  const privPolicy = rowToRecord(privacyPolicyData?.rows?.[0] ?? privacyPolicyData);
  const privVerify = rowToRecord(privacyVerifyData?.rows?.[0] ?? privacyVerifyData);
  const privAudit = rowToRecord(privacyAuditData?.rows?.[0] ?? privacyAuditData);
  const modStats = rowToRecord(modulesStatsData?.rows?.[0] ?? modulesStatsData);

  const imageJobs = rowsToArray(imageJobsData);
  const scribeSessions = rowsToArray(scribeSessionsData);
  const actionExecs = rowsToArray(actionExecsData);
  const modules = rowsToArray(modulesData);

  if (isLoading) return <PageSpinner />;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <BrainCircuit className="h-4 w-4" /> },
    { key: 'image', label: 'Image', icon: <Image className="h-4 w-4" /> },
    { key: 'scribe', label: 'Scribe', icon: <Mic className="h-4 w-4" /> },
    { key: 'actions', label: 'Actions', icon: <Zap className="h-4 w-4" /> },
    { key: 'routing', label: 'Routing', icon: <Route className="h-4 w-4" /> },
    { key: 'privacy', label: 'Privacy', icon: <Shield className="h-4 w-4" /> },
    { key: 'modules', label: 'Modules', icon: <Puzzle className="h-4 w-4" /> },
  ];

  return (
    <>
      <PageHeader
        title="AI Pipelines"
        description="Gemma 4 on-device AI — pipelines, routing, privacy & modules"
      />

      {/* Tab bar */}
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

      {tab === 'overview' && (
        <OverviewTab
          imgStats={imgStats}
          scrStats={scrStats}
          actStats={actStats}
          routStats={routStats}
          privVerify={privVerify}
          modStats={modStats}
        />
      )}
      {tab === 'image' && <ImageTab stats={imgStats} jobs={imageJobs} />}
      {tab === 'scribe' && <ScribeTab stats={scrStats} sessions={scribeSessions} />}
      {tab === 'actions' && <ActionsTab stats={actStats} executions={actionExecs} />}
      {tab === 'routing' && (
        <RoutingTab
          policy={routPolicy}
          stats={routStats}
          onUpdate={(body) => {
            updateRouting.mutate(body, {
              onSuccess: () => toast.success('Routing policy updated'),
              onError: () => toast.error('Failed to update routing policy'),
            });
          }}
        />
      )}
      {tab === 'privacy' && (
        <PrivacyTab
          policy={privPolicy}
          verify={privVerify}
          audit={privAudit}
          onUpdate={(body) => {
            updatePrivacy.mutate(body, {
              onSuccess: () => toast.success('Privacy policy updated'),
              onError: () => toast.error('Failed to update privacy policy'),
            });
          }}
        />
      )}
      {tab === 'modules' && <ModulesTab modules={modules} stats={modStats} />}
    </>
  );
}

/* ─── Tab Components ─────────────────────────────────────────────────── */

function OverviewTab({
  imgStats,
  scrStats,
  actStats,
  routStats,
  privVerify,
  modStats,
}: {
  imgStats: Record<string, unknown>;
  scrStats: Record<string, unknown>;
  actStats: Record<string, unknown>;
  routStats: Record<string, unknown>;
  privVerify: Record<string, unknown>;
  modStats: Record<string, unknown>;
}) {
  const isIsolated = privVerify.isolated === true;
  const localPct = Number(routStats.local_percentage ?? 0);

  return (
    <div className="space-y-6">
      {/* Privacy banner */}
      <div
        className={`rounded-lg border p-4 ${
          isIsolated
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : 'border-amber-500/30 bg-amber-500/10'
        }`}
      >
        <div className="flex items-center gap-3">
          <Shield className={`h-5 w-5 ${isIsolated ? 'text-emerald-500' : 'text-amber-500'}`} />
          <div>
            <p className="font-semibold">{isIsolated ? 'Fully Isolated' : 'Hybrid Mode'}</p>
            <p className="text-sm opacity-70">
              {isIsolated
                ? 'All AI processing runs locally. No data leaves the server.'
                : 'Complex queries may be routed to cloud.'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Image Jobs" value={imgStats.total_jobs} icon={<Image className="h-4 w-4" />} />
        <StatCard label="Scribe Sessions" value={scrStats.total_sessions} icon={<Mic className="h-4 w-4" />} />
        <StatCard label="Action Execs" value={actStats.total_executions} icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Local %" value={`${localPct}%`} icon={<Route className="h-4 w-4" />} />
        <StatCard label="Modules" value={modStats.installed_count} icon={<Puzzle className="h-4 w-4" />} />
        <StatCard label="Storage" value={`${modStats.total_size_mb ?? 0}MB`} icon={<BrainCircuit className="h-4 w-4" />} />
      </div>

      {/* Routing split bar */}
      <div className="card p-4">
        <p className="mb-3 font-medium">Routing Split</p>
        <div className="flex h-5 overflow-hidden rounded-full">
          {localPct > 0 && (
            <div
              className="flex items-center justify-center bg-emerald-500 text-xs font-bold text-white"
              style={{ width: `${localPct}%` }}
            >
              {localPct >= 15 ? `${localPct}%` : ''}
            </div>
          )}
          {100 - localPct > 0 && (
            <div
              className="flex items-center justify-center bg-sky-500 text-xs font-bold text-white"
              style={{ width: `${100 - localPct}%` }}
            >
              {100 - localPct >= 15 ? `${100 - localPct}%` : ''}
            </div>
          )}
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>🟢 Local: {String(routStats.local_count ?? 0)}</span>
          <span>🔵 Cloud: {String(routStats.cloud_count ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}

function ImageTab({ stats, jobs }: { stats: Record<string, unknown>; jobs: GenericRow[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Jobs" value={stats.total_jobs} />
        <StatCard label="Completed" value={stats.completed} />
        <StatCard label="Avg Time" value={`${stats.avg_processing_ms ?? 0}ms`} />
        <StatCard label="Failed" value={stats.failed ?? 0} />
      </div>
      <div className="card">
        <h3 className="mb-3 font-medium">Recent Jobs</h3>
        {jobs.length === 0 ? (
          <EmptyState icon={Image} title="No image jobs" description="No images processed yet." />
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {jobs.slice(0, 25).map((j, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <StatusDot status={String(j.status ?? 'unknown')} />
                <span className="flex-1 text-sm font-medium">
                  {String(j.category ?? '').replace(/-/g, ' ')}
                </span>
                <span className="text-xs text-slate-500">{String(j.job_id ?? '').slice(0, 8)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScribeTab({ stats, sessions }: { stats: Record<string, unknown>; sessions: GenericRow[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Sessions" value={stats.total_sessions} />
        <StatCard label="Duration" value={`${stats.total_duration_sec ?? 0}s`} />
        <StatCard label="Avg Accuracy" value={String(stats.avg_accuracy ?? 'N/A')} />
        <StatCard label="Languages" value={stats.language_count ?? '13'} />
      </div>
      <div className="card">
        <h3 className="mb-3 font-medium">Recent Sessions</h3>
        {sessions.length === 0 ? (
          <EmptyState icon={Mic} title="No sessions" description="No transcription sessions recorded." />
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {sessions.slice(0, 25).map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <StatusDot status={String(s.status ?? 'unknown')} />
                <span className="flex-1 text-sm">
                  {String(s.language ?? '')} &middot; {String(s.duration_sec ?? 0)}s
                </span>
                <span className="text-xs text-slate-500">{String(s.status ?? '')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionsTab({ stats, executions }: { stats: Record<string, unknown>; executions: GenericRow[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total_executions} />
        <StatCard label="Successful" value={stats.successful} />
        <StatCard label="Failed" value={stats.failed} />
        <StatCard label="Avg Time" value={`${stats.avg_execution_ms ?? 0}ms`} />
      </div>
      <div className="card">
        <h3 className="mb-3 font-medium">Execution History</h3>
        {executions.length === 0 ? (
          <EmptyState icon={Zap} title="No executions" description="No device actions executed." />
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {executions.slice(0, 25).map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <StatusDot status={String(e.status ?? 'unknown')} />
                <span className="flex-1 text-sm font-medium">
                  {String(e.action_name ?? e.action_id ?? 'action')}
                </span>
                <span className="text-xs text-slate-500">{String(e.status ?? '')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RoutingTab({
  policy,
  stats,
  onUpdate,
}: {
  policy: Record<string, unknown>;
  stats: Record<string, unknown>;
  onUpdate: (body: Record<string, unknown>) => void;
}) {
  const preferLocal = policy.prefer_local === true;
  const localPct = Number(stats.local_percentage ?? 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Requests" value={stats.total_requests} />
        <StatCard label="Local" value={stats.local_count} />
        <StatCard label="Cloud" value={stats.cloud_count} />
        <StatCard label="Local %" value={`${localPct}%`} />
      </div>
      <div className="card space-y-4 p-4">
        <h3 className="font-medium">Routing Policy</h3>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={preferLocal}
            onChange={(e) => onUpdate({ prefer_local: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          <span className="text-sm font-medium">Prefer Local Processing</span>
        </label>
        <p className="text-xs text-slate-500">
          {preferLocal
            ? 'All queries processed locally unless model is unavailable.'
            : 'Complex queries automatically routed to cloud when beneficial.'}
        </p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <span className="text-slate-500">Threshold:</span>{' '}
            <strong>{String(policy.complexity_threshold ?? 'medium')}</strong>
          </div>
          <div>
            <span className="text-slate-500">Fallback:</span>{' '}
            <strong>{policy.cloud_fallback === false ? 'Disabled' : 'Enabled'}</strong>
          </div>
          <div>
            <span className="text-slate-500">Offline:</span>{' '}
            <strong>{policy.offline_capable === true ? 'Yes' : 'No'}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivacyTab({
  policy,
  verify,
  audit,
  onUpdate,
}: {
  policy: Record<string, unknown>;
  verify: Record<string, unknown>;
  audit: Record<string, unknown>;
  onUpdate: (body: Record<string, unknown>) => void;
}) {
  const isIsolated = verify.isolated === true;
  const localDefault = policy.local_inference_default === true;
  const telemetry = policy.telemetry_enabled === true;

  return (
    <div className="space-y-6">
      <div
        className={`rounded-lg border p-4 text-center ${
          isIsolated
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : 'border-amber-500/30 bg-amber-500/10'
        }`}
      >
        <Shield className={`mx-auto h-8 w-8 ${isIsolated ? 'text-emerald-500' : 'text-amber-500'}`} />
        <p className="mt-2 text-lg font-semibold">{isIsolated ? 'Fully Isolated' : 'Partial Isolation'}</p>
        <p className="text-sm opacity-70">
          {isIsolated
            ? 'No AI data leaves this server.'
            : 'Some data may be sent to cloud for complex queries.'}
        </p>
      </div>

      <div className="card space-y-4 p-4">
        <h3 className="font-medium">Policy Controls</h3>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={localDefault}
            onChange={(e) => onUpdate({ local_inference_default: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          <span className="text-sm font-medium">Local-Only Inference Default</span>
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={telemetry}
            onChange={(e) => onUpdate({ telemetry_enabled: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          <span className="text-sm font-medium">AI Telemetry</span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Audited" value={audit.total_audited} />
        <StatCard label="Blocked" value={audit.blocked_outbound} />
        <StatCard label="Local" value={audit.local_processed} />
        <StatCard label="Violations" value={audit.violations} />
      </div>
    </div>
  );
}

function ModulesTab({ modules, stats }: { modules: GenericRow[]; stats: Record<string, unknown> }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Installed" value={stats.installed_count} />
        <StatCard label="Available" value={modules.length} />
        <StatCard label="Storage" value={`${stats.total_size_mb ?? 0}MB`} />
      </div>
      <div className="card">
        <h3 className="mb-3 font-medium">Module Catalog</h3>
        {modules.length === 0 ? (
          <EmptyState icon={Puzzle} title="No modules" description="No AI modules available." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {modules.map((m, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{String(m.name ?? 'Module')}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {String(m.category ?? '')} &middot; {String(m.size_mb ?? 0)}MB
                    </p>
                  </div>
                  {Boolean(m.installed) && (
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                      INSTALLED
                    </span>
                  )}
                </div>
                {Boolean(m.description) && (
                  <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">
                    {String(m.description)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Shared Components ──────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: unknown;
  icon?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center p-4 text-center">
      {icon && <div className="mb-1 text-slate-400">{icon}</div>}
      <p className="text-2xl font-bold">{String(value ?? 0)}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'completed' || status === 'executed' || status === 'success'
      ? 'bg-emerald-500'
      : status === 'processing' || status === 'active' || status === 'queued'
        ? 'bg-amber-500'
        : status === 'failed'
          ? 'bg-red-500'
          : 'bg-slate-400';
  return <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${color}`} />;
}
