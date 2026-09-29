import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CODEX_ALLOWLIST } from '../src/codex/allowlist.js';
import { DOC_API_URL, startHarness, type Harness, type TestSession } from './support/harness.js';
import { codexStub, DOC_ID, PRESIGNED_PREVIEW, WEBP_BYTES } from './support/upstreams.js';

const BASE = `/control-api/v1/codex/admin/processing/${DOC_ID}`;

describe('ingestion v2 live processing routes', () => {
  let h: Harness;
  let auditor: TestSession;
  beforeAll(async () => {
    h = await startHarness();
    auditor = await h.sessionFor(['auditor']);
  });
  afterAll(async () => {
    await h.close();
  });
  beforeEach(() => {
    h.upstreamCalls.length = 0;
    h.upstream.respond = codexStub();
  });

  it('allowlists events, pages and the preview handler as codex:read, but not preview-source', () => {
    const paths = CODEX_ALLOWLIST.filter((route) => route.path.startsWith('admin/processing/:id')).map((route) => route.path);
    expect(paths).toEqual([
      'admin/processing/:id/events',
      'admin/processing/:id/pages',
      'admin/processing/:id/pages/:page',
      'admin/processing/:id/pages/:page/preview',
    ]);
    const preview = CODEX_ALLOWLIST.find((route) => route.path === 'admin/processing/:id/pages/:page/preview')!;
    expect(preview).toMatchObject({ method: 'GET', permission: ['codex:read'], handler: 'layoutPreview', response: 'image' });
    expect(CODEX_ALLOWLIST.some((route) => route.path.includes('preview-source'))).toBe(false);
  });

  it('forwards event polling with a BIGSERIAL cursor, limit and runId', async () => {
    const res = await h.request(`${BASE}/events?after=12345678901&limit=200&runId=0f8fad5b-d9cb-469f-a165-70867728950e`, { session: auditor });
    expect(res.status).toBe(200);
    expect(h.upstreamCalls[0]!.url).toBe(
      `${DOC_API_URL}/api/admin/processing/${DOC_ID}/events?after=12345678901&limit=200&runId=0f8fad5b-d9cb-469f-a165-70867728950e`
    );
  });

  it('rejects malformed event queries without contacting doc-api', async () => {
    for (const query of ['after=abc', 'after=1.5', 'limit=-1', 'runId=../x', 'other=1']) {
      const res = await h.request(`${BASE}/events?${query}`, { session: auditor });
      expect(res.status, query).toBe(400);
    }
    expect(h.upstreamCalls).toHaveLength(0);
  });

  it('streams the layout preview server-side and never exposes the presigned URL', async () => {
    const res = await h.request(`${BASE}/pages/1/preview`, { session: auditor });
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(WEBP_BYTES);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    const [lookup, image] = h.upstreamCalls;
    expect(lookup!.url).toBe(`${DOC_API_URL}/api/admin/processing/${DOC_ID}/pages/1/preview-source`);
    expect(image!.url).toBe(PRESIGNED_PREVIEW);
    expect(image!.headers.cookie).toBeUndefined();
  });

  it('returns 404 for a page without a preview and refuses foreign URLs', async () => {
    expect((await h.request(`${BASE}/pages/9/preview`, { session: auditor })).status).toBe(404);
    expect((await h.request(`${BASE}/pages/abc/preview`, { session: auditor })).status).toBe(404);
    h.upstream.respond = codexStub({ previewUrl: 'http://169.254.169.254/latest/meta-data' });
    h.upstreamCalls.length = 0;
    expect((await h.request(`${BASE}/pages/1/preview`, { session: auditor })).status).toBe(502);
    expect(h.upstreamCalls).toHaveLength(1);
  });

  it('does not route preview-source to the browser', async () => {
    expect((await h.request(`${BASE}/pages/1/preview-source`, { session: auditor })).status).toBe(404);
    expect(h.upstreamCalls).toHaveLength(0);
  });
});
