import { ModelRegistry, type TaskType, type ModelStatus } from '@sven/model-router/registry';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const registry = new ModelRegistry();

  switch (action) {
    case 'list': {
      const models = registry.list().map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        parameterCount: m.parameterCount,
        quantization: m.quantization,
        status: m.status,
        supportedTasks: m.supportedTasks,
        vramRequirementMb: m.vramRequirementMb,
      }));
      return { result: { count: models.length, models } };
    }

    case 'get': {
      const id = input.model_id as string;
      if (!id) return { error: 'model_id is required' };
      const model = registry.get(id);
      if (!model) return { error: `Model "${id}" not found` };
      return { result: model };
    }

    case 'by_task': {
      const task = input.task as TaskType;
      if (!task) return { error: 'task is required' };
      const models = registry.listByTask(task).map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        parameterCount: m.parameterCount,
      }));
      return { result: { task, count: models.length, models } };
    }

    case 'by_status': {
      const status = input.status as ModelStatus;
      if (!status) return { error: 'status is required' };
      const models = registry.listByStatus(status).map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status,
      }));
      return { result: { status, count: models.length, models } };
    }

    case 'set_default': {
      const task = input.task as TaskType;
      const modelId = input.model_id as string;
      if (!task || !modelId) return { error: 'task and model_id are required' };
      registry.setDefaultModel(task, modelId);
      return { result: { set: true, task, modelId } };
    }

    case 'get_default': {
      const task = input.task as TaskType;
      if (!task) return { error: 'task is required' };
      const model = registry.getDefaultModel(task);
      return { result: model ? { id: model.id, name: model.name } : { id: null, message: 'No default set' } };
    }

    case 'manifest': {
      return { result: registry.getManifest() };
    }

    case 'set_status': {
      const id = input.model_id as string;
      const status = input.status as ModelStatus;
      if (!id || !status) return { error: 'model_id and status are required' };
      registry.setStatus(id, status);
      return { result: { updated: true, modelId: id, status } };
    }

    case 'health': {
      const id = input.model_id as string;
      const tps = input.tokens_per_second as number;
      if (!id || tps === undefined) return { error: 'model_id and tokens_per_second are required' };
      registry.recordHealthCheck(id, tps);
      return { result: { recorded: true, modelId: id, tokensPerSecond: tps } };
    }

    default:
      return { error: `Unknown action "${action}". Use: list, get, by_task, by_status, set_default, get_default, manifest, set_status, health` };
  }
}
