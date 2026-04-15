import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/* ------------------------------------------------------------------ */
/*  Guide Agent — newcomer onboarding, FAQ, feature walkthroughs      */
/* ------------------------------------------------------------------ */

interface FAQEntry {
  id: string;
  organization_id: string;
  agent_id: string;
  question: string;
  answer: string;
  source_type: string;
  source_id: string | null;
  category: string;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateFAQInput {
  agent_id: string;
  question: string;
  answer: string;
  source_type?: string;
  source_id?: string;
  category?: string;
}

interface WelcomeMessage {
  greeting: string;
  feature_highlights: string[];
  suggested_faq: FAQEntry[];
}

export class GuideAgentService {
  constructor(private pool: pg.Pool) {}

  /** Bootstrap the Guide Agent persona for an organization */
  async bootstrap(organizationId: string): Promise<string> {
    const id = uuidv7();
    await this.pool.query(
      `INSERT INTO agent_personas
         (id, organization_id, name, is_agent, agent_persona_type,
          persona_display_name, persona_bio, community_visible,
          agent_status, system_prompt, settings)
       VALUES ($1, $2, $3, TRUE, 'guide', $4, $5, TRUE, 'active', $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        id,
        organizationId,
        'guide-agent',
        'Sven Guide',
        'Your friendly guide to all things Sven. I help newcomers get started and answer frequently asked questions.',
        'You are the Guide Agent for the Sven community. Greet newcomers warmly, walk them through features, and answer FAQs using the knowledge graph. Be helpful, concise, and encouraging.',
        JSON.stringify({ onboarding_enabled: true, faq_auto_refresh: true }),
      ],
    );
    return id;
  }

  /** Generate a welcome message for a new user */
  async generateWelcome(organizationId: string, userId: string): Promise<WelcomeMessage> {
    const faqRows = await this.pool.query<FAQEntry>(
      `SELECT * FROM agent_faq_entries
       WHERE organization_id = $1 AND category = 'getting_started'
       ORDER BY usage_count DESC LIMIT 3`,
      [organizationId],
    );

    return {
      greeting: `Welcome to the Sven community! I'm the Guide Agent — here to help you get started. Feel free to ask me anything.`,
      feature_highlights: [
        'Multi-channel messaging — Telegram, Discord, WhatsApp, Slack, email, and more',
        'Knowledge graph brain that learns entities and relations from your conversations',
        'Memory system that remembers your preferences and improves with feedback',
        'Community agents — Guide, Inspector, Curator, Advocate, QA, Librarian, Imagination',
        'Smart home control via Home Assistant, Frigate, and IoT devices',
        'Productivity tools — calendar, notes (Apple, Obsidian, Bear, Notion), Trello, Things3',
        'Media and entertainment — Spotify, Sonos, Shazam, web search',
        'Pattern observation — I notice recurring questions and proactively help',
        'Calibrated intelligence with confidence scoring and self-reflection',
        'Federation — connect with other Sven instances while keeping data sovereign',
        'On-device AI inference with smart model routing',
        'Developer tools — Git, shell, file system, code generation, and skill authoring',
      ],
      suggested_faq: faqRows.rows,
    };
  }

  /** Answer a question using FAQ entries, falling back to general response */
  async answerFAQ(
    organizationId: string,
    question: string,
  ): Promise<{ answer: string; source: FAQEntry | null }> {
    const searchTerms = question
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (searchTerms.length === 0) {
      return { answer: 'Could you rephrase your question? I want to make sure I understand correctly.', source: null };
    }

    const conditions = searchTerms.map((_, i) => `(LOWER(question) LIKE $${i + 2} OR LOWER(answer) LIKE $${i + 2})`);
    const params: (string | number)[] = [organizationId, ...searchTerms.map((t) => `%${t}%`)];

    const result = await this.pool.query<FAQEntry>(
      `SELECT *, (${conditions.join(' + ')}) AS relevance
       FROM agent_faq_entries
       WHERE organization_id = $1 AND (${conditions.join(' OR ')})
       ORDER BY relevance DESC, usage_count DESC
       LIMIT 1`,
      params,
    );

    if (result.rows.length > 0) {
      const entry = result.rows[0];
      await this.pool.query(
        `UPDATE agent_faq_entries SET usage_count = usage_count + 1, last_used_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [entry.id],
      );
      return { answer: entry.answer, source: entry };
    }

    return {
      answer: "I don't have a specific answer for that yet, but I've noted it. A community member or another agent may be able to help!",
      source: null,
    };
  }

  /** Add a new FAQ entry */
  async addFAQEntry(organizationId: string, input: CreateFAQInput): Promise<FAQEntry> {
    const id = uuidv7();
    const result = await this.pool.query<FAQEntry>(
      `INSERT INTO agent_faq_entries (id, organization_id, agent_id, question, answer, source_type, source_id, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        organizationId,
        input.agent_id,
        input.question,
        input.answer,
        input.source_type ?? 'manual',
        input.source_id ?? null,
        input.category ?? 'general',
      ],
    );
    return result.rows[0];
  }

  /** List FAQ entries with optional filtering */
  async listFAQEntries(
    organizationId: string,
    options?: { category?: string; limit?: number; offset?: number },
  ): Promise<{ entries: FAQEntry[]; total: number }> {
    const limit = Math.min(options?.limit ?? 50, 200);
    const offset = options?.offset ?? 0;
    const conditions = ['organization_id = $1'];
    const params: (string | number)[] = [organizationId];

    if (options?.category) {
      conditions.push(`category = $${params.length + 1}`);
      params.push(options.category);
    }

    const where = conditions.join(' AND ');
    const [rows, countResult] = await Promise.all([
      this.pool.query<FAQEntry>(
        `SELECT * FROM agent_faq_entries WHERE ${where} ORDER BY usage_count DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.pool.query<{ count: string }>(`SELECT COUNT(*)::TEXT AS count FROM agent_faq_entries WHERE ${where}`, params),
    ]);

    return { entries: rows.rows, total: parseInt(countResult.rows[0].count, 10) };
  }

  /** Get Guide Agent stats */
  async getStats(organizationId: string): Promise<{
    total_faq: number;
    total_usage: number;
    top_categories: { category: string; count: number }[];
  }> {
    const result = await this.pool.query<{ total_faq: string; total_usage: string }>(
      `SELECT COUNT(*)::TEXT AS total_faq, COALESCE(SUM(usage_count), 0)::TEXT AS total_usage
       FROM agent_faq_entries WHERE organization_id = $1`,
      [organizationId],
    );
    const cats = await this.pool.query<{ category: string; count: string }>(
      `SELECT category, COUNT(*)::TEXT AS count FROM agent_faq_entries
       WHERE organization_id = $1 GROUP BY category ORDER BY count DESC LIMIT 10`,
      [organizationId],
    );
    return {
      total_faq: parseInt(result.rows[0].total_faq, 10),
      total_usage: parseInt(result.rows[0].total_usage, 10),
      top_categories: cats.rows.map((r) => ({ category: r.category, count: parseInt(r.count, 10) })),
    };
  }
}
