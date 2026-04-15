import {
  checkBrandVoice,
  DEFAULT_47NETWORK_BRAND,
} from '@sven/marketing-intel/brand-voice';

type InputPayload = {
  action: 'check' | 'profile';
  content?: string;
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  const action = payload.action;
  if (!action) throw new Error('action is required');

  switch (action) {
    case 'check': {
      if (!payload.content) throw new Error('content is required');
      const result = checkBrandVoice(payload.content);
      return { action, result };
    }

    case 'profile':
      return { action, result: DEFAULT_47NETWORK_BRAND };

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}
