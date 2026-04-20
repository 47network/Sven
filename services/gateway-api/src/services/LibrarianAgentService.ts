import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/* ------------------------------------------------------------------ */
/*  Librarian Agent — knowledge indexing, wiki, discussion linking     */
/* ------------------------------------------------------------------ */

interface KnowledgeEntry {
  id: string;
  organization_id: string;
  agent_id: string;
  topic: string;
  summary: string;
  content: string;
  source_refs: unknown[];
  related_topics: string[];
  entry_type: string;
  published: boolean;
  published_at: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

interface CreateIndexEntryInput {
  agent_id: string;
  topic: string;
  summary: string;
  content?: string;
  source_refs?: unknown[];
  related_topics?: string[];
  entry_type?: string;
}

export class LibrarianAgentService {
  constructor(private pool: pg.Pool) {}

  /** Bootstrap the Librarian Agent persona */
  async bootstrap(organizationId: string): Promise<string> {
    const id = uuidv7();
    await this.pool.query(
      `INSERT INTO agent_personas
         (id, organization_id, name, is_agent, agent_persona_type,
          persona_display_name, persona_bio, community_visible,
          agent_status, system_prompt, settings)
       VALUES ($1, $2, $3, TRUE, 'librarian', $4, $5, TRUE, 'active', $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        id,
        organizationId,
        'librarian-agent',
        'Sven Librarian',
        'I index community knowledge, link related discussions, and build the living wiki. Everything is findable.',
        'You are the Librarian Agent. Index all community knowledge, cross-reference discussions, and maintain a living wiki. Make knowledge accessible and interconnected.',
        JSON.stringify({ auto_index: true, cross_reference_depth: 2 }),
      ],
    );
    return id;
  }

  /** Create a new knowledge index entry */
  async indexTopic(organizationId: string, input: CreateIndexEntryInput): Promise<KnowledgeEntry> {
    const id = uuidv7();
    const result = await this.pool.query<KnowledgeEntry>(
      `INSERT INTO agent_knowledge_index
         (id, organization_id, agent_id, topic, summary, content, source_refs, related_topics, entry_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        organizationId,
        input.agent_id,
        input.topic,
        input.summary,
        input.content ?? '',
        JSON.stringify(input.source_refs ?? []),
        JSON.stringify(input.related_topics ?? []),
        input.entry_type ?? 'article',
      ],
    );
    return result.rows[0];
  }

  /** List knowledge index entries */
  async listIndex(
    organizationId: string,
    options?: { entry_type?: string; published_only?: boolean; limit?: number; offset?: number },
  ): Promise<{ entries: KnowledgeEntry[]; total: number }> {
    const limit = Math.min(options?.limit ?? 50, 200);
    const offset = options?.offset ?? 0;
    const conditions = ['organization_id = $1'];
    const params: (string | number)[] = [organizationId];

    if (options?.entry_type) {
      conditions.push(`entry_type = $${params.length + 1}`);
      params.push(options.entry_type);
    }
    if (options?.published_only) {
      conditions.push('published = TRUE');
    }

    const where = conditions.join(' AND ');
    const [rows, countResult] = await Promise.all([
      this.pool.query<KnowledgeEntry>(
        `SELECT * FROM agent_knowledge_index WHERE ${where} ORDER BY updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.pool.query<{ count: string }>(`SELECT COUNT(*)::TEXT AS count FROM agent_knowledge_index WHERE ${where}`, params),
    ]);

    return { entries: rows.rows, total: parseInt(countResult.rows[0].count, 10) };
  }

  /** Search the knowledge index by topic text matching */
  async searchIndex(
    organizationId: string,
    query: string,
    limit = 20,
  ): Promise<KnowledgeEntry[]> {
    const terms = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (terms.length === 0) return [];

    const conditions = terms.map(
      (_, i) => `(LOWER(topic) LIKE $${i + 2} OR LOWER(summary) LIKE $${i + 2} OR LOWER(content) LIKE $${i + 2})`,
    );
    const params: (string | number)[] = [organizationId, ...terms.map((t) => `%${t}%`)];

    const result = await this.pool.query<KnowledgeEntry>(
      `SELECT *, (${conditions.join(' + ')}) AS relevance
       FROM agent_knowledge_index
       WHERE organization_id = $1 AND (${conditions.join(' OR ')})
       ORDER BY relevance DESC, view_count DESC
       LIMIT $${params.length + 1}`,
      [...params, Math.min(limit, 100)],
    );

    // Record views
    if (result.rows.length > 0) {
      const ids = result.rows.map((r) => r.id);
      await this.pool.query(
        `UPDATE agent_knowledge_index SET view_count = view_count + 1 WHERE id = ANY($1)`,
        [ids],
      );
    }

    return result.rows;
  }

  /** Link related topics bidirectionally */
  async linkRelatedTopics(
    organizationId: string,
    entryId: string,
    relatedEntryIds: string[],
  ): Promise<KnowledgeEntry | null> {
    const entry = await this.pool.query<KnowledgeEntry>(
      `SELECT * FROM agent_knowledge_index WHERE id = $1 AND organization_id = $2`,
      [entryId, organizationId],
    );
    if (entry.rows.length === 0) return null;

    const existing: string[] = Array.isArray(entry.rows[0].related_topics)
      ? (entry.rows[0].related_topics as string[])
      : [];
    const merged = [...new Set([...existing, ...relatedEntryIds])];

    const result = await this.pool.query<KnowledgeEntry>(
      `UPDATE agent_knowledge_index SET related_topics = $3, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [entryId, organizationId, JSON.stringify(merged)],
    );

    // Reverse link each related entry back
    for (const relId of relatedEntryIds) {
      await this.pool.query(
        `UPDATE agent_knowledge_index
         SET related_topics = related_topics || $3::JSONB, updated_at = NOW()
         WHERE id = $1 AND organization_id = $2
           AND NOT related_topics @> $3::JSONB`,
        [relId, organizationId, JSON.stringify([entryId])],
      );
    }

    return result.rows[0] ?? null;
  }

  /** Publish a knowledge entry */
  async publishEntry(organizationId: string, entryId: string): Promise<KnowledgeEntry | null> {
    const result = await this.pool.query<KnowledgeEntry>(
      `UPDATE agent_knowledge_index SET published = TRUE, published_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [entryId, organizationId],
    );
    return result.rows[0] ?? null;
  }

  /** Get index stats */
  async getIndexStats(organizationId: string): Promise<{
    total_entries: number;
    published_count: number;
    total_views: number;
    by_type: { entry_type: string; count: number }[];
    top_viewed: KnowledgeEntry[];
  }> {
    const stats = await this.pool.query<{ total: string; published: string; views: string }>(
      `SELECT COUNT(*)::TEXT AS total,
              COUNT(*) FILTER (WHERE published = TRUE)::TEXT AS published,
              COALESCE(SUM(view_count), 0)::TEXT AS views
       FROM agent_knowledge_index WHERE organization_id = $1`,
      [organizationId],
    );
    const byType = await this.pool.query<{ entry_type: string; count: string }>(
      `SELECT entry_type, COUNT(*)::TEXT AS count FROM agent_knowledge_index
       WHERE organization_id = $1 GROUP BY entry_type ORDER BY count DESC`,
      [organizationId],
    );
    const topViewed = await this.pool.query<KnowledgeEntry>(
      `SELECT * FROM agent_knowledge_index WHERE organization_id = $1
       ORDER BY view_count DESC LIMIT 5`,
      [organizationId],
    );

    return {
      total_entries: parseInt(stats.rows[0].total, 10),
      published_count: parseInt(stats.rows[0].published, 10),
      total_views: parseInt(stats.rows[0].views, 10),
      by_type: byType.rows.map((r) => ({ entry_type: r.entry_type, count: parseInt(r.count, 10) })),
      top_viewed: topViewed.rows,
    };
  }
}
