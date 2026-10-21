import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock BullMQ Queue before importing queue.service
const { mockQueue } = vi.hoisted(() => ({
  mockQueue: {
    clean: vi.fn().mockResolvedValue(['job-1', 'job-2']),
    getJob: vi.fn(),
    getJobs: vi.fn(),
    getWaiting: vi.fn().mockResolvedValue([]),
    getActive: vi.fn().mockResolvedValue([]),
    getCompleted: vi.fn().mockResolvedValue([]),
    getFailed: vi.fn().mockResolvedValue([]),
    getDelayed: vi.fn().mockResolvedValue([]),
    getJobCounts: vi.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }),
    add: vi.fn(),
    close: vi.fn(),
  },
}));

vi.mock('bullmq', () => {
  return {
    Queue: vi.fn(function () {
      return mockQueue;
    }),
  };
});

vi.mock('ioredis', () => {
  return {
    default: vi.fn(function () {
      return {
        disconnect: vi.fn(),
        on: vi.fn(),
      };
    }),
  };
});

import { cleanOldJobs, getJobStatus, getJobs } from '../queue.service';

describe('queue.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanOldJobs', () => {
    it('passes grace period in milliseconds to BullMQ clean, not an absolute timestamp', async () => {
      const result = await cleanOldJobs(2);

      expect(mockQueue.clean).toHaveBeenCalledTimes(2);

      const expectedGraceMs = 2 * 24 * 60 * 60 * 1000; // 172,800,000 ms
      expect(mockQueue.clean).toHaveBeenNthCalledWith(1, expectedGraceMs, 1000, 'completed');
      expect(mockQueue.clean).toHaveBeenNthCalledWith(2, expectedGraceMs, 1000, 'failed');

      expect(result.completedRemoved).toBe(2);
      expect(result.failedRemoved).toBe(2);
      expect(result.message).toContain('Cleaned 2 completed and 2 failed jobs older than 2 days');
    });
  });

  describe('job progress normalization', () => {
    it('reports progress as 100 when job state is completed even if job.progress is 0', async () => {
      mockQueue.getJob.mockResolvedValueOnce({
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('completed'),
        progress: 0,
        failedReason: undefined,
        finishedOn: 1234567,
        processedOn: 1234000,
      });

      const status = await getJobStatus('job-123');
      expect(status?.state).toBe('completed');
      expect(status?.progress).toBe(100);
    });

    it('preserves existing numeric progress when job state is active', async () => {
      mockQueue.getJob.mockResolvedValueOnce({
        id: 'job-456',
        getState: vi.fn().mockResolvedValue('active'),
        progress: 45,
        failedReason: undefined,
        finishedOn: undefined,
        processedOn: 1234000,
      });

      const status = await getJobStatus('job-456');
      expect(status?.state).toBe('active');
      expect(status?.progress).toBe(45);
    });

    it('normalizes progress in getJobs list for completed jobs', async () => {
      mockQueue.getCompleted.mockResolvedValueOnce([
        {
          id: 'job-comp-1',
          name: 'process-extract',
          data: { documentId: 'doc-1', stage: 'extract' },
          getState: vi.fn().mockResolvedValue('completed'),
          progress: 0,
          attemptsMade: 1,
          opts: { attempts: 3 },
          timestamp: 1000,
          processedOn: 1100,
          finishedOn: 1200,
          failedReason: null,
        },
      ]);

      const jobs = await getJobs({ status: 'completed' });
      expect(jobs).toHaveLength(1);
      expect(jobs[0].status).toBe('completed');
      expect(jobs[0].progress).toBe(100);
    });
  });
});
