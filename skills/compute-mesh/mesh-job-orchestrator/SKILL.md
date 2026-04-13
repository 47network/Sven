---
name: mesh-job-orchestrator
description: Creates, monitors, and manages distributed compute jobs with MapReduce, Pipeline, ScatterGather, and LayerSplit strategies.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [create_job, get_job, list_jobs, cancel, progress, complete_unit, fail_unit, stats]
    job_id:
      type: string
    unit_id:
      type: string
    name:
      type: string
    description:
      type: string
    strategy:
      type: string
      enum: [map_reduce, pipeline, scatter_gather, layer_split]
    payloads:
      type: array
    priority:
      type: number
    sensitivity:
      type: string
    result:
      type: object
    error:
      type: string
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# mesh-job-orchestrator

Creates and manages distributed compute jobs. Decomposes jobs into work units using MapReduce, Pipeline, ScatterGather, or LayerSplit strategies. Tracks progress, handles retries, and aggregates results.
