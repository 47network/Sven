---
name: schedule-message
description: Schedule a message to be sent to the user at a specific future time via the Sven companion app. Use this when the user asks Sven to send them a reminder, notification, or any message at a specific time.
version: 2026.6.15
publisher: 47Network
handler_language: typescript
handler_file: handler.ts
inputs_schema: {"type":"object","properties":{"action":{"type":"string","enum":["schedule","list","cancel"]},"title":{"type":"string","description":"Short title for the notification (max 200 chars)"},"body":{"type":"string","description":"Message body to deliver"},"scheduled_at":{"type":"string","description":"ISO 8601 datetime when to deliver (e.g. 2026-06-15T10:20:00+03:00)"},"message_id":{"type":"string","description":"ID of scheduled message to cancel (for cancel action)"}},"required":["action"],"additionalProperties":false}
outputs_schema: {"type":"object","properties":{"action":{"type":"string"},"result":{"type":"object"}},"required":["action","result"]}
---

# Schedule Message

Schedule a message to be delivered to the user at a future time via push notification on the Sven companion app.

## Actions

- `schedule` — Schedule a new message for future delivery
- `list` — List the user's pending and delivered scheduled messages
- `cancel` — Cancel a pending scheduled message by ID

## Usage Examples

### Schedule a message
```json
{
  "action": "schedule",
  "title": "Reminder from Sven",
  "body": "Hey! This is the scheduled test message you asked for.",
  "scheduled_at": "2026-06-15T10:20:00+03:00"
}
```

### List scheduled messages
```json
{
  "action": "list"
}
```

### Cancel a scheduled message
```json
{
  "action": "cancel",
  "message_id": "abc123-..."
}
```

## Scope Mapping
- `messages.schedule`: **write**
- `messages.schedule`: **read**
