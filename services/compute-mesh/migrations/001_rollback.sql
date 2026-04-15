-- Rollback: Compute Mesh — Core Tables

BEGIN;

DROP TABLE IF EXISTS mesh_work_units CASCADE;
DROP TABLE IF EXISTS mesh_jobs CASCADE;
DROP TABLE IF EXISTS mesh_devices CASCADE;

COMMIT;
