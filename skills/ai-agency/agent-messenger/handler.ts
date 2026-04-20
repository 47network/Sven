import { AgentRegistry } from '@sven/model-router/agency';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const registry = new AgentRegistry();

  switch (action) {
    case 'send': {
      const from = input.from_agent as string;
      const to = input.to_agent as string;
      const channel = (input.channel as string) ?? 'default';
      const payload = (input.payload as Record<string, unknown>) ?? {};
      if (!from || !to) return { error: 'from_agent and to_agent are required' };
      const msg = registry.send(from, to, channel, payload);
      return { result: msg };
    }

    case 'broadcast': {
      const from = input.from_agent as string;
      const channel = (input.channel as string) ?? 'default';
      const payload = (input.payload as Record<string, unknown>) ?? {};
      if (!from) return { error: 'from_agent is required' };
      const msgs = registry.broadcast(from, channel, payload);
      return { result: { sent: msgs.length, messages: msgs } };
    }

    case 'history': {
      const agentId = input.agent_id as string;
      if (!agentId) return { error: 'agent_id is required' };
      const channel = input.channel as string | undefined;
      const limit = (input.limit as number) ?? 50;
      const msgs = registry.getMessages(agentId, channel, limit);
      return { result: { count: msgs.length, messages: msgs } };
    }

    default:
      return { error: `Unknown action "${action}". Use: send, broadcast, history` };
  }
}
