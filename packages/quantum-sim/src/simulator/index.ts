import {
  type Complex,
  type GateMatrix,
  complex,
  add,
  mul,
  magnitudeSq,
  scale,
  ZERO,
  ONE,
  ID,
  tensorProduct,
  applyGateToState,
} from '../gates/index.js';

// ─── Circuit Definition ──────────────────────────────────────────────────────

export interface CircuitInstruction {
  gate: GateMatrix;
  qubits: number[];
}

export interface QuantumCircuit {
  numQubits: number;
  instructions: CircuitInstruction[];
}

export function createCircuit(numQubits: number): QuantumCircuit {
  if (numQubits < 1 || numQubits > 25) {
    throw new Error(`Qubit count must be 1–25, got ${numQubits}`);
  }
  return { numQubits, instructions: [] };
}

export function addGate(circuit: QuantumCircuit, gate: GateMatrix, qubits: number[]): QuantumCircuit {
  if (qubits.length !== gate.qubits) {
    throw new Error(`Gate ${gate.id} requires ${gate.qubits} qubit(s), got ${qubits.length}`);
  }
  for (const q of qubits) {
    if (q < 0 || q >= circuit.numQubits) {
      throw new Error(`Qubit index ${q} out of range [0, ${circuit.numQubits - 1}]`);
    }
  }
  return { ...circuit, instructions: [...circuit.instructions, { gate, qubits }] };
}

// ─── State Vector Simulator ──────────────────────────────────────────────────

/** Initialize |0...0⟩ state */
export function initState(numQubits: number): Complex[] {
  const dim = 1 << numQubits;
  const state: Complex[] = new Array(dim);
  for (let i = 0; i < dim; i++) state[i] = ZERO;
  state[0] = ONE;
  return state;
}

/**
 * Expand a gate acting on specific qubits into the full 2^n × 2^n space,
 * then apply it to the state vector.
 */
function applyInstruction(state: Complex[], numQubits: number, inst: CircuitInstruction): Complex[] {
  const dim = 1 << numQubits;
  const { gate, qubits: targetQubits } = inst;

  if (gate.qubits === 1 && targetQubits.length === 1) {
    return applySingleQubitGate(state, numQubits, gate, targetQubits[0]!);
  }

  if (gate.qubits === 2 && targetQubits.length === 2) {
    return applyTwoQubitGate(state, numQubits, gate, targetQubits[0]!, targetQubits[1]!);
  }

  // General case: build the full gate matrix via tensor products
  const fullGate = buildFullGate(numQubits, gate, targetQubits);
  return applyGateToState(fullGate, state);

  // Suppress unused variable warning for dim
  void dim;
}

function applySingleQubitGate(state: Complex[], numQubits: number, gate: GateMatrix, target: number): Complex[] {
  const dim = 1 << numQubits;
  const result: Complex[] = [...state];
  const step = 1 << target;

  for (let i = 0; i < dim; i += step * 2) {
    for (let j = 0; j < step; j++) {
      const i0 = i + j;
      const i1 = i0 + step;
      const a = state[i0]!;
      const b = state[i1]!;
      result[i0] = add(mul(gate.matrix[0]!, a), mul(gate.matrix[1]!, b));
      result[i1] = add(mul(gate.matrix[2]!, a), mul(gate.matrix[3]!, b));
    }
  }
  return result;
}

function applyTwoQubitGate(state: Complex[], numQubits: number, gate: GateMatrix, q0: number, q1: number): Complex[] {
  const dim = 1 << numQubits;
  const result: Complex[] = new Array(dim);
  for (let i = 0; i < dim; i++) result[i] = ZERO;

  for (let i = 0; i < dim; i++) {
    const b0 = (i >> q0) & 1;
    const b1 = (i >> q1) & 1;
    const row = (b0 << 1) | b1;

    for (let col = 0; col < 4; col++) {
      const nb0 = (col >> 1) & 1;
      const nb1 = col & 1;
      const j = (i & ~(1 << q0) & ~(1 << q1)) | (nb0 << q0) | (nb1 << q1);
      result[i] = add(result[i]!, mul(gate.matrix[row * 4 + col]!, state[j]!));
    }
  }
  return result;
}

function buildFullGate(numQubits: number, gate: GateMatrix, targets: number[]): GateMatrix {
  // Simplified: build via sequential tensor products
  // For 3+ qubit gates, we use the general approach
  let result = gate;
  const totalQubits = numQubits;
  // Pad with identity matrices
  // This is a simplified version that works for gates whose target qubits are contiguous
  const startQubit = Math.min(...targets);
  const beforeQubits = startQubit;
  const afterQubits = totalQubits - startQubit - gate.qubits;

  if (beforeQubits > 0) {
    let identBefore: GateMatrix = ID;
    for (let i = 1; i < beforeQubits; i++) identBefore = tensorProduct(identBefore, ID);
    result = tensorProduct(identBefore, result);
  }
  if (afterQubits > 0) {
    let identAfter: GateMatrix = ID;
    for (let i = 1; i < afterQubits; i++) identAfter = tensorProduct(identAfter, ID);
    result = tensorProduct(result, identAfter);
  }
  return result;
}

// ─── Simulation ──────────────────────────────────────────────────────────────

export interface SimulationResult {
  finalState: Complex[];
  probabilities: number[];
  numQubits: number;
  gateCount: number;
  circuitDepth: number;
}

export function simulate(circuit: QuantumCircuit): SimulationResult {
  let state = initState(circuit.numQubits);

  for (const inst of circuit.instructions) {
    state = applyInstruction(state, circuit.numQubits, inst);
  }

  const probabilities = state.map(magnitudeSq);

  return {
    finalState: state,
    probabilities,
    numQubits: circuit.numQubits,
    gateCount: circuit.instructions.length,
    circuitDepth: circuit.instructions.length, // Simplified
  };
}

// ─── Measurement ─────────────────────────────────────────────────────────────

export interface MeasurementResult {
  outcome: number;
  binaryString: string;
  probability: number;
}

/** Measure the circuit, collapsing to a single classical outcome */
export function measure(result: SimulationResult): MeasurementResult {
  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < result.probabilities.length; i++) {
    cumulative += result.probabilities[i]!;
    if (rand <= cumulative) {
      return {
        outcome: i,
        binaryString: i.toString(2).padStart(result.numQubits, '0'),
        probability: result.probabilities[i]!,
      };
    }
  }
  // Fallback to last state (should not happen with valid probabilities)
  const last = result.probabilities.length - 1;
  return {
    outcome: last,
    binaryString: last.toString(2).padStart(result.numQubits, '0'),
    probability: result.probabilities[last]!,
  };
}

/** Run multiple measurements to build a histogram */
export function measureMultiple(result: SimulationResult, shots: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < shots; i++) {
    const m = measure(result);
    counts.set(m.binaryString, (counts.get(m.binaryString) ?? 0) + 1);
  }
  return counts;
}

// ─── Noise Models ────────────────────────────────────────────────────────────

export type NoiseType = 'depolarizing' | 'amplitude_damping' | 'phase_damping';

export interface NoiseModel {
  type: NoiseType;
  probability: number;
}

/** Apply simple depolarizing noise to probabilities */
export function applyNoise(probabilities: number[], noise: NoiseModel): number[] {
  const n = probabilities.length;
  const p = noise.probability;

  switch (noise.type) {
    case 'depolarizing': {
      // Mix with uniform distribution
      const uniform = 1 / n;
      return probabilities.map((prob) => (1 - p) * prob + p * uniform);
    }
    case 'amplitude_damping': {
      // Simplified: bias toward |0⟩ state
      const result = [...probabilities];
      for (let i = 1; i < n; i++) {
        const leaked = result[i]! * p;
        result[0] = result[0]! + leaked;
        result[i] = result[i]! - leaked;
      }
      return result;
    }
    case 'phase_damping': {
      // Simplified: reduce off-diagonal coherence → probabilities stay similar but noisier
      const noise_factor = 1 - p * 0.5;
      return probabilities.map((prob) => {
        const deviation = prob - 1 / n;
        return 1 / n + deviation * noise_factor;
      });
    }
    default:
      return probabilities;
  }
}

// ─── Circuit Visualization ───────────────────────────────────────────────────

export function circuitToAscii(circuit: QuantumCircuit): string {
  const lines: string[][] = Array.from({ length: circuit.numQubits }, (_, i) => [`q${i}: `]);
  const widths = lines.map((l) => l[0]!.length);

  for (const inst of circuit.instructions) {
    // Pad all lines to same width
    const maxWidth = Math.max(...widths);
    for (let q = 0; q < circuit.numQubits; q++) {
      while (widths[q]! < maxWidth) {
        lines[q]!.push('─');
        widths[q] = widths[q]! + 1;
      }
    }

    if (inst.gate.qubits === 1) {
      const target = inst.qubits[0]!;
      const label = `[${inst.gate.id}]`;
      lines[target]!.push(label);
      widths[target] = widths[target]! + label.length;
      for (let q = 0; q < circuit.numQubits; q++) {
        if (q !== target) {
          lines[q]!.push('───');
          widths[q] = widths[q]! + 3;
        }
      }
    } else if (inst.gate.qubits === 2) {
      const [q0, q1] = inst.qubits as [number, number];
      const label0 = inst.gate.id === 'CNOT' ? '●' : `[${inst.gate.id}]`;
      const label1 = inst.gate.id === 'CNOT' ? '⊕' : `[${inst.gate.id}]`;
      lines[q0]!.push(label0);
      lines[q1]!.push(label1);
      widths[q0] = widths[q0]! + label0.length;
      widths[q1] = widths[q1]! + label1.length;
      for (let q = 0; q < circuit.numQubits; q++) {
        if (q !== q0 && q !== q1) {
          const minQ = Math.min(q0, q1);
          const maxQ = Math.max(q0, q1);
          if (q > minQ && q < maxQ) {
            lines[q]!.push(' │ ');
            widths[q] = widths[q]! + 3;
          } else {
            lines[q]!.push('───');
            widths[q] = widths[q]! + 3;
          }
        }
      }
    }
  }

  return lines.map((l) => l.join('')).join('\n');
}

// ─── Quantum Volume ──────────────────────────────────────────────────────────

export interface QuantumVolumeProfile {
  qubits: number;
  maxDepth: number;
  gateErrorRate: number;
  estimatedQuantumVolume: number;
}

export function estimateQuantumVolume(qubits: number, gateErrorRate: number): QuantumVolumeProfile {
  // Simplified QV estimate: QV ≈ 2^(effective_qubits) where effective = qubits * (1 - error_rate)^depth
  const maxDepth = Math.floor(qubits * 2);
  const successProb = Math.pow(1 - gateErrorRate, maxDepth);
  const effectiveQubits = Math.floor(qubits * successProb);
  const estimatedQV = Math.pow(2, Math.max(1, effectiveQubits));

  return {
    qubits,
    maxDepth,
    gateErrorRate,
    estimatedQuantumVolume: estimatedQV,
  };
}
