import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/* ------------------------------------------------------------------ */
/*  Advocate Agent — roadmap, feedback, feature requests               */
/* ------------------------------------------------------------------ */

interface FeatureRequest {
  id: string;
  organization_id: string;
  agent_id: string;
  title: string;
  description: string;
  user_votes: number;
  status: string;
  priority: string;
  source_pattern_id: string | null;
  source_feedback_ids: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface CreateFeatureRequestInput {
  agent_id: string;
  title: string;
  description: string;
  priority?: string;
  source_pattern_id?: string;
  source_feedback_ids?: string[];
}

export class AdvocateAgentService {
  constructor(private pool: pg.Pool) {}

  /** Bootstrap the Advocate Agent persona */
  async bootstrap(organizationId: string): Promise<string> {
    const id = uuidv7();
    await this.pool.query(
      `INSERT INTO agent_personas
         (id, organization_id, name, is_agent, agent_persona_type,
          persona_display_name, persona_bio, community_visible,
          agent_status, system_prompt, settings)
       VALUES ($1, $2, $3, TRUE, 'advocate', $4, $5, TRUE, 'active', $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        id,
        organizationId,
        'advocate-agent',
        'Sven Advocate',
        'I listen to the community, surface feature requests, and explain what the team is working on. Your voice matters.',
        'You are the Advocate Agent. Gather user feedback, surface feature requests to admins, and explain roadmap items to the community. Be empathetic, transparent, and action-oriented.',
        JSON.stringify({ auto_surface_threshold: 3, feedback_scan_hours: 72 }),
      ],
    );
    return id;
  }

  /** Analyze patterns and feedback to surface feature requests */
  async surfaceFeatureRequests(organizationId: string, agentId: string): Promise<FeatureRequest[]> {
    const surfaced: FeatureRequest[] = [];

    // Feature request patterns that haven't been surfaced yet
    const patterns = await this.pool.query<{
      id: string;
      description: string;
      occurrence_count: number;
    }>(
      `SELECT p.id, p.description, p.occurrence_count
       FROM observed_patterns p
       WHERE p.organization_id = $1
         AND p.pattern_type = 'feature_request'
         AND p.status IN ('observed', 'confirmed')
         AND p.occurrence_count >= 2
         AND NOT EXISTS (
           SELECT 1 FROM agent_feature_requests fr
           WHERE fr.source_pattern_id = p.id AND fr.organization_id = $1
         )
       ORDER BY p.occurrence_count DESC LIMIT 5`,
      [organizationId],
    );

    for (const p of patterns.rows) {
      const priority = p.occurrence_count >= 10 ? 'high' : p.occurrence_count >= 5 ? 'medium' : 'low';
      const fr = await this.createFeatureRequest(organizationId, {
        agent_id: agentId,
        title: p.description.slice(0, 200),
        description: `Surfaced from community patterns (${p.occurrence_count} observations): ${p.description}`,
        priority,
        source_pattern_id: p.id,
      });
      surfaced.push(fr);
    }

    return surfaced;
  }

  /** Create a feature request */
  async createFeatureRequest(organizationId: string, input: CreateFeatureRequestInput): Promise<FeatureRequest> {
    const id = uuidv7();
    const result = await this.pool.query<FeatureRequest>(
      `INSERT INTO agent_feature_requests
         (id, organization_id, agent_id, title, description, priority, source_pattern_id, source_feedback_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        organizationId,
        input.agent_id,
        input.title,
        input.description,
        input.priority ?? 'medium',
        input.source_pattern_id ?? null,
        JSON.stringify(input.source_feedback_ids ?? []),
      ],
    );
    return result.rows[0];
  }

  /** List feature requests */
  async listFeatureRequests(
    organizationId: string,
    options?: { status?: string; priority?: string; limit?: number; offset?: number },
  ): Promise<{ requests: FeatureRequest[]; total: number }> {
    const limit = Math.min(options?.limit ?? 50, 200);
    const offset = options?.offset ?? 0;
    const conditions = ['organization_id = $1'];
    const params: (string | number)[] = [organizationId];

    if (options?.status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(options.status);
    }
    if (options?.priority) {
      conditions.push(`priority = $${params.length + 1}`);
      params.push(options.priority);
    }

    const where = conditions.join(' AND ');
    const [rows, countResult] = await Promise.all([
      this.pool.query<FeatureRequest>(
        `SELECT * FROM agent_feature_requests WHERE ${where} ORDER BY user_votes DESC, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.pool.query<{ count: string }>(`SELECT COUNT(*)::TEXT AS count FROM agent_feature_requests WHERE ${where}`, params),
    ]);

    return { requests: rows.rows, total: parseInt(countResult.rows[0].count, 10) };
  }

  /** Update feature request status */
  async updateRequestStatus(
    organizationId: string,
    requestId: string,
    status: string,
  ): Promise<FeatureRequest | null> {
    const result = await this.pool.query<FeatureRequest>(
      `UPDATE agent_feature_requests SET status = $3, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [requestId, organizationId, status],
    );
    return result.rows[0] ?? null;
  }

  /** Vote for a feature request */
  async voteForRequest(organizationId: string, requestId: string): Promise<FeatureRequest | null> {
    const result = await this.pool.query<FeatureRequest>(
      `UPDATE agent_feature_requests SET user_votes = user_votes + 1, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [requestId, organizationId],
    );
    return result.rows[0] ?? null;
  }

  /** Get roadmap/feature landscape summary */
  async getRoadmapSummary(organizationId: string): Promise<{
    total_requests: number;
    by_status: { status: string; count: number }[];
    by_priority: { priority: string; count: number }[];
    top_voted: FeatureRequest[];
  }> {
    const total = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM agent_feature_requests WHERE organization_id = $1`,
      [organizationId],
    );
    const byStatus = await this.pool.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::TEXT AS count FROM agent_feature_requests
       WHERE organization_id = $1 GROUP BY status ORDER BY count DESC`,
      [organizationId],
    );
    const byPriority = await this.pool.query<{ priority: string; count: string }>(
      `SELECT priority, COUNT(*)::TEXT AS count FROM agent_feature_requests
       WHERE organization_id = $1 GROUP BY priority ORDER BY count DESC`,
      [organizationId],
    );
    const topVoted = await this.pool.query<FeatureRequest>(
      `SELECT * FROM agent_feature_requests
       WHERE organization_id = $1 ORDER BY user_votes DESC LIMIT 5`,
      [organizationId],
    );

    return {
      total_requests: parseInt(total.rows[0].count, 10),
      by_status: byStatus.rows.map((r) => ({ status: r.status, count: parseInt(r.count, 10) })),
      by_priority: byPriority.rows.map((r) => ({ priority: r.priority, count: parseInt(r.count, 10) })),
      top_voted: topVoted.rows,
    };
  }
}
