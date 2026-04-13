// ---------------------------------------------------------------------------
// Job Manager
// ---------------------------------------------------------------------------
// Manages distributed compute jobs: creation, decomposition into work
// units, progress tracking, result aggregation, and lifecycle management.
// Supports MapReduce, Pipeline, ScatterGather, and LayerSplit strategies.
// ---------------------------------------------------------------------------

import {
  createWorkUnit,
  type WorkUnit,
  type DecompositionStrategy,
  type ResourceRequirements,
} from '../scheduler/index.js';

/* ------------------------------------------------------------------ types */

export type JobStatus = 'pending' | 'decomposing' | 'scheduling' | 'running' | 'aggregating' | 'completed' | 'failed' | 'cancelled';

export type SensitivityLevel = 'public' | 'internal' | 'confidential';

export interface MeshJob {
  id: string;
  name: string;
  description: string;
  strategy: DecompositionStrategy;
  status: JobStatus;
  priority: number;
  sensitivityLevel: SensitivityLevel;
  federationAllowed: boolean;
  workUnits: WorkUnit[];
  resourceReqs: Partial<ResourceRequirements>;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  totalComputeMs: number;
  aggregatedResult: Record<string, unknown> | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
}

export interface DecompositionConfig {
  strategy: DecompositionStrategy;
  chunkCount?: number;           // for map_reduce / scatter_gather
  stageCount?: number;           // for pipeline
  layerCount?: number;           // for layer_split
  payloads: Record<string, unknown>[];
  resourceReqs?: Partial<ResourceRequirements>;
  priority?: number;
}

export interface JobProgress {
  jobId: string;
  total: number;
  pending: number;
  assigned: number;
  running: number;
  completed: number;
  failed: number;
  progressPct: number;
  estimatedRemainingMs: number | null;
}

/* ----------------------------------------------------------------- class */

let jobCounter = 0;

export class JobManager {
  private jobs = new Map<string, MeshJob>();

  createJob(
    name: string,
    description: string,
    decomp: DecompositionConfig,
    sensitivityLevel: SensitivityLevel = 'internal',
    federationAllowed: boolean = false,
  ): MeshJob {
    const jobId = `job-${++jobCounter}`;
    const workUnits = this.decompose(jobId, decomp);

    const job: MeshJob = {
      id: jobId,
      name,
      description,
      strategy: decomp.strategy,
      status: 'pending',
      priority: decomp.priority ?? 5,
      sensitivityLevel,
      federationAllowed,
      workUnits,
      resourceReqs: decomp.resourceReqs ?? {},
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      totalComputeMs: 0,
      aggregatedResult: null,
      errorMessage: null,
      metadata: {},
    };

    this.jobs.set(jobId, job);
    return job;
  }

  private decompose(jobId: string, config: DecompositionConfig): WorkUnit[] {
    const { strategy, payloads, resourceReqs, priority } = config;

    switch (strategy) {
      case 'map_reduce':
      case 'scatter_gather': {
        return payloads.map((payload, i) =>
          createWorkUnit(jobId, i, { strategy, ...payload }, resourceReqs, priority),
        );
      }
      case 'pipeline': {
        return payloads.map((payload, i) =>
          createWorkUnit(jobId, i, { strategy, stage: i, ...payload }, resourceReqs, priority),
        );
      }
      case 'layer_split': {
        const layerCount = config.layerCount ?? payloads.length;
        return payloads.map((payload, i) =>
          createWorkUnit(jobId, i, {
            strategy,
            layerStart: Math.floor((i * layerCount) / payloads.length),
            layerEnd: Math.floor(((i + 1) * layerCount) / payloads.length) - 1,
            ...payload,
          }, { ...resourceReqs, requiresGpu: true }, priority),
        );
      }
      default:
        return payloads.map((payload, i) =>
          createWorkUnit(jobId, i, payload, resourceReqs, priority),
        );
    }
  }

  get(jobId: string): MeshJob | undefined {
    return this.jobs.get(jobId);
  }

  list(): MeshJob[] {
    return [...this.jobs.values()];
  }

  listByStatus(status: JobStatus): MeshJob[] {
    return this.list().filter((j) => j.status === status);
  }

  cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    job.status = 'cancelled';
    for (const u of job.workUnits) {
      if (u.status === 'pending' || u.status === 'assigned') {
        u.status = 'failed';
        u.errorMessage = 'Job cancelled';
      }
    }
    return true;
  }

  completeUnit(jobId: string, unitId: string, result: Record<string, unknown>, computeMs: number): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    const unit = job.workUnits.find((u) => u.id === unitId);
    if (!unit) return false;

    unit.status = 'completed';
    unit.result = result;
    unit.completedAt = new Date().toISOString();
    job.totalComputeMs += computeMs;

    // Check if all units done
    if (job.workUnits.every((u) => u.status === 'completed' || u.status === 'failed')) {
      job.status = 'aggregating';
      job.aggregatedResult = this.aggregate(job);
      job.status = job.workUnits.some((u) => u.status === 'failed') ? 'failed' : 'completed';
      job.completedAt = new Date().toISOString();
    }

    return true;
  }

  failUnit(jobId: string, unitId: string, error: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    const unit = job.workUnits.find((u) => u.id === unitId);
    if (!unit) return false;

    if (unit.retryCount < unit.maxRetries) {
      unit.retryCount++;
      unit.status = 'retrying';
      unit.errorMessage = error;
    } else {
      unit.status = 'failed';
      unit.errorMessage = error;
    }

    return true;
  }

  progress(jobId: string): JobProgress | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    const units = job.workUnits;
    const completed = units.filter((u) => u.status === 'completed').length;
    const failed = units.filter((u) => u.status === 'failed').length;
    const running = units.filter((u) => u.status === 'running').length;
    const assigned = units.filter((u) => u.status === 'assigned').length;
    const pending = units.filter((u) => u.status === 'pending' || u.status === 'retrying').length;
    const total = units.length;

    const done = completed + failed;
    const avgTimeMs = done > 0 ? job.totalComputeMs / done : null;
    const remaining = total - done;

    return {
      jobId,
      total,
      pending,
      assigned,
      running,
      completed,
      failed,
      progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
      estimatedRemainingMs: avgTimeMs !== null ? Math.round(remaining * avgTimeMs) : null,
    };
  }

  private aggregate(job: MeshJob): Record<string, unknown> {
    const results = job.workUnits
      .filter((u) => u.status === 'completed' && u.result)
      .map((u) => u.result!);

    return {
      strategy: job.strategy,
      unitCount: job.workUnits.length,
      completedCount: results.length,
      failedCount: job.workUnits.filter((u) => u.status === 'failed').length,
      totalComputeMs: job.totalComputeMs,
      results,
    };
  }

  stats(): { total: number; running: number; completed: number; failed: number; totalComputeMs: number } {
    const all = this.list();
    return {
      total: all.length,
      running: all.filter((j) => j.status === 'running').length,
      completed: all.filter((j) => j.status === 'completed').length,
      failed: all.filter((j) => j.status === 'failed').length,
      totalComputeMs: all.reduce((s, j) => s + j.totalComputeMs, 0),
    };
  }
}
