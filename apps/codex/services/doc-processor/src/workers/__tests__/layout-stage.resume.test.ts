import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Resumability of the v2 layout stage, driven through processDocumentWorker
 * with an in-memory database. A "kill" is an exception thrown mid-batch: the
 * worker's own error handler runs, then a second job resumes the stage.
 */

const db = vi.hoisted(() => {
  const state = {
    document: null as any,
    pages: new Map<number, any>(),
    texts: new Map<string, string>(),
    events: [] as any[],
    upsertCalls: 0,
    failDocumentUpdateOnce: null as null | ((data: any) => boolean),
  };
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

  const prisma = {
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    document: {
      findUnique: async () => (state.document ? clone(state.document) : null),
      update: async ({ data }: any) => {
        if (state.failDocumentUpdateOnce?.(data)) {
          state.failDocumentUpdateOnce = null;
          throw new Error('worker killed before checkpoint');
        }
        state.document = { ...state.document, ...clone(data) };
        return clone(state.document);
      },
    },
    documentPage: {
      upsert: async ({ where, create, update }: any) => {
        state.upsertCalls += 1;
        const pageNumber = where.documentId_pageNumber.pageNumber;
        const existing = state.pages.get(pageNumber);
        state.pages.set(pageNumber, existing ? { ...existing, ...update } : { ...create });
        return state.pages.get(pageNumber);
      },
      deleteMany: async ({ where }: any) => {
        for (const n of [...state.pages.keys()]) if (n > where.pageNumber.gt) state.pages.delete(n);
        return { count: 0 };
      },
      findMany: async () => [...state.pages.values()].sort((a, b) => a.pageNumber - b.pageNumber),
    },
    documentText: {
      upsert: async ({ where, create }: any) => {
        state.texts.set(where.documentId_source.source, create.content);
      },
    },
    processingEvent: {
      createMany: async ({ data }: any) => {
        state.events.push(...data);
      },
    },
  };
  return { state, prisma };
});

const layoutCalls = vi.hoisted(() => ({ ranges: [] as string[], failOn: null as null | string }));

vi.mock('../../services/database.service', () => ({ prisma: db.prisma }));
vi.mock('../../services/queue.service', () => ({ enqueueStage: vi.fn(), enqueueAssetStage: vi.fn() }));
vi.mock('../../services/logging.service', () => ({
  loggingService: { logInfo: vi.fn(async () => {}), logWarn: vi.fn(async () => {}), logError: vi.fn(async () => {}) },
}));
vi.mock('../../services/s3.service', () => ({ s3Service: { downloadFile: vi.fn(async () => Buffer.from('%PDF')) } }));
vi.mock('../../services/pdf.service', () => ({ pdfService: { getPageCount: vi.fn(async () => 7) } }));
vi.mock('../../services/elastic.service', () => ({ elasticService: {} }));
vi.mock('../../services/thumbnail.service', () => ({ thumbnailService: {} }));
vi.mock('../../services/page-image.service', () => ({ pageImageService: {} }));
vi.mock('../../services/ocr.service', () => ({ ocrService: {} }));
vi.mock('../../services/layout.service', () => ({ layoutService: {} }));
vi.mock('../../utils/canvas', () => ({ canvasBackend: 'test' }));
vi.mock('../../services/ocr-health.service', () => ({
  ocrHealthService: { check: vi.fn(async () => ({ status: 'ok' })) },
}));
vi.mock('../../services/layout-client.service', () => ({
  layoutClientService: {
    convertRange: vi.fn(async ({ pageStart, pageEnd }: { pageStart: number; pageEnd: number }) => {
      const key = `${pageStart}-${pageEnd}`;
      layoutCalls.ranges.push(key);
      if (layoutCalls.failOn === key) {
        layoutCalls.failOn = null;
        throw new Error('worker killed during layout call');
      }
      const pages = [];
      for (let n = pageStart; n <= pageEnd; n += 1) {
        pages.push({ pageNumber: n, markdown: `Page ${n} text`, blocks: [], quality: { wordValidity: 0.9 } });
      }
      return { engine: 'marker@test', pages };
    }),
  },
}));

import { env } from '../../config/env';
import { enqueueStage } from '../../services/queue.service';
import { processDocumentWorker } from '../process-document.worker';

const runLayoutJob = () => processDocumentWorker({ id: 'job-1', data: { documentId: 'doc-1', stage: 'layout' } } as any);

const layoutCheckpoint = () => db.state.document.metadata.processing.checkpoints.stages.layout;

describe('v2 layout stage resume', () => {
  beforeEach(() => {
    (env as any).LAYOUT_BATCH_PAGES = 2; // 7 pages -> 1-2, 3-4, 5-6, 7-7
    layoutCalls.ranges = [];
    layoutCalls.failOn = null;
    db.state.pages.clear();
    db.state.texts.clear();
    db.state.events = [];
    db.state.upsertCalls = 0;
    db.state.failDocumentUpdateOnce = null;
    db.state.document = {
      id: 'doc-1',
      title: 'Test Book',
      format: 'pdf',
      storageKey: 'uploads/book.pdf',
      pageCount: 0,
      contentHash: 'hash-a',
      ocrStatus: 'processing',
      metadata: {
        processing: {
          pipelineVersion: 'v2',
          checkpoints: { contentHash: 'hash-a', stages: { ingest: { completedAt: '2026-01-01T00:00:00.000Z' } } },
        },
      },
    };
    vi.mocked(enqueueStage).mockClear();
  });

  it('resumes after a kill during a layout call without redoing finished batches', async () => {
    layoutCalls.failOn = '5-6';
    await expect(runLayoutJob()).rejects.toThrow('worker killed');

    // The worker's error handler recorded the failure and kept finished batches.
    expect(layoutCheckpoint().error).toBe('worker killed during layout call');
    expect(Object.keys(layoutCheckpoint().batches)).toEqual(['1-2', '3-4']);
    expect([...db.state.pages.keys()]).toEqual([1, 2, 3, 4]);
    expect(enqueueStage).not.toHaveBeenCalled();

    await runLayoutJob();

    expect(layoutCalls.ranges).toEqual(['1-2', '3-4', '5-6', '5-6', '7-7']);
    expect([...db.state.pages.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(db.state.upsertCalls).toBe(7);
    expect(layoutCheckpoint().completedAt).toBeTruthy();
    expect(layoutCheckpoint().error).toBeUndefined();
    expect(db.state.document.pageCount).toBe(7);
    expect(db.state.texts.get('layout')).toBe([1, 2, 3, 4, 5, 6, 7].map((n) => `Page ${n} text`).join('\n\n'));
    expect(db.state.document.metadata.processing.pages).toMatchObject({ count: 7, batchesRun: 2, batchesSkipped: 2 });
    expect(enqueueStage).toHaveBeenCalledWith('doc-1', 'extract');
  });

  it('redoes a batch killed between page upsert and checkpoint without duplicating pages', async () => {
    db.state.failDocumentUpdateOnce = (data) =>
      Boolean(data.metadata?.processing?.checkpoints?.stages?.layout?.batches?.['3-4']);
    await expect(runLayoutJob()).rejects.toThrow('worker killed before checkpoint');

    // Pages 3-4 were written, but their batch was never checkpointed.
    expect([...db.state.pages.keys()]).toEqual([1, 2, 3, 4]);
    expect(Object.keys(layoutCheckpoint().batches)).toEqual(['1-2']);

    await runLayoutJob();

    expect(layoutCalls.ranges).toEqual(['1-2', '3-4', '3-4', '5-6', '7-7']);
    expect(db.state.pages.size).toBe(7);
    expect(db.state.upsertCalls).toBe(9); // pages 3 and 4 upserted twice, still one row each
    expect(layoutCheckpoint().completedAt).toBeTruthy();
  });

  it('ignores batches checkpointed for a different file hash', async () => {
    db.state.document.metadata.processing.checkpoints.stages.layout = {
      batches: { '1-2': { completedAt: '2026-01-01T00:00:00.000Z', pages: 2, contentHash: 'hash-old' } },
    };
    await runLayoutJob();
    expect(layoutCalls.ranges).toEqual(['1-2', '3-4', '5-6', '7-7']);
  });

  it('builds Markdown pages from heading sections without calling ocr-service', async () => {
    const { s3Service } = await import('../../services/s3.service');
    vi.mocked(s3Service.downloadFile).mockResolvedValueOnce(Buffer.from('# Fireball\nBoom\n# Shield\nBlock'));
    db.state.document.format = 'markdown';

    await runLayoutJob();

    expect(layoutCalls.ranges).toEqual([]);
    expect([...db.state.pages.values()].map((p) => [p.pageNumber, p.engine])).toEqual([
      [1, 'markdown-sections'],
      [2, 'markdown-sections'],
    ]);
    expect(db.state.document.pageCount).toBe(2);
  });

  it('emits page events per batch, a quality summary and stage events for the live view', async () => {
    db.state.document.metadata.processing.runId = 'run-1';
    layoutCalls.failOn = '5-6';
    await expect(runLayoutJob()).rejects.toThrow('worker killed');
    await runLayoutJob();

    const kinds = db.state.events.map((e) => `${e.kind}${e.pageNumber ? `:${e.pageNumber}` : ''}`);
    expect(db.state.events.every((e) => e.runId === 'run-1' && e.documentId === 'doc-1')).toBe(true);
    expect(kinds.filter((k) => k.startsWith('page_layout')).sort()).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((n) => `page_layout:${n}`).sort()
    );
    expect(kinds.filter((k) => k.startsWith('page_markdown'))).toHaveLength(7);
    expect(kinds).toContain('stage_failed');
    expect(kinds.filter((k) => k === 'stage_started')).toHaveLength(2);
    expect(kinds[kinds.length - 1]).toBe('stage_completed');
    const quality = db.state.events.find((e) => e.kind === 'quality');
    expect(quality.message).toBe('Text cleanliness 90.0% average over 7 pages');
    expect(db.state.events.find((e) => e.kind === 'page_layout').message).toMatch(/^Page 1: one-column layout, 0 text blocks$/);
  });
});
