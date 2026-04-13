import { extractIdDocument } from '@sven/document-intel/entities';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'read_id': {
      const content = (input.content as string) ?? '';
      const piiSafe = (input.pii_safe as boolean) ?? true;
      const data = extractIdDocument(content);

      if (piiSafe) {
        return {
          result: {
            documentType: data.documentType,
            fullName: data.fullName ? data.fullName[0] + '***' : null,
            dateOfBirth: data.dateOfBirth ? '***' : null,
            documentNumber: data.documentNumber ? '***' + data.documentNumber.slice(-3) : null,
            expiryDate: data.expiryDate,
            issuingCountry: data.issuingCountry,
            nationality: data.nationality,
            confidence: data.confidence,
            piiRedacted: true,
          },
        };
      }

      return { result: { ...data, piiRedacted: false } };
    }

    default:
      return { error: `Unknown action "${action}". Use: read_id` };
  }
}
