import { auditCommunication } from '@sven/marketing-intel/communication-coach';

type InputPayload = {
  action: 'audit';
  content: string;
  role?: string;
};

export default async function handler(input: Record<string, unknown>) {
  const payload = input as InputPayload;
  if (payload.action !== 'audit') throw new Error(`Unsupported action: ${payload.action}`);
  if (!payload.content) throw new Error('content is required');

  const audit = auditCommunication(payload.content, payload.role ?? 'unknown');
  return { action: 'audit', result: audit };
}
