---
name: campaign-planner
description: Marketing campaign design, planning, and performance tracking for 47Network. Creates multi-channel campaigns with goals, budgets, timelines, and automated performance scoring with ROI analysis.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["create","timeline","score","report"],"default":"create"},"name":{"type":"string"},"description":{"type":"string"},"channels":{"type":"array","items":{"type":"string"}},"goals":{"type":"array","items":{"type":"object"}},"budget":{"type":"object"},"campaign":{"type":"object"},"duration_weeks":{"type":"number"}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Campaign Planner Skill

Design, plan, and track marketing campaigns across multiple channels. Includes goal setting, budget allocation, phased timelines, and automated performance scoring.

## Actions

- `create` — Create a new marketing campaign
- `timeline` — Generate a phased campaign timeline
- `score` — Score campaign performance against goals
- `report` — Generate a campaign performance report in Markdown
