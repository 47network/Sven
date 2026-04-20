// src/panels/CommunityAgentsPanel.tsx
//
// Community Agents panel for Sven Desktop.
// Shows agent personas, moderation queue, transparency changelog,
// corrections pipeline, and self-improvement metrics.

import { useState, useEffect, useCallback } from 'react';
import { PanelHeader } from '../components/PanelHeader';

interface CommunityAgentsPanelProps {
  token: string;
  apiBase: string;
}

type R = Record<string, unknown>;

async function fetchJson(url: string, token: string): Promise<unknown> {
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return {};
    const body = (await r.json()) as R;
    return body.data ?? body;
  } catch {
    return {};
  }
}

type Tab = 'personas' | 'moderation' | 'changelog' | 'corrections' | 'improvement';

export function CommunityAgentsPanel({ token, apiBase }: CommunityAgentsPanelProps) {
  const [tab, setTab] = useState<Tab>('personas');
  const [personas, setPersonas] = useState<R[]>([]);
  const [moderation, setModeration] = useState<R[]>([]);
  const [changelog, setChangelog] = useState<R[]>([]);
  const [corrections, setCorrections] = useState<R[]>([]);
  const [calibration, setCalibration] = useState<R>({});
  const [snapshots, setSnapshots] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, m, cl, cor, cal, snap] = await Promise.all([
      fetchJson(`${apiBase}/v1/admin/community-agents/personas`, token),
      fetchJson(`${apiBase}/v1/admin/community-agents/moderation/pending`, token),
      fetchJson(`${apiBase}/v1/admin/community-agents/changelog`, token),
      fetchJson(`${apiBase}/v1/admin/community-agents/corrections`, token),
      fetchJson(`${apiBase}/v1/admin/community-agents/confidence/calibration`, token),
      fetchJson(`${apiBase}/v1/admin/community-agents/self-improvement/snapshots`, token),
    ]);
    setPersonas(Array.isArray(p) ? (p as R[]) : []);
    setModeration(Array.isArray(m) ? (m as R[]) : []);
    setChangelog(Array.isArray(cl) ? (cl as R[]) : []);
    setCorrections(Array.isArray(cor) ? (cor as R[]) : []);
    setCalibration((cal && typeof cal === 'object' && !Array.isArray(cal) ? cal : {}) as R);
    setSnapshots(Array.isArray(snap) ? (snap as R[]) : []);
    setLoading(false);
  }, [apiBase, token]);

  useEffect(() => { load(); }, [load]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'personas', label: 'Personas' },
    { key: 'moderation', label: 'Moderation' },
    { key: 'changelog', label: 'Changelog' },
    { key: 'corrections', label: 'Corrections' },
    { key: 'improvement', label: 'Self-Improvement' },
  ];

  async function reviewItem(id: string, decision: string) {
    await fetch(`${apiBase}/v1/admin/community-agents/moderation/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, explanation: `${decision} via desktop` }),
    });
    load();
  }

  async function publishEntry(id: string) {
    await fetch(`${apiBase}/v1/admin/community-agents/changelog/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    load();
  }

  async function verifyCorrection(id: string) {
    await fetch(`${apiBase}/v1/admin/community-agents/corrections/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    load();
  }

  return (
    <div className="panel">
      <PanelHeader title="Community Agents" onRefresh={load} />
      <div className="tab-bar">
        {tabs.map((t) => (
          <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="panel-center">Loading…</div>
      ) : (
        <div className="panel-scroll">
          {tab === 'personas' && (
            <div className="panel-section">
              <h3>Agent Personas ({personas.length})</h3>
              {personas.length === 0 ? (
                <p className="empty">No agent personas configured.</p>
              ) : (
                personas.map((p, i) => (
                  <div key={i} className="card">
                    <div className="card-row">
                      <strong>{String(p.name ?? p.agent_id ?? 'Agent')}</strong>
                      <span className={`badge ${p.status === 'active' ? 'ok' : ''}`}>{String(p.status ?? 'unknown')}</span>
                    </div>
                    <p className="sub">{String(p.type ?? '')} {p.community_visible ? ' · Visible' : ''}</p>
                  </div>
                ))
              )}
            </div>
          )}
          {tab === 'moderation' && (
            <div className="panel-section">
              <h3>Pending Reviews ({moderation.length})</h3>
              {moderation.length === 0 ? (
                <p className="empty">Queue clear.</p>
              ) : (
                moderation.map((m, i) => (
                  <div key={i} className="card">
                    <div className="card-row">
                      <strong>{String(m.agent_name ?? m.agent_id ?? 'Agent')}</strong>
                      <span className="badge warn">{String(m.risk_level ?? 'pending')}</span>
                    </div>
                    <p className="sub">{String(m.content ?? m.message ?? '')}</p>
                    <div className="card-actions">
                      <button className="btn ok" onClick={() => reviewItem(String(m.decision_id ?? m.id), 'approved')}>Approve</button>
                      <button className="btn danger" onClick={() => reviewItem(String(m.decision_id ?? m.id), 'rejected')}>Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {tab === 'changelog' && (
            <div className="panel-section">
              <h3>Transparency Changelog ({changelog.length})</h3>
              {changelog.length === 0 ? (
                <p className="empty">No entries.</p>
              ) : (
                changelog.map((e, i) => (
                  <div key={i} className="card">
                    <div className="card-row">
                      <strong>{String(e.title ?? e.type ?? 'Entry')}</strong>
                      {e.published ? (
                        <span className="badge ok">Published</span>
                      ) : (
                        <button className="btn small" onClick={() => publishEntry(String(e.entry_id ?? e.id))}>Publish</button>
                      )}
                    </div>
                    <p className="sub">{String(e.content ?? e.body ?? '')}</p>
                  </div>
                ))
              )}
            </div>
          )}
          {tab === 'corrections' && (
            <div className="panel-section">
              <h3>Corrections Pipeline ({corrections.length})</h3>
              {corrections.length === 0 ? (
                <p className="empty">No corrections.</p>
              ) : (
                corrections.map((c, i) => (
                  <div key={i} className="card">
                    <div className="card-row">
                      <span>{String(c.original_response ?? '').slice(0, 80) || 'Original'}</span>
                      <span className={`badge ${c.status === 'verified' ? 'ok' : c.status === 'promoted' ? 'info' : 'warn'}`}>
                        {String(c.status ?? 'pending')}
                      </span>
                    </div>
                    <p className="sub correction">→ {String(c.correction ?? c.corrected_response ?? '')}</p>
                    {c.status === 'pending' && (
                      <div className="card-actions">
                        <button className="btn ok" onClick={() => verifyCorrection(String(c.correction_id ?? c.id))}>Verify</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          {tab === 'improvement' && (
            <div className="panel-section">
              <div className="stat-grid">
                <Stat label="Avg Confidence" value={calibration.avg_confidence} />
                <Stat label="Calibration" value={calibration.calibration_score} />
              </div>
              <h3>Improvement Snapshots ({snapshots.length})</h3>
              {snapshots.length === 0 ? (
                <p className="empty">No snapshots.</p>
              ) : (
                snapshots.map((s, i) => (
                  <div key={i} className="card">
                    <strong>{String(s.date ?? s.snapshot_date ?? `Snapshot ${i + 1}`)}</strong>
                    <div className="stat-grid small">
                      <Stat label="Corr. Rate" value={s.correction_rate} />
                      <Stat label="Confidence" value={s.avg_confidence} />
                      <Stat label="Patterns" value={s.patterns_found} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{String(value ?? 'N/A')}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
