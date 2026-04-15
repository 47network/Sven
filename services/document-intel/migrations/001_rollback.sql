-- Document Intelligence Service — Rollback
BEGIN;
DROP TABLE IF EXISTS document_summaries CASCADE;
DROP TABLE IF EXISTS document_entities CASCADE;
DROP TABLE IF EXISTS document_results CASCADE;
DROP TABLE IF EXISTS document_jobs CASCADE;
COMMIT;
