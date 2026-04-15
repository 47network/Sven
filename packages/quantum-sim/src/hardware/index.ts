import type { QuantumCircuit, SimulationResult, MeasurementResult } from '../simulator/index.js';

// ─── Backend Interface ───────────────────────────────────────────────────────

export type BackendType = 'simulator' | 'ibm_quantum' | 'aws_braket' | 'origin_quantum';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface QuantumBackend {
  readonly id: string;
  readonly name: string;
  readonly type: BackendType;
  readonly maxQubits: number;
  readonly gateErrorRate: number;
  readonly isAvailable: boolean;
  submit(circuit: QuantumCircuit, shots: number): Promise<QuantumJob>;
  getJob(jobId: string): Promise<QuantumJob | undefined>;
  cancel(jobId: string): Promise<boolean>;
}

export interface QuantumJob {
  id: string;
  backendId: string;
  status: JobStatus;
  circuit: QuantumCircuit;
  shots: number;
  result: SimulationResult | null;
  measurements: MeasurementResult[];
  submittedAt: Date;
  completedAt: Date | null;
  estimatedCost: CostEstimate | null;
  error: string | null;
}

// ─── Cost Estimation ─────────────────────────────────────────────────────────

export interface CostEstimate {
  backendId: string;
  shots: number;
  gateCount: number;
  qubitCount: number;
  estimatedUsd: number;
  estimatedSeconds: number;
}

export interface BackendPricing {
  perShot: number;
  perGate: number;
  perQubit: number;
  minimumCharge: number;
}

const PRICING: Record<BackendType, BackendPricing> = {
  simulator: { perShot: 0, perGate: 0, perQubit: 0, minimumCharge: 0 },
  ibm_quantum: { perShot: 0.00003, perGate: 0.00001, perQubit: 0.001, minimumCharge: 0.01 },
  aws_braket: { perShot: 0.00045, perGate: 0.00002, perQubit: 0.003, minimumCharge: 0.30 },
  origin_quantum: { perShot: 0.00005, perGate: 0.00001, perQubit: 0.002, minimumCharge: 0.05 },
};

export function estimateCost(
  backendType: BackendType,
  qubitCount: number,
  gateCount: number,
  shots: number,
): CostEstimate {
  const pricing = PRICING[backendType];
  const cost = Math.max(
    pricing.minimumCharge,
    shots * pricing.perShot + gateCount * pricing.perGate + qubitCount * pricing.perQubit,
  );

  // Rough time estimate
  const secondsPerShot = backendType === 'simulator' ? 0.001 : 0.01;
  const estimatedSeconds = shots * secondsPerShot + gateCount * 0.0001;

  return {
    backendId: backendType,
    shots,
    gateCount,
    qubitCount,
    estimatedUsd: Math.round(cost * 10000) / 10000,
    estimatedSeconds: Math.round(estimatedSeconds * 100) / 100,
  };
}

// ─── Job Queue ───────────────────────────────────────────────────────────────

export class JobQueue {
  private jobs: Map<string, QuantumJob> = new Map();
  private counter = 0;

  createJob(backendId: string, circuit: QuantumCircuit, shots: number): QuantumJob {
    const id = `qjob-${++this.counter}-${Date.now()}`;
    const job: QuantumJob = {
      id,
      backendId,
      status: 'queued',
      circuit,
      shots,
      result: null,
      measurements: [],
      submittedAt: new Date(),
      completedAt: null,
      estimatedCost: null,
      error: null,
    };
    this.jobs.set(id, job);
    return job;
  }

  getJob(jobId: string): QuantumJob | undefined {
    return this.jobs.get(jobId);
  }

  updateJob(jobId: string, update: Partial<QuantumJob>): QuantumJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    const updated = { ...job, ...update };
    this.jobs.set(jobId, updated);
    return updated;
  }

  listJobs(status?: JobStatus): QuantumJob[] {
    const all = Array.from(this.jobs.values());
    return status ? all.filter((j) => j.status === status) : all;
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') return false;
    this.jobs.set(jobId, { ...job, status: 'cancelled' });
    return true;
  }

  clear(): void {
    this.jobs.clear();
    this.counter = 0;
  }
}

// ─── Result Cache ────────────────────────────────────────────────────────────

interface CacheKey {
  circuitHash: string;
  shots: number;
  backendId: string;
}

function hashCircuit(circuit: QuantumCircuit): string {
  const parts = circuit.instructions.map(
    (inst) => `${inst.gate.id}[${inst.qubits.join(',')}]`,
  );
  return `q${circuit.numQubits}:${parts.join('|')}`;
}

export class ResultCache {
  private cache: Map<string, { result: SimulationResult; cachedAt: Date }> = new Map();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  private buildKey(key: CacheKey): string {
    return `${key.backendId}:${key.circuitHash}:${key.shots}`;
  }

  get(circuit: QuantumCircuit, shots: number, backendId: string): SimulationResult | undefined {
    const key = this.buildKey({ circuitHash: hashCircuit(circuit), shots, backendId });
    return this.cache.get(key)?.result;
  }

  set(circuit: QuantumCircuit, shots: number, backendId: string, result: SimulationResult): void {
    if (this.cache.size >= this.maxSize) {
      // Evict oldest entry
      const first = this.cache.keys().next().value;
      if (first !== undefined) this.cache.delete(first);
    }
    const key = this.buildKey({ circuitHash: hashCircuit(circuit), shots, backendId });
    this.cache.set(key, { result, cachedAt: new Date() });
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

// ─── Backend Registry ────────────────────────────────────────────────────────

export interface BackendProfile {
  id: string;
  name: string;
  type: BackendType;
  maxQubits: number;
  gateErrorRate: number;
  isAvailable: boolean;
  region: string;
  provider: string;
}

const BACKEND_PROFILES: BackendProfile[] = [
  {
    id: 'local-sim',
    name: 'Sven Local Simulator',
    type: 'simulator',
    maxQubits: 25,
    gateErrorRate: 0,
    isAvailable: true,
    region: 'local',
    provider: '47network',
  },
  {
    id: 'ibm-brisbane',
    name: 'IBM Brisbane (127 qubits)',
    type: 'ibm_quantum',
    maxQubits: 127,
    gateErrorRate: 0.005,
    isAvailable: false,
    region: 'us-east',
    provider: 'IBM',
  },
  {
    id: 'aws-sv1',
    name: 'AWS Braket SV1',
    type: 'aws_braket',
    maxQubits: 34,
    gateErrorRate: 0,
    isAvailable: false,
    region: 'us-east-1',
    provider: 'Amazon',
  },
  {
    id: 'origin-wuyuan',
    name: 'Origin Wuyuan (24 qubits)',
    type: 'origin_quantum',
    maxQubits: 24,
    gateErrorRate: 0.01,
    isAvailable: false,
    region: 'cn-east',
    provider: 'Origin Quantum',
  },
];

export function listBackends(): BackendProfile[] {
  return [...BACKEND_PROFILES];
}

export function getBackend(id: string): BackendProfile | undefined {
  return BACKEND_PROFILES.find((b) => b.id === id);
}

export function listAvailableBackends(): BackendProfile[] {
  return BACKEND_PROFILES.filter((b) => b.isAvailable);
}
