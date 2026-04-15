import { analyzeLanguageLevel } from '@sven/marketing-intel/communication-coach';

type InputPayload = {
  action: 'analyze';
  content: string;
  current_level?: string;
  target_level?: string;
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  if (payload.action !== 'analyze') throw new Error(`Unsupported action: ${payload.action}`);
  if (!payload.content) throw new Error('content is required');

  const analysis = analyzeLanguageLevel(
    payload.content,
    payload.current_level ?? 'individual contributor',
    payload.target_level ?? 'senior leader',
  );

  return { action: 'analyze', result: analysis };
}
