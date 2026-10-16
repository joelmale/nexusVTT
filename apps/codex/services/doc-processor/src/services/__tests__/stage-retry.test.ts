import { describe, expect, it } from 'vitest';
import { GPU_STAGE_JOB_OPTIONS, isFinalAttempt, isPermanentHttpStatus, stageJobOptions } from '../stage-retry';

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

describe('isFinalAttempt', () => {
  it('is false while attempts remain', () => {
    expect(isFinalAttempt({ attemptsMade: 0, opts: { attempts: 3 } }, new Error('x'))).toBe(false);
    expect(isFinalAttempt({ attemptsMade: 1, opts: { attempts: 3 } }, new Error('x'))).toBe(false);
  });

  it('is true on the last attempt', () => {
    expect(isFinalAttempt({ attemptsMade: 2, opts: { attempts: 3 } }, new Error('x'))).toBe(true);
  });

  it('treats a job with no attempts option as a single attempt', () => {
    expect(isFinalAttempt({ attemptsMade: 0 }, new Error('x'))).toBe(true);
  });

  it('is final for an UnrecoverableError whatever the budget', () => {
    const err = Object.assign(new Error('x'), { name: 'UnrecoverableError' });
    expect(isFinalAttempt({ attemptsMade: 0, opts: { attempts: 3 } }, err)).toBe(true);
  });

  it('counts attemptsMade as already incremented in the worker failed event', () => {
    expect(isFinalAttempt({ attemptsMade: 2, opts: { attempts: 3 } }, new Error('x'), true)).toBe(false);
    expect(isFinalAttempt({ attemptsMade: 3, opts: { attempts: 3 } }, new Error('x'), true)).toBe(true);
  });
});
