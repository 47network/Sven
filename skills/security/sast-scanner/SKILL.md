---
name: sast-scanner
description: Static Application Security Testing — scan TypeScript/JavaScript source code for SQL injection, XSS, SSRF, path traversal, command injection, hardcoded secrets, insecure crypto, auth bypass, prototype pollution, and more. 14 built-in rules mapped to OWASP Top 10 and CWE.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["scan","list_rules","get_rule","filter_rules"],"default":"scan"},"files":{"type":"object","description":"Map of filePath → sourceCode to scan","additionalProperties":{"type":"string"}},"rule_id":{"type":"string"},"severity":{"type":"string","enum":["critical","high","medium","low","informational"]},"category":{"type":"string"}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# SAST Scanner Skill

Static analysis security scanner for TypeScript/JavaScript. Detects OWASP Top 10 vulnerabilities with SAST-001 through SAST-014 rules covering injection, XSS, SSRF, path traversal, command injection, insecure deserialization, hardcoded secrets, weak crypto, auth bypass, prototype pollution, open redirect, insecure random, missing headers, and information disclosure.

## Actions

- `scan` — Scan source files and produce a security report with scored findings
- `list_rules` — List all available detection rules
- `get_rule` — Get details on a specific rule by ID
- `filter_rules` — Filter rules by severity or category

## Scope Mapping
- `security.sast`: **read** (code analysis, no modifications)
