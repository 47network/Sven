import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import { requireRole } from './auth.js';

import {
  buildOcrResult, processOcrRegions, createOcrConfig,
  detectLanguage, parseTableToMarkdown,
  type OcrConfig, type OcrRegion,
} from '@sven/document-intel/ocr';
import {
  runPipeline, runBatch,
  type PipelineInput, type DocumentType,
} from '@sven/document-intel/pipeline';
import {
  extractNamedEntities, extractReceiptData,
  extractIdDocument, extractInvoiceData, redactPii,
  type Entity,
} from '@sven/document-intel/entities';
import {
  summariseDocument, compareDocuments, translateSummary,
  createSummaryConfig, type SummaryStyle,
} from '@sven/document-intel/summarizer';

const logger = createLogger('gateway-documents');

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

async function requireTenantMembership(pool: pg.Pool, request: any, reply: any): Promise<string | null> {
  const orgId = String(request.orgId || '').trim();
  const userId = String(request.userId || '').trim();
  if (!orgId) {
    reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    return null;
  }
  const membership = await pool.query(
    `SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
    [orgId, userId],
  );
  if (membership.rows.length === 0) {
    reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Active organization membership required' } });
    return null;
  }
  return orgId;
}

export async function registerDocumentRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  // ── OCR ─────────────────────────────────────────────────────────────
  app.post('/v1/documents/ocr', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { content, regions, config: configOverrides } = request.body as Record<string, any>;
    if (!content || typeof content !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content string required' } });
    }
    try {
      const ocrConfig = createOcrConfig(configOverrides || {});
      const ocrRegions: OcrRegion[] = regions || [{ id: 'full', x: 0, y: 0, width: 1, height: 1, text: content }];
      const documentId = uuidv7();
      const result = buildOcrResult(documentId, [{ pageNumber: 1, width: 1, height: 1, regions: ocrRegions, text: content, tables: [] }], Date.now());
      return { success: true, data: result };
    } catch (err) {
      logger.error('documents/ocr error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'OCR processing failed' } });
    }
  });

  app.post('/v1/documents/detect-language', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { text } = request.body as Record<string, any>;
    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text string required' } });
    }
    try {
      const language = detectLanguage(text);
      return { success: true, data: { language } };
    } catch (err) {
      logger.error('documents/detect-language error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Language detection failed' } });
    }
  });

  // ── Pipeline ────────────────────────────────────────────────────────
  app.post('/v1/documents/pipeline', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const body = request.body as Record<string, any>;
    if (!body.content || !body.document_type) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content and document_type required' } });
    }
    try {
      const input: PipelineInput = {
        documentId: uuidv7(),
        fileName: body.file_name || 'upload',
        content: body.content,
        documentType: body.document_type as DocumentType,
        mimeType: body.mime_type || 'text/plain',
        extractEntities: body.extract_entities !== false,
        summarize: body.summarize !== false,
        piiSafe: body.pii_safe !== false,
        adminGated: body.admin_gated || false,
        metadata: body.metadata || {},
      };
      const result = await runPipeline(input);
      const jobId = uuidv7();
      try {
        await pool.query(
          `INSERT INTO document_jobs (id, org_id, user_id, doc_type, status, stage, result, created_at)
           VALUES ($1, $2, $3, $4, 'completed', 'done', $5, NOW())`,
          [jobId, orgId, request.userId, body.document_type, JSON.stringify(result)],
        );
      } catch (dbErr) {
        if (!isSchemaCompatError(dbErr)) throw dbErr;
      }
      return { success: true, data: { job_id: jobId, result } };
    } catch (err) {
      logger.error('documents/pipeline error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Pipeline execution failed' } });
    }
  });

  app.post('/v1/documents/pipeline/batch', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { documents } = request.body as Record<string, any>;
    if (!Array.isArray(documents) || documents.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'documents array required' } });
    }
    if (documents.length > 50) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'Maximum 50 documents per batch' } });
    }
    try {
      const inputs: PipelineInput[] = documents.map((d: Record<string, any>) => ({
        documentId: uuidv7(),
        fileName: d.file_name || 'upload',
        content: d.content,
        documentType: d.document_type as DocumentType,
        mimeType: d.mime_type || 'text/plain',
        extractEntities: d.extract_entities !== false,
        summarize: d.summarize !== false,
        piiSafe: d.pii_safe !== false,
        adminGated: d.admin_gated || false,
        metadata: d.metadata || {},
      }));
      const batch = await runBatch(inputs);
      return { success: true, data: batch };
    } catch (err) {
      logger.error('documents/pipeline/batch error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Batch pipeline failed' } });
    }
  });

  // ── Entity Extraction ───────────────────────────────────────────────
  app.post('/v1/documents/entities', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { text, type = 'general' } = request.body as Record<string, any>;
    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text string required' } });
    }
    try {
      let entities: Entity[];
      switch (type) {
        case 'receipt':
          return { success: true, data: extractReceiptData(text) };
        case 'id_document':
          return { success: true, data: extractIdDocument(text) };
        case 'invoice':
          return { success: true, data: extractInvoiceData(text) };
        default:
          entities = extractNamedEntities(text);
          return { success: true, data: { entities, count: entities.length } };
      }
    } catch (err) {
      logger.error('documents/entities error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Entity extraction failed' } });
    }
  });

  app.post('/v1/documents/redact', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { text } = request.body as Record<string, any>;
    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text string required' } });
    }
    try {
      const entities = extractNamedEntities(text);
      const redacted = redactPii(entities);
      return { success: true, data: { entities: redacted, count: redacted.length } };
    } catch (err) {
      logger.error('documents/redact error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'PII redaction failed' } });
    }
  });

  // ── Summarisation ───────────────────────────────────────────────────
  app.post('/v1/documents/summarize', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { text, title = null, style = 'executive', max_length = 500 } = request.body as Record<string, any>;
    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'text string required' } });
    }
    try {
      const config = createSummaryConfig({ style: style as SummaryStyle, maxLength: max_length });
      const summary = summariseDocument(uuidv7(), text, title, config);
      return { success: true, data: summary };
    } catch (err) {
      logger.error('documents/summarize error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Summarization failed' } });
    }
  });

  app.post('/v1/documents/compare', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    const { documents } = request.body as Record<string, any>;
    if (!Array.isArray(documents) || documents.length < 2) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'documents array with at least 2 items required' } });
    }
    try {
      const comparison = compareDocuments(documents.map((d: Record<string, any>) => ({ id: d.id || uuidv7(), title: d.title || null, text: d.text })));
      return { success: true, data: comparison };
    } catch (err) {
      logger.error('documents/compare error', { err: (err as Error).message });
      return reply.status(500).send({ success: false, error: { code: 'INTERNAL', message: 'Document comparison failed' } });
    }
  });

  app.get('/v1/documents/jobs', { preHandler: [requireAuth] }, async (request, reply) => {
    const orgId = await requireTenantMembership(pool, request, reply);
    if (!orgId) return;
    try {
      const { rows } = await pool.query(
        `SELECT id, doc_type, status, stage, created_at FROM document_jobs WHERE org_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [orgId],
      );
      return { success: true, data: rows };
    } catch (err) {
      if (isSchemaCompatError(err)) {
        return reply.status(503).send({ success: false, error: { code: 'FEATURE_UNAVAILABLE', message: 'Document jobs schema not available' } });
      }
      throw err;
    }
  });

  logger.info('Document Intelligence routes registered (/v1/documents/*)');
}
