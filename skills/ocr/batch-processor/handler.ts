import { runBatch, type PipelineInput, type DocumentType } from '@sven/document-intel/pipeline';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'process_batch': {
      const docs = (input.documents as { id?: string; fileName: string; content: string; type?: string }[]) ?? [];
      if (docs.length === 0) return { error: 'At least one document is required' };

      const pipelineInputs: PipelineInput[] = docs.map((d, i) => ({
        documentId: d.id ?? `batch-doc-${i}`,
        fileName: d.fileName,
        mimeType: 'text/plain',
        content: d.content,
        documentType: (d.type as DocumentType) ?? 'unknown',
        extractEntities: (input.extract_entities as boolean) ?? true,
        summarize: (input.summarize as boolean) ?? false,
        piiSafe: (input.pii_safe as boolean) ?? false,
        adminGated: false,
        metadata: {},
      }));

      const batch = await runBatch(pipelineInputs);
      return {
        result: {
          batchId: batch.id,
          status: batch.status,
          total: batch.documents.length,
          completed: batch.results.filter((r) => r.status === 'completed').length,
          failed: batch.results.filter((r) => r.status === 'failed').length,
          results: batch.results.map((r) => ({
            documentId: r.documentId,
            fileName: r.fileName,
            status: r.status,
            entityCount: r.entities.length,
            processingMs: r.totalProcessingMs,
          })),
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: process_batch` };
  }
}
