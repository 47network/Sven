---
name: analytics-reporter
description: Marketing analytics aggregation and reporting — tracks channel metrics (reach, engagement, conversions, spend), calculates KPIs, performs trend analysis, and generates formatted marketing reports for 47Network.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["channel_metrics","aggregate","report"],"default":"report"},"channel":{"type":"string"},"data":{"type":"object"},"channel_data":{"type":"array","items":{"type":"object"}},"period":{"type":"string","enum":["daily","weekly","monthly","quarterly"]},"start_date":{"type":"string"},"end_date":{"type":"string"},"previous_totals":{"type":"object"},"top_content":{"type":"array","items":{"type":"object"}}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Analytics Reporter Skill

Aggregates marketing metrics across all channels, calculates KPIs, performs trend analysis vs previous period, and generates formatted marketing reports with actionable recommendations.

## Actions

- `channel_metrics` — Calculate metrics for a single channel
- `aggregate` — Aggregate metrics across all channels for a period
- `report` — Generate a full marketing report with recommendations
