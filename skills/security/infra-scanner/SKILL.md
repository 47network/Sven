---
name: infra-scanner
description: Audit Docker Compose services, TLS certificates, and environment files for security misconfigurations. Checks for privileged containers, dangerous capabilities, host mounts, exposed ports, hardcoded secrets in compose, weak TLS, and insecure env vars.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["audit_compose","audit_tls","audit_env","full_report"],"default":"full_report"},"services":{"type":"array","items":{"type":"object"},"description":"Docker Compose service definitions"},"certs":{"type":"array","items":{"type":"object"},"description":"TLS certificate info objects"},"env_content":{"type":"string","description":"Raw .env file content"},"env_path":{"type":"string","description":"Path of the env file being audited"}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Infrastructure Scanner Skill

Audit Docker Compose, TLS/SSL, and environment configurations for security misconfigurations. Produces scored findings with OWASP-mapped remediation.

## Actions

- `audit_compose` — Audit Docker Compose services for privileged mode, dangerous caps, host mounts, exposed ports, hardcoded secrets
- `audit_tls` — Check TLS certificates for expiry, weak keys, deprecated protocols
- `audit_env` — Audit .env files for weak passwords, empty secrets, debug mode
- `full_report` — Run all audits and generate a unified infrastructure security report

## Scope Mapping
- `security.infra`: **read** (configuration analysis, no runtime probes)
