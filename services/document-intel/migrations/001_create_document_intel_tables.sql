-- Document Intelligence Service — Schema
-- Tables: document_jobs, document_results, document_entities, document_summaries

BEGIN;

-- ── Top-level document processing jobs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_jobs (
  id            UUID PRIMARY KEY,
  org_id        TEXT        NOT NULL,
  user_id       TEXT,
  file_name     TEXT        NOT NULL DEFAULT 'upload',
  mime_type     TEXT        NOT NULL DEFAULT 'text/plain',
  doc_type      TEXT        NOT NULL DEFAULT 'unknown',
  status        TEXT        NOT NULL DEFAULT 'pending',
  stage         TEXT        NOT NULL DEFAULT 'queued',
  pii_safe      BOOLEAN     NOT NULL DEFAULT TRUE,
  error_message TEXT,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_document_jobs_org       ON document_jobs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_jobs_status    ON document_jobs (status);
CREATE INDEX IF NOT EXISTS idx_document_jobs_doc_type  ON document_jobs (doc_type);

-- ── Pipeline results (1:1 with jobs, stores full OCR + pipeline output) ─────
CREATE TABLE IF NOT EXISTS document_results (
  id                UUID PRIMARY KEY,
  job_id            UUID        NOT NULL REFERENCES document_jobs(id) ON DELETE CASCADE,
  org_id            TEXT        NOT NULL,
  ocr_full_text     TEXT,
  ocr_language      TEXT,
  ocr_avg_confidence NUMERIC(5,3),
  ocr_total_regions INT         NOT NULL DEFAULT 0,
  ocr_pages         JSONB       NOT NULL DEFAULT '[]',
  stages            JSONB       NOT NULL DEFAULT '[]',
  processing_ms     INT         NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_results_job ON document_results (job_id);

-- ── Extracted entities ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_entities (
  id          UUID PRIMARY KEY,
  job_id      UUID        NOT NULL REFERENCES document_jobs(id) ON DELETE CASCADE,
  org_id      TEXT        NOT NULL,
  category    TEXT        NOT NULL,
  subcategory TEXT        NOT NULL DEFAULT '',
  value       TEXT        NOT NULL,
  normalised  TEXT        NOT NULL DEFAULT '',
  confidence  NUMERIC(5,3) NOT NULL DEFAULT 0,
  is_pii      BOOLEAN     NOT NULL DEFAULT FALSE,
  redacted    BOOLEAN     NOT NULL DEFAULT FALSE,
  source_text TEXT,
  position    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_entities_job  ON document_entities (job_id);
CREATE INDEX IF NOT EXISTS idx_document_entities_org  ON document_entities (org_id, category);
CREATE INDEX IF NOT EXISTS idx_document_entities_pii  ON document_entities (org_id) WHERE is_pii = TRUE;

-- ── Document summaries ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_summaries (
  id                  UUID PRIMARY KEY,
  job_id              UUID        REFERENCES document_jobs(id) ON DELETE CASCADE,
  org_id              TEXT        NOT NULL,
  document_id         TEXT        NOT NULL,
  title               TEXT,
  summary             TEXT        NOT NULL,
  key_points          JSONB       NOT NULL DEFAULT '[]',
  style               TEXT        NOT NULL DEFAULT 'executive',
  word_count          INT         NOT NULL DEFAULT 0,
  original_word_count INT         NOT NULL DEFAULT 0,
  compression_ratio   NUMERIC(5,3) NOT NULL DEFAULT 0,
  language            TEXT        NOT NULL DEFAULT 'en',
  metadata            JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_summaries_job ON document_summaries (job_id);
CREATE INDEX IF NOT EXISTS idx_document_summaries_org ON document_summaries (org_id, created_at DESC);

COMMIT;
