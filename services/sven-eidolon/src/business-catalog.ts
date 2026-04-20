// ---------------------------------------------------------------------------
// Eidolon — Business catalog & simulated adapter
// ---------------------------------------------------------------------------
// Canonical list of business `kind` slots that agents can spawn. Each slot
// carries the metadata the runtime + UI need: archetype that can run it,
// recommended subdomain prefix on `*.from.sven.systems`, and a short label.
//
// Until a real adapter is wired (with platform credentials), every business
// runs in `simulated` mode. The simulated adapter NEVER credits real
// 47Tokens — it only writes a `revenue=0, mode=simulated` audit row, and the
// DB CHECK constraint on agent_business_revenue_events enforces this.
//
// Real adapter wiring (Phase 2) replaces `runSimulated` for a given slot
// with a function that calls the real platform and returns gross EUR cents.
// ---------------------------------------------------------------------------

import type { BusinessRunResult } from './simulation-types.js';

export type BusinessSlot = {
  kind: string;
  label: string;
  group: 'translation' | 'writing' | 'print' | 'platform_agent' | 'licenta' | 'research_lab' | 'misc';
  archetypes: string[];           // agent archetypes allowed to run this slot
  recommendedSubdomain: string;   // <slug>.from.sven.systems
  description: string;
};

export const BUSINESS_CATALOG: BusinessSlot[] = [
  // ── Translation crew ──────────────────────────────────────────────────
  {
    kind: 'book_translate_user_provided',
    label: 'Book Translation (user-provided)',
    group: 'translation',
    archetypes: ['translator'],
    recommendedSubdomain: 'translate',
    description: 'Translate a book the user uploads, end to end.',
  },
  {
    kind: 'book_translate_public_link',
    label: 'Book Translation (public links)',
    group: 'translation',
    archetypes: ['translator', 'researcher'],
    recommendedSubdomain: 'open-translate',
    description: 'Translate freely available online books and resell.',
  },
  {
    kind: 'book_translate_for_publisher',
    label: 'Book Translation (B2B publishers)',
    group: 'translation',
    archetypes: ['translator', 'strategist'],
    recommendedSubdomain: 'b2b-translate',
    description: 'Translation service for editorial houses lacking translators.',
  },

  // ── Writing crew ──────────────────────────────────────────────────────
  {
    kind: 'book_write_original',
    label: 'Original Writing (free + paid)',
    group: 'writing',
    archetypes: ['writer'],
    recommendedSubdomain: 'authors',
    description: 'Agent acts as author with synthesised personality. Trending genres only.',
  },

  // ── Print pipeline (multi-agent crew) ─────────────────────────────────
  {
    kind: 'print_legal_research',
    label: 'Print Legal Research',
    group: 'print',
    archetypes: ['legal'],
    recommendedSubdomain: 'print-legal',
    description: 'Researches publisher legal requirements, signing, approval flows.',
  },
  {
    kind: 'print_supplier_scout',
    label: 'Print Supplier Scout',
    group: 'print',
    archetypes: ['scout', 'researcher'],
    recommendedSubdomain: 'print-scout',
    description: 'Finds cheapest printers with edge-printing capability.',
  },
  {
    kind: 'print_order_handler',
    label: 'Print Order Handler',
    group: 'print',
    archetypes: ['operator'],
    recommendedSubdomain: 'print-orders',
    description: 'Places + tracks print orders with selected suppliers.',
  },
  {
    kind: 'print_inhouse',
    label: 'In-house Printing',
    group: 'print',
    archetypes: ['operator'],
    recommendedSubdomain: 'press',
    description: 'Unlocks once human-approved printer is procured. Cuts unit cost.',
  },

  // ── Platform-agent (sell agents for vendors who lack them) ────────────
  {
    kind: 'platform_agent_atlassian',
    label: 'Atlassian Agent Service',
    group: 'platform_agent',
    archetypes: ['operator', 'designer'],
    recommendedSubdomain: 'atlassian-agents',
    description: 'Sells agent automations for Atlassian products on the marketplace.',
  },

  // ── Romanian "Licenta" (thesis) agency ────────────────────────────────
  {
    kind: 'licenta_research_multi_lang',
    label: 'Licenta — Multi-lang Research',
    group: 'licenta',
    archetypes: ['researcher'],
    recommendedSubdomain: 'licenta-research',
    description: 'Researches the topic across all language Googles.',
  },
  {
    kind: 'licenta_translator',
    label: 'Licenta — Translator',
    group: 'licenta',
    archetypes: ['translator'],
    recommendedSubdomain: 'licenta-translate',
    description: 'Translates findings into Romanian.',
  },
  {
    kind: 'licenta_rewriter',
    label: 'Licenta — Rewriter',
    group: 'licenta',
    archetypes: ['writer'],
    recommendedSubdomain: 'licenta-rewrite',
    description: 'Rewrites in RO with anti-AI-fingerprint formatting.',
  },
  {
    kind: 'licenta_originality_checker',
    label: 'Licenta — Originality Checker',
    group: 'licenta',
    archetypes: ['analyst'],
    recommendedSubdomain: 'licenta-check',
    description: 'Iterates against free originality tools until score < 5%.',
  },
  {
    kind: 'licenta_formatter',
    label: 'Licenta — Formatter',
    group: 'licenta',
    archetypes: ['designer'],
    recommendedSubdomain: 'licenta-format',
    description: 'Strips AI-formatting tells (em-dashes, signature phrases).',
  },

  // ── Research lab (meta) ───────────────────────────────────────────────
  {
    kind: 'research_lab',
    label: 'Research Lab (spawnable)',
    group: 'research_lab',
    archetypes: ['researcher', 'analyst', 'strategist'],
    recommendedSubdomain: 'lab',
    description: 'Spawns a research lab. Sells research services on marketplace + own subdomain. Feeds Sven self-improvement loop.',
  },
];

export const BUSINESS_KIND_INDEX: Map<string, BusinessSlot> = new Map(
  BUSINESS_CATALOG.map((s) => [s.kind, s]),
);

/** Trending genre seeds for the writing crew. Refresh via market research agent. */
export const WRITING_TRENDING_GENRES: ReadonlyArray<string> = [
  'dark_romance',
  'mafia_romance',
  'why_choose',
  'step_sibling',
  'step_parent',
  'parent_child',
  'psycho',
  'enemies_to_lovers',
  'enemies_to_lovers_to_enemies',
  'ex_bf_dad',
  'college',
  'bully',
];

/**
 * Simulated business run.
 *
 * IMPORTANT: gross is reported but the runtime + DB will refuse to credit
 * tokens for `mode='simulated'`. This is the safe default until a real
 * adapter is wired with verified platform credentials.
 *
 * The simulated outcome is deterministic-ish from (businessId, tickNo) so the
 * same world tick gives the same result and the log stays meaningful for
 * debugging without polluting metrics.
 */
export function runSimulated(args: {
  businessId: string;
  kind: string;
  tickNo: number;
}): BusinessRunResult {
  const seed = hashString(`${args.businessId}:${args.tickNo}:${args.kind}`);
  const roll = (seed % 1000) / 1000; // 0..1
  // 70% no_revenue, 25% success (small), 5% failure — reflects realistic early-stage.
  if (roll < 0.05) {
    return {
      outcome: 'failure',
      grossEurCents: 0,
      notes: 'simulated_failure: adapter not yet wired',
      evidenceUrl: null,
      evidenceHash: null,
    };
  }
  if (roll < 0.30) {
    // Simulated revenue, but BusinessRunResult.grossEurCents is reported only —
    // the write-repo will NOT credit tokens because mode='simulated'.
    const reportedCents = 100 + ((seed % 4900)); // €1.00 – €50.00 reported (not credited)
    return {
      outcome: 'success',
      grossEurCents: reportedCents,
      notes: 'simulated_success: not credited (no live adapter)',
      evidenceUrl: null,
      evidenceHash: null,
    };
  }
  return {
    outcome: 'no_revenue',
    grossEurCents: 0,
    notes: 'simulated_no_revenue',
    evidenceUrl: null,
    evidenceHash: null,
  };
}

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return h;
}
