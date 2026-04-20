---
name: design-critique
description: Audit designs for quality issues — contrast, spacing, typography, accessibility, color blindness safety. Provides actionable improvement suggestions with severity scoring.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["audit_colors","audit_typography","audit_full","suggest_improvements"],"default":"audit_full"},"colors":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"hex":{"type":"string"},"role":{"type":"string","enum":["background","foreground","primary","secondary","accent","border","success","warning","error"]}},"required":["hex","role"]},"description":"Colors used in the design"},"typography":{"type":"object","properties":{"body_size_px":{"type":"number"},"heading_size_px":{"type":"number"},"line_height":{"type":"number"},"line_width_chars":{"type":"number"},"letter_spacing_em":{"type":"number"}}}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Design Critique Skill

Professional design audit — evaluates color contrast (WCAG 2.1), typography readability, color blindness impact, and accessibility compliance. Returns a scored report with actionable fixes.

## Actions

- `audit_colors` — Check contrast ratios, color blindness safety, and palette coherence
- `audit_typography` — Analyze font size, line height, line width, and letter spacing
- `audit_full` — Run all audits and return a unified design quality score (0-100)
- `suggest_improvements` — Given audit results, generate specific CSS fix suggestions

## Examples

- "Audit my color scheme" → `{ action: "audit_colors", colors: [{ hex: "#333", role: "foreground" }, { hex: "#fff", role: "background" }] }`
- "Is this text readable?" → `{ action: "audit_typography", typography: { body_size_px: 14, line_height: 1.2, line_width_chars: 90 } }`

## Scope Mapping
- `design.audit`: **read** (analysis only, no side effects)
