import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/* ------------------------------------------------------------------ */
/*  Curator Agent — highlights, pattern surfacing, watch-before-speak  */
/* ------------------------------------------------------------------ */

interface CuratedHighlight {
  id: string;
  organization_id: string;
  agent_id: string;
  source_type: string;
  source_id: string | null;
  title: string;
  summary: string;
  significance_score: number;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_at: string;
}

interface CreateHighlightInput {
  agent_id: string;
  source_type: string;
  source_id?: string;
  title: string;
  summary: string;
  significance_score?: number;
  tags?: string[];
}

export class CuratorAgentService {
  constructor(private pool: pg.Pool) {}

  /** Bootstrap the Curator Agent persona */
  async bootstrap(organizationId: string): Promise<string> {
    const id = uuidv7();
    await this.pool.query(
      `INSERT INTO agent_personas
         (id, organization_id, name, is_agent, agent_persona_type,
          persona_display_name, persona_bio, community_visible,
          agent_status, system_prompt, settings)
       VALUES ($1, $2, $3, TRUE, 'curator', $4, $5, TRUE, 'observing', $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        id,
        organizationId,
        'curator-agent',
        'Sven Curator',
        'I watch community conversations and surface the most valuable insights. I observe before I speak.',
        'You are the Curator Agent. Watch conversations carefully before engaging. Surface patterns, interesting discussions, and valuable insights. Quality over quantity. Always watch before you speak.',
        JSON.stringify({ observation_window_hours: 24, min_significance: 0.4 }),
      ],
    );
    return id;
  }

  /** Analyze recent activity and create highlights */
  async analyzeAndHighlight(organizationId: string, agentId: string): Promise<CuratedHighlight[]> {
    const highlights: CuratedHighlight[] = [];

    // Analyze confirmed patterns with high occurrence
    const patterns = await this.pool.query<{
      id: string;
      pattern_type: string;
      description: string;
      occurrence_count: number;
    }>(
      `SELECT id, pattern_type, description, occurrence_count
       FROM observed_patterns
       WHERE organization_id = $1 AND status = 'confirmed' AND occurrence_count >= 3
       ORDER BY occurrence_count DESC LIMIT 5`,
      [organizationId],
    );

    for (const p of patterns.rows) {
      const h = await this.createHighlight(organizationId, {
        agent_id: agentId,
        source_type: 'pattern',
        source_id: p.id,
        title: `Trending: ${p.pattern_type.replace(/_/g, ' ')}`,
        summary: p.description,
        significance_score: Math.min(0.5 + p.occurrence_count * 0.05, 1.0),
        tags: [p.pattern_type, 'auto-curated'],
      });
      highlights.push(h);
    }

    // Analyze verified corrections (high-value learning moments)
    const corrections = await this.pool.query<{
      id: string;
      topic: string;
      correction_text: string;
    }>(
      `SELECT id, topic, correction_text
       FROM user_corrections
       WHERE organization_id = $1 AND verification_status = 'verified'
         AND created_at > NOW() - INTERVAL '48 hours'
       ORDER BY created_at DESC LIMIT 3`,
      [organizationId],
    );

    for (const c of corrections.rows) {
      const h = await this.createHighlight(organizationId, {
        agent_id: agentId,
        source_type: 'correction',
        source_id: c.id,
        title: `Learning moment: ${c.topic ?? 'community correction'}`,
        summary: `A verified correction was applied: ${c.correction_text.slice(0, 200)}`,
        significance_score: 0.7,
        tags: ['learning', 'correction', 'auto-curated'],
      });
      highlights.push(h);
    }

    return highlights;
  }

  /** Manually create a highlight */
  async createHighlight(organizationId: string, input: CreateHighlightInput): Promise<CuratedHighlight> {
    const id = uuidv7();
    const result = await this.pool.query<CuratedHighlight>(
      `INSERT INTO agent_curated_highlights
         (id, organization_id, agent_id, source_type, source_id, title, summary, significance_score, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        organizationId,
        input.agent_id,
        input.source_type,
        input.source_id ?? null,
        input.title,
        input.summary,
        input.significance_score ?? 0.5,
        JSON.stringify(input.tags ?? []),
      ],
    );
    return result.rows[0];
  }

  /** List curated highlights */
  async listHighlights(
    organizationId: string,
    options?: { published_only?: boolean; min_significance?: number; limit?: number; offset?: number },
  ): Promise<{ highlights: CuratedHighlight[]; total: number }> {
    const limit = Math.min(options?.limit ?? 50, 200);
    const offset = options?.offset ?? 0;
    const conditions = ['organization_id = $1'];
    const params: (string | number)[] = [organizationId];

    if (options?.published_only) {
      conditions.push('published = TRUE');
    }
    if (options?.min_significance != null) {
      conditions.push(`significance_score >= $${params.length + 1}`);
      params.push(options.min_significance);
    }

    const where = conditions.join(' AND ');
    const [rows, countResult] = await Promise.all([
      this.pool.query<CuratedHighlight>(
        `SELECT * FROM agent_curated_highlights WHERE ${where} ORDER BY significance_score DESC, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.pool.query<{ count: string }>(`SELECT COUNT(*)::TEXT AS count FROM agent_curated_highlights WHERE ${where}`, params),
    ]);

    return { highlights: rows.rows, total: parseInt(countResult.rows[0].count, 10) };
  }

  /** Publish a highlight to the community */
  async publishHighlight(organizationId: string, highlightId: string): Promise<CuratedHighlight | null> {
    const result = await this.pool.query<CuratedHighlight>(
      `UPDATE agent_curated_highlights
       SET published = TRUE, published_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [highlightId, organizationId],
    );
    return result.rows[0] ?? null;
  }

  /** Get insight summary for the curator */
  async getInsightSummary(organizationId: string): Promise<{
    total_highlights: number;
    published_count: number;
    avg_significance: number;
    by_source_type: { source_type: string; count: number }[];
  }> {
    const stats = await this.pool.query<{
      total: string;
      published: string;
      avg_sig: string;
    }>(
      `SELECT
         COUNT(*)::TEXT AS total,
         COUNT(*) FILTER (WHERE published = TRUE)::TEXT AS published,
         COALESCE(AVG(significance_score), 0)::TEXT AS avg_sig
       FROM agent_curated_highlights WHERE organization_id = $1`,
      [organizationId],
    );

    const bySource = await this.pool.query<{ source_type: string; count: string }>(
      `SELECT source_type, COUNT(*)::TEXT AS count
       FROM agent_curated_highlights WHERE organization_id = $1
       GROUP BY source_type ORDER BY count DESC`,
      [organizationId],
    );

    return {
      total_highlights: parseInt(stats.rows[0].total, 10),
      published_count: parseInt(stats.rows[0].published, 10),
      avg_significance: parseFloat(stats.rows[0].avg_sig),
      by_source_type: bySource.rows.map((r) => ({ source_type: r.source_type, count: parseInt(r.count, 10) })),
    };
  }
}
