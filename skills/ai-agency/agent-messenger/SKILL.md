---
name: agent-messenger
description: Sends messages between agents, broadcasts to channels, and retrieves message history for inter-agent communication.
version: 0.1.0
publisher: acmecorp
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [send, broadcast, history]
    from_agent:
      type: string
    to_agent:
      type: string
    channel:
      type: string
    payload:
      type: object
    agent_id:
      type: string
    limit:
      type: number
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# agent-messenger

Handles inter-agent communication via a message bus. Supports direct messaging, channel broadcasts, and message history retrieval for agent coordination.
