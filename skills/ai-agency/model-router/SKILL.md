---
name: model-router
description: Routes inference requests to the optimal available model based on task type, quality priority, latency budget, and VRAM constraints.
version: 0.1.0
publisher: acmecorp
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [route, score, classify, list_models, vram_budget, suggest_eviction]
    prompt:
      type: string
    task:
      type: string
    quality_priority:
      type: string
      enum: [speed, balanced, quality]
    preferred_model:
      type: string
    latency_budget_ms:
      type: number
    total_vram_mb:
      type: number
    needed_vram_mb:
      type: number
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# model-router

Routes inference requests to the best available model considering task type, quality/speed/cost trade-offs, latency budgets, and VRAM availability. Provides task classification, VRAM budget calculation, and eviction suggestions.
