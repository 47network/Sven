import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/* ------------------------------------------------------------------ */
/*  QA Agent — automated testing, bug filing, quality metrics          */
/* ------------------------------------------------------------------ */

interface BugReport {
  id: string;
  organization_id: string;
  agent_id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  reproduction_steps: unknown[];
  affected_capability: string | null;
  test_evidence: Record<string, unknown>;
  linked_report_id: string | null;
  created_at: string;
  updated_at: string;
}

interface FileBugInput {
  agent_id: string;
  title: string;
  description: string;
  severity?: string;
  reproduction_steps?: unknown[];
  affected_capability?: string;
  test_evidence?: Record<string, unknown>;
  linked_report_id?: string;
}

interface QualityMetrics {
  total_bugs: number;
  open_bugs: number;
  by_severity: { severity: string; count: number }[];
  by_status: { status: string; count: number }[];
  mean_time_to_fix_hours: number | null;
  most_affected_capabilities: { capability: string; count: number }[];
}

export class QAAgentService {
  constructor(private pool: pg.Pool) {}

  /** Bootstrap the QA Agent persona */
  async bootstrap(organizationId: string): Promise<string> {
    const id = uuidv7();
    await this.pool.query(
      `INSERT INTO agent_personas
         (id, organization_id, name, is_agent, agent_persona_type,
          persona_display_name, persona_bio, community_visible,
          agent_status, system_prompt, settings)
       VALUES ($1, $2, $3, TRUE, 'qa', $4, $5, TRUE, 'active', $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        id,
        organizationId,
        'qa-agent',
        'Sven QA',
        'I run automated tests and file transparent bug reports. Quality assurance you can see.',
        'You are the QA Agent. Run automated capability tests, detect issues, and file clear, actionable bug reports visible to the community. Be precise and factual.',
        JSON.stringify({ auto_test_interval_minutes: 120, severity_auto_escalate: true }),
      ],
    );
    return id;
  }

  /** File a bug report from test results or capability check failures */
  async fileBugReport(organizationId: string, input: FileBugInput): Promise<BugReport> {
    const id = uuidv7();

    // Check for duplicates on the same capability
    if (input.affected_capability) {
      const existing = await this.pool.query<{ id: string }>(
        `SELECT id FROM agent_bug_reports
         WHERE organization_id = $1 AND affected_capability = $2
           AND status IN ('open', 'investigating', 'confirmed')
           AND created_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [organizationId, input.affected_capability],
      );
      if (existing.rows.length > 0) {
        // Link to existing instead of duplicating
        const result = await this.pool.query<BugReport>(
          `INSERT INTO agent_bug_reports
             (id, organization_id, agent_id, title, description, severity,
              reproduction_steps, affected_capability, test_evidence, linked_report_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            id, organizationId, input.agent_id,
            `[Duplicate] ${input.title}`, input.description,
            input.severity ?? 'medium',
            JSON.stringify(input.reproduction_steps ?? []),
            input.affected_capability ?? null,
            JSON.stringify(input.test_evidence ?? {}),
            existing.rows[0].id,
          ],
        );
        await this.pool.query(
          `UPDATE agent_bug_reports SET status = 'duplicate', updated_at = NOW() WHERE id = $1`,
          [id],
        );
        return result.rows[0];
      }
    }

    const result = await this.pool.query<BugReport>(
      `INSERT INTO agent_bug_reports
         (id, organization_id, agent_id, title, description, severity,
          reproduction_steps, affected_capability, test_evidence, linked_report_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id, organizationId, input.agent_id,
        input.title, input.description,
        input.severity ?? 'medium',
        JSON.stringify(input.reproduction_steps ?? []),
        input.affected_capability ?? null,
        JSON.stringify(input.test_evidence ?? {}),
        input.linked_report_id ?? null,
      ],
    );
    return result.rows[0];
  }

  /** List bug reports */
  async listBugReports(
    organizationId: string,
    options?: { status?: string; severity?: string; capability?: string; limit?: number; offset?: number },
  ): Promise<{ reports: BugReport[]; total: number }> {
    const limit = Math.min(options?.limit ?? 50, 200);
    const offset = options?.offset ?? 0;
    const conditions = ['organization_id = $1'];
    const params: (string | number)[] = [organizationId];

    if (options?.status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(options.status);
    }
    if (options?.severity) {
      conditions.push(`severity = $${params.length + 1}`);
      params.push(options.severity);
    }
    if (options?.capability) {
      conditions.push(`affected_capability = $${params.length + 1}`);
      params.push(options.capability);
    }

    const where = conditions.join(' AND ');
    const [rows, countResult] = await Promise.all([
      this.pool.query<BugReport>(
        `SELECT * FROM agent_bug_reports WHERE ${where}
         ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.pool.query<{ count: string }>(`SELECT COUNT(*)::TEXT AS count FROM agent_bug_reports WHERE ${where}`, params),
    ]);

    return { reports: rows.rows, total: parseInt(countResult.rows[0].count, 10) };
  }

  /** Update bug report status */
  async updateBugStatus(organizationId: string, bugId: string, status: string): Promise<BugReport | null> {
    const result = await this.pool.query<BugReport>(
      `UPDATE agent_bug_reports SET status = $3, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [bugId, organizationId, status],
    );
    return result.rows[0] ?? null;
  }

  /** Get quality metrics */
  async getQualityMetrics(organizationId: string): Promise<QualityMetrics> {
    const total = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM agent_bug_reports WHERE organization_id = $1`,
      [organizationId],
    );
    const open = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM agent_bug_reports
       WHERE organization_id = $1 AND status IN ('open', 'investigating', 'confirmed')`,
      [organizationId],
    );
    const bySeverity = await this.pool.query<{ severity: string; count: string }>(
      `SELECT severity, COUNT(*)::TEXT AS count FROM agent_bug_reports
       WHERE organization_id = $1 GROUP BY severity`,
      [organizationId],
    );
    const byStatus = await this.pool.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::TEXT AS count FROM agent_bug_reports
       WHERE organization_id = $1 GROUP BY status`,
      [organizationId],
    );
    const mttf = await this.pool.query<{ avg_hours: string | null }>(
      `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600)::TEXT AS avg_hours
       FROM agent_bug_reports WHERE organization_id = $1 AND status = 'fixed'`,
      [organizationId],
    );
    const capabilities = await this.pool.query<{ capability: string; count: string }>(
      `SELECT affected_capability AS capability, COUNT(*)::TEXT AS count
       FROM agent_bug_reports WHERE organization_id = $1 AND affected_capability IS NOT NULL
       GROUP BY affected_capability ORDER BY count DESC LIMIT 10`,
      [organizationId],
    );

    return {
      total_bugs: parseInt(total.rows[0].count, 10),
      open_bugs: parseInt(open.rows[0].count, 10),
      by_severity: bySeverity.rows.map((r) => ({ severity: r.severity, count: parseInt(r.count, 10) })),
      by_status: byStatus.rows.map((r) => ({ status: r.status, count: parseInt(r.count, 10) })),
      mean_time_to_fix_hours: mttf.rows[0].avg_hours ? parseFloat(mttf.rows[0].avg_hours) : null,
      most_affected_capabilities: capabilities.rows.map((r) => ({
        capability: r.capability,
        count: parseInt(r.count, 10),
      })),
    };
  }
}
