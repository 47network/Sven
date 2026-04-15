import { createOcrConfig, processOcrRegions, type OcrRegion } from '@sven/document-intel/ocr';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'extract_code': {
      const content = (input.content as string) ?? '';
      const config = createOcrConfig({ mode: 'code', enableCodeDetection: true });
      const regions = processOcrRegions(content, config);
      const codeRegions = regions.filter((r: OcrRegion) => r.type === 'code');
      const allCode = codeRegions.length > 0
        ? codeRegions.map((r: OcrRegion) => r.content).join('\n')
        : regions.map((r: OcrRegion) => r.content).join('\n');
      const detectedLang = (input.language as string) ?? detectCodeLanguage(allCode);
      return {
        result: {
          code: allCode,
          language: detectedLang,
          codeRegions: codeRegions.length,
          totalRegions: regions.length,
          confidence: codeRegions.length > 0
            ? codeRegions.reduce((s: number, r: OcrRegion) => s + r.confidence, 0) / codeRegions.length
            : 0,
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: extract_code` };
  }
}

function detectCodeLanguage(code: string): string {
  if (/\b(import|export|const|let|interface|type)\b/.test(code)) return 'typescript';
  if (/\b(def|class|import|from|self)\b/.test(code) && /:$/.test(code)) return 'python';
  if (/\b(func|package|go|defer|goroutine)\b/.test(code)) return 'go';
  if (/\b(fn|let|mut|impl|struct|pub)\b/.test(code)) return 'rust';
  if (/\b(public|private|void|class|static)\b/.test(code)) return 'java';
  return 'unknown';
}
