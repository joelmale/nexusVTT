import { describe, expect, it } from 'vitest';
import { GPU_STAGE_JOB_OPTIONS, isPermanentHttpStatus, stageJobOptions } from '../stage-retry';

describe('stageJobOptions', () => {
  it('gives GPU stages a long backoff with an extra attempt', () => {
    expect(stageJobOptions('layout')).toBe(GPU_STAGE_JOB_OPTIONS);
    expect(stageJobOptions('extract')).toBe(GPU_STAGE_JOB_OPTIONS);
    expect(GPU_STAGE_JOB_OPTIONS).toEqual({ attempts: 4, backoff: { type: 'exponential', delay: 30_000 } });
  });

  it('leaves other stages on the queue defaults', () => {
    for (const stage of ['ingest', 'render', 'ocr', 'index', 'assets', undefined]) {
      expect(stageJobOptions(stage)).toBeUndefined();
    }
  });
});

describe('isPermanentHttpStatus', () => {
  it('treats 4xx as permanent except timeout and rate limit', () => {
    expect([400, 404, 422].map(isPermanentHttpStatus)).toEqual([true, true, true]);
    expect([408, 429].map(isPermanentHttpStatus)).toEqual([false, false]);
  });

  it('keeps 5xx retryable', () => {
    expect([500, 502, 503].map(isPermanentHttpStatus)).toEqual([false, false, false]);
  });
});
