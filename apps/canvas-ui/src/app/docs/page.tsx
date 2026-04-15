import Link from 'next/link';

const pillars = [
  {
    title: 'Quickstart',
    body: 'Install Sven, reach the suite, and validate the first operator and end-user flows.',
    href: '/suite/docs',
  },
  {
    title: 'Architecture',
    body: 'Understand the gateway, runtime, message bus, and companion surfaces before deeper rollout.',
    href: '/suite/platform',
  },
  {
    title: 'Security',
    body: 'Review deployment hardening, trust model, policy controls, and operator guardrails.',
    href: '/suite/security',
  },
];

const guides = [
  {
    title: 'Adapters & Channels',
    body: 'Connect WhatsApp, Telegram, Discord, Matrix, email, voice, and webchat to a single runtime.',
    href: '/suite/features',
  },
  {
    title: 'Knowledge & RAG',
    body: 'Configure hybrid retrieval, knowledge graph extraction, citation-aware responses, and memory scopes.',
    href: '/suite/features',
  },
  {
    title: 'Multi-Agent Workflows',
    body: 'Orchestrate agent teams with DAG execution, approval gates, tool routing, and scheduler-driven jobs.',
    href: '/suite/features',
  },
  {
    title: 'Admin & Operator Controls',
    body: 'Manage users, organisations, integrations, registry entries, secrets, and deployment settings.',
    href: '/suite/platform',
  },
  {
    title: 'Voice & STT/TTS',
    body: 'Deploy wake-word detection, streaming speech-to-text, and neural text-to-speech for voice-first interfaces.',
    href: '/suite/features',
  },
  {
    title: 'Mobile & Desktop Companions',
    body: 'Pair Flutter mobile and Tauri desktop apps with the runtime for push, sync, and device management.',
    href: '/suite/platform',
  },
  {
    title: 'Enterprise & SSO',
    body: 'Configure OIDC/SAML identity providers, RBAC, audit logging, and multi-tenant isolation.',
    href: '/suite/enterprise',
  },
  {
    title: 'API Reference',
    body: 'Gateway REST/WebSocket API endpoints, authentication flows, and contract versioning conventions.',
    href: '/suite/docs',
  },
  {
    title: 'Deployment & Operations',
    body: 'Docker Compose profiles, Kubernetes manifests, bare-metal systemd, PM2, and multi-VM deploy guides.',
    href: '/suite/docs',
  },
];

export const metadata = {
  title: 'Sven Documentation',
};

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-zinc-100">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">Documentation</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Operational guidance, not brochure copy.</h1>
        <p className="mt-4 text-base leading-7 text-zinc-300">
          Sven spans public web, authenticated chat, operator control, device management, and companion apps.
          This entry point consolidates the documentation paths that matter when you are evaluating, deploying,
          or operating the system.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {pillars.map((item) => (
          <article key={item.title} className="rounded-2xl border border-cyan-400/20 bg-zinc-900/60 p-5">
            <h2 className="text-lg font-medium text-zinc-100">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{item.body}</p>
            <Link
              href={item.href}
              className="mt-5 inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-200 transition hover:bg-cyan-400/20"
            >
              Open
            </Link>
          </article>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-medium text-zinc-100">Topic Guides</h2>
        <p className="mt-2 text-sm text-zinc-400">Deep-dive into specific capabilities and operational areas.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((item) => (
            <article key={item.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <h3 className="text-base font-medium text-zinc-100">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{item.body}</p>
              <Link
                href={item.href}
                className="mt-4 inline-flex items-center text-sm text-cyan-300 hover:text-cyan-200"
              >
                Learn more &rarr;
              </Link>
            </article>
          ))}
        </div>
      </div>

      <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-xl font-medium text-zinc-100">What to validate first</h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
          <li>Public host routes, legal pages, and suite entry points resolve cleanly.</li>
          <li>Canvas login, chat roundtrip, approvals, and shared transcript flows work on the live gateway.</li>
          <li>Admin setup, integrations, registry, deployment, and device management surfaces are operator-usable.</li>
          <li>Companion-device workflows prove registration, pairing, command delivery, and mirror presentation.</li>
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-xl font-medium text-zinc-100">Resources</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a
            href="https://github.com/47network/thesven"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-zinc-700/60 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 transition hover:border-cyan-400/30"
          >
            <span className="text-base">&#128187;</span>
            <span>GitHub Repository</span>
          </a>
          <Link
            href="/community"
            className="flex items-center gap-3 rounded-xl border border-zinc-700/60 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 transition hover:border-cyan-400/30"
          >
            <span className="text-base">&#128101;</span>
            <span>Community Hub</span>
          </Link>
          <Link
            href="/suite/roadmap"
            className="flex items-center gap-3 rounded-xl border border-zinc-700/60 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 transition hover:border-cyan-400/30"
          >
            <span className="text-base">&#128640;</span>
            <span>Roadmap</span>
          </Link>
          <Link
            href="/suite/security"
            className="flex items-center gap-3 rounded-xl border border-zinc-700/60 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 transition hover:border-cyan-400/30"
          >
            <span className="text-base">&#128274;</span>
            <span>Security Overview</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
