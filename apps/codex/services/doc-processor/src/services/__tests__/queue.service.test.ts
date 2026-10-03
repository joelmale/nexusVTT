import { describe, it, expect, vi } from 'vitest';

const mockWorkerInstances: any[] = [];

vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(function () {
      return {
        add: vi.fn(),
        close: vi.fn(),
      };
    }),
    Worker: vi.fn().mockImplementation(function (name, processor, opts) {
      const instance = { name, processor, opts };
      mockWorkerInstances.push(instance);
      return instance;
    }),
  };
});

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        disconnect: vi.fn(),
      };
    }),
  };
});

import { createWorker, createAssetWorker } from '../queue.service';
import { env } from '../../config/env';

describe('queue.service concurrency configuration', () => {
  it('defaults WORKER_CONCURRENCY to 1 for sequential document processing', () => {
    expect(env.WORKER_CONCURRENCY).toBe(1);
  });

  it('creates main worker with WORKER_CONCURRENCY = 1', () => {
    const dummyProcessor = vi.fn();
    const worker = createWorker(dummyProcessor as any) as any;

    expect(worker.opts.concurrency).toBe(1);
    expect(worker.name).toBe(env.QUEUE_NAME);
  });

  it('creates asset worker with ASSET_WORKER_CONCURRENCY = 1', () => {
    const dummyProcessor = vi.fn();
    const worker = createAssetWorker(dummyProcessor as any) as any;

    expect(worker.opts.concurrency).toBe(1);
    expect(worker.name).toBe(env.ASSET_QUEUE_NAME);
  });
});
