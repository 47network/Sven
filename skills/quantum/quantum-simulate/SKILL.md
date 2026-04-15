---
name: quantum-simulate
description: Build and run quantum circuits on the Sven quantum simulator. Supports all standard gates, measurement histograms, noise models, and circuit visualization.
version: 0.1.0
publisher: 47network
handler_language: typescript
handler_file: handler.ts
inputs_schema:
  type: object
  properties:
    action:
      type: string
      enum: [run, visualize, list_gates, noise_sim, measure]
    num_qubits:
      type: number
    gates:
      type: array
      items:
        type: object
    shots:
      type: number
    noise_type:
      type: string
      enum: [depolarizing, amplitude_damping, phase_damping]
    noise_probability:
      type: number
  required: [action]
outputs_schema:
  type: object
  properties:
    result:
      type: object
---
# quantum-simulate

Build and run quantum circuits. Supports H, X, Y, Z, CNOT, Toffoli, Rx, Ry, Rz, SWAP gates, measurement histograms, noise models, and ASCII circuit visualization.
