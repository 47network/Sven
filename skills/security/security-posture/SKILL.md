---
name: security-posture
description: Unified security posture reporting — combines SAST, dependency audit, secret scan, infrastructure scan, and pentest results into a single scored report with OWASP and SOC 2 compliance mapping, top risks, and remediation recommendations.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["posture","digest","markdown"],"default":"posture"},"sast":{"type":"object","description":"SAST scan report"},"dependencies":{"type":"object","description":"Dependency audit report"},"secrets":{"type":"object","description":"Secret scan report"},"infrastructure":{"type":"object","description":"Infrastructure audit report"},"pentest":{"type":"object","description":"Pentest report"},"previous":{"type":"object","description":"Previous posture for trend comparison"},"period":{"type":"string","enum":["daily","weekly"],"default":"weekly"}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Security Posture Skill

Unified security posture dashboard — aggregates all security scan results into a single graded report (A-F) with OWASP/SOC 2 compliance mapping, trend analysis, and actionable recommendations.

## Actions

- `posture` — Generate a security posture from scan reports
- `digest` — Generate a daily/weekly security digest with trend
- `markdown` — Render the posture as a Markdown report

## Scope Mapping
- `security.posture`: **read** (reporting only)
