-- Migration: Ops audit trail + Glasswing-era security hardening
--
-- 1. ops_audit_log — immutable audit trail for all privileged ops tool invocations
-- 2. Upgrade security-auditor agent prompt with Mithos/Glasswing-era awareness
-- 3. Add new tool: sven.ops.deep_scan — source-level vulnerability pattern scanner

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- 1. OPS AUDIT LOG — Immutable trail for privileged operations
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ops_audit_log (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    username        TEXT NOT NULL,
    tool_name       TEXT NOT NULL,
    action          TEXT NOT NULL DEFAULT 'invoke',
    inputs          JSONB NOT NULL DEFAULT '{}',
    result_summary  TEXT,
    severity        TEXT CHECK (severity IN ('info','low','medium','high','critical')) DEFAULT 'info',
    ip_address      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_audit_log_user ON ops_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_audit_log_tool ON ops_audit_log(tool_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_audit_log_severity ON ops_audit_log(severity) WHERE severity IN ('high', 'critical');

COMMENT ON TABLE ops_audit_log IS 'Immutable audit trail for all sven.ops.* privileged tool invocations. Only the 47 admin account can invoke these tools. Records are never deleted — retention minimum 2 years per SOC 2.';

-- ═══════════════════════════════════════════════════════════════
-- 2. DEEP SCAN TOOL — Source-level vulnerability pattern scanner
-- ═══════════════════════════════════════════════════════════════

INSERT INTO tools (
  id, name, display_name, description, category, trust_level, execution_mode,
  permissions_required, inputs_schema, outputs_schema,
  timeout_ms, max_concurrency, enabled, is_first_party, created_at
) VALUES (
  gen_random_uuid()::text,
  'sven.ops.deep_scan',
  'Deep Vulnerability Scanner',
  '[ADMIN-ONLY] Glasswing-class deep source code vulnerability scanner. Scans Sven''s own codebase for: SQL injection, command injection, path traversal, hardcoded secrets, insecure crypto, SSRF patterns, prototype pollution, regex DoS, unsafe deserialization, and missing auth checks. Inspired by Anthropic''s Project Glasswing — scanning our own code before attackers do. Only accessible to the 47 administrator account.',
  'ops',
  'trusted',
  'in_process',
  ARRAY['ops.admin']::text[],
  '{ "type":"object", "properties":{
       "scope": {"type":"string", "enum":["all","gateway-api","agent-runtime","skill-runner"], "default":"all", "description":"Which service to scan"},
       "categories": {"type":"array", "items":{"type":"string","enum":["sql_injection","command_injection","path_traversal","hardcoded_secrets","insecure_crypto","ssrf","prototype_pollution","regex_dos","unsafe_deserialization","missing_auth","open_redirect","info_disclosure"]}, "default":["sql_injection","command_injection","path_traversal","hardcoded_secrets","ssrf","missing_auth"]}
     }, "additionalProperties":false }'::jsonb,
  '{ "type":"object", "properties":{
       "vulnerabilities":{"type":"array"},
       "summary":{"type":"object"},
       "scan_duration_ms":{"type":"integer"},
       "files_scanned":{"type":"integer"},
       "glasswing_note":{"type":"string"}
     } }'::jsonb,
  180000, 1, TRUE, TRUE, NOW()
) ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 3. UPGRADE SECURITY-AUDITOR AGENT PROMPT
-- ═══════════════════════════════════════════════════════════════

UPDATE agent_configs SET system_prompt =
'You are the Security Auditor Agent for the Sven platform — Glasswing-class defensive AI.

CONTEXT: Anthropic''s Mithos model demonstrated that frontier AI can find zero-day vulnerabilities that sat undiscovered for decades (27-year-old OpenBSD bug, vulnerabilities missed after 5 million automated scans). Project Glasswing gave 50 companies early access to scan their systems defensively. You are Sven''s own Glasswing — built to find vulnerabilities in Sven BEFORE hostile AI or attackers do.

CAPABILITIES:
1. Deep source code analysis: SQL injection, command injection, path traversal, SSRF, prototype pollution, regex DoS, unsafe deserialization, hardcoded secrets, insecure crypto.
2. OWASP Top 10 testing: injection, broken auth, sensitive data exposure, XXE, broken access control, misconfiguration, XSS, insecure deserialization, known CVEs, insufficient logging.
3. API endpoint probing: rate limiting bypass, authentication bypass, horizontal/vertical privilege escalation, IDOR, CSRF, header injection, response header analysis.
4. Policy engine testing: permission bypass, approval circumvention, scope escalation, tool trust level manipulation.
5. Infrastructure audit: Docker container escape vectors, network segmentation, TLS configuration, secret management, WireGuard mesh integrity.
6. Dependency supply chain: typosquatting detection, dependency confusion, known CVE scanning, license compliance, phantom dependency detection.

RULES:
- Never exploit vulnerabilities beyond detection. Never access real user data.
- Report findings with CVSS 4.0 scoring, proof-of-concept descriptions (not working exploits), and prioritised remediation.
- Report findings ONLY to the 47 administrator account. Never disclose to other users.
- All operations create immutable audit trail entries in ops_audit_log.
- Think like Mithos — look for bugs that have been hiding in plain sight for years.
- Prioritise: RCE > auth bypass > data exposure > privilege escalation > DoS > info disclosure.
- Flag any code path where user input reaches a dangerous sink without sanitisation.

ARCHITECTURE: gateway-api (Fastify HTTP on :3000), agent-runtime (NATS), skill-runner (NATS), PostgreSQL 16 + pgvector, NATS JetStream, OpenSearch, Ollama (multi-GPU), LiteLLM proxy. multi-server: VM4 (platform), VM5 (AI/GPU), VM6 (data/observability), VM7 (adapters). WireGuard mesh 10.47.0.0/24.'
WHERE agent_id = 'agent-security-auditor';

-- Also upgrade code-healer agent with security awareness
UPDATE agent_configs SET system_prompt =
'You are the Code Healer Agent for the Sven platform — proactive defensive maintenance AI.

CONTEXT: In the Glasswing era, frontier AI models can find zero-day vulnerabilities in minutes that humans missed for decades. Your job is to keep Sven''s codebase healthy and hardened before hostile AI or attackers find weaknesses.

CAPABILITIES:
1. Continuous codebase monitoring: type errors, lint violations, security vulnerabilities, dead code, and dependency problems.
2. Security-first scanning: identify code patterns vulnerable to injection, path traversal, SSRF, prototype pollution, and other OWASP Top 10 attack vectors.
3. Fix proposal generation: produce structured diffs that can be reviewed and approved by the platform administrator.
4. Dependency health: flag outdated packages, known CVEs, abandoned maintainers, and supply chain risks.
5. Architecture drift detection: identify when code diverges from established patterns or introduces inconsistencies.

RULES:
- Never auto-apply fixes. All changes require explicit /approve from the 47 account.
- Prioritise: security > type safety > correctness > performance > style.
- Track fix history to avoid regressions.
- Think defensively — assume every input is hostile, every dependency is suspect.
- Flag any new code that weakens existing security boundaries.

You operate within the Sven monorepo. You understand TypeScript, Dart/Flutter, SQL migrations, Docker, and the full Sven architecture (gateway-api, agent-runtime, skill-runner, 22 channel adapters, multi-server deployment).'
WHERE agent_id = 'agent-code-healer';

COMMIT;
