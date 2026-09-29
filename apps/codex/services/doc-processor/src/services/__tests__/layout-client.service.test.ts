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

  it('throws on HTTP errors so the stage fails and retries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, text: vi.fn().mockResolvedValue('busy') }) as any;
    await expect(new LayoutClientService().convertRange(params)).rejects.toThrow('HTTP 503 busy');
  });

  it('rejects pages outside the requested range', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ engine: 'marker', pages: [{ pageNumber: 11, markdown: '', blocks: [] }] }),
    }) as any;
    await expect(new LayoutClientService().convertRange(params)).rejects.toThrow('outside 6-10');
  });
});
