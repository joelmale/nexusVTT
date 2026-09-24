import crypto from 'crypto';

/**
 * In-process job runner for long admin operations (manifest rebuild,
 * integrity report). One job per type runs at a time: starting a type that
 * is already running returns the running job instead of queueing another.
 * Job history is in memory only; the latest integrity report is also cached
 * by the service and survives until the next run.
 */

export type JobType = 'manifest-rebuild' | 'integrity-report';
export type JobStatus = 'running' | 'succeeded' | 'failed';

export interface JobRecord {
  id: string;
  type: JobType;
  status: JobStatus;
  actor: string;
  requestId: string | null;
  startedAt: string;
  finishedAt: string | null;
  result: unknown;
  error: { code: string; message: string } | null;
}

const MAX_JOB_HISTORY = 50;

export class JobRunner {
  private readonly jobs = new Map<string, JobRecord>();
  private readonly running = new Map<JobType, { job: JobRecord; done: Promise<void> }>();

  start(
    type: JobType,
    context: { actor: string; requestId: string | null },
    task: (job: JobRecord) => Promise<unknown>,
  ): { job: JobRecord; alreadyRunning: boolean; done: Promise<void> } {
    const existing = this.running.get(type);
    if (existing) return { job: existing.job, alreadyRunning: true, done: existing.done };

    const job: JobRecord = {
      id: `job-${crypto.randomUUID()}`,
      type,
      status: 'running',
      actor: context.actor,
      requestId: context.requestId,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      result: null,
      error: null,
    };
    this.jobs.set(job.id, job);
    this.trim();

    const done = (async () => {
      try {
        job.result = await task(job);
        job.status = 'succeeded';
      } catch (error) {
        job.status = 'failed';
        const code =
          typeof (error as { code?: unknown })?.code === 'string'
            ? (error as { code: string }).code
            : 'job-failed';
        // Never surface raw error text: filesystem errors embed absolute paths.
        job.error = { code, message: `${type} job failed` };
        console.error(
          JSON.stringify({ event: 'asset-admin-job-failed', jobId: job.id, type, code }),
        );
      } finally {
        job.finishedAt = new Date().toISOString();
        this.running.delete(type);
      }
    })();

    this.running.set(type, { job, done });
    return { job, alreadyRunning: false, done };
  }

  get(id: string): JobRecord | undefined {
    return this.jobs.get(id);
  }

  list(): JobRecord[] {
    return [...this.jobs.values()].reverse();
  }

  private trim(): void {
    while (this.jobs.size > MAX_JOB_HISTORY) {
      const oldest = [...this.jobs.values()].find((job) => job.status !== 'running');
      if (!oldest) return;
      this.jobs.delete(oldest.id);
    }
  }
}
