---
name: secret-scanner
description: Detect hardcoded secrets, API keys, tokens, private keys, and credentials in source code and config files. 20 built-in patterns covering AWS, GitHub, Slack, Stripe, database URLs, JWTs, and more.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["scan","scan_file","check_entropy"],"default":"scan"},"files":{"type":"object","description":"Map of filePath → content to scan","additionalProperties":{"type":"string"}},"file_path":{"type":"string"},"file_content":{"type":"string"},"text":{"type":"string"}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Secret Scanner Skill

Detect secrets and credentials in source code. Inspired by gitleaks/trufflehog with 20 built-in patterns, entropy gating, and automatic redaction for safe reporting.

## Actions

- `scan` — Scan multiple files for secrets, produce a full report
- `scan_file` — Scan a single file
- `check_entropy` — Calculate Shannon entropy of a string (useful for evaluating randomness)

## Scope Mapping
- `security.secrets`: **read** (detection only, secrets are redacted in output)
