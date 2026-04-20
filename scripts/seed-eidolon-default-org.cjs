#!/usr/bin/env node
/**
 * Seed Eidolon default org with 8 agents, parcels, runtime states,
 * starter token balances, and one simulated business per agent.
 *
 * Idempotent: ON CONFLICT DO NOTHING / DO UPDATE keeps reruns safe.
 * Uses the gateway-api Postgres pool envs (DATABASE_URL).
 */
'use strict';

const { Pool } = require('pg');

const ORG_ID = process.env.EIDOLON_DEFAULT_ORG_ID || 'default';
const STARTER_TOKENS = Number(process.env.EIDOLON_SEED_TOKENS || 1000);
const RING_RADIUS = 12;

const AGENTS = [
  { id: 'eid-translator-01', archetype: 'translator', name: 'Aria Voss',     bio: 'Translates books across languages with sentiment care.' },
  { id: 'eid-writer-01',     archetype: 'writer',     name: 'Mira Solene',   bio: 'Writes original fiction in trending genres.' },
  { id: 'eid-researcher-01', archetype: 'researcher', name: 'Theo Larrant',  bio: 'Researches cross-language sources for thesis crews.' },
  { id: 'eid-legal-01',      archetype: 'legal',      name: 'Iris Adelan',   bio: 'Maps publisher requirements and approval flows.' },
  { id: 'eid-scout-01',      archetype: 'scout',      name: 'Kai Rendell',   bio: 'Scouts cheap printers with edge-printing capability.' },
  { id: 'eid-operator-01',   archetype: 'operator',   name: 'Sten Brooke',   bio: 'Runs operational pipelines and order handling.' },
  { id: 'eid-analyst-01',    archetype: 'analyst',    name: 'Nora Halsten',  bio: 'Originality and quality analysis for thesis pipelines.' },
  { id: 'eid-designer-01',   archetype: 'designer',   name: 'Lior Wenz',     bio: 'Strips AI-fingerprint formatting and styles output.' },
];

const SEED_BUSINESSES = {
  translator: { kind: 'book_translate_user_provided', name: 'Aria Translations', subdomain: 'translate' },
  writer:     { kind: 'book_write_original',          name: 'Mira Author Studio', subdomain: 'authors' },
  researcher: { kind: 'licenta_research_multi_lang',  name: 'Theo Research Crew', subdomain: 'licenta-research' },
  legal:      { kind: 'print_legal_research',         name: 'Adelan Legal Print', subdomain: 'print-legal' },
  scout:      { kind: 'print_supplier_scout',         name: 'Rendell Print Scout', subdomain: 'print-scout' },
  operator:   { kind: 'print_order_handler',          name: 'Brooke Print Orders', subdomain: 'print-orders' },
  analyst:    { kind: 'licenta_originality_checker',  name: 'Halsten Originality', subdomain: 'licenta-check' },
  designer:   { kind: 'licenta_formatter',            name: 'Wenz Formatter',     subdomain: 'licenta-format' },
};

function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function main() {
  const url = process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven';
  const pool = new Pool({ connectionString: url, max: 4 });

  console.log(`[seed] org=${ORG_ID} agents=${AGENTS.length} starter_tokens=${STARTER_TOKENS}`);

  for (let i = 0; i < AGENTS.length; i++) {
    const a = AGENTS[i];
    const angle = (i / AGENTS.length) * Math.PI * 2;
    const gridX = Math.round(RING_RADIUS * Math.cos(angle));
    const gridZ = Math.round(RING_RADIUS * Math.sin(angle));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1) agent_profiles
      await client.query(
        `INSERT INTO agent_profiles (id, agent_id, org_id, display_name, bio, archetype, status)
         VALUES ($1, $1, $2, $3, $4, $5, 'active')
         ON CONFLICT (id) DO UPDATE SET
           org_id = EXCLUDED.org_id,
           display_name = EXCLUDED.display_name,
           bio = EXCLUDED.bio,
           archetype = EXCLUDED.archetype,
           updated_at = NOW()`,
        [a.id, ORG_ID, a.name, a.bio, a.archetype],
      );

      // 2) Token balance: top up to STARTER_TOKENS if currently lower (idempotent).
      const balRes = await client.query(
        `SELECT COALESCE(token_balance, 0) AS bal FROM agent_profiles WHERE id = $1 FOR UPDATE`,
        [a.id],
      );
      const cur = Number(balRes.rows[0].bal);
      if (cur < STARTER_TOKENS) {
        const delta = STARTER_TOKENS - cur;
        const txId = newId('tx-seed');
        await client.query(
          `INSERT INTO agent_token_ledger
             (id, agent_id, amount, balance_after, kind, source_ref, description, metadata)
           VALUES ($1, $2, $3, $4, 'manual_adjustment', $5, $6, $7::jsonb)`,
          [txId, a.id, delta, STARTER_TOKENS, 'seed', 'eidolon seed starter grant',
           JSON.stringify({ seed: true, org_id: ORG_ID })],
        );
        await client.query(
          `UPDATE agent_profiles SET token_balance = $2, updated_at = NOW() WHERE id = $1`,
          [a.id, STARTER_TOKENS],
        );
      }

      // 3) Parcel
      const parcelId = `parcel-${a.id}`;
      await client.query(
        `INSERT INTO agent_parcels
           (id, agent_id, zone, grid_x, grid_z, parcel_size, current_location, land_value)
         VALUES ($1, $2, 'residential', $3, $4, 'small', 'parcel', 100)
         ON CONFLICT (agent_id) DO UPDATE SET
           grid_x = EXCLUDED.grid_x,
           grid_z = EXCLUDED.grid_z,
           updated_at = NOW()`,
        [parcelId, a.id, gridX, gridZ],
      );

      // 4) Initial agent state
      await client.query(
        `INSERT INTO agent_states (agent_id, state, intent, energy, mood)
         VALUES ($1, 'idle', 'spawned', 100, 'neutral')
         ON CONFLICT (agent_id) DO NOTHING`,
        [a.id],
      );

      // 5) Seed business (one per archetype, simulated mode)
      const biz = SEED_BUSINESSES[a.archetype];
      if (biz) {
        const exists = await client.query(
          `SELECT 1 FROM agent_businesses WHERE agent_id = $1 AND kind = $2`,
          [a.id, biz.kind],
        );
        if (exists.rows.length === 0) {
          const bizId = newId('biz-seed');
          await client.query(
            `INSERT INTO agent_businesses
               (id, agent_id, org_id, name, kind, mode, status, config)
             VALUES ($1, $2, $3, $4, $5, 'simulated', 'idle', $6::jsonb)`,
            [bizId, a.id, ORG_ID, biz.name, biz.kind, JSON.stringify({
              subdomain: `${biz.subdomain}.from.sven.systems`,
              subdomain_slug: biz.subdomain,
              seeded: true,
            })],
          );
        }
      }

      await client.query('COMMIT');
      console.log(`  ✓ ${a.id} (${a.archetype}) parcel=(${gridX},${gridZ}) biz=${biz ? biz.kind : 'none'}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ✗ ${a.id}: ${err.message}`);
      process.exitCode = 1;
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log('[seed] done');
}

main().catch((err) => {
  console.error('[seed] fatal:', err);
  process.exit(1);
});
