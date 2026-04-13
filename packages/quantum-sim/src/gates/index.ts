// ─── Complex Number Arithmetic ───────────────────────────────────────────────

export interface Complex {
  re: number;
  im: number;
}

export function complex(re: number, im = 0): Complex {
  return { re, im };
}

export function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function sub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function mul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

export function conjugate(a: Complex): Complex {
  return { re: a.re, im: -a.im };
}

export function magnitude(a: Complex): number {
  return Math.sqrt(a.re * a.re + a.im * a.im);
}

export function magnitudeSq(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

export function scale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

export function cexp(theta: number): Complex {
  return { re: Math.cos(theta), im: Math.sin(theta) };
}

export const ZERO: Complex = { re: 0, im: 0 };
export const ONE: Complex = { re: 1, im: 0 };
export const I: Complex = { re: 0, im: 1 };

// ─── Gate Matrix Type ────────────────────────────────────────────────────────

/** A gate is a square unitary matrix stored row-major. */
export interface GateMatrix {
  readonly id: string;
  readonly name: string;
  readonly qubits: number;
  readonly matrix: readonly Complex[];
  readonly dim: number; // 2^qubits
}

function gate(id: string, name: string, qubits: number, m: Complex[]): GateMatrix {
  const dim = 1 << qubits;
  if (m.length !== dim * dim) throw new Error(`Gate ${id}: expected ${dim * dim} elements, got ${m.length}`);
  return { id, name, qubits, matrix: m, dim };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const S2 = 1 / Math.sqrt(2);

// ─── Single-Qubit Gates ─────────────────────────────────────────────────────

/** Hadamard gate — creates equal superposition */
export const H = gate('H', 'Hadamard', 1, [
  complex(S2), complex(S2),
  complex(S2), complex(-S2),
]);

/** Pauli-X (NOT gate) */
export const X = gate('X', 'Pauli-X', 1, [
  ZERO, ONE,
  ONE, ZERO,
]);

/** Pauli-Y */
export const Y = gate('Y', 'Pauli-Y', 1, [
  ZERO, complex(0, -1),
  complex(0, 1), ZERO,
]);

/** Pauli-Z */
export const Z = gate('Z', 'Pauli-Z', 1, [
  ONE, ZERO,
  ZERO, complex(-1),
]);

/** Phase gate (S) */
export const S = gate('S', 'Phase', 1, [
  ONE, ZERO,
  ZERO, I,
]);

/** T gate (π/8) */
export const T = gate('T', 'T-Gate', 1, [
  ONE, ZERO,
  ZERO, cexp(Math.PI / 4),
]);

/** Identity */
export const ID = gate('I', 'Identity', 1, [
  ONE, ZERO,
  ZERO, ONE,
]);

/** Rotation around X-axis */
export function Rx(theta: number): GateMatrix {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return gate('Rx', `Rx(${theta.toFixed(3)})`, 1, [
    complex(c), complex(0, -s),
    complex(0, -s), complex(c),
  ]);
}

/** Rotation around Y-axis */
export function Ry(theta: number): GateMatrix {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return gate('Ry', `Ry(${theta.toFixed(3)})`, 1, [
    complex(c), complex(-s),
    complex(s), complex(c),
  ]);
}

/** Rotation around Z-axis */
export function Rz(theta: number): GateMatrix {
  return gate('Rz', `Rz(${theta.toFixed(3)})`, 1, [
    cexp(-theta / 2), ZERO,
    ZERO, cexp(theta / 2),
  ]);
}

// ─── Two-Qubit Gates ─────────────────────────────────────────────────────────

/** CNOT (Controlled-NOT) */
export const CNOT = gate('CNOT', 'Controlled-NOT', 2, [
  ONE, ZERO, ZERO, ZERO,
  ZERO, ONE, ZERO, ZERO,
  ZERO, ZERO, ZERO, ONE,
  ZERO, ZERO, ONE, ZERO,
]);

/** SWAP gate */
export const SWAP = gate('SWAP', 'SWAP', 2, [
  ONE, ZERO, ZERO, ZERO,
  ZERO, ZERO, ONE, ZERO,
  ZERO, ONE, ZERO, ZERO,
  ZERO, ZERO, ZERO, ONE,
]);

/** Controlled-Z (CZ) */
export const CZ = gate('CZ', 'Controlled-Z', 2, [
  ONE, ZERO, ZERO, ZERO,
  ZERO, ONE, ZERO, ZERO,
  ZERO, ZERO, ONE, ZERO,
  ZERO, ZERO, ZERO, complex(-1),
]);

// ─── Three-Qubit Gates ──────────────────────────────────────────────────────

/** Toffoli (CCNOT) — 8×8 identity with rows 6/7 swapped */
export const TOFFOLI: GateMatrix = (() => {
  const m: Complex[] = Array.from({ length: 64 }, () => ZERO);
  for (let i = 0; i < 8; i++) {
    if (i === 6) m[i * 8 + 7] = ONE;
    else if (i === 7) m[i * 8 + 6] = ONE;
    else m[i * 8 + i] = ONE;
  }
  return gate('TOFFOLI', 'Toffoli', 3, m);
})();

// ─── Gate Registry ───────────────────────────────────────────────────────────

const STANDARD_GATES: ReadonlyMap<string, GateMatrix> = new Map([
  ['H', H], ['X', X], ['Y', Y], ['Z', Z],
  ['S', S], ['T', T], ['I', ID],
  ['CNOT', CNOT], ['CX', CNOT],
  ['SWAP', SWAP], ['CZ', CZ],
  ['TOFFOLI', TOFFOLI], ['CCX', TOFFOLI],
]);

export function getStandardGate(id: string): GateMatrix | undefined {
  return STANDARD_GATES.get(id.toUpperCase());
}

export function listStandardGates(): Array<{ id: string; name: string; qubits: number }> {
  const seen = new Set<string>();
  const result: Array<{ id: string; name: string; qubits: number }> = [];
  for (const [, g] of STANDARD_GATES) {
    if (!seen.has(g.id)) {
      seen.add(g.id);
      result.push({ id: g.id, name: g.name, qubits: g.qubits });
    }
  }
  return result;
}

// ─── Matrix Utilities ────────────────────────────────────────────────────────

/** Kronecker (tensor) product of two gate matrices */
export function tensorProduct(a: GateMatrix, b: GateMatrix): GateMatrix {
  const dimA = a.dim;
  const dimB = b.dim;
  const dim = dimA * dimB;
  const m: Complex[] = new Array(dim * dim);

  for (let ra = 0; ra < dimA; ra++) {
    for (let ca = 0; ca < dimA; ca++) {
      for (let rb = 0; rb < dimB; rb++) {
        for (let cb = 0; cb < dimB; cb++) {
          const row = ra * dimB + rb;
          const col = ca * dimB + cb;
          m[row * dim + col] = mul(a.matrix[ra * dimA + ca]!, b.matrix[rb * dimB + cb]!);
        }
      }
    }
  }

  return gate(`${a.id}⊗${b.id}`, `${a.name}⊗${b.name}`, a.qubits + b.qubits, m);
}

/** Apply gate matrix to a state vector */
export function applyGateToState(g: GateMatrix, state: Complex[]): Complex[] {
  const dim = g.dim;
  if (state.length !== dim) throw new Error(`State dimension ${state.length} does not match gate dimension ${dim}`);
  const result: Complex[] = new Array(dim);
  for (let i = 0; i < dim; i++) {
    let sum = ZERO;
    for (let j = 0; j < dim; j++) {
      sum = add(sum, mul(g.matrix[i * dim + j]!, state[j]!));
    }
    result[i] = sum;
  }
  return result;
}

/** Check if a gate matrix is unitary (U†U = I), within tolerance */
export function isUnitary(g: GateMatrix, tolerance = 1e-10): boolean {
  const dim = g.dim;
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      let sum = ZERO;
      for (let k = 0; k < dim; k++) {
        sum = add(sum, mul(conjugate(g.matrix[k * dim + i]!), g.matrix[k * dim + j]!));
      }
      const expected = i === j ? 1 : 0;
      if (Math.abs(sum.re - expected) > tolerance || Math.abs(sum.im) > tolerance) {
        return false;
      }
    }
  }
  return true;
}
