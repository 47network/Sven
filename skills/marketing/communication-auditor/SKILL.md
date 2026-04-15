---
name: communication-auditor
description: Self-perception mirror — analyzes your own communications to reveal how others perceive your style, implied level, strengths, blind spots, and credibility. Provides scored style profile and actionable recommendations for communication improvement.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["audit"],"default":"audit"},"content":{"type":"string","description":"Your emails, messages, reports, or other communications"},"role":{"type":"string","description":"What role/level you are communicating from"}},"required":["action","content"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Communication Auditor Skill

Analyze your own communications to reveal how others perceive you. Provides a scored style profile (formality, assertiveness, empathy, clarity, strategic thinking), implied professional level, and specific improvement recommendations.

## Actions

- `audit` — Analyze communications for self-perception insights
