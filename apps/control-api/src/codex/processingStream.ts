import { sendError } from '../http/context.js';
import type { HandlerContext } from '../proxy/forward.js';
import { docApiJson, UpstreamFailure } from './internal.js';

/**
 * `GET /control-api/v1/codex/admin/processing/:id/stream` (codex:read).
 *
 * Server-Sent Events for the admin UI's Live Proof canvas. Events come from
 * doc-api `admin/processing/:id/events` by id cursor, so a stream never skips
 * or repeats one: the cursor starts at `?after=` or the browser's
 * `Last-Event-ID` (EventSource resends it on reconnect). With Redis configured
 * the pipeline's publish wakes the stream at once; without it the stream polls
 * doc-api every second. Frames:
 *
 *   event: meta        data: { runId, runs? }        when the run is known or changes
 *   event: processing  data: <ProcessingEvent>       id: <event id>
 *   : ping                                           heartbeat (keeps proxies from idling out)
 *
 * The stream ends itself after STREAM_MAX_MS; EventSource reconnects.
 */

export const STREAM_POLL_MS = 1_000;
/** With the Redis doorbell, poll only as a safety net. */
export const STREAM_POLL_WITH_BUS_MS = 5_000;
export const STREAM_HEARTBEAT_MS = 15_000;
export const STREAM_MAX_MS = 10 * 60 * 1000;

const EVENT_ID = /^\d{1,19}$/;
const PAGE_LIMIT = 200;

interface EventsPage {
  runId: string | null;
  events: Array<{ id: string }>;
  nextAfter: string | null;
  hasMore: boolean;
  runs?: unknown[];
}

export async function processingStreamHandler(hc: HandlerContext): Promise<void> {
  const { deps, req, res, context, match } = hc;
  const { id } = match.params;
  if (!id) return sendError(res, 404, 'not_found');

  const query = new URLSearchParams(hc.rawQuery);
  for (const key of query.keys()) {
    if (key !== 'after') return sendError(res, 400, 'invalid_query');
  }
  const lastEventId = typeof req.headers['last-event-id'] === 'string' ? req.headers['last-event-id'].trim() : '';
  const requested = lastEventId || query.get('after') || '';
  if (requested && !EVENT_ID.test(requested)) return sendError(res, 400, 'invalid_query');

  const pollMs = deps.config.streamPollMs ?? (deps.pipelineEvents ? STREAM_POLL_WITH_BUS_MS : STREAM_POLL_MS);
  const heartbeatMs = deps.config.streamHeartbeatMs ?? STREAM_HEARTBEAT_MS;
  const maxMs = deps.config.streamMaxMs ?? STREAM_MAX_MS;

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Connection', 'keep-alive');
  // nginx (the admin gateway) must not buffer the stream.
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.flushHeaders();
  res.write('retry: 3000\n\n');

  let closed = false;
  let wake: (() => void) | null = null;
  const ring = () => {
    const resume = wake;
    wake = null;
    resume?.();
  };
  req.on('close', () => {
    closed = true;
    ring();
  });
  const unsubscribe = deps.pipelineEvents?.subscribe(id, ring) ?? (() => undefined);

  let cursor: string | null = requested || null;
  let runId: string | null = null;
  let lastWrite = Date.now();
  const startedAt = Date.now();
  const write = (frame: string) => {
    if (closed) return;
    res.write(frame);
    lastWrite = Date.now();
  };

  try {
    while (!closed && Date.now() - startedAt < maxMs) {
      let page: EventsPage | null = null;
      try {
        const search = new URLSearchParams({ limit: String(PAGE_LIMIT) });
        if (cursor) search.set('after', cursor);
        const response = await docApiJson(deps, context, 'GET', `admin/processing/${id}/events?${search}`);
        if (response.status === 200) page = response.json as EventsPage;
        else deps.logger.warn('processing stream: doc-api events failed', { requestId: context.requestId, status: response.status });
      } catch (error) {
        const reason = error instanceof UpstreamFailure ? error.reason : 'upstream_unavailable';
        deps.logger.warn('processing stream: doc-api unreachable', { requestId: context.requestId, reason });
      }

      if (page) {
        if (page.runId && page.runId !== runId) {
          runId = page.runId;
          write(`event: meta\ndata: ${JSON.stringify({ runId, ...(page.runs ? { runs: page.runs } : {}) })}\n\n`);
        }
        for (const event of page.events) {
          write(`id: ${event.id}\nevent: processing\ndata: ${JSON.stringify(event)}\n\n`);
        }
        if (page.nextAfter) cursor = page.nextAfter;
        if (page.hasMore) continue;
      }

      if (Date.now() - lastWrite >= heartbeatMs) write(': ping\n\n');
      if (closed) break;
      const waitMs = Math.max(0, Math.min(pollMs, heartbeatMs - (Date.now() - lastWrite)));
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          wake = null;
          resolve();
        }, waitMs);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    }
  } finally {
    unsubscribe();
    if (!res.writableEnded) res.end();
  }
}
