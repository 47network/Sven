// ---------------------------------------------------------------------------
// Document Intelligence Service — Entry Point
// ---------------------------------------------------------------------------
// Standalone service for document processing: OCR, multi-stage pipeline,
// entity extraction, PII redaction, summarisation, and document comparison
// with Postgres persistence and NATS events.
//
// Port: 9473 (configurable via DOCUMENT_PORT)
// Dependencies: Postgres, NATS
// ---------------------------------------------------------------------------

import Fastify from 'fastify';
import pg from 'pg';
import { connect } from 'nats';
import { createLogger } from '@sven/shared';

// Library — OCR
import {
  createOcrConfig, processOcrRegions, buildOcrResult, detectLanguage,
  parseTableToMarkdown,
  type OcrConfig, type OcrRegion, type OcrPage,
} from '@sven/document-intel/ocr';

// Library — Pipeline
import {
  runPipeline, runBatch,
  type PipelineInput, type DocumentType,
} from '@sven/document-intel/pipeline';

// Library — Entities
import {
  extractNamedEntities, extractReceiptData, extractIdDocument,
  extractInvoiceData, redactPii,
  type Entity,
} from '@sven/document-intel/entities';

// Library — Summariser
import {
  summariseDocument, compareDocuments, translateSummary, createSummaryConfig,
  type SummaryStyle,
} from '@sven/document-intel/summarizer';

// Stores
import { PgJobStore } from './store/pg-job-store.js';
import { PgResultStore } from './store/pg-result-store.js';
import { PgEntityStore } from './store/pg-entity-store.js';
import { PgSummaryStore } from './store/pg-summary-store.js';

// NATS
import { DocumentPublisher } from './nats/publisher.js';

const logger = createLogger('document-intel-service');

/* ─── Configuration ──────────────────────────────────────────────────── */

const PORT = parseInt(process.env.DOCUMENT_PORT || '9473', 10);
const HOST = process.env.DOCUMENT_HOST || '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven';
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const DEFAULT_ORG_ID = process.env.DOCUMENT_DEFAULT_ORG_ID || 'default';
const MAX_BATCH_SIZE = 50;

/* ─── Bootstrap ──────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  // ── Postgres ──
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 15,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on('error', (err) => {
    logger.error('Postgres pool error', { error: err.message });
  });

  const client = await pool.connect();
  client.release();
  logger.info('Postgres connected');

  // ── NATS ──
  const nc = await connect({ servers: NATS_URL });
  logger.info('NATS connected', { server: NATS_URL });

  // ── Stores & Publisher ──
  const jobStore = new PgJobStore(pool);
  const resultStore = new PgResultStore(pool);
  const entityStore = new PgEntityStore(pool);
  const summaryStore = new PgSummaryStore(pool);
  const publisher = new DocumentPublisher(nc);

  // ── Fastify ──
  const app = Fastify({ logger: false });

  // ── Health Endpoints ──────────────────────────────────────────────────

  app.get('/healthz', async () => ({ status: 'ok', service: 'document-intel', uptime: process.uptime() }));

  app.get('/readyz', async (_req, reply) => {
    try {
      const pgCheck = await pool.query('SELECT 1');
      const natsOk = nc.isClosed() ? 'fail' : 'ok';
      const status = pgCheck.rows.length > 0 && natsOk === 'ok' ? 'ok' : 'degraded';
      return { status, checks: { postgres: pgCheck.rows.length > 0 ? 'ok' : 'fail', nats: natsOk } };
    } catch {
      return reply.status(503).send({ status: 'down', checks: { postgres: 'fail', nats: 'unknown' } });
    }
  });

  // ── OCR Routes ────────────────────────────────────────────────────────

  app.post('/v1/ocr/process', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const content = body.content as string;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const configOverrides = (body.config as Partial<OcrConfig>) || {};

    if (!content || typeof content !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content string required' } });
    }

    const config = createOcrConfig(configOverrides);
    const regions = processOcrRegions(content, config);
    const page: OcrPage = {
      pageNumber: 1,
      width: 2480,
      height: 3508,
      regions,
      text: regions.map((r) => r.content).join('\n'),
      tables: [],
    };

    const jobId = await jobStore.createJob({
      orgId, fileName: 'ocr-input', mimeType: 'text/plain', docType: 'scan', piiSafe: false,
    });

    const ocrResult = buildOcrResult(jobId, [page], Date.now());

    await resultStore.saveResult({
      jobId, orgId, ocrResult, stages: [], processingMs: ocrResult.processingTimeMs,
    });
    await jobStore.completeJob(jobId);

    publisher.publishOcrComplete(jobId, orgId, ocrResult.language, ocrResult.totalRegions, ocrResult.avgConfidence);

    return { success: true, data: { job_id: jobId, result: ocrResult } };
  });

  app.post('/v1/ocr/detect-language', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const text = body.text as string;
    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text string required' } });
    }
    return { success: true, data: { language: detectLanguage(text) } };
  });

  app.post('/v1/ocr/table-to-markdown', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const cells = body.cells as Array<{ row: number; column: number; rowSpan: number; colSpan: number; text: string; isHeader: boolean; confidence: number }>;
    const rows = body.rows as number;
    const cols = body.columns as number;

    if (!Array.isArray(cells) || typeof rows !== 'number' || typeof cols !== 'number') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'cells array, rows, and columns required' } });
    }

    return { success: true, data: { markdown: parseTableToMarkdown(cells, rows, cols) } };
  });

  // ── Pipeline Routes ───────────────────────────────────────────────────

  app.post('/v1/pipeline/run', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const content = body.content as string;
    const docType = (body.document_type as DocumentType) || 'unknown';

    if (!content || typeof content !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content string required' } });
    }

    const piiSafe = body.pii_safe !== false;
    const jobId = await jobStore.createJob({
      orgId,
      userId: body.user_id as string,
      fileName: (body.file_name as string) || 'upload',
      mimeType: (body.mime_type as string) || 'text/plain',
      docType,
      piiSafe,
      metadata: (body.metadata as Record<string, unknown>) || {},
    });

    const input: PipelineInput = {
      documentId: jobId,
      fileName: (body.file_name as string) || 'upload',
      content,
      documentType: docType,
      mimeType: (body.mime_type as string) || 'text/plain',
      extractEntities: body.extract_entities !== false,
      summarize: body.summarize !== false,
      piiSafe,
      adminGated: (body.admin_gated as boolean) || false,
      metadata: (body.metadata as Record<string, unknown>) || {},
    };

    const result = await runPipeline(input);

    // Persist result
    await resultStore.saveResult({
      jobId, orgId, ocrResult: result.ocrResult, stages: result.stages, processingMs: result.totalProcessingMs,
    });

    // Persist entities
    if (result.entities.length > 0) {
      const fullEntities: Entity[] = result.entities.map((e) => ({
        id: e.type + '-' + e.location.regionId,
        category: e.type as Entity['category'],
        subcategory: '',
        value: e.value,
        normalised: e.value,
        confidence: e.confidence,
        sourceText: '',
        position: { start: 0, end: e.value.length },
        isPii: ['email', 'phone', 'person', 'id_number', 'address'].includes(e.type),
      }));
      await entityStore.bulkInsert(jobId, orgId, fullEntities, piiSafe);

      const piiEntities = fullEntities.filter((e) => e.isPii);
      if (piiEntities.length > 0) {
        const piiCategories = [...new Set(piiEntities.map((e) => e.category))];
        publisher.publishPiiDetected(jobId, orgId, piiCategories, piiEntities.length);
      }

      publisher.publishEntitiesExtracted(jobId, orgId, fullEntities.length, fullEntities.filter((e) => e.isPii).length);
    }

    // Persist summary
    if (result.summary) {
      const summaryConfig = createSummaryConfig();
      const docSummary = summariseDocument(jobId, result.ocrResult?.fullText || content, input.fileName, summaryConfig);
      await summaryStore.saveSummary(orgId, docSummary, jobId);
      publisher.publishSummaryGenerated(jobId, orgId, jobId, docSummary.style, docSummary.compressionRatio);
    }

    if (result.status === 'completed') {
      await jobStore.completeJob(jobId);
      publisher.publishPipelineComplete(jobId, orgId, docType, result.stages.length, result.totalProcessingMs);
    } else {
      await jobStore.failJob(jobId, result.errorMessage || 'Unknown error');
      publisher.publishPipelineFailed(jobId, orgId, docType, result.errorMessage || 'Unknown error');
    }

    return { success: true, data: { job_id: jobId, result } };
  });

  app.post('/v1/pipeline/batch', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const documents = body.documents as Array<Record<string, unknown>>;

    if (!Array.isArray(documents) || documents.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'documents array required' } });
    }
    if (documents.length > MAX_BATCH_SIZE) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: `Maximum ${MAX_BATCH_SIZE} documents per batch` } });
    }

    const inputs: PipelineInput[] = documents.map((d) => ({
      documentId: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fileName: (d.file_name as string) || 'upload',
      content: d.content as string,
      documentType: (d.document_type as DocumentType) || 'unknown',
      mimeType: (d.mime_type as string) || 'text/plain',
      extractEntities: d.extract_entities !== false,
      summarize: d.summarize !== false,
      piiSafe: d.pii_safe !== false,
      adminGated: (d.admin_gated as boolean) || false,
      metadata: (d.metadata as Record<string, unknown>) || {},
    }));

    const batch = await runBatch(inputs);
    const succeeded = batch.results.filter((r) => r.status === 'completed').length;
    const failed = batch.results.filter((r) => r.status === 'failed').length;

    publisher.publishBatchComplete(batch.id, orgId, batch.results.length, succeeded, failed);

    return { success: true, data: batch };
  });

  // ── Entity Extraction Routes ──────────────────────────────────────────

  app.post('/v1/entities/extract', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const text = body.text as string;
    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text string required' } });
    }
    const entities = extractNamedEntities(text);
    return { success: true, data: { entities, count: entities.length } };
  });

  app.post('/v1/entities/receipt', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const text = body.text as string;
    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text string required' } });
    }
    return { success: true, data: extractReceiptData(text) };
  });

  app.post('/v1/entities/id-document', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const text = body.text as string;
    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text string required' } });
    }
    return { success: true, data: extractIdDocument(text) };
  });

  app.post('/v1/entities/invoice', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const text = body.text as string;
    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text string required' } });
    }
    return { success: true, data: extractInvoiceData(text) };
  });

  app.post('/v1/entities/redact', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const text = body.text as string;
    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text string required' } });
    }
    const entities = extractNamedEntities(text);
    const redacted = redactPii(entities);
    return { success: true, data: { entities: redacted, count: redacted.length } };
  });

  // ── Summarisation Routes ──────────────────────────────────────────────

  app.post('/v1/summarize', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const text = body.text as string;
    const title = (body.title as string) || null;
    const style = (body.style as SummaryStyle) || 'executive';
    const maxLength = (body.max_length as number) || 2000;

    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text string required' } });
    }

    const config = createSummaryConfig({ style, maxLength });
    const documentId = `sum-${Date.now()}`;
    const summary = summariseDocument(documentId, text, title, config);

    await summaryStore.saveSummary(orgId, summary);
    publisher.publishSummaryGenerated('standalone', orgId, documentId, summary.style, summary.compressionRatio);

    return { success: true, data: summary };
  });

  app.post('/v1/compare', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const documents = body.documents as Array<{ id?: string; title?: string; text: string }>;

    if (!Array.isArray(documents) || documents.length < 2) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'At least 2 documents required' } });
    }

    const comparison = compareDocuments(documents.map((d) => ({
      id: d.id || `doc-${Date.now()}`,
      title: d.title || null,
      text: d.text,
    })));

    return { success: true, data: comparison };
  });

  app.post('/v1/translate-summary', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const text = body.text as string;
    const targetLanguage = (body.target_language as string) || 'en';

    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text string required' } });
    }

    const config = createSummaryConfig({ targetLanguage });
    const documentId = `trans-${Date.now()}`;
    const summary = summariseDocument(documentId, text, null, config);
    const translated = translateSummary(summary, targetLanguage);

    return { success: true, data: translated };
  });

  // ── Job & History Routes ──────────────────────────────────────────────

  app.get('/v1/jobs', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const limit = Math.min(parseInt(query.limit || '50', 10), 500);
    const offset = parseInt(query.offset || '0', 10);
    const jobs = await jobStore.listJobs(orgId, limit, offset);
    return { success: true, data: jobs };
  });

  app.get<{ Params: { jobId: string } }>('/v1/jobs/:jobId', async (request, reply) => {
    const job = await jobStore.getJob(request.params.jobId);
    if (!job) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
    return { success: true, data: job };
  });

  app.get<{ Params: { jobId: string } }>('/v1/jobs/:jobId/result', async (request, reply) => {
    const result = await resultStore.getByJob(request.params.jobId);
    if (!result) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Result not found' } });
    return { success: true, data: result };
  });

  app.get<{ Params: { jobId: string } }>('/v1/jobs/:jobId/entities', async (request) => {
    const entities = await entityStore.listByJob(request.params.jobId);
    return { success: true, data: entities };
  });

  app.get<{ Params: { jobId: string } }>('/v1/jobs/:jobId/summary', async (request, reply) => {
    const summary = await summaryStore.getByJob(request.params.jobId);
    if (!summary) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Summary not found' } });
    return { success: true, data: summary };
  });

  app.get('/v1/entities/pii', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const limit = Math.min(parseInt(query.limit || '100', 10), 500);
    const entities = await entityStore.listPiiByOrg(orgId, limit);
    return { success: true, data: entities };
  });

  app.get('/v1/entities/categories', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const counts = await entityStore.getCategoryCounts(orgId);
    return { success: true, data: counts };
  });

  app.get('/v1/summaries', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const limit = Math.min(parseInt(query.limit || '50', 10), 200);
    const summaries = await summaryStore.listByOrg(orgId, limit);
    return { success: true, data: summaries };
  });

  app.get('/v1/stats', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const stats = await jobStore.getStats(orgId);
    return { success: true, data: stats };
  });

  // ── Start Server ──────────────────────────────────────────────────────

  await app.listen({ host: HOST, port: PORT });
  logger.info(`Document intel service listening on ${HOST}:${PORT}`);

  // ── Graceful Shutdown ─────────────────────────────────────────────────

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down`);
    await app.close();
    await nc.drain();
    await pool.end();
    logger.info('Document intel service stopped');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

/* ─── Run ────────────────────────────────────────────────────────────── */

main().catch((err) => {
  logger.error('Fatal startup error', { error: (err as Error).message, stack: (err as Error).stack });
  process.exit(1);
});
