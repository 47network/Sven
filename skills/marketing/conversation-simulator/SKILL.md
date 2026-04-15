---
name: conversation-simulator
description: Role-play engine for practising hard conversations — salary negotiations, delivering bad news, performance feedback, client objections, and conflict resolution. Sven plays the other party, pushes back realistically, and provides turn-by-turn analysis with a full debrief.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["list_scenarios","get_scenario","create_scenario","analyze_turn","debrief"],"default":"list_scenarios"},"scenario_id":{"type":"string"},"title":{"type":"string"},"context":{"type":"string"},"other_party":{"type":"string"},"objectives":{"type":"array","items":{"type":"string"}},"difficulty":{"type":"string","enum":["beginner","intermediate","advanced"]},"message":{"type":"string"},"turns":{"type":"array"}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Conversation Simulator Skill

Practice hard conversations before they happen. Sven simulates the other party, pushes back realistically, and scores each turn for effectiveness. 5 preset scenarios + custom scenario support.

## Actions

- `list_scenarios` — List all available conversation scenarios
- `get_scenario` — Get a specific scenario by ID
- `create_scenario` — Create a custom conversation scenario
- `analyze_turn` — Analyze a single conversation turn for effectiveness
- `debrief` — Generate a full debrief from a completed conversation
