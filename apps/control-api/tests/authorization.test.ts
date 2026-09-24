import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { IDLE_TIMEOUT_MS } from '../src/deps.js';
import { ROLES, type Role } from '../src/permissions.js';
import { startHarness, type Harness, type TestSession } from './support/harness.js';
import { codexStub, uploadForm } from './support/upstreams.js';

interface RouteCase {
  name: string;
  allowed: readonly Role[];
  mutation: boolean;
  successStatus: number;
  /** Builds the request; may create fixtures (target users) first. */
  send: (h: Harness, session?: TestSession) => Promise<Response>;
}

const json = (value: unknown): RequestInit => ({
  body: JSON.stringify(value),
  headers: { 'content-type': 'application/json' },
});

const DOC = '0b6f1c1e-3b7a-4d7e-9a51-4a4a2d6f9c11';

const ROUTES: RouteCase[] = [
  { name: 'GET /me', allowed: ROLES, mutation: false, successStatus: 200, send: (h, s) => h.request('/control-api/v1/me', { session: s }) },
  { name: 'POST /auth/logout', allowed: ROLES, mutation: true, successStatus: 204, send: (h, s) => h.request('/control-api/v1/auth/logout', { method: 'POST', session: s }) },
  { name: 'GET /audit/events', allowed: ['platform_admin', 'operator', 'auditor'], mutation: false, successStatus: 200, send: (h, s) => h.request('/control-api/v1/audit/events', { session: s }) },
  { name: 'GET /administrators', allowed: ['platform_admin'], mutation: false, successStatus: 200, send: (h, s) => h.request('/control-api/v1/administrators', { session: s }) },
  {
    name: 'POST /administrators/grants',
    allowed: ['platform_admin'],
    mutation: true,
    successStatus: 201,
    send: (h, s) => {
      const target = h.store.addUser({ email: `target-${Math.random()}@example.com` });
      return h.request('/control-api/v1/administrators/grants', { method: 'POST', session: s, ...json({ email: target.email, role: 'auditor' }) });
    },
  },
  {
    name: 'POST /administrators/revocations',
    allowed: ['platform_admin'],
    mutation: true,
    successStatus: 200,
    send: (h, s) => {
      const target = h.store.addUser({ email: `target-${Math.random()}@example.com` });
      h.store.addRole(target.id, 'auditor');
      return h.request('/control-api/v1/administrators/revocations', { method: 'POST', session: s, ...json({ userId: target.id, role: 'auditor' }) });
    },
  },
  { name: 'codex read', allowed: ROLES, mutation: false, successStatus: 200, send: (h, s) => h.request('/control-api/v1/codex/admin/stats', { session: s }) },
  { name: 'codex write', allowed: ['platform_admin', 'content_editor'], mutation: true, successStatus: 200, send: (h, s) => h.request(`/control-api/v1/codex/admin/documents/${DOC}`, { method: 'PATCH', session: s, ...json({ title: 'x' }) }) },
  { name: 'codex delete', allowed: ['platform_admin'], mutation: true, successStatus: 200, send: (h, s) => h.request(`/control-api/v1/codex/admin/documents/${DOC}`, { method: 'DELETE', session: s }) },
  { name: 'codex merge duplicates', allowed: ['platform_admin'], mutation: true, successStatus: 200, send: (h, s) => h.request('/control-api/v1/codex/deduplication/merge', { method: 'POST', session: s, ...json({ primaryId: DOC, duplicateIds: [DOC] }) }) },
  { name: 'codex index reindex', allowed: ['platform_admin'], mutation: true, successStatus: 200, send: (h, s) => h.request('/control-api/v1/codex/admin/elasticsearch/reindex?force=true', { method: 'POST', session: s }) },
  { name: 'codex queue retry', allowed: ['platform_admin', 'content_editor', 'operator'], mutation: true, successStatus: 200, send: (h, s) => h.request('/control-api/v1/codex/admin/queue/jobs/42/retry', { method: 'POST', session: s }) },
  { name: 'codex queue clean', allowed: ['platform_admin', 'operator'], mutation: true, successStatus: 200, send: (h, s) => h.request('/control-api/v1/codex/admin/queue/clean', { method: 'POST', session: s, ...json({ olderThanDays: 7 }) }) },
  { name: 'codex queue job remove', allowed: ['platform_admin'], mutation: true, successStatus: 200, send: (h, s) => h.request('/control-api/v1/codex/admin/queue/jobs/42', { method: 'DELETE', session: s }) },
  { name: 'codex alert acknowledge', allowed: ['platform_admin', 'operator'], mutation: true, successStatus: 200, send: (h, s) => h.request('/control-api/v1/codex/admin/alerts/alert_1_abc/acknowledge', { method: 'POST', session: s }) },
  { name: 'codex server-side upload', allowed: ['platform_admin', 'content_editor'], mutation: true, successStatus: 201, send: (h, s) => h.request('/control-api/v1/codex/documents/upload', { method: 'POST', session: s, body: uploadForm({ title: 'Doc' }) }) },
  { name: 'codex page image', allowed: ROLES, mutation: false, successStatus: 200, send: (h, s) => h.request(`/control-api/v1/codex/documents/${DOC}/pages/1/image`, { session: s }) },

  // Operations
  { name: 'GET /operations/summary', allowed: ['platform_admin', 'operator', 'auditor'], mutation: false, successStatus: 200, send: (h, s) => h.request('/control-api/v1/operations/summary', { session: s }) },

  // Assets
  { name: 'assets list', allowed: ROLES, mutation: false, successStatus: 200, send: (h, s) => h.request('/control-api/v1/assets/assets?limit=10', { session: s }) },
  { name: 'assets integrity', allowed: ROLES, mutation: false, successStatus: 200, send: (h, s) => h.request('/control-api/v1/assets/integrity', { session: s }) },
  { name: 'assets delete-preview', allowed: ROLES, mutation: false, successStatus: 200, send: (h, s) => h.request('/control-api/v1/assets/assets/adm-1/delete-preview', { method: 'POST', session: s, ...json({ referencingCampaignIds: [] }) }) },
  { name: 'assets metadata update', allowed: ['platform_admin', 'content_editor'], mutation: true, successStatus: 200, send: (h, s) => h.request('/control-api/v1/assets/assets/adm-1', { method: 'PATCH', session: s, ...json({ name: 'Goblin', expectedVersion: 2 }) }) },
  {
    name: 'assets upload',
    allowed: ['platform_admin', 'content_editor'],
    mutation: true,
    successStatus: 200,
    send: (h, s) => {
      const form = new FormData();
      form.append('category', 'tokens');
      form.append('file', new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }), 'goblin.png');
      return h.request('/control-api/v1/assets/assets', { method: 'POST', session: s, body: form });
    },
  },
  { name: 'assets quarantine', allowed: ['platform_admin', 'content_editor'], mutation: true, successStatus: 200, send: (h, s) => h.request('/control-api/v1/assets/assets/adm-1/quarantine', { method: 'POST', session: s, ...json({ expectedVersion: 2 }) }) },
  { name: 'assets manifest rebuild', allowed: ['platform_admin', 'content_editor'], mutation: true, successStatus: 200, send: (h, s) => h.request('/control-api/v1/assets/jobs/manifest-rebuild?wait=true', { method: 'POST', session: s }) },
  { name: 'assets permanent delete', allowed: ['platform_admin'], mutation: true, successStatus: 200, send: (h, s) => h.request('/control-api/v1/assets/assets/adm-1/permanent-delete', { method: 'POST', session: s, ...json({ expectedVersion: 3, confirm: true }) }) },

  // Rules
  { name: 'rules list', allowed: ['platform_admin', 'content_editor', 'auditor'], mutation: false, successStatus: 200, send: (h, s) => h.request('/control-api/v1/rules/entities?type=spell&ruleset=2024', { session: s }) },
  { name: 'rules create', allowed: ['platform_admin', 'content_editor'], mutation: true, successStatus: 200, send: (h, s) => h.request('/control-api/v1/rules/entities', { method: 'POST', session: s, ...json({ entityType: 'spell', ruleset: '2024', slug: 'fireball', data: {}, sourceLicense: 'srd-5.2' }) }) },
  { name: 'rules save draft', allowed: ['platform_admin', 'content_editor'], mutation: true, successStatus: 200, send: (h, s) => h.request(`/control-api/v1/rules/entities/${DOC}/draft`, { method: 'PUT', session: s, headers: { 'content-type': 'application/json', 'if-match': '"3"' }, body: JSON.stringify({ data: {} }) }) },
  { name: 'rules validate', allowed: ['platform_admin', 'content_editor'], mutation: true, successStatus: 200, send: (h, s) => h.request(`/control-api/v1/rules/entities/${DOC}/validate`, { method: 'POST', session: s, ...json({ expectedRevisionNumber: 3 }) }) },
  { name: 'rules publish', allowed: ['platform_admin'], mutation: true, successStatus: 200, send: (h, s) => h.request(`/control-api/v1/rules/entities/${DOC}/publish`, { method: 'POST', session: s, ...json({ expectedRevisionNumber: 3 }) }) },
  { name: 'rules rollback', allowed: ['platform_admin'], mutation: true, successStatus: 200, send: (h, s) => h.request(`/control-api/v1/rules/entities/${DOC}/rollback`, { method: 'POST', session: s, ...json({ expectedRevisionNumber: 4, targetRevisionNumber: 2 }) }) },
  { name: 'rules archive', allowed: ['platform_admin'], mutation: true, successStatus: 200, send: (h, s) => h.request(`/control-api/v1/rules/entities/${DOC}/archive`, { method: 'POST', session: s }) },
  { name: 'rules unarchive', allowed: ['platform_admin'], mutation: true, successStatus: 200, send: (h, s) => h.request(`/control-api/v1/rules/entities/${DOC}/unarchive`, { method: 'POST', session: s }) },
];

describe('role -> permission matrix over HTTP', () => {
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
    h.upstream.respond = codexStub();
  });

  for (const route of ROUTES) {
    describe(route.name, () => {
      for (const role of ROLES) {
        const allowed = route.allowed.includes(role);
        it(`${allowed ? 'allows' : 'denies'} ${role}`, async () => {
          const session = await h.sessionFor([role]);
          const response = await route.send(h, session);
          const events = h.store.audit;
          if (allowed) {
            expect(response.status).toBe(route.successStatus);
            expect(events.filter((e) => e.outcome === 'denied')).toHaveLength(0);
            expect(events).toHaveLength(route.mutation ? 1 : 0);
            if (route.mutation) expect(events[0]!.outcome).toBe('success');
          } else {
            expect(response.status).toBe(403);
            expect(await response.json()).toMatchObject({ error: 'forbidden' });
            expect(events).toHaveLength(1);
            expect(events[0]).toMatchObject({ outcome: 'denied', actorUserId: session.user.id });
            expect(h.upstreamCalls).toHaveLength(0);
          }
        });
      }

      it('rejects a request without a session (401, audited)', async () => {
        const response = await route.send(h);
        expect(response.status).toBe(401);
        const body = (await response.json()) as { error: string; requestId: string };
        expect(body.error).toBe('unauthenticated');
        expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
        // Anonymous GET /me is a status probe and is not audited.
        expect(h.store.audit).toHaveLength(route.name === 'GET /me' ? 0 : 1);
        expect(h.upstreamCalls).toHaveLength(0);
      });

      it('rejects an idle-expired session (401, session deleted)', async () => {
        const session = await h.sessionFor(['platform_admin']);
        h.store.sessions.get(session.idHash)!.lastSeenAt = new Date(h.clock.now.getTime() - IDLE_TIMEOUT_MS);
        const response = await route.send(h, session);
        expect(response.status).toBe(401);
        expect(h.store.sessions.has(session.idHash)).toBe(false);
        expect(h.store.audit.filter((e) => e.outcome === 'denied')).toHaveLength(1);
        expect(h.store.audit[0]!.summary).toMatchObject({ reason: 'session_expired' });
      });

      it('denies a user whose role was revoked', async () => {
        const session = await h.sessionFor(['platform_admin']);
        for (const row of h.store.roles) if (row.userId === session.user.id) row.revokedAt = h.clock.now;
        const response = await route.send(h, session);
        expect(response.status).toBe(403);
        expect(h.store.audit).toHaveLength(1);
        expect(h.store.audit[0]!.summary).toMatchObject({ reason: 'no_active_role' });
        expect(h.upstreamCalls).toHaveLength(0);
      });
    });
  }
});
