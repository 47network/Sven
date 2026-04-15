import { getStandardGate, listStandardGates, isUnitary, H, X, CNOT } from '@sven/quantum-sim/gates';
import { createCircuit, addGate, simulate, measureMultiple, circuitToAscii } from '@sven/quantum-sim/simulator';

const GATE_EXPLANATIONS: Record<string, { description: string; useCase: string; matrix: string }> = {
  H: {
    description: 'The Hadamard gate creates equal superposition — it transforms |0⟩ into (|0⟩+|1⟩)/√2. It is the "coin flip" of quantum computing.',
    useCase: 'Creating superposition states, the first step of nearly every quantum algorithm.',
    matrix: '1/√2 × [[1, 1], [1, -1]]',
  },
  X: {
    description: 'The Pauli-X gate is the quantum NOT gate — it flips |0⟩ to |1⟩ and vice versa.',
    useCase: 'Bit flips, initializing qubits to |1⟩, building controlled operations.',
    matrix: '[[0, 1], [1, 0]]',
  },
  Y: {
    description: 'The Pauli-Y gate rotates around the Y-axis of the Bloch sphere. It flips the bit and adds a phase.',
    useCase: 'Phase manipulation, error correction, certain variational algorithms.',
    matrix: '[[0, -i], [i, 0]]',
  },
  Z: {
    description: 'The Pauli-Z gate flips the phase of |1⟩ without changing |0⟩. It is a phase gate, not a bit flip.',
    useCase: 'Phase kickback, marking states in Grover\'s algorithm, error syndromes.',
    matrix: '[[1, 0], [0, -1]]',
  },
  CNOT: {
    description: 'Controlled-NOT: flips the target qubit if and only if the control qubit is |1⟩. Creates entanglement.',
    useCase: 'Entanglement creation (Bell states), error correction, conditional logic.',
    matrix: '[[1,0,0,0], [0,1,0,0], [0,0,0,1], [0,0,1,0]]',
  },
  SWAP: {
    description: 'Exchanges the states of two qubits. Equivalent to three CNOT gates.',
    useCase: 'Qubit routing when hardware connectivity is limited.',
    matrix: '[[1,0,0,0], [0,0,1,0], [0,1,0,0], [0,0,0,1]]',
  },
  TOFFOLI: {
    description: 'A 3-qubit gate that flips the target only when both controls are |1⟩. Universal for classical computation.',
    useCase: 'Reversible classical logic, quantum error correction, arithmetic circuits.',
    matrix: '8×8 identity with rows 6↔7 swapped',
  },
};

const ALGORITHM_EXPLANATIONS: Record<string, { description: string; complexity: string; svenUseCase: string; steps: string[] }> = {
  grover: {
    description: 'Grover\'s algorithm searches an unstructured database of N items in O(√N) steps instead of O(N). It provides a quadratic speedup.',
    complexity: 'O(√N) vs O(N) classical — quadratic speedup',
    svenUseCase: 'Searching large unsorted datasets, pattern matching, database scanning.',
    steps: [
      '1. Initialize all qubits in equal superposition using Hadamard gates',
      '2. Apply the Oracle: flip the phase of the target state',
      '3. Apply the Diffusion operator: amplify the marked state\'s amplitude',
      '4. Repeat steps 2-3 approximately π/4 × √N times',
      '5. Measure — the target state will be observed with high probability',
    ],
  },
  qaoa: {
    description: 'QAOA (Quantum Approximate Optimization) finds approximate solutions to combinatorial optimization problems by alternating problem and mixer unitaries.',
    complexity: 'Depends on layers (p) and problem structure — potential advantage for hard optimization',
    svenUseCase: 'Portfolio optimization, resource allocation, scheduling, network routing.',
    steps: [
      '1. Encode the objective function as a Hamiltonian (quantum energy function)',
      '2. Initialize qubits in equal superposition',
      '3. Apply the problem unitary (rotations encoding the objective) with parameter γ',
      '4. Apply the mixer unitary (X-rotations) with parameter β',
      '5. Repeat steps 3-4 for p layers',
      '6. Measure and evaluate the objective — optimize γ, β classically',
    ],
  },
  shor: {
    description: 'Shor\'s algorithm factors large numbers exponentially faster than classical methods. It threatens RSA encryption.',
    complexity: 'O((log N)³) vs exponential classical — exponential speedup',
    svenUseCase: 'Understanding cryptographic risks. Sven monitors quantum hardware progress to assess when RSA/ECC keys need rotation.',
    steps: [
      '1. Choose a random number a < N',
      '2. Use quantum period-finding to discover the period r of a^x mod N',
      '3. The quantum part uses Quantum Fourier Transform on superposition of modular exponentials',
      '4. If r is even and a^(r/2) ≠ -1 mod N, then gcd(a^(r/2) ± 1, N) gives factors',
    ],
  },
  qmc: {
    description: 'Quantum Monte Carlo uses quantum amplitude estimation to achieve quadratic speedup in Monte Carlo sampling.',
    complexity: 'O(1/ε) vs O(1/ε²) classical — quadratic speedup in precision',
    svenUseCase: 'Enhanced price predictions, option pricing, risk estimation in the trading platform.',
    steps: [
      '1. Encode the probability distribution as quantum amplitudes',
      '2. Apply a function evaluation oracle',
      '3. Use amplitude estimation to extract the expectation value',
      '4. Achieves the same precision with quadratically fewer samples',
    ],
  },
};

const CONCEPT_EXPLANATIONS: Record<string, string> = {
  superposition: 'A qubit can be in a combination of |0⟩ and |1⟩ simultaneously: α|0⟩ + β|1⟩ where |α|² + |β|² = 1. When measured, it collapses to |0⟩ with probability |α|² or |1⟩ with probability |β|². This is not "being in both states" — it\'s a fundamentally new kind of information.',
  entanglement: 'Two or more qubits can be correlated in ways impossible classically. In a Bell state (|00⟩ + |11⟩)/√2, measuring one qubit instantly determines the other, regardless of distance. This is the resource that powers quantum speedups.',
  measurement: 'Measurement collapses a quantum state to a classical outcome. The probability of each outcome is the squared magnitude of its amplitude. Measurement is irreversible — the superposition is destroyed.',
  decoherence: 'Quantum states are fragile. Interaction with the environment causes decoherence — the loss of quantum information. This is why quantum computers need extreme isolation (near absolute zero temperatures, electromagnetic shielding).',
  quantum_volume: 'Quantum Volume (QV) is a metric for quantum computer performance: QV = 2^n where n is the largest random circuit of depth n that the device can execute reliably. Higher QV means the device can run more complex algorithms.',
  bloch_sphere: 'A single qubit\'s state can be visualized as a point on a sphere. |0⟩ is the north pole, |1⟩ is the south pole. Any point on the surface is a valid qubit state. Quantum gates rotate the point around the sphere.',
  no_cloning: 'The No-Cloning Theorem states that an arbitrary unknown quantum state cannot be perfectly copied. This is fundamental — it prevents eavesdropping on quantum communication (QKD) and limits certain quantum algorithms.',
};

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'gate': {
      const gateId = ((input.gate_id ?? input.topic) as string)?.toUpperCase() ?? 'H';
      const explanation = GATE_EXPLANATIONS[gateId];
      if (!explanation) {
        return {
          result: {
            available: Object.keys(GATE_EXPLANATIONS),
            message: `No explanation for "${gateId}". Try one of the available gates.`,
          },
        };
      }

      const gate = getStandardGate(gateId);
      const unitary = gate ? isUnitary(gate) : false;

      return {
        result: {
          gate: gateId,
          ...explanation,
          isUnitary: unitary,
          qubits: gate?.qubits ?? 'unknown',
        },
      };
    }

    case 'algorithm': {
      const topic = ((input.topic as string) ?? 'grover').toLowerCase();
      const explanation = ALGORITHM_EXPLANATIONS[topic];
      if (!explanation) {
        return {
          result: {
            available: Object.keys(ALGORITHM_EXPLANATIONS),
            message: `No explanation for "${topic}". Try one of the available algorithms.`,
          },
        };
      }
      return { result: { algorithm: topic, ...explanation } };
    }

    case 'concept': {
      const topic = ((input.topic as string) ?? 'superposition').toLowerCase().replace(/\s+/g, '_');
      const explanation = CONCEPT_EXPLANATIONS[topic];
      if (!explanation) {
        return {
          result: {
            available: Object.keys(CONCEPT_EXPLANATIONS),
            message: `No explanation for "${topic}". Try one of the available concepts.`,
          },
        };
      }
      return { result: { concept: topic, explanation } };
    }

    case 'demo_circuit': {
      const topic = ((input.topic as string) ?? 'bell_state').toLowerCase().replace(/\s+/g, '_');

      if (topic === 'bell_state') {
        let circuit = createCircuit(2);
        circuit = addGate(circuit, H, [0]);
        circuit = addGate(circuit, CNOT, [0, 1]);
        const result = simulate(circuit);
        const counts = measureMultiple(result, 1024);
        const ascii = circuitToAscii(circuit);

        return {
          result: {
            name: 'Bell State (EPR Pair)',
            description: 'Creates maximal entanglement: (|00⟩ + |11⟩)/√2',
            circuit: ascii,
            measurements: Object.fromEntries([...counts.entries()].sort()),
            expected: 'Roughly 50% |00⟩ and 50% |11⟩ — never |01⟩ or |10⟩ (entanglement!)',
          },
        };
      }

      if (topic === 'ghz') {
        let circuit = createCircuit(3);
        circuit = addGate(circuit, H, [0]);
        circuit = addGate(circuit, CNOT, [0, 1]);
        circuit = addGate(circuit, CNOT, [1, 2]);
        const result = simulate(circuit);
        const counts = measureMultiple(result, 1024);
        const ascii = circuitToAscii(circuit);

        return {
          result: {
            name: 'GHZ State (3-qubit entanglement)',
            description: 'Creates (|000⟩ + |111⟩)/√2 — three qubits maximally entangled',
            circuit: ascii,
            measurements: Object.fromEntries([...counts.entries()].sort()),
            expected: 'Roughly 50% |000⟩ and 50% |111⟩ — all other states absent',
          },
        };
      }

      if (topic === 'superposition') {
        let circuit = createCircuit(3);
        for (let q = 0; q < 3; q++) circuit = addGate(circuit, H, [q]);
        const result = simulate(circuit);
        const counts = measureMultiple(result, 1024);
        const ascii = circuitToAscii(circuit);

        return {
          result: {
            name: '3-Qubit Equal Superposition',
            description: 'All 8 computational basis states with equal probability (1/8 each)',
            circuit: ascii,
            measurements: Object.fromEntries([...counts.entries()].sort()),
            expected: 'All 8 states with roughly equal counts (~128 each out of 1024)',
          },
        };
      }

      return {
        result: {
          available: ['bell_state', 'ghz', 'superposition'],
          message: `No demo for "${topic}". Try one of the available demos.`,
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: gate, algorithm, concept, demo_circuit` };
  }
}
