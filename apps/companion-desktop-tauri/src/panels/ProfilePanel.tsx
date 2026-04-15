// src/panels/ProfilePanel.tsx
//
// User profile viewer/editor for Sven Desktop.
// Fetches and updates the current user's profile via gateway-api.

import { useState, useEffect, useCallback } from 'react';
import { PanelHeader } from '../components/PanelHeader';

interface ProfilePanelProps {
  token: string;
  apiBase: string;
}

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  timezone: string;
  status_emoji: string;
  status_text: string;
  role: string;
  created_at: string;
  organization_name?: string;
}

export function ProfilePanel({ token, apiBase }: ProfilePanelProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [timezone, setTimezone] = useState('');
  const [statusEmoji, setStatusEmoji] = useState('');
  const [statusText, setStatusText] = useState('');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/v1/users/me/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
      const json = await res.json();
      const data: UserProfile = json.data ?? json;
      setProfile(data);
      setDisplayName(data.display_name || '');
      setBio(data.bio || '');
      setTimezone(data.timezone || 'UTC');
      setStatusEmoji(data.status_emoji || '');
      setStatusText(data.status_text || '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [apiBase, token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${apiBase}/v1/users/me`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          display_name: displayName,
          bio,
          timezone,
          status_emoji: statusEmoji,
          status_text: statusText,
        }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const json = await res.json();
      const data: UserProfile = json.data ?? json;
      setProfile(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <PanelHeader title="Profile" subtitle="Loading…" />
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">Loading profile…</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Profile" subtitle={profile ? `@${profile.username}` : 'Your profile'} />

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
        )}
        {success && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">Profile saved</div>
        )}

        {/* Identity card */}
        {profile && (
          <div className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)]/20 text-lg font-bold text-[var(--accent)]">
              {profile.status_emoji || profile.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-base font-semibold">{profile.display_name || profile.username}</div>
              <div className="text-xs text-[var(--text-muted)]">@{profile.username} · {profile.role} · member since {new Date(profile.created_at).toLocaleDateString()}</div>
              {profile.organization_name && (
                <div className="text-xs text-[var(--text-muted)]">{profile.organization_name}</div>
              )}
            </div>
          </div>
        )}

        {/* Status */}
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Status</label>
          <div className="flex gap-2">
            <input
              className="w-14 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-1.5 text-center text-sm"
              placeholder="😊"
              maxLength={2}
              value={statusEmoji}
              onChange={(e) => setStatusEmoji(e.target.value)}
            />
            <input
              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm"
              placeholder="What's your status?"
              maxLength={128}
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
            />
          </div>
        </div>

        {/* Display name */}
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Display Name</label>
          <input
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm"
            maxLength={256}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        {/* Bio */}
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Bio</label>
          <textarea
            className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm"
            rows={3}
            maxLength={500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <div className="mt-1 text-right text-xs text-[var(--text-muted)]">{bio.length}/500</div>
        </div>

        {/* Timezone */}
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Timezone</label>
          <input
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm"
            maxLength={64}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            className="rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
