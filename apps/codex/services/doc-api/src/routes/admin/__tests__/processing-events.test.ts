import Fastify, { type FastifyInstance } from 'fastify';
import { vi } from 'vitest';
import {
  adminProcessingEventsRoutes,
  MAX_EVENT_LIMIT,
  parseEventQuery,
  type ProcessingEventsDb,
} from '../processing-events';

const DOC = 'doc-1';

/** In-memory processing_events + document_pages with the Prisma calls the routes make. */
function fakeDb(eventCount = 5) {
  const events = [
    ...Array.from({ length: 3 }, (_, i) => ({ runId: 'run-old', n: i + 1 })),
    ...Array.from({ length: eventCount }, (_, i) => ({ runId: 'run-new', n: i + 4 })),
  ].map(({ runId, n }) => ({
    id: BigInt(n),
    documentId: DOC,
    runId,
    stage: 'layout',
    pageNumber: n,
    kind: 'page_layout',
    message: `Page ${n}`,
    payload: { n },
    createdAt: new Date(Date.UTC(2026, 8, 28, 14, 2, n)),
  }));

  const db = {
    processingEvent: {
      findMany: vi.fn(async ({ where, take }: any) =>
        events
          .filter((e) => e.documentId === where.documentId && e.runId === where.runId)
          .filter((e) => (where.id?.gt !== undefined ? e.id > where.id.gt : true))
          .sort((a, b) => Number(a.id - b.id))
          .slice(0, take)
      ),
      groupBy: vi.fn(async ({ where }: any) => {
        const runs = new Map<string, typeof events>();
        for (const e of events.filter((e) => e.documentId === where.documentId)) {
          runs.set(e.runId, [...(runs.get(e.runId) || []), e]);
        }
        return [...runs.entries()].map(([runId, list]) => ({
          runId,
          _min: { id: list[0].id, createdAt: list[0].createdAt },
          _max: { id: list[list.length - 1].id, createdAt: list[list.length - 1].createdAt },
          _count: { _all: list.length },
        }));
      }),
    },
    documentPage: {
      findMany: vi.fn(async () => [
        { pageNumber: 1, widthPt: 612, heightPt: 792, previewKey: 'page-previews/doc-1/page-1.webp', quality: { wordValidity: 0.97 }, engine: 'marker@1.10.2' },
        { pageNumber: 2, widthPt: 612, heightPt: 792, previewKey: null, quality: {}, engine: 'marker@1.10.2' },
      ]),
      findUnique: vi.fn(async ({ where }: any) =>
        where.documentId_pageNumber.pageNumber === 1
          ? {
              pageNumber: 1,
              markdown: '## Gorgon',
              blocks: [{ id: 'p1-b0', class: 'heading', markerType: 'SectionHeader', bbox: [0.1, 0.1, 0.5, 0.2] }],
              widthPt: 612,
              heightPt: 792,
              previewKey: 'page-previews/doc-1/page-1.webp',
              quality: { wordValidity: 0.97 },
              engine: 'marker@1.10.2',
            }
          : null
      ),
    },
  };
  return db;
}

async function build(db = fakeDb()) {
  const app = Fastify();
  await app.register(adminProcessingEventsRoutes, {
    db: db as unknown as ProcessingEventsDb,
    previewUrl: async (key: string) => `https://s3.test/${key}?signed`,
  });
  await app.ready();
  return { app, db };
}

describe('GET /api/admin/processing/:documentId/events', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('defaults to the latest run and lists runs newest first on the first page', async () => {
    ({ app } = await build());
    const res = await app.inject({ url: `/api/admin/processing/${DOC}/events` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.runId).toBe('run-new');
    expect(body.events.map((e: any) => e.id)).toEqual(['4', '5', '6', '7', '8']);
    expect(body.events[0]).toMatchObject({ runId: 'run-new', kind: 'page_layout', pageNumber: 4, message: 'Page 4', payload: { n: 4 } });
    expect(typeof body.events[0].createdAt).toBe('string');
    expect(body.runs.map((r: any) => [r.runId, r.events, r.lastEventId])).toEqual([
      ['run-new', 5, '8'],
      ['run-old', 3, '3'],
    ]);
    expect(body).toMatchObject({ nextAfter: '8', hasMore: false });
  });

  it('pages with after/limit without gaps or duplicates', async () => {
    ({ app } = await build(fakeDb(7)));
    const seen: string[] = [];
    let after: string | undefined;
    let pages = 0;
    for (;;) {
      const res = await app.inject({ url: `/api/admin/processing/${DOC}/events?limit=3${after ? `&after=${after}` : ''}` });
      const body = res.json();
      seen.push(...body.events.map((e: any) => e.id));
      pages += 1;
      if (after !== undefined) expect(body.runs).toBeUndefined(); // only on the first page
      after = body.nextAfter;
      if (!body.hasMore) break;
    }
    expect(pages).toBe(3);
    expect(seen).toEqual(['4', '5', '6', '7', '8', '9', '10']);
  });

  it('polling past the last event returns no events and keeps the cursor', async () => {
    ({ app } = await build());
    const body = (await app.inject({ url: `/api/admin/processing/${DOC}/events?after=8` })).json();
    expect(body).toMatchObject({ events: [], nextAfter: '8', hasMore: false });
  });

  it('replays an older run by runId', async () => {
    ({ app } = await build());
    const body = (await app.inject({ url: `/api/admin/processing/${DOC}/events?runId=run-old` })).json();
    expect(body.runId).toBe('run-old');
    expect(body.events.map((e: any) => e.id)).toEqual(['1', '2', '3']);
  });

  it('returns an empty result for a document with no events', async () => {
    ({ app } = await build());
    const body = (await app.inject({ url: '/api/admin/processing/other-doc/events' })).json();
    expect(body).toEqual({ documentId: 'other-doc', runId: null, events: [], nextAfter: null, hasMore: false, runs: [] });
  });

  it('rejects malformed cursors and limits', async () => {
    ({ app } = await build());
    expect((await app.inject({ url: `/api/admin/processing/${DOC}/events?after=abc` })).statusCode).toBe(400);
    expect((await app.inject({ url: `/api/admin/processing/${DOC}/events?after=-1` })).statusCode).toBe(400);
    expect((await app.inject({ url: `/api/admin/processing/${DOC}/events?limit=0` })).statusCode).toBe(400);
  });

  it('caps limit and asks the database for one extra row', async () => {
    const db = fakeDb();
    ({ app } = await build(db));
    await app.inject({ url: `/api/admin/processing/${DOC}/events?limit=100000` });
    expect(db.processingEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: MAX_EVENT_LIMIT + 1 }));
  });
});

describe('parseEventQuery', () => {
  it('handles event ids beyond Number.MAX_SAFE_INTEGER', () => {
    const parsed = parseEventQuery({ after: '9007199254740993' });
    expect('error' in parsed).toBe(false);
    expect((parsed as any).after).toBe(9007199254740993n);
  });
});

describe('page routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('lists page summaries without markdown', async () => {
    ({ app } = await build());
    const body = (await app.inject({ url: `/api/admin/processing/${DOC}/pages` })).json();
    expect(body.pages).toEqual([
      { pageNumber: 1, widthPt: 612, heightPt: 792, hasPreview: true, quality: { wordValidity: 0.97 }, engine: 'marker@1.10.2' },
      { pageNumber: 2, widthPt: 612, heightPt: 792, hasPreview: false, quality: {}, engine: 'marker@1.10.2' },
    ]);
  });

  it('returns one page with blocks but never a presigned URL', async () => {
    ({ app } = await build());
    const body = (await app.inject({ url: `/api/admin/processing/${DOC}/pages/1` })).json();
    expect(body).toMatchObject({ pageNumber: 1, markdown: '## Gorgon', hasPreview: true });
    expect(JSON.stringify(body)).not.toContain('signed');
    expect(body.blocks).toHaveLength(1);
    expect((await app.inject({ url: `/api/admin/processing/${DOC}/pages/2` })).statusCode).toBe(404);
    expect((await app.inject({ url: `/api/admin/processing/${DOC}/pages/zero` })).statusCode).toBe(400);
  });

  it('preview-source resolves the presigned URL for control-api', async () => {
    ({ app } = await build());
    expect((await app.inject({ url: `/api/admin/processing/${DOC}/pages/1/preview-source` })).json()).toEqual({
      key: 'page-previews/doc-1/page-1.webp',
      url: 'https://s3.test/page-previews/doc-1/page-1.webp?signed',
    });
    expect((await app.inject({ url: `/api/admin/processing/${DOC}/pages/2/preview-source` })).statusCode).toBe(404);
  });
});
