import { useState, useEffect, useCallback } from 'react';
import { PanelHeader } from '../components/PanelHeader';

const API = import.meta.env.VITE_API_URL ?? '';

interface ThemePrefs {
  visual_mode?: string;
  accent_preset?: string;
  custom_accent_hex?: string;
  font_family?: string;
  text_scale?: number;
  ui_density?: string;
  high_contrast?: boolean;
  color_blind_mode?: boolean;
  reduce_transparency?: boolean;
  motion_level?: string;
}

const ACCENT_PRESETS = [
  { id: 'sven', label: 'Sven', color: '#00D9FF' },
  { id: 'coral', label: 'Coral', color: '#FF6B6B' },
  { id: 'violet', label: 'Violet', color: '#8B5CF6' },
  { id: 'amber', label: 'Amber', color: '#F59E0B' },
  { id: 'emerald', label: 'Emerald', color: '#10B981' },
  { id: 'rose', label: 'Rose', color: '#F43F5E' },
];

const FONTS = ['Inter', 'Roboto', 'Noto Sans', 'Lato', 'Open Sans', 'System'];
const DENSITIES = ['compact', 'comfortable', 'spacious'];
const MOTIONS = ['full', 'reduced', 'off'];

export default function ThemePanel() {
  const [prefs, setPrefs] = useState<ThemePrefs>({});
  const [saving, setSaving] = useState(false);
  const [customHex, setCustomHex] = useState('');

  const token = localStorage.getItem('auth_token') ?? '';

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/v1/users/me/theme-preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const j = await r.json();
        setPrefs(j.data ?? {});
        setCustomHex(j.data?.custom_accent_hex ?? '');
      }
    } catch {}
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const save = async (patch: Partial<ThemePrefs>) => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/v1/users/me/theme-preferences`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (r.ok) {
        const j = await r.json();
        setPrefs(j.data ?? {});
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="Theme Preferences" />
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Visual Mode */}
        <section>
          <h3 className="text-sm font-semibold mb-2 opacity-70">Theme</h3>
          <div className="flex gap-2">
            {['classic', 'cinematic'].map((m) => (
              <button
                key={m}
                onClick={() => save({ visual_mode: m })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  prefs.visual_mode === m
                    ? 'bg-cyan-500 text-black'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {m === 'classic' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </section>

        {/* Accent Colour */}
        <section>
          <h3 className="text-sm font-semibold mb-2 opacity-70">Accent Colour</h3>
          <div className="flex gap-2 flex-wrap">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => save({ accent_preset: p.id, custom_accent_hex: undefined })}
                className="relative w-9 h-9 rounded-full border-2 transition"
                style={{
                  backgroundColor: p.color,
                  borderColor: prefs.accent_preset === p.id ? '#fff' : 'transparent',
                }}
                title={p.label}
              >
                {prefs.accent_preset === p.id && (
                  <span className="absolute inset-0 flex items-center justify-center text-white text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input
              type="text"
              maxLength={7}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm w-24"
              placeholder="#FF6B6B"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
            />
            <button
              onClick={() => {
                if (/^#[0-9a-fA-F]{6}$/.test(customHex)) {
                  save({ custom_accent_hex: customHex });
                }
              }}
              className="px-3 py-1 text-sm bg-cyan-500/20 hover:bg-cyan-500/30 rounded"
              disabled={saving}
            >
              Apply
            </button>
            {prefs.custom_accent_hex && (
              <div
                className="w-6 h-6 rounded-full border border-white/20"
                style={{ backgroundColor: prefs.custom_accent_hex }}
              />
            )}
          </div>
        </section>

        {/* Font */}
        <section>
          <h3 className="text-sm font-semibold mb-2 opacity-70">Font Family</h3>
          <select
            className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm w-full"
            value={prefs.font_family ?? 'Inter'}
            onChange={(e) => save({ font_family: e.target.value })}
          >
            {FONTS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </section>

        {/* Text Scale */}
        <section>
          <h3 className="text-sm font-semibold mb-2 opacity-70">
            Text Scale: {Math.round((prefs.text_scale ?? 1.0) * 100)}%
          </h3>
          <input
            type="range"
            min={0.8}
            max={1.5}
            step={0.1}
            value={prefs.text_scale ?? 1.0}
            onChange={(e) => save({ text_scale: parseFloat(e.target.value) })}
            className="w-full accent-cyan-400"
          />
        </section>

        {/* Density */}
        <section>
          <h3 className="text-sm font-semibold mb-2 opacity-70">UI Density</h3>
          <div className="flex gap-2">
            {DENSITIES.map((d) => (
              <button
                key={d}
                onClick={() => save({ ui_density: d })}
                className={`px-4 py-2 rounded-lg text-sm capitalize transition ${
                  (prefs.ui_density ?? 'comfortable') === d
                    ? 'bg-cyan-500 text-black'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </section>

        {/* Motion */}
        <section>
          <h3 className="text-sm font-semibold mb-2 opacity-70">Motion Level</h3>
          <div className="flex gap-2">
            {MOTIONS.map((m) => (
              <button
                key={m}
                onClick={() => save({ motion_level: m })}
                className={`px-4 py-2 rounded-lg text-sm capitalize transition ${
                  (prefs.motion_level ?? 'full') === m
                    ? 'bg-cyan-500 text-black'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </section>

        {/* Toggles */}
        <section>
          <h3 className="text-sm font-semibold mb-2 opacity-70">Accessibility</h3>
          <div className="space-y-3">
            {[
              { key: 'high_contrast', label: 'High Contrast' },
              { key: 'color_blind_mode', label: 'Colour-blind Mode' },
              { key: 'reduce_transparency', label: 'Reduce Transparency' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <input
                  type="checkbox"
                  checked={!!(prefs as Record<string, unknown>)[key]}
                  onChange={(e) => save({ [key]: e.target.checked } as Partial<ThemePrefs>)}
                  className="accent-cyan-400 w-5 h-5"
                />
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
