import {
  getStandardGate,
  listStandardGates,
  Rx, Ry, Rz,
  type GateMatrix,
} from '@sven/quantum-sim/gates';
import {
  createCircuit,
  addGate,
  simulate,
  measureMultiple,
  circuitToAscii,
  applyNoise,
  type NoiseType,
} from '@sven/quantum-sim/simulator';

interface GateInstruction {
  gate: string;
  qubits: number[];
  theta?: number;
}

function resolveGate(inst: GateInstruction): GateMatrix | undefined {
  const id = inst.gate.toUpperCase();
  if (id === 'RX' && inst.theta != null) return Rx(inst.theta);
  if (id === 'RY' && inst.theta != null) return Ry(inst.theta);
  if (id === 'RZ' && inst.theta != null) return Rz(inst.theta);
  return getStandardGate(id);
}

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'run': {
      const numQubits = (input.num_qubits as number) ?? 2;
      const gates = (input.gates as GateInstruction[]) ?? [
        { gate: 'H', qubits: [0] },
        { gate: 'CNOT', qubits: [0, 1] },
      ];
      const shots = (input.shots as number) ?? 1024;

      if (numQubits > 20) return { error: 'Maximum 20 qubits supported on local simulator' };

      let circuit = createCircuit(numQubits);
      for (const g of gates) {
        const gateMatrix = resolveGate(g);
        if (!gateMatrix) return { error: `Unknown gate "${g.gate}"` };
        circuit = addGate(circuit, gateMatrix, g.qubits);
      }

      const result = simulate(circuit);
      const counts = measureMultiple(result, shots);
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);

      return {
        result: {
          numQubits,
          gateCount: gates.length,
          shots,
          measurements: Object.fromEntries(sorted.slice(0, 16)),
          topOutcome: sorted[0]?.[0] ?? 'N/A',
          probabilities: result.probabilities
            .map((p, i) => ({ state: i.toString(2).padStart(numQubits, '0'), probability: p }))
            .filter((p) => p.probability > 0.001)
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 16),
        },
      };
    }

    case 'visualize': {
      const numQubits = (input.num_qubits as number) ?? 2;
      const gates = (input.gates as GateInstruction[]) ?? [
        { gate: 'H', qubits: [0] },
        { gate: 'CNOT', qubits: [0, 1] },
      ];

      let circuit = createCircuit(numQubits);
      for (const g of gates) {
        const gateMatrix = resolveGate(g);
        if (!gateMatrix) return { error: `Unknown gate "${g.gate}"` };
        circuit = addGate(circuit, gateMatrix, g.qubits);
      }

      const ascii = circuitToAscii(circuit);
      return { result: { circuit: ascii, numQubits, gateCount: gates.length } };
    }

    case 'list_gates': {
      const gates = listStandardGates();
      return {
        result: {
          count: gates.length,
          gates,
          parameterized: ['Rx(θ)', 'Ry(θ)', 'Rz(θ)'],
        },
      };
    }

    case 'noise_sim': {
      const numQubits = (input.num_qubits as number) ?? 2;
      const gates = (input.gates as GateInstruction[]) ?? [
        { gate: 'H', qubits: [0] },
        { gate: 'CNOT', qubits: [0, 1] },
      ];
      const noiseType = (input.noise_type as NoiseType) ?? 'depolarizing';
      const noiseProbability = (input.noise_probability as number) ?? 0.05;

      let circuit = createCircuit(numQubits);
      for (const g of gates) {
        const gateMatrix = resolveGate(g);
        if (!gateMatrix) return { error: `Unknown gate "${g.gate}"` };
        circuit = addGate(circuit, gateMatrix, g.qubits);
      }

      const result = simulate(circuit);
      const idealProbs = [...result.probabilities];
      const noisyProbs = applyNoise(result.probabilities, { type: noiseType, probability: noiseProbability });

      return {
        result: {
          noiseModel: { type: noiseType, probability: noiseProbability },
          ideal: idealProbs
            .map((p, i) => ({ state: i.toString(2).padStart(numQubits, '0'), probability: p }))
            .filter((p) => p.probability > 0.001),
          noisy: noisyProbs
            .map((p, i) => ({ state: i.toString(2).padStart(numQubits, '0'), probability: p }))
            .filter((p) => p.probability > 0.001),
          fidelity: idealProbs.reduce((sum, p, i) => sum + Math.sqrt(p * (noisyProbs[i] ?? 0)), 0),
        },
      };
    }

    case 'measure': {
      const numQubits = (input.num_qubits as number) ?? 3;
      const shots = (input.shots as number) ?? 1024;

      // Run a simple superposition circuit for demonstration
      let circuit = createCircuit(numQubits);
      for (let q = 0; q < numQubits; q++) {
        circuit = addGate(circuit, getStandardGate('H')!, [q]);
      }

      const result = simulate(circuit);
      const counts = measureMultiple(result, shots);

      return {
        result: {
          description: `${numQubits}-qubit equal superposition measured ${shots} times`,
          expectedDistribution: 'uniform',
          measurements: Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16)),
          uniqueOutcomes: counts.size,
          expectedOutcomes: 1 << numQubits,
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: run, visualize, list_gates, noise_sim, measure` };
  }
}
