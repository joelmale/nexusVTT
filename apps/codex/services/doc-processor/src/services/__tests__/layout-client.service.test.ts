import { UnrecoverableError } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env';
import { LayoutClientService } from '../layout-client.service';

describe('LayoutClientService', () => {
  const originalFetch = globalThis.fetch;
  let origUrl: string | undefined;
  const params = {
    bucket: 'documents',
    key: 'uploads/book.pdf',
    pageStart: 6,
    pageEnd: 10,
    renderPreviews: true,
    previewPrefix: 'page-previews/doc-1/',
  };

  beforeEach(() => {
    origUrl = env.OCR_SERVICE_URL;
    (env as any).OCR_SERVICE_URL = 'http://ocr:8000';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (env as any).OCR_SERVICE_URL = origUrl;
  });

  it('posts the page range to /layout/s3 and returns pages', async () => {
    const body = { engine: 'marker@1.10.1', pages: [{ pageNumber: 6, markdown: '# Six', blocks: [] }] };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(body) }) as any;

    const result = await new LayoutClientService().convertRange(params);

    expect(result).toEqual(body);
    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe('http://ocr:8000/layout/s3');
    expect(JSON.parse(init.body)).toEqual(params);
  });

  it('throws a retryable error on 5xx so the stage retries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, text: vi.fn().mockResolvedValue('busy') }) as any;
    const error = await new LayoutClientService().convertRange(params).catch((e) => e);
    expect(error.message).toContain('HTTP 503 busy');
    expect(error).not.toBeInstanceOf(UnrecoverableError);
  });

  it('throws an UnrecoverableError on 4xx so BullMQ stops retrying', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: vi.fn().mockResolvedValue('bad range') }) as any;
    const error = await new LayoutClientService().convertRange(params).catch((e) => e);
    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(error.message).toContain('HTTP 400 bad range');
  });

  it('rejects pages outside the requested range', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ engine: 'marker', pages: [{ pageNumber: 11, markdown: '', blocks: [] }] }),
    }) as any;
    await expect(new LayoutClientService().convertRange(params)).rejects.toThrow('outside 6-10');
  });
});
