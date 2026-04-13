import { parseTableToMarkdown, type OcrTableCell } from '@sven/document-intel/ocr';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const content = input.content as string;

  switch (action) {
    case 'extract': {
      const lines = content.split('\n').filter((l) => l.trim());
      const rows = lines.length;
      const cols = Math.max(...lines.map((l) => l.split(/[|\t,;]/).length));
      const cells: OcrTableCell[] = [];
      for (let r = 0; r < rows; r++) {
        const parts = lines[r].split(/[|\t,;]/).map((p) => p.trim());
        for (let c = 0; c < cols; c++) {
          cells.push({
            row: r,
            column: c,
            rowSpan: 1,
            colSpan: 1,
            text: parts[c] ?? '',
            isHeader: r === 0,
            confidence: 0.9,
          });
        }
      }
      const md = parseTableToMarkdown(cells, rows, cols);
      return { result: { rows, columns: cols, cells, markdown: md } };
    }

    case 'to_markdown': {
      const rows = (input.rows as number) ?? 2;
      const cols = (input.columns as number) ?? 2;
      const cells: OcrTableCell[] = [];
      const lines = content.split('\n').filter((l) => l.trim());
      for (let r = 0; r < rows; r++) {
        const parts = (lines[r] ?? '').split(/[|\t,;]/).map((p) => p.trim());
        for (let c = 0; c < cols; c++) {
          cells.push({ row: r, column: c, rowSpan: 1, colSpan: 1, text: parts[c] ?? '', isHeader: r === 0, confidence: 0.9 });
        }
      }
      return { result: { markdown: parseTableToMarkdown(cells, rows, cols) } };
    }

    default:
      return { error: `Unknown action "${action}". Use: extract, to_markdown` };
  }
}
