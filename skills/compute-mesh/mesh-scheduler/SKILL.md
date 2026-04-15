---
name: mesh-scheduler
description: Schedules work units to mesh devices based on capability matching, load balancing, battery awareness, and priority.
version: 0.1.0
publisher: 47network
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [schedule, schedule_batch, score_device]
    unit:
      type: object
    units:
      type: array
    device_id:
      type: string
    policy:
      type: object
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# mesh-scheduler

Assigns work units to the optimal mesh device. Scores devices by capability match, load balance, battery/network awareness, and affinity. Supports batch scheduling and custom policies.
