-- Migration: Register privileged operations tools (47-admin-only) and
-- seed the Code Healer and Security Auditor community agents.
--
-- All sven.ops.* tools are gated at the handler level: only the platform
-- administrator account ('47') can invoke them. Other users receive an
-- access-denied error.

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- PRIVILEGED OPS TOOLS (47-admin-only)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.ops.infra',
  'Infrastructure Overview',
  '[ADMIN-ONLY] Show Sven''s full infrastructure topology — VMs, Docker services, observability stack, networking, and deployment configuration. Only accessible to the 47 administrator account.',
  'ops',
  'trusted',
  'in_process',
  ARRAY['ops.admin']::text[],
  '{ "type":"object", "properties":{}, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "topology":{"type":"object"},
       "services":{"type":"array"},
       "observability":{"type":"object"},
       "deployment":{"type":"object"}
     } }'::jsonb,
  15000, 2, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.ops.health',
  'System Health Report',
  '[ADMIN-ONLY] Comprehensive system health report — service status, database metrics, queue depths, error rates, uptime, and alerting state. Only accessible to the 47 administrator account.',
  'ops',
  'trusted',
  'in_process',
  ARRAY['ops.admin']::text[],
  '{ "type":"object", "properties":{}, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "database":{"type":"object"}, "queues":{"type":"object"},
       "services":{"type":"object"}, "errors_24h":{"type":"object"},
       "uptime":{"type":"object"}
     } }'::jsonb,
  15000, 2, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.ops.code_scan',
  'Code Issue Scanner',
  '[ADMIN-ONLY] Trigger the Code Healer agent to scan for code issues — lint errors, type errors, security vulnerabilities, dead code, and dependency problems. Reports findings without auto-fixing. Only accessible to the 47 administrator account.',
  'ops',
  'trusted',
  'in_process',
  ARRAY['ops.admin']::text[],
  '{ "type":"object", "properties":{
       "scope": {"type":"string", "enum":["all","gateway-api","agent-runtime","skill-runner","canvas-ui","admin-ui"], "default":"all", "description":"Which service to scan"},
       "categories": {"type":"array", "items":{"type":"string","enum":["lint","typecheck","security","dependencies","dead_code"]}, "default":["lint","typecheck","security"]}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "findings":{"type":"array"}, "summary":{"type":"object"},
       "scan_duration_ms":{"type":"integer"}
     } }'::jsonb,
  120000, 1, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.ops.code_fix',
  'Code Fix Proposal',
  '[ADMIN-ONLY] Propose a code fix for a specific issue. Generates the fix diff but DOES NOT apply it — requires explicit approval from the 47 account via /approve before deployment. Only accessible to the 47 administrator account.',
  'ops',
  'trusted',
  'in_process',
  ARRAY['ops.admin']::text[],
  '{ "type":"object", "properties":{
       "issue_description": {"type":"string", "description":"Description of the issue to fix"},
       "file_path": {"type":"string", "description":"Optional: specific file to target"},
       "auto_apply": {"type":"boolean", "default":false, "description":"If true, creates an approval request for the fix"}
     }, "required":["issue_description"], "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "proposal":{"type":"object", "properties":{
         "files_affected":{"type":"array"}, "diff_preview":{"type":"string"},
         "risk_level":{"type":"string"}, "requires_restart":{"type":"boolean"}
       }},
       "approval_id":{"type":"string"}
     } }'::jsonb,
  120000, 1, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.ops.pentest',
  'Security Penetration Test',
  '[ADMIN-ONLY] Trigger the Security Auditor agent to run penetration tests against Sven''s own APIs and services. Tests OWASP Top 10, authentication bypasses, injection vectors, rate limiting, and access control. Reports vulnerabilities without exploiting them. Only accessible to the 47 administrator account.',
  'ops',
  'trusted',
  'in_process',
  ARRAY['ops.admin']::text[],
  '{ "type":"object", "properties":{
       "scope": {"type":"string", "enum":["full","api","auth","injection","rate_limiting","access_control"], "default":"full"},
       "target": {"type":"string", "description":"Optional: specific endpoint or service to test"}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "vulnerabilities":{"type":"array"},
       "summary":{"type":"object", "properties":{
         "critical":{"type":"integer"}, "high":{"type":"integer"},
         "medium":{"type":"integer"}, "low":{"type":"integer"}, "info":{"type":"integer"}
       }},
       "recommendations":{"type":"array"},
       "scan_duration_ms":{"type":"integer"}
     } }'::jsonb,
  180000, 1, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.ops.deploy',
  'Deployment Manager',
  '[ADMIN-ONLY] Manage deployments — view deployment status, propose a deployment plan, or initiate a deployment with approval. All deployments require explicit /approve from the 47 account before executing. Only accessible to the 47 administrator account.',
  'ops',
  'trusted',
  'in_process',
  ARRAY['ops.admin']::text[],
  '{ "type":"object", "properties":{
       "action": {"type":"string", "enum":["status","plan","execute"], "default":"status"},
       "target": {"type":"string", "enum":["all","gateway-api","agent-runtime","skill-runner","canvas-ui","admin-ui"], "default":"all"},
       "environment": {"type":"string", "enum":["staging","production"], "default":"staging"}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "deployment_status":{"type":"object"},
       "plan":{"type":"object"},
       "approval_id":{"type":"string"}
     } }'::jsonb,
  60000, 1, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.ops.logs',
  'Service Logs Viewer',
  '[ADMIN-ONLY] View recent logs from any Sven service — gateway-api, agent-runtime, skill-runner, adapters. Supports filtering by level and keyword. Only accessible to the 47 administrator account.',
  'ops',
  'trusted',
  'in_process',
  ARRAY['ops.admin']::text[],
  '{ "type":"object", "properties":{
       "service": {"type":"string", "enum":["gateway-api","agent-runtime","skill-runner","all"], "default":"all"},
       "level": {"type":"string", "enum":["error","warn","info","debug"], "default":"error"},
       "keyword": {"type":"string", "description":"Optional keyword filter"},
       "limit": {"type":"integer", "minimum":1, "maximum":100, "default":25}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "logs":{"type":"array"}, "total_matching":{"type":"integer"}
     } }'::jsonb,
  15000, 2, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.ops.config',
  'Runtime Configuration',
  '[ADMIN-ONLY] View or update Sven runtime settings — global settings, feature flags, policy engine rules, rate limits, and service configuration. Changes require /approve from the 47 account. Only accessible to the 47 administrator account.',
  'ops',
  'trusted',
  'in_process',
  ARRAY['ops.admin']::text[],
  '{ "type":"object", "properties":{
       "action": {"type":"string", "enum":["view","update"], "default":"view"},
       "category": {"type":"string", "enum":["all","security","performance","features","policies"], "default":"all"},
       "key": {"type":"string", "description":"Specific setting key to view or update"},
       "value": {"type":"string", "description":"New value (only for action=update, requires approval)"}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "settings":{"type":"object"}, "approval_id":{"type":"string"}
     } }'::jsonb,
  10000, 2, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- COMMUNITY AGENTS: Code Healer & Security Auditor
-- ═══════════════════════════════════════════════════════════════

INSERT INTO agents (id, name, workspace_path, model, status, created_at, updated_at) VALUES
  ('agent-code-healer', 'code-healer-agent', '/workspace/sven', 'auto', 'active', NOW(), NOW()),
  ('agent-security-auditor', 'security-auditor-agent', '/workspace/sven', 'auto', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO agent_configs (agent_id, system_prompt, model_name, settings, created_at, updated_at) VALUES
  ('agent-code-healer',
   'You are the Code Healer Agent for the Sven platform. Your role is to:
1. Continuously monitor the codebase for issues: type errors, lint violations, security vulnerabilities, dead code, and dependency problems.
2. When triggered, scan the specified scope and produce a structured report of findings with severity, file path, line number, and suggested fix.
3. Generate fix proposals as diffs that can be reviewed and approved by the platform administrator.
4. Never auto-apply fixes. All changes require explicit approval from the 47 account.
5. Prioritise: security > type safety > correctness > style.
6. Track fix history to avoid regressions.
You operate within the Sven monorepo at /workspace/sven. You understand TypeScript, Dart/Flutter, SQL migrations, Docker, and the full Sven architecture.',
   'auto',
   '{"scan_on_startup": false, "auto_fix": false, "requires_approval": true, "privileged": true}'::jsonb,
   NOW(), NOW()),
  ('agent-security-auditor',
   'You are the Security Auditor Agent for the Sven platform. Your role is to:
1. Perform automated penetration testing against Sven services when triggered by the platform administrator.
2. Test for OWASP Top 10 vulnerabilities: injection, broken auth, sensitive data exposure, XXE, broken access control, misconfig, XSS, insecure deserialization, known vulnerabilities, insufficient logging.
3. Test API endpoints for: rate limiting bypass, authentication bypass, horizontal/vertical privilege escalation, IDOR, CSRF, header injection.
4. Test the policy engine for: permission bypass, approval circumvention, scope escalation.
5. Produce structured vulnerability reports with CVSS scoring, proof-of-concept descriptions (not actual exploits), and remediation recommendations.
6. Never exploit vulnerabilities beyond detection. Never access real user data.
7. Report findings only to the 47 administrator account.
You understand the Sven architecture: gateway-api (Express), agent-runtime (NATS), skill-runner (NATS), PostgreSQL, Redis, and the multi-server deployment topology.',
   'auto',
   '{"scan_on_startup": false, "report_only": true, "requires_approval": true, "privileged": true}'::jsonb,
   NOW(), NOW())
ON CONFLICT (agent_id) DO NOTHING;

COMMIT;
