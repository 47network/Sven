---
name: mesh-device-manager
description: Manages the compute mesh device registry — register, query, heartbeat, opt-in/out, and view aggregate mesh stats.
version: 0.1.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [list, get, list_online, by_type, heartbeat, opt_in, opt_out, stats]
    device_id:
      type: string
    device_type:
      type: string
      enum: [vm, mobile, desktop, federated]
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# mesh-device-manager

Manages the distributed compute mesh device registry. Register devices, track capabilities, send heartbeats, manage opt-in status, and view aggregate mesh statistics.
