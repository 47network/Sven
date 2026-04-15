-- sven.ops.rollback tool — lets admin 47 revert sven-heal commits with build verification

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.ops.rollback',
  'Rollback Heal Commits',
  '[ADMIN-ONLY] Revert Sven''s self-healing commits. Finds the most recent sven-heal commits and reverts them via git revert, then re-verifies the build is clean. Supports dry_run mode to preview what would be rolled back without executing. Only reverts commits with the sven-heal prefix — safe against accidentally reverting human commits. Only accessible to the 47 administrator account.',
  'ops',
  'trusted',
  'in_process',
  ARRAY['ops.admin']::text[],
  '{ "type":"object", "properties":{
       "count": {"type":"integer", "minimum":1, "maximum":5, "default":1, "description":"Number of recent sven-heal commits to revert (default 1, max 5)."},
       "dry_run": {"type":"boolean", "default":false, "description":"Preview what would be rolled back without executing."}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "status":{"type":"string"},
       "reverted_commits":{"type":"array"},
       "build_verified":{"type":"boolean"},
       "detail":{"type":"string"}
     } }'::jsonb,
  120000, 1, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;
