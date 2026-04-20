import { useState, useEffect, useCallback } from 'react';
import { PanelHeader } from '../components/PanelHeader';

const API = import.meta.env.VITE_API_URL ?? '';

interface ActivityEvent {
  id: string;
  event_type: string;
  title: string;
  body?: string;
  read: boolean;
  created_at: string;
}

const ICONS: Record<string, string> = {
  chat_created: '💬',
  chat_message: '✉️',
  agent_run: '🤖',
  memory_update: '🧠',
  approval_request: '📋',
  approval_resolved: '✅',
  org_invite: '👥',
  login: '🔑',
  setting_change: '⚙️',
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ActivityPanel() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const token = localStorage.getItem('auth_token') ?? '';

  const load = useCallback(async (before?: string) => {
    try {
      const url = new URL(`${API}/v1/users/me/activity-feed`);
      url.searchParams.set('limit', '50');
      if (before) url.searchParams.set('before', before);

      const r = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const j = await r.json();
        const newEvents = j.data?.events ?? [];
        setEvents((prev) => before ? [...prev, ...newEvents] : newEvents);
        setUnreadCount(j.data?.unread_count ?? 0);
        setHasMore(j.data?.has_more ?? false);
      }
    } catch {}
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    await fetch(`${API}/v1/users/me/activity-feed/mark-read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    setUnreadCount(0);
    setEvents((prev) => prev.map((e) => ({ ...e, read: true })));
  };

  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="Activity Feed" />
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs opacity-50">{unreadCount} unread</span>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs text-cyan-400 hover:underline">
            Mark all read
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {events.length === 0 && (
          <p className="text-center text-sm opacity-40 mt-12">No activity yet.</p>
        )}
        {events.map((ev) => (
          <div
            key={ev.id}
            className={`rounded-lg px-4 py-3 border transition ${
              ev.read
                ? 'bg-white/3 border-white/5'
                : 'bg-cyan-500/5 border-cyan-500/20'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg">{ICONS[ev.event_type] ?? '📌'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <span className={`text-sm ${ev.read ? '' : 'font-semibold'}`}>{ev.title}</span>
                  <span className="text-xs opacity-40 ml-2 whitespace-nowrap">{timeAgo(ev.created_at)}</span>
                </div>
                {ev.body && (
                  <p className="text-xs opacity-50 mt-1 line-clamp-2">{ev.body}</p>
                )}
              </div>
            </div>
          </div>
        ))}
        {hasMore && (
          <button
            onClick={() => {
              const last = events[events.length - 1]?.created_at;
              if (last) load(last);
            }}
            className="w-full text-center text-sm text-cyan-400 py-3 hover:underline"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
