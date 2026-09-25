import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { sha256Hex } from '../../src/auth/tokens.js';
import type { Role } from '../../src/permissions.js';
import type { AuditDraft, AuditEventInput, ControlStore, SessionRecord } from '../../src/store/types.js';

export interface StoreFixtures {
  store: () => ControlStore;
  reset: () => Promise<void>;
  createUser: (email: string, options?: { provider?: string; isActive?: boolean }) => Promise<string>;
  addRole: (userId: string, role: Role) => Promise<void>;
}

const T0 = new Date('2026-09-24T12:00:00.000Z');

function session(userId: string, overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    idHash: sha256Hex(randomBytes(16).toString('hex')),
    userId,
    csrfToken: 'csrf-token-value',
    createdAt: T0,
    lastSeenAt: T0,
    expiresAt: new Date(T0.getTime() + 12 * 3600_000),
    recentAuthAt: T0,
    sourceIp: '10.0.0.5',
    ...overrides,
  };
}

function audit(action: string, summary: Record<string, unknown> = {}): AuditEventInput {
  return {
    requestId: '6f1c2b8a-3d4e-4f5a-8b9c-0d1e2f3a4b5c',
    actorUserId: null,
    actorEmail: 'actor@example.com',
    identityProvider: 'google',
    roleUsed: 'platform_admin',
    action,
    resourceType: 'user_role',
    resourceId: null,
    priorVersion: null,
    sourceIp: '10.0.0.5',
    outcome: 'success',
    summary,
  };
}

function draft(action: string): AuditDraft {
  const { outcome: _o, resourceId: _r, ...rest } = audit(action, { role: 'x' });
  return rest;
}

/** Runs identically against the in-memory store and PostgreSQL. */
export function defineStoreContract(name: string, fx: StoreFixtures): void {
  describe(`ControlStore contract: ${name}`, () => {
    beforeEach(async () => {
      await fx.reset();
    });

    it('matches Google and password users by email case-insensitively and ignores other providers', async () => {
      const googleId = await fx.createUser('Admin@Example.com');
      const localId = await fx.createUser('local@example.com', { provider: 'local' });
      await fx.createUser('discord@example.com', { provider: 'discord' });
      expect((await fx.store().findAdminEligibleUserByEmail('admin@example.COM'))?.id).toBe(googleId);
      expect((await fx.store().findAdminEligibleUserByEmail('LOCAL@example.com'))?.id).toBe(localId);
      expect(await fx.store().findAdminEligibleUserByEmail('discord@example.com')).toBeNull();
      expect(await fx.store().findAdminEligibleUserByEmail('nobody@example.com')).toBeNull();
    });

    it('completes a login atomically: binds subject, stores session, writes audit', async () => {
      const userId = await fx.createUser('a@example.com');
      await fx.addRole(userId, 'auditor');
      const s = session(userId);
      const result = await fx.store().completeLogin({ userId, bindSubject: 'sub-a', replaceSessionHash: null, session: s, audit: { ...audit('auth.login'), actorUserId: userId } });
      expect(result).toBe('ok');
      expect(await fx.store().getIdentitySubject(userId)).toBe('sub-a');
      expect(await fx.store().findUserIdBySubject('sub-a')).toBe(userId);
      const context = await fx.store().getSessionContext(s.idHash);
      expect(context?.roles).toEqual(['auditor']);
      expect(context?.user.email).toBe('a@example.com');
      expect(context?.session.expiresAt.toISOString()).toBe(s.expiresAt.toISOString());
      const events = await fx.store().listAuditEvents({ limit: 10 });
      expect(events.map((e) => e.action)).toEqual(['auth.login']);
    });

    it('rotates the previous session on login and refuses a subject owned by someone else', async () => {
      const a = await fx.createUser('a@example.com');
      const b = await fx.createUser('b@example.com');
      const first = session(a);
      await fx.store().completeLogin({ userId: a, bindSubject: 'sub-a', replaceSessionHash: null, session: first, audit: audit('auth.login') });
      const second = session(a);
      await fx.store().completeLogin({ userId: a, bindSubject: null, replaceSessionHash: first.idHash, session: second, audit: audit('auth.login') });
      expect(await fx.store().getSessionContext(first.idHash)).toBeNull();
      expect(await fx.store().getSessionContext(second.idHash)).not.toBeNull();

      const hijack = session(b);
      expect(await fx.store().completeLogin({ userId: b, bindSubject: 'sub-a', replaceSessionHash: null, session: hijack, audit: audit('auth.login') })).toBe('subject_conflict');
      expect(await fx.store().getSessionContext(hijack.idHash)).toBeNull();
      expect(await fx.store().getIdentitySubject(b)).toBeNull();
    });

    it('touches and deletes sessions', async () => {
      const a = await fx.createUser('a@example.com');
      const s = session(a);
      await fx.store().completeLogin({ userId: a, bindSubject: null, replaceSessionHash: null, session: s, audit: audit('auth.login') });
      const later = new Date(T0.getTime() + 60_000);
      await fx.store().touchSession(s.idHash, later);
      await fx.store().touchSession(s.idHash, T0); // never moves backwards
      expect((await fx.store().getSessionContext(s.idHash))?.session.lastSeenAt.toISOString()).toBe(later.toISOString());
      await fx.store().deleteSession(s.idHash, audit('auth.logout'));
      expect(await fx.store().getSessionContext(s.idHash)).toBeNull();
      expect((await fx.store().listAuditEvents({ limit: 1 }))[0]?.action).toBe('auth.logout');
    });

    it('grants roles once per user and role, ending the target sessions', async () => {
      const a = await fx.createUser('a@example.com');
      const s = session(a);
      await fx.store().completeLogin({ userId: a, bindSubject: null, replaceSessionHash: null, session: s, audit: audit('auth.login') });
      expect(await fx.store().grantRole({ email: 'A@example.com', role: 'operator', grantedBy: null, at: T0 }, draft('admins.grant_role'))).toEqual({ status: 'granted', userId: a });
      expect(await fx.store().getSessionContext(s.idHash)).toBeNull();
      expect(await fx.store().grantRole({ email: 'a@example.com', role: 'operator', grantedBy: null, at: T0 }, draft('admins.grant_role'))).toEqual({ status: 'already_active', userId: a });
      expect(await fx.store().grantRole({ email: 'none@example.com', role: 'operator', grantedBy: null, at: T0 }, draft('admins.grant_role'))).toEqual({ status: 'user_not_found' });
      const local = await fx.createUser('local@example.com', { provider: 'local' });
      expect(await fx.store().grantRole({ email: 'local@example.com', role: 'operator', grantedBy: null, at: T0 }, draft('admins.grant_role'))).toEqual({ status: 'granted', userId: local });
      const discord = await fx.createUser('discord@example.com', { provider: 'discord' });
      expect(await fx.store().grantRole({ email: 'discord@example.com', role: 'operator', grantedBy: null, at: T0 }, draft('admins.grant_role'))).toEqual({ status: 'user_not_found' });
      expect(await fx.store().getActiveRoles(discord)).toEqual([]);
      const inactive = await fx.createUser('off@example.com', { isActive: false });
      expect(await fx.store().grantRole({ email: 'off@example.com', role: 'operator', grantedBy: null, at: T0 }, draft('admins.grant_role'))).toEqual({ status: 'user_not_found' });
      expect(await fx.store().getActiveRoles(inactive)).toEqual([]);
      const outcomes = (await fx.store().listAuditEvents({ limit: 10 })).map((e) => e.outcome);
      expect(outcomes.slice(0, 6)).toEqual(['failure', 'failure', 'success', 'failure', 'conflict', 'success']);
    });

    it('protects the last active platform_admin and keeps revoked history', async () => {
      const a = await fx.createUser('a@example.com');
      const b = await fx.createUser('b@example.com');
      await fx.addRole(a, 'platform_admin');
      expect(await fx.store().revokeRole({ userId: a, role: 'platform_admin', revokedBy: null, at: T0 }, draft('admins.revoke_role'))).toBe('last_platform_admin');
      await fx.addRole(b, 'platform_admin');
      expect(await fx.store().revokeRole({ userId: a, role: 'platform_admin', revokedBy: b, at: T0 }, draft('admins.revoke_role'))).toBe('revoked');
      expect(await fx.store().revokeRole({ userId: a, role: 'platform_admin', revokedBy: b, at: T0 }, draft('admins.revoke_role'))).toBe('not_active');
      expect(await fx.store().revokeRole({ userId: b, role: 'platform_admin', revokedBy: null, at: T0 }, draft('admins.revoke_role'))).toBe('last_platform_admin');
      // Re-granting after a revocation creates a new active row.
      expect((await fx.store().grantRole({ email: 'a@example.com', role: 'platform_admin', grantedBy: b, at: T0 }, draft('admins.grant_role'))).status).toBe('granted');
      const admins = await fx.store().listAdministrators();
      expect(admins.map((x) => x.user.email).sort()).toEqual(['a@example.com', 'b@example.com']);
    });

    it('serializes concurrent revocations so one platform_admin always remains', async () => {
      const a = await fx.createUser('a@example.com');
      const b = await fx.createUser('b@example.com');
      await fx.addRole(a, 'platform_admin');
      await fx.addRole(b, 'platform_admin');
      const results = await Promise.all([
        fx.store().revokeRole({ userId: a, role: 'platform_admin', revokedBy: b, at: T0 }, draft('admins.revoke_role')),
        fx.store().revokeRole({ userId: b, role: 'platform_admin', revokedBy: a, at: T0 }, draft('admins.revoke_role')),
      ]);
      expect(results.sort()).toEqual(['last_platform_admin', 'revoked']);
    });

    it('pages audit events newest first and sanitizes summaries', async () => {
      for (let i = 0; i < 3; i++) await fx.store().appendAudit(audit(`e.${i}`, { i, token: 'secret-token', body: 'content' }));
      const page = await fx.store().listAuditEvents({ limit: 2 });
      expect(page.map((e) => e.action)).toEqual(['e.2', 'e.1']);
      expect(page[0]?.summary).toEqual({ i: 2 });
      const next = await fx.store().listAuditEvents({ limit: 2, beforeId: page[1]!.id });
      expect(next.map((e) => e.action)).toEqual(['e.0']);
      expect(JSON.stringify(page)).not.toContain('secret-token');
    });
  });
}
