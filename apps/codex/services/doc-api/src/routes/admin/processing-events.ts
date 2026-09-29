import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma as defaultPrisma } from '../../services/database.service';
import { s3Service } from '../../services/s3.service';

/**
 * Live processing view (ingestion v2 plan: "Live processing UI").
 *
 * - GET /api/admin/processing/:documentId/events?after=<id>&limit=200&runId=
 *   Events in id order, strictly after `after`. Without runId, the latest run.
 *   The first page (no `after`) also lists the document's runs for replay.
 * - GET /api/admin/processing/:documentId/pages          page summaries
 * - GET /api/admin/processing/:documentId/pages/:pageNumber  markdown + blocks
 * - GET /api/admin/processing/:documentId/pages/:pageNumber/preview-source
 *   { key, url } of the layout preview. For control-api's server-side image
 *   handler only: it is not on the browser allowlist, so the presigned URL
 *   never reaches the browser.
 */

export const DEFAULT_EVENT_LIMIT = 200;
export const MAX_EVENT_LIMIT = 500;

type EventRow = {
  id: bigint;
  documentId: string;
  runId: string;
  stage: string;
  pageNumber: number | null;
  kind: string;
  message: string;
  payload: unknown;
  createdAt: Date;
};

type PageRow = {
  pageNumber: number;
  markdown?: string;
  blocks?: unknown;
  widthPt: number | null;
  heightPt: number | null;
  previewKey: string | null;
  quality: unknown;
  engine: string;
};

// The slice of Prisma these routes use; tests pass a fake.
export type ProcessingEventsDb = {
  processingEvent: {
    findMany(args: any): Promise<EventRow[]>;
    groupBy(args: any): Promise<Array<{ runId: string; _min: { id: bigint | null; createdAt: Date | null }; _max: { id: bigint | null; createdAt: Date | null }; _count: { _all: number } }>>;
  };
  documentPage: {
    findMany(args: any): Promise<PageRow[]>;
    findUnique(args: any): Promise<PageRow | null>;
  };
};

export type ProcessingEventsDeps = {
  db?: ProcessingEventsDb;
  previewUrl?: (key: string) => Promise<string>;
};

const serializeEvent = (event: EventRow) => ({
  id: event.id.toString(), // BigInt is not JSON-serializable
  runId: event.runId,
  stage: event.stage,
  pageNumber: event.pageNumber,
  kind: event.kind,
  message: event.message,
  payload: event.payload,
  createdAt: event.createdAt.toISOString(),
});

export const parseEventQuery = (query: { after?: string; limit?: string; runId?: string }) => {
  if (query.after !== undefined && !/^\d+$/.test(query.after)) {
    return { error: 'after must be a non-negative integer event id' } as const;
  }
  const requested = query.limit === undefined ? DEFAULT_EVENT_LIMIT : Number(query.limit);
  if (!Number.isInteger(requested) || requested < 1) {
    return { error: 'limit must be a positive integer' } as const;
  }
  return {
    after: query.after !== undefined ? BigInt(query.after) : undefined,
    limit: Math.min(requested, MAX_EVENT_LIMIT),
    runId: query.runId || undefined,
  } as const;
};

export async function adminProcessingEventsRoutes(fastify: FastifyInstance, deps: ProcessingEventsDeps = {}) {
  const db = deps.db ?? (defaultPrisma as unknown as ProcessingEventsDb);
  const previewUrl = deps.previewUrl ?? ((key: string) => s3Service.getDownloadUrl(key));

  fastify.get<{ Params: { documentId: string }; Querystring: { after?: string; limit?: string; runId?: string } }>(
    '/api/admin/processing/:documentId/events',
    async (request, reply: FastifyReply) => {
      const parsed = parseEventQuery(request.query);
      if ('error' in parsed) return reply.status(400).send({ error: parsed.error });
      const { documentId } = request.params;

      try {
        // Runs, newest first. Needed to resolve "latest run" and for replay.
        const grouped = await db.processingEvent.groupBy({
          by: ['runId'],
          where: { documentId },
          _min: { id: true, createdAt: true },
          _max: { id: true, createdAt: true },
          _count: { _all: true },
        });
        const runs = grouped
          .map((run) => ({
            runId: run.runId,
            firstEventId: run._min.id?.toString() ?? null,
            lastEventId: run._max.id?.toString() ?? null,
            startedAt: run._min.createdAt?.toISOString() ?? null,
            lastEventAt: run._max.createdAt?.toISOString() ?? null,
            events: run._count._all,
          }))
          .sort((a, b) => Number(BigInt(b.lastEventId ?? '0') - BigInt(a.lastEventId ?? '0')));

        const runId = parsed.runId ?? runs[0]?.runId;
        if (!runId) {
          return reply.send({ documentId, runId: null, events: [], nextAfter: parsed.after?.toString() ?? null, hasMore: false, runs: [] });
        }

        // Fetch one extra row to know whether another page exists.
        const rows = await db.processingEvent.findMany({
          where: { documentId, runId, ...(parsed.after !== undefined ? { id: { gt: parsed.after } } : {}) },
          orderBy: { id: 'asc' },
          take: parsed.limit + 1,
        });
        const hasMore = rows.length > parsed.limit;
        const events = rows.slice(0, parsed.limit).map(serializeEvent);
        const nextAfter = events.length > 0 ? events[events.length - 1].id : parsed.after?.toString() ?? null;

        return reply.send({
          documentId,
          runId,
          events,
          nextAfter,
          hasMore,
          ...(parsed.after === undefined ? { runs } : {}),
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to load processing events', details: error.message });
      }
    }
  );

  fastify.get<{ Params: { documentId: string } }>(
    '/api/admin/processing/:documentId/pages',
    async (request: FastifyRequest<{ Params: { documentId: string } }>, reply: FastifyReply) => {
      try {
        const pages = await db.documentPage.findMany({
          where: { documentId: request.params.documentId },
          orderBy: { pageNumber: 'asc' },
          select: { pageNumber: true, widthPt: true, heightPt: true, previewKey: true, quality: true, engine: true },
        });
        return reply.send({
          documentId: request.params.documentId,
          pages: pages.map((page) => ({
            pageNumber: page.pageNumber,
            widthPt: page.widthPt,
            heightPt: page.heightPt,
            hasPreview: Boolean(page.previewKey),
            quality: page.quality,
            engine: page.engine,
          })),
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to load pages', details: error.message });
      }
    }
  );

  fastify.get<{ Params: { documentId: string; pageNumber: string } }>(
    '/api/admin/processing/:documentId/pages/:pageNumber',
    async (request, reply: FastifyReply) => {
      const pageNumber = Number(request.params.pageNumber);
      if (!Number.isInteger(pageNumber) || pageNumber < 1) {
        return reply.status(400).send({ error: 'pageNumber must be a positive integer' });
      }
      try {
        const page = await db.documentPage.findUnique({
          where: { documentId_pageNumber: { documentId: request.params.documentId, pageNumber } },
        });
        if (!page) return reply.status(404).send({ error: 'Page not found' });
        return reply.send({
          documentId: request.params.documentId,
          pageNumber: page.pageNumber,
          markdown: page.markdown ?? '',
          blocks: page.blocks ?? [],
          widthPt: page.widthPt,
          heightPt: page.heightPt,
          quality: page.quality,
          engine: page.engine,
          hasPreview: Boolean(page.previewKey),
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to load page', details: error.message });
      }
    }
  );

  fastify.get<{ Params: { documentId: string; pageNumber: string } }>(
    '/api/admin/processing/:documentId/pages/:pageNumber/preview-source',
    async (request, reply: FastifyReply) => {
      const pageNumber = Number(request.params.pageNumber);
      if (!Number.isInteger(pageNumber) || pageNumber < 1) {
        return reply.status(400).send({ error: 'pageNumber must be a positive integer' });
      }
      try {
        const page = await db.documentPage.findUnique({
          where: { documentId_pageNumber: { documentId: request.params.documentId, pageNumber } },
          select: { pageNumber: true, previewKey: true },
        });
        if (!page?.previewKey) return reply.status(404).send({ error: 'No preview for this page' });
        return reply.send({ key: page.previewKey, url: await previewUrl(page.previewKey) });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to resolve preview', details: error.message });
      }
    }
  );
}
