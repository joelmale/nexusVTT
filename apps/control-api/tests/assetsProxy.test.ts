import { request as httpRequest } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ASSET_ALLOWLIST, ASSET_UPLOAD_MAX_BODY_BYTES, ASSET_UPLOAD_MAX_FILE_BYTES } from '../src/assets/allowlist.js';
import { MB, RouteTable, type ProxyRoute } from '../src/proxy/routeTable.js';
import { ASSET_ADMIN_SERVICE_SECRET, ASSET_SERVICE_URL, startHarness, type Harness, type TestSession } from './support/harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const json = (value: unknown, headers: Record<string, string> = {}): RequestInit => ({
  body: JSON.stringify(value),
  headers: { 'content-type': 'application/json', ...headers },
});

function rawRequest(h: Harness, rawPath: string, session: TestSession, method = 'GET'): Promise<number> {
  const url = new URL(h.baseUrl);
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: url.hostname, port: url.port, path: rawPath, method, headers: { cookie: session.cookie } }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.end();
  });
}

describe('asset allowlist table', () => {
  const table = new RouteTable(ASSET_ALLOWLIST);

  it('covers every route in the asset administration doc', () => {
    const doc = readFileSync(path.resolve(here, '../../docs/vtt/operations/asset-administration.md'), 'utf8');
    const section = doc.slice(doc.indexOf('## Route reference'), doc.indexOf('The `asset` shape'));
    const documented: Array<[string, string]> = [];
    for (const line of section.split('\n')) {
      const match = /^\| (GET|POST|PATCH|PUT|DELETE) \| (.+?) \|/.exec(line);
      if (!match) continue;
      for (const route of match[2]!.split(',')) {
        documented.push([match[1]!, route.trim().replace(/^`\//, '').replace(/`$/, '').replace(/:[A-Za-z]+/g, 'x1')]);
      }
    }
    expect(documented.length).toBeGreaterThanOrEqual(16);
    const uncovered = documented.filter(([method, p]) => table.lookup(method, p).kind !== 'match');
    expect(uncovered).toEqual([]);
    expect(ASSET_ALLOWLIST).toHaveLength(documented.length);
  });

  it('declares permissions and audits every mutation', () => {
    for (const route of ASSET_ALLOWLIST) {
      expect(route.permission.length).toBeGreaterThan(0);
      expect(route.action).toMatch(/^assets\./);
      const readOnly = route.method === 'GET' || route.path.endsWith('/delete-preview');
      expect(route.audited, route.path).toBe(!readOnly);
      if (route.path.endsWith('permanent-delete')) {
        expect(route.permission).toEqual(['assets:delete']);
        expect(route.recentAuth).toBe(true);
      } else {
        expect(route.recentAuth, route.path).toBe(false);
      }
    }
  });

  it('caps uploads at the asset-service limit plus multipart framing', () => {
    expect(ASSET_UPLOAD_MAX_FILE_BYTES).toBe(25 * MB);
    const upload = ASSET_ALLOWLIST.find((route) => route.method === 'POST' && route.path === 'assets')!;
    expect(upload.body).toEqual({ kind: 'stream', maxBytes: ASSET_UPLOAD_MAX_BODY_BYTES, contentTypes: ['multipart/form-data'] });
    expect(ASSET_UPLOAD_MAX_BODY_BYTES).toBeLessThanOrEqual(27 * MB);
  });

  it('never matches traversal, encoded slashes, dot segments, or empty segments', () => {
    for (const p of ['assets/..', 'assets/%2e%2e', 'assets/a%2Fb/restore', 'assets//restore', 'assets/', '../assets', 'assets/.admin', 'assets/a.b/preview', 'jobs/../integrity']) {
      for (const method of ['GET', 'POST', 'PATCH']) expect(table.lookup(method, p).kind, `${method} ${p}`).toBe('not_found');
    }
  });
});

describe('asset proxy', () => {
  let h: Harness;
  let admin: TestSession;
  beforeAll(async () => {
    const smallUpload: ProxyRoute[] = ASSET_ALLOWLIST.map((route) =>
      route.method === 'POST' && route.path === 'assets' ? { ...route, body: { kind: 'stream', maxBytes: 2048, contentTypes: ['multipart/form-data'] } } : route,
    );
    h = await startHarness({ assetRoutes: smallUpload });
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

  it('adds the service credential and actor, and never forwards browser credentials', async () => {
    const res = await h.request('/control-api/v1/assets/assets?q=goblin&status=all&limit=25&cursor=MjU', {
      session: admin,
      headers: { authorization: 'Bearer browser', 'x-nexus-auth': 'forged', 'x-nexus-actor': 'someone-else', 'x-forwarded-for': '1.2.3.4' },
    });
    expect(res.status).toBe(200);
    const call = h.upstreamCalls[0]!;
    expect(call.url).toBe(`${ASSET_SERVICE_URL}/internal/admin/assets?q=goblin&status=all&limit=25&cursor=MjU`);
    expect(call.headers['x-nexus-admin-auth']).toBe(ASSET_ADMIN_SERVICE_SECRET);
    // The backend's asset credential header is never sent (nor the forged one relayed).
    expect(call.headers['x-nexus-auth']).toBeUndefined();
    expect(call.headers['x-nexus-actor']).toBe(admin.user.id);
    expect(call.headers['x-request-id']).toBe(res.headers.get('x-request-id'));
    expect(call.headers.cookie).toBeUndefined();
    expect(call.headers.authorization).toBeUndefined();
    expect(call.headers['x-forwarded-for']).toBeUndefined();
    const text = await res.text();
    expect(text).not.toContain(ASSET_ADMIN_SERVICE_SECRET);
  });

  it('forwards If-Match on writes, records it as the prior version, and returns the ETag', async () => {
    h.upstream.respond = () => new Response(JSON.stringify({ asset: { id: 'adm-1', version: 3 } }), { status: 200, headers: { 'content-type': 'application/json', etag: '"adm-1:3"' } });
    const res = await h.request('/control-api/v1/assets/assets/adm-1', { method: 'PATCH', session: admin, ...json({ name: 'Goblin boss' }, { 'if-match': '"adm-1:2"' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe('"adm-1:3"');
    expect(h.upstreamCalls[0]!.headers['if-match']).toBe('"adm-1:2"');
    expect(h.store.audit).toHaveLength(1);
    expect(h.store.audit[0]).toMatchObject({ action: 'assets.update_metadata', outcome: 'success', resourceId: 'adm-1', priorVersion: '"adm-1:2"', summary: { fields: ['name'] } });
  });

  it('records expectedVersion from the body as the prior version', async () => {
    await h.request('/control-api/v1/assets/assets/adm-1/restore', { method: 'POST', session: admin, ...json({ expectedVersion: 7 }) });
    expect(h.store.audit[0]).toMatchObject({ action: 'assets.restore', priorVersion: '7', summary: { values: { expectedVersion: 7 } } });
  });

  it('rejects a malformed precondition instead of writing unconditionally', async () => {
    const res = await h.request('/control-api/v1/assets/assets/adm-1', { method: 'PATCH', session: admin, ...json({ name: 'x' }, { 'if-match': 'garbage value' }) });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_precondition' });
    expect(h.upstreamCalls).toHaveLength(0);
    expect(h.store.audit[0]).toMatchObject({ outcome: 'failure', summary: { reason: 'invalid_precondition' } });
  });

  it('relays a 409 version conflict body unchanged and audits it as a conflict', async () => {
    const conflict = { error: 'version-conflict', message: 'Asset version changed', details: { current: { id: 'adm-1', version: 4, name: 'Goblin' } }, audit: { actor: admin.user.id, requestId: 'r' } };
    h.upstream.respond = () => new Response(JSON.stringify(conflict), { status: 409, headers: { 'content-type': 'application/json', etag: '"adm-1:4"' } });
    const res = await h.request('/control-api/v1/assets/assets/adm-1/quarantine', { method: 'POST', session: admin, ...json({ expectedVersion: 3 }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(conflict);
    expect(res.headers.get('etag')).toBe('"adm-1:4"');
    expect(h.store.audit[0]).toMatchObject({ outcome: 'conflict', summary: { upstreamStatus: 409 } });
  });

  it('normalizes credential failures and 5xx without leaking internals', async () => {
    h.upstream.respond = () => new Response(JSON.stringify({ error: 'unauthorized', message: 'Service credential required' }), { status: 401, headers: { 'content-type': 'application/json' } });
    const refused = await h.request('/control-api/v1/assets/facets', { session: admin });
    expect(refused.status).toBe(502);
    expect(await refused.json()).toMatchObject({ error: 'upstream_error' });

    h.upstream.respond = () => new Response('Error: EACCES /mnt/nas/library/blobs', { status: 500, headers: { 'content-type': 'text/plain' } });
    const broken = await h.request('/control-api/v1/assets/assets/adm-1/derivatives', { method: 'POST', session: admin });
    expect(broken.status).toBe(502);
    expect(await broken.text()).not.toMatch(/nas|EACCES/);
  });

  it('streams preview images with safe headers only', async () => {
    h.upstream.respond = () =>
      new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': '4', 'set-cookie': 'sid=1', 'content-disposition': 'attachment; filename="/mnt/nas/x.png"', 'x-nexus-actor': 'leak' },
      });
    const res = await h.request('/control-api/v1/assets/assets/adm-1/preview?variant=original', { session: admin });
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-disposition')).toBe('inline');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('x-nexus-actor')).toBeNull();
    expect(h.upstreamCalls[0]!.url).toBe(`${ASSET_SERVICE_URL}/internal/admin/assets/adm-1/preview?variant=original`);
  });

  it('refuses a preview that is not a PNG, JPEG, or WebP image', async () => {
    h.upstream.respond = () => new Response('<svg onload=alert(1)>', { status: 200, headers: { 'content-type': 'image/svg+xml' } });
    const res = await h.request('/control-api/v1/assets/assets/adm-1/preview', { session: admin });
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('svg');
  });

  it('passes If-None-Match through and relays 304', async () => {
    h.upstream.respond = () => new Response(null, { status: 304, headers: { etag: 'W/"abc"' } });
    const res = await h.request('/control-api/v1/assets/assets/adm-1', { session: admin, headers: { 'if-none-match': 'W/"abc"' } });
    expect(res.status).toBe(304);
    expect(res.headers.get('etag')).toBe('W/"abc"');
    expect(h.upstreamCalls[0]!.headers['if-none-match']).toBe('W/"abc"');
  });

  it('returns 404 for unlisted paths and methods without contacting the asset service', async () => {
    for (const [method, url] of [
      ['DELETE', '/control-api/v1/assets/assets/adm-1'],
      ['PUT', '/control-api/v1/assets/assets/adm-1'],
      ['GET', '/control-api/v1/assets/assets/adm-1/permanent-delete'],
      ['POST', '/control-api/v1/assets/jobs'],
      ['GET', '/control-api/v1/assets/library'],
      ['GET', '/control-api/v1/assets/metrics'],
      ['GET', '/control-api/v1/assets/'],
      ['GET', '/control-api/v1/assets/Assets'],
    ] as const) {
      const res = await h.request(url, { method, session: admin });
      expect(res.status, `${method} ${url}`).toBe(404);
    }
    for (const raw of ['/control-api/v1/assets/assets/../../metrics', '/control-api/v1/assets/assets/%2e%2e/preview', '/control-api/v1/assets/assets/a%2Fb', '/control-api/v1/assets//facets']) {
      expect(await rawRequest(h, raw, admin), raw).toBe(404);
    }
    expect(h.upstreamCalls).toHaveLength(0);
  });

  it('rejects unlisted, duplicated, or malformed query parameters', async () => {
    for (const url of [
      '/control-api/v1/assets/facets?debug=1',
      '/control-api/v1/assets/assets?status=everything',
      '/control-api/v1/assets/assets?limit=1&limit=2',
      '/control-api/v1/assets/assets?origin=nas',
      '/control-api/v1/assets/assets/adm-1/preview?variant=../../etc',
      '/control-api/v1/assets/assets?__proto__=1',
    ]) {
      const res = await h.request(url, { session: admin });
      expect(res.status, url).toBe(400);
    }
    expect(h.upstreamCalls).toHaveLength(0);
  });

  it('streams a multipart upload under the cap and rejects one over it', async () => {
    const form = new FormData();
    form.append('category', 'tokens');
    form.append('file', new Blob([new Uint8Array(100)], { type: 'image/png' }), 'goblin.png');
    h.upstream.respond = () => new Response(JSON.stringify({ asset: { id: 'adm-9' }, duplicate: false }), { status: 201, headers: { 'content-type': 'application/json', etag: '"adm-9:1"' } });
    const ok = await h.request('/control-api/v1/assets/assets?force=true', { method: 'POST', session: admin, body: form });
    expect(ok.status).toBe(201);
    const call = h.upstreamCalls[0]!;
    expect(call.url).toBe(`${ASSET_SERVICE_URL}/internal/admin/assets?force=true`);
    expect(call.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(call.body!.toString('latin1')).toContain('name="category"');
    expect(h.store.audit[0]).toMatchObject({ action: 'assets.upload', outcome: 'success' });

    h.upstreamCalls.length = 0;
    const big = new FormData();
    big.append('category', 'tokens');
    big.append('file', new Blob([new Uint8Array(4096)], { type: 'image/png' }), 'big.png');
    const tooBig = await h.request('/control-api/v1/assets/assets', { method: 'POST', session: admin, body: big });
    expect(tooBig.status).toBe(413);
    expect(h.upstreamCalls).toHaveLength(0);

    const notMultipart = await h.request('/control-api/v1/assets/assets', { method: 'POST', session: admin, ...json({ category: 'tokens' }) });
    expect(notMultipart.status).toBe(415);
  });

  it('requires CSRF for delete-preview even though it changes nothing', async () => {
    const res = await h.request('/control-api/v1/assets/assets/adm-1/delete-preview', { method: 'POST', session: admin, csrf: false });
    expect(res.status).toBe(403);
    expect(h.upstreamCalls).toHaveLength(0);
  });

  it('forwards body-less job starts without a content type', async () => {
    const res = await h.request('/control-api/v1/assets/jobs/integrity-report?wait=true', { method: 'POST', session: admin });
    expect(res.status).toBe(200);
    expect(h.upstreamCalls[0]!.headers['content-type']).toBeUndefined();
    expect(h.upstreamCalls[0]!.body).toBeNull();
  });
});
