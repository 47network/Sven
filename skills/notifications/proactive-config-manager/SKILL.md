---
name: proactive-config-manager
description: Manage Sven's proactive notification configuration — enable/disable notifications, set quiet hours, configure cooldowns, manage trigger rules and delivery channels.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["get_config","update_config","list_rules","create_rule","update_rule","delete_rule","list_endpoints","create_endpoint","update_endpoint","delete_endpoint","list_log","get_stats"]},"config":{"type":"object"},"rule":{"type":"object"},"endpoint":{"type":"object"},"rule_id":{"type":"string"},"endpoint_id":{"type":"string"},"log_filter":{"type":"object","properties":{"category":{"type":"string"},"severity":{"type":"string"},"status":{"type":"string"},"limit":{"type":"number"},"offset":{"type":"number"}}}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Proactive Config Manager

Manage Sven's proactive notification system — the engine that allows Sven to autonomously reach out via Slack, Discord, WhatsApp, or any configured channel.

## Actions

- `get_config` — Get the current global proactive notification config
- `update_config` — Update global config (enable/disable, quiet hours, cooldowns, etc.)
- `list_rules` — List all trigger rules
- `create_rule` — Create a new trigger rule
- `update_rule` — Update an existing trigger rule
- `delete_rule` — Delete a trigger rule
- `list_endpoints` — List all delivery channel endpoints
- `create_endpoint` — Register a new channel endpoint (Slack channel, Discord channel, etc.)
- `update_endpoint` — Update a channel endpoint
- `delete_endpoint` — Remove a channel endpoint
- `list_log` — View proactive notification history log
- `get_stats` — Get delivery statistics

## Scope Mapping
- `notifications.config`: **read**, **write**
- `notifications.rules`: **read**, **write**
- `notifications.endpoints`: **read**, **write**
- `notifications.log`: **read**
