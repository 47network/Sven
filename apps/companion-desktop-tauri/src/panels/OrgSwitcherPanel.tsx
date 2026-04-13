import { useState, useEffect, useCallback } from 'react';
import { PanelHeader } from '../components/PanelHeader';

const API = import.meta.env.VITE_API_URL ?? '';

interface Org {
  id: string;
  slug: string;
  name: string;
  role: string;
  is_active: boolean;
}

export default function OrgSwitcherPanel() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const token = localStorage.getItem('auth_token') ?? '';

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/v1/users/me/organizations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const j = await r.json();
        setOrgs(j.data?.organizations ?? []);
        setActiveId(j.data?.active_organization_id ?? null);
      }
    } catch {}
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const switchOrg = async (orgId: string) => {
    if (orgId === activeId || switching) return;
    setSwitching(true);
    try {
      const r = await fetch(`${API}/v1/users/me/active-organization`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: orgId }),
      });
      if (r.ok) {
        setActiveId(orgId);
        setOrgs((prev) => prev.map((o) => ({ ...o, is_active: o.id === orgId })));
      }
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="Workspaces" />
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {orgs.length === 0 && (
          <p className="text-sm opacity-50 text-center mt-8">No organisations found.</p>
        )}
        {orgs.map((org) => (
          <button
            key={org.id}
            onClick={() => switchOrg(org.id)}
            disabled={switching}
            className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 transition border ${
              org.id === activeId
                ? 'bg-cyan-500/10 border-cyan-500'
                : 'bg-white/5 border-white/10 hover:bg-white/8'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-cyan-500/15 flex items-center justify-center text-cyan-400 font-bold text-sm">
              {org.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold">{org.name}</div>
              <div className="text-xs opacity-50">{org.slug} · {org.role}</div>
            </div>
            {org.id === activeId && (
              <span className="text-cyan-400 text-lg">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
