import Link from 'next/link';
import { ArrowRight, ShieldCheck, Trophy, Users, Workflow } from 'lucide-react';

const liveNow = [
  'Admin routes for workers, tasks, bids, proofs, payments, reviews, disputes, and analytics are already wired in Gateway API.',
  'The production data model is live with worker, mission, proof, payout, and dispute records ready for the public UI.',
  'Verification and payout flows already exist behind the operator surface, so the public app can grow on top of real platform rails.',
];

const launchTracks = [
  {
    title: 'Worker surface',
    description:
      'Mission discovery, acceptance, proof submission, payout visibility, and a cleaner mobile-first path for field operators.',
  },
  {
    title: 'Recruiter intake',
    description:
      'A faster way for businesses to post real-world work with location, budget, verification rules, and operational constraints.',
  },
  {
    title: 'Trust and review',
    description:
      'Evidence checks, AI-assisted proof review, operator escalation, and dispute handling designed for real delivery pressure.',
  },
];

const platformSignals = [
  {
    label: 'Task lifecycle',
    text: 'Publish, bid, accept, complete, verify, release payout.',
  },
  {
    label: 'Proof rail',
    text: 'Photo, receipt, GPS, and operator validation in one review path.',
  },
  {
    label: 'Payout model',
    text: 'Escrow-aware release logic with fee accounting and dispute fallback.',
  },
];

const rolloutSteps = [
  'Stand up the public worker app on the real production stack.',
  'Connect recruiter and worker journeys to the existing admin-backed platform rails.',
  'Expose onboarding, mission discovery, and proof submission without weakening operator controls.',
];

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden text-[var(--ink)]">
      <div className="grain-bg" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-a" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-b" aria-hidden="true" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <section className="hero-shell fade-rise">
          <div className="grid gap-8 px-5 py-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] lg:px-8 lg:py-8">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="section-kicker">Romania-first field execution platform</span>
                <span className="signal-pill">Public launch surface in progress</span>
              </div>

              <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-ink sm:text-6xl lg:text-7xl">
                Real-world missions, built on the actual platform from day one.
              </h1>

              <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--muted)] sm:text-lg">
                Misiuni.ro is the launch surface for Sven&apos;s field-task platform. AI handles intake,
                routing, proof review, and payout logic. People handle the work on the ground, close the
                loop with verified evidence, and move missions to completion without a throwaway prototype in front.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a className="primary-btn" href="#launch-plan">
                  Explore the launch tracks
                  <ArrowRight className="h-4 w-4" />
                </a>
                <Link className="secondary-btn" href="/admin47">
                  Operator console
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {platformSignals.map((signal) => (
                  <section key={signal.label} className="metric-card">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay-700">{signal.label}</p>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{signal.text}</p>
                  </section>
                ))}
              </div>
            </div>

            <div className="space-y-4 fade-rise fade-rise-delay-1">
              <section className="soft-card">
                <div className="flex items-center gap-3 text-clay-700">
                  <Workflow className="h-5 w-5" />
                  <p className="text-sm font-semibold uppercase tracking-[0.2em]">Already live below the surface</p>
                </div>
                <ul className="mt-4 space-y-4 text-sm leading-7 text-[var(--muted)]">
                  {liveNow.map((item) => (
                    <li key={item} className="border-l border-clay-200 pl-4">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="soft-card">
                <div className="flex items-center gap-3 text-spruce-700">
                  <ShieldCheck className="h-5 w-5" />
                  <p className="text-sm font-semibold uppercase tracking-[0.2em]">Launch posture</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="rounded-2xl bg-spruce-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-spruce-700">Workers</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">Mission pickup, proof submission, payout visibility.</p>
                  </div>
                  <div className="rounded-2xl bg-clay-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay-700">Recruiters</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">Structured intake for location, budget, urgency, and proof rules.</p>
                  </div>
                  <div className="rounded-2xl bg-white/75 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-700">Operators</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">Protected admin route for review, intervention, payout release, and disputes.</p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section id="platform" className="mt-8 fade-rise fade-rise-delay-1">
          <div className="mb-4 flex items-center gap-3">
            <span className="section-kicker">Platform lanes</span>
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Users className="h-4 w-4 text-clay-600" />
              Designed as a real product surface, not a temporary holding page.
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {launchTracks.map((track, index) => (
              <section key={track.title} className={`soft-card fade-rise ${index === 1 ? 'fade-rise-delay-1' : index === 2 ? 'fade-rise-delay-2' : ''}`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink">{track.title}</h2>
                  <span className="rounded-full bg-clay-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-clay-700">
                    Track 0{index + 1}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{track.description}</p>
              </section>
            ))}
          </div>
        </section>

        <section id="launch-plan" className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="soft-card fade-rise fade-rise-delay-1">
            <div className="flex items-center gap-3 text-clay-700">
              <Trophy className="h-5 w-5" />
              <p className="text-sm font-semibold uppercase tracking-[0.2em]">Rollout focus</p>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-700">Phase A</p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">Public landing, worker framing, and operator-safe routing on VM4.</p>
              </div>
              <div className="rounded-2xl bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-700">Phase B</p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">Authenticated worker journeys wired to existing mission, proof, and payout rails.</p>
              </div>
              <div className="rounded-2xl bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-700">Phase C</p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">Recruiter posting, dispute visibility, and measured public rollout.</p>
              </div>
            </div>
          </section>

          <aside className="soft-card fade-rise fade-rise-delay-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-spruce-700">Immediate sequence</p>
            <div className="mt-4 space-y-3">
              {rolloutSteps.map((step, index) => (
                <div key={step} className="timeline-step">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-spruce-700">Step 0{index + 1}</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{step}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <footer className="mt-6 flex flex-col gap-3 border-t border-black/10 px-1 pt-4 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>The public Misiuni experience now starts on the same Next.js stack the product will keep using in production.</p>
          <div className="flex items-center gap-3">
            <Link className="font-semibold text-ink transition-colors hover:text-clay-700" href="/admin47">
              Protected operator access
            </Link>
            <Link className="font-semibold text-ink transition-colors hover:text-clay-700" href="/healthz">
              UI health
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}