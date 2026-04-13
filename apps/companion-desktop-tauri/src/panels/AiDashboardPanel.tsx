// src/panels/AiDashboardPanel.tsx
//
// Unified AI capabilities dashboard for Sven Desktop.
// Shows pipeline stats, smart routing, privacy status, and module catalog.
// All data fetched from gateway-api admin endpoints.

import { useState, useEffect, useCallback } from 'react';
import { PanelHeader } from '../components/PanelHeader';

interface AiDashboardPanelProps {
  token: string;
  apiBase: string;
}

interface PipelineStats {
  image: Record<string, unknown>;
  scribe: Record<string, unknown>;
  actions: Record<string, unknown>;
}

interface RoutingStats {
  local_percentage?: number;
  total_requests?: number;
  local_count?: number;
  cloud_count?: number;
  avg_local_ms?: number;
  avg_cloud_ms?: number;
}

interface PrivacyPolicy {
  local_inference_default?: boolean;
  telemetry_enabled?: boolean;
}

interface IsolationResult {
  isolated?: boolean;
  last_verified?: string;
}

interface ModuleStats {
  installed_count?: number;
  total_size_mb?: number;
}

async function fetchJson(url: string, token: string): Promise<unknown> {
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return {};
    const body = (await r.json()) as Record<string, unknown>;
    return body.data ?? body;
  } catch {
    return {};
  }
}

export function AiDashboardPanel({ token, apiBase }: AiDashboardPanelProps) {
  const [pipelineStats, setPipelineStats] = useState<PipelineStats>({
    image: {},
    scribe: {},
    actions: {},
  });
  const [routingStats, setRoutingStats] = useState<RoutingStats>({});
  const [privacyPolicy, setPrivacyPolicy] = useState<PrivacyPolicy>({});
  const [isolation, setIsolation] = useState<IsolationResult>({});
  const [moduleStats, setModuleStats] = useState<ModuleStats>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [img, scr, act, rout, priv, iso, mods] = await Promise.all([
      fetchJson(`${apiBase}/v1/admin/pipeline/image/stats`, token),
      fetchJson(`${apiBase}/v1/admin/pipeline/scribe/stats`, token),
      fetchJson(`${apiBase}/v1/admin/pipeline/actions/stats`, token),
      fetchJson(`${apiBase}/v1/admin/gemma4/routing/stats`, token),
      fetchJson(`${apiBase}/v1/admin/gemma4/privacy/policy`, token),
      fetchJson(`${apiBase}/v1/admin/gemma4/privacy/verify`, token),
      fetchJson(`${apiBase}/v1/admin/gemma4/modules/stats`, token),
    ]);
    setPipelineStats({
      image: img as Record<string, unknown>,
      scribe: scr as Record<string, unknown>,
      actions: act as Record<string, unknown>,
    });
    setRoutingStats(rout as RoutingStats);
    setPrivacyPolicy(priv as PrivacyPolicy);
    setIsolation(iso as IsolationResult);
    setModuleStats(mods as ModuleStats);
    setLoading(false);
  }, [apiBase, token]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const localPct = routingStats.local_percentage ?? 0;
  const cloudPct = 100 - localPct;
  const isIsolated = isolation.isolated === true;

  return (
    <div className="panel ai-dashboard-panel">
      <PanelHeader
        title="AI Dashboard"
        subtitle="On-device AI capabilities, pipelines & privacy controls"
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
          Loading AI dashboard...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ── Privacy Status ── */}
          <div
            className="card"
            style={{
              borderLeft: `4px solid ${isIsolated ? 'var(--ok)' : 'var(--warn)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>
                {isIsolated ? '🛡️' : '☁️'}
              </span>
              <div>
                <strong>
                  {isIsolated ? 'Fully Isolated' : 'Hybrid Mode'}
                </strong>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {isIsolated
                    ? 'All AI processing runs locally. No data leaves this machine.'
                    : 'Complex queries may be routed to cloud. Toggle in Privacy.'}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 12 }}>
              <span>
                Local default:{' '}
                <strong>
                  {privacyPolicy.local_inference_default ? 'ON' : 'OFF'}
                </strong>
              </span>
              <span>
                Telemetry:{' '}
                <strong>
                  {privacyPolicy.telemetry_enabled ? 'ON' : 'OFF'}
                </strong>
              </span>
            </div>
          </div>

          {/* ── Routing Split ── */}
          <div className="card">
            <strong style={{ display: 'block', marginBottom: 10 }}>
              Smart Routing
            </strong>
            <div
              style={{
                height: 20,
                borderRadius: 10,
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              {localPct > 0 && (
                <div
                  style={{
                    flex: localPct,
                    backgroundColor: 'var(--ok)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  {localPct >= 15 ? `${localPct}%` : ''}
                </div>
              )}
              {cloudPct > 0 && (
                <div
                  style={{
                    flex: cloudPct,
                    backgroundColor: 'var(--info)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  {cloudPct >= 15 ? `${cloudPct}%` : ''}
                </div>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                marginTop: 8,
                opacity: 0.7,
              }}
            >
              <span>🟢 Local: {routingStats.local_count ?? 0}</span>
              <span>🔵 Cloud: {routingStats.cloud_count ?? 0}</span>
              <span>Total: {routingStats.total_requests ?? 0}</span>
            </div>
          </div>

          {/* ── Pipeline Stats ── */}
          <div className="card">
            <strong style={{ display: 'block', marginBottom: 10 }}>
              AI Pipelines
            </strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <PipelineCard
                label="Image Analysis"
                emoji="🖼️"
                total={pipelineStats.image.total_jobs as number ?? 0}
                completed={pipelineStats.image.completed as number ?? 0}
              />
              <PipelineCard
                label="Audio Scribe"
                emoji="🎙️"
                total={pipelineStats.scribe.total_sessions as number ?? 0}
                completed={pipelineStats.scribe.completed as number ?? 0}
              />
              <PipelineCard
                label="Device Actions"
                emoji="⚡"
                total={pipelineStats.actions.total_executions as number ?? 0}
                completed={pipelineStats.actions.successful as number ?? 0}
              />
            </div>
          </div>

          {/* ── Modules ── */}
          <div className="card">
            <strong style={{ display: 'block', marginBottom: 8 }}>
              AI Modules
            </strong>
            <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
              <span>
                Installed: <strong>{moduleStats.installed_count ?? 0}</strong>
              </span>
              <span>
                Storage: <strong>{moduleStats.total_size_mb ?? 0} MB</strong>
              </span>
            </div>
          </div>

          {/* ── Refresh ── */}
          <button
            className="btn btn-secondary"
            onClick={() => void load()}
            style={{ alignSelf: 'center' }}
          >
            Refresh Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

function PipelineCard({
  label,
  emoji,
  total,
  completed,
}: {
  label: string;
  emoji: string;
  total: number;
  completed: number;
}) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '12px 8px',
        borderRadius: 10,
        backgroundColor: 'var(--surface-2)',
      }}
    >
      <div style={{ fontSize: 20, marginBottom: 4 }}>{emoji}</div>
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{total}</div>
      <div style={{ fontSize: 10, opacity: 0.6 }}>
        {completed} completed
      </div>
    </div>
  );
}
