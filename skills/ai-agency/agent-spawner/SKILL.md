---
name: agent-spawner
description: Spawns, manages lifecycle, and terminates autonomous AI agents from the 40+ built-in agent catalog.
version: 0.1.0
publisher: 47network
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [spawn, terminate, terminate_all, status, list_instances, list_definitions, supervision_tree, stats]
    definition_id:
      type: string
    instance_id:
      type: string
    category:
      type: string
      enum: [code, research, operations, communication]
    lifecycle:
      type: string
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# agent-spawner

Spawns autonomous sub-agents from a catalog of 40+ built-in agent definitions across Code, Research, Operations, and Communication categories. Manages lifecycle, supervision trees, and resource tracking.
