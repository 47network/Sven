import {
  listConversationScenarios,
  getScenario,
  createCustomScenario,
  analyzeConversationTurn,
  generateDebrief,
  type ConversationScenario,
  type ConversationTurn,
} from '@sven/marketing-intel/communication-coach';

type InputPayload = {
  action: 'list_scenarios' | 'get_scenario' | 'create_scenario' | 'analyze_turn' | 'debrief';
  scenario_id?: string;
  title?: string;
  context?: string;
  other_party?: string;
  objectives?: string[];
  difficulty?: ConversationScenario['difficulty'];
  message?: string;
  turns?: ConversationTurn[];
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  switch (action) {
    case 'list_scenarios':
      return { action, result: { scenarios: listConversationScenarios() } };

    case 'get_scenario': {
      if (!payload.scenario_id) throw new Error('scenario_id is required');
      const scenario = getScenario(payload.scenario_id);
      if (!scenario) return { action, result: { error: `Unknown scenario: ${payload.scenario_id}` } };
      return { action, result: scenario };
    }

    case 'create_scenario': {
      if (!payload.title) throw new Error('title is required');
      if (!payload.context) throw new Error('context is required');
      if (!payload.other_party) throw new Error('other_party is required');
      const scenario = createCustomScenario(
        payload.title,
        payload.context,
        payload.other_party,
        payload.objectives ?? [],
        payload.difficulty,
      );
      return { action, result: scenario };
    }

    case 'analyze_turn': {
      if (!payload.message) throw new Error('message is required');
      if (!payload.scenario_id) throw new Error('scenario_id is required');
      const scenario = getScenario(payload.scenario_id);
      if (!scenario) throw new Error(`Unknown scenario: ${payload.scenario_id}`);
      const analysis = analyzeConversationTurn(payload.message, scenario);
      return { action, result: analysis };
    }

    case 'debrief': {
      if (!payload.scenario_id) throw new Error('scenario_id is required');
      if (!payload.turns) throw new Error('turns array is required');
      const scenario = getScenario(payload.scenario_id);
      if (!scenario) throw new Error(`Unknown scenario: ${payload.scenario_id}`);
      const debrief = generateDebrief(scenario, payload.turns);
      return { action, result: debrief };
    }

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
