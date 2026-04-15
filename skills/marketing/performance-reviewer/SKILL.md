---
name: performance-reviewer
description: Generates strategic performance reviews that position accomplishments for career advancement. Sven writes as a senior leader building a business case to promote — highlighting strategic impact, quantifiable outcomes, and growth trajectory.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["generate_review"],"default":"generate_review"},"accomplishments":{"type":"string","description":"List of work accomplished this quarter"},"level":{"type":"string","description":"Current role level"},"target_level":{"type":"string","description":"Level being promoted to"},"name":{"type":"string","description":"Person's name for the review"}},"required":["action","accomplishments"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Performance Reviewer Skill

Generate performance reviews that position work for career advancement. Sven structures the review as a senior leader making the case for promotion — strategic framing, impact quantification, and growth trajectory.

## Actions

- `generate_review` — Generate a strategic performance review from accomplishments
