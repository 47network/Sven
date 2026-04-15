// src/panels/FederationPanel.tsx
//
// Federation panel for Sven Desktop.
// Shows identity, peers, homeserver, consent, sovereignty, and mesh health.

import { useState, useEffect, useCallback } from 'react';
import { PanelHeader } from '../components/PanelHeader';

interface FederationPanelProps {
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

type Tab = 'identity' | 'peers' | 'homeserver' | 'consent' | 'health';

export function FederationPanel({ token, apiBase }: FederationPanelProps) {
  const [tab, setTab] = useState<Tab>('identity');
  const [identity, setIdentity] = useState<R>({});
  const [peers, setPeers] = useState<R[]>([]);
  const [connections, setConnections] = useState<R[]>([]);
  const [hsStats, setHsStats] = useState<R>({});
  const [consent, setConsent] = useState<R>({});
  const [consentStats, setConsentStats] = useState<R>({});
  const [sovereignty, setSovereignty] = useState<R>({});
  const [exportPolicy, setExportPolicy] = useState<R>({});
  const [mesh, setMesh] = useState<R>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [id, p, conn, hs, c, cs, sov, ep, mh] = await Promise.all([
      fetchJson(`${apiBase}/v1/admin/federation/identity`, token),
      fetchJson(`${apiBase}/v1/admin/federation/peers`, token),
      fetchJson(`${apiBase}/v1/admin/federation/homeserver/connections`, token),
      fetchJson(`${apiBase}/v1/admin/federation/homeserver/stats`, token),
      fetchJson(`${apiBase}/v1/admin/federation/consent`, token),
      fetchJson(`${apiBase}/v1/admin/federation/consent/stats`, token),
      fetchJson(`${apiBase}/v1/admin/federation/sovereignty`, token),
      fetchJson(`${apiBase}/v1/admin/federation/sovereignty/export-policy`, token),
      fetchJson(`${apiBase}/v1/admin/federation/health/mesh`, token),
    ]);
    setIdentity((id ?? {}) as R);
    setPeers(Array.isArray(p) ? (p as R[]) : []);
    setConnections(Array.isArray(conn) ? (conn as R[]) : []);
    setHsStats((hs ?? {}) as R);
    setConsent((c ?? {}) as R);
    setConsentStats((cs ?? {}) as R);
    setSovereignty((sov ?? {}) as R);
    setExportPolicy((ep ?? {}) as R);
    setMesh((mh ?? {}) as R);
    setLoading(false);
  }, [apiBase, token]);

  useEffect(() => { load(); }, [load]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'identity', label: 'Identity' },
    { key: 'peers', label: 'Peers' },
    { key: 'homeserver', label: 'Homeserver' },
    { key: 'consent', label: 'Consent' },
    { key: 'health', label: 'Health' },
  ];

  async function handshakePeer(id: string) {
    await fetch(`${apiBase}/v1/admin/federation/peers/${encodeURIComponent(id)}/handshake`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    load();
  }

  async function prunePeers() {
    await fetch(`${apiBase}/v1/admin/federation/peers/prune`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    load();
  }

  async function runHealthCheck() {
    await fetch(`${apiBase}/v1/admin/federation/health/check`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    load();
  }

  return (
    <div className="panel">
      <PanelHeader title="Federation" onRefresh={load} />
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
          {tab === 'identity' && (
            <div className="panel-section">
              <h3>Federation Identity</h3>
              {identity.public_key || identity.key_id ? (
                <>
                  <div className="kv-list">
                    <KV label="Key ID" value={identity.key_id} />
                    <KV label="Algorithm" value={identity.algorithm ?? 'ed25519'} />
                  </div>
                  <p className="mono">{String(identity.public_key ?? '').slice(0, 64)}…</p>
                </>
              ) : (
                <p className="empty">No identity generated.</p>
              )}
              <h3>Data Sovereignty</h3>
              <div className="kv-list">
                <KV label="Region" value={sovereignty.data_residency} />
                <KV label="Jurisdiction" value={sovereignty.jurisdiction} />
                <KV label="Enforce Residency" value={sovereignty.enforce_residency} />
                <KV label="Cross-border" value={sovereignty.allow_cross_border} />
              </div>
              <h3>Export Policy</h3>
              <div className="kv-list">
                <KV label="Format" value={exportPolicy.format ?? 'JSON'} />
                <KV label="Encryption" value={exportPolicy.encryption ?? 'AES-256'} />
              </div>
            </div>
          )}
          {tab === 'peers' && (
            <div className="panel-section">
              <div className="card-row" style={{ marginBottom: 12 }}>
                <span>{peers.length} peer(s)</span>
                <button className="btn small" onClick={prunePeers}>Prune Stale</button>
              </div>
              {peers.length === 0 ? (
                <p className="empty">No federation peers.</p>
              ) : (
                peers.map((p, i) => (
                  <div key={i} className="card">
                    <div className="card-row">
                      <strong>{String(p.name ?? p.peer_id ?? `Peer ${i + 1}`)}</strong>
                      <span className={`badge ${p.trust_level === 'verified' ? 'ok' : p.trust_level === 'blocked' ? 'danger' : 'warn'}`}>
                        {String(p.trust_level ?? 'pending')}
                      </span>
                    </div>
                    <p className="sub">{String(p.endpoint ?? p.url ?? '')}</p>
                    <p className="sub">Last seen: {String(p.last_seen ?? 'never')}</p>
                    {p.trust_level === 'pending' && (
                      <div className="card-actions">
                        <button className="btn small" onClick={() => handshakePeer(String(p.peer_id ?? p.id))}>
                          Handshake
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          {tab === 'homeserver' && (
            <div className="panel-section">
              <div className="stat-grid">
                <Stat label="Connections" value={connections.length} />
                <Stat label="Messages" value={hsStats.messages_relayed} />
                <Stat label="Uptime" value={hsStats.uptime} />
              </div>
              <h3>Connected Homeservers</h3>
              {connections.length === 0 ? (
                <p className="empty">No connections.</p>
              ) : (
                connections.map((c, i) => (
                  <div key={i} className="card">
                    <div className="card-row">
                      <strong>{String(c.server_name ?? c.host ?? `Server ${i + 1}`)}</strong>
                      <span className={`badge ${c.status === 'connected' ? 'ok' : ''}`}>
                        {String(c.status ?? 'unknown')}
                      </span>
                    </div>
                    <p className="sub">{String(c.endpoint ?? c.url ?? '')}</p>
                  </div>
                ))
              )}
            </div>
          )}
          {tab === 'consent' && (
            <div className="panel-section">
              <div className="stat-grid">
                <Stat label="Consented" value={consentStats.consented} />
                <Stat label="Revoked" value={consentStats.revoked} />
                <Stat label="Rate" value={consentStats.consent_rate ? `${String(consentStats.consent_rate)}%` : undefined} />
              </div>
              <h3>Consent Settings</h3>
              <div className="kv-list">
                <KV label="Allow Federation" value={consent.allow_federation} />
                <KV label="Data Sharing" value={consent.allow_data_sharing} />
                <KV label="Identity Disclosure" value={consent.allow_identity_disclosure} />
                <KV label="Message Relay" value={consent.allow_message_relay} />
              </div>
            </div>
          )}
          {tab === 'health' && (
            <div className="panel-section">
              <div className="stat-grid">
                <Stat label="Status" value={mesh.status} />
                <Stat label="Healthy" value={mesh.healthy} />
                <Stat label="Degraded" value={mesh.degraded} />
              </div>
              <button className="btn" onClick={runHealthCheck} style={{ marginBottom: 12 }}>
                Run Health Check
              </button>
              <h3>Peer Health</h3>
              {(() => {
                const meshPeers = (mesh.peers ?? mesh.nodes) as R[] | undefined;
                const list = Array.isArray(meshPeers) ? meshPeers : [];
                if (list.length === 0) return <p className="empty">Run a health check to see status.</p>;
                return list.map((p, i) => (
                  <div key={i} className="card">
                    <div className="card-row">
                      <strong>{String(p.name ?? p.peer_id ?? `Peer ${i + 1}`)}</strong>
                      <span className={`badge ${p.status === 'healthy' ? 'ok' : p.status === 'degraded' ? 'warn' : 'danger'}`}>
                        {String(p.status ?? 'unknown')}
                      </span>
                    </div>
                    <p className="sub">Latency: {String(p.latency_ms ?? '?')}ms · Last: {String(p.last_check ?? 'never')}</p>
                  </div>
                ));
              })()}
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

function KV({ label, value }: { label: string; value: unknown }) {
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? 'N/A');
  return (
    <div className="kv-row">
      <span className="kv-key">{label}</span>
      <span className="kv-val">{display}</span>
    </div>
  );
}
