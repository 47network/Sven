import {
  summariseDocument,
  compareDocuments,
  createSummaryConfig,
  type SummaryStyle,
} from '@sven/document-intel/summarizer';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'summarize': {
      const content = (input.content as string) ?? '';
      const title = (input.title as string) ?? null;
      const config = createSummaryConfig({
        style: (input.style as SummaryStyle) ?? 'executive',
        maxLength: (input.max_length as number) ?? 2000,
      });
      const summary = summariseDocument(`doc-${Date.now()}`, content, title, config);
      return { result: summary };
    }

    case 'compare': {
      const docs = (input.documents as { id: string; title: string | null; text: string }[]) ?? [];
      if (docs.length < 2) return { error: 'At least 2 documents are required for comparison' };
      const comparison = compareDocuments(docs);
      return { result: comparison };
    }

    case 'key_points': {
      const content = (input.content as string) ?? '';
      const config = createSummaryConfig({ extractKeyPoints: true, style: 'bullet_points' });
      const summary = summariseDocument(`doc-${Date.now()}`, content, null, config);
      return { result: { keyPoints: summary.keyPoints } };
    }

    default:
      return { error: `Unknown action "${action}". Use: summarize, compare, key_points` };
  }
}
