// ---------------------------------------------------------------------------
// WorldTimeBadge — surfaces the simulated day/night cycle that already drives
// CityScene lighting, alongside the operator's local Bucharest wall-clock.
//
// The world cycle runs at 60× real-time and is anchored to Bucharest civil
// midnight (see useWorldTime). Showing both phase and real local time lets
// operators correlate "what they see in the scene" with "what time it is here"
// without leaving the dashboard.
//
// Pure read-only — no props, no state escape.
// ---------------------------------------------------------------------------

'use client';

import { useEffect, useState } from 'react';
import { useWorldTime, type WorldTimeState } from '@/hooks/useWorldTime';
import { formatBucharestTime } from '@/lib/time';

const PHASE_EMOJI: Record<WorldTimeState['phase'], string> = {
  dawn: '🌅',
  day: '☀️',
  dusk: '🌇',
  night: '🌙',
};

const PHASE_LABEL: Record<WorldTimeState['phase'], string> = {
  dawn: 'dawn',
  day: 'day',
  dusk: 'dusk',
  night: 'night',
};

export function WorldTimeBadge() {
  const world = useWorldTime();
  // Re-render every 30s so the operator's wall-clock stays fresh; useWorldTime
  // already ticks every 2s but only when the phase or day fraction shifts
  // visibly — explicit interval ensures the HH:MM label never freezes.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Map dayFraction (0..1) to a 24h in-world clock for the tooltip.
  const worldHour = Math.floor(world.dayFraction * 24);
  const worldMin = Math.floor((world.dayFraction * 24 - worldHour) * 60);
  const worldHHMM = `${String(worldHour).padStart(2, '0')}:${String(worldMin).padStart(2, '0')}`;

  return (
    <div
      className="glass-card px-3 py-2 pointer-events-auto flex items-center gap-2"
      title={`World day ${world.dayNumber + 1} · in-world ${worldHHMM} (60× real-time)`}
    >
      <span className="text-base leading-none" aria-hidden>{PHASE_EMOJI[world.phase]}</span>
      <div className="leading-tight">
        <div className="text-[9px] uppercase tracking-wider text-gray-500">
          {PHASE_LABEL[world.phase]} · day {world.dayNumber + 1}
        </div>
        <div
          className="text-sm font-mono font-semibold text-gray-100"
          title="Romanian time (Europe/Bucharest)"
        >
          {formatBucharestTime(now).slice(0, 5)}
        </div>
      </div>
    </div>
  );
}
