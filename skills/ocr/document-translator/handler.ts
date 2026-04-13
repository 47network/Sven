import { summariseDocument, translateSummary, createSummaryConfig, type SummaryStyle } from '@sven/document-intel/summarizer';
import { detectLanguage } from '@sven/document-intel/ocr';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'translate_summary': {
      const content = (input.content as string) ?? '';
      const targetLang = (input.target_language as string) ?? 'en';
      const style = (input.style as SummaryStyle) ?? 'executive';
      const config = createSummaryConfig({ style, targetLanguage: targetLang });
      const summary = summariseDocument(`doc-${Date.now()}`, content, null, config);
      const translated = translateSummary(summary, targetLang);
      return { result: translated };
    }

    case 'detect_language': {
      const content = (input.content as string) ?? '';
      const lang = detectLanguage(content);
      return { result: { detectedLanguage: lang, content: content.slice(0, 100) } };
    }

    default:
      return { error: `Unknown action "${action}". Use: translate_summary, detect_language` };
  }
}
