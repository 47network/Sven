import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

/* ------------------------------------------------------------------ */
/*  Feature Tester Agent — end-to-end feature testing, scenario exec   */
/* ------------------------------------------------------------------ */

interface TestScenario {
  id: string;
  organization_id: string;
  agent_id: string;
  scenario_type: string;
  title: string;
  description: string;
  steps: unknown[];
  expected_outcomes: unknown[];
  actual_result: Record<string, unknown> | null;
  status: string;
  imagined_by: string | null;
  executed_at: string | null;
  execution_duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

interface CreateScenarioInput {
  agent_id: string;
  scenario_type?: string;
  title: string;
  description: string;
  steps?: unknown[];
  expected_outcomes?: unknown[];
  imagined_by?: string;
}

export class FeatureTesterAgentService {
  constructor(private pool: pg.Pool) {}

  /** Bootstrap the Feature Tester Agent persona */
  async bootstrap(organizationId: string): Promise<string> {
    const id = uuidv7();
    await this.pool.query(
      `INSERT INTO agent_personas
         (id, organization_id, name, is_agent, agent_persona_type,
          persona_display_name, persona_bio, community_visible,
          agent_status, system_prompt, settings)
       VALUES ($1, $2, $3, TRUE, 'tester', $4, $5, TRUE, 'active', $6, $7)
       ON CONFLICT DO NOTHING`,
      [
        id,
        organizationId,
        'feature-tester-agent',
        'Sven Feature Tester',
        'I actively try every Sven feature end-to-end, create test scenarios, and report results transparently.',
        'You are the Feature Tester Agent. Create realistic test scenarios for every Sven capability. Execute them methodically. Report results honestly. Use the dedicated test VM for safe experimentation.',
        JSON.stringify({ test_vm_target: 'vm-agents-test', auto_execute: false }),
      ],
    );
    return id;
  }

  /** Create a test scenario */
  async createScenario(organizationId: string, input: CreateScenarioInput): Promise<TestScenario> {
    const id = uuidv7();
    const result = await this.pool.query<TestScenario>(
      `INSERT INTO agent_test_scenarios
         (id, organization_id, agent_id, scenario_type, title, description, steps, expected_outcomes, imagined_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        organizationId,
        input.agent_id,
        input.scenario_type ?? 'functional',
        input.title,
        input.description,
        JSON.stringify(input.steps ?? []),
        JSON.stringify(input.expected_outcomes ?? []),
        input.imagined_by ?? null,
      ],
    );
    return result.rows[0];
  }

  /** Execute a test scenario (simulated — records timing and outcomes) */
  async executeScenario(
    organizationId: string,
    scenarioId: string,
    executionResult: { passed: boolean; details: Record<string, unknown> },
  ): Promise<TestScenario | null> {
    const start = Date.now();
    const status = executionResult.passed ? 'passed' : 'failed';
    const elapsed = Date.now() - start;

    const result = await this.pool.query<TestScenario>(
      `UPDATE agent_test_scenarios
       SET status = $3, actual_result = $4, executed_at = NOW(),
           execution_duration_ms = $5, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING *`,
      [
        scenarioId,
        organizationId,
        status,
        JSON.stringify(executionResult.details),
        elapsed,
      ],
    );
    return result.rows[0] ?? null;
  }

  /** Mark a scenario as running */
  async markRunning(organizationId: string, scenarioId: string): Promise<TestScenario | null> {
    const result = await this.pool.query<TestScenario>(
      `UPDATE agent_test_scenarios SET status = 'running', updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND status = 'pending'
       RETURNING *`,
      [scenarioId, organizationId],
    );
    return result.rows[0] ?? null;
  }

  /** List test scenarios */
  async listScenarios(
    organizationId: string,
    options?: { status?: string; scenario_type?: string; limit?: number; offset?: number },
  ): Promise<{ scenarios: TestScenario[]; total: number }> {
    const limit = Math.min(options?.limit ?? 50, 200);
    const offset = options?.offset ?? 0;
    const conditions = ['organization_id = $1'];
    const params: (string | number)[] = [organizationId];

    if (options?.status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(options.status);
    }
    if (options?.scenario_type) {
      conditions.push(`scenario_type = $${params.length + 1}`);
      params.push(options.scenario_type);
    }

    const where = conditions.join(' AND ');
    const [rows, countResult] = await Promise.all([
      this.pool.query<TestScenario>(
        `SELECT * FROM agent_test_scenarios WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.pool.query<{ count: string }>(`SELECT COUNT(*)::TEXT AS count FROM agent_test_scenarios WHERE ${where}`, params),
    ]);

    return { scenarios: rows.rows, total: parseInt(countResult.rows[0].count, 10) };
  }

  /** Get testing summary */
  async getTestingSummary(organizationId: string): Promise<{
    total_scenarios: number;
    by_status: { status: string; count: number }[];
    by_type: { scenario_type: string; count: number }[];
    pass_rate: number;
    avg_execution_ms: number | null;
    recent_failures: TestScenario[];
  }> {
    const total = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count FROM agent_test_scenarios WHERE organization_id = $1`,
      [organizationId],
    );
    const byStatus = await this.pool.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::TEXT AS count FROM agent_test_scenarios
       WHERE organization_id = $1 GROUP BY status`,
      [organizationId],
    );
    const byType = await this.pool.query<{ scenario_type: string; count: string }>(
      `SELECT scenario_type, COUNT(*)::TEXT AS count FROM agent_test_scenarios
       WHERE organization_id = $1 GROUP BY scenario_type`,
      [organizationId],
    );
    const passRate = await this.pool.query<{ rate: string }>(
      `SELECT CASE WHEN COUNT(*) = 0 THEN 0
              ELSE (COUNT(*) FILTER (WHERE status = 'passed')::FLOAT / COUNT(*) * 100)
              END::TEXT AS rate
       FROM agent_test_scenarios
       WHERE organization_id = $1 AND status IN ('passed', 'failed')`,
      [organizationId],
    );
    const avgMs = await this.pool.query<{ avg_ms: string | null }>(
      `SELECT AVG(execution_duration_ms)::TEXT AS avg_ms FROM agent_test_scenarios
       WHERE organization_id = $1 AND execution_duration_ms IS NOT NULL`,
      [organizationId],
    );
    const failures = await this.pool.query<TestScenario>(
      `SELECT * FROM agent_test_scenarios
       WHERE organization_id = $1 AND status = 'failed'
       ORDER BY executed_at DESC LIMIT 5`,
      [organizationId],
    );

    return {
      total_scenarios: parseInt(total.rows[0].count, 10),
      by_status: byStatus.rows.map((r) => ({ status: r.status, count: parseInt(r.count, 10) })),
      by_type: byType.rows.map((r) => ({ scenario_type: r.scenario_type, count: parseInt(r.count, 10) })),
      pass_rate: parseFloat(passRate.rows[0].rate),
      avg_execution_ms: avgMs.rows[0].avg_ms ? parseFloat(avgMs.rows[0].avg_ms) : null,
      recent_failures: failures.rows,
    };
  }
}
