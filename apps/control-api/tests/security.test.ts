import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ABSOLUTE_LIFETIME_MS, IDLE_TIMEOUT_MS, RECENT_AUTH_MS } from '../src/deps.js';
import { parseCookies } from '../src/http/cookies.js';
import { ADMIN_ORIGIN, startHarness, type Harness } from './support/harness.js';

const json = (value: unknown): RequestInit => ({
  body: JSON.stringify(value),
  headers: { 'content-type': 'application/json' },
});

describe('browser security controls', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(async () => {
    await h.close();
  });
  beforeEach(() => {
    h.store.audit.length = 0;
    h.upstreamCalls.length = 0;
  });

  describe('CSRF and Origin', () => {
    it('rejects a mutation without an Origin header', async () => {
      const s = await h.sessionFor(['platform_admin']);
      const res = await h.request('/control-api/v1/codex/admin/documents/abc/reprocess', { method: 'POST', session: s, origin: null });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: 'origin_mismatch' });
      expect(h.upstreamCalls).toHaveLength(0);
      expect(h.store.audit).toHaveLength(1);
      expect(h.store.audit[0]).toMatchObject({ outcome: 'denied', summary: { reason: 'origin_mismatch' } });
    });

    it('rejects a mutation from a foreign Origin', async () => {
      const s = await h.sessionFor(['platform_admin']);
      const res = await h.request('/control-api/v1/codex/admin/documents/abc/reprocess', { method: 'POST', session: s, origin: 'https://evil.example' });
      expect(res.status).toBe(403);
      expect(h.upstreamCalls).toHaveLength(0);
    });

    it('rejects a mutation without the CSRF header', async () => {
      const s = await h.sessionFor(['platform_admin']);
      const res = await h.request('/control-api/v1/codex/admin/documents/abc/reprocess', { method: 'POST', session: s, csrf: false });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: 'csrf_failed' });
      expect(h.store.audit).toHaveLength(1);
    });

    it("rejects another session's CSRF token", async () => {
      const s = await h.sessionFor(['platform_admin']);
      const other = await h.sessionFor(['platform_admin']);
      const res = await h.request('/control-api/v1/auth/logout', { method: 'POST', session: s, csrf: other.csrfToken });
      expect(res.status).toBe(403);
      expect(h.store.sessions.has(s.idHash)).toBe(true);
    });

    it('accepts a mutation with matching Origin and CSRF token', async () => {
      const s = await h.sessionFor(['platform_admin']);
      const res = await h.request('/control-api/v1/codex/admin/documents/abc/reprocess', { method: 'POST', session: s });
      expect(res.status).toBe(200);
      expect(h.upstreamCalls).toHaveLength(1);
    });

    it('does not require CSRF for GET', async () => {
      const s = await h.sessionFor(['auditor']);
      const res = await h.request('/control-api/v1/codex/admin/stats', { session: s, csrf: false });
      expect(res.status).toBe(200);
    });

    it('answers no CORS preflight', async () => {
      const res = await h.request('/control-api/v1/me', { method: 'OPTIONS', origin: 'https://evil.example' });
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
      expect(res.status).toBe(404);
    });
  });

  describe('recent authentication', () => {
    const cases = [
      ['codex delete', 'DELETE', '/control-api/v1/codex/admin/documents/abc', undefined],
      ['index recreate', 'POST', '/control-api/v1/codex/admin/elasticsearch/recreate-index', undefined],
      ['index clear', 'DELETE', '/control-api/v1/codex/admin/elasticsearch/clear', undefined],
      ['grant role', 'POST', '/control-api/v1/administrators/grants', { email: 'x@example.com', role: 'auditor' }],
      ['revoke role', 'POST', '/control-api/v1/administrators/revocations', { userId: '0b6f1c1e-3b7a-4d7e-9a51-4a4a2d6f9c11', role: 'auditor' }],
    ] as const;

    for (const [name, method, path, body] of cases) {
      it(`requires a login within 10 minutes for ${name}`, async () => {
        const s = await h.sessionFor(['platform_admin'], { recentAuthAgoMs: RECENT_AUTH_MS + 1000 });
        const res = await h.request(path, { method, session: s, ...(body ? json(body) : {}) });
        expect(res.status).toBe(401);
        expect(await res.json()).toMatchObject({ error: 'reauth_required' });
        expect(h.upstreamCalls).toHaveLength(0);
        expect(h.store.audit).toHaveLength(1);
        expect(h.store.audit[0]).toMatchObject({ outcome: 'denied', summary: { reason: 'reauth_required' } });
      });
    }

    it('does not require recent auth for ordinary writes', async () => {
      const s = await h.sessionFor(['content_editor'], { recentAuthAgoMs: RECENT_AUTH_MS * 5 });
      const res = await h.request('/control-api/v1/codex/admin/documents/abc/reprocess', { method: 'POST', session: s });
      expect(res.status).toBe(200);
    });

    it('reports recentAuthUntil on /me', async () => {
      const s = await h.sessionFor(['auditor'], { recentAuthAgoMs: 60_000 });
      const res = await h.request('/control-api/v1/me', { session: s });
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.recentAuthUntil).toBe(new Date(h.clock.now.getTime() - 60_000 + RECENT_AUTH_MS).toISOString());
      expect(body.csrfToken).toBe(s.csrfToken);
      expect(body.roles).toEqual(['auditor']);
      expect(body.permissions).toEqual(['codex:read', 'audit:read']);
    });
  });

  describe('sessions', () => {
    it('expires at the absolute lifetime even when active', async () => {
      const s = await h.sessionFor(['auditor']);
      const start = h.clock.now;
      try {
        // Stay active every 20 minutes until just past 12 hours.
        let t = start.getTime();
        while (t + 20 * 60_000 < start.getTime() + ABSOLUTE_LIFETIME_MS) {
          t += 20 * 60_000;
          h.clock.now = new Date(t);
          expect((await h.request('/control-api/v1/me', { session: s })).status).toBe(200);
        }
        h.clock.now = new Date(start.getTime() + ABSOLUTE_LIFETIME_MS);
        const res = await h.request('/control-api/v1/me', { session: s });
        expect(res.status).toBe(401);
        expect(h.store.sessions.has(s.idHash)).toBe(false);
      } finally {
        h.clock.now = start;
      }
    });

    it('slides the idle timeout on activity', async () => {
      const s = await h.sessionFor(['auditor']);
      const start = h.clock.now;
      try {
        h.clock.now = new Date(start.getTime() + IDLE_TIMEOUT_MS - 1000);
        expect((await h.request('/control-api/v1/me', { session: s })).status).toBe(200);
        h.clock.now = new Date(start.getTime() + 2 * IDLE_TIMEOUT_MS - 2000);
        expect((await h.request('/control-api/v1/me', { session: s })).status).toBe(200);
      } finally {
        h.clock.now = start;
      }
    });

    it('rejects a forged or tampered session cookie', async () => {
      const s = await h.sessionFor(['platform_admin']);
      const tampered = { ...s, cookie: `${s.cookie.slice(0, -2)}xx` };
      const res = await h.request('/control-api/v1/me', { session: tampered });
      expect(res.status).toBe(401);
    });

    it('logout deletes the session, clears the cookie, and is audited once', async () => {
      const s = await h.sessionFor(['auditor']);
      const res = await h.request('/control-api/v1/auth/logout', { method: 'POST', session: s });
      expect(res.status).toBe(204);
      expect(h.store.sessions.has(s.idHash)).toBe(false);
      expect(res.headers.get('set-cookie')).toMatch(/^__Host-nexus_admin=; Path=\/; Max-Age=0; Secure; HttpOnly; SameSite=Strict$/);
      expect(h.store.audit.map((e) => [e.action, e.outcome])).toEqual([['auth.logout', 'success']]);
      expect((await h.request('/control-api/v1/me', { session: s })).status).toBe(401);
    });
  });

  describe('request IDs and headers', () => {
    it('reuses an inbound UUID request ID', async () => {
      const id = '6f1c2b8a-3d4e-4f5a-8b9c-0d1e2f3a4b5c';
      const res = await h.request('/control-api/v1/me', { headers: { 'x-request-id': id } });
      expect(res.headers.get('x-request-id')).toBe(id);
      expect(((await res.json()) as { requestId: string }).requestId).toBe(id);
    });

    it('replaces a non-UUID request ID', async () => {
      const res = await h.request('/control-api/v1/me', { headers: { 'x-request-id': 'not-a-uuid' } });
      expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('sets no-store and a restrictive CSP on API responses', async () => {
      const res = await h.request('/control-api/v1/me');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
      expect(res.headers.get('x-powered-by')).toBeNull();
    });

    it('serves liveness and readiness without detail', async () => {
      expect(await (await h.request('/healthz')).text()).toBe('ok');
      expect((await h.request('/readyz')).status).toBe(200);
      h.store.failPing = true;
      try {
        const res = await h.request('/readyz');
        expect(res.status).toBe(503);
        expect(await res.text()).toBe('unavailable');
      } finally {
        h.store.failPing = false;
      }
    });
  });

  describe('rate limits', () => {
    it('limits one session to 300 API requests per minute', async () => {
      const start = h.clock.now;
      try {
        h.clock.now = new Date(start.getTime() + 3_600_000); // fresh window
        const s = await h.sessionFor(['auditor']);
        const s2 = await h.sessionFor(['auditor']);
        const statuses: number[] = [];
        for (let i = 0; i < 301; i++) statuses.push((await h.request('/control-api/v1/me', { session: s2 })).status);
        expect(statuses.slice(0, 300).every((status) => status === 200)).toBe(true);
        const limited = await h.request('/control-api/v1/me', { session: s2 });
        expect(limited.status).toBe(429);
        expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
        // Other sessions are unaffected.
        expect((await h.request('/control-api/v1/me', { session: s })).status).toBe(200);
      } finally {
        h.clock.now = start;
      }
    });

    it('limits login attempts to 10 per client per minute', async () => {
      const start = h.clock.now;
      try {
        h.clock.now = new Date(start.getTime() + 7_200_000);
        const statuses: number[] = [];
        for (let i = 0; i < 11; i++) statuses.push((await h.request('/control-api/v1/auth/login')).status);
        expect(statuses.slice(0, 10).every((status) => status === 302)).toBe(true);
        expect(statuses[10]).toBe(429);
      } finally {
        h.clock.now = start;
      }
    });
  });

  it('never serves routes outside /control-api/v1 other than health', async () => {
    expect((await h.request('/api/admin/stats')).status).toBe(404);
    expect((await h.request('/control-api/v2/me')).status).toBe(404);
    expect((await h.request('/CONTROL-API/v1/me')).status).toBe(404);
  });

  it('uses the configured admin origin constant', () => {
    expect(ADMIN_ORIGIN).toBe('https://admin.internal.nexusvtt.com');
    expect(parseCookies('a=1; b="2"; a=3')).toEqual(new Map([['a', '1'], ['b', '2']]));
  });
});
