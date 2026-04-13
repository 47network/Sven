import { H, CNOT } from '@sven/quantum-sim/gates';
import {
  createCircuit,
  addGate,
  simulate,
  measureMultiple,
  estimateQuantumVolume,
} from '@sven/quantum-sim/simulator';
import {
  listBackends,
  getBackend,
  estimateCost,
  type BackendType,
} from '@sven/quantum-sim/hardware';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'quantum_volume': {
      const numQubits = (input.num_qubits as number) ?? 10;
      const gateErrorRate = (input.gate_error_rate as number) ?? 0.005;

      const profiles = [
        { label: 'Ideal (0% error)', rate: 0 },
        { label: 'Low noise (0.1%)', rate: 0.001 },
        { label: 'Moderate (0.5%)', rate: 0.005 },
        { label: 'Noisy (1%)', rate: 0.01 },
        { label: 'Very noisy (5%)', rate: 0.05 },
      ];

      const results = profiles.map((p) => {
        const qv = estimateQuantumVolume(numQubits, p.rate);
        return {
          profile: p.label,
          quantumVolume: qv.estimatedQuantumVolume,
          maxDepth: qv.maxDepth,
          effectiveQubits: Math.log2(qv.estimatedQuantumVolume),
        };
      });

      const custom = estimateQuantumVolume(numQubits, gateErrorRate);

      return {
        result: {
          requestedQubits: numQubits,
          customErrorRate: gateErrorRate,
          customQV: custom.estimatedQuantumVolume,
          comparison: results,
          interpretation: `With ${numQubits} qubits and ${(gateErrorRate * 100).toFixed(1)}% error rate, effective quantum volume is ${custom.estimatedQuantumVolume}. This means reliable circuits of depth ~${custom.maxDepth}.`,
        },
      };
    }

    case 'gate_benchmark': {
      const qubitCounts = [2, 4, 6, 8, 10, 12, 14, 16];
      const shots = (input.shots as number) ?? 100;
      const results: Array<{ qubits: number; gates: number; timeMs: number; stateVectorSize: number }> = [];

      for (const n of qubitCounts) {
        let circuit = createCircuit(n);
        const gateCount = n * 3;

        // Build a circuit with H + CNOT ladder
        for (let q = 0; q < n; q++) circuit = addGate(circuit, H, [q]);
        for (let q = 0; q < n - 1; q++) circuit = addGate(circuit, CNOT, [q, q + 1]);
        for (let q = 0; q < n; q++) circuit = addGate(circuit, H, [q]);

        const start = performance.now();
        const result = simulate(circuit);
        measureMultiple(result, shots);
        const elapsed = performance.now() - start;

        results.push({
          qubits: n,
          gates: gateCount,
          timeMs: Math.round(elapsed * 100) / 100,
          stateVectorSize: 1 << n,
        });
      }

      return {
        result: {
          benchmarks: results,
          shots,
          note: 'Simulation time grows exponentially with qubit count (2^n state vector)',
          memoryEstimate: results.map((r) => ({
            qubits: r.qubits,
            stateVectorBytes: r.stateVectorSize * 16, // 2 × 64-bit floats per amplitude
            humanReadable: r.stateVectorSize * 16 < 1024 * 1024
              ? `${(r.stateVectorSize * 16 / 1024).toFixed(1)} KB`
              : `${(r.stateVectorSize * 16 / 1024 / 1024).toFixed(1)} MB`,
          })),
        },
      };
    }

    case 'backend_compare': {
      const backends = listBackends();
      const numQubits = (input.num_qubits as number) ?? 5;
      const gateCount = (input.gates as number) ?? 20;
      const shots = (input.shots as number) ?? 1024;

      const comparison = backends.map((b) => {
        const cost = estimateCost(b.type, numQubits, gateCount, shots);
        const qv = estimateQuantumVolume(b.maxQubits, b.gateErrorRate);
        return {
          id: b.id,
          name: b.name,
          provider: b.provider,
          maxQubits: b.maxQubits,
          available: b.isAvailable,
          region: b.region,
          estimatedCostUsd: cost.estimatedUsd,
          estimatedTimeSec: cost.estimatedSeconds,
          quantumVolume: qv.estimatedQuantumVolume,
        };
      });

      return {
        result: {
          circuit: { qubits: numQubits, gates: gateCount, shots },
          backends: comparison,
          recommendation: 'Use local simulator for development and circuits ≤20 qubits. Cloud backends for larger circuits when available.',
        },
      };
    }

    case 'cost_estimate': {
      const backendId = (input.backend_id as string) ?? 'ibm-brisbane';
      const numQubits = (input.num_qubits as number) ?? 10;
      const gateCount = (input.gates as number) ?? 50;
      const shots = (input.shots as number) ?? 4096;

      const backend = getBackend(backendId);
      if (!backend) {
        const available = listBackends().map((b) => b.id);
        return { error: `Backend "${backendId}" not found. Available: ${available.join(', ')}` };
      }

      const cost = estimateCost(backend.type, numQubits, gateCount, shots);

      return {
        result: {
          backend: { id: backend.id, name: backend.name, provider: backend.provider },
          circuit: { qubits: numQubits, gates: gateCount, shots },
          cost: {
            estimatedUsd: cost.estimatedUsd,
            estimatedSeconds: cost.estimatedSeconds,
            breakdown: `${shots} shots × per-shot rate + ${gateCount} gates × per-gate rate + ${numQubits} qubits × per-qubit rate`,
          },
        },
      };
    }

    case 'simulator_limits': {
      const limits = [
        { qubits: 10, stateVectorBytes: (1 << 10) * 16, feasible: true },
        { qubits: 15, stateVectorBytes: (1 << 15) * 16, feasible: true },
        { qubits: 20, stateVectorBytes: (1 << 20) * 16, feasible: true },
        { qubits: 22, stateVectorBytes: (1 << 22) * 16, feasible: true },
        { qubits: 25, stateVectorBytes: (1 << 25) * 16, feasible: true },
        { qubits: 28, stateVectorBytes: 2 ** 28 * 16, feasible: false },
        { qubits: 30, stateVectorBytes: 2 ** 30 * 16, feasible: false },
      ];

      return {
        result: {
          limits: limits.map((l) => ({
            qubits: l.qubits,
            memoryRequired: l.stateVectorBytes < 1024 * 1024 * 1024
              ? `${(l.stateVectorBytes / 1024 / 1024).toFixed(1)} MB`
              : `${(l.stateVectorBytes / 1024 / 1024 / 1024).toFixed(1)} GB`,
            feasible: l.feasible,
            stateVectorDim: 1 << l.qubits,
          })),
          recommendation: 'Max 25 qubits on typical hardware (512 MB state vector). For larger circuits, use cloud quantum backends.',
          currentMax: 25,
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: quantum_volume, gate_benchmark, backend_compare, cost_estimate, simulator_limits` };
  }
}
