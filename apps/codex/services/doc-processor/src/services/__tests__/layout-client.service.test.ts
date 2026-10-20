import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { UnrecoverableError } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env';
import { LayoutClientService } from '../layout-client.service';

type Handler = (body: any, res: http.ServerResponse) => void;

/** A real ocr-service stand-in: the client under test talks to it over HTTP. */
const startServer = async (handler: Handler) => {
  const requests: Array<{ url?: string; body: any }> = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      requests.push({ url: req.url, body });
      handler(body, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, requests, close: () => new Promise<void>((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }) };
};

const json = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

describe('LayoutClientService', () => {
  let origUrl: string | undefined;
  let origTimeout: number;
  let server: Awaited<ReturnType<typeof startServer>> | undefined;
  const params = {
    bucket: 'documents',
    key: 'uploads/book.pdf',
    pageStart: 6,
    pageEnd: 10,
    renderPreviews: true,
    previewPrefix: 'page-previews/doc-1/',
  };

  const serve = async (handler: Handler) => {
    server = await startServer(handler);
    (env as any).OCR_SERVICE_URL = server.url;
    return server;
  };

  beforeEach(() => {
    origUrl = env.OCR_SERVICE_URL;
    origTimeout = env.LAYOUT_SERVICE_TIMEOUT_MS;
  });

  afterEach(async () => {
    (env as any).OCR_SERVICE_URL = origUrl;
    (env as any).LAYOUT_SERVICE_TIMEOUT_MS = origTimeout;
    await server?.close();
    server = undefined;
    vi.restoreAllMocks();
  });

  it('posts the page range to /layout/s3 and returns pages', async () => {
    const body = { engine: 'marker@1.10.1', pages: [{ pageNumber: 6, markdown: '# Six', blocks: [] }] };
    const { requests } = await serve((_req, res) => json(res, 200, body));

    const result = await new LayoutClientService().convertRange(params);

    expect(result).toEqual(body);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('/layout/s3');
    expect(requests[0].body).toEqual(params);
  });

  it('does not go through fetch, whose fixed 5-minute header wait ended long batches early', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await serve((_req, res) => json(res, 200, { engine: 'marker', pages: [] }));
    await new LayoutClientService().convertRange(params);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('waits for a slow batch as long as LAYOUT_SERVICE_TIMEOUT_MS allows', async () => {
    (env as any).LAYOUT_SERVICE_TIMEOUT_MS = 5000;
    await serve((_req, res) => {
      setTimeout(() => json(res, 200, { engine: 'marker', pages: [{ pageNumber: 6, markdown: '', blocks: [] }] }), 400);
    });
    const result = await new LayoutClientService().convertRange(params);
    expect(result.pages).toHaveLength(1);
  });

  it('fails with a readable timeout message when the batch outlasts LAYOUT_SERVICE_TIMEOUT_MS', async () => {
    (env as any).LAYOUT_SERVICE_TIMEOUT_MS = 150;
    await serve(() => {
      // never answers
    });
    const error = await new LayoutClientService().convertRange(params).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(UnrecoverableError);
    expect(error.message).toBe('POST /layout/s3 timed out after 150ms');
  });

  it('surfaces a refused connection as a retryable error', async () => {
    await serve((_req, res) => json(res, 200, {}));
    const dead = server!;
    (env as any).OCR_SERVICE_URL = dead.url;
    await dead.close();
    server = undefined;
    const error = await new LayoutClientService().convertRange(params).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(UnrecoverableError);
  });

  it('throws a retryable error on 5xx so the stage retries', async () => {
    await serve((_req, res) => json(res, 503, 'busy'));
    const error = await new LayoutClientService().convertRange(params).catch((e) => e);
    expect(error.message).toContain('HTTP 503 busy');
    expect(error).not.toBeInstanceOf(UnrecoverableError);
  });

  it('throws an UnrecoverableError on 4xx so BullMQ stops retrying', async () => {
    await serve((_req, res) => json(res, 400, 'bad range'));
    const error = await new LayoutClientService().convertRange(params).catch((e) => e);
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(error.message).toContain('HTTP 400 bad range');
  });

  it('rejects pages outside the requested range', async () => {
    await serve((_req, res) => json(res, 200, { engine: 'marker', pages: [{ pageNumber: 11, markdown: '', blocks: [] }] }));
    await expect(new LayoutClientService().convertRange(params)).rejects.toThrow('outside 6-10');
  });
});
