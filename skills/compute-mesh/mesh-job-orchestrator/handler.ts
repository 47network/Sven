import { JobManager, type SensitivityLevel, type DecompositionConfig, type JobStatus } from '@sven/compute-mesh/job-manager';
import type { DecompositionStrategy } from '@sven/compute-mesh/scheduler';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const manager = new JobManager();

  switch (action) {
    case 'create_job': {
      const name = (input.name as string) ?? 'Untitled Job';
      const description = (input.description as string) ?? '';
      const strategy = (input.strategy as DecompositionStrategy) ?? 'scatter_gather';
      const payloads = (input.payloads as Record<string, unknown>[]) ?? [{}];
      const priority = (input.priority as number) ?? 5;
      const sensitivity = (input.sensitivity as SensitivityLevel) ?? 'internal';

      const config: DecompositionConfig = { strategy, payloads, priority };
      const job = manager.createJob(name, description, config, sensitivity);
      return {
        result: {
          jobId: job.id,
          name: job.name,
          strategy: job.strategy,
          status: job.status,
          workUnits: job.workUnits.length,
          priority: job.priority,
        },
      };
    }

    case 'get_job': {
      const jobId = input.job_id as string;
      if (!jobId) return { error: 'job_id is required' };
      const job = manager.get(jobId);
      if (!job) return { error: `Job "${jobId}" not found` };
      return { result: job };
    }

    case 'list_jobs': {
      const jobs = manager.list().map((j) => ({
        id: j.id, name: j.name, strategy: j.strategy,
        status: j.status, workUnits: j.workUnits.length,
        priority: j.priority,
      }));
      return { result: { count: jobs.length, jobs } };
    }

    case 'cancel': {
      const jobId = input.job_id as string;
      if (!jobId) return { error: 'job_id is required' };
      const ok = manager.cancel(jobId);
      return ok ? { result: { cancelled: jobId } } : { error: `Job "${jobId}" not found` };
    }

    case 'progress': {
      const jobId = input.job_id as string;
      if (!jobId) return { error: 'job_id is required' };
      const prog = manager.progress(jobId);
      return prog ? { result: prog } : { error: `Job "${jobId}" not found` };
    }

    case 'complete_unit': {
      const jobId = input.job_id as string;
      const unitId = input.unit_id as string;
      const result = (input.result as Record<string, unknown>) ?? {};
      if (!jobId || !unitId) return { error: 'job_id and unit_id are required' };
      const ok = manager.completeUnit(jobId, unitId, result, Date.now());
      return ok ? { result: { completed: unitId } } : { error: 'Job or unit not found' };
    }

    case 'fail_unit': {
      const jobId = input.job_id as string;
      const unitId = input.unit_id as string;
      const error = (input.error as string) ?? 'Unknown error';
      if (!jobId || !unitId) return { error: 'job_id and unit_id are required' };
      const ok = manager.failUnit(jobId, unitId, error);
      return ok ? { result: { failed: unitId, retrying: true } } : { error: 'Job or unit not found' };
    }

    case 'stats': {
      return { result: manager.stats() };
    }

    default:
      return { error: `Unknown action "${action}". Use: create_job, get_job, list_jobs, cancel, progress, complete_unit, fail_unit, stats` };
  }
}
