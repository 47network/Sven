'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart3,
  Users,
  MessageSquare,
  Bot,
  CheckCircle,
  Clock,
  TrendingUp,
  RefreshCcw,
} from 'lucide-react';
import { analyticsOverview, type AnalyticsOverviewData } from '@/lib/api';

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'cyan',
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}) {
  const colors: Record<string, string> = {
    cyan: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/20',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20',
    violet: 'from-violet-500/10 to-violet-500/5 border-violet-500/20',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20',
    rose: 'from-rose-500/10 to-rose-500/5 border-rose-500/20',
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-5 ${colors[color] ?? colors.cyan}`}>
      <div className="flex items-center gap-3 mb-3">
        <Icon className="h-5 w-5 opacity-60" />
        <span className="text-sm font-medium opacity-70">{label}</span>
      </div>
      <p className="text-3xl font-bold tracking-tight">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs opacity-50 mt-1">{sub}</p>}
    </div>
  );
}

function MiniBar({ data, maxVal }: { data: number[]; maxVal: number }) {
  return (
    <div className="flex items-end gap-[3px] h-16">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 bg-cyan-500/40 rounded-t"
          style={{ height: `${maxVal > 0 ? (v / maxVal) * 100 : 0}%`, minHeight: v > 0 ? 2 : 0 }}
        />
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await analyticsOverview.getOverview();
      setData(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Analytics Dashboard
        </h1>
        <p className="opacity-50">Loading...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Analytics Dashboard
        </h1>
        <p className="text-red-400">{error || 'No data'}</p>
        <button onClick={load} className="mt-4 text-sm text-cyan-400 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const dailyMsgs = data.daily_activity.map((d) => d.messages);
  const dailyUsers = data.daily_activity.map((d) => d.active_users);
  const maxMsgs = Math.max(1, ...dailyMsgs);
  const maxUsers = Math.max(1, ...dailyUsers);
  const agentSuccessRate =
    data.agent_runs.total_runs > 0
      ? ((data.agent_runs.succeeded / data.agent_runs.total_runs) * 100).toFixed(1)
      : '—';

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Analytics Dashboard
        </h1>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 transition"
        >
          <RefreshCcw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Users}
          label="Total Users"
          value={data.users.total}
          sub={`${data.users.active_7d} active past 7d · ${data.users.active_30d} past 30d`}
          color="cyan"
        />
        <StatCard
          icon={MessageSquare}
          label="Messages"
          value={data.messages.total}
          sub={`${data.messages.last_24h} last 24h · ${data.messages.last_7d} last 7d`}
          color="emerald"
        />
        <StatCard
          icon={Bot}
          label="Agent Runs"
          value={data.agent_runs.total_runs}
          sub={`${agentSuccessRate}% success · ${data.agent_runs.runs_7d} past 7d`}
          color="violet"
        />
        <StatCard
          icon={CheckCircle}
          label="Approvals"
          value={data.approvals.total}
          sub={`${data.approvals.pending} pending · ${data.approvals.approved} approved · ${data.approvals.rejected} rejected`}
          color="amber"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={MessageSquare}
          label="Chats"
          value={data.chats.total}
          sub={`${data.chats.created_7d} new past 7d · ${data.chats.created_30d} past 30d`}
          color="cyan"
        />
        <StatCard
          icon={TrendingUp}
          label="Agent Success"
          value={`${agentSuccessRate}%`}
          sub={`${data.agent_runs.succeeded} ok / ${data.agent_runs.failed} fail`}
          color="emerald"
        />
        <StatCard
          icon={Clock}
          label="Pending Approvals"
          value={data.approvals.pending}
          sub="Awaiting resolution"
          color="rose"
        />
      </div>

      {/* Activity charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/10 p-5">
          <h3 className="text-sm font-medium opacity-70 mb-4">Messages (14 days)</h3>
          <MiniBar data={dailyMsgs} maxVal={maxMsgs} />
          <div className="flex justify-between text-[10px] opacity-40 mt-2">
            {data.daily_activity.length > 0 && (
              <>
                <span>{new Date(data.daily_activity[0].day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <span>{new Date(data.daily_activity[data.daily_activity.length - 1].day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 p-5">
          <h3 className="text-sm font-medium opacity-70 mb-4">Active Users (14 days)</h3>
          <MiniBar data={dailyUsers} maxVal={maxUsers} />
          <div className="flex justify-between text-[10px] opacity-40 mt-2">
            {data.daily_activity.length > 0 && (
              <>
                <span>{new Date(data.daily_activity[0].day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <span>{new Date(data.daily_activity[data.daily_activity.length - 1].day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
