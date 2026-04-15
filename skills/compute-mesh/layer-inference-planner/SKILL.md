---
name: layer-inference-planner
description: Plans AirLLM-style layer-by-layer inference across mesh devices for running large models on limited hardware.
version: 0.1.0
publisher: 47network
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [plan_single, plan_distributed, estimate, visualize]
    model_id:
      type: string
    total_layers:
      type: number
    activation_size_mb:
      type: number
    available_vram_mb:
      type: number
    devices:
      type: array
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# layer-inference-planner

Plans AirLLM-style layer-by-layer inference for running 70B+ models on constrained hardware. Supports single-device sequential inference and multi-device pipeline distribution with activation transfer estimation.
