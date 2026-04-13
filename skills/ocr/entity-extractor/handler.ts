import { extractNamedEntities, redactPii } from '@sven/document-intel/entities';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const content = (input.content as string) ?? '';

  switch (action) {
    case 'extract': {
      const entities = extractNamedEntities(content);
      return {
        result: {
          totalEntities: entities.length,
          piiCount: entities.filter((e) => e.isPii).length,
          entities,
        },
      };
    }

    case 'redact': {
      const entities = extractNamedEntities(content);
      const redacted = redactPii(entities);
      return {
        result: {
          totalEntities: redacted.length,
          redactedCount: redacted.filter((e) => e.isPii).length,
          entities: redacted,
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: extract, redact` };
  }
}
