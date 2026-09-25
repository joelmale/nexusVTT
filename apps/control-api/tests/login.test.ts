import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { safeReturnTo } from '../src/routes/auth.js';
import { AUTH_TIME_SKEW_MS, LOGIN_STATE_TTL_MS, RECENT_AUTH_MS } from '../src/deps.js';
import { startHarness, type Harness } from './support/harness.js';

async function beginLogin(h: Harness, query = '') {
  const res = await h.request(`/control-api/v1/auth/login${query}`);
  expect(res.status).toBe(302);
  const cookies = res.headers.getSetCookie();
  const loginCookie = cookies.find((c) => c.startsWith('__Host-nexus_admin_login='))!;
  return { res, loginCookie, cookiePair: loginCookie.split(';')[0]!, state: h.idp.lastChecks!.state };
}

function callback(h: Harness, cookie: string | null, query: string) {
  return h.request(`/control-api/v1/auth/google/callback?${query}`, cookie ? { headers: { cookie } } : {});
}

describe('Google login flow', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(async () => {
    await h.close();
  });
  beforeEach(() => {
    // Each test gets a fresh login rate-limit window (20 per client per minute).
    h.clock.now = new Date(h.clock.now.getTime() + 120_000);
    h.store.audit.length = 0;
    h.store.identities.clear();
    h.store.users.clear();
    h.store.roles.length = 0;
    h.store.sessions.clear();
    h.idp.failExchange = false;
    h.idp.claims = { subject: 'google-sub-1', email: 'Admin@Example.com', emailVerified: true, authTime: null };
  });

  const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

  const seedAdmin = () => {
    const user = h.store.addUser({ email: 'admin@example.com' });
    h.store.addRole(user.id, 'platform_admin');
    return user;
  };

  it('redirects to Google and stores login state in a short-lived Lax __Host- cookie', async () => {
    const { res, loginCookie } = await beginLogin(h);
    expect(res.headers.get('location')).toMatch(/^https:\/\/accounts\.google\.com\//);
    expect(loginCookie).toMatch(/^__Host-nexus_admin_login=[^;]+; Path=\/; Max-Age=600; Secure; HttpOnly; SameSite=Lax$/);
    expect(loginCookie).not.toMatch(/Domain=/i);
    // The sealed cookie does not expose state, nonce, or verifier.
    const checks = h.idp.lastChecks!;
    for (const secret of [checks.state, checks.nonce, checks.codeVerifier]) expect(loginCookie).not.toContain(secret);
  });

  it('creates a session, binds the Google subject, and audits one success', async () => {
    const user = seedAdmin();
    const { cookiePair, state } = await beginLogin(h);
    const res = await callback(h, cookiePair, `code=abc&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
    const cookies = res.headers.getSetCookie();
    const session = cookies.find((c) => c.startsWith('__Host-nexus_admin='))!;
    expect(session).toMatch(/^__Host-nexus_admin=[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}; Path=\/; Max-Age=43200; Secure; HttpOnly; SameSite=Strict$/);
    expect(cookies.some((c) => c.startsWith('__Host-nexus_admin_login=; Path=/; Max-Age=0'))).toBe(true);

    expect(h.store.identities.get(user.id)).toBe('google-sub-1');
    expect(h.store.sessions.size).toBe(1);
    const stored = [...h.store.sessions.values()][0]!;
    const rawId = session.split('=')[1]!.split('.')[0]!;
    expect(stored.idHash).not.toContain(rawId);
    expect(stored.idHash).toMatch(/^[0-9a-f]{64}$/);

    expect(h.store.audit).toHaveLength(1);
    expect(h.store.audit[0]).toMatchObject({ action: 'auth.login', outcome: 'success', actorUserId: user.id, identityProvider: 'google' });
    const me = await h.request('/control-api/v1/me', { headers: { cookie: session.split(';')[0]! } });
    expect(me.status).toBe(200);
  });

  it('links a verified Google identity to a password account without changing its VTT provider', async () => {
    const user = h.store.addUser({ email: 'admin@example.com', provider: 'local' });
    h.store.addRole(user.id, 'platform_admin');
    const { cookiePair, state } = await beginLogin(h);

    const res = await callback(h, cookiePair, `code=abc&state=${state}`);

    expect(res.status).toBe(302);
    expect(h.store.identities.get(user.id)).toBe('google-sub-1');
    expect(h.store.users.get(user.id)?.provider).toBe('local');
    expect(h.store.audit[0]).toMatchObject({
      action: 'auth.login',
      outcome: 'success',
      actorUserId: user.id,
      identityProvider: 'google',
    });
  });

  it('rotates: a login replaces the session the browser already had', async () => {
    const user = seedAdmin();
    const old = await h.sessionFor(['platform_admin'], { user });
    const { cookiePair, state } = await beginLogin(h);
    const res = await callback(h, `${cookiePair}; ${old.cookie}`, `code=abc&state=${state}`);
    expect(res.status).toBe(302);
    expect(h.store.sessions.has(old.idHash)).toBe(false);
    expect(h.store.sessions.size).toBe(1);
  });

  it('honours a same-origin returnTo only', async () => {
    seedAdmin();
    const { cookiePair, state } = await beginLogin(h, '?returnTo=%2Fdocuments%3Fpage%3D2');
    const res = await callback(h, cookiePair, `code=abc&state=${state}`);
    expect(res.headers.get('location')).toBe('/documents?page=2');
    expect(safeReturnTo('//evil.example/x')).toBeNull();
    expect(safeReturnTo('/\\evil.example')).toBeNull();
    expect(safeReturnTo('https://evil.example')).toBeNull();
    expect(safeReturnTo('/ok')).toBe('/ok');
  });

  it('accepts only same-origin relative paths for returnTo', () => {
    for (const ok of ['/', '/documents', '/documents?page=2&q=a%20b', '/rules/entities/abc#history', '/a/./b', '/%2F%2Fevil.example']) {
      expect(safeReturnTo(ok), ok).toBe(ok);
    }
    for (const bad of [
      '', 'documents', './x', '../x', '//evil.example', '///evil.example', '/\\evil.example', '\\\\evil.example',
      '/x\\y', 'https://evil.example/x', 'http:/evil.example', 'javascript:alert(1)', 'data:text/html,x',
      '/ok\r\nSet-Cookie: x=1', '/ok\nx', '/ok\tx', '/ok x', '/ok\u0000', '/ok\u007f', '/café', `/${'a'.repeat(512)}`,
      42, null, undefined, ['/ok'],
    ]) {
      expect(safeReturnTo(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('ignores an unsafe returnTo and redirects to / after login', async () => {
    seedAdmin();
    const { cookiePair, state } = await beginLogin(h, `?returnTo=${encodeURIComponent('//evil.example/phish')}`);
    const res = await callback(h, cookiePair, `code=abc&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
  });

  const failures: Array<[string, () => void, (h: Harness, cookie: string, state: string) => Promise<Response>, number, string]> = [
    ['missing login cookie', () => undefined, (hh, _c, state) => callback(hh, null, `code=abc&state=${state}`), 400, 'invalid_login_state'],
    ['bad state', () => undefined, (hh, c) => callback(hh, c, 'code=abc&state=forged-state-value-000000'), 400, 'state_mismatch'],
    ['IdP error response', () => undefined, (hh, c, state) => callback(hh, c, `error=access_denied&state=${state}`), 400, 'idp_error'],
    ['bad nonce / token validation', () => { h.idp.failExchange = true; }, (hh, c, state) => callback(hh, c, `code=abc&state=${state}`), 400, 'token_validation_failed'],
    ['unverified email', () => { h.idp.claims = { ...h.idp.claims, emailVerified: false }; }, (hh, c, state) => callback(hh, c, `code=abc&state=${state}`), 403, 'email_unverified'],
    ['unknown user', () => { h.idp.claims = { ...h.idp.claims, email: 'stranger@example.com' }; }, (hh, c, state) => callback(hh, c, `code=abc&state=${state}`), 403, 'unknown_user'],
    ['subject mismatch', () => { h.store.identities.set([...h.store.users.values()][0]!.id, 'other-subject'); }, (hh, c, state) => callback(hh, c, `code=abc&state=${state}`), 403, 'subject_mismatch'],
    ['subject bound to another user', () => { const other = h.store.addUser({ email: 'other@example.com' }); h.store.identities.set(other.id, 'google-sub-1'); }, (hh, c, state) => callback(hh, c, `code=abc&state=${state}`), 403, 'subject_mismatch'],
    ['no active role', () => { h.store.roles.length = 0; }, (hh, c, state) => callback(hh, c, `code=abc&state=${state}`), 403, 'no_active_role'],
  ];

  for (const [name, arrange, act, status, reason] of failures) {
    it(`refuses login: ${name}`, async () => {
      seedAdmin();
      arrange();
      const { cookiePair, state } = await beginLogin(h);
      const checks = h.idp.lastChecks!;
      const res = await act(h, cookiePair, state);
      expect(res.status).toBe(status);
      expect(await res.json()).toMatchObject({ error: reason });
      expect(res.headers.getSetCookie().some((c) => /^__Host-nexus_admin=[^;]/.test(c))).toBe(false);
      expect(h.store.sessions.size).toBe(0);
      expect(h.store.audit).toHaveLength(1);
      expect(h.store.audit[0]).toMatchObject({ action: 'auth.login', summary: { reason } });
      const serialized = JSON.stringify(h.store.audit);
      for (const secret of [checks.state, checks.nonce, checks.codeVerifier, 'code=abc']) expect(serialized).not.toContain(secret);
      if (reason === 'no_active_role') expect(h.store.identities.size).toBe(0);
    });
  }

  it('refuses expired login state', async () => {
    seedAdmin();
    const { cookiePair, state } = await beginLogin(h);
    const start = h.clock.now;
    try {
      h.clock.now = new Date(start.getTime() + LOGIN_STATE_TTL_MS + 1000);
      const res = await callback(h, cookiePair, `code=abc&state=${state}`);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'invalid_login_state' });
    } finally {
      h.clock.now = start;
    }
  });

  describe('recent authentication', () => {
    const sessionFromLogin = () => [...h.store.sessions.values()][0]!;

    it('asks Google for an account chooser on a normal login, not a forced re-authentication', async () => {
      await beginLogin(h);
      expect(h.idp.lastOptions).toEqual({ stepUp: false });
    });

    it('asks Google to re-authenticate on a step-up login', async () => {
      await beginLogin(h, `?stepUp=1&returnTo=${encodeURIComponent('/rules/x')}`);
      expect(h.idp.lastOptions).toEqual({ stepUp: true });
      await beginLogin(h, '?stepUp=true');
      expect(h.idp.lastOptions).toEqual({ stepUp: false });
    });

    it('does not treat a normal login without auth_time as recent authentication', async () => {
      seedAdmin();
      const { cookiePair, state } = await beginLogin(h);
      const res = await callback(h, cookiePair, `code=abc&state=${state}`);
      expect(res.status).toBe(302);
      expect(sessionFromLogin().recentAuthAt.getTime()).toBe(0);
      const cookie = res.headers.getSetCookie().find((c) => c.startsWith('__Host-nexus_admin='))!.split(';')[0]!;
      const me = (await (await h.request('/control-api/v1/me', { headers: { cookie } })).json()) as { recentAuthUntil: string };
      expect(new Date(me.recentAuthUntil).getTime()).toBeLessThan(h.clock.now.getTime());
      // A step-up route is refused until a real re-authentication.
      const grant = await h.request('/control-api/v1/administrators/grants', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': sessionFromLogin().csrfToken },
        body: JSON.stringify({ email: 'admin@example.com', role: 'auditor' }),
      });
      expect(grant.status).toBe(401);
      expect(await grant.json()).toMatchObject({ error: 'reauth_required' });
    });

    it('records a fresh auth_time from a normal login as recent authentication', async () => {
      seedAdmin();
      const { cookiePair, state } = await beginLogin(h);
      h.idp.claims = { ...h.idp.claims, authTime: seconds(h.clock.now) };
      const res = await callback(h, cookiePair, `code=abc&state=${state}`);
      expect(res.status).toBe(302);
      expect(sessionFromLogin().recentAuthAt.getTime()).toBe(seconds(h.clock.now) * 1000);
    });

    it('sets recent_auth_at from auth_time on a step-up login', async () => {
      const user = seedAdmin();
      const { cookiePair, state } = await beginLogin(h, '?stepUp=1');
      const authTime = seconds(h.clock.now) + 5;
      h.clock.now = new Date(h.clock.now.getTime() + 20_000);
      h.idp.claims = { ...h.idp.claims, authTime };
      const res = await callback(h, cookiePair, `code=abc&state=${state}`);
      expect(res.status).toBe(302);
      expect(sessionFromLogin().recentAuthAt.getTime()).toBe(authTime * 1000);
      expect(h.store.audit[0]).toMatchObject({ outcome: 'success', actorUserId: user.id, summary: { stepUp: true, recentAuth: true } });
    });

    const stale: Array<[string, (start: Date) => number | null]> = [
      ['missing auth_time', () => null],
      ['auth_time from an older Google session', (start) => seconds(start) - Math.ceil(AUTH_TIME_SKEW_MS / 1000) - 60],
      ['auth_time an hour before the step-up', (start) => seconds(start) - 3600],
      ['auth_time in the future', (start) => seconds(start) + 3600],
    ];
    for (const [name, authTimeFor] of stale) {
      it(`refuses a step-up login with ${name}`, async () => {
        seedAdmin();
        const start = h.clock.now;
        const { cookiePair, state } = await beginLogin(h, '?stepUp=1');
        h.idp.claims = { ...h.idp.claims, authTime: authTimeFor(start) };
        const res = await callback(h, cookiePair, `code=abc&state=${state}`);
        expect(res.status).toBe(401);
        expect(await res.json()).toMatchObject({ error: 'reauth_not_fresh' });
        expect(res.headers.getSetCookie().some((c) => /^__Host-nexus_admin=[^;]/.test(c))).toBe(false);
        expect(h.store.sessions.size).toBe(0);
        expect(h.store.audit).toHaveLength(1);
        expect(h.store.audit[0]).toMatchObject({ action: 'auth.login', outcome: 'denied', summary: { reason: 'reauth_not_fresh' } });
      });
    }

    it('accepts auth_time within the clock skew before the step-up started', async () => {
      seedAdmin();
      const start = h.clock.now;
      const { cookiePair, state } = await beginLogin(h, '?stepUp=1');
      h.idp.claims = { ...h.idp.claims, authTime: seconds(start) - Math.floor(AUTH_TIME_SKEW_MS / 1000) + 1 };
      const res = await callback(h, cookiePair, `code=abc&state=${state}`);
      expect(res.status).toBe(302);
      const recent = sessionFromLogin().recentAuthAt.getTime();
      expect(h.clock.now.getTime() - recent).toBeLessThan(RECENT_AUTH_MS);
    });
  });

  describe('login rate limits', () => {
    const fromIp = (ip: string, path = '/control-api/v1/auth/login') => h.request(path, { headers: { 'x-forwarded-for': ip } });

    it('limits one client IP without blocking another', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 21; i++) statuses.push((await fromIp('203.0.113.7')).status);
      expect(statuses.slice(0, 20).every((status) => status === 302)).toBe(true);
      expect(statuses[20]).toBe(429);
      const limited = await fromIp('203.0.113.7');
      expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
      expect((await fromIp('198.51.100.20')).status).toBe(302);
    });

    it('does not count or limit the callback', async () => {
      seedAdmin();
      const { cookiePair, state } = await beginLogin(h);
      for (let i = 0; i < 30; i++) {
        const res = await callback(h, null, `code=abc&state=${state}`);
        expect(res.status).toBe(400);
      }
      // Thirty callbacks later the sign-in still completes...
      const done = await callback(h, cookiePair, `code=abc&state=${state}`);
      expect(done.status).toBe(302);
      // ...and the client still has its remaining 19 login starts.
      for (let i = 0; i < 19; i++) expect((await h.request('/control-api/v1/auth/login')).status).toBe(302);
      expect((await h.request('/control-api/v1/auth/login')).status).toBe(429);
      // An exhausted client's callbacks are still processed, not rate limited.
      expect((await callback(h, null, `code=abc&state=${state}`)).status).toBe(400);
    });

    it('applies a global cap only to floods from many addresses', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 300; i++) statuses.push((await fromIp(`192.0.2.${Math.floor(i / 20) + 1}`)).status);
      expect(statuses.every((status) => status === 302)).toBe(true);
      expect((await fromIp('192.0.2.200')).status).toBe(429);
      // A single client over its own limit does not drain the shared budget.
      h.clock.now = new Date(h.clock.now.getTime() + 120_000);
      for (let i = 0; i < 100; i++) await fromIp('192.0.2.201');
      expect((await fromIp('192.0.2.202')).status).toBe(302);
    });
  });

  it('refuses login for an inactive users row', async () => {
    const user = seedAdmin();
    h.store.users.get(user.id)!.isActive = false;
    const { cookiePair, state } = await beginLogin(h);
    const res = await callback(h, cookiePair, `code=abc&state=${state}`);
    expect(res.status).toBe(403);
  });
});
