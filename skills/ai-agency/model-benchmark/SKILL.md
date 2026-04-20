---
name: model-benchmark
description: Runs benchmark suites against models, tracks ELO rankings, manages A/B tests, and generates performance reports.
version: 0.1.0
publisher: acmecorp
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [list_suites, create_run, complete_run, leaderboard, report, record_elo, ab_results]
    suite_id:
      type: string
    model_id:
      type: string
    model_name:
      type: string
    run_id:
      type: string
    winner_id:
      type: string
    loser_id:
      type: string
    is_draw:
      type: boolean
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# model-benchmark

Evaluates model performance with standardised benchmark suites, ELO-style rankings, A/B testing, and cost/quality/speed reporting. Provides a leaderboard and per-model deep-dive reports.
