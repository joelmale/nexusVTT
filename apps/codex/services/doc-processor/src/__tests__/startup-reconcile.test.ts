import { describe, expect, it, vi } from 'vitest';
import { buildReconcileMetadata, MAX_RECONCILE_ATTEMPTS, reconcileDocuments, type ReconcileDocument } from '../startup-reconcile';

const doc = (id: string, ocrStatus: string, processing: Record<string, unknown> = {}): ReconcileDocument => ({
  id,
  title: id,
  ocrStatus,
  metadata: { processing },
});

const run = async (docs: ReconcileDocument[], live: string[] = []) => {
  const updateMetadata = vi.fn().mockResolvedValue(undefined);
  const enqueueIngest = vi.fn().mockResolvedValue('job');
  const result = await reconcileDocuments({
    findDocuments: async () => docs,
    getLiveJobDocumentIds: async () => new Set(live),
    updateMetadata,
    enqueueIngest,
  });
  return { result, updateMetadata, enqueueIngest };
};

describe('reconcileDocuments', () => {
  it('re-queues failed and pending documents without a live job', async () => {
    const { result, enqueueIngest } = await run([doc('a', 'failed'), doc('b', 'pending'), doc('c', 'completed')]);
    expect(result.requeued).toEqual(['a', 'b']);
    expect(enqueueIngest).toHaveBeenCalledTimes(2);
  });

  it('skips documents that already have a waiting/active/delayed job', async () => {
    const { result, enqueueIngest, updateMetadata } = await run([doc('a', 'pending')], ['a']);
    expect(result.skippedLive).toEqual(['a']);
    expect(enqueueIngest).not.toHaveBeenCalled();
    expect(updateMetadata).not.toHaveBeenCalled();
  });

  it('stops after the retry budget is spent', async () => {
    const { result, enqueueIngest } = await run([doc('a', 'failed', { reconcileAttempts: MAX_RECONCILE_ATTEMPTS })]);
    expect(result.exhausted).toEqual(['a']);
    expect(enqueueIngest).not.toHaveBeenCalled();
  });
});

describe('buildReconcileMetadata', () => {
  it('keeps completed stages and the content hash, drops failed ones', () => {
    const out: any = buildReconcileMetadata({
      processing: {
        checkpoints: {
          contentHash: 'h',
          stages: {
            ingest: { completedAt: 't' },
            layout: { completedAt: 't', batches: { '1-5': { completedAt: 't', pages: 5 } } },
            extract: { error: 'boom' },
          },
        },
      },
    });
    expect(out.processing.checkpoints.contentHash).toBe('h');
    expect(Object.keys(out.processing.checkpoints.stages)).toEqual(['ingest', 'layout']);
    expect(out.processing.checkpoints.stages.layout.batches['1-5']).toBeDefined();
    expect(out.processing.reconcileAttempts).toBe(1);
  });

  it('re-runs from OCR for documents whose OCR failure was swallowed', () => {
    const out: any = buildReconcileMetadata({
      processing: {
        ocr: { status: 'failed', reason: 'x' },
        checkpoints: {
          stages: {
            ingest: { completedAt: 't' },
            render: { completedAt: 't' },
            ocr: { completedAt: 't' },
            index: { completedAt: 't' },
          },
        },
      },
    });
    expect(Object.keys(out.processing.checkpoints.stages)).toEqual(['ingest']);
    expect(out.processing.ocr.status).toBeUndefined();
  });

  it('increments the attempt counter', () => {
    const out: any = buildReconcileMetadata({ processing: { reconcileAttempts: 1 } });
    expect(out.processing.reconcileAttempts).toBe(2);
  });
});
