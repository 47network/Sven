import { ModelRegistry } from '@sven/model-router/registry';
import {
  classifyTask,
  routeRequest,
  scoreModel,
  calculateVramBudget,
  suggestEviction,
  type InferenceRequest,
} from '@sven/model-router/router';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const registry = new ModelRegistry();

  switch (action) {
    case 'route': {
      const req: InferenceRequest = {
        id: `req-${Date.now()}`,
        task: (input.task as string | undefined)
          ? classifyTask(input.task as string)
          : classifyTask(input.prompt as string),
        prompt: (input.prompt as string) ?? '',
        qualityPriority: (input.quality_priority as 'speed' | 'balanced' | 'quality') ?? 'balanced',
        preferredModel: input.preferred_model as string | undefined,
        latencyBudgetMs: input.latency_budget_ms as number | undefined,
      };
      const decision = routeRequest(registry, req);
      return { result: decision };
    }

    case 'score': {
      const modelId = input.preferred_model as string;
      const model = registry.get(modelId);
      if (!model) return { error: `Model "${modelId}" not found in registry` };
      const task = classifyTask((input.prompt as string) ?? (input.task as string) ?? 'chat');
      const priority = (input.quality_priority as 'speed' | 'balanced' | 'quality') ?? 'balanced';
      const score = scoreModel(model, task, priority, input.latency_budget_ms as number | undefined);
      return { result: { modelId, score, task, priority } };
    }

    case 'classify': {
      const prompt = (input.prompt as string) ?? '';
      const task = classifyTask(prompt);
      return { result: { prompt: prompt.slice(0, 100), classifiedTask: task } };
    }

    case 'list_models': {
      const models = registry.list().map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        parameterCount: m.parameterCount,
        status: m.status,
        supportedTasks: m.supportedTasks,
        vramRequirementMb: m.vramRequirementMb,
      }));
      return { result: { count: models.length, models } };
    }

    case 'vram_budget': {
      const totalVram = (input.total_vram_mb as number) ?? 48_000;
      const budget = calculateVramBudget(registry, totalVram);
      return { result: budget };
    }

    case 'suggest_eviction': {
      const needed = (input.needed_vram_mb as number) ?? 16_000;
      const total = (input.total_vram_mb as number) ?? 48_000;
      const evictions = suggestEviction(registry, needed, total);
      return { result: { evictions } };
    }

    default:
      return { error: `Unknown action "${action}". Use: route, score, classify, list_models, vram_budget, suggest_eviction` };
  }
}
