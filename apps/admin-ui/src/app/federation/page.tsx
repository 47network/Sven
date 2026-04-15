'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import {
  useFederationIdentity,
  useGenerateIdentity,
  useRotateIdentity,
  useIdentityHistory,
  useFederationPeers,
  useRegisterPeer,
  useHandshakePeer,
  usePrunePeers,
  useHomeserverConnections,
  useHomeserverStats,
  useHomeserverConfig,
  useFederatedTopics,
  useCommunitySummaryFed,
  useDelegations,
  useDelegationSummary,
  useFederationConsent,
  useUpdateFederationConsent,
  useConsentStats,
  useSovereignty,
  useUpdateSovereignty,
  useExportPolicy,
  useMeshHealth,
  useHealthCheck,
} from '@/lib/hooks';
import {
  Globe,
  Key,
  Users,
  Server,
  MessageSquare,
  Share2,
  Shield,
  Lock,
  Activity,
  RefreshCw,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type Tab = 'identity' | 'peers' | 'homeserver' | 'community' | 'delegations' | 'consent' | 'sovereignty' | 'health';

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

export default function FederationPage() {
  const [tab, setTab] = useState<Tab>('identity');

  const { data: identityData, isLoading } = useFederationIdentity();
  const { data: historyData } = useIdentityHistory();
  const { data: peersData } = useFederationPeers();
  const { data: connectionsData } = useHomeserverConnections();
  const { data: hsStatsData } = useHomeserverStats();
  const { data: hsConfigData } = useHomeserverConfig();
  const { data: topicsData } = useFederatedTopics();
  const { data: commSummaryData } = useCommunitySummaryFed();
  const { data: delegationsData } = useDelegations();
  const { data: delSummaryData } = useDelegationSummary();
  const { data: consentData } = useFederationConsent();
  const { data: consentStatsData } = useConsentStats();
  const { data: sovereigntyData } = useSovereignty();
  const { data: exportPolicyData } = useExportPolicy();
  const { data: meshData } = useMeshHealth();

  const generateId = useGenerateIdentity();
  const rotateId = useRotateIdentity();
  const registerPeer = useRegisterPeer();
  const handshake = useHandshakePeer();
  const prunePeers = usePrunePeers();
  const updateConsent = useUpdateFederationConsent();
  const updateSov = useUpdateSovereignty();
  const healthCheck = useHealthCheck();

  const identity = toR(identityData?.rows?.[0] ?? identityData);
  const history = toArr(historyData);
  const peers = toArr(peersData);
  const connections = toArr(connectionsData);
  const hsStats = toR(hsStatsData?.rows?.[0] ?? hsStatsData);
  const hsConfig = toR(hsConfigData?.rows?.[0] ?? hsConfigData);
  const topics = toArr(topicsData);
  const commSummary = toR(commSummaryData?.rows?.[0] ?? commSummaryData);
  const delegations = toArr(delegationsData);
  const delSummary = toR(delSummaryData?.rows?.[0] ?? delSummaryData);
  const consent = toR(consentData?.rows?.[0] ?? consentData);
  const consentStats = toR(consentStatsData?.rows?.[0] ?? consentStatsData);
  const sovereignty = toR(sovereigntyData?.rows?.[0] ?? sovereigntyData);
  const exportPolicy = toR(exportPolicyData?.rows?.[0] ?? exportPolicyData);
  const mesh = toR(meshData?.rows?.[0] ?? meshData);

  if (isLoading) return <PageSpinner />;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'identity', label: 'Identity', icon: <Key className="h-4 w-4" /> },
    { key: 'peers', label: 'Peers', icon: <Users className="h-4 w-4" /> },
    { key: 'homeserver', label: 'Homeserver', icon: <Server className="h-4 w-4" /> },
    { key: 'community', label: 'Community', icon: <MessageSquare className="h-4 w-4" /> },
    { key: 'delegations', label: 'Delegations', icon: <Share2 className="h-4 w-4" /> },
    { key: 'consent', label: 'Consent', icon: <Shield className="h-4 w-4" /> },
    { key: 'sovereignty', label: 'Sovereignty', icon: <Lock className="h-4 w-4" /> },
    { key: 'health', label: 'Health', icon: <Activity className="h-4 w-4" /> },
  ];

  return (
    <>
      <PageHeader title="Federation" description="Identity, peers, homeserver, community, delegations, consent & sovereignty" />
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

      {tab === 'identity' && (
        <IdentityTab
          identity={identity}
          history={history}
          onGenerate={() => generateId.mutate(undefined, { onSuccess: () => toast.success('Identity generated'), onError: () => toast.error('Generation failed') })}
          onRotate={() => rotateId.mutate(undefined, { onSuccess: () => toast.success('Key rotated'), onError: () => toast.error('Rotation failed') })}
        />
      )}
      {tab === 'peers' && (
        <PeersTab
          peers={peers}
          onHandshake={(id) => handshake.mutate(id, { onSuccess: () => toast.success('Handshake initiated'), onError: () => toast.error('Handshake failed') })}
          onPrune={() => prunePeers.mutate(undefined, { onSuccess: () => toast.success('Stale peers pruned'), onError: () => toast.error('Prune failed') })}
        />
      )}
      {tab === 'homeserver' && <HomeserverTab connections={connections} stats={hsStats} config={hsConfig} />}
      {tab === 'community' && <CommunityTab topics={topics} summary={commSummary} />}
      {tab === 'delegations' && <DelegationsTab delegations={delegations} summary={delSummary} />}
      {tab === 'consent' && (
        <ConsentTab
          consent={consent}
          stats={consentStats}
          onUpdate={(updates) => updateConsent.mutate(updates, { onSuccess: () => toast.success('Consent updated'), onError: () => toast.error('Update failed') })}
        />
      )}
      {tab === 'sovereignty' && (
        <SovereigntyTab
          sovereignty={sovereignty}
          exportPolicy={exportPolicy}
          onUpdate={(updates) => updateSov.mutate(updates, { onSuccess: () => toast.success('Sovereignty updated'), onError: () => toast.error('Update failed') })}
        />
      )}
      {tab === 'health' && (
        <HealthTab
          mesh={mesh}
          onCheck={() => healthCheck.mutate('', { onSuccess: () => toast.success('Health check complete'), onError: () => toast.error('Health check failed') })}
        />
      )}
    </>
  );
}

/* ─── Identity ───────────────────────────────────────────────────────── */

function IdentityTab({ identity, history, onGenerate, onRotate }: { identity: R; history: R[]; onGenerate: () => void; onRotate: () => void }) {
  const hasIdentity = !!identity.public_key || !!identity.key_id;
  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">Federation Identity</h3>
            {hasIdentity ? (
              <>
                <p className="mt-2 text-xs text-slate-500">Key ID: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{String(identity.key_id ?? '')}</code></p>
                <p className="mt-1 text-xs text-slate-500">Algorithm: {String(identity.algorithm ?? 'ed25519')}</p>
                <p className="mt-1 text-xs font-mono text-slate-400 break-all">{String(identity.public_key ?? '').slice(0, 64)}…</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No federation identity generated yet.</p>
            )}
          </div>
          <div className="flex gap-2">
            {!hasIdentity && (
              <button onClick={onGenerate} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700">Generate Identity</button>
            )}
            {hasIdentity && (
              <button onClick={onRotate} className="flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700">
                <RefreshCw className="h-3 w-3" /> Rotate Key
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="card">
        <h3 className="mb-3 font-medium">Key History</h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500 p-4">No key rotation history.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium">{String(h.key_id ?? `Key ${i + 1}`)}</p>
                  <p className="text-xs text-slate-500">{String(h.algorithm ?? 'ed25519')} · Created {String(h.created_at ?? '')}</p>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${h.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}`}>
                  {h.active ? 'Active' : 'Retired'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Peers ──────────────────────────────────────────────────────────── */

function PeersTab({ peers, onHandshake, onPrune }: { peers: R[]; onHandshake: (id: string) => void; onPrune: () => void }) {
  const trustColors: Record<string, string> = { verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', blocked: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{peers.length} peer(s) registered</p>
        <button onClick={onPrune} className="flex items-center gap-1 rounded-md bg-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600">
          <Trash2 className="h-3 w-3" /> Prune Stale
        </button>
      </div>
      {peers.length === 0 ? (
        <EmptyState icon={Users} title="No peers" description="No federation peers registered." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {peers.map((p, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{String(p.name ?? p.peer_id ?? `Peer ${i + 1}`)}</p>
                  <p className="text-xs text-slate-500 break-all">{String(p.endpoint ?? p.url ?? '')}</p>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${trustColors[String(p.trust_level ?? 'pending')] ?? trustColors.pending}`}>
                  {String(p.trust_level ?? 'pending')}
                </span>
              </div>
              {p.trust_level === 'pending' && (
                <button onClick={() => onHandshake(String(p.peer_id ?? p.id))} className="mt-3 rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-700">
                  Initiate Handshake
                </button>
              )}
              <p className="mt-2 text-xs text-slate-400">Last seen: {String(p.last_seen ?? 'never')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Homeserver ─────────────────────────────────────────────────────── */

function HomeserverTab({ connections, stats, config }: { connections: R[]; stats: R; config: R }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Active Connections" value={stats.active_connections ?? connections.length} />
        <Stat label="Messages Relayed" value={stats.messages_relayed ?? 0} />
        <Stat label="Uptime" value={stats.uptime ?? 'N/A'} />
        <Stat label="Protocol Version" value={config.protocol_version ?? 'v1'} />
      </div>
      <div className="card">
        <h3 className="mb-3 font-medium">Connected Homeservers</h3>
        {connections.length === 0 ? (
          <EmptyState icon={Server} title="No connections" description="No homeserver connections active." />
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {connections.map((c, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="font-medium text-sm">{String(c.server_name ?? c.host ?? `Server ${i + 1}`)}</p>
                  <p className="text-xs text-slate-500">{String(c.endpoint ?? c.url ?? '')}</p>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                  c.status === 'connected' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                }`}>{String(c.status ?? 'unknown')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Community ──────────────────────────────────────────────────────── */

function CommunityTab({ topics, summary }: { topics: R[]; summary: R }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total Topics" value={summary.total_topics ?? topics.length} />
        <Stat label="Active Discussions" value={summary.active_discussions ?? 0} />
        <Stat label="Federated Peers" value={summary.participating_peers ?? 0} />
        <Stat label="Messages Today" value={summary.messages_today ?? 0} />
      </div>
      <div className="card">
        <h3 className="mb-3 font-medium">Federated Topics</h3>
        {topics.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No topics" description="No federated community topics." />
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {topics.map((t, i) => (
              <div key={i} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{String(t.title ?? t.name ?? `Topic ${i + 1}`)}</p>
                  <span className="text-xs text-slate-500">{String(t.peer_count ?? 0)} peers</span>
                </div>
                {Boolean(t.description) && <p className="mt-1 text-xs text-slate-400 line-clamp-1">{String(t.description)}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Delegations ────────────────────────────────────────────────────── */

function DelegationsTab({ delegations, summary }: { delegations: R[]; summary: R }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Active Delegations" value={summary.active ?? 0} />
        <Stat label="Expired" value={summary.expired ?? 0} />
        <Stat label="Total" value={summary.total ?? delegations.length} />
        <Stat label="Pending Approval" value={summary.pending ?? 0} />
      </div>
      <div className="card">
        <h3 className="mb-3 font-medium">Delegation List</h3>
        {delegations.length === 0 ? (
          <EmptyState icon={Share2} title="No delegations" description="No data-sharing delegations configured." />
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {delegations.map((d, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="font-medium text-sm">{String(d.peer_name ?? d.delegate_to ?? `Delegation ${i + 1}`)}</p>
                  <p className="text-xs text-slate-500">Scope: {String(d.scope ?? 'full')} · Expires: {String(d.expires_at ?? 'never')}</p>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                  d.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                  d.status === 'expired' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800' :
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                }`}>{String(d.status ?? 'pending')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Consent ────────────────────────────────────────────────────────── */

function ConsentTab({ consent, stats, onUpdate }: { consent: R; stats: R; onUpdate: (updates: R) => void }) {
  const fields = [
    { key: 'allow_federation', label: 'Allow Federation' },
    { key: 'allow_data_sharing', label: 'Allow Data Sharing' },
    { key: 'allow_identity_disclosure', label: 'Allow Identity Disclosure' },
    { key: 'allow_message_relay', label: 'Allow Message Relay' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Consented Users" value={stats.consented ?? 0} />
        <Stat label="Revoked" value={stats.revoked ?? 0} />
        <Stat label="Pending" value={stats.pending ?? 0} />
        <Stat label="Consent Rate" value={stats.consent_rate ? `${String(stats.consent_rate)}%` : 'N/A'} />
      </div>
      <div className="card p-5">
        <h3 className="mb-4 font-semibold">Federation Consent Settings</h3>
        <div className="space-y-3">
          {fields.map((f) => (
            <label key={f.key} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!consent[f.key]}
                onChange={(e) => onUpdate({ ...consent, [f.key]: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm">{f.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Sovereignty ────────────────────────────────────────────────────── */

function SovereigntyTab({ sovereignty, exportPolicy, onUpdate }: { sovereignty: R; exportPolicy: R; onUpdate: (updates: R) => void }) {
  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="mb-4 font-semibold">Data Sovereignty</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-500">Data Residency Region</label>
            <input
              type="text"
              value={String(sovereignty.data_residency ?? '')}
              onChange={(e) => onUpdate({ ...sovereignty, data_residency: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              placeholder="e.g. eu-west-1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Jurisdiction</label>
            <input
              type="text"
              value={String(sovereignty.jurisdiction ?? '')}
              onChange={(e) => onUpdate({ ...sovereignty, jurisdiction: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              placeholder="e.g. EU, US, APAC"
            />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={!!sovereignty.enforce_residency} onChange={(e) => onUpdate({ ...sovereignty, enforce_residency: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            <span className="text-sm">Enforce data residency restrictions</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={!!sovereignty.allow_cross_border} onChange={(e) => onUpdate({ ...sovereignty, allow_cross_border: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            <span className="text-sm">Allow cross-border data transfers</span>
          </label>
        </div>
      </div>
      <div className="card p-5">
        <h3 className="mb-3 font-semibold">Export Policy</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-slate-500">Format:</span> <strong>{String(exportPolicy.format ?? 'JSON')}</strong></div>
          <div><span className="text-slate-500">Encryption:</span> <strong>{String(exportPolicy.encryption ?? 'AES-256')}</strong></div>
          <div><span className="text-slate-500">Max Export Size:</span> <strong>{String(exportPolicy.max_size ?? 'Unlimited')}</strong></div>
          <div><span className="text-slate-500">Retention:</span> <strong>{String(exportPolicy.retention_days ?? 'N/A')} days</strong></div>
        </div>
      </div>
    </div>
  );
}

/* ─── Health ─────────────────────────────────────────────────────────── */

function HealthTab({ mesh, onCheck }: { mesh: R; onCheck: () => void }) {
  const meshPeers = toArr(mesh.peers ?? mesh.nodes);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Mesh Status" value={mesh.status ?? 'unknown'} />
          <Stat label="Healthy Peers" value={mesh.healthy ?? 0} />
          <Stat label="Degraded" value={mesh.degraded ?? 0} />
        </div>
        <button onClick={onCheck} className="flex items-center gap-1 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700">
          <RefreshCw className="h-3 w-3" /> Run Health Check
        </button>
      </div>
      <div className="card">
        <h3 className="mb-3 font-medium">Peer Health</h3>
        {meshPeers.length === 0 ? (
          <EmptyState icon={Activity} title="No data" description="Run a health check to see federation mesh status." />
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {meshPeers.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="font-medium text-sm">{String(p.name ?? p.peer_id ?? `Peer ${i + 1}`)}</p>
                  <p className="text-xs text-slate-500">Latency: {String(p.latency_ms ?? '?')}ms · Last check: {String(p.last_check ?? 'never')}</p>
                </div>
                <span className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                  p.status === 'healthy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                  p.status === 'degraded' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                }`}>
                  {p.status === 'healthy' && <CheckCircle2 className="h-3 w-3" />}
                  {String(p.status ?? 'unknown')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
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
