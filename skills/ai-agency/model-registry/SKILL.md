---
name: model-registry
description: Manages the model catalog — register, unregister, query models by task or status, set defaults, and check health.
version: 0.1.0
publisher: acmecorp
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [list, get, by_task, by_status, set_default, get_default, manifest, set_status, health]
    model_id:
      type: string
    task:
      type: string
    status:
      type: string
    tokens_per_second:
      type: number
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# model-registry

Manages the full model catalog. Register and unregister models, query by task type or status, assign defaults per task, record health checks, and retrieve the full manifest.
