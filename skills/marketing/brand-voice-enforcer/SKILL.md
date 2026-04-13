---
name: brand-voice-enforcer
description: Validates marketing content against the 47Network brand profile — checks tone alignment, prohibited terminology, key message coverage, CTA presence, and jargon detection. Returns a scored brand consistency report with specific suggestions.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["check","profile"],"default":"check"},"content":{"type":"string","description":"Content to validate against brand voice"}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Brand Voice Enforcer Skill

Validates all outgoing marketing content against 47Network's brand profile. Checks tone, prohibited terms, key message coverage, and style consistency. Score A-F with specific fix recommendations.

## Actions

- `check` — Check content against brand voice guidelines
- `profile` — View the current 47Network brand profile
