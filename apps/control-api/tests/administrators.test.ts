import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from './support/harness.js';

const json = (value: unknown): RequestInit => ({
  body: JSON.stringify(value),
  headers: { 'content-type': 'application/json' },
});

describe('administrators and audit routes', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(async () => {
    await h.close();
  });
  beforeEach(() => {
    h.store.audit.length = 0;
    h.store.roles.length = 0;
    h.store.sessions.clear();
    h.store.users.clear();
  });

  it('never revokes the last active platform_admin, and audits the conflict', async () => {
    const admin = await h.sessionFor(['platform_admin']);
    const res = await h.request('/control-api/v1/administrators/revocations', {
      method: 'POST',
      session: admin,
      ...json({ userId: admin.user.id, role: 'platform_admin' }),
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'last_platform_admin' });
    expect(await h.store.getActiveRoles(admin.user.id)).toEqual(['platform_admin']);
    expect(h.store.audit).toHaveLength(1);
    expect(h.store.audit[0]).toMatchObject({ action: 'admins.revoke_role', outcome: 'conflict', resourceId: admin.user.id });
  });

  it('does not count an inactive user as a remaining platform_admin', async () => {
    const admin = await h.sessionFor(['platform_admin']);
    const dormant = h.store.addUser({ email: 'dormant@example.com', isActive: false });
    h.store.addRole(dormant.id, 'platform_admin');
    const res = await h.request('/control-api/v1/administrators/revocations', {
      method: 'POST',
      session: admin,
      ...json({ userId: admin.user.id, role: 'platform_admin' }),
    });
    expect(res.status).toBe(409);
  });

  it('revokes a platform_admin when another remains, ending their sessions', async () => {
    const admin = await h.sessionFor(['platform_admin']);
    const other = await h.sessionFor(['platform_admin']);
    const res = await h.request('/control-api/v1/administrators/revocations', {
      method: 'POST',
      session: admin,
      ...json({ userId: other.user.id, role: 'platform_admin' }),
    });
    expect(res.status).toBe(200);
    expect(h.store.sessions.has(other.idHash)).toBe(false);
    expect(h.store.sessions.has(admin.idHash)).toBe(true);
    expect(h.store.audit.map((e) => [e.action, e.outcome, e.roleUsed])).toEqual([['admins.revoke_role', 'success', 'platform_admin']]);
    expect((await h.request('/control-api/v1/me', { session: other })).status).toBe(401);
  });

  it('grants a role to an existing Google user and rotates their sessions', async () => {
    const admin = await h.sessionFor(['platform_admin']);
    const target = await h.sessionFor(['auditor'], { email: 'Editor@Example.com' });
    const res = await h.request('/control-api/v1/administrators/grants', {
      method: 'POST',
      session: admin,
      ...json({ email: 'editor@example.com', role: 'content_editor' }),
    });
    expect(res.status).toBe(201);
    expect(await h.store.getActiveRoles(target.user.id)).toEqual(['auditor', 'content_editor']);
    expect(h.store.sessions.has(target.idHash)).toBe(false);
    expect(h.store.audit).toHaveLength(1);
    expect(h.store.audit[0]).toMatchObject({ outcome: 'success', resourceId: target.user.id, summary: { role: 'content_editor', result: 'granted' } });
  });

  it('reports duplicate grants and unknown users', async () => {
    const admin = await h.sessionFor(['platform_admin']);
    const dup = await h.request('/control-api/v1/administrators/grants', { method: 'POST', session: admin, ...json({ email: admin.user.email, role: 'platform_admin' }) });
    expect(dup.status).toBe(409);
    const discord = h.store.addUser({ email: 'discord@example.com', provider: 'discord' });
    const unknown = await h.request('/control-api/v1/administrators/grants', { method: 'POST', session: admin, ...json({ email: discord.email, role: 'auditor' }) });
    expect(unknown.status).toBe(404);
    expect(h.store.audit.map((e) => e.outcome)).toEqual(['conflict', 'failure']);
  });

  it('validates grant bodies strictly', async () => {
    const admin = await h.sessionFor(['platform_admin']);
    const bad = await h.request('/control-api/v1/administrators/grants', { method: 'POST', session: admin, ...json({ email: 'a@example.com', role: 'root' }) });
    expect(bad.status).toBe(400);
    const extra = await h.request('/control-api/v1/administrators/grants', { method: 'POST', session: admin, ...json({ email: 'a@example.com', role: 'auditor', isAdmin: true }) });
    expect(extra.status).toBe(400);
    const notJson = await h.request('/control-api/v1/administrators/grants', { method: 'POST', session: admin, body: 'email=a', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect(notJson.status).toBe(415);
  });

  it('lists administrators with their active roles', async () => {
    const admin = await h.sessionFor(['platform_admin']);
    await h.sessionFor(['auditor', 'operator'], { email: 'ops@example.com' });
    const res = await h.request('/control-api/v1/administrators', { session: admin });
    const body = (await res.json()) as { administrators: Array<{ email: string; roles: Array<{ role: string }> }> };
    const ops = body.administrators.find((a) => a.email === 'ops@example.com')!;
    expect(ops.roles.map((r) => r.role)).toEqual(['auditor', 'operator']);
  });

  it('pages audit events newest first', async () => {
    const auditor = await h.sessionFor(['auditor']);
    for (let i = 0; i < 5; i++) {
      await h.store.appendAudit({
        requestId: null, actorUserId: null, actorEmail: null, identityProvider: null, roleUsed: null,
        action: `test.${i}`, resourceType: null, resourceId: null, priorVersion: null, sourceIp: null,
        outcome: 'success', summary: { i },
      });
    }
    const first = (await (await h.request('/control-api/v1/audit/events?limit=3', { session: auditor })).json()) as { events: Array<{ action: string }>; nextCursor: string };
    expect(first.events.map((e) => e.action)).toEqual(['test.4', 'test.3', 'test.2']);
    const second = (await (await h.request(`/control-api/v1/audit/events?limit=3&before=${first.nextCursor}`, { session: auditor })).json()) as { events: Array<{ action: string }>; nextCursor: string | null };
    expect(second.events.map((e) => e.action)).toEqual(['test.1', 'test.0']);
    expect(second.nextCursor).toBeNull();
    expect((await h.request('/control-api/v1/audit/events?actor=x', { session: auditor })).status).toBe(400);
  });
});
