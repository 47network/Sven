---
name: proactive-sender
description: Send proactive messages to the user through configured channels. Allows Sven to autonomously reach out with questions, alerts, progress updates, or any message without waiting for user input.
version: 2026.4.11
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["send_message","send_alert","send_question","send_progress","record_feedback"]},"text":{"type":"string","description":"Message body in Markdown"},"severity":{"type":"string","enum":["info","warning","error","critical"],"default":"info"},"category":{"type":"string","enum":["critical_error","resource_exhaustion","security_alert","training_milestone","health_degraded","task_completed","scheduled_digest","custom"],"default":"custom"},"target_channel_ids":{"type":"array","items":{"type":"string"}},"log_id":{"type":"string"},"feedback_action":{"type":"string","enum":["acknowledged","dismissed","muted_rule"]}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Proactive Sender

Send proactive messages to users through Slack, Discord, WhatsApp, or any configured channel. This is how Sven reaches out autonomously.

## Actions

- `send_message` — Send a freeform proactive message
- `send_alert` — Send a system alert (pre-formatted with severity banner)
- `send_question` — Send a question to the user and await response
- `send_progress` — Send a progress update on a running task
- `record_feedback` — Record user feedback on a notification (acknowledge, dismiss, mute)

## Usage Examples

### Sven notifying about an error
```json
{
  "action": "send_alert",
  "text": "Database connection pool exhausted on gateway-api. Current connections: 95/100. Auto-scaling connection limit.",
  "severity": "error",
  "category": "resource_exhaustion"
}
```

### Sven asking a question
```json
{
  "action": "send_question",
  "text": "I found 3 unused Docker volumes consuming 12GB. Should I prune them?",
  "severity": "info",
  "category": "custom"
}
```

### Sven reporting progress
```json
{
  "action": "send_progress",
  "text": "RAG index rebuild: 847/1200 documents processed (71%). ETA: ~8 minutes.",
  "severity": "info",
  "category": "task_completed"
}
```

## Scope Mapping
- `notifications.send`: **write**
- `notifications.feedback`: **write**
