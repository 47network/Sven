---
name: quantum-explain
description: Explain quantum computing concepts, algorithms, and gates with visual circuit diagrams. Educational tool for understanding quantum mechanics.
version: 0.1.0
publisher: 47network
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [gate, algorithm, concept, demo_circuit]
    topic:
      type: string
    gate_id:
      type: string
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# quantum-explain

Educational quantum computing explainer — gate descriptions, algorithm walkthroughs, concept explanations, and interactive demo circuits.
