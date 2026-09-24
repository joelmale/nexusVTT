import { request as httpRequest } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RouteTable } from '../src/proxy/routeTable.js';
import { RULES_ALLOWLIST } from '../src/rules/allowlist.js';
import { DOC_API_URL, RULES_SERVICE_TOKEN, startHarness, type Harness, type TestSession } from './support/harness.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ENTITY = '0b6f1c1e-3b7a-4d7e-9a51-4a4a2d6f9c11';
const BASE = '/control-api/v1/rules';

const json = (value: unknown, headers: Record<string, string> = {}): RequestInit => ({
  body: JSON.stringify(value),
  headers: { 'content-type': 'application/json', ...headers },
});

function rawRequest(h: Harness, rawPath: string, session: TestSession): Promise<number> {
  const url = new URL(h.baseUrl);
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: url.hostname, port: url.port, path: rawPath, method: 'GET', headers: { cookie: session.cookie } }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.end();
  });
}

describe('rules allowlist table', () => {
  const table = new RouteTable(RULES_ALLOWLIST);

  it('covers every internal admin route in the rules registry doc', () => {
    const doc = readFileSync(path.resolve(here, '../../docs/codex/rules-registry.md'), 'utf8');
    const section = doc.slice(doc.indexOf('### Internal admin API'), doc.indexOf('### Published catalog'));
    const documented: Array<[string, string]> = [];
    for (const match of section.matchAll(/^\| (GET|POST|PUT|PATCH|DELETE) +\| `\/api\/admin\/rules\/([^`?]+)(?:\?[^`]*)?` +\|/gm)) {
      documented.push([match[1]!, match[2]!.replace(/:[A-Za-z]+/g, '1')]);
    }
    expect(documented).toHaveLength(12);
    expect(documented.filter(([method, p]) => table.lookup(method, p).kind !== 'match')).toEqual([]);
    expect(RULES_ALLOWLIST).toHaveLength(12);
  });

  it('requires rules:publish and recent auth exactly for publish, rollback, archive, and unarchive', () => {
    for (const route of RULES_ALLOWLIST) {
      const lifecycle = /\/(publish|rollback|archive|unarchive)$/.test(route.path);
      expect(route.recentAuth, route.path).toBe(lifecycle);
      if (lifecycle) expect(route.permission).toEqual(['rules:publish']);
      else expect(route.permission).toEqual([route.method === 'GET' ? 'rules:read' : 'rules:write']);
      expect(route.audited, route.path).toBe(route.method !== 'GET');
    }
  });

  it('does not expose the published catalog or traversal', () => {
    for (const p of ['catalog/manifest', '../catalog/manifest', 'entities/..', 'entities/%2e%2e/publish', 'entities/a%2Fb', 'entities//publish']) {
      for (const method of ['GET', 'POST']) expect(table.lookup(method, p).kind).toBe('not_found');
    }
  });
});

describe('rules proxy', () => {
  let h: Harness;
  let admin: TestSession;
  beforeAll(async () => {
    h = await startHarness();
    admin = await h.sessionFor(['platform_admin']);
  });
  afterAll(async () => {
    await h.close();
  });
  beforeEach(() => {
    h.store.audit.length = 0;
    h.upstreamCalls.length = 0;
    h.upstream.respond = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', etag: '"4"' } });
  });

  it('sends the actor and service token, passes If-Match, and returns the ETag', async () => {
    const res = await h.request(`${BASE}/entities/${ENTITY}/draft`, {
      method: 'PUT',
      session: admin,
      ...json({ data: { name: 'Fireball' } }, { 'if-match': '"3"', 'x-nexus-actor': 'forged', 'x-nexus-service-token': 'forged', authorization: 'Bearer x' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe('"4"');
    const call = h.upstreamCalls[0]!;
    expect(call.url).toBe(`${DOC_API_URL}/api/admin/rules/entities/${ENTITY}/draft`);
    expect(call.method).toBe('PUT');
    expect(call.headers['x-nexus-actor']).toBe(admin.user.id);
    expect(call.headers['x-nexus-service-token']).toBe(RULES_SERVICE_TOKEN);
    expect(call.headers['if-match']).toBe('"3"');
    expect(call.headers.cookie).toBeUndefined();
    expect(call.headers.authorization).toBeUndefined();
    expect(h.store.audit[0]).toMatchObject({ action: 'rules.entity.save_draft', outcome: 'success', resourceId: ENTITY, priorVersion: '"3"', summary: { fields: ['data'] } });
    expect(JSON.stringify(h.store.audit[0])).not.toContain('Fireball');
    expect(JSON.stringify(h.store.audit[0])).not.toContain(RULES_SERVICE_TOKEN);
  });

  it('relays a 409 revision conflict with the current head unchanged', async () => {
    const conflict = {
      error: 'expected revision 3 but the entity head is revision 5',
      code: 'revision_conflict',
      current: { id: 'rev-5', revisionNumber: 5, status: 'draft', data: { name: 'Fireball' } },
    };
    h.upstream.respond = () => new Response(JSON.stringify(conflict), { status: 409, headers: { 'content-type': 'application/json; charset=utf-8', etag: '"5"' } });
    const res = await h.request(`${BASE}/entities/${ENTITY}/publish`, { method: 'POST', session: admin, ...json({ expectedRevisionNumber: 3 }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(conflict);
    expect(res.headers.get('etag')).toBe('"5"');
    expect(h.store.audit).toHaveLength(1);
    expect(h.store.audit[0]).toMatchObject({ action: 'rules.entity.publish', outcome: 'conflict', priorVersion: '3', summary: { upstreamStatus: 409 } });
  });

  it('relays validation issues on 400 but normalizes 401 and 5xx', async () => {
    const invalid = { error: 'invalid request', code: 'bad_request', issues: [{ path: ['data', 'level'], code: 'too_big', message: 'Number must be less than or equal to 9' }] };
    h.upstream.respond = () => new Response(JSON.stringify(invalid), { status: 400, headers: { 'content-type': 'application/json' } });
    const bad = await h.request(`${BASE}/entities`, { method: 'POST', session: admin, ...json({ entityType: 'spell', ruleset: '2024', slug: 'x', data: {} }) });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual(invalid);

    h.upstream.respond = () => new Response(JSON.stringify({ error: 'service token missing or invalid', code: 'service_token_invalid' }), { status: 401, headers: { 'content-type': 'application/json' } });
    const refused = await h.request(`${BASE}/entities`, { session: admin });
    expect(refused.status).toBe(502);
    expect(await refused.json()).toMatchObject({ error: 'upstream_error' });

    h.upstream.respond = () => new Response(JSON.stringify({ error: 'rules registry request failed', stack: 'at prisma' }), { status: 500, headers: { 'content-type': 'application/json' } });
    const broken = await h.request(`${BASE}/entities/${ENTITY}`, { session: admin });
    expect(broken.status).toBe(502);
    expect(await broken.text()).not.toContain('prisma');
  });

  it('forwards a body-less transition without a content type', async () => {
    const res = await h.request(`${BASE}/entities/${ENTITY}/validate`, { method: 'POST', session: admin, headers: { 'if-match': '"3"' } });
    expect(res.status).toBe(200);
    const call = h.upstreamCalls[0]!;
    expect(call.headers['content-type']).toBeUndefined();
    expect(call.body).toBeNull();
    expect(call.headers['if-match']).toBe('"3"');
  });

  it('passes listed query keys and rejects everything else', async () => {
    const ok = await h.request(`${BASE}/entities?type=monster&ruleset=2014&status=published&q=dragon&archived=all&limit=50&offset=100`, { session: admin });
    expect(ok.status).toBe(200);
    expect(h.upstreamCalls[0]!.url).toBe(`${DOC_API_URL}/api/admin/rules/entities?type=monster&ruleset=2014&status=published&q=dragon&archived=all&limit=50&offset=100`);
    h.upstreamCalls.length = 0;
    for (const url of [
      `${BASE}/entities?type=class`,
      `${BASE}/entities?ruleset=2020`,
      `${BASE}/entities?sort=name`,
      `${BASE}/entities/${ENTITY}/diff?from=1&to=2&to=3`,
      `${BASE}/entities/${ENTITY}/diff?from=0&to=2`,
      `${BASE}/entities/${ENTITY}/preview?revision=abc`,
      `${BASE}/entities/${ENTITY}?expand=all`,
    ]) {
      const res = await h.request(url, { session: admin });
      expect(res.status, url).toBe(400);
    }
    expect(h.upstreamCalls).toHaveLength(0);
  });

  it('returns 404 for unlisted methods and paths, including encoded traversal', async () => {
    for (const [method, url] of [
      ['DELETE', `${BASE}/entities/${ENTITY}`],
      ['PATCH', `${BASE}/entities/${ENTITY}`],
      ['POST', `${BASE}/entities/${ENTITY}/draft`],
      ['GET', `${BASE}/catalog/manifest`],
      ['GET', `${BASE}/entities/${ENTITY}/revisions`],
      ['POST', `${BASE}/entities/${ENTITY}/delete`],
    ] as const) {
      const res = await h.request(url, { method, session: admin });
      expect(res.status, `${method} ${url}`).toBe(404);
    }
    for (const raw of [`${BASE}/entities/../../catalog/manifest`, `${BASE}/entities/%2e%2e/%2e%2e/catalog/manifest`, `${BASE}/entities/a%2Fb`, `${BASE}/entities/${ENTITY}/`]) {
      expect(await rawRequest(h, raw, admin), raw).toBe(404);
    }
    expect(h.upstreamCalls).toHaveLength(0);
  });

  it('rejects oversized or non-JSON bodies before contacting doc-api', async () => {
    const huge = await h.request(`${BASE}/entities`, { method: 'POST', session: admin, ...json({ data: { text: 'x'.repeat(600 * 1024) } }) });
    expect(huge.status).toBe(413);
    const form = await h.request(`${BASE}/entities/${ENTITY}/rollback`, { method: 'POST', session: admin, body: 'targetRevisionNumber=1', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect(form.status).toBe(415);
    expect(h.upstreamCalls).toHaveLength(0);
  });
});
