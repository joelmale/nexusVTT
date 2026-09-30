import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryPipelineEvents } from '../src/codex/pipelineEvents.js';
import { DOC_API_URL, startHarness, type Harness, type UpstreamCall } from './support/harness.js';

const DOC_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const RUN_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const STREAM = `/control-api/v1/codex/admin/processing/${DOC_ID}/stream`;

type Frame = Record<string, string>;

function parseFrames(text: string): Frame[] {
  return text
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const frame: Frame = {};
      for (const line of block.split('\n')) {
        if (line.startsWith(':')) frame.comment = line.slice(1).trim();
        else {
          const index = line.indexOf(': ');
          frame[line.slice(0, index)] = line.slice(index + 2);
        }
      }
      return frame;
    });
}

/** Reads the stream until `done(frames)` holds, then aborts. */
async function readUntil(res: Response, controller: AbortController, done: (frames: Frame[]) => boolean): Promise<Frame[]> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    for (;;) {
      const { value, done: ended } = await reader.read();
      if (ended) break;
      text += decoder.decode(value, { stream: true });
      if (done(parseFrames(text))) break;
    }
  } finally {
    controller.abort();
  }
  return parseFrames(text);
}

const event = (id: number) => ({ id: String(id), runId: RUN_ID, stage: 'layout', kind: 'page_layout', message: `event ${id}`, pageNumber: id });
const ids = (frames: Frame[]) => frames.filter((f) => f.event === 'processing').map((f) => f.id);

/** doc-api events: `stored` grows as the test "processes"; pages of at most `pageSize`. */
function eventsUpstream(stored: Array<ReturnType<typeof event>>, pageSize = 200) {
  return (call: UpstreamCall) => {
    const url = new URL(call.url);
    const after = Number(url.searchParams.get('after') ?? 0);
    const rows = stored.filter((row) => Number(row.id) > after);
    const page = rows.slice(0, Math.min(pageSize, Number(url.searchParams.get('limit'))));
    const body = {
      documentId: DOC_ID,
      runId: RUN_ID,
      events: page,
      nextAfter: page.length > 0 ? page[page.length - 1]!.id : url.searchParams.get('after'),
      hasMore: rows.length > page.length,
      ...(url.searchParams.has('after') ? {} : { runs: [{ runId: RUN_ID }] }),
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

describe('processing event stream (SSE)', () => {
  let h: Harness;
  afterEach(async () => {
    await h.close();
  });

  it('backfills from doc-api, pages through hasMore, and sends meta once per run', async () => {
    h = await startHarness({ config: { streamPollMs: 20 } });
    const auditor = await h.sessionFor(['auditor']);
    h.upstream.respond = eventsUpstream([event(1), event(2), event(3)], 2);
    const controller = new AbortController();
    const res = await h.request(STREAM, { session: auditor, signal: controller.signal });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/event-stream/);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-accel-buffering')).toBe('no');
    const frames = await readUntil(res, controller, (f) => ids(f).length >= 3);
    expect(frames[0]).toEqual({ retry: '3000' });
    const meta = frames.filter((f) => f.event === 'meta');
    expect(meta).toHaveLength(1);
    expect(JSON.parse(meta[0]!.data!)).toEqual({ runId: RUN_ID, runs: [{ runId: RUN_ID }] });
    expect(ids(frames)).toEqual(['1', '2', '3']);
    expect(JSON.parse(frames.find((f) => f.id === '3')!.data!)).toMatchObject({ id: '3', message: 'event 3' });
    expect(h.upstreamCalls.slice(0, 2).map((call) => call.url)).toEqual([
      `${DOC_API_URL}/api/admin/processing/${DOC_ID}/events?limit=200`,
      `${DOC_API_URL}/api/admin/processing/${DOC_ID}/events?limit=200&after=2`,
    ]);
  });

  it('resumes from Last-Event-ID, which wins over ?after', async () => {
    h = await startHarness({ config: { streamPollMs: 20 } });
    const auditor = await h.sessionFor(['auditor']);
    h.upstream.respond = eventsUpstream([event(1), event(2), event(3)]);
    const controller = new AbortController();
    const res = await h.request(`${STREAM}?after=1`, {
      session: auditor,
      signal: controller.signal,
      headers: { 'last-event-id': '2' },
    });
    const frames = await readUntil(res, controller, (f) => ids(f).length > 0);
    expect(ids(frames)).toEqual(['3']);
    expect(h.upstreamCalls[0]!.url).toContain('after=2');
  });

  it('wakes on the Redis doorbell instead of waiting for the poll', async () => {
    const bus = createMemoryPipelineEvents();
    h = await startHarness({ pipelineEvents: bus, config: { streamPollMs: 60_000 } });
    const auditor = await h.sessionFor(['auditor']);
    const stored = [event(1)];
    h.upstream.respond = eventsUpstream(stored);
    const controller = new AbortController();
    const res = await h.request(STREAM, { session: auditor, signal: controller.signal });
    const started = Date.now();
    let rang = false;
    const frames = await readUntil(res, controller, (f) => {
      if (ids(f).includes('1') && !rang) {
        rang = true;
        stored.push(event(2));
        setTimeout(() => bus.publish(DOC_ID), 10);
      }
      return ids(f).includes('2');
    });
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(ids(frames)).toEqual(['1', '2']);
  });

  it('sends heartbeats while idle and ends itself at the deadline', async () => {
    h = await startHarness({ config: { streamPollMs: 20, streamHeartbeatMs: 30, streamMaxMs: 200 } });
    const auditor = await h.sessionFor(['auditor']);
    h.upstream.respond = eventsUpstream([]);
    const res = await h.request(STREAM, { session: auditor });
    const text = await res.text();
    expect(parseFrames(text).some((f) => f.comment === 'ping')).toBe(true);
  });

  it('rejects bad cursors and unknown params without contacting doc-api, and requires a session', async () => {
    h = await startHarness({ config: { streamPollMs: 20 } });
    const auditor = await h.sessionFor(['auditor']);
    for (const query of ['after=abc', 'limit=5', 'runId=x']) {
      expect((await h.request(`${STREAM}?${query}`, { session: auditor })).status, query).toBe(400);
    }
    expect((await h.request(STREAM, { session: auditor, headers: { 'last-event-id': '1;DROP' } })).status).toBe(400);
    expect((await h.request(STREAM)).status).toBe(401);
    expect(h.upstreamCalls).toHaveLength(0);
  });
});
