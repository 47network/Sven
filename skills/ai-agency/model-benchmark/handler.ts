import { BenchmarkEngine } from '@sven/model-router/benchmark';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const engine = new BenchmarkEngine();

  switch (action) {
    case 'list_suites': {
      const suites = engine.listSuites().map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        taskCount: s.tasks.length,
      }));
      return { result: { count: suites.length, suites } };
    }

    case 'create_run': {
      const suiteId = input.suite_id as string;
      const modelId = input.model_id as string;
      const modelName = (input.model_name as string) ?? modelId;
      if (!suiteId || !modelId) return { error: 'suite_id and model_id are required' };
      const run = engine.createRun(suiteId, modelId, modelName);
      if (!run) return { error: `Suite "${suiteId}" not found` };
      return { result: run };
    }

    case 'complete_run': {
      const runId = input.run_id as string;
      if (!runId) return { error: 'run_id is required' };
      const run = engine.completeRun(runId);
      if (!run) return { error: `Run "${runId}" not found` };
      return { result: run };
    }

    case 'leaderboard': {
      const board = engine.getLeaderboard();
      return { result: { leaderboard: board } };
    }

    case 'report': {
      const modelId = input.model_id as string;
      if (!modelId) return { error: 'model_id is required' };
      const report = engine.generateReport(modelId);
      return { result: { modelId, markdown: report } };
    }

    case 'record_elo': {
      const wId = input.winner_id as string;
      const lId = input.loser_id as string;
      const isDraw = (input.is_draw as boolean) ?? false;
      if (!wId || !lId) return { error: 'winner_id and loser_id are required' };
      engine.updateElo(wId, wId, lId, lId, isDraw);
      return { result: { updated: true, leaderboard: engine.getLeaderboard() } };
    }

    case 'ab_results': {
      const modelId = input.model_id as string | undefined;
      const results = engine.getABResults(modelId);
      return { result: { count: results.length, results } };
    }

    default:
      return { error: `Unknown action "${action}". Use: list_suites, create_run, complete_run, leaderboard, report, record_elo, ab_results` };
  }
}
