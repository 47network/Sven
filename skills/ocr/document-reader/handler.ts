import {
  createOcrConfig,
  processOcrRegions,
  buildOcrResult,
  detectLanguage,
  type OcrMode,
  type DocumentLanguage,
  type OcrPage,
} from '@sven/document-intel/ocr';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'read': {
      const content = (input.content as string) ?? '';
      const config = createOcrConfig({
        mode: (input.mode as OcrMode) ?? 'mixed',
        language: (input.language as DocumentLanguage) ?? 'auto',
        outputFormat: (input.output_format as 'text' | 'markdown' | 'json' | 'html') ?? 'markdown',
      });
      const startTime = Date.now();
      const regions = processOcrRegions(content, config);
      const page: OcrPage = {
        pageNumber: 1,
        width: 2480,
        height: 3508,
        regions,
        text: regions.map((r) => r.content).join('\n'),
        tables: [],
      };
      const result = buildOcrResult(`doc-${Date.now()}`, [page], startTime);
      return { result };
    }

    case 'configure': {
      const config = createOcrConfig({
        mode: input.mode as OcrMode | undefined,
        language: input.language as DocumentLanguage | undefined,
        outputFormat: input.output_format as 'text' | 'markdown' | 'json' | 'html' | undefined,
      });
      return { result: config };
    }

    case 'detect_language': {
      const content = (input.content as string) ?? '';
      const lang = detectLanguage(content);
      return { result: { detectedLanguage: lang } };
    }

    default:
      return { error: `Unknown action "${action}". Use: read, configure, detect_language` };
  }
}
