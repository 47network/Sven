import { AgentRegistry, type AgentCategory, type AgentLifecycle } from '@sven/model-router/agency';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const registry = new AgentRegistry();

  switch (action) {
    case 'spawn': {
      const defId = input.definition_id as string;
      if (!defId) return { error: 'definition_id is required' };
      const inst = registry.spawn(defId);
      if (!inst) return { error: `Agent definition "${defId}" not found` };
      registry.updateLifecycle(inst.instanceId, 'running');
      return { result: inst };
    }

    case 'terminate': {
      const instId = input.instance_id as string;
      if (!instId) return { error: 'instance_id is required' };
      registry.terminate(instId);
      return { result: { terminated: instId } };
    }

    case 'terminate_all': {
      registry.terminateAll();
      return { result: { message: 'All non-completed agents terminated' } };
    }

    case 'status': {
      const instId = input.instance_id as string;
      if (!instId) return { error: 'instance_id is required' };
      const inst = registry.getInstance(instId);
      if (!inst) return { error: `Instance "${instId}" not found` };
      return { result: inst };
    }

    case 'list_instances': {
      const lifecycle = input.lifecycle as AgentLifecycle | undefined;
      const instances = registry.listInstances(lifecycle);
      return { result: { count: instances.length, instances } };
    }

    case 'list_definitions': {
      const category = input.category as AgentCategory | undefined;
      const defs = registry.listDefinitions(category).map((d) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        description: d.description,
      }));
      return { result: { count: defs.length, definitions: defs } };
    }

    case 'supervision_tree': {
      const tree = registry.getSupervisionTree();
      return { result: tree };
    }

    case 'stats': {
      return { result: registry.stats() };
    }

    default:
      return { error: `Unknown action "${action}". Use: spawn, terminate, terminate_all, status, list_instances, list_definitions, supervision_tree, stats` };
  }
}
