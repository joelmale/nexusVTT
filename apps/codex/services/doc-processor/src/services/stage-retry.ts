import type { JobsOptions } from 'bullmq';

// Plain string rather than ProcessDocumentJob['stage']: queue.service imports
// this module, and a type import back would be a cycle.
type Stage = string | undefined;

// Stages that call the GPU in ocr-service (Marker layout, VLM extraction).
// A busy or out-of-memory GPU does not recover within the queue default's
// 2s/4s backoff, so all attempts used to burn out together and leave the
// document failed. Retry these over ~3.5 minutes instead (30s, 60s, 120s).
// Layout checkpoints each page batch, so a retry resumes rather than restarts.
export const GPU_STAGES: ReadonlySet<Stage> = new Set(['layout', 'extract']);

export const GPU_STAGE_JOB_OPTIONS: JobsOptions = {
  attempts: 4,
  backoff: { type: 'exponential', delay: 30_000 },
};

/** Per-stage overrides of the queue's defaultJobOptions; undefined keeps the defaults. */
export function stageJobOptions(stage: Stage): JobsOptions | undefined {
  return GPU_STAGES.has(stage) ? GPU_STAGE_JOB_OPTIONS : undefined;
}

/**
 * HTTP statuses a retry cannot fix: the request itself is wrong. 408 and 429
 * are client-class but transient, so they keep retrying like 5xx.
 */
export function isPermanentHttpStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}
