export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'search': {
      const query = (input.query as string) ?? '';
      const content = (input.content as string) ?? '';
      const caseSensitive = (input.case_sensitive as boolean) ?? false;

      const searchContent = caseSensitive ? content : content.toLowerCase();
      const searchQuery = caseSensitive ? query : query.toLowerCase();

      const lines = content.split('\n');
      const matches: { line: number; text: string; context: string }[] = [];

      for (let i = 0; i < lines.length; i++) {
        const searchLine = caseSensitive ? lines[i] : lines[i].toLowerCase();
        if (searchLine.includes(searchQuery)) {
          const contextStart = Math.max(0, i - 1);
          const contextEnd = Math.min(lines.length - 1, i + 1);
          matches.push({
            line: i + 1,
            text: lines[i],
            context: lines.slice(contextStart, contextEnd + 1).join('\n'),
          });
        }
      }

      // Count total occurrences
      let count = 0;
      let idx = 0;
      while ((idx = searchContent.indexOf(searchQuery, idx)) !== -1) {
        count++;
        idx += searchQuery.length;
      }

      return {
        result: {
          query,
          totalOccurrences: count,
          matchingLines: matches.length,
          matches: matches.slice(0, 50),
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: search` };
  }
}
