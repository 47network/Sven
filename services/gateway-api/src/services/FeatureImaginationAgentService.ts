import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/* ------------------------------------------------------------------ */
/*  Feature Imagination Agent — creative use-case invention            */
/* ------------------------------------------------------------------ */

interface ImaginedScenario {
  id: string;
  organization_id: string;
  agent_id: string;
  scenario_type: string;
  title: string;
  description: string;
  steps: unknown[];
  expected_outcomes: unknown[];
  status: string;
  imagined_by: string;
  created_at: string;
  updated_at: string;
}

interface ImagineScenarioInput {
  agent_id: string;
  title: string;
  description: string;
  scenario_type?: string;
  steps?: unknown[];
  expected_outcomes?: unknown[];
}

const IMAGINATION_CATEGORIES = [
  'novel_workflow',
  'cross_feature_combo',
  'edge_case_exploration',
  'user_persona_simulation',
  'stress_scenario',
  'creative_misuse',
] as const;

export class FeatureImaginationAgentService {
  constructor(private pool: pg.Pool) {}

  /** Bootstrap the Feature Imagination Agent persona */
  async bootstrap(organizationId: string): Promise<string> {
    const id = uuidv7();
    await this.pool.query(
      `INSERT INTO agent_personas
         (id, organization_id, name, is_agent, agent_persona_type,
          persona_display_name, persona_bio, community_visible,
          agent_status, system_prompt, settings)
       VALUES ($1, $2, $3, TRUE, 'imagination', $4, $5, TRUE, 'active', $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        id,
        organizationId,
        'feature-imagination-agent',
        'Sven Imagination',
        'I dream up new ways to use Sven that nobody has tried yet. Creative innovation is my purpose.',
        'You are the Feature Imagination Agent. Invent creative, novel use cases for Sven. Combine features in unexpected ways. Imagine what users might want to do but haven\'t thought of yet. Be bold, creative, and experimental. Test your ideas on the dedicated VM.',
        JSON.stringify({
          categories: IMAGINATION_CATEGORIES,
          creativity_mode: 'high',
          propose_to_tester: true,
        }),
      ],
    );
    return id;
  }

  /** Imagine a new scenario (stored in agent_test_scenarios with imagined_by set) */
  async imagineScenario(organizationId: string, input: ImagineScenarioInput): Promise<ImaginedScenario> {
    const id = uuidv7();
    const result = await this.pool.query<ImaginedScenario>(
      `INSERT INTO agent_test_scenarios
         (id, organization_id, agent_id, scenario_type, title, description,
          steps, expected_outcomes, status, imagined_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $3)
       RETURNING *`,
      [
        id,
        organizationId,
        input.agent_id,
        input.scenario_type ?? 'creative',
        input.title,
        input.description,
        JSON.stringify(input.steps ?? []),
        JSON.stringify(input.expected_outcomes ?? []),
      ],
    );
    return result.rows[0];
  }

  /** List imagined scenarios */
  async listScenarios(
    organizationId: string,
    options?: { status?: string; limit?: number; offset?: number },
  ): Promise<{ scenarios: ImaginedScenario[]; total: number }> {
    const limit = Math.min(options?.limit ?? 50, 200);
    const offset = options?.offset ?? 0;
    const conditions = ['organization_id = $1', 'imagined_by IS NOT NULL'];
    const params: (string | number)[] = [organizationId];

    if (options?.status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(options.status);
    }

    const where = conditions.join(' AND ');
    const [rows, countResult] = await Promise.all([
      this.pool.query<ImaginedScenario>(
        `SELECT * FROM agent_test_scenarios WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.pool.query<{ count: string }>(`SELECT COUNT(*)::TEXT AS count FROM agent_test_scenarios WHERE ${where}`, params),
    ]);

    return { scenarios: rows.rows, total: parseInt(countResult.rows[0].count, 10) };
  }

  /** Propose an imagined scenario to the Feature Tester for execution */
  async proposeToTester(
    organizationId: string,
    scenarioId: string,
    testerAgentId: string,
  ): Promise<ImaginedScenario | null> {
    // Reassign the scenario to the tester agent while keeping imagined_by for attribution
    const result = await this.pool.query<ImaginedScenario>(
      `UPDATE agent_test_scenarios
       SET agent_id = $3, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND imagined_by IS NOT NULL
       RETURNING *`,
      [scenarioId, organizationId, testerAgentId],
    );
    return result.rows[0] ?? null;
  }

  /** Get creativity summary */
  async getCreativeSummary(organizationId: string): Promise<{
    total_imagined: number;
    proposed_to_tester: number;
    executed_count: number;
    pass_rate: number;
    by_type: { scenario_type: string; count: number }[];
  }> {
    const total = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM agent_test_scenarios
       WHERE organization_id = $1 AND imagined_by IS NOT NULL`,
      [organizationId],
    );
    const proposed = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM agent_test_scenarios
       WHERE organization_id = $1 AND imagined_by IS NOT NULL
         AND agent_id != imagined_by`,
      [organizationId],
    );
    const executed = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM agent_test_scenarios
       WHERE organization_id = $1 AND imagined_by IS NOT NULL
         AND status IN ('passed', 'failed')`,
      [organizationId],
    );
    const passRate = await this.pool.query<{ rate: string }>(
      `SELECT CASE WHEN COUNT(*) = 0 THEN 0
              ELSE (COUNT(*) FILTER (WHERE status = 'passed')::FLOAT / COUNT(*) * 100)
              END::TEXT AS rate
       FROM agent_test_scenarios
       WHERE organization_id = $1 AND imagined_by IS NOT NULL AND status IN ('passed', 'failed')`,
      [organizationId],
    );
    const byType = await this.pool.query<{ scenario_type: string; count: string }>(
      `SELECT scenario_type, COUNT(*)::TEXT AS count FROM agent_test_scenarios
       WHERE organization_id = $1 AND imagined_by IS NOT NULL
       GROUP BY scenario_type ORDER BY count DESC`,
      [organizationId],
    );

    return {
      total_imagined: parseInt(total.rows[0].count, 10),
      proposed_to_tester: parseInt(proposed.rows[0].count, 10),
      executed_count: parseInt(executed.rows[0].count, 10),
      pass_rate: parseFloat(passRate.rows[0].rate),
      by_type: byType.rows.map((r) => ({ scenario_type: r.scenario_type, count: parseInt(r.count, 10) })),
    };
  }
}
