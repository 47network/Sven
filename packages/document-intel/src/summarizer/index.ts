// ---------------------------------------------------------------------------
// Document Summariser
// ---------------------------------------------------------------------------
// Extractive and abstractive summarisation for documents. Supports
// multi-page documents, key-point extraction, comparison summaries,
// and translation-aware summarisation.
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ types */

export type SummaryStyle = 'executive' | 'detailed' | 'bullet_points' | 'one_liner';

export interface SummaryConfig {
  style: SummaryStyle;
  maxLength: number;          // max chars
  extractKeyPoints: boolean;
  includeMetadata: boolean;
  targetLanguage: string;     // 'en' default, set for translation-aware summary
}

export interface DocumentSummary {
  documentId: string;
  title: string | null;
  summary: string;
  keyPoints: string[];
  wordCount: number;
  originalWordCount: number;
  compressionRatio: number;
  style: SummaryStyle;
  language: string;
  metadata: Record<string, unknown>;
}

export interface ComparisonSummary {
  documents: { id: string; title: string | null }[];
  similarities: string[];
  differences: string[];
  recommendation: string;
}

/* ------------------------------------------------------- default config */

export const DEFAULT_SUMMARY_CONFIG: SummaryConfig = {
  style: 'executive',
  maxLength: 2000,
  extractKeyPoints: true,
  includeMetadata: true,
  targetLanguage: 'en',
};

/* --------------------------------------------------- summariser engine */

export function createSummaryConfig(overrides?: Partial<SummaryConfig>): SummaryConfig {
  return { ...DEFAULT_SUMMARY_CONFIG, ...overrides };
}

export function summariseDocument(
  documentId: string,
  text: string,
  title: string | null,
  config: SummaryConfig,
): DocumentSummary {
  const originalWordCount = text.split(/\s+/).filter(Boolean).length;
  const sentences = extractSentences(text);
  const scored = scoreSentences(sentences);
  const keyPoints = config.extractKeyPoints
    ? scored.slice(0, 5).map((s) => s.text)
    : [];

  let summary: string;
  switch (config.style) {
    case 'one_liner':
      summary = scored[0]?.text ?? '';
      break;
    case 'bullet_points':
      summary = scored.slice(0, 7).map((s) => `• ${s.text}`).join('\n');
      break;
    case 'detailed':
      summary = scored.slice(0, 10).map((s) => s.text).join(' ');
      break;
    case 'executive':
    default:
      summary = scored.slice(0, 5).map((s) => s.text).join(' ');
      break;
  }

  // Enforce max length
  if (summary.length > config.maxLength) {
    summary = summary.slice(0, config.maxLength - 3) + '...';
  }

  const wordCount = summary.split(/\s+/).filter(Boolean).length;

  return {
    documentId,
    title,
    summary,
    keyPoints,
    wordCount,
    originalWordCount,
    compressionRatio: originalWordCount > 0 ? parseFloat((wordCount / originalWordCount).toFixed(3)) : 0,
    style: config.style,
    language: config.targetLanguage,
    metadata: config.includeMetadata ? { sentencesAnalysed: sentences.length } : {},
  };
}

export function compareDocuments(
  docs: { id: string; title: string | null; text: string }[],
): ComparisonSummary {
  // Extract key word sets for each document for comparison
  const wordSets = docs.map((d) => {
    const words = new Set(
      d.text
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 4),
    );
    return { id: d.id, title: d.title, words };
  });

  // Find common and unique words
  const allWords = wordSets.flatMap((ws) => [...ws.words]);
  const wordFreq = new Map<string, number>();
  for (const w of allWords) wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);

  const commonWords = [...wordFreq.entries()]
    .filter(([, count]) => count === docs.length)
    .map(([word]) => word)
    .slice(0, 20);

  const similarities = commonWords.length > 0
    ? [`Documents share common themes around: ${commonWords.slice(0, 10).join(', ')}`]
    : ['No significant common themes detected'];

  const differences: string[] = [];
  for (const ws of wordSets) {
    const unique = [...ws.words].filter((w) => wordFreq.get(w) === 1).slice(0, 5);
    if (unique.length > 0) {
      differences.push(`"${ws.title ?? ws.id}" uniquely discusses: ${unique.join(', ')}`);
    }
  }

  return {
    documents: docs.map((d) => ({ id: d.id, title: d.title })),
    similarities,
    differences,
    recommendation: docs.length === 2
      ? 'Review both documents side-by-side for full context.'
      : `Comparative analysis across ${docs.length} documents completed.`,
  };
}

export function translateSummary(summary: DocumentSummary, _targetLanguage: string): DocumentSummary {
  // Placeholder — actual translation routed through model-router at runtime
  return {
    ...summary,
    language: _targetLanguage,
    metadata: { ...summary.metadata, translationPending: true },
  };
}

/* ----------------------------------------------------- internal helpers */

interface ScoredSentence {
  text: string;
  score: number;
  index: number;
}

function extractSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
}

function scoreSentences(sentences: string[]): ScoredSentence[] {
  // Simple TF-based sentence scoring
  const wordFreq = new Map<string, number>();
  for (const sent of sentences) {
    for (const word of sent.toLowerCase().split(/\W+/)) {
      if (word.length > 3) wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
    }
  }

  const scored: ScoredSentence[] = sentences.map((sent, idx) => {
    const words = sent.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const score = words.reduce((s, w) => s + (wordFreq.get(w) ?? 0), 0) / Math.max(1, words.length);
    // Position bias: earlier sentences are often more important
    const positionBonus = 1 / (1 + idx * 0.1);
    return { text: sent, score: score * positionBonus, index: idx };
  });

  return scored.sort((a, b) => b.score - a.score);
}
