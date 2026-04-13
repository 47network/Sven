---
name: language-analyzer
description: Analyzes communication patterns at leadership levels — extracts mental frameworks, vocabulary patterns, communication structures, and decision-making language from target-level content. Provides actionable recommendations for language-level advancement.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["analyze"],"default":"analyze"},"content":{"type":"string","description":"Sample content from target level (reports, emails, strategy docs)"},"current_level":{"type":"string","description":"Your current level"},"target_level":{"type":"string","description":"The level you are analyzing"}},"required":["action","content"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Language Analyzer Skill

Analyze communication patterns at higher leadership levels to extract frameworks, vocabulary, and structures you can adopt. Feed in emails, reports, or strategy docs from target-level leaders and get actionable language recommendations.

## Actions

- `analyze` — Analyze content for leadership-level language patterns
