import { readdirSync, readFileSync, statSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CODEX_ALLOWLIST, CodexRouteTable, type CodexRoute } from '../src/codex/allowlist.js';
import { normalizeUpstreamError } from '../src/codex/proxy.js';
import { DOC_API_URL, startHarness, type Harness, type TestSession } from './support/harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DOC = '0b6f1c1e-3b7a-4d7e-9a51-4a4a2d6f9c11';

const json = (value: unknown): RequestInit => ({
  body: JSON.stringify(value),
  headers: { 'content-type': 'application/json' },
});

/** Sends a path byte-for-byte (fetch would normalise `..`). */
function rawRequest(h: Harness, rawPath: string, session: TestSession, method = 'GET'): Promise<number> {
  const url = new URL(h.baseUrl);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: url.hostname, port: url.port, path: rawPath, method, headers: { cookie: session.cookie } },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    // Test files deliberately contain hostile paths; only product code counts.
    return statSync(full).isDirectory() ? listFiles(full) : /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('Codex allowlist table', () => {
  const table = new CodexRouteTable(CODEX_ALLOWLIST);

  it('covers every doc-api path the Admin UI calls', () => {
    const uiRoot = path.resolve(here, '../../codex/services/admin-ui/src');
    const paths = new Set<string>();
    for (const file of listFiles(uiRoot)) {
      // Code only: doc comments mention placeholder paths such as `/api/X`.
      const source = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line))
        .join('\n');
      for (const match of source.matchAll(/[`'"](?:\$\{API_BASE_URL\})?\/api\/([^`'"?\s]+)/g)) {
        paths.add(match[1]!.replace(/\$\{[^}]+\}/g, 'x1'));
      }
    }
    expect(paths.size).toBeGreaterThan(30);
    const methods = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];
    const uncovered = [...paths].filter((p) => !methods.some((m) => table.lookup(m, p).kind === 'match'));
    expect(uncovered).toEqual([]);
  });

  it('declares a permission, action, and resource type for every entry', () => {
    for (const route of CODEX_ALLOWLIST) {
      expect(route.permission.length).toBeGreaterThan(0);
      expect(route.action).toMatch(/^codex\./);
      if (route.method !== 'GET' && route.path !== 'search/ask') expect(route.audited).toBe(true);
    }
    expect(CODEX_ALLOWLIST).toHaveLength(48);
  });

  it('rejects duplicate entries', () => {
    const route = CODEX_ALLOWLIST[0]!;
    expect(() => new CodexRouteTable([route, route])).toThrow(/Duplicate/);
  });

  it('never matches traversal, encoded slashes, or empty segments', () => {
    for (const p of ['admin/documents/..', 'admin/documents/%2e%2e', 'admin/documents/a%2Fb/reprocess', 'admin//stats', 'admin/stats/', '../admin/stats', 'admin/documents/a.b/reprocess', 'admin/documents/%00/reprocess']) {
      expect(table.lookup('POST', p).kind).toBe('not_found');
      expect(table.lookup('GET', p).kind).toBe('not_found');
    }
  });

  it('maps upstream statuses to safe errors', () => {
    expect(normalizeUpstreamError(500)).toEqual({ status: 502, error: 'upstream_error' });
    expect(normalizeUpstreamError(401)).toEqual({ status: 502, error: 'upstream_error' });
    expect(normalizeUpstreamError(302)).toEqual({ status: 502, error: 'upstream_error' });
    expect(normalizeUpstreamError(404)).toEqual({ status: 404, error: 'not_found' });
    expect(normalizeUpstreamError(422)).toEqual({ status: 422, error: 'invalid_request' });
  });
});

describe('Codex proxy', () => {
  let h: Harness;
  let admin: TestSession;
  beforeAll(async () => {
    const upload: CodexRoute = {
      method: 'POST', path: 'test/upload', permission: ['codex:write'], recentAuth: false, audited: true,
      action: 'codex.test.upload', resourceType: 'document', query: {},
      body: { kind: 'stream', maxBytes: 1024, contentTypes: ['multipart/form-data'] },
    };
    h = await startHarness({ codexRoutes: [...CODEX_ALLOWLIST, upload] });
    admin = await h.sessionFor(['platform_admin']);
  });
  afterAll(async () => {
    await h.close();
  });
  beforeEach(() => {
    h.store.audit.length = 0;
    h.upstreamCalls.length = 0;
    h.upstream.respond = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  it('forwards a listed read with only listed query keys and no browser credentials', async () => {
    const res = await h.request('/control-api/v1/codex/admin/documents?page=2&limit=50&search=dragon%20lore', {
      session: admin,
      headers: { authorization: 'Bearer browser-token', 'x-forwarded-host': 'evil' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(h.upstreamCalls).toHaveLength(1);
    const call = h.upstreamCalls[0]!;
    expect(call.url).toBe(`${DOC_API_URL}/api/admin/documents?page=2&limit=50&search=dragon+lore`);
    expect(call.headers.cookie).toBeUndefined();
    expect(call.headers.authorization).toBeUndefined();
    expect(call.headers['x-forwarded-host']).toBeUndefined();
    expect(call.headers['x-request-id']).toBe(res.headers.get('x-request-id'));
    expect(h.store.audit).toHaveLength(0); // reads are not audited
  });

  it('returns 404 for unlisted paths and methods without contacting doc-api', async () => {
    const cases: Array<[string, string]> = [
      ['GET', '/control-api/v1/codex/admin/users'],
      ['POST', '/control-api/v1/codex/admin/validation/fix'],
      ['PUT', `/control-api/v1/codex/admin/documents/${DOC}`],
      ['GET', `/control-api/v1/codex/admin/documents/${DOC}`],
      ['POST', '/control-api/v1/codex/admin/stats'],
      ['GET', '/control-api/v1/codex/Admin/stats'],
      ['GET', '/control-api/v1/codex/'],
    ];
    for (const [method, url] of cases) {
      const res = await h.request(url, { method, session: admin });
      expect(res.status, `${method} ${url}`).toBe(404);
      expect(await res.json()).toMatchObject({ error: 'not_found' });
    }
    expect(h.upstreamCalls).toHaveLength(0);
    expect(h.store.audit).toHaveLength(0);
  });

  it('rejects path injection sent verbatim', async () => {
    for (const raw of [
      '/control-api/v1/codex/admin/documents/../../users',
      '/control-api/v1/codex/admin/documents/..%2F..%2Fusers/reprocess',
      '/control-api/v1/codex/admin/documents/%2e%2e/reprocess',
      '/control-api/v1/codex/admin/processing/report/a%2Fb',
      '/control-api/v1/codex/admin//stats',
      '/control-api/v1/codex/admin/stats/',
      '/control-api/v1/codex/admin/processing/report/..',
    ]) {
      expect(await rawRequest(h, raw, admin), raw).toBe(404);
    }
    expect(h.upstreamCalls).toHaveLength(0);
  });

  it('rejects unlisted, duplicated, or malformed query parameters', async () => {
    for (const url of [
      '/control-api/v1/codex/admin/stats?debug=1',
      '/control-api/v1/codex/admin/documents?page=1&page=2',
      '/control-api/v1/codex/admin/documents?page=abc',
      '/control-api/v1/codex/admin/documents?__proto__=1',
      '/control-api/v1/codex/admin/documents?constructor=1',
      '/control-api/v1/codex/search/advanced?query=x&sortOrder=sideways',
    ]) {
      const res = await h.request(url, { session: admin });
      expect(res.status, url).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'invalid_query' });
    }
    expect(h.upstreamCalls).toHaveLength(0);
  });

  it('normalizes doc-api errors without leaking internals', async () => {
    h.upstream.respond = () =>
      new Response(JSON.stringify({ error: 'connect ECONNREFUSED elasticsearch:9200', stack: 'Error\n at /app/dist/x.js' }), { status: 500 });
    const res = await h.request('/control-api/v1/codex/admin/elasticsearch/health', { session: admin });
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'upstream_error', requestId: res.headers.get('x-request-id') });
    expect(text).not.toMatch(/elasticsearch|ECONNREFUSED|stack/);
  });

  it('does not follow or expose doc-api redirects', async () => {
    h.upstream.respond = () => new Response(null, { status: 302, headers: { location: 'http://minio:9000/bucket/key' } });
    const res = await h.request(`/control-api/v1/codex/documents/${DOC}/content`, { session: admin });
    expect(res.status).toBe(502);
    expect(res.headers.get('location')).toBeNull();
  });

  it('maps a network failure to 502 upstream_unavailable and audits the failed mutation', async () => {
    h.upstream.respond = () => {
      throw new TypeError('fetch failed: getaddrinfo ENOTFOUND doc-api');
    };
    const res = await h.request(`/control-api/v1/codex/admin/documents/${DOC}/reprocess`, { method: 'POST', session: admin });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'upstream_unavailable' });
    expect(h.store.audit).toHaveLength(1);
    expect(h.store.audit[0]).toMatchObject({ outcome: 'failure', summary: { reason: 'upstream_unavailable' } });
  });

  it('audits a mutation exactly once with field names but no content', async () => {
    const res = await h.request(`/control-api/v1/codex/admin/documents/${DOC}`, {
      method: 'PATCH',
      session: admin,
      ...json({ title: 'The Secret Vault of Orcus', tags: ['classified'] }),
    });
    expect(res.status).toBe(200);
    expect(h.upstreamCalls[0]!.body!.toString()).toBe(JSON.stringify({ title: 'The Secret Vault of Orcus', tags: ['classified'] }));
    expect(h.store.audit).toHaveLength(1);
    const event = h.store.audit[0]!;
    expect(event).toMatchObject({
      action: 'codex.document.update',
      outcome: 'success',
      resourceType: 'document',
      resourceId: DOC,
      roleUsed: 'platform_admin',
      actorUserId: admin.user.id,
      identityProvider: 'google',
      summary: { method: 'PATCH', route: 'admin/documents/:id', fields: ['tags', 'title'], upstreamStatus: 200 },
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('Orcus');
    expect(serialized).not.toContain('classified');
    expect(serialized).not.toContain(admin.cookieValue);
    expect(serialized).not.toContain(admin.csrfToken);
  });

  it('audits a doc-api conflict as conflict', async () => {
    h.upstream.respond = () => new Response('{}', { status: 409 });
    const res = await h.request('/control-api/v1/codex/deduplication/merge', { method: 'POST', session: admin, ...json({ primaryId: DOC, duplicateIds: [DOC] }) });
    expect(res.status).toBe(409);
    expect(h.store.audit).toHaveLength(1);
    expect(h.store.audit[0]).toMatchObject({ outcome: 'conflict', summary: { values: { primaryId: DOC, duplicateIds: [DOC] } } });
  });

  it('enforces JSON body limits and media types before contacting doc-api', async () => {
    const big = await h.request(`/control-api/v1/codex/admin/documents/${DOC}`, { method: 'PATCH', session: admin, ...json({ title: 'x'.repeat(70 * 1024) }) });
    expect(big.status).toBe(413);
    const form = await h.request(`/control-api/v1/codex/admin/documents/${DOC}`, { method: 'PATCH', session: admin, body: 'title=x', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect(form.status).toBe(415);
    const invalid = await h.request(`/control-api/v1/codex/admin/documents/${DOC}`, { method: 'PATCH', session: admin, body: '{nope', headers: { 'content-type': 'application/json' } });
    expect(invalid.status).toBe(400);
    const unexpected = await h.request(`/control-api/v1/codex/admin/documents/${DOC}/reprocess`, { method: 'POST', session: admin, ...json({ sneaky: true }) });
    expect(unexpected.status).toBe(400);
    expect(h.upstreamCalls).toHaveLength(0);
    expect(h.store.audit.map((e) => e.outcome)).toEqual(['failure', 'failure', 'failure', 'failure']);
  });

  it('accepts a body-less POST that still declares a JSON content type', async () => {
    const res = await h.request('/control-api/v1/codex/admin/elasticsearch/optimize', { method: 'POST', session: admin, headers: { 'content-type': 'application/json' } });
    expect(res.status).toBe(200);
    expect(h.upstreamCalls[0]!.headers['content-type']).toBeUndefined();
  });

  it('streams a multipart upload under the cap and rejects one over it', async () => {
    const boundary = 'XBOUNDARY';
    const small = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.md"\r\n\r\n# hi\r\n--${boundary}--\r\n`;
    const ok = await h.request('/control-api/v1/codex/test/upload', { method: 'POST', session: admin, body: small, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } });
    expect(ok.status).toBe(200);
    expect(h.upstreamCalls[0]!.body!.toString()).toBe(small);
    expect(h.upstreamCalls[0]!.headers['content-type']).toBe(`multipart/form-data; boundary=${boundary}`);

    const declared = await h.request('/control-api/v1/codex/test/upload', { method: 'POST', session: admin, body: 'x'.repeat(2048), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } });
    expect(declared.status).toBe(413);

    // Chunked (no Content-Length): capped while streaming.
    const chunks = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 4; i++) controller.enqueue(new Uint8Array(512).fill(120));
        controller.close();
      },
    });
    const streamed = await h.request('/control-api/v1/codex/test/upload', {
      method: 'POST', session: admin, body: chunks, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, duplex: 'half',
    } as RequestInit);
    expect(streamed.status).toBe(413);
  });

  it('passes Range through for document content and restricts the CSP', async () => {
    h.upstream.respond = () =>
      new Response('%PDF-1.7', { status: 206, headers: { 'content-type': 'application/pdf', 'content-range': 'bytes 0-7/100', 'x-internal': 'minio', 'set-cookie': 'x=1' } });
    const res = await h.request(`/control-api/v1/codex/documents/${DOC}/content`, { session: admin, headers: { range: 'bytes=0-7' } });
    expect(res.status).toBe(206);
    expect(await res.text()).toBe('%PDF-1.7');
    expect(res.headers.get('content-range')).toBe('bytes 0-7/100');
    expect(res.headers.get('x-internal')).toBeNull();
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('content-security-policy')).toBe("default-src 'none'; object-src 'self'; frame-ancestors 'none'");
    expect(h.upstreamCalls[0]!.headers.range).toBe('bytes=0-7');
  });

  it('does not forward Range where it is not allowed', async () => {
    await h.request('/control-api/v1/codex/admin/stats', { session: admin, headers: { range: 'bytes=0-7' } });
    expect(h.upstreamCalls[0]!.headers.range).toBeUndefined();
  });
});
