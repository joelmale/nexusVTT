import { connect, type Socket } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LONG_BODY_ROUTES } from '../src/app.js';
import { BODY_DEADLINE_MS, BODY_IDLE_TIMEOUT_MS, UPLOAD_BODY_DEADLINE_MS } from '../src/http/bodyDeadline.js';
import { ADMIN_ORIGIN, startHarness, type Harness, type TestSession } from './support/harness.js';

const DOC = '0b6f1c1e-3b7a-4d7e-9a51-4a4a2d6f9c11';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RawResult {
  status: number | null;
  closedAfterMs: number;
}

/**
 * Sends the request head, then the body pieces with the given pauses, over a
 * raw socket, and reports the response status (if any) and when the
 * connection closed.
 */
async function slowRequest(h: Harness, options: { method: string; path: string; headers: Record<string, string>; pieces: Array<[string, number]>; declaredLength: number }): Promise<RawResult> {
  const url = new URL(h.baseUrl);
  const socket: Socket = connect(Number(url.port), url.hostname);
  const started = Date.now();
  let response = '';
  socket.on('data', (chunk) => (response += chunk.toString('latin1')));
  const closed = new Promise<number>((resolve) => socket.on('close', () => resolve(Date.now() - started)));
  socket.on('error', () => undefined);
  await new Promise<void>((resolve) => socket.once('connect', () => resolve()));
  const head = [
    `${options.method} ${options.path} HTTP/1.1`,
    `Host: ${url.host}`,
    `Content-Length: ${options.declaredLength}`,
    ...Object.entries(options.headers).map(([name, value]) => `${name}: ${value}`),
    '',
    '',
  ].join('\r\n');
  socket.write(head);
  for (const [piece, pauseMs] of options.pieces) {
    if (socket.destroyed) break;
    socket.write(piece);
    await sleep(pauseMs);
  }
  const closedAfterMs = await Promise.race([closed, sleep(4_000).then(() => -1)]);
  socket.destroy();
  const match = /^HTTP\/1\.1 (\d{3})/.exec(response);
  return { status: match ? Number(match[1]) : null, closedAfterMs };
}

describe('request body deadlines', () => {
  let h: Harness;
  let editor: TestSession;
  const authHeaders = () => ({
    cookie: editor.cookie,
    origin: ADMIN_ORIGIN,
    'x-csrf-token': editor.csrfToken,
  });

  beforeAll(async () => {
    h = await startHarness({ config: { bodyDeadlineMs: 600, uploadBodyDeadlineMs: 3_000, bodyIdleTimeoutMs: 250 } });
    editor = await h.sessionFor(['content_editor']);
  });
  afterAll(async () => {
    await h.close();
  });

  it('uses production defaults that allow a slow 200 MB upload but not a slow JSON body', () => {
    expect(UPLOAD_BODY_DEADLINE_MS).toBeGreaterThanOrEqual(30 * 60 * 1000);
    expect(BODY_DEADLINE_MS).toBeLessThanOrEqual(330_000);
    expect(BODY_IDLE_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
    expect([...LONG_BODY_ROUTES]).toEqual(['POST /control-api/v1/codex/documents/upload']);
  });

  it('ends a request whose body stops arriving (idle), answering 408', async () => {
    const result = await slowRequest(h, {
      method: 'PATCH',
      path: `/control-api/v1/codex/admin/documents/${DOC}`,
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      declaredLength: 100,
      pieces: [['{"title":', 1_000]],
    });
    expect(result.status).toBe(408);
    expect(result.closedAfterMs).toBeGreaterThan(0);
    expect(result.closedAfterMs).toBeLessThan(900);
  });

  it('ends a trickled body that never goes idle at the route deadline', async () => {
    const pieces: Array<[string, number]> = Array.from({ length: 12 }, () => [' ', 100]);
    const result = await slowRequest(h, {
      method: 'PATCH',
      path: `/control-api/v1/codex/admin/documents/${DOC}`,
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      declaredLength: 100,
      pieces,
    });
    expect(result.status).toBe(408);
    expect(result.closedAfterMs).toBeGreaterThanOrEqual(550);
    expect(result.closedAfterMs).toBeLessThan(1_100);
  });

  it('gives the upload route its longer deadline while bytes keep arriving', async () => {
    const boundary = 'nexus-slow-boundary';
    const body = [
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="slow.md"\r\nContent-Type: text/markdown\r\n\r\n`,
      ...Array.from({ length: 10 }, () => 'slow line\n'),
      `\r\n--${boundary}--\r\n`,
    ];
    const length = Buffer.byteLength(body.join(''));
    const result = await slowRequest(h, {
      method: 'POST',
      path: '/control-api/v1/codex/documents/upload',
      headers: { ...authHeaders(), 'content-type': `multipart/form-data; boundary=${boundary}` },
      declaredLength: length,
      // ~1.2 s in total: twice the normal deadline, well inside the upload one.
      pieces: body.map((piece) => [piece, 100] as [string, number]),
    });
    expect(result.status).not.toBeNull();
    expect(result.status).not.toBe(408);
  });

  it('still applies the idle timeout on the upload route', async () => {
    const boundary = 'nexus-idle-boundary';
    const result = await slowRequest(h, {
      method: 'POST',
      path: '/control-api/v1/codex/documents/upload',
      headers: { ...authHeaders(), 'content-type': `multipart/form-data; boundary=${boundary}` },
      declaredLength: 10_000,
      pieces: [[`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="idle.md"\r\n\r\nx`, 1_000]],
    });
    expect(result.status).toBe(408);
    expect(result.closedAfterMs).toBeLessThan(900);
  });

  it('answers an unauthenticated upload at once without reading its body', async () => {
    const result = await slowRequest(h, {
      method: 'POST',
      path: '/control-api/v1/codex/documents/upload',
      headers: { 'content-type': 'multipart/form-data; boundary=x', origin: ADMIN_ORIGIN },
      declaredLength: 1_000_000,
      pieces: Array.from({ length: 5 }, () => ['x', 100] as [string, number]),
    });
    // Unauthenticated: answered at once, body never read.
    expect(result.status).toBe(401);
  });

  it('leaves requests without a body untouched', async () => {
    const res = await h.request('/control-api/v1/me', { session: editor });
    expect(res.status).toBe(200);
  });
});
