import { extractReceiptData } from '@sven/document-intel/entities';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'scan_receipt': {
      const content = (input.content as string) ?? '';
      const receipt = extractReceiptData(content);
      return { result: receipt };
    }

    default:
      return { error: `Unknown action "${action}". Use: scan_receipt` };
  }
}
