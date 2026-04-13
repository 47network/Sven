-- heal_history tool — lets Sven introspect its own self-healing track record
-- Queries ops_audit_log for code_fix, deploy, and related operations.

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.ops.heal_history',
  'Healing History Introspection',
  '[ADMIN-ONLY] Query Sven''s self-healing history. Shows past code fixes, deployments, rollbacks, build failures, and circuit breaker events from the ops_audit_log. Lets Sven learn from its own repair track record — which fixes succeeded, which failed, recurring patterns, and overall healing effectiveness. Only accessible to the 47 administrator account.',
  'ops',
  'trusted',
  'in_process',
  ARRAY['ops.admin']::text[],
  '{ "type":"object", "properties":{
       "tool_filter": {"type":"string", "description":"Filter by tool name (e.g. sven.ops.code_fix, sven.ops.deploy). Omit for all ops tools."},
       "severity_filter": {"type":"string", "enum":["info","low","medium","high","critical"], "description":"Filter by severity level. Omit for all."},
       "limit": {"type":"integer", "minimum":1, "maximum":200, "default":50, "description":"Max entries to return (default 50)."},
       "since_hours": {"type":"integer", "minimum":1, "maximum":8760, "default":168, "description":"Look back N hours (default 168 = 7 days)."},
       "include_stats": {"type":"boolean", "default":true, "description":"Include aggregated success/failure statistics."}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "entries":{"type":"array"},
       "stats":{"type":"object"},
       "circuit_breaker":{"type":"object"},
       "total_entries":{"type":"integer"},
       "time_range_hours":{"type":"integer"}
     } }'::jsonb,
  30000, 2, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;
