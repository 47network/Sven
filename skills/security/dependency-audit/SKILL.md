---
name: dependency-audit
description: Audit project dependencies for known CVEs, license compliance, typosquatting, and supply chain integrity risks. Cross-references packages against vulnerability databases.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["audit","check_license","check_typosquat","parse_deps"],"default":"audit"},"dependencies":{"type":"object","additionalProperties":{"type":"string"}},"devDependencies":{"type":"object","additionalProperties":{"type":"string"}},"known_vulns":{"type":"array","items":{"type":"object"}},"licenses":{"type":"object","additionalProperties":{"type":"string"}},"package_name":{"type":"string"},"license":{"type":"string"}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Dependency Audit Skill

Audit npm/Node.js dependencies for CVEs, license compliance, typosquatting, and supply chain integrity. Generates scored reports with remediation guidance.

## Actions

- `audit` — Run full dependency audit (CVEs, licenses, supply chain)
- `check_license` — Classify a single license string
- `check_typosquat` — Check if a package name might be a typosquat
- `parse_deps` — Parse package.json dependencies into audit format

## Scope Mapping
- `security.dependencies`: **read** (analysis only)
